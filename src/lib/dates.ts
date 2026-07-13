/** Início do dia local */
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Segunda-feira da semana ISO (Brasil costuma alinhar relatório por semana corrida) */
export function startOfIsoWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function endOfIsoWeek(startMonday: Date): Date {
  const x = new Date(startMonday)
  x.setDate(x.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Domingo no calendário local (YYYY-MM-DD). */
export function isSundayIso(iso: string): boolean {
  return new Date(iso + 'T12:00:00').getDay() === 0
}

export function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
}

/** Dia de calendário anterior (YYYY-MM-DD) */
export function previousIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${yearMonth}-${String(last).padStart(2, '0')}`
  return { start, end }
}

export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Ex.: "2026-04" → "Abril" */
export function formatMonthNamePt(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  if (!y || !m) return yearMonth
  const name = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : yearMonth
}

/** Ex.: "segunda-feira" → capitalizado */
export function weekdayLongPt(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d)
  const w = dt.toLocaleDateString('pt-BR', { weekday: 'long' })
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : ''
}
