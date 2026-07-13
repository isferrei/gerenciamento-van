import { useState } from 'react'
import type { DailyEntry, MotoristaDomingo } from '../types'
import type { ExtractedData } from '../lib/extract-entry-client'
import { formatBrl, parseDecimal, parseKmInput, formatKmForInput } from '../lib/format'
import { formatBrDate, weekdayLongPt, isSundayIso } from '../lib/dates'
import { sundaySuggestedRepasse } from '../lib/entry-calcs'
import {
  listWeeklyDayAlerts,
  computeWeeklyCardStatus,
  type WeeklyCardStatus,
  ALERT_KM_REGRESSAO,
  ALERT_VIAGENS,
  ALERT_KM,
  ALERT_COMBUSTIVEL,
  ALERT_VALE,
} from '../lib/weekly-launch-alerts'
import { loadSettings } from '../lib/storage'
import { defaultTripsForDate } from '../lib/prefill-trips'

type FieldKind = 'int' | 'money' | 'lucro' | 'km'

const FIELD_ORDER: {
  key: keyof DailyEntry
  label: string
  kind: FieldKind
}[] = [
  { key: 'km', label: 'KM', kind: 'km' },
  { key: 'valeTransQtd', label: 'Vales', kind: 'int' },
  { key: 'combustivel', label: 'Combustível', kind: 'money' },
  { key: 'viagensEdson', label: 'Edson', kind: 'int' },
  { key: 'viagensBispo', label: 'Bispo', kind: 'int' },
  { key: 'outrasDespesas', label: 'Outras', kind: 'money' },
  { key: 'lucroLiquido', label: 'Lucro líq.', kind: 'lucro' },
]

interface WeeklyDayCardProps {
  dateIso: string
  slice: {
    entry: DailyEntry
    lowConfidence: Partial<Record<keyof ExtractedData, boolean>>
    reviewed: boolean
    touched: boolean
  }
  prevKm: number | null
  prevDayEntry: DailyEntry | undefined
  onPatch: (partial: Partial<DailyEntry>) => void
  onCopyPrev: () => void
  onApply33: () => void
  onDomingo4: () => void
  onMarkReviewed: () => void
}

function statusUi(s: WeeklyCardStatus): { label: string; className: string } {
  if (s === 'completo')
    return { label: 'Completo', className: 'bg-emerald-100 text-emerald-900 ring-emerald-200' }
  if (s === 'revisar') return { label: 'Revisar', className: 'bg-amber-100 text-amber-950 ring-amber-200' }
  return { label: 'Faltando dados', className: 'bg-red-100 text-red-900 ring-red-200' }
}

function formatFieldVal(entry: DailyEntry, key: keyof DailyEntry, kind: string): string {
  const v = entry[key]
  if (kind === 'money' || kind === 'lucro') {
    const n = typeof v === 'number' ? v : 0
    return formatBrl(n)
  }
  if (kind === 'km') {
    const n = typeof v === 'number' ? v : 0
    return n === 0 ? '—' : formatKmForInput(n)
  }
  const n = typeof v === 'number' ? v : 0
  if (key === 'valeTransQtd' || key === 'viagensEdson' || key === 'viagensBispo')
    return n === 0 ? '—' : String(Math.round(n))
  return String(n)
}

