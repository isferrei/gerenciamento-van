import type { DailyEntry } from '../types'

export type ConferenciaStatusLevel = 'ok' | 'warn' | 'error'

export interface ConferenciaDayStatus {
  level: ConferenciaStatusLevel
  label: string
  messages: string[]
}

function prevIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** JS getDay: 0=Dom … 6=Sáb */
function jsWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 0
  return new Date(y, m - 1, d).getDay()
}

export function computeConferenciaDayStatus(input: {
  date: string
  entry: DailyEntry | undefined
  prevDayKm: number | null
}): ConferenciaDayStatus {
  const { date, entry, prevDayKm } = input
  const messages: string[] = []

  if (!entry) {
    messages.push('Sem lançamento · lucro líquido vazio')
    return { level: 'warn', label: 'Falta dados', messages }
  }

  const wd = jsWeekday(date)
  const km = entry.km
  const kmMissing = !Number.isFinite(km) || km <= 0
  if (kmMissing) messages.push('KM vazio ou inválido')

  if (prevDayKm !== null && prevDayKm > 0 && km > 0 && km < prevDayKm)
    messages.push('KM menor que o dia anterior')

  if (entry.valeTransQtd <= 0) messages.push('Vales vazios')

  if (entry.combustivel <= 0) messages.push('Combustível vazio ou zero (leve)')

  if (wd === 0) {
    if (entry.viagensEdson > 0 && entry.viagensBispo > 0)
      messages.push('Domingo: Edson e Bispo preenchidos — conferir')
  } else if (wd >= 1 && wd <= 6) {
    if (entry.viagensEdson > 0 && entry.viagensEdson < 3)
      messages.push('Seg–sáb: menos de 3 viagens (Edson)')
    if (entry.viagensBispo > 0 && entry.viagensBispo < 3)
      messages.push('Seg–sáb: menos de 3 viagens (Bispo)')
  }

  const hasError =
    prevDayKm !== null && prevDayKm > 0 && km > 0 && km < prevDayKm

  if (hasError)
    return {
      level: 'error',
      label: 'Possível erro',
      messages,
    }

  if (messages.length > 0)
    return {
      level: 'warn',
      label: 'Conferir',
      messages,
    }

  return { level: 'ok', label: 'Completo', messages: [] }
}

export function getPrevDayKm(
  entriesByDate: Map<string, DailyEntry>,
  date: string,
): number | null {
  let cursor = prevIsoDate(date)
  for (let i = 0; i < 400; i += 1) {
    const e = entriesByDate.get(cursor)
    if (e && e.km > 0) return e.km
    const next = prevIsoDate(cursor)
    if (next === cursor) break
    cursor = next
  }
  return null
}
