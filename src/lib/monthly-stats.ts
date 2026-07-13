import type { AppSettings, DailyEntry } from '../types'
import { monthBounds } from './dates'

export interface MonthlyStats {
  totalValesQtd: number
  valorTotalVales: number
  totalKmPercorrido: number
  totalViagensEdson: number
  totalViagensBispo: number
  totalViagensGeral: number
  diasTrabalhados: number
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
): MonthlyStats {
  const sorted = [...entriesInMonth].sort((a, b) => a.date.localeCompare(b.date))
  const kms = sorted.map((e) => e.km).filter((k) => k > 0)

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
    diasTrabalhados: sorted.length,
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
