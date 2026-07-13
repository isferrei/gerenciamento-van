import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DailyEntry, MotoristaDomingo } from '../types'
import type { ExtractedData } from '../lib/extract-entry-client'
import { extractEntryFromImages, isLowConfidence } from '../lib/extract-entry-client'
import { loadEntries, loadSettings, upsertEntry } from '../lib/storage'
import { recalcEntry, normalizeEntryForSave, sundaySuggestedRepasse } from '../lib/entry-calcs'
import { emptyEntry } from '../lib/empty-entry'
import { parseDecimal, formatBrl, parseKmInput, formatKmForInput } from '../lib/format'
import { weekdayLongPt, isSundayIso } from '../lib/dates'
import { Field } from './field'
import { ImageSlot } from './image-slot'

export interface LancamentoFormProps {
  seedDate: string
  variant?: 'page' | 'embedded'
  navigateAfterSave?: boolean
  redirectTo?: string
  onSaved?: () => void
}

type PreviewKey = 'painelKm' | 'notaCombustivel' | 'telaValeTrans' | 'folhaDiaria'

/** Campos do formulário que podem receber destaque de baixa confiança (OCR). */
const OCR_FORM_KEYS: (keyof DailyEntry & keyof ExtractedData)[] = [
  'date',
  'km',
  'valeTransQtd',
  'combustivel',
  'viagensEdson',
  'viagensBispo',
  'outrasDespesas',
  'observacoes',
]

function hasAnyExtracted(data: ExtractedData): boolean {
  if (data.date != null && String(data.date).trim() !== '') return true
  if (data.km != null && !Number.isNaN(Number(data.km))) return true
  if (data.valeTransQtd != null && !Number.isNaN(Number(data.valeTransQtd))) return true
  if (data.combustivel != null && !Number.isNaN(Number(data.combustivel))) return true
  if (data.viagensEdson != null && !Number.isNaN(Number(data.viagensEdson))) return true
  if (data.viagensBispo != null && !Number.isNaN(Number(data.viagensBispo))) return true
  if (data.outrasDespesas != null && !Number.isNaN(Number(data.outrasDespesas))) return true
  if (data.observacoes != null) return true
  return false
}

function highlightFromExtract(
  data: ExtractedData,
  confidence: Partial<Record<keyof ExtractedData, number>>,
): Partial<Record<keyof ExtractedData, boolean>> {
  const h: Partial<Record<keyof ExtractedData, boolean>> = {}
  if (data.date != null && String(data.date).trim() !== '' && isLowConfidence(confidence.date))
    h.date = true
  if (
    data.km != null &&
    !Number.isNaN(Number(data.km)) &&
    isLowConfidence(confidence.km)
  )
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
  if (data.observacoes != null && isLowConfidence(confidence.observacoes))
    h.observacoes = true
  return h
}