export function WeeklyDayCard(props: WeeklyDayCardProps) {
  const {
    dateIso,
    slice,
    prevKm,
    prevDayEntry,
    onPatch,
    onCopyPrev,
    onApply33,
    onDomingo4,
    onMarkReviewed,
  } = props
  const { entry, lowConfidence, reviewed, touched } = slice
  const alerts = listWeeklyDayAlerts(dateIso, entry, prevKm, touched)
  const hasAnyFill =
    entry.km > 0 ||
    entry.valeTransQtd > 0 ||
    entry.combustivel > 0 ||
    entry.viagensEdson > 0 ||
    entry.viagensBispo > 0 ||
    entry.outrasDespesas > 0

  const lowAny = FIELD_ORDER.some(
    (f) => f.key !== 'lucroLiquido' && Boolean(lowConfidence[f.key as keyof ExtractedData]),
  )

  const st = computeWeeklyCardStatus({
    alerts,
    reviewed,
    lowConfidenceAny: lowAny,
    hasAnyFill,
    touched,
  })
  const badge = statusUi(st)

  const settings = loadSettings()
  const sundaySuggested =
    isSundayIso(dateIso) ?
      sundaySuggestedRepasse(
        dateIso,
        entry.viagensEdson,
        entry.viagensBispo,
        settings,
        entry.domingoMotoristaAtivo,
      )
    : 0
  const repasseStored = Number(entry.domingoValorRepasse ?? 0)

  const [editing, setEditing] = useState<{ key: keyof DailyEntry; kind: FieldKind } | null>(null)
  const [editRaw, setEditRaw] = useState('')

  function openEdit(f: (typeof FIELD_ORDER)[number]) {
    if (f.kind === 'lucro') return
    const v = entry[f.key]
    if (f.kind === 'km') {
      const n = Number(v) || 0
      setEditRaw(n === 0 ? '' : formatKmForInput(n))
      setEditing({ key: f.key, kind: f.kind })
      return
    }
    setEditRaw(
      f.kind === 'int'
        ? String(Math.round(Number(v) || 0))
        : v === 0
          ? ''
          : String(v ?? ''),
    )
    setEditing({ key: f.key, kind: f.kind })
  }

  function commitEdit() {
    if (!editing) return
    const k = editing.key
    let partial: Partial<DailyEntry> = {}
    if (editing.kind === 'km') {
      partial = { [k]: parseKmInput(editRaw) } as Partial<DailyEntry>
    } else if (editing.kind === 'int') {
      const n = editRaw === '' ? 0 : Math.max(0, Math.round(parseDecimal(editRaw)))
      partial = { [k]: n } as Partial<DailyEntry>
    } else {
      const n = editRaw === '' ? 0 : Math.max(0, parseDecimal(editRaw))
      partial = { [k]: n } as Partial<DailyEntry>
    }
    onPatch(partial)
    setEditing(null)
  }

  return (
    <article className="relative z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatBrDate(dateIso)}
          </p>
          <p className="text-lg font-bold text-slate-900">{weekdayLongPt(dateIso)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {alerts.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs font-medium">
          {alerts.map((a) => (
            <li
              key={a}
              className={
                a === ALERT_KM_REGRESSAO
                  ? 'text-red-700'
                  : a === ALERT_VIAGENS
                    ? 'text-amber-800'
                    : 'text-red-600'
              }
            >
              {a}
            </li>
          ))}
        </ul>
      ) : null}

      {isSundayIso(dateIso) ? (
        <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-violet-900">
              Motorista no domingo (repasse)
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950 shadow-sm outline-none ring-violet-500/30 focus:border-violet-500 focus:ring-4"
              value={entry.domingoMotoristaAtivo ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onPatch({
                  domingoMotoristaAtivo: v === '' ? null : (v as MotoristaDomingo),
                })
              }}
            >
              <option value="">Como nas configurações</option>
              <option value="Edson">Edson</option>
              <option value="Bispo">Bispo</option>
            </select>
            <p className="mt-1 text-[11px] text-violet-900/70">
              Na importação CSV de turnos, o motorista do domingo vem da coluna motorista (prioridade
              sobre esta lista).
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
              checked={entry.domingoMotoristaSePagou}
              onChange={(e) => {
                const checked = e.target.checked
                if (checked) onPatch({ domingoMotoristaSePagou: true })
                else {
                  const sug = sundaySuggestedRepasse(
                    dateIso,
                    entry.viagensEdson,
                    entry.viagensBispo,
                    settings,
                    entry.domingoMotoristaAtivo,
                  )
                  onPatch({
                    domingoMotoristaSePagou: false,
                    domingoValorRepasse:
                      repasseStored > 0 ? repasseStored : sug,
                  })
                }
              }}
            />
            <span className="text-sm font-medium leading-snug text-violet-950">
              Motorista se pagou no domingo (repasse não entra no lucro do dia)
            </span>
          </label>
          {!entry.domingoMotoristaSePagou ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-violet-900">
                Valor do repasse (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={formatBrl(sundaySuggested)}
                value={repasseStored === 0 ? '' : String(repasseStored)}
                onChange={(e) => {
                  const raw = e.target.value
                  onPatch({
                    domingoValorRepasse: raw.trim() === '' ? 0 : parseDecimal(raw),
                  })
                }}
                className="mt-1 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-900 shadow-sm outline-none ring-violet-500/30 focus:border-violet-500 focus:ring-4"
              />
              <p className="mt-1 text-[11px] text-violet-900/80">
                Sugestão: viagens × valor da viagem ({formatBrl(sundaySuggested)}). Deixe vazio para
                usar o cálculo automático pelas viagens.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {FIELD_ORDER.map((f) => {
          const isLucro = f.kind === 'lucro'
          const miss =
            !isLucro &&
            ((f.key === 'km' && alerts.includes(ALERT_KM)) ||
              (f.key === 'combustivel' && alerts.includes(ALERT_COMBUSTIVEL)) ||
              (f.key === 'valeTransQtd' && alerts.includes(ALERT_VALE)))
          const lowFlag =
            !isLucro && Boolean(lowConfidence[f.key as keyof ExtractedData])

          return (
            <div
              key={f.key}
              className={[
                'flex items-center justify-between gap-3 rounded-xl border px-3 py-3',
                miss ? 'border-red-300 bg-red-50' : '',
                !miss && lowFlag ? 'border-amber-300 bg-amber-50' : '',
                !miss && !lowFlag ? 'border-slate-100 bg-slate-50/80' : '',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {f.label}
                </p>
                <p className="truncate text-xl font-bold tabular-nums text-slate-900">
                  {formatFieldVal(entry, f.key, f.kind)}
                </p>
              </div>
              {!isLucro ? (
                <button
                  type="button"
                  onClick={() => openEdit(f)}
                  className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-blue-700"
                >
                  Editar
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">Calculado</span>
              )}
            </div>
          )
        })}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Editar {String(editing.key)}</p>
            <input
              autoFocus
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-4 text-2xl font-semibold tabular-nums outline-none ring-blue-500 focus:ring-2"
              inputMode={editing.kind === 'int' ? 'numeric' : 'decimal'}
              value={editRaw}
              onChange={(e) => setEditRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
              }}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
                onClick={() => commitEdit()}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!prevDayEntry}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onCopyPrev()
          }}
          className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-950 disabled:opacity-40"
        >
          Copiar padrão do dia anterior
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onApply33()
          }}
          className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-950"
        >
          Padrão 3+3
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDomingo4()
          }}
          className="min-h-[44px] flex-1 touch-manipulation rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-950"
        >
          Domingo 4
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onMarkReviewed()
          }}
          className="min-h-[44px] w-full touch-manipulation rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 sm:w-auto"
        >
          Marcar como revisado
        </button>
      </div>
    </article>
  )
}

export function applyPadrao33(dateIso: string): Partial<DailyEntry> {
  const s = loadSettings()
  const t = defaultTripsForDate(dateIso, s)
  return { viagensEdson: t.edson, viagensBispo: t.bispo }
}

export function applyDomingo4(
  dateIso: string,
  motoristaDomingo?: MotoristaDomingo | null,
): Partial<DailyEntry> {
  const wd = new Date(dateIso + 'T12:00:00').getDay()
  if (wd !== 0) return {}
  const s = loadSettings()
  const active = motoristaDomingo ?? s.motoristaDomingoPadrao
  if (active === 'Bispo')
    return { viagensEdson: 0, viagensBispo: Math.max(4, s.viagensDomingoPadrao) }
  return { viagensEdson: Math.max(4, s.viagensDomingoPadrao), viagensBispo: 0 }
}
