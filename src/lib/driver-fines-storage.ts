import type {
  DriverFineMotoristaId,
  DriverFineRecord,
  DriverFinesDb,
  FineParcelRecord,
} from './driver-fines-types'
import {
  attachFineAggregates,
  buildInstallmentsForFine,
  confirmWeekDiscounts,
  findNextPendingParcel,
  markParcelPaidManual,
  motoristaLabel,
  revertInstallmentToPending,
  revertWeekDiscounts,
  roundMoney,
  splitParcelValues,
  syncAllFines,
} from './driver-fines-logic'

const DB_KEY = 'gerenciamento-van:driver-fines-db:v1'

function emptyDb(): DriverFinesDb {
  return { fines: [], installments: [] }
}

export function loadDriverFinesDb(): DriverFinesDb {
  const raw = localStorage.getItem(DB_KEY)
  if (!raw) return emptyDb()
  try {
    const p = JSON.parse(raw) as Partial<DriverFinesDb>
    if (!p || !Array.isArray(p.fines) || !Array.isArray(p.installments)) return emptyDb()
    const parsed = {
      fines: p.fines as DriverFineRecord[],
      installments: p.installments as FineParcelRecord[],
    }
    const synced = syncAllFines(parsed)
    if (JSON.stringify(parsed.installments) !== JSON.stringify(synced.installments)) {
      saveDriverFinesDb(synced)
      return synced
    }
    return synced
  } catch {
    return emptyDb()
  }
}

export function saveDriverFinesDb(db: DriverFinesDb): void {
  const synced = syncAllFines(db)
  localStorage.setItem(DB_KEY, JSON.stringify(synced))
}

export interface CreateFineInput {
  motoristaId: DriverFineMotoristaId
  dataMulta: string
  descricao: string
  valorTotal: number
  quantidadeParcelas: number
  dataInicioDesconto: string
  observacao: string
}

export function createFine(input: CreateFineInput): DriverFinesDb {
  const now = new Date().toISOString()
  const n = Math.max(1, Math.round(input.quantidadeParcelas))
  const total = roundMoney(input.valorTotal)
  const parts = splitParcelValues(total, n)
  const valorParcela = roundMoney(total / n)
  const id = crypto.randomUUID()
  let fine: DriverFineRecord = {
    id,
    motoristaId: input.motoristaId,
    motoristaNome: motoristaLabel(input.motoristaId),
    dataMulta: input.dataMulta,
    descricao: input.descricao.trim(),
    valorTotal: total,
    quantidadeParcelas: n,
    valorParcela,
    parcelasPagas: 0,
    parcelasRestantes: n,
    status: 'ativa',
    quitadaManual: false,
    ativaManual: false,
    dataInicioDesconto: input.dataInicioDesconto,
    observacao: input.observacao.trim(),
    createdAt: now,
    updatedAt: now,
  }
  const newInst = buildInstallmentsForFine(fine, parts)
  const db = loadDriverFinesDb()
  fine = attachFineAggregates(fine, newInst)
  const next = syncAllFines({
    ...db,
    fines: [...db.fines, fine],
    installments: [...db.installments, ...newInst],
  })
  saveDriverFinesDb(next)
  return next
}

