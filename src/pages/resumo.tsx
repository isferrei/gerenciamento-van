import { useCallback, useMemo, useState } from 'react'
import { loadEntries, loadSettings } from '../lib/storage'
import { computeMonthlyStats, filterEntriesByMonth } from '../lib/monthly-stats'
import { currentYearMonth, formatBrDate, formatMonthNamePt } from '../lib/dates'
import { captureElementToPngBlob } from '../lib/capture-element-to-png'
import { downloadBlobFile } from '../lib/download-blob'
import { Field } from '../components/field'
import { MonthKpiGrid } from '../components/month-kpi-grid'
import {
  MONTHLY_ADVISORY_SUMMARY_PRINT_ID,
  MonthlyAdvisorySummaryPrint,
} from '../components/monthly-advisory-summary-print'
import { useAppShell } from '../context/app-shell-context'

export function ResumoPage() {
  const { dataRevision } = useAppShell()
  const [month, setMonth] = useState(currentYearMonth())
  const [gerandoImagem, setGerandoImagem] = useState(false)
  const [gerarImagemErro, setGerarImagemErro] = useState<string | null>(null)
  const [gerarImagemOk, setGerarImagemOk] = useState(false)

  const stats = useMemo(() => {
    void dataRevision
    const all = loadEntries()
    const settings = loadSettings()
    const inMonth = filterEntriesByMonth(all, month)
    return computeMonthlyStats(inMonth, settings, all, month)
  }, [month, dataRevision])

  const monthLabel = useMemo(() => formatMonthNamePt(month), [month])

  const onGerarImagem = useCallback(async () => {
    setGerarImagemErro(null)
    setGerarImagemOk(false)
    setGerandoImagem(true)
    try {
      const el = document.getElementById(MONTHLY_ADVISORY_SUMMARY_PRINT_ID)
      if (!el) throw new Error('Área do resumo não encontrada na página.')
      const target = el as HTMLElement
      target.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      try {
        await document.fonts.ready
      } catch {
        /* ignore */
      }
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      const slug = monthLabel
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '-')
      const name = `resumo-contabilidade-${slug}-${month}.png`
      const blob = await captureElementToPngBlob(target)
      downloadBlobFile(blob, name)
      setGerarImagemOk(true)
      window.setTimeout(() => setGerarImagemOk(false), 4000)
    } catch (e) {
      const msg =
        e instanceof Error ?
          e.message
        : 'Não foi possível gerar a imagem. Tente outro navegador ou desative extensões de bloqueio.'
      setGerarImagemErro(msg)
      console.error('resumo: gerar imagem', e)
    } finally {
      setGerandoImagem(false)
    }
  }, [month, monthLabel])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Resumo mensal</h2>
        <p className="mt-1 text-sm text-slate-600">
          Totais consolidados do mês selecionado. Gere a imagem no formato da planilha para enviar à
          assessoria.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="Mês de referência" type="month" value={month} onChange={setMonth} />
        <button
          type="button"
          onClick={() => void onGerarImagem()}
          disabled={gerandoImagem}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gerandoImagem ? 'Gerando imagem…' : 'Gerar imagem para assessoria'}
        </button>
      </div>

      {gerarImagemErro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {gerarImagemErro}
        </div>
      ) : null}
      {gerarImagemOk ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          Imagem gerada — verifique a pasta de downloads.
        </div>
      ) : null}

      <MonthKpiGrid stats={stats} />

      {stats.diasSemLancamento.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Dias sem lançamento neste mês:</span>{' '}
          {stats.diasSemLancamento.map(formatBrDate).join(', ')}.
        </div>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Prévia — envio à assessoria
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <MonthlyAdvisorySummaryPrint monthLabel={monthLabel} stats={stats} />
        </div>
      </section>
    </div>
  )
}
