import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ChangeEvent } from 'react'
import type { AppSettings, DailyEntry } from '../types'
import { loadEntries, loadSettings, upsertEntry } from '../lib/storage'
import { recalcEntry, normalizeEntryForSave, totalWeeklyFixedExpenses } from '../lib/entry-calcs'
import { emptyEntry } from '../lib/empty-entry'
import { currentYearMonth, endOfIsoWeek, formatBrDate, previousIsoDate, weekdayLongPt } from '../lib/dates'
import { formatBrl, formatKmForInput } from '../lib/format'
import { extractEntryFromImages } from '../lib/extract-entry-client'
import { coerceIsoDate } from '../lib/coerce-extract-date'
import {
  getMonthIsoWeeks,
  formatWeekPeriodLabel,
  isoDateFromLocalDate,
} from '../lib/weeks-in-month'
import {
  saveWeeklyDraft,
  loadWeeklyDraft,
  clearWeeklyDraft,
  type DayDraftSlice,
  type WeeklyLaunchUiState,
} from '../lib/weekly-launch-draft'
import {
  highlightFromExtract,
  mergeExtractIntoEntry,
  fileToDataUrl,
} from '../lib/weekly-launch-ocr'
import { getPrevKmFromWorkMap } from '../lib/weekly-launch-alerts'
import { useAppShell } from '../context/app-shell-context'
import { WeeklyDayCard, applyPadrao33, applyDomingo4 } from '../components/weekly-day-card'
import { Field } from '../components/field'
import { defaultTripsForDate } from '../lib/prefill-trips'

function sumDays(entries: DailyEntry[], settings: AppSettings) {
  let valesQtd = 0
  let valesValor = 0
  let combustivel = 0
  let outras = 0
  let salEdson = 0
  let salBispo = 0
  let salTotal = 0
  let lucro = 0
  for (const e of entries) {
    valesQtd += e.valeTransQtd
    valesValor += e.valeTransValor
    combustivel += e.combustivel
    outras += e.outrasDespesas
    salEdson += e.salarioEdson
    salBispo += e.salarioBispo
    salTotal += e.salarioTotal
    lucro += e.lucroLiquido
  }
  const valesValorR = Math.round(valesValor * 100) / 100
  const combustivelR = Math.round(combustivel * 100) / 100
  const outrasR = Math.round(outras * 100) / 100
  const rate = Math.max(0, Number(settings.valorRiocardPorCartao) || 0)
  const riocardReceber = Math.round(valesQtd * rate * 100) / 100
  const lucroBruto = Math.round((riocardReceber - combustivelR - outrasR) * 100) / 100
  const lucroSomaDias = Math.round(lucro * 100) / 100
  const despesasSemanaisFixas = totalWeeklyFixedExpenses(settings)
  const lucroLiquidoSemanal = Math.round((lucroSomaDias - despesasSemanaisFixas) * 100) / 100
  return {
    valesQtd,
    valesValor: valesValorR,
    valorRiocardPorCartao: rate,
    riocardReceber,
    combustivel: combustivelR,
    outras: outrasR,
    lucroBruto,
    salEdson: Math.round(salEdson * 100) / 100,
    salBispo: Math.round(salBispo * 100) / 100,
    salTotal: Math.round(salTotal * 100) / 100,
    lucroSomaDias,
    despesasSemanaisFixas,
    lucro: lucroLiquidoSemanal,
  }
}

function hasSliceData(slice: DayDraftSlice): boolean {
  const e = slice.entry
  return (
    e.km > 0 ||
    e.valeTransQtd > 0 ||
    e.combustivel > 0 ||
    e.viagensEdson > 0 ||
    e.viagensBispo > 0 ||
    e.outrasDespesas > 0 ||
    slice.touched
  )
}

