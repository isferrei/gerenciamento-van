import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadEntries, loadSettings } from '../lib/storage'
import { captureElementToPngBlob } from '../lib/capture-element-to-png'
import { downloadBlobFile } from '../lib/download-blob'
import { currentYearMonth, endOfIsoWeek, isSundayIso, weekdayLongPt } from '../lib/dates'
import { formatBrl } from '../lib/format'
import { Field } from '../components/field'
import { useAppShell } from '../context/app-shell-context'
import {
  formatWeekPeriodLabel,
  formatWeekRangeForFilename,
  getMonthIsoWeeks,
  isoDateFromLocalDate,
} from '../lib/weeks-in-month'
import type { AppSettings, DailyEntry, MotoristaDomingo } from '../types'
import {
  roundMoney,
  weekHasConfirmableDiscounts,
  weekHasRevertableDiscounts,
  type RepasseDiscountLine,
} from '../lib/driver-fines-logic'
import {
  confirmRepasseWeekDiscounts,
  loadDriverFinesDb,
  revertRepasseWeekDiscounts,
} from '../lib/driver-fines-storage'
import {
  buildRepasseDiscountLinesWithPick,
  getRepasseManualFinePick,
  listRepasseSelectableFines,
  setRepasseManualFinePick,
} from '../lib/repasse-manual-pick'

interface DriverDayRow {
  date: string
  weekday: string
  viagens: number
  valorDia: number
}

function sundayMotoristaAtivo(entry: DailyEntry | undefined, settings: AppSettings): MotoristaDomingo {
  if (entry?.domingoMotoristaAtivo === 'Edson' || entry?.domingoMotoristaAtivo === 'Bispo') {
    return entry.domingoMotoristaAtivo
  }
  return settings.motoristaDomingoPadrao
}

function buildDriverWeek(
  dates: string[],
  byDate: Map<string, DailyEntry>,
  driver: 'edson' | 'bispo',
  valorPorViagem: number,
  settings: AppSettings,
): {
  rows: DriverDayRow[]
  totalViagens: number
  totalValor: number
  /** Domingo em que o motorista quitou por conta: viagens não entram no repasse. */
  domingoSePagou?: { date: string; viagens: number }
} {
  const rows: DriverDayRow[] = []
  let domingoSePagou: { date: string; viagens: number } | undefined
  for (const date of dates) {
    const e = byDate.get(date)
    const nRaw = driver === 'edson' ? (e?.viagensEdson ?? 0) : (e?.viagensBispo ?? 0)
    const isSunday = isSundayIso(date)
    if (e && isSunday && e.domingoMotoristaSePagou) {
      if (nRaw > 0) domingoSePagou = { date, viagens: nRaw }
      continue
    }

    const activeSunday = e ? sundayMotoristaAtivo(e, settings) : settings.motoristaDomingoPadrao
    const driverIsSundayActive =
      (driver === 'edson' && activeSunday === 'Edson') ||
      (driver === 'bispo' && activeSunday === 'Bispo')
    const manualSunday =
      isSunday && e ? Math.max(0, Number(e.domingoValorRepasse ?? 0)) : 0
    const useManualDomingoRepasse = manualSunday > 0 && driverIsSundayActive

    if (nRaw <= 0 && !useManualDomingoRepasse) continue

    const valorDia =
      useManualDomingoRepasse ?
        Math.round(manualSunday * 100) / 100
      : Math.round(nRaw * valorPorViagem * 100) / 100
    rows.push({
      date,
      weekday: weekdayLongPt(date),
      viagens: nRaw,
      valorDia,
    })
  }
  const totalViagens = rows.reduce((a, r) => a + r.viagens, 0)
  const totalValor = Math.round(rows.reduce((a, r) => a + r.valorDia, 0) * 100) / 100
  return { rows, totalViagens, totalValor, domingoSePagou }
}

