import type { AppSettings, DailyEntry } from '../types'
import { recalcEntry, sundaySuggestedRepasse } from './entry-calcs'
import { defaultTripsForDate } from './prefill-trips'
import { isSundayIso } from './dates'

export function emptyEntry(date: string, settings: AppSettings): DailyEntry {
  const t = defaultTripsForDate(date, settings)
  const now = new Date().toISOString()
  const base: DailyEntry = {
    id: crypto.randomUUID(),
    date,
    km: 0,
    valeTransQtd: 0,
    valeTransValor: 0,
    combustivel: 0,
    outrasDespesas: 0,
    lucroLiquido: 0,
    viagensEdson: t.edson,
    viagensBispo: t.bispo,
    salarioEdson: 0,
    salarioBispo: 0,
    salarioTotal: 0,
    domingoMotoristaSePagou: false,
    domingoValorRepasse: 0,
    domingoMotoristaAtivo: null,
    observacoes: '',
    createdAt: now,
    updatedAt: now,
  }
  let out = recalcEntry(base, settings)
  if (isSundayIso(date)) {
    const sug = sundaySuggestedRepasse(
      date,
      out.viagensEdson,
      out.viagensBispo,
      settings,
      out.domingoMotoristaAtivo,
    )
    out = recalcEntry({ ...out, domingoValorRepasse: sug }, settings)
  }
  return out
}