export function updateFine(
  id: string,
  patch: Partial<
    Pick<
      DriverFineRecord,
      'descricao' | 'observacao' | 'dataMulta' | 'dataInicioDesconto' | 'valorTotal' | 'quantidadeParcelas'
    >
  >,
): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const fine = db.fines.find((f) => f.id === id)
  if (!fine) return null
  if (fine.status === 'cancelada') return null
  const paid = db.installments.some(
    (i) => i.multaId === id && i.status === 'descontada',
  )
  const lockedTotals =
    paid || fine.status === 'quitada' || fine.quitadaManual === true
  const now = new Date().toISOString()
  if (lockedTotals) {
    const next = syncAllFines({
      ...db,
      fines: db.fines.map((f) =>
        f.id === id ?
          { ...f, descricao: patch.descricao?.trim() ?? f.descricao, observacao: patch.observacao?.trim() ?? f.observacao, updatedAt: now }
        : f,
      ),
    })
    saveDriverFinesDb(next)
    return next
  }

  const valorTotal = patch.valorTotal != null ? roundMoney(patch.valorTotal) : fine.valorTotal
  const quantidadeParcelas =
    patch.quantidadeParcelas != null ?
      Math.max(1, Math.round(patch.quantidadeParcelas))
    : fine.quantidadeParcelas
  const descricao = patch.descricao?.trim() ?? fine.descricao
  const observacao = patch.observacao?.trim() ?? fine.observacao
  const dataMulta = patch.dataMulta ?? fine.dataMulta
  const dataInicioDesconto = patch.dataInicioDesconto ?? fine.dataInicioDesconto

  const parts = splitParcelValues(valorTotal, quantidadeParcelas)
  const valorParcela = roundMoney(valorTotal / quantidadeParcelas)

  let updated: DriverFineRecord = {
    ...fine,
    descricao,
    observacao,
    dataMulta,
    dataInicioDesconto,
    valorTotal,
    quantidadeParcelas,
    valorParcela,
    updatedAt: now,
  }

  const newInst = buildInstallmentsForFine(updated, parts)
  updated = attachFineAggregates(updated, newInst)

  const installments = db.installments.filter((i) => i.multaId !== id)
  const next = syncAllFines({
    ...db,
    fines: db.fines.map((f) => (f.id === id ? updated : f)),
    installments: [...installments, ...newInst],
  })
  saveDriverFinesDb(next)
  return next
}

export function cancelFine(id: string): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const fine = db.fines.find((f) => f.id === id)
  if (!fine || fine.status !== 'ativa') return null
  const now = new Date().toISOString()
  const installments = db.installments.map((i) => {
    if (i.multaId !== id) return i
    if (i.status === 'descontada') return i
    return { ...i, status: 'cancelada' as const, updatedAt: now }
  })
  const fines = db.fines.map((f) =>
    f.id === id ?
      {
        ...f,
        status: 'cancelada' as const,
        quitadaManual: false,
        ativaManual: false,
        updatedAt: now,
      }
    : f,
  )
  const next = syncAllFines({ fines, installments })
  saveDriverFinesDb(next)
  return next
}

export function payNextParcelForFine(fineId: string): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const p = findNextPendingParcel(db, fineId)
  if (!p) return null
  const next = markParcelPaidManual(db, p.id)
  saveDriverFinesDb(next)
  return next
}

export function revertParcelToPending(parcelId: string): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const next = revertInstallmentToPending(db, parcelId)
  if (!next) return null
  saveDriverFinesDb(next)
  return next
}

/** Marca ou desmarca quitada manual (não altera parcelas). */
export function setFineQuitadaManual(id: string, quitadaManual: boolean): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const fine = db.fines.find((f) => f.id === id)
  if (!fine || fine.status === 'cancelada') return null
  const now = new Date().toISOString()
  const next = syncAllFines({
    ...db,
    fines: db.fines.map((f) =>
      f.id === id ?
        {
          ...f,
          quitadaManual,
          ativaManual: quitadaManual ? false : (f.ativaManual ?? false),
          updatedAt: now,
        }
      : f,
    ),
  })
  saveDriverFinesDb(next)
  return next
}

/** Força multa como ativa (reabre após quitada) para voltar ao repasse; limpa quitada manual. */
export function setFineAtivaManual(id: string, ativaManual: boolean): DriverFinesDb | null {
  const db = loadDriverFinesDb()
  const fine = db.fines.find((f) => f.id === id)
  if (!fine || fine.status === 'cancelada') return null
  const now = new Date().toISOString()
  const next = syncAllFines({
    ...db,
    fines: db.fines.map((f) =>
      f.id === id ?
        {
          ...f,
          ativaManual,
          quitadaManual: ativaManual ? false : (f.quitadaManual ?? false),
          updatedAt: now,
        }
      : f,
    ),
  })
  saveDriverFinesDb(next)
  return next
}

export function confirmRepasseWeekDiscounts(
  weekMondayIso: string,
  picks?: Partial<Record<DriverFineMotoristaId, string | null>>,
): DriverFinesDb {
  const db = loadDriverFinesDb()
  const next = confirmWeekDiscounts(db, weekMondayIso, picks)
  saveDriverFinesDb(next)
  return next
}

export function revertRepasseWeekDiscounts(
  weekMondayIso: string,
  picks?: Partial<Record<DriverFineMotoristaId, string | null>>,
): DriverFinesDb {
  const db = loadDriverFinesDb()
  const next = revertWeekDiscounts(db, weekMondayIso, picks)
  saveDriverFinesDb(next)
  return next
}