function formatShortData(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function RepasseMotoristasPage() {
  const { dataRevision, bumpData } = useAppShell()
  const [month, setMonth] = useState(currentYearMonth())
  const [weekIdx, setWeekIdx] = useState(0)
  const [gerandoImagem, setGerandoImagem] = useState(false)
  const [gerarImagemErro, setGerarImagemErro] = useState<string | null>(null)
  const [gerarImagemOk, setGerarImagemOk] = useState(false)
  const [manualPickEdson, setManualPickEdson] = useState<string | null>(null)
  const [manualPickBispo, setManualPickBispo] = useState<string | null>(null)

  const settings = useMemo(() => {
    void dataRevision
    return loadSettings()
  }, [dataRevision])

  const finesDb = useMemo(() => {
    void dataRevision
    return loadDriverFinesDb()
  }, [dataRevision])

  const weeks = useMemo(() => getMonthIsoWeeks(month), [month])

  useEffect(() => {
    if (weeks.length > 0 && weekIdx >= weeks.length) setWeekIdx(weeks.length - 1)
  }, [weeks.length, weekIdx])

  const selected = weeks[weekIdx]

  const model = useMemo(() => {
    void dataRevision
    if (!selected) return null
    const entries = loadEntries()
    const byDate = new Map(entries.map((e) => [e.date, e]))
    const sunday = endOfIsoWeek(selected.monday)
    const edson = buildDriverWeek(selected.dates, byDate, 'edson', settings.valorViagemEdson, settings)
    const bispo = buildDriverWeek(selected.dates, byDate, 'bispo', settings.valorViagemBispo, settings)
    const totalGeral = Math.round((edson.totalValor + bispo.totalValor) * 100) / 100
    const morroSemanal = roundMoney(Math.max(0, Number(settings.despesaMorro) || 0))
    const periodLabel = formatWeekPeriodLabel(selected.monday, sunday)
    const fileRange = formatWeekRangeForFilename(selected.monday, sunday)
    return { sunday, edson, bispo, totalGeral, morroSemanal, periodLabel, fileRange }
  }, [selected, settings, dataRevision])

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    if (!y || !m) return month
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [month])

  const weekMondayIso = selected ? isoDateFromLocalDate(selected.monday) : ''

  useEffect(() => {
    if (!weekMondayIso) return
    const es = listRepasseSelectableFines(finesDb, weekMondayIso, 'edson')
    const bs = listRepasseSelectableFines(finesDb, weekMondayIso, 'bispo')
    let e = getRepasseManualFinePick(weekMondayIso, 'edson')
    let b = getRepasseManualFinePick(weekMondayIso, 'bispo')
    if (e && !es.some((x) => x.id === e)) {
      e = null
      setRepasseManualFinePick(weekMondayIso, 'edson', null)
    }
    if (b && !bs.some((x) => x.id === b)) {
      b = null
      setRepasseManualFinePick(weekMondayIso, 'bispo', null)
    }
    setManualPickEdson(e)
    setManualPickBispo(b)
  }, [weekMondayIso, dataRevision, finesDb])

  const repassePicks = useMemo(
    () => ({ edson: manualPickEdson, bispo: manualPickBispo }),
    [manualPickEdson, manualPickBispo],
  )

  const edsonSelectable = useMemo(
    () => (weekMondayIso ? listRepasseSelectableFines(finesDb, weekMondayIso, 'edson') : []),
    [finesDb, weekMondayIso],
  )
  const bispoSelectable = useMemo(
    () => (weekMondayIso ? listRepasseSelectableFines(finesDb, weekMondayIso, 'bispo') : []),
    [finesDb, weekMondayIso],
  )

  const edsonDiscounts = useMemo(
    () =>
      weekMondayIso ?
        buildRepasseDiscountLinesWithPick(finesDb, weekMondayIso, 'edson', manualPickEdson)
      : [],
    [finesDb, weekMondayIso, manualPickEdson],
  )
  const bispoDiscounts = useMemo(
    () =>
      weekMondayIso ?
        buildRepasseDiscountLinesWithPick(finesDb, weekMondayIso, 'bispo', manualPickBispo)
      : [],
    [finesDb, weekMondayIso, manualPickBispo],
  )

  const totaisRodape = useMemo(() => {
    if (!model) return null
    const edMult = roundMoney(edsonDiscounts.reduce((s, x) => s + x.valor, 0))
    const biMult = roundMoney(bispoDiscounts.reduce((s, x) => s + x.valor, 0))
    const morro = model.morroSemanal
    const liqEd = roundMoney(model.edson.totalValor - edMult)
    const liqBiSemMorro = roundMoney(model.bispo.totalValor - biMult)
    const liqBiComMorro = roundMoney(liqBiSemMorro + morro)
    return {
      totalBrutoViagens: model.totalGeral,
      totalLiquidoSemMorro: roundMoney(liqEd + liqBiSemMorro),
      totalLiquidoComMorro: roundMoney(liqEd + liqBiComMorro),
      morro,
    }
  }, [model, edsonDiscounts, bispoDiscounts])

  const weekHasPendingParcels = useMemo(() => {
    if (!weekMondayIso) return false
    return weekHasConfirmableDiscounts(finesDb, weekMondayIso, repassePicks)
  }, [finesDb, weekMondayIso, repassePicks])

  const weekHasDescontadas = useMemo(() => {
    if (!weekMondayIso) return false
    return weekHasRevertableDiscounts(finesDb, weekMondayIso, repassePicks)
  }, [finesDb, weekMondayIso, repassePicks])

  const onConfirmDiscounts = useCallback(() => {
    if (!weekMondayIso) return
    confirmRepasseWeekDiscounts(weekMondayIso, repassePicks)
    bumpData()
  }, [weekMondayIso, bumpData, repassePicks])

  const onRevertDiscounts = useCallback(() => {
    if (!weekMondayIso) return
    revertRepasseWeekDiscounts(weekMondayIso, repassePicks)
    bumpData()
  }, [weekMondayIso, bumpData, repassePicks])

  const onMonthChange = useCallback((v: string) => {
    setMonth(v)
    setWeekIdx(0)
  }, [])

  const onGerarImagem = useCallback(async () => {
    if (!model || !selected) return
    setGerarImagemErro(null)
    setGerarImagemOk(false)
    setGerandoImagem(true)
    try {
      const el = document.getElementById('repasse-print-area')
      if (!el) throw new Error('Área do repasse não encontrada na página.')
      const target = el as HTMLElement
      target.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      try {
        await document.fonts.ready
      } catch {
        /* ignore */
      }
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      const name = `repasse-motoristas-semana-${model.fileRange}.png`
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
      console.error('repasse: gerar imagem', e)
    } finally {
      setGerandoImagem(false)
    }
  }, [model, selected])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Repasse motoristas</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Contra-cheque semanal para Edson e Bispo com base nas viagens lançadas, valores por viagem
          e descontos de multas daquele motorista. Parcelas <strong>a confirmar</strong> só entram se a
          multa estiver <strong>ativa</strong>; parcelas já descontadas na semana continuam aparecendo
          mesmo após a multa ficar quitada. Use o select em cada motorista para escolher qual multa
          ativa descontar nesta semana (ou «Automático»).
        </p>
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

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <Field label="Mês" type="month" value={month} onChange={onMonthChange} />
        {weeks.length > 0 ? (
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Semana
            </span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm"
              value={weekIdx}
              onChange={(e) => setWeekIdx(Number(e.target.value))}
            >
              {weeks.map((w, i) => {
                const sun = endOfIsoWeek(w.monday)
                return (
                  <option key={w.monday.toISOString()} value={i}>
                    Semana {w.index} — {formatWeekPeriodLabel(w.monday, sun)}
                  </option>
                )
              })}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => void onGerarImagem()}
          disabled={!model || gerandoImagem}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {gerandoImagem ? 'Gerando imagem…' : 'Gerar imagem do repasse'}
        </button>
        {selected && weekMondayIso ? (
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <button
              type="button"
              disabled={!weekHasPendingParcels}
              onClick={onConfirmDiscounts}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar descontos da semana
            </button>
            <button
              type="button"
              disabled={!weekHasDescontadas}
              onClick={onRevertDiscounts}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Estornar descontos da semana
            </button>
          </div>
        ) : null}
      </div>

      {!selected || !model ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Sem dados para este mês.
        </div>
      ) : (
        <div
          id="repasse-print-area"
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none"
        >
          <header className="border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-bold text-slate-900">Repasse motoristas</h1>
            <p className="mt-1 text-lg font-semibold capitalize text-blue-900">{monthLabel}</p>
            <p className="text-base font-semibold text-slate-800">
              Semana {selected.index} — {model.periodLabel}
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <RepasseDriverBlock
              nome="Edson"
              valorPorViagem={settings.valorViagemEdson}
              semanaIndex={selected.index}
              periodo={model.periodLabel}
              data={model.edson}
              discountLines={edsonDiscounts}
              multaSelect={{
                value: manualPickEdson,
                options: edsonSelectable,
                onChange: (id) => {
                  setManualPickEdson(id)
                  if (weekMondayIso) setRepasseManualFinePick(weekMondayIso, 'edson', id)
                },
              }}
            />
            <RepasseDriverBlock
              nome="Bispo"
              valorPorViagem={settings.valorViagemBispo}
              semanaIndex={selected.index}
              periodo={model.periodLabel}
              data={model.bispo}
              discountLines={bispoDiscounts}
              morroSemanal={model.morroSemanal}
              multaSelect={{
                value: manualPickBispo,
                options: bispoSelectable,
                onChange: (id) => {
                  setManualPickBispo(id)
                  if (weekMondayIso) setRepasseManualFinePick(weekMondayIso, 'bispo', id)
                },
              }}
            />
          </div>

          <footer className="border-t border-slate-200 pt-4 text-sm text-slate-700">
            <p className="text-lg font-bold text-emerald-800">
              Total bruto (viagens): {formatBrl(model.totalGeral)}
            </p>
            {totaisRodape && totaisRodape.morro > 0 ? (
              <div className="mt-2 space-y-1 text-base text-slate-800">
                <p>
                  <span className="font-semibold text-slate-700">Total líquido sem Morro</span>{' '}
                  <span className="font-bold text-violet-950 tabular-nums">
                    {formatBrl(totaisRodape.totalLiquidoSemMorro)}
                  </span>
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    (Edson + Bispo, após multas)
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Total líquido com Morro</span>{' '}
                  <span className="font-bold text-emerald-900 tabular-nums">
                    {formatBrl(totaisRodape.totalLiquidoComMorro)}
                  </span>
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    (inclui despesa Morro ao Bispo: {formatBrl(totaisRodape.morro)})
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-2 text-base font-semibold text-slate-800">
                Total líquido (viagens − multas):{' '}
                <span className="font-bold text-violet-950 tabular-nums">
                  {totaisRodape ? formatBrl(totaisRodape.totalLiquidoSemMorro) : formatBrl(0)}
                </span>
              </p>
            )}
            <p className="mt-2 text-slate-500">
              Gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </footer>
        </div>
      )}
    </div>
  )
}

