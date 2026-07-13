import type { DailyEntry } from '../types'
import { normalizeEntryForSave } from './entry-calcs'
import { loadEntries, loadSettings, saveEntries } from './storage'
import { entriesToCsv, parseEntriesFromCsv } from './csv'

export function downloadEntriesCsv(): void {
  const blob = new Blob([entriesToCsv(loadEntries())], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `gerenciamento-van-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function mergeImportedEntries(incoming: DailyEntry[]): { merged: DailyEntry[]; replaced: number } {
  const existing = loadEntries()
  const byDate = new Map<string, DailyEntry>()
  for (const e of existing) byDate.set(e.date, e)

  let replaced = 0
  for (const inc of incoming) {
    const prev = byDate.get(inc.date)
    if (prev) replaced++
    const settings = loadSettings()
    const normalized = normalizeEntryForSave(inc, settings, prev?.createdAt ?? inc.createdAt)
    byDate.set(inc.date, {
      ...normalized,
      id: prev?.id ?? normalized.id,
    })
  }
  const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  saveEntries(merged)
  return { merged, replaced }
}

export function importEntriesFromCsvText(text: string): { ok: boolean; message: string } {
  const { entries, errors } = parseEntriesFromCsv(text)
  if (errors.length && entries.length === 0) return { ok: false, message: errors.join(' ') }
  const { merged, replaced } = mergeImportedEntries(entries)
  const parts = [
    `Importados ${entries.length} linhas.`,
    replaced ? `${replaced} datas já existiam e foram atualizadas.` : '',
    errors.length ? `Avisos: ${errors.join(' ')}` : '',
    `Total armazenado: ${merged.length} lançamentos.`,
  ].filter(Boolean)
  return { ok: true, message: parts.join(' ') }
}
