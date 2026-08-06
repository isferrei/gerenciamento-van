import type { AppSettings, DailyEntry } from '../types'
import { monthBounds } from './dates'

export interface MonthlyStats {
  totalValesQtd: number
  valorTotalVales: number
  totalKmPercorrido: number
  totalViagensEdson: number
  totalViagensBispo: number
  totalViagensGeral: number
  diasNoMes: number
  diasTrabalhados: number
  diasSemCartao: string[]
  gastoCombustivel: number
  outrasDespesas: number
  salarioTotalEdson: number
  salarioTotalBispo: number
  salarioTotalMotoristas: number
  lucroLiquidoTotal: number
  kmProximaTrocaOleo: number
  kmRestantesOleo: number
  odometroReferencia: number
}

export function filterEntriesByMonth(entries: DailyEntry[], yearMonth: string): DailyEntry[] {
  const { start, end } = monthBounds(yearMonth)
  return entries.filter((e) => e.date >= start && e.date <= end)
}

export function computeMonthlyStats(
  entriesInMonth: DailyEntry[],
  settings: AppSettings,
  allEntries: DailyEntry[],
  yearMonth?: string,
): MonthlyStats {
  const sortedAll = [...entriesInMonth].sort((a, b) => a.date.localeCompare(b.date))
  const sorted = sortedAll.filter((e) => e.valeTransQtd > 0)
  const kms = sorted.map((e) => e.km).filter((k) => k > 0)
  const monthRef = yearMonth ?? sortedAll[0]?.date.slice(0, 7)
  const diasNoMes = monthRef ? Number(monthBounds(monthRef).end.slice(-2)) : 0
  const datesWithCards = new Set(sorted.map((e) => e.date))
  const diasSemCartao =
    monthRef ?
      Array.from({ length: diasNoMes }, (_, i) => `${monthRef}-${String(i + 1).padStart(2, '0')}`).filter(
        (date) => !datesWithCards.has(date),
      )
    : []

  let totalKmPercorrido = 0
  if (kms.length >= 2) totalKmPercorrido = Math.max(0, kms[kms.length - 1]! - kms[0]!)
  else if (kms.length === 1) totalKmPercorrido = 0

  const odometroReferencia =
    allEntries.length === 0 ? 0 : Math.max(...allEntries.map((e) => e.km))

  const kmProximaTrocaOleo = settings.kmUltimaTrocaOleo + settings.intervaloTrocaOleoKm
  const kmRestantesOleo =
    odometroReferencia > 0 ? Math.max(0, kmProximaTrocaOleo - odometroReferencia) : kmProximaTrocaOleo

  const totalValesQtd = sum(sorted, (e) => e.valeTransQtd)
  const valorTotalVales = sum(sorted, (e) => e.valeTransValor)

  return {
    totalValesQtd,
    valorTotalVales,
    totalKmPercorrido,
    totalViagensEdson: sum(sorted, (e) => e.viagensEdson),
    totalViagensBispo: sum(sorted, (e) => e.viagensBispo),
    totalViagensGeral: sum(sorted, (e) => e.viagensEdson + e.viagensBispo),
    diasNoMes,
    diasTrabalhados: sorted.length,
    diasSemCartao,
    gastoCombustivel: sum(sorted, (e) => e.combustivel),
    outrasDespesas: sum(sorted, (e) => e.outrasDespesas),
    salarioTotalEdson: sum(sorted, (e) => e.salarioEdson),
    salarioTotalBispo: sum(sorted, (e) => e.salarioBispo),
    salarioTotalMotoristas: sum(sorted, (e) => e.salarioTotal),
    lucroLiquidoTotal: sum(sorted, (e) => e.lucroLiquido),
    kmProximaTrocaOleo,
    kmRestantesOleo,
    odometroReferencia,
  }
}

function sum<T>(arr: T[], pick: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + pick(x), 0)
}