function RepasseDriverBlock(props: {
  nome: string
  valorPorViagem: number
  semanaIndex: number
  periodo: string
  data: {
    rows: DriverDayRow[]
    totalViagens: number
    totalValor: number
    domingoSePagou?: { date: string; viagens: number }
  }
  discountLines: RepasseDiscountLine[]
  /** Despesa fixa semanal Morro (R$), somada ao repasse do Bispo. */
  morroSemanal?: number
  multaSelect: {
    value: string | null
    options: { id: string; descricao: string; valorSemana: number }[]
    onChange: (fineId: string | null) => void
  }
}) {
  const { nome, valorPorViagem, semanaIndex, periodo, data, discountLines, morroSemanal = 0, multaSelect } =
    props
  const salarioBruto = data.totalValor
  const totalMultas = roundMoney(discountLines.reduce((s, x) => s + x.valor, 0))
  const repasseSemMorro = roundMoney(salarioBruto - totalMultas)
  const morro = roundMoney(Math.max(0, morroSemanal))
  const incluiMorroBispo = nome === 'Bispo' && morro > 0
  const repasseComMorro = incluiMorroBispo ? roundMoney(repasseSemMorro + morro) : repasseSemMorro
  const dsp = data.domingoSePagou
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-inner">
      <h2 className="text-xl font-bold text-violet-950">Motorista: {nome}</h2>
      <p className="text-sm font-medium text-violet-900">
        Semana {semanaIndex} — {periodo}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        Valor por viagem: <strong className="text-violet-950">{formatBrl(valorPorViagem)}</strong>
      </p>
      <p className="mt-1 text-sm text-slate-700">
        Total de viagens: <strong>{data.totalViagens}</strong>
        {dsp ? (
          <span className="mt-1 block text-xs font-normal text-amber-800">
            Domingo {formatShortData(dsp.date)}: {dsp.viagens}{' '}
            {dsp.viagens === 1 ? 'viagem não entra' : 'viagens não entram'} no repasse (quitou por
            conta).
          </span>
        ) : null}
      </p>
      <p className="text-sm text-slate-700">
        Salário bruto (viagens):{' '}
        <strong className="text-lg text-emerald-800">{formatBrl(salarioBruto)}</strong>
      </p>

      <div className="mt-3 rounded-lg border border-rose-100 bg-white/80 px-3 py-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-rose-900">
            Multa ativa a descontar (esta semana)
          </span>
          <select
            className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-2 py-2 text-sm font-medium text-slate-900 shadow-sm"
            value={multaSelect.value ?? ''}
            onChange={(e) => {
              const v = e.target.value
              multaSelect.onChange(v === '' ? null : v)
            }}
          >
            <option value="">Automático — todas as parcelas desta semana</option>
            {multaSelect.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.descricao} — {formatBrl(o.valorSemana)}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-xs font-semibold uppercase text-rose-900">Desconto multas</p>
        {discountLines.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">Nenhum desconto nesta semana.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {discountLines.map((line) => (
              <li key={line.parcelaId} className="flex flex-wrap justify-between gap-2">
                <span>
                  — {line.descricao}
                  {line.status === 'pendente' ?
                    <span className="ml-1 text-xs font-medium text-amber-700">(a confirmar)</span>
                  : null}
                  {line.status === 'descontada' ?
                    <span className="ml-1 text-xs font-medium text-emerald-700">(descontada)</span>
                  : null}
                </span>
                <span className="tabular-nums font-medium">{formatBrl(line.valor)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-rose-100 pt-2 text-sm font-semibold text-slate-900">
          Total descontos multa: {formatBrl(totalMultas)}
        </p>
        {incluiMorroBispo ? (
          <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Despesa fixa semanal — Morro
            </p>
            <p className="text-sm text-slate-800">
              Repasse <strong>sem</strong> Morro (viagens − multas):{' '}
              <strong className="tabular-nums text-violet-950">{formatBrl(repasseSemMorro)}</strong>
            </p>
            <p className="text-sm text-slate-800">
              Valor Morro (fixo / semana):{' '}
              <strong className="tabular-nums text-amber-950">+{formatBrl(morro)}</strong>
            </p>
            <p className="text-base font-bold text-violet-950">
              Total repasse <strong>com</strong> Morro:{' '}
              <span className="tabular-nums text-emerald-900">{formatBrl(repasseComMorro)}</span>
            </p>
          </div>
        ) : (
          <p className="mt-1 text-base font-bold text-violet-950">
            Salário líquido: {formatBrl(repasseSemMorro)}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Dia</th>
              <th className="px-3 py-2 text-right">Viagens</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  Nenhum dia com viagens nesta semana.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.date} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{formatShortData(r.date)}</td>
                  <td className="px-3 py-2 text-slate-700">{r.weekday}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">{r.viagens}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatBrl(r.valorDia)}
                  </td>
                </tr>
              ))
            )}
            {data.rows.length > 0 ? (
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{data.totalViagens}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBrl(data.totalValor)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
