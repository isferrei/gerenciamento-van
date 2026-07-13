import type { DailyEntry } from '../types'
import { defaultSettings } from '../types'
import { normalizeEntryForSave } from './entry-calcs'

function isV2Raw(r: Record<string, unknown>): boolean {
  return typeof r.km === 'number' && typeof r.valeTransQtd === 'number'
}

export function migrateRawToDailyEntry(raw: unknown): DailyEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (isV2Raw(r)) {
    const draft: DailyEntry = {
      id: String(r.id ?? crypto.randomUUID()),
      date: String(r.date ?? ''),
      km: Number(r.km),
      valeTransQtd: Number(r.valeTransQtd),
      valeTransValor: Number(r.valeTransValor),
      combustivel: Number(r.combustivel),
      outrasDespesas: Number(r.outrasDespesas),
      lucroLiquido: Number(r.lucroLiquido),
      viagensEdson: Number(r.viagensEdson),
      viagensBispo: Number(r.viagensBispo),
      salarioEdson: Number(r.salarioEdson),
      salarioBispo: Number(r.salarioBispo),
      salarioTotal: Number(r.salarioTotal),
      domingoMotoristaSePagou: Boolean(r.domingoMotoristaSePagou),
      domingoValorRepasse:
        typeof r.domingoValorRepasse === 'number' && Number.isFinite(r.domingoValorRepasse)
          ? Number(r.domingoValorRepasse)
          : 0,
      domingoMotoristaAtivo:
        r.domingoMotoristaAtivo === 'Edson' || r.domingoMotoristaAtivo === 'Bispo' ?
          r.domingoMotoristaAtivo
        : null,
      observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
      createdAt: String(r.createdAt ?? new Date().toISOString()),
      updatedAt: String(r.updatedAt ?? new Date().toISOString()),
    }
    if (!draft.date) return null
    return normalizeEntryForSave(draft, defaultSettings, draft.createdAt)
  }

  // v1 legacy
  const date = String(r.date ?? '')
  if (!date) return null
  const km = Math.max(0, Number(r.kmAtual ?? 0))
  const moneyVales = Number(r.valeTransCartoes ?? 0)
  const valeTransQtd = Math.max(0, Math.round(moneyVales / defaultSettings.valorValeTrans))
  const totalTrips = Math.max(0, Math.round(Number(r.quantidadeViagens ?? 0)))
  const viagensEdson = Math.ceil(totalTrips / 2)
  const viagensBispo = Math.floor(totalTrips / 2)
  const combustivel = Number(r.valorCombustivel ?? 0)
  const outrasDespesas = Number(r.outrasDespesas ?? 0)

  const draft: DailyEntry = {
    id: String(r.id ?? crypto.randomUUID()),
    date,
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
    domingoMotoristaSePagou: false,
    domingoValorRepasse: 0,
    domingoMotoristaAtivo: null,
    observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return normalizeEntryForSave(draft, defaultSettings, draft.createdAt)
}
