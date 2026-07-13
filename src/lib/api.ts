import type { AppSettings, DailyEntry } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data?.error ?? `Erro na API: ${response.status}`
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function fetchEntries(): Promise<DailyEntry[]> {
  return request<DailyEntry[]>('/entries')
}

export function fetchEntry(id: string): Promise<DailyEntry> {
  return request<DailyEntry>(`/entries/${id}`)
}

export function saveEntry(entry: DailyEntry): Promise<DailyEntry> {
  return request<DailyEntry>('/entries', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

export function updateEntry(id: string, entry: DailyEntry): Promise<DailyEntry> {
  return request<DailyEntry>(`/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(entry),
  })
}

export function importEntries(entries: DailyEntry[]): Promise<{ imported: number; total: number }> {
  return request<{ imported: number; total: number }>('/entries/import', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  })
}

export function deleteEntry(id: string): Promise<void> {
  return request<void>(`/entries/${id}`, {
    method: 'DELETE',
  })
}

export function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>('/settings')
}

export function saveSettingsApi(settings: AppSettings): Promise<AppSettings> {
  return request<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