export function LancamentoForm({
  seedDate,
  variant = 'page',
  navigateAfterSave = true,
  redirectTo = '/lista',
  onSaved,
}: LancamentoFormProps) {
  const navigate = useNavigate()
  const settings = useMemo(() => loadSettings(), [])
  const [entry, setEntry] = useState<DailyEntry>(() => {
    const s = loadSettings()
    const found = loadEntries().find((e) => e.date === seedDate)
    if (found) return recalcEntry(found, s)
    return emptyEntry(seedDate, s)
  })
  const [previews, setPreviews] = useState<Partial<Record<PreviewKey, string>>>({})
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrSuccess, setOcrSuccess] = useState<string | null>(null)
  const [ocrBackendWarning, setOcrBackendWarning] = useState<string | null>(null)
  const [ocrBackendHelpUrl, setOcrBackendHelpUrl] = useState<string | null>(null)
  const [ocrLowConfidence, setOcrLowConfidence] = useState<
    Partial<Record<keyof ExtractedData, boolean>>
  >({})

  const sundayRepasseSugestao = useMemo(() => {
    if (!isSundayIso(entry.date)) return 0
    return sundaySuggestedRepasse(
      entry.date,
      entry.viagensEdson,
      entry.viagensBispo,
      settings,
      entry.domingoMotoristaAtivo,
    )
  }, [entry.date, entry.viagensEdson, entry.viagensBispo, entry.domingoMotoristaAtivo, settings])

  const repasseStoredDomingo = Number(entry.domingoValorRepasse ?? 0)

  function patch(partial: Partial<DailyEntry>) {
    const s = loadSettings()
    setOcrLowConfidence((prev) => {
      const next = { ...prev }
      for (const k of OCR_FORM_KEYS) {
        if (Object.prototype.hasOwnProperty.call(partial, k)) delete next[k]
      }
      return next
    })
    setEntry((prev) => recalcEntry({ ...prev, ...partial }, s))
  }

  function handleDateChange(iso: string) {
    setPreviews({})
    setOcrLowConfidence({})
    setOcrSuccess(null)
    setOcrError(null)
    setOcrBackendWarning(null)
    setOcrBackendHelpUrl(null)
    const s = loadSettings()
    const found = loadEntries().find((e) => e.date === iso)
    if (found) setEntry(recalcEntry(found, s))
    else setEntry(emptyEntry(iso, s))
  }

  function limpar() {
    setPreviews({})
    setOcrLowConfidence({})
    setOcrSuccess(null)
    setOcrError(null)
    setOcrBackendWarning(null)
    setOcrBackendHelpUrl(null)
    const s = loadSettings()
    setEntry(emptyEntry(entry.date, s))
  }

  async function handleReadImages() {
    const hasAny = Object.values(previews).some(
      (v) => typeof v === 'string' && v.length > 0,
    )
    if (!hasAny) {
      setOcrError('Anexe pelo menos uma imagem para ler.')
      setOcrSuccess(null)
      return
    }
    setOcrLoading(true)
    setOcrError(null)
    setOcrSuccess(null)
    setOcrBackendWarning(null)
    setOcrBackendHelpUrl(null)
    try {
      const res = await extractEntryFromImages(previews)
      if (res.error) {
        setOcrError(res.error)
        return
      }
      if (res.meta?.warning) {
        setOcrBackendWarning(res.meta.warning)
        setOcrBackendHelpUrl(res.meta.docUrl ?? null)
      }

      const data = res.data || {}
      const confidence = res.confidence || {}
      const s = loadSettings()

      setEntry((prev) => {
        let base: DailyEntry = { ...prev }

        if (data.date != null && String(data.date).trim() !== '') {
          const iso = String(data.date).trim()
          if (iso !== prev.date) {
            const found = loadEntries().find((e) => e.date === iso)
            base = found ? { ...found } : emptyEntry(iso, s)
          }
        }

        const next: DailyEntry = { ...base }

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

        return recalcEntry(next, s)
      })

      setOcrLowConfidence(highlightFromExtract(data, confidence))

      if (hasAnyExtracted(data)) {
        setOcrSuccess('Campos preenchidos automaticamente. Confira antes de salvar.')
        setOcrError(null)
      } else {
        setOcrSuccess(null)
        if (!res.meta?.warning)
          setOcrError(
            'Nenhum dado foi reconhecido nas imagens. Tente outras fotos ou preencha manualmente.',
          )
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Falha ao ler imagens.')
    } finally {
      setOcrLoading(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const s = loadSettings()
    const saved = normalizeEntryForSave(entry, s, entry.createdAt)
    upsertEntry(saved)
    setPreviews({})
    setOcrSuccess(null)
    setOcrError(null)
    setOcrBackendWarning(null)
    setOcrBackendHelpUrl(null)
    onSaved?.()
    if (navigateAfterSave) navigate(redirectTo)
  }

  const isEmbedded = variant === 'embedded'
  const formCard = isEmbedded
    ? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'
    : ''
  const diaSemana = weekdayLongPt(entry.date)

  return (
    <div className={isEmbedded ? '' : 'space-y-6'}>
      {!isEmbedded ? (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lançamento diário</h2>
          <p className="mt-1 text-sm text-slate-600">
            Viagens por motorista são editáveis. Segunda a sábado: padrão 3+3. No domingo trabalha só
            um motorista (em Configurações); as viagens ficam só dele e o outro fica em zero.
          </p>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">Lançamento diário</h2>
          <p className="text-sm text-slate-600">
            Ajuste viagens e vales; salários e lucro atualizam na hora.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className={`space-y-4 ${formCard}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Data"
            type="date"
            value={entry.date}
            onChange={(v) => {
              patch({ date: v })
              handleDateChange(v)
            }}
            required
            lowConfidence={Boolean(ocrLowConfidence.date)}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Dia da semana</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-medium text-slate-900">
              {diaSemana || '—'}
            </div>
          </div>
        </div>

        <Field
          label="KM atual (painel)"
          type="text"
          inputMode="decimal"
          value={entry.km === 0 ? '' : formatKmForInput(entry.km)}
          onChange={(v) => patch({ km: v === '' ? 0 : parseKmInput(v) })}
          lowConfidence={Boolean(ocrLowConfidence.km)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantidade de vales"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={entry.valeTransQtd === 0 ? '' : String(entry.valeTransQtd)}
            onChange={(v) =>
              patch({ valeTransQtd: v === '' ? 0 : Math.max(0, Math.round(parseDecimal(v))) })
            }
            lowConfidence={Boolean(ocrLowConfidence.valeTransQtd)}
          />
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-xs font-medium text-blue-900">Valor total dos vales</p>
            <p className="mt-1 text-lg font-bold text-blue-800">
              {formatBrl(entry.valeTransValor)}
            </p>
            <p className="text-[11px] text-blue-800/80">
              {entry.valeTransQtd || 0} × {formatBrl(settings.valorValeTrans)} (config.)
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Combustível (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={entry.combustivel === 0 ? '' : String(entry.combustivel)}
            onChange={(v) => patch({ combustivel: v === '' ? 0 : parseDecimal(v) })}
            lowConfidence={Boolean(ocrLowConfidence.combustivel)}
          />
          <Field
            label="Outras despesas (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={entry.outrasDespesas === 0 ? '' : String(entry.outrasDespesas)}
            onChange={(v) => patch({ outrasDespesas: v === '' ? 0 : parseDecimal(v) })}
            lowConfidence={Boolean(ocrLowConfidence.outrasDespesas)}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm font-semibold text-slate-800">Viagens por motorista</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Edson — quantidade de viagens"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={entry.viagensEdson === 0 ? '' : String(entry.viagensEdson)}
              onChange={(v) =>
                patch({ viagensEdson: v === '' ? 0 : Math.max(0, Math.round(parseDecimal(v))) })
              }
              lowConfidence={Boolean(ocrLowConfidence.viagensEdson)}
            />
            <Field
              label="Bispo — quantidade de viagens"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={entry.viagensBispo === 0 ? '' : String(entry.viagensBispo)}
              onChange={(v) =>
                patch({ viagensBispo: v === '' ? 0 : Math.max(0, Math.round(parseDecimal(v))) })
              }
              lowConfidence={Boolean(ocrLowConfidence.viagensBispo)}
            />
          </div>
        </div>

        {isSundayIso(entry.date) ? (
          <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/90 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-violet-950">
                Motorista no domingo (repasse)
              </span>
              <select
                className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-violet-950 shadow-sm outline-none ring-violet-500/30 focus:border-violet-500 focus:ring-4"
                value={entry.domingoMotoristaAtivo ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  patch({
                    domingoMotoristaAtivo: v === '' ? null : (v as MotoristaDomingo),
                  })
                }}
              >
                <option value="">Como nas configurações</option>
                <option value="Edson">Edson</option>
                <option value="Bispo">Bispo</option>
              </select>
              <span className="text-xs text-violet-900/70">
                Na importação CSV de turnos, o motorista do domingo vem da coluna motorista (prioridade
                sobre esta lista).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
                checked={entry.domingoMotoristaSePagou}
                onChange={(e) => {
                  const checked = e.target.checked
                  if (checked) patch({ domingoMotoristaSePagou: true })
                  else {
                    const sug = sundaySuggestedRepasse(
                      entry.date,
                      entry.viagensEdson,
                      entry.viagensBispo,
                      settings,
                      entry.domingoMotoristaAtivo,
                    )
                    patch({
                      domingoMotoristaSePagou: false,
                      domingoValorRepasse:
                        repasseStoredDomingo > 0 ? repasseStoredDomingo : sug,
                    })
                  }
                }}
              />
              <span className="text-sm font-medium leading-snug text-violet-950">
                Motorista se pagou no domingo (repasse não entra no lucro do dia)
              </span>
            </label>
            {!entry.domingoMotoristaSePagou ? (
              <Field
                label="Valor do repasse (R$)"
                type="text"
                inputMode="decimal"
                value={repasseStoredDomingo === 0 ? '' : String(repasseStoredDomingo)}
                hint={`Sugestão (viagens × valor da viagem): ${formatBrl(sundayRepasseSugestao)}. Deixe vazio para usar só o cálculo pelas viagens.`}
                onChange={(v) =>
                  patch({ domingoValorRepasse: v.trim() === '' ? 0 : parseDecimal(v) })
                }
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-xs font-medium text-slate-600">Salário Edson</p>
            <p className="text-lg font-semibold text-slate-900">{formatBrl(entry.salarioEdson)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-xs font-medium text-slate-600">Salário Bispo</p>
            <p className="text-lg font-semibold text-slate-900">{formatBrl(entry.salarioBispo)}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 sm:col-span-2">
            <p className="text-xs font-medium text-violet-900">Salário total do dia</p>
            <p className="text-xl font-bold text-violet-950">{formatBrl(entry.salarioTotal)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            Lucro líquido do dia
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatBrl(entry.lucroLiquido)}</p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Vales − combustível − outras − salário total
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Observações</span>
          <textarea
            value={entry.observacoes ?? ''}
            onChange={(e) => patch({ observacoes: e.target.value })}
            rows={3}
            className={
              ocrLowConfidence.observacoes
                ? 'rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none ring-amber-500/25 focus:border-amber-500 focus:ring-4'
                : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none ring-blue-500/25 focus:border-blue-500 focus:ring-4'
            }
            placeholder="Anotações do dia…"
          />
        </label>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Fotos (só visualização)</h3>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            As fotos não vão para o armazenamento local. Ao usar «Ler imagens e preencher campos»,
            elas são enviadas só para a leitura automática e continuam só na memória desta sessão.
            Ao salvar o lançamento, apenas números e observações são guardados.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageSlot
              label="Painel / KM"
              value={previews.painelKm}
              onChange={(v) => setPreviews((p) => ({ ...p, painelKm: v }))}
            />
            <ImageSlot
              label="Nota de combustível"
              value={previews.notaCombustivel}
              onChange={(v) => setPreviews((p) => ({ ...p, notaCombustivel: v }))}
            />
            <ImageSlot
              label="Tela Vale Trans"
              value={previews.telaValeTrans}
              onChange={(v) => setPreviews((p) => ({ ...p, telaValeTrans: v }))}
            />
            <ImageSlot
              label="Folha do dia"
              value={previews.folhaDiaria}
              onChange={(v) => setPreviews((p) => ({ ...p, folhaDiaria: v }))}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-indigo-950">Leitura automática</p>
            <button
              type="button"
              disabled={ocrLoading}
              onClick={() => void handleReadImages()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ocrLoading ? 'Lendo imagens…' : 'Ler imagens e preencher campos'}
            </button>
          </div>
          {ocrBackendWarning ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p>{ocrBackendWarning}</p>
              {ocrBackendHelpUrl ? (
                <p>
                  <a
                    href={ocrBackendHelpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-amber-900 underline decoration-amber-600 underline-offset-2 hover:text-amber-950"
                  >
                    Variáveis de ambiente no Netlify (documentação)
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          {ocrError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {ocrError}
            </p>
          ) : null}
          {ocrSuccess ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              {ocrSuccess}
            </p>
          ) : null}
          <p className="text-xs text-slate-600">
            A leitura só preenche o formulário. Para gravar, use «Salvar lançamento».
          </p>
        </section>

        <div className={`flex flex-col gap-2 sm:flex-row ${isEmbedded ? 'sm:justify-end' : ''}`}>
          <button
            type="button"
            onClick={limpar}
            className={`rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 ${isEmbedded ? 'sm:min-w-[120px]' : 'w-full sm:w-auto'}`}
          >
            Limpar
          </button>
          <button
            type="submit"
            className={`rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 ${isEmbedded ? 'sm:min-w-[180px]' : 'w-full sm:flex-1'}`}
          >
            Salvar lançamento
          </button>
        </div>
      </form>
    </div>
  )
}
