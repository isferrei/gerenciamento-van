import type { DailyEntry, MotoristaDomingo } from '../types'
import { isSundayIso } from './dates'

/** Cabeçalhos esperados (ordem do exemplo; aceitamos qualquer ordem nas colunas). */
export const CORRIDA_CSV_HEADER_KEYS = [
  'data',
  'dia',
  'turno',
  'motorista',
  'cartoes',
  'km',
  'corridas',
  'desconto_motorista',
  'salario_motorista',
  'lucro_bruto',
  'despesa',
  'combustivel',
] as const

export type CorridaCsvHeaderKey = (typeof CORRIDA_CSV_HEADER_KEYS)[number]

export interface CorridaCsvParsedTurn {
  lineNumber: number
  dataIso: string
  dia: string | null
  turno: string
  motoristaNorm: 'Edson' | 'Bispo'
  cartoes: number | null
  km: number | null
  corridas: number | null
  desconto_motorista: number | null
  salario_motorista: number | null
  lucro_bruto: number | null
  despesa: number | null
  combustivel: number | null
}

export interface CorridaCsvPreviewRow {
  lineNumber: number
  dataIso: string
  dia: string
  turno: string
  motorista: string
  cartoes: string
  km: string
  corridas: string
  desconto_motorista: string
  salario_motorista: string
  lucro_bruto: string
  despesa: string
  combustivel: string
}

export interface ParseCorridaCsvResult {
  turns: CorridaCsvParsedTurn[]
  errors: string[]
  previewRows: CorridaCsvPreviewRow[]
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, '')
}

/** Divide linha CSV com separador `;` respeitando aspas. */
export function parseSemicolonLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ';') {
      result.push(cur)
      cur = ''
    } else cur += c
  }
  result.push(cur)
  return result
}

function normalizeSpaces(s: string) {
  return s.trim().replace(/\s+/g, ' ')
}

function normalizeMotorista(raw: string): 'Edson' | 'Bispo' | null {
  const t = normalizeSpaces(raw).toLowerCase()
  if (t === 'edson') return 'Edson'
  if (t === 'bispo') return 'Bispo'
  return null
}

/** Remove R$, espaços; trata vírgula decimal / milhar BR simples. */
function parseMoney(raw: string): number | null {
  let s = normalizeSpaces(raw)
  if (!s) return null
  s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',') && /\.\d{3}/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

function parseInteger(raw: string): number | null {
  const s = normalizeSpaces(raw)
  if (!s) return null
  const n = Math.round(Number(s.replace(/\./g, '').replace(',', '.')))
  return Number.isFinite(n) ? n : null
}

/** KM pode ser grande (142201) — inteiro. */
function parseKm(raw: string): number | null {
  const s = normalizeSpaces(raw)
  if (!s) return null
  const digits = s.replace(/\./g, '').replace(',', '')
  const n = Number(digits)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.round(n))
}

