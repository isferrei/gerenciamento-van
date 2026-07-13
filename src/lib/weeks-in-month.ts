import { endOfIsoWeek, monthBounds, startOfIsoWeek } from './dates'

export interface MonthWeekSlice {
  /** 1-based index within the month (first intersecting week = 1) */
  index: number
  monday: Date
  /** Seven ISO dates Mon–Sun (YYYY-MM-DD) */
  dates: string[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoDateFromLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${pad2(m)}-${pad2(day)}`
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + delta)
  return x
}

/** ISO weeks (Mon–Sun) that intersect the given calendar month */
export function getMonthIsoWeeks(yearMonth: string): MonthWeekSlice[] {
  const { start: monthStartStr, end: monthEndStr } = monthBounds(yearMonth)
  const monthStart = new Date(monthStartStr + 'T12:00:00')

  const out: MonthWeekSlice[] = []
  let monday = startOfIsoWeek(monthStart)
  const endStr = monthEndStr
  let guard = 0
  while (guard++ < 10) {
    const sunday = endOfIsoWeek(monday)
    const intersects = isoDateFromLocalDate(monday) <= endStr && isoDateFromLocalDate(sunday) >= monthStartStr
    if (intersects) {
      const dates: string[] = []
      for (let i = 0; i < 7; i += 1) dates.push(isoDateFromLocalDate(addDays(monday, i)))
      out.push({ index: out.length + 1, monday: new Date(monday), dates })
    }
    const nextMonday = addDays(monday, 7)
    if (isoDateFromLocalDate(nextMonday) > endStr) break
    monday = nextMonday
  }
  return out
}

export function formatWeekPeriodLabel(monday: Date, sunday: Date): string {
  const a = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const b = sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${a} a ${b}`
}

/** Ex.: 01-05-a-07-05 (DD-MM) for filenames */
export function formatWeekRangeForFilename(monday: Date, sunday: Date): string {
  const d1 = `${pad2(monday.getDate())}-${pad2(monday.getMonth() + 1)}`
  const d2 = `${pad2(sunday.getDate())}-${pad2(sunday.getMonth() + 1)}`
  return `${d1}-a-${d2}`
}
