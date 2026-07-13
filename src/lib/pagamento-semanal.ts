import type { DailyEntry } from '../types'
import { endOfIsoWeek, monthBounds, startOfIsoWeek } from './dates'
import { filterEntriesByMonth } from './monthly-stats'

export interface SemanaPagamento {
  weekKey: string
  label: string
  startMonday: Date
  viagensEdson: number
  pagarEdson: number
  viagensBispo: number
  pagarBispo: number
  total: number
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function groupPagamentoSemanal(
  entries: DailyEntry[],
  yearMonth: string,
): SemanaPagamento[] {
  const inMonth = filterEntriesByMonth(entries, yearMonth)
  const { start: monthStart, end: monthEnd } = monthBounds(yearMonth)
  const map = new Map<
    string,
    {
      start: Date
      viagensEdson: number
      pagarEdson: number
      viagensBispo: number
      pagarBispo: number
    }
  >()

  for (const e of inMonth) {
    const d = new Date(e.date + 'T12:00:00')
    const mon = startOfIsoWeek(d)
    const key = mon.toISOString().slice(0, 10)
    if (!map.has(key))
      map.set(key, {
        start: mon,
        viagensEdson: 0,
        pagarEdson: 0,
        viagensBispo: 0,
        pagarBispo: 0,
      })
    const bucket = map.get(key)!
    bucket.viagensEdson += e.viagensEdson
    bucket.pagarEdson += e.salarioEdson
    bucket.viagensBispo += e.viagensBispo
    bucket.pagarBispo += e.salarioBispo
  }

  const slices: SemanaPagamento[] = []
  for (const [, v] of map) {
    const end = endOfIsoWeek(v.start)
    const ms = new Date(monthStart + 'T12:00:00')
    const me = new Date(monthEnd + 'T12:00:00')
    const label = `${formatShort(v.start)} – ${formatShort(end)}`
    if (v.start <= me && end >= ms) {
      const total = Math.round((v.pagarEdson + v.pagarBispo) * 100) / 100
      slices.push({
        weekKey: v.start.toISOString().slice(0, 10),
        label,
        startMonday: v.start,
        viagensEdson: v.viagensEdson,
        pagarEdson: Math.round(v.pagarEdson * 100) / 100,
        viagensBispo: v.viagensBispo,
        pagarBispo: Math.round(v.pagarBispo * 100) / 100,
        total,
      })
    }
  }
  slices.sort((a, b) => a.startMonday.getTime() - b.startMonday.getTime())
  return slices
}
