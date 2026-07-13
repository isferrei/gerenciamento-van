/** Normaliza data vinda do OCR para YYYY-MM-DD quando possível */
export function coerceIsoDate(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    let d = Number(m[1])
    let mo = Number(m[2])
    let y = Number(m[3])
    if (y < 100) y += y >= 70 ? 1900 : 2000
    if (mo > 12 && d <= 12) {
      const t = d
      d = mo
      mo = t
    }
    if (y >= 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}
