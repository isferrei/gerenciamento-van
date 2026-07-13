import type { AppSettings, MotoristaDomingo } from '../types'

/** Domingo: só um motorista; soma as viagens no ativo e zera o outro. Usa `motoristaDomingoOverride` ou `motoristaDomingoPadrao` nas configurações. */
export function enforceSundaySingleDriver(
  dateIso: string,
  edson: number,
  bispo: number,
  s: AppSettings,
  motoristaDomingoOverride?: MotoristaDomingo | null,
): { edson: number; bispo: number } {
  const wd = new Date(dateIso + 'T12:00:00').getDay()
  if (wd !== 0) return { edson, bispo }
  const e = Math.max(0, Math.round(Number(edson)))
  const b = Math.max(0, Math.round(Number(bispo)))
  const total = e + b
  const active = motoristaDomingoOverride ?? s.motoristaDomingoPadrao
  if (active === 'Bispo') return { edson: 0, bispo: total }
  return { edson: total, bispo: 0 }
}

export function defaultTripsForDate(dateIso: string, s: AppSettings): { edson: number; bispo: number } {
  const d = new Date(dateIso + 'T12:00:00')
  const day = d.getDay()
  if (day === 0) {
    if (s.motoristaDomingoPadrao === 'Bispo')
      return { edson: 0, bispo: s.viagensDomingoPadrao }
    return { edson: s.viagensDomingoPadrao, bispo: 0 }
  }
  return { edson: s.viagensPadraoEdson, bispo: s.viagensPadraoBispo }
}
