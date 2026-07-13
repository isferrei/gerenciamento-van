export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatKm(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`
}

/**
 * Número digitado pelo usuário (BR): aceita "R$ 500,15", "500,15", "1.234,56",
 * "10.5", milhares com ponto, etc. Remove símbolos de moeda e espaços.
 */
export function parseDecimal(raw: string): number {
  let s = String(raw).trim()
  if (!s) return 0

  s = s.replace(/[^\d,.-]/g, '').replace(/\s/g, '')
  if (!s || s === '-') return 0

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      const intPart = s.slice(0, lastComma).replace(/\./g, '')
      const decPart = s.slice(lastComma + 1)
      const n = Number(`${intPart}.${decPart}`)
      return Number.isFinite(n) ? n : 0
    }
    const intPart = s.slice(0, lastDot).replace(/,/g, '')
    const decPart = s.slice(lastDot + 1)
    const n = Number(`${intPart}.${decPart}`)
    return Number.isFinite(n) ? n : 0
  }

  if (lastComma >= 0) {
    const parts = s.split(',')
    if (
      parts.length === 2 &&
      parts[1].length <= 2 &&
      /^\d+$/.test(parts[0].replace(/\./g, '')) &&
      /^\d+$/.test(parts[1])
    ) {
      const intPart = parts[0].replace(/\./g, '')
      const n = Number(`${intPart}.${parts[1]}`)
      return Number.isFinite(n) ? n : 0
    }
    const n = Number(s.replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  if (lastDot >= 0) {
    const parts = s.split('.')
    if (
      parts.length === 2 &&
      parts[1].length <= 2 &&
      /^\d+$/.test(parts[0]) &&
      /^\d+$/.test(parts[1])
    ) {
      const n = Number(s)
      return Number.isFinite(n) ? n : 0
    }
    if (
      parts.length >= 2 &&
      parts.every((p) => /^\d+$/.test(p)) &&
      parts.slice(1).every((p) => p.length === 3)
    )
      return Number(parts.join('')) || 0
    const n = Number(s.replace(/\./g, ''))
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * KM no painel: sem arredondamento forçado.
 * - Milhares com ponto (BR): 142.201 → 142201
 * - Milhares com vírgula: 142,201 → 142201
 * - Decimal com vírgula: 142,5 → 142.5
 */
export function parseKmInput(raw: string): number {
  const s = String(raw).replace(/\s/g, '').trim()
  if (!s) return 0

  if (s.includes(',')) {
    const partsComma = s.split(',')
    const allDigitGroups =
      partsComma.length >= 2 &&
      partsComma.every((p) => /^\d+$/.test(p)) &&
      partsComma.slice(1).every((p) => p.length === 3)
    if (allDigitGroups) return Number(partsComma.join('')) || 0
    const withoutDots = s.replace(/\./g, '')
    const n = Number(withoutDots.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  if (s.includes('.')) {
    const parts = s.split('.')
    const thousands =
      parts.length >= 2 &&
      parts.every((p) => /^\d+$/.test(p)) &&
      parts.slice(1).every((p) => p.length === 3)
    if (thousands) return Number(parts.join('')) || 0
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * Exibe KM sem arredondar.
 * Inteiros: milhares com vírgula (ex.: 142201 → "142,201").
 * Com decimais: milhares com ponto e decimal com vírgula (ex.: 142201.5 → "142.201,5").
 */
export function formatKmForInput(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  const str = String(n)
  if (!str.includes('.')) return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const [intPart, frac] = str.split('.')
  const head = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return frac !== undefined && frac.length > 0 ? `${head},${frac}` : head
}
