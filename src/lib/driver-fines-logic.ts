import { startOfIsoWeek, todayIso } from './dates'
import type {
  DriverFineMotoristaId,
  DriverFineRecord,
  DriverFinesDb,
  FineParcelRecord,
  FineParcelStatus,
  FineRecordStatus,
} from './driver-fines-types'

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Divide total em n parcelas em centavos; última absorve diferença de arredondamento. */
export function splitParcelValues(total: number, n: number): number[] {
  if (n <= 0) return []
  const centsTotal = Math.round(total * 100)
  const base = Math.floor(centsTotal / n)
  const arr: number[] = []
  let acc = 0
  for (let i = 0; i < n - 1; i++) {
    arr.push(base / 100)
    acc += base
  }
  arr.push((centsTotal - acc) / 100)
  return arr
}

export function mondayIsoFromDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  const m = startOfIsoWeek(d)
  const y = m.getFullYear()
  const mo = String(m.getMonth() + 1).padStart(2, '0')
  const day = String(m.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function addWeeksMonday(mondayIso: string, weeks: number): string {
  const [y, m, d] = mondayIso.split('-').map(Number)
  if (!y || !m || !d) return mondayIso
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + weeks * 7)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

export function motoristaLabel(id: DriverFineMotoristaId): string {
  return id === 'edson' ? 'Edson' : 'Bispo'
}

export function attachFineAggregates(
  fine: DriverFineRecord,
  installments: FineParcelRecord[],
): DriverFineRecord {
  const mine = installments.filter((x) => x.multaId === fine.id)
  const paid = mine.filter((x) => x.status === 'descontada')
  const parcelasPagas = paid.length
  const totalPago = roundMoney(paid.reduce((s, x) => s + x.valor, 0))
  const parcelasRestantes = Math.max(0, fine.quantidadeParcelas - parcelasPagas)
  const saldoRestante = roundMoney(fine.valorTotal - totalPago)

  /** Quitada automática por parcelas/saldo; `ativaManual` reabre; `quitadaManual` força quitada. */
  let status: FineRecordStatus
  if (fine.status === 'cancelada') status = 'cancelada'
  else if (fine.ativaManual === true) status = 'ativa'
  else if (fine.quitadaManual === true) status = 'quitada'
  else if (parcelasRestantes <= 0 || saldoRestante <= 0.005) status = 'quitada'
  else status = 'ativa'

  const now = new Date().toISOString()
  return {
    ...fine,
    parcelasPagas,
    parcelasRestantes,
    status,
    updatedAt: now,
  }
}

/**
 * Alinha parcelas ao cadastro da multa: `motoristaId` e `valor` da parcela N
 * devem coincidir com a multa e com `splitParcelValues` (evita desconto no repasse
 * no motorista ou valor errados).
 */
export function normalizeInstallmentsAgainstFines(
  installments: FineParcelRecord[],
  fines: DriverFineRecord[],
): FineParcelRecord[] {
  const now = new Date().toISOString()
  const byId = new Map(fines.map((f) => [f.id, f]))
  return installments.map((p) => {
    const fine = byId.get(p.multaId)
    if (!fine) return p

    const parts = splitParcelValues(fine.valorTotal, fine.quantidadeParcelas)
    const idx = p.numeroParcela - 1
    const expectedValor =
      idx >= 0 && idx < parts.length ? roundMoney(parts[idx]) : null

    const motoristaOk = p.motoristaId === fine.motoristaId
    const valorOk =
      expectedValor === null ? true : Math.abs(expectedValor - p.valor) <= 0.009

    if (motoristaOk && valorOk) return p

    return {
      ...p,
      motoristaId: fine.motoristaId,
      ...(expectedValor !== null && !valorOk ? { valor: expectedValor } : {}),
      updatedAt: now,
    }
  })
}

export function syncAllFines(db: DriverFinesDb): DriverFinesDb {
  const installments = normalizeInstallmentsAgainstFines(db.installments, db.fines)
  const fines = db.fines.map((f) => attachFineAggregates(f, installments))
  return { ...db, fines, installments }
}

export function saldoRestanteFine(fine: DriverFineRecord, installments: FineParcelRecord[]): number {
  const paid = installments.filter(
    (x) => x.multaId === fine.id && x.status === 'descontada',
  )
  const totalPago = roundMoney(paid.reduce((s, x) => s + x.valor, 0))
  return roundMoney(fine.valorTotal - totalPago)
}

export interface DiscountLine {
  multaId: string
  descricao: string
  valor: number
  parcelaId: string
}

/** Parcelas pendentes agendadas para a semana (segunda = semanaReferencia). */
export function getPendingDiscountsForWeek(
  db: DriverFinesDb,
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
): DiscountLine[] {
  const lines: DiscountLine[] = []
  const activeFines = new Map(db.fines.filter((f) => f.status === 'ativa').map((f) => [f.id, f]))

  for (const p of db.installments) {
    if (p.status !== 'pendente') continue
    if (p.semanaReferencia !== weekMondayIso) continue
    if (p.motoristaId !== motoristaId) continue
    const fine = activeFines.get(p.multaId)
    if (!fine || fine.motoristaId !== motoristaId) continue
    const start = fine.dataInicioDesconto
    if (weekMondayIso < mondayIsoFromDate(start)) continue
    const parts = splitParcelValues(fine.valorTotal, fine.quantidadeParcelas)
    const idx = p.numeroParcela - 1
    const valorLinha =
      idx >= 0 && idx < parts.length ? roundMoney(parts[idx]) : roundMoney(p.valor)
    lines.push({
      multaId: fine.id,
      descricao: fine.descricao,
      valor: valorLinha,
      parcelaId: p.id,
    })
  }
  return lines
}

export function totalDiscountLines(lines: DiscountLine[]): number {
  return roundMoney(lines.reduce((s, x) => s + x.valor, 0))
}

/** Linhas para exibir no contra-cheque (pendentes a aplicar ou já descontadas na semana). */
export interface RepasseDiscountLine {
  multaId: string
  descricao: string
  valor: number
  parcelaId: string
  status: FineParcelStatus
}

export function getRepasseDiscountLinesForWeek(
  db: DriverFinesDb,
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
): RepasseDiscountLine[] {
  const lines: RepasseDiscountLine[] = []
  for (const p of db.installments) {
    if (p.semanaReferencia !== weekMondayIso || p.motoristaId !== motoristaId) continue
    if (p.status === 'cancelada') continue
    if (p.status !== 'pendente' && p.status !== 'descontada') continue
    const fine = db.fines.find((f) => f.id === p.multaId)
    if (!fine || fine.motoristaId !== motoristaId) continue
    if (fine.status === 'cancelada') continue

    if (p.status === 'pendente') {
      if (fine.status !== 'ativa') continue
      if (weekMondayIso < mondayIsoFromDate(fine.dataInicioDesconto)) continue
    }

    const parts = splitParcelValues(fine.valorTotal, fine.quantidadeParcelas)
    const idx = p.numeroParcela - 1
    const valorLinha =
      idx >= 0 && idx < parts.length ? roundMoney(parts[idx]) : roundMoney(p.valor)

    lines.push({
      multaId: fine.id,
      descricao: fine.descricao,
      valor: valorLinha,
      parcelaId: p.id,
      status: p.status,
    })
  }
  return lines
}

/** Confirma desconto da semana no contra-cheque: marca parcelas como descontada. */
export function confirmWeekDiscounts(
  db: DriverFinesDb,
  weekMondayIso: string,
  picks?: Partial<Record<DriverFineMotoristaId, string | null>>,
): DriverFinesDb {
  const now = new Date().toISOString()
  const installments = db.installments.map((p) => {
    if (p.status !== 'pendente') return p
    if (p.semanaReferencia !== weekMondayIso) return p
    const fine = db.fines.find((f) => f.id === p.multaId)
    if (!fine || fine.status !== 'ativa') return p
    const pick = picks?.[p.motoristaId]
    if (pick !== undefined && pick !== null && pick !== '' && p.multaId !== pick) return p
    return {
      ...p,
      status: 'descontada' as FineParcelStatus,
      dataDesconto: now.slice(0, 10),
      updatedAt: now,
    }
  })
  let next: DriverFinesDb = { ...db, installments }
  next = syncAllFines(next)
  return next
}

/** Estorna descontos aplicados na semana (volta parcelas para pendente). */
export function revertWeekDiscounts(
  db: DriverFinesDb,
  weekMondayIso: string,
  picks?: Partial<Record<DriverFineMotoristaId, string | null>>,
): DriverFinesDb {
  const now = new Date().toISOString()
  const installments = db.installments.map((p) => {
    if (p.status !== 'descontada') return p
    if (p.semanaReferencia !== weekMondayIso) return p
    const pick = picks?.[p.motoristaId]
    if (pick !== undefined && pick !== null && pick !== '' && p.multaId !== pick) return p
    return {
      ...p,
      status: 'pendente' as FineParcelStatus,
      dataDesconto: null,
      updatedAt: now,
    }
  })
  let next: DriverFinesDb = { ...db, installments }
  next = syncAllFines(next)
  return next
}

export function weekHasConfirmableDiscounts(
  db: DriverFinesDb,
  weekMondayIso: string,
  picks: Partial<Record<DriverFineMotoristaId, string | null>>,
): boolean {
  for (const p of db.installments) {
    if (p.status !== 'pendente' || p.semanaReferencia !== weekMondayIso) continue
    const fine = db.fines.find((f) => f.id === p.multaId)
    if (!fine || fine.status !== 'ativa') continue
    const pick = picks[p.motoristaId]
    if (pick !== undefined && pick !== null && pick !== '' && p.multaId !== pick) continue
    return true
  }
  return false
}

/** Há parcela descontada nesta semana que será estornada com os `picks` atuais? */
export function weekHasRevertableDiscounts(
  db: DriverFinesDb,
  weekMondayIso: string,
  picks: Partial<Record<DriverFineMotoristaId, string | null>>,
): boolean {
  for (const p of db.installments) {
    if (p.status !== 'descontada' || p.semanaReferencia !== weekMondayIso) continue
    const pick = picks[p.motoristaId]
    if (pick !== undefined && pick !== null && pick !== '' && p.multaId !== pick) continue
    return true
  }
  return false
}

export function buildInstallmentsForFine(
  fine: DriverFineRecord,
  parcelValues: number[],
): FineParcelRecord[] {
  const monday0 = mondayIsoFromDate(fine.dataInicioDesconto)
  const now = new Date().toISOString()
  const out: FineParcelRecord[] = []
  for (let i = 0; i < parcelValues.length; i++) {
    const semanaRef = addWeeksMonday(monday0, i)
    out.push({
      id: crypto.randomUUID(),
      multaId: fine.id,
      motoristaId: fine.motoristaId,
      numeroParcela: i + 1,
      valor: roundMoney(parcelValues[i]),
      semanaReferencia: semanaRef,
      dataDesconto: null,
      status: 'pendente',
      createdAt: now,
      updatedAt: now,
    })
  }
  return out
}

/** Próxima parcela pendente (menor número). */
export function findNextPendingParcel(
  db: DriverFinesDb,
  fineId: string,
): FineParcelRecord | undefined {
  const pending = db.installments.filter(
    (p) => p.multaId === fineId && p.status === 'pendente',
  )
  pending.sort((a, b) => a.numeroParcela - b.numeroParcela)
  return pending[0]
}

export function markParcelPaidManual(db: DriverFinesDb, parcelId: string): DriverFinesDb {
  const now = new Date().toISOString()
  const installments = db.installments.map((p) => {
    if (p.id !== parcelId) return p
    if (p.status !== 'pendente') return p
    return {
      ...p,
      status: 'descontada' as FineParcelStatus,
      dataDesconto: now.slice(0, 10),
      updatedAt: now,
    }
  })
  let next: DriverFinesDb = { ...db, installments }
  next = syncAllFines(next)
  return next
}

/** Volta uma parcela de descontada → pendente (corrige “quitada” indevida ou “Próxima parcela” por engano). */
export function revertInstallmentToPending(db: DriverFinesDb, parcelId: string): DriverFinesDb | null {
  const p = db.installments.find((x) => x.id === parcelId)
  if (!p || p.status !== 'descontada') return null
  const now = new Date().toISOString()
  const installments = db.installments.map((i) =>
    i.id === parcelId ?
      { ...i, status: 'pendente' as FineParcelStatus, dataDesconto: null, updatedAt: now }
    : i,
  )
  let next: DriverFinesDb = { ...db, installments }
  next = syncAllFines(next)
  return next
}

export function currentWeekMondayIso(): string {
  return mondayIsoFromDate(todayIso())
}