export function LancamentoSemanalPage() {
  const { dataRevision, bumpData } = useAppShell()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const lastOpenedWeekQuery = useRef<string>('')
  const [month, setMonth] = useState(currentYearMonth())
  const [weekIdx, setWeekIdx] = useState(0)
  const weeks = useMemo(() => getMonthIsoWeeks(month), [month])

  useEffect(() => {
    const mes = searchParams.get('mes')
    const semana = searchParams.get('semana')
    const segunda = searchParams.get('segunda')
    if (!mes && !semana && !segunda) return
    const rawKey = `${mes ?? ''}|${semana ?? ''}|${segunda ?? ''}`
    if (lastOpenedWeekQuery.current === rawKey) return

    let applied = false
    if (segunda && /^\d{4}-\d{2}-\d{2}$/.test(segunda)) {
      const ym = segunda.slice(0, 7)
      const wks = getMonthIsoWeeks(ym)
      const idx = wks.findIndex((w) => isoDateFromLocalDate(w.monday) === segunda)
      if (idx >= 0) {
        setMonth(ym)
        setWeekIdx(idx)
        applied = true
      }
    } else if (mes && semana && /^\d{4}-\d{2}$/.test(mes)) {
      const n = Number(semana)
      if (Number.isFinite(n) && n >= 1) {
        const wks = getMonthIsoWeeks(mes)
        const idx = Math.floor(n) - 1
        if (idx >= 0 && idx < wks.length) {
          setMonth(mes)
          setWeekIdx(idx)
          applied = true
        }
      }
    }

    if (applied) {
      lastOpenedWeekQuery.current = rawKey
      const retorno = searchParams.get('retorno')
      const next = new URLSearchParams()
      if (retorno === 'conferencia') next.set('retorno', 'conferencia')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (weeks.length > 0 && weekIdx >= weeks.length) setWeekIdx(weeks.length - 1)
  }, [weeks.length, weekIdx])

  const selected = weeks[weekIdx]
  const dates = selected?.dates ?? []
  const weekKey = selected ? isoDateFromLocalDate(selected.monday) : ''

  const [dayMap, setDayMap] = useState<Record<string, DayDraftSlice>>({})
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uiState, setUiState] = useState<WeeklyLaunchUiState>('semana_vazia')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrNote, setOcrNote] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [actionHint, setActionHint] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const workByDate = useMemo(() => {
    const m = new Map<string, DailyEntry>()
    for (const d of dates) {
      const sl = dayMap[d]
      if (sl) m.set(d, sl.entry)
    }
    return m
  }, [dates, dayMap])

  const totals = useMemo(() => {
    const arr = dates.map((d) => dayMap[d]?.entry).filter(Boolean) as DailyEntry[]
    const s = loadSettings()
    return sumDays(arr, s)
  }, [dates, dayMap, dataRevision])

  /** Inclui dias fora da lista da semana na tela (ex.: segunda → domingo anterior). */
  const savedByDate = useMemo(() => {
    const m = new Map<string, DailyEntry>()
    for (const e of loadEntries()) m.set(e.date, e)
    return m
  }, [dataRevision])

  useEffect(() => {
    if (!selected) return
    const sNow = loadSettings()
    const wk = isoDateFromLocalDate(selected.monday)
    const draft = loadWeeklyDraft()
    const entries = loadEntries()
    const byDate = new Map(entries.map((e) => [e.date, e]))
    const next: Record<string, DayDraftSlice> = {}

    for (const d of selected.dates) {
      if (draft?.mondayIso === wk && draft.days[d]) {
        const slice = draft.days[d]
        next[d] = {
          ...slice,
          entry: recalcEntry(slice.entry, sNow),
        }
        continue
      }
      const ex = byDate.get(d)
      next[d] = {
        entry: ex ? recalcEntry(ex, sNow) : emptyEntry(d, sNow),
        lowConfidence: {},
        reviewed: false,
        touched: !!ex,
      }
    }
    setDayMap(next)
    setSelectedFiles([])
    setOcrError(null)
    setOcrNote(null)
    if (draft?.mondayIso === wk && draft.uiState === 'ia_lendo')
      setUiState('dados_extraidos')
    else if (draft?.mondayIso === wk && draft.lastImageCount > 0 && draft.uiState === 'imagens_carregadas')
      setUiState('imagens_carregadas')
    else setUiState('semana_vazia')
  }, [weekKey, dataRevision])

  useEffect(() => {
    if (!selected) return
    const id = window.setTimeout(() => {
      saveWeeklyDraft({
        version: 1,
        mondayIso: isoDateFromLocalDate(selected.monday),
        monthYm: month,
        weekIndex: selected.index,
        uiState,
        days: dayMap,
        lastImageCount: selectedFiles.length,
        savedAt: new Date().toISOString(),
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [dayMap, selectedFiles.length, month, selected, uiState])

  useEffect(() => {
    if (selectedFiles.length > 0 && uiState === 'semana_vazia') setUiState('imagens_carregadas')
  }, [selectedFiles.length, uiState])

  const onPickFiles = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    setSelectedFiles((prev) => [...prev, ...Array.from(list)])
    e.target.value = ''
  }, [])

  const patchDay = useCallback((dateIso: string, partial: Partial<DailyEntry>) => {
    setDayMap((prev) => {
      const s = prev[dateIso]
      if (!s) return prev
      const sNow = loadSettings()
      const nextEntry = recalcEntry({ ...s.entry, ...partial }, sNow)
      return {
        ...prev,
        [dateIso]: { ...s, entry: nextEntry, touched: true },
      }
    })
    setUiState((u) => (u === 'semana_salva' ? u : 'pendencias'))
  }, [])

  const readWeekPhotos = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setOcrError('Selecione ao menos uma imagem.')
      return
    }
    if (!selected) return
    setOcrLoading(true)
    setOcrError(null)
    setOcrNote(null)
    setUiState('ia_lendo')

    let merged = 0
    let unmatched = 0

    try {
      for (const file of selectedFiles) {
        const dataUrl = await fileToDataUrl(file)
        const res = await extractEntryFromImages({ folhaDiaria: dataUrl })
        if (res.error) {
          setOcrError(res.error)
          setUiState('imagens_carregadas')
          setOcrLoading(false)
          return
        }
        const rawDate = res.data?.date != null ? String(res.data.date).trim() : ''
        const iso = coerceIsoDate(rawDate)
        const assignDate = iso && selected.dates.includes(iso) ? iso : null

        if (!assignDate) {
          unmatched += 1
          continue
        }

        const data = res.data || {}
        const confidence = res.confidence || {}
        const hi = highlightFromExtract(data, confidence)
        const sNow = loadSettings()

        setDayMap((prev) => {
          const s = prev[assignDate]
          if (!s) return prev
          const mergedEntry = mergeExtractIntoEntry(s.entry, data, sNow)
          return {
            ...prev,
            [assignDate]: {
              ...s,
              entry: mergedEntry,
              lowConfidence: { ...s.lowConfidence, ...hi },
              touched: true,
              reviewed: false,
            },
          }
        })
        merged += 1
      }

      if (merged === 0 && unmatched > 0)
        setOcrError(
          'Nenhuma foto pôde ser associada a um dia desta semana (confira a data na imagem).',
        )
      else if (merged > 0)
        setOcrNote(
          unmatched
            ? `${merged} foto(s) aplicadas. ${unmatched} sem data nesta semana.`
            : `${merged} foto(s) processadas.`,
        )
      setUiState('dados_extraidos')
    } catch {
      setOcrError('Falha ao ler imagens.')
      setUiState('imagens_carregadas')
    } finally {
      setOcrLoading(false)
    }
  }, [selected, selectedFiles])

  const onSaveWeek = useCallback(() => {
    if (!selected) return
    const s = loadSettings()
    for (const d of dates) {
      const slice = dayMap[d]
      if (!slice || !hasSliceData(slice)) continue
      const saved = normalizeEntryForSave(slice.entry, s, slice.entry.createdAt)
      upsertEntry(saved)
    }
    clearWeeklyDraft()
    bumpData()
    const s2 = loadSettings()
    const entriesAfter = loadEntries()
    const byDateAfter = new Map(entriesAfter.map((e) => [e.date, e]))
    setDayMap((prev) => {
      const next: Record<string, DayDraftSlice> = { ...prev }
      for (const d of dates) {
        const ex = byDateAfter.get(d)
        next[d] = {
          entry: ex ? recalcEntry(ex, s2) : emptyEntry(d, s2),
          lowConfidence: {},
          reviewed: false,
          touched: !!ex,
        }
      }
      return next
    })
    const mondayIso = isoDateFromLocalDate(selected.monday)
    if (searchParams.get('retorno') === 'conferencia') {
      navigate(`/conferencia-semanal?mes=${month}&destaque=${mondayIso}&toast=semana`)
      return
    }
    setUiState('semana_salva')
    window.setTimeout(() => setUiState('dados_extraidos'), 2800)
  }, [selected, dates, dayMap, bumpData, navigate, month, searchParams])

  const stateBanner = useMemo(() => {
    if (uiState === 'semana_salva')
      return { text: 'Semana salva no app.', className: 'bg-emerald-100 text-emerald-950' }
    if (uiState === 'ia_lendo')
      return { text: 'IA lendo imagens…', className: 'bg-amber-100 text-amber-950' }
    if (uiState === 'imagens_carregadas')
      return {
        text: 'Imagens prontas — toque em “Ler fotos da semana”.',
        className: 'bg-blue-50 text-blue-900',
      }
    if (uiState === 'dados_extraidos' || uiState === 'pendencias')
      return {
        text: 'Dados extraídos ou editados — revise e salve.',
        className: 'bg-amber-50 text-amber-900',
      }
    return { text: 'Semana vazia — envie fotos ou preencha manualmente.', className: 'bg-slate-100 text-slate-800' }
  }, [uiState])

  if (!selected) {
    return (
      <div className="text-center text-slate-600">Semanas indisponíveis para este mês.</div>
    )
  }

  const sunday = endOfIsoWeek(selected.monday)

  return (
    <div className="pb-52 lg:pb-12">
      <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur lg:relative lg:mx-0 lg:mb-6 lg:rounded-2xl lg:border lg:bg-white lg:px-5 lg:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Lançamento semanal</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              {formatWeekPeriodLabel(selected.monday, sunday)}
            </p>
          </div>
          {searchParams.get('retorno') === 'conferencia' ? (
            <Link
              to={`/conferencia-semanal?mes=${encodeURIComponent(month)}&destaque=${encodeURIComponent(weekKey)}`}
              className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 shadow-sm transition-colors hover:bg-blue-100"
            >
              ← Conferência semanal
            </Link>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <Field
            label="Mês"
            type="month"
            value={month}
            onChange={(v) => {
              setMonth(v)
              setWeekIdx(0)
            }}
          />
          <label className="block min-w-0 flex-1 sm:max-w-xs">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Semana
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-medium text-slate-900 shadow-sm"
              value={weekIdx}
              onChange={(e) => setWeekIdx(Number(e.target.value))}
            >
              {weeks.map((w, i) => {
                const sun = endOfIsoWeek(w.monday)
                return (
                  <option key={isoDateFromLocalDate(w.monday)} value={i}>
                    Semana {w.index} — {formatWeekPeriodLabel(w.monday, sun)}
                  </option>
                )
              })}
            </select>
          </label>
          <button
            type="button"
            disabled={ocrLoading || selectedFiles.length === 0}
            onClick={() => void readWeekPhotos()}
            className="min-h-[48px] w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-md shadow-blue-600/20 disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
          >
            {ocrLoading ? 'Lendo…' : 'Ler fotos da semana'}
          </button>
        </div>
      </header>

      <div className={`mb-3 rounded-xl px-4 py-3 text-sm font-medium ${stateBanner.className}`}>
        {stateBanner.text}
      </div>
      {ocrError ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {ocrError}
        </div>
      ) : null}
      {ocrNote ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {ocrNote}
        </div>
      ) : null}
      {actionHint ? (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          {actionHint}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickFiles}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPickFiles}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mb-6 flex min-h-[140px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center shadow-sm active:bg-slate-50 lg:min-h-[120px]"
      >
        <span className="text-base font-semibold text-slate-800">
          Toque para enviar fotos ou tire fotos agora
        </span>
        <span className="mt-2 text-sm text-slate-500">Galeria e câmera · várias imagens</span>
        <span className="mt-3 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700">
          {selectedFiles.length} imagens selecionadas
        </span>
      </button>
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm"
        >
          Abrir câmera
        </button>
        <button
          type="button"
          onClick={() => setSelectedFiles([])}
          className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 shadow-sm"
        >
          Limpar fotos
        </button>
      </div>

      <section
        aria-label="Resumo da semana antes de salvar"
        className="mt-10 mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:mt-12"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Resumo da semana</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Total cartões (semana)</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{totals.valesQtd}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Valor lançado — vales (R$)</dt>
            <dd className="font-bold text-blue-800 tabular-nums">{formatBrl(totals.valesValor)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Valor a receber Riocard</dt>
            <dd className="font-bold text-sky-900 tabular-nums">{formatBrl(totals.riocardReceber)}</dd>
            <dd className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {totals.valesQtd} ×{' '}
              {totals.valorRiocardPorCartao.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Combustível</dt>
            <dd className="font-bold text-red-700 tabular-nums">{formatBrl(totals.combustivel)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Outras despesas</dt>
            <dd className="font-bold text-slate-800 tabular-nums">{formatBrl(totals.outras)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Salário Edson</dt>
            <dd className="font-bold text-violet-900 tabular-nums">{formatBrl(totals.salEdson)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Salário Bispo</dt>
            <dd className="font-bold text-violet-900 tabular-nums">{formatBrl(totals.salBispo)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total motoristas</dt>
            <dd className="font-bold text-violet-950 tabular-nums">{formatBrl(totals.salTotal)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Lucro bruto</dt>
            <dd className="font-bold text-emerald-800 tabular-nums">{formatBrl(totals.lucroBruto)}</dd>
            <dd className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Riocard − combustível − outras
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Despesas semanais fixas</dt>
            <dd className="font-bold text-amber-900 tabular-nums">
              {formatBrl(totals.despesasSemanaisFixas)}
            </dd>
            <dd className="mt-0.5 text-[11px] leading-snug text-slate-500">
              APTRAN + Morro + Fiscal —{' '}
              <Link to="/config" className="text-blue-700 underline">
                Configurações
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Lucro líquido</dt>
            <dd className="font-bold text-emerald-800 tabular-nums">{formatBrl(totals.lucro)}</dd>
            <dd className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Soma dos dias (após salários) − despesas semanais fixas
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-slate-500">Rascunho salvo automaticamente neste aparelho.</p>
      </section>

      <div className="space-y-4">
        {dates.map((d) => {
          const slice = dayMap[d]
          if (!slice) return null
          const prevIso = previousIsoDate(d)
          const prevFromWeek =
            dates.includes(prevIso) && dayMap[prevIso] ? dayMap[prevIso].entry : undefined
          const prevDayEntry = prevFromWeek ?? savedByDate.get(prevIso)
          const prevKm = getPrevKmFromWorkMap(d, workByDate)
          return (
            <WeeklyDayCard
              key={d}
              dateIso={d}
              slice={slice}
              prevKm={prevKm}
              prevDayEntry={prevDayEntry}
              onPatch={(p) => patchDay(d, p)}
              onCopyPrev={() => {
                setActionHint(null)
                if (!prevDayEntry) return
                const sNow = loadSettings()
                const wd = new Date(d + 'T12:00:00').getDay()
                const viagens =
                  wd === 0
                    ? defaultTripsForDate(d, sNow)
                    : { edson: prevDayEntry.viagensEdson, bispo: prevDayEntry.viagensBispo }
                patchDay(d, {
                  valeTransQtd: prevDayEntry.valeTransQtd,
                  combustivel: prevDayEntry.combustivel,
                  viagensEdson: viagens.edson,
                  viagensBispo: viagens.bispo,
                  outrasDespesas: prevDayEntry.outrasDespesas,
                })
              }}
              onApply33={() => {
                setActionHint(null)
                patchDay(d, applyPadrao33(d))
              }}
              onDomingo4={() => {
                setActionHint(null)
                const partial = applyDomingo4(d, slice.entry.domingoMotoristaAtivo ?? null)
                if (Object.keys(partial).length === 0) {
                  setActionHint(
                    '«Domingo 4» só altera viagens nos domingos. Nos outros dias use «Padrão 3+3».',
                  )
                  window.setTimeout(() => setActionHint(null), 4500)
                  return
                }
                patchDay(d, partial)
              }}
              onMarkReviewed={() => {
                setActionHint(null)
                setDayMap((prev) => {
                  const cur = prev[d]
                  if (!cur) return prev
                  return { ...prev, [d]: { ...cur, reviewed: true } }
                })
                setUiState((u) => (u === 'semana_salva' ? u : 'pendencias'))
              }}
            />
          )
        })}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:mt-8 lg:block">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">Dia</th>
              <th className="px-3 py-3">KM</th>
              <th className="px-3 py-3">Vales</th>
              <th className="px-3 py-3">Comb.</th>
              <th className="px-3 py-3">Edson</th>
              <th className="px-3 py-3">Bispo</th>
              <th className="px-3 py-3">Outras</th>
              <th className="px-3 py-3">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => {
              const e = dayMap[d]?.entry
              if (!e) return null
              return (
                <tr key={d} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{formatBrDate(d)}</td>
                  <td className="px-3 py-2">{weekdayLongPt(d)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {e.km > 0 ? formatKmForInput(e.km) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{e.valeTransQtd || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(e.combustivel)}</td>
                  <td className="px-3 py-2 tabular-nums text-violet-900">{e.viagensEdson}</td>
                  <td className="px-3 py-2 tabular-nums text-violet-900">{e.viagensBispo}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBrl(e.outrasDespesas)}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-emerald-800">
                    {formatBrl(e.lucroLiquido)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur lg:relative lg:bottom-auto lg:z-0 lg:mt-10 lg:rounded-2xl lg:border lg:shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Total semana:</span>{' '}
              <span className="text-emerald-800">{formatBrl(totals.lucro)}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="text-sky-900">Riocard {formatBrl(totals.riocardReceber)}</span>
            </div>
            <div className="text-xs text-violet-950 sm:text-sm">
              <span className="font-medium text-slate-600">Motoristas</span>{' '}
              <span className="font-semibold">Edson {formatBrl(totals.salEdson)}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold">Bispo {formatBrl(totals.salBispo)}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-semibold">Total {formatBrl(totals.salTotal)}</span>
            </div>
            {totals.despesasSemanaisFixas > 0 ? (
              <div className="text-xs text-amber-950">
                <span className="font-medium text-slate-600">Despesas semanais fixas</span>{' '}
                <span className="font-semibold">−{formatBrl(totals.despesasSemanaisFixas)}</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onSaveWeek()}
            className="min-h-[52px] w-full rounded-2xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 sm:w-auto sm:min-w-[200px]"
          >
            Salvar semana
          </button>
        </div>
      </div>
    </div>
  )
}
