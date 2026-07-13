import type { AppSettings, DailyEntry, MotoristaDomingo } from '../types'
import { parseDecimal, parseKmInput } from './format'
import { isSundayIso } from './dates'
import { enforceSundaySingleDriver } from './prefill-trips'

export interface DerivedMoney {
  valeTransValor: number
  salarioEdson: number
  salarioBispo: number
  salarioTotal: number
  lucroLiquido: number
}

/** Soma APTRAN + Morro + Fiscal (R$ / semana nas configurações). */
export function totalWeeklyFixedExpenses(settings: AppSettings): number {
  const a = Number(settings.despesaAptran) || 0
  const b = Number(settings.despesaMorro) || 0
  const c = Number(settings.despesaFiscal) || 0
  return Math.round((a + b + c) * 100) / 100
}

export function computeDerived(
  partial: Pick<
    DailyEntry,
    | 'valeTransQtd'
    | 'combustivel'
    | 'outrasDespesas'
    | 'viagensEdson'
    | 'viagensBispo'
  >,
  settings: AppSettings,
): DerivedMoney {
  const qtd = Math.max(0, Math.round(Number(partial.valeTransQtd)))
  const valeTransValor = Math.round(qtd * settings.valorValeTrans * 100) / 100
  const viagensEdson = Math.max(0, Math.round(Number(partial.viagensEdson)))
  const viagensBispo = Math.max(0, Math.round(Number(partial.viagensBispo)))
  const salarioEdson = Math.round(viagensEdson * settings.valorViagemEdson * 100) / 100
  const salarioBispo = Math.round(viagensBispo * settings.valorViagemBispo * 100) / 100
  const salarioTotal = Math.round((salarioEdson + salarioBispo) * 100) / 100
  const combustivel = parseDecimal(String(partial.combustivel))
  const outras = parseDecimal(String(partial.outrasDespesas))
  const lucroLiquido = Math.round((valeTransValor - combustivel - outras - salarioTotal) * 100) / 100
  return { valeTransValor, salarioEdson, salarioBispo, salarioTotal, lucroLiquido }
}

/** Viagens do motorista ativo no domingo × valor da viagem. `motoristaDomingo` null = configuração global. */
export function sundaySuggestedRepasse(
  dateIso: string,
  viagensEdson: number,
  viagensBispo: number,
  settings: AppSettings,
  motoristaDomingo?: MotoristaDomingo | null,
): number {
  if (!isSundayIso(dateIso)) return 0
  const active = motoristaDomingo ?? settings.motoristaDomingoPadrao
  const trips = active === 'Edson' ? viagensEdson : viagensBispo
  const rate = active === 'Edson' ? settings.valorViagemEdson : settings.valorViagemBispo
  return Math.round(Math.max(0, trips) * rate * 100) / 100
}

function normalizeDomingoFields(e: DailyEntry): DailyEntry {
  const domingoValorRepasse = Math.max(0, Number(e.domingoValorRepasse ?? 0))
  const domingoMotoristaAtivo: MotoristaDomingo | null =
    e.domingoMotoristaAtivo === 'Edson' || e.domingoMotoristaAtivo === 'Bispo' ?
      e.domingoMotoristaAtivo
    : null
  return { ...e, domingoValorRepasse, domingoMotoristaAtivo }
}

export function recalcEntry(e: DailyEntry, settings: AppSettings): DailyEntry {
  const eClean = normalizeDomingoFields(e)
  const motoristaSunday = eClean.domingoMotoristaAtivo ?? settings.motoristaDomingoPadrao
  const v = enforceSundaySingleDriver(
    eClean.date,
    eClean.viagensEdson,
    eClean.viagensBispo,
    settings,
    eClean.domingoMotoristaAtivo,
  )
  const eNorm = { ...eClean, viagensEdson: v.edson, viagensBispo: v.bispo }
  const d = computeDerived(eNorm, settings)

  if (!isSundayIso(eClean.date)) {
    return {
      ...eNorm,
      valeTransValor: d.valeTransValor,
      salarioEdson: d.salarioEdson,
      salarioBispo: d.salarioBispo,
      salarioTotal: d.salarioTotal,
      lucroLiquido: d.lucroLiquido,
    }
  }

  const combustivel = parseDecimal(String(eNorm.combustivel))
  const outras = parseDecimal(String(eNorm.outrasDespesas))

  if (eNorm.domingoMotoristaSePagou) {
    const lucroLiquido = Math.round((d.valeTransValor - combustivel - outras) * 100) / 100
    return {
      ...eNorm,
      valeTransValor: d.valeTransValor,
      salarioEdson: 0,
      salarioBispo: 0,
      salarioTotal: 0,
      lucroLiquido,
    }
  }

  const manual = Math.max(0, Number(eNorm.domingoValorRepasse ?? 0))
  const salTotal = manual > 0 ? manual : d.salarioTotal
  const active = motoristaSunday
  const salarioEdson = active === 'Edson' ? salTotal : 0
  const salarioBispo = active === 'Bispo' ? salTotal : 0
  const lucroLiquido =
    Math.round((d.valeTransValor - combustivel - outras - salTotal) * 100) / 100

  return {
    ...eNorm,
    valeTransValor: d.valeTransValor,
    salarioEdson,
    salarioBispo,
    salarioTotal: salTotal,
    lucroLiquido,
  }
}

export function normalizeEntryForSave(
  draft: DailyEntry,
  settings: AppSettings,
  existingCreatedAt?: string,
): DailyEntry {
  const km = Math.max(0, parseKmInput(String(draft.km)))
  const valeTransQtd = Math.max(0, Math.round(parseDecimal(String(draft.valeTransQtd))))
  const combustivel = parseDecimal(String(draft.combustivel))
  const outrasDespesas = parseDecimal(String(draft.outrasDespesas))
  let viagensEdson = Math.max(0, Math.round(parseDecimal(String(draft.viagensEdson))))
  let viagensBispo = Math.max(0, Math.round(parseDecimal(String(draft.viagensBispo))))
  const sun = enforceSundaySingleDriver(
    draft.date,
    viagensEdson,
    viagensBispo,
    settings,
    draft.domingoMotoristaAtivo === 'Edson' || draft.domingoMotoristaAtivo === 'Bispo' ?
      draft.domingoMotoristaAtivo
    : null,
  )
  viagensEdson = sun.edson
  viagensBispo = sun.bispo
  const now = new Date().toISOString()
  const normalized: DailyEntry = {
    id: draft.id,
    date: draft.date,
    km,
    valeTransQtd,
    valeTransValor: 0,
    combustivel,
    outrasDespesas,
    lucroLiquido: 0,
    viagensEdson,
    viagensBispo,
    salarioEdson: 0,
    salarioBispo: 0,
    salarioTotal: 0,
    domingoMotoristaSePagou: Boolean(draft.domingoMotoristaSePagou),
    domingoValorRepasse: Math.max(0, parseDecimal(String(draft.domingoValorRepasse ?? 0))),
    domingoMotoristaAtivo:
      draft.domingoMotoristaAtivo === 'Edson' || draft.domingoMotoristaAtivo === 'Bispo' ?
        draft.domingoMotoristaAtivo
      : null,
    observacoes: draft.observacoes?.trim() ?? '',
    createdAt: existingCreatedAt ?? draft.createdAt ?? now,
    updatedAt: now,
  }
  const recalced = recalcEntry(normalized, settings)
  return { ...recalced, updatedAt: now }
}
