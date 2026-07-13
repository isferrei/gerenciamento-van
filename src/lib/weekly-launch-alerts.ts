import type { DailyEntry } from '../types'
import { previousIsoDate } from './dates'

/** Textos fixos pedidos para alertas na UI */
export const ALERT_KM = 'Falta KM'
export const ALERT_COMBUSTIVEL = 'Falta combustível'
export const ALERT_VALE = 'Falta vale'
export const ALERT_VIAGENS = 'Conferir viagens'
export const ALERT_KM_REGRESSAO = 'KM menor que o dia anterior'

export function getPrevKmFromWorkMap(
  dateIso: string,
  workByDate: Map<string, DailyEntry>,
): number | null {
  const prev = previousIsoDate(dateIso)
  const e = workByDate.get(prev)
  if (e && e.km > 0) return e.km
  return null
}

/** Alertas vermelhos / revisão — ordem estável */
export function listWeeklyDayAlerts(
  dateIso: string,
  entry: DailyEntry | undefined,
  prevKm: number | null,
  touched: boolean,
): string[] {
  const out: string[] = []
  if (!entry) return out

  const hasAnyFill =
    entry.km > 0 ||
    entry.valeTransQtd > 0 ||
    entry.combustivel > 0 ||
    entry.viagensEdson > 0 ||
    entry.viagensBispo > 0 ||
    entry.outrasDespesas > 0

  if (!hasAnyFill && !touched) return out

  if (!entry.km || entry.km <= 0) out.push(ALERT_KM)
  if (entry.valeTransQtd <= 0) out.push(ALERT_VALE)
  if (!entry.combustivel || entry.combustivel <= 0) out.push(ALERT_COMBUSTIVEL)

  const wd = new Date(dateIso + 'T12:00:00').getDay()
  if (wd >= 1 && wd <= 6) {
    const v = entry.viagensEdson + entry.viagensBispo
    if (v > 0 && (entry.viagensEdson < 3 || entry.viagensBispo < 3)) out.push(ALERT_VIAGENS)
  }
  if (wd === 0 && entry.viagensEdson > 0 && entry.viagensBispo > 0) out.push(ALERT_VIAGENS)

  if (prevKm !== null && prevKm > 0 && entry.km > 0 && entry.km < prevKm) out.push(ALERT_KM_REGRESSAO)

  return [...new Set(out)]
}

export type WeeklyCardStatus = 'completo' | 'revisar' | 'faltando'

export function computeWeeklyCardStatus(input: {
  alerts: string[]
  reviewed: boolean
  lowConfidenceAny: boolean
  hasAnyFill: boolean
  touched: boolean
}): WeeklyCardStatus {
  const { alerts, reviewed, lowConfidenceAny, hasAnyFill, touched } = input
  if (!hasAnyFill && !touched) return 'completo'

  const hasRed = alerts.some((a) => a === ALERT_KM_REGRESSAO)
  const hasMissing =
    alerts.includes(ALERT_KM) || alerts.includes(ALERT_COMBUSTIVEL) || alerts.includes(ALERT_VALE)

  if (hasRed || hasMissing) return 'faltando'
  if (!reviewed || lowConfidenceAny || alerts.includes(ALERT_VIAGENS)) return 'revisar'
  return 'completo'
}
