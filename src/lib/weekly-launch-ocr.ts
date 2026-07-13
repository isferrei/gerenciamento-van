import type { DailyEntry } from '../types'
import type { AppSettings } from '../types'
import type { ExtractedData } from './extract-entry-client'
import { isLowConfidence } from './extract-entry-client'
import { recalcEntry } from './entry-calcs'
import { parseKmInput } from './format'

export function highlightFromExtract(
  data: ExtractedData,
  confidence: Partial<Record<keyof ExtractedData, number>>,
): Partial<Record<keyof ExtractedData, boolean>> {
  const h: Partial<Record<keyof ExtractedData, boolean>> = {}
  if (data.date != null && String(data.date).trim() !== '' && isLowConfidence(confidence.date))
    h.date = true
  if (data.km != null && !Number.isNaN(Number(data.km)) && isLowConfidence(confidence.km))
    h.km = true
  if (
    data.valeTransQtd != null &&
    !Number.isNaN(Number(data.valeTransQtd)) &&
    isLowConfidence(confidence.valeTransQtd)
  )
    h.valeTransQtd = true
  if (
    data.combustivel != null &&
    !Number.isNaN(Number(data.combustivel)) &&
    isLowConfidence(confidence.combustivel)
  )
    h.combustivel = true
  if (
    data.viagensEdson != null &&
    !Number.isNaN(Number(data.viagensEdson)) &&
    isLowConfidence(confidence.viagensEdson)
  )
    h.viagensEdson = true
  if (
    data.viagensBispo != null &&
    !Number.isNaN(Number(data.viagensBispo)) &&
    isLowConfidence(confidence.viagensBispo)
  )
    h.viagensBispo = true
  if (
    data.outrasDespesas != null &&
    !Number.isNaN(Number(data.outrasDespesas)) &&
    isLowConfidence(confidence.outrasDespesas)
  )
    h.outrasDespesas = true
  if (data.observacoes != null && isLowConfidence(confidence.observacoes)) h.observacoes = true
  return h
}

export function mergeExtractIntoEntry(
  base: DailyEntry,
  data: ExtractedData,
  settings: AppSettings,
): DailyEntry {
  let next: DailyEntry = { ...base }

  if (data.km != null && !Number.isNaN(Number(data.km)))
    next.km = Math.max(0, parseKmInput(String(data.km)))

  if (data.valeTransQtd != null && !Number.isNaN(Number(data.valeTransQtd)))
    next.valeTransQtd = Math.max(0, Math.round(Number(data.valeTransQtd)))

  if (data.combustivel != null && !Number.isNaN(Number(data.combustivel)))
    next.combustivel = Math.max(0, Number(data.combustivel))

  if (data.outrasDespesas != null && !Number.isNaN(Number(data.outrasDespesas)))
    next.outrasDespesas = Math.max(0, Number(data.outrasDespesas))

  if (data.viagensEdson != null && !Number.isNaN(Number(data.viagensEdson)))
    next.viagensEdson = Math.max(0, Math.round(Number(data.viagensEdson)))

  if (data.viagensBispo != null && !Number.isNaN(Number(data.viagensBispo)))
    next.viagensBispo = Math.max(0, Math.round(Number(data.viagensBispo)))

  if (data.observacoes != null) next.observacoes = String(data.observacoes)

  return recalcEntry(next, settings)
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Leitura do arquivo falhou'))
    r.readAsDataURL(file)
  })
}
