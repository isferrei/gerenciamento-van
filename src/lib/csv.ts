import type { DailyEntry } from '../types'
import { defaultSettings } from '../types'

const HEADERS = [
  'id',
  'date',
  'km',
  'vale_trans_qtd',
  'vale_trans_valor',
  'combustivel',
  'outras_despesas',
  'lucro_liquido',
  'viagens_edson',
  'viagens_bispo',
  'salario_edson',
  'salario_bispo',
  'salario_total',
  'observacoes',
  'created_at',
  'updated_at',
  'domingo_motorista_se_pagou',
  'domingo_valor_repasse',
  'domingo_motorista_ativo',
] as const

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function entriesToCsv(rows: DailyEntry[]): string {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    const cells = [
      r.id,
      r.date,
      String(r.km),
      String(r.valeTransQtd),
      String(r.valeTransValor),
      String(r.combustivel),
      String(r.outrasDespesas),
      String(r.lucroLiquido),
      String(r.viagensEdson),
      String(r.viagensBispo),
      String(r.salarioEdson),
      String(r.salarioBispo),
      String(r.salarioTotal),
      escapeCell(r.observacoes ?? ''),
      r.createdAt,
      r.updatedAt,
      String(r.domingoMotoristaSePagou ? '1' : '0'),
      String(r.domingoValorRepasse),
      r.domingoMotoristaAtivo ?? '',
    ]
    lines.push(cells.join(','))
  }
  return lines.join('\r\n')
}

function parseCsvLine(line: string): string[] {
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
    else if (c === ',') {
      result.push(cur)
      cur = ''
    } else cur += c
  }
  result.push(cur)
  return result
}

function headerIndex(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    map[h.trim().toLowerCase()] = i
  })
  return map
}

function numOrZero(s: string): number {
  const n = Number(String(s).replace(',', '.').trim())
  return Number.isFinite(n) ? n : 0
}

export function parseEntriesFromCsv(text: string): { entries: DailyEntry[]; errors: string[] } {
  const errors: string[] = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    errors.push('CSV vazio ou sem linhas de dados.')
    return { entries: [], errors }
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = headerIndex(header)
  const need = ['id', 'date']
  for (const k of need) {
    if (idx[k] === undefined) errors.push(`Coluna obrigatória ausente: ${k}`)
  }
  if (errors.length) return { entries: [], errors }

  const entries: DailyEntry[] = []
  const now = new Date().toISOString()
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li])
    const get = (key: string) => cells[idx[key]] ?? ''

    const id = get('id').trim()
    const date = get('date').trim()
    if (!date) {
      errors.push(`Linha ${li + 1}: data ausente`)
      continue
    }

    const hasNew = idx.km !== undefined
    const hasLegacy = idx.km_atual !== undefined

    if (hasNew) {
      const entry: DailyEntry = {
        id: id || crypto.randomUUID(),
        date,
        km: numOrZero(get('km')),
        valeTransQtd: numOrZero(get('vale_trans_qtd')),
        valeTransValor: numOrZero(get('vale_trans_valor')),
        combustivel: numOrZero(get('combustivel')),
        outrasDespesas: numOrZero(get('outras_despesas')),
        lucroLiquido: numOrZero(get('lucro_liquido')),
        viagensEdson: numOrZero(get('viagens_edson')),
        viagensBispo: numOrZero(get('viagens_bispo')),
        salarioEdson: numOrZero(get('salario_edson')),
        salarioBispo: numOrZero(get('salario_bispo')),
        salarioTotal: numOrZero(get('salario_total')),
        observacoes: get('observacoes') ?? '',
        createdAt: get('created_at') || now,
        updatedAt: get('updated_at') || now,
        domingoMotoristaSePagou:
          get('domingo_motorista_se_pagou').trim() === '1' ||
          get('domingo_motorista_se_pagou').toLowerCase() === 'true',
        domingoValorRepasse: numOrZero(get('domingo_valor_repasse')),
        domingoMotoristaAtivo:
          get('domingo_motorista_ativo').trim() === 'Edson' ||
          get('domingo_motorista_ativo').trim() === 'Bispo' ?
            (get('domingo_motorista_ativo').trim() as 'Edson' | 'Bispo')
          : null,
      }
      entries.push(entry)
      continue
    }

    if (hasLegacy) {
      const moneyVales = numOrZero(get('vale_trans_cartoes'))
      const totalTrips = Math.round(numOrZero(get('quantidade_viagens')))
      const valeTransQtd = Math.max(0, Math.round(moneyVales / defaultSettings.valorValeTrans))
      const viagensEdson = Math.ceil(totalTrips / 2)
      const viagensBispo = Math.floor(totalTrips / 2)
      entries.push({
        id: id || crypto.randomUUID(),
        date,
        km: numOrZero(get('km_atual')),
        valeTransQtd,
        valeTransValor: moneyVales,
        combustivel: numOrZero(get('valor_combustivel')),
        outrasDespesas: numOrZero(get('outras_despesas')),
        lucroLiquido: numOrZero(get('lucro_liquido')),
        viagensEdson,
        viagensBispo,
        salarioEdson: viagensEdson * 50,
        salarioBispo: viagensBispo * 70,
        salarioTotal: viagensEdson * 50 + viagensBispo * 70,
        domingoMotoristaSePagou: false,
        domingoValorRepasse: 0,
        domingoMotoristaAtivo: null,
        observacoes: get('observacoes') ?? '',
        createdAt: now,
        updatedAt: now,
      })
      continue
    }

    errors.push(`Linha ${li + 1}: formato de CSV não reconhecido`)
  }
  return { entries, errors }
}