function parseDataCell(raw: string, anoRef: number): string | null {
  const s = normalizeSpaces(raw)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
  if (m) {
    let d = Number(m[1])
    let mo = Number(m[2])
    let year = anoRef
    if (m[3]) {
      const y = Number(m[3])
      year = m[3].length === 2 ? 2000 + y : y
    }
    const dt = new Date(year, mo - 1, d)
    if (dt.getFullYear() !== year || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
    return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

function headerMap(headerCells: string[]): Record<string, number> | null {
  const map: Record<string, number> = {}
  headerCells.forEach((h, i) => {
    const key = stripBom(h).trim().toLowerCase()
    map[key] = i
  })
  for (const k of CORRIDA_CSV_HEADER_KEYS) {
    if (map[k] === undefined) return null
  }
  return map
}

function getCell(cells: string[], idxMap: Record<string, number>, key: CorridaCsvHeaderKey): string {
  const i = idxMap[key]
  return i === undefined ? '' : cells[i] ?? ''
}

/** Detecta CSV de corridas pela primeira linha (após trim). */
export function looksLikeCorridaCsvHeader(firstLine: string): boolean {
  const cells = parseSemicolonLine(stripBom(firstLine)).map((c) => c.trim().toLowerCase())
  return cells.includes('turno') && cells.includes('motorista') && cells.includes('data')
}

/**
 * Parseia texto UTF-8 com separador `;`.
 * Valida linha a linha; erros não impedem parse das demais para listagem.
 */
export function parseCorridaCsv(text: string): ParseCorridaCsvResult {
  const errors: string[] = []
  const turns: CorridaCsvParsedTurn[] = []
  const previewRows: CorridaCsvPreviewRow[] = []

  const lines = stripBom(text).split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    errors.push('Arquivo vazio ou só com cabeçalho.')
    return { turns: [], errors, previewRows: [] }
  }

  const headerCells = parseSemicolonLine(lines[0]).map((c) => c.trim())
  const idx = headerMap(headerCells.map((h) => h.toLowerCase()))
  if (!idx) {
    errors.push(
      `Cabeçalho inválido. Colunas obrigatórias: ${CORRIDA_CSV_HEADER_KEYS.join('; ')}`,
    )
    return { turns: [], errors, previewRows: [] }
  }

  const anoRef = new Date().getFullYear()

  for (let li = 1; li < lines.length; li++) {
    const lineNumber = li + 1
    const errsStart = errors.length
    const cells = parseSemicolonLine(lines[li])
    const pad = (key: CorridaCsvHeaderKey) => normalizeSpaces(getCell(cells, idx, key))

    const rawData = pad('data')
    const rawTurno = pad('turno')
    const rawMotorista = pad('motorista')

    const dataIso = parseDataCell(rawData, anoRef)
    if (!rawData) errors.push(`Linha ${lineNumber}: campo "data" é obrigatório.`)
    else if (!dataIso) errors.push(`Linha ${lineNumber}: data inválida "${rawData}". Use YYYY-MM-DD ou DD/MM.`)

    if (!rawTurno) errors.push(`Linha ${lineNumber}: campo "turno" é obrigatório.`)

    const motoristaNorm = rawMotorista ? normalizeMotorista(rawMotorista) : null
    if (!rawMotorista) errors.push(`Linha ${lineNumber}: campo "motorista" é obrigatório.`)
    else if (!motoristaNorm)
      errors.push(`Linha ${lineNumber}: motorista "${rawMotorista}" deve ser Edson ou Bispo.`)

    const cartoes = parseInteger(getCell(cells, idx, 'cartoes'))
    if (getCell(cells, idx, 'cartoes').trim() && cartoes === null)
      errors.push(`Linha ${lineNumber}: "cartoes" não é um número válido.`)

    const km = parseKm(getCell(cells, idx, 'km'))
    if (getCell(cells, idx, 'km').trim() && km === null)
      errors.push(`Linha ${lineNumber}: "km" não é um número válido.`)

    const corridas = parseInteger(getCell(cells, idx, 'corridas'))
    if (getCell(cells, idx, 'corridas').trim() && corridas === null)
      errors.push(`Linha ${lineNumber}: "corridas" não é um número válido.`)

    let desconto_motorista: number | null = null
    if (getCell(cells, idx, 'desconto_motorista').trim()) {
      desconto_motorista = parseMoney(getCell(cells, idx, 'desconto_motorista'))
      if (desconto_motorista === null)
        errors.push(`Linha ${lineNumber}: "desconto_motorista" não é um valor monetário válido.`)
    }

    let salario_motorista: number | null = null
    if (getCell(cells, idx, 'salario_motorista').trim()) {
      salario_motorista = parseMoney(getCell(cells, idx, 'salario_motorista'))
      if (salario_motorista === null)
        errors.push(`Linha ${lineNumber}: "salario_motorista" não é um valor monetário válido.`)
    }

    let lucro_bruto: number | null = null
    if (getCell(cells, idx, 'lucro_bruto').trim()) {
      lucro_bruto = parseMoney(getCell(cells, idx, 'lucro_bruto'))
      if (lucro_bruto === null)
        errors.push(`Linha ${lineNumber}: "lucro_bruto" não é um valor monetário válido.`)
    }

    let despesa: number | null = null
    if (getCell(cells, idx, 'despesa').trim()) {
      despesa = parseMoney(getCell(cells, idx, 'despesa'))
      if (despesa === null) errors.push(`Linha ${lineNumber}: "despesa" não é um valor monetário válido.`)
    }

    let combustivel: number | null = null
    if (getCell(cells, idx, 'combustivel').trim()) {
      combustivel = parseMoney(getCell(cells, idx, 'combustivel'))
      if (combustivel === null)
        errors.push(`Linha ${lineNumber}: "combustivel" não é um valor monetário válido.`)
    }

    previewRows.push({
      lineNumber,
      dataIso: dataIso ?? '—',
      dia: pad('dia') || '—',
      turno: rawTurno || '—',
      motorista: rawMotorista || '—',
      cartoes: cartoes !== null ? String(cartoes) : '—',
      km: km !== null ? String(km) : '—',
      corridas: corridas !== null ? String(corridas) : '—',
      desconto_motorista:
        desconto_motorista !== null ? String(desconto_motorista) : '—',
      salario_motorista:
        salario_motorista !== null ? String(salario_motorista) : '—',
      lucro_bruto: lucro_bruto !== null ? String(lucro_bruto) : '—',
      despesa: despesa !== null ? String(despesa) : '—',
      combustivel: combustivel !== null ? String(combustivel) : '—',
    })

    const lineOk =
      errors.length === errsStart && Boolean(dataIso && rawTurno && motoristaNorm)

    if (lineOk && dataIso && motoristaNorm) {
      turns.push({
        lineNumber,
        dataIso,
        dia: pad('dia') || null,
        turno: rawTurno,
        motoristaNorm,
        cartoes,
        km,
        corridas,
        desconto_motorista,
        salario_motorista,
        lucro_bruto,
        despesa,
        combustivel,
      })
    }
  }

  return { turns, errors, previewRows }
}

function motoristaDominanteCorridaCsv(group: CorridaCsvParsedTurn[]): MotoristaDomingo | null {
  let ed = 0
  let bi = 0
  let firstComTurno: MotoristaDomingo | null = null
  for (const r of group) {
    const c = Math.max(0, r.corridas ?? 0)
    if (r.motoristaNorm === 'Edson') ed += c
    else bi += c
    if (firstComTurno === null && c > 0) firstComTurno = r.motoristaNorm
  }
  if (ed > bi) return 'Edson'
  if (bi > ed) return 'Bispo'
  if (ed === 0 && bi === 0) return null
  return firstComTurno
}

/** Agrupa turnos pela data em um único lançamento diário (modelo do app). */
export function aggregateCorridaTurnsToDailyEntries(turns: CorridaCsvParsedTurn[]): DailyEntry[] {
  const byDate = new Map<string, CorridaCsvParsedTurn[]>()
  for (const t of turns) {
    const list = byDate.get(t.dataIso) ?? []
    list.push(t)
    byDate.set(t.dataIso, list)
  }

  const now = new Date().toISOString()
  const out: DailyEntry[] = []

  for (const [date, group] of byDate) {
    let viagensEdson = 0
    let viagensBispo = 0
    let kmMax = 0
    let cartoesMax = 0
    let combustivelSum = 0
    let despesaSum = 0
    let descontoSum = 0
    const turnBits: string[] = []

    for (const r of group) {
      const c = Math.max(0, r.corridas ?? 0)
      if (r.motoristaNorm === 'Edson') viagensEdson += c
      else viagensBispo += c

      if (r.km != null) kmMax = Math.max(kmMax, r.km)
      if (r.cartoes != null) cartoesMax = Math.max(cartoesMax, r.cartoes)
      if (r.combustivel != null) combustivelSum += r.combustivel
      if (r.despesa != null) despesaSum += r.despesa
      if (r.desconto_motorista != null) descontoSum += r.desconto_motorista

      const diaBit = r.dia ? `${r.dia} ` : ''
      turnBits.push(`${diaBit}${r.turno} ${r.motoristaNorm} (${c} corr.)`)
    }

    const observExtra = group.some((t) => t.lucro_bruto != null || t.salario_motorista != null)
      ? ` | CSV: lucro_bruto/salário motorista conferir no arquivo`
      : ''

    const observacoes = `Importação CSV turnos: ${turnBits.join('; ')}${observExtra}`.slice(0, 2000)

    const domingoMotoristaAtivo =
      isSundayIso(date) ? motoristaDominanteCorridaCsv(group) : null

    out.push({
      id: crypto.randomUUID(),
      date,
      km: kmMax,
      valeTransQtd: Math.max(0, Math.round(cartoesMax)),
      valeTransValor: 0,
      combustivel: Math.round(combustivelSum * 100) / 100,
      outrasDespesas: Math.round((despesaSum + descontoSum) * 100) / 100,
      lucroLiquido: 0,
      viagensEdson,
      viagensBispo,
      salarioEdson: 0,
      salarioBispo: 0,
      salarioTotal: 0,
      domingoMotoristaSePagou: false,
      domingoValorRepasse: 0,
      domingoMotoristaAtivo,
      observacoes,
      createdAt: now,
      updatedAt: now,
    })
  }

  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}
