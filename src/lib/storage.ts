import type { AppSettings, DailyEntry } from '../types'
import { defaultSettings } from '../types'
import { deleteEntry, fetchEntries, fetchSettings, importEntries, saveEntry, saveSettingsApi } from './api'
import { migrateRawToDailyEntry } from './migrate-entry'

const ENTRIES_KEY_V2 = 'gerenciamento-van:entries:v2'
const ENTRIES_KEY_V1 = 'gerenciamento-van:entries:v1'
const SETTINGS_KEY = 'gerenciamento-van:settings:v1'

let migrationRan = false

function runMigrationOnce(): void {
  if (migrationRan) return
  migrationRan = true
  const v2 = localStorage.getItem(ENTRIES_KEY_V2)
  if (v2 && v2 !== '[]') return
  const v1 = localStorage.getItem(ENTRIES_KEY_V1)
  if (!v1) return
  try {
    const arr = JSON.parse(v1) as unknown[]
    if (!Array.isArray(arr)) return
    const migrated: DailyEntry[] = []
    for (const item of arr) {
      const e = migrateRawToDailyEntry(item)
      if (e) migrated.push(e)
    }
    localStorage.setItem(ENTRIES_KEY_V2, JSON.stringify(migrated))
  } catch {
    /* ignore */
  }
}

function parseEntries(raw: string | null): DailyEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: DailyEntry[] = []
    for (const item of data) {
      const e = migrateRawToDailyEntry(item)
      if (e) out.push(e)
    }
    return out
  } catch {
    return []
  }
}

function saveEntriesLocal(entries: DailyEntry[]): void {
  localStorage.setItem(ENTRIES_KEY_V2, JSON.stringify(entries))
}

function saveSettingsLocal(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function reportApiSyncError(error: unknown): void {
  console.warn('Falha ao sincronizar com a API', error)
}

export function loadEntries(): DailyEntry[] {
  runMigrationOnce()
  return parseEntries(localStorage.getItem(ENTRIES_KEY_V2))
}

export function saveEntries(entries: DailyEntry[]): void {
  saveEntriesLocal(entries)
  void importEntries(entries).catch(reportApiSyncError)
}

export function upsertEntry(entry: DailyEntry): DailyEntry[] {
  const list = loadEntries().filter((e) => e.id !== entry.id && e.date !== entry.date)
  list.push(entry)
  list.sort((a, b) => a.date.localeCompare(b.date))
  saveEntriesLocal(list)
  void saveEntry(entry).catch(reportApiSyncError)
  return list
}

export function deleteEntryById(id: string): DailyEntry[] {
  const list = loadEntries().filter((e) => e.id !== id)
  saveEntriesLocal(list)
  void deleteEntry(id).catch(reportApiSyncError)
  return list
}

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return { ...defaultSettings }
  try {
    const p = JSON.parse(raw) as Partial<AppSettings>
    const motorista =
      p.motoristaDomingoPadrao === 'Edson' || p.motoristaDomingoPadrao === 'Bispo'
        ? p.motoristaDomingoPadrao
        : defaultSettings.motoristaDomingoPadrao
    return {
      ...defaultSettings,
      ...p,
      valorRiocardPorCartao: Number(
        p.valorRiocardPorCartao ?? defaultSettings.valorRiocardPorCartao,
      ),
      valorValeTrans: Number(p.valorValeTrans ?? defaultSettings.valorValeTrans),
      valorViagemEdson: Number(p.valorViagemEdson ?? defaultSettings.valorViagemEdson),
      valorViagemBispo: Number(p.valorViagemBispo ?? defaultSettings.valorViagemBispo),
      viagensPadraoEdson: Math.max(0, Math.round(Number(p.viagensPadraoEdson ?? defaultSettings.viagensPadraoEdson))),
      viagensPadraoBispo: Math.max(0, Math.round(Number(p.viagensPadraoBispo ?? defaultSettings.viagensPadraoBispo))),
      viagensDomingoPadrao: Math.max(0, Math.round(Number(p.viagensDomingoPadrao ?? defaultSettings.viagensDomingoPadrao))),
      motoristaDomingoPadrao: motorista,
      kmUltimaTrocaOleo: Number(p.kmUltimaTrocaOleo ?? defaultSettings.kmUltimaTrocaOleo),
      intervaloTrocaOleoKm: Number(p.intervaloTrocaOleoKm ?? defaultSettings.intervaloTrocaOleoKm),
      despesaAptran: Number(p.despesaAptran ?? defaultSettings.despesaAptran),
      despesaMorro: Number(p.despesaMorro ?? defaultSettings.despesaMorro),
      despesaFiscal: Number(p.despesaFiscal ?? defaultSettings.despesaFiscal),
      despesaMensalParcelaCarro: Number(
        p.despesaMensalParcelaCarro ?? defaultSettings.despesaMensalParcelaCarro,
      ),
      despesaMensalAluguelLinha: Number(
        p.despesaMensalAluguelLinha ?? defaultSettings.despesaMensalAluguelLinha,
      ),
    }
  } catch {
    return { ...defaultSettings }
  }
}

/** Migra chaves antigas de settings (valorBilhete etc.) para novos campos quando possível */
export function saveSettings(s: AppSettings): void {
  saveSettingsLocal(s)
  void saveSettingsApi(s).catch(reportApiSyncError)
}

export function clearAllAppData(): void {
  localStorage.removeItem(ENTRIES_KEY_V2)
  localStorage.removeItem(ENTRIES_KEY_V1)
  localStorage.removeItem(SETTINGS_KEY)
}

export async function syncLocalStorageFromApi(): Promise<void> {
  const [entries, settings] = await Promise.all([fetchEntries(), fetchSettings()])
  saveEntriesLocal(entries)
  saveSettingsLocal(settings)
}
