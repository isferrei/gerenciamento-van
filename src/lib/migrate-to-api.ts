import { importEntries, saveSettingsApi } from './api'
import { loadEntries, loadSettings } from './storage'

export async function migrateLocalStorageToApi(): Promise<{
  entriesCount: number
  totalEntriesInApi: number
}> {
  const entries = loadEntries()
  const settings = loadSettings()

  const result = await importEntries(entries)
  await saveSettingsApi(settings)

  return {
    entriesCount: result.imported,
    totalEntriesInApi: result.total,
  }
}
