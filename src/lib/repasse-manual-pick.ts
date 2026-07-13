import type { DriverFineMotoristaId, DriverFinesDb } from './driver-fines-types'
import {
  getRepasseDiscountLinesForWeek,
  splitParcelValues,
  roundMoney,
  type RepasseDiscountLine,
} from './driver-fines-logic'

const LS_KEY = 'gerenciamento-van:repasse-manual-pick:v1'

export type RepasseManualPickMap = Record<string, string>

export function repassePickKey(weekMondayIso: string, motoristaId: DriverFineMotoristaId): string {
  return `${weekMondayIso}::${motoristaId}`
}

export function loadRepasseManualPickMap(): RepasseManualPickMap {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return {}
    return p as RepasseManualPickMap
  } catch {
    return {}
  }
}

export function setRepasseManualFinePick(
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
  fineId: string | null,
): void {
  const map = { ...loadRepasseManualPickMap() }
  const k = repassePickKey(weekMondayIso, motoristaId)
  if (fineId === null || fineId === '') delete map[k]
  else map[k] = fineId
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

export function getRepasseManualFinePick(
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
): string | null {
  const v = loadRepasseManualPickMap()[repassePickKey(weekMondayIso, motoristaId)]
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** Multas ativas do motorista com parcela pendente nesta segunda-feira. */
export function listRepasseSelectableFines(
  db: DriverFinesDb,
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
): { id: string; descricao: string; valorSemana: number }[] {
  const out: { id: string; descricao: string; valorSemana: number }[] = []
  for (const f of db.fines) {
    if (f.status !== 'ativa' || f.motoristaId !== motoristaId) continue
    const p = db.installments.find(
      (i) =>
        i.multaId === f.id &&
        i.status === 'pendente' &&
        i.semanaReferencia === weekMondayIso &&
        i.motoristaId === motoristaId,
    )
    if (!p) continue
    const parts = splitParcelValues(f.valorTotal, f.quantidadeParcelas)
    const idx = p.numeroParcela - 1
    const valorSemana =
      idx >= 0 && idx < parts.length ? roundMoney(parts[idx]) : roundMoney(p.valor)
    out.push({ id: f.id, descricao: f.descricao, valorSemana })
  }
  return out
}

/**
 * Se `manualFineId` for null: retorna todas as linhas automáticas.
 * Se for string: só linhas dessa multa; se o automático não trouxe nada, tenta montar a linha da parcela pendente da semana.
 */
export function applyRepasseManualFinePick(
  db: DriverFinesDb,
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
  manualFineId: string | null,
  autoLines: RepasseDiscountLine[],
): RepasseDiscountLine[] {
  if (!manualFineId) return autoLines
  const filtered = autoLines.filter((l) => l.multaId === manualFineId)
  if (filtered.length > 0) return filtered

  const fine = db.fines.find((f) => f.id === manualFineId)
  if (!fine || fine.status !== 'ativa' || fine.motoristaId !== motoristaId) return autoLines

  const p = db.installments.find(
    (i) =>
      i.multaId === manualFineId &&
      i.status === 'pendente' &&
      i.semanaReferencia === weekMondayIso &&
      i.motoristaId === motoristaId,
  )
  if (!p) return autoLines

  const parts = splitParcelValues(fine.valorTotal, fine.quantidadeParcelas)
  const idx = p.numeroParcela - 1
  const valorLinha =
    idx >= 0 && idx < parts.length ? roundMoney(parts[idx]) : roundMoney(p.valor)
  return [
    {
      multaId: fine.id,
      descricao: fine.descricao,
      valor: valorLinha,
      parcelaId: p.id,
      status: 'pendente',
    },
  ]
}

export function buildRepasseDiscountLinesWithPick(
  db: DriverFinesDb,
  weekMondayIso: string,
  motoristaId: DriverFineMotoristaId,
  manualFineId: string | null,
): RepasseDiscountLine[] {
  const auto = getRepasseDiscountLinesForWeek(db, weekMondayIso, motoristaId)
  return applyRepasseManualFinePick(db, weekMondayIso, motoristaId, manualFineId, auto)
}
