import type { DailyEntry } from '../types'
import type { ExtractedData } from './extract-entry-client'

const KEY = 'gerenciamento-van:weekly-launch-draft:v1'

export type WeeklyLaunchUiState =
  | 'semana_vazia'
  | 'imagens_carregadas'
  | 'ia_lendo'
  | 'dados_extraidos'
  | 'pendencias'
  | 'semana_salva'

export interface DayDraftSlice {
  entry: DailyEntry
  lowConfidence: Partial<Record<keyof ExtractedData, boolean>>
  reviewed: boolean
  touched: boolean
}

export interface WeeklyLaunchDraft {
  version: 1
  mondayIso: string
  monthYm: string
  weekIndex: number
  uiState: WeeklyLaunchUiState
  days: Record<string, DayDraftSlice>
  /** Contagem da última seleção (arquivos não persistem) */
  lastImageCount: number
  savedAt?: string
}

export function loadWeeklyDraft(): WeeklyLaunchDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as WeeklyLaunchDraft
    if (p?.version !== 1 || !p.mondayIso || !p.days) return null
    return p
  } catch {
    return null
  }
}

export function saveWeeklyDraft(draft: WeeklyLaunchDraft): void {
  localStorage.setItem(KEY, JSON.stringify(draft))
}

export function clearWeeklyDraft(): void {
  localStorage.removeItem(KEY)
}
