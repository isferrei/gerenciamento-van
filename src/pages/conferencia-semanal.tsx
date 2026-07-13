import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadEntries, loadSettings } from '../lib/storage'
import { totalWeeklyFixedExpenses } from '../lib/entry-calcs'
import { endOfIsoWeek, formatBrDate, weekdayLongPt, currentYearMonth } from '../lib/dates'
import { formatBrl, formatKmForInput } from '../lib/format'
import { Field } from '../components/field'
import { useAppShell } from '../context/app-shell-context'
import { getMonthIsoWeeks, isoDateFromLocalDate } from '../lib/weeks-in-month'
import { computeConferenciaDayStatus, getPrevDayKm } from '../lib/conferencia-status'

function statusBadgeClass(level: 'ok' | 'warn' | 'error'): string {
  if (level === 'ok') return 'bg-emerald-100 text-emerald-900 ring-emerald-200'
  if (level === 'warn') return 'bg-amber-100 text-amber-950 ring-amber-200'
  return 'bg-red-100 text-red-900 ring-red-200'
}

export function ConferenciaSemanalPage() {
  const { dataRevision } = useAppShell()
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(currentYearMonth())

  const mesParam = searchParams.get('mes')
  const destaque = searchParams.get('destaque')
  const showSaveToast = searchParams.get('toast') === 'semana'

  useEffect(() => {
    if (!(showSaveToast || destaque)) return
    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) setMonth(mesParam)
  }, [showSaveToast, destaque, mesParam])

  useEffect(() => {
    if (!showSaveToast) return
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('toast')
      setSearchParams(next, { replace: true })
    }, 4500)
    return () => window.clearTimeout(id)
  }, [showSaveToast, searchParams, setSearchParams])

  const weeksModel = useMemo(() => {
    void dataRevision
    const entries = loadEntries()
    const settings = loadSettings()
    const despesasFixasSemana = totalWeeklyFixedExpenses(settings)
    const byDate = new Map(entries.map((e) => [e.date, e]))
    const slices = getMonthIsoWeeks(month)

    return slices.map((slice) => {
      const sunday = endOfIsoWeek(slice.monday)
      let diasPreenchidos = 0
      let totalValesQtd = 0
      let valorVales = 0
      let combustivel = 0
      let lucro = 0
      let salEdson = 0
      let salBispo = 0
      let repasse = 0

      const rows = slice.dates.map((date) => {
        const entry = byDate.get(date)
        if (entry) {
          diasPreenchidos += 1
          totalValesQtd += entry.valeTransQtd
          valorVales += entry.valeTransValor
          combustivel += entry.combustivel
          lucro += entry.lucroLiquido
          salEdson += entry.salarioEdson
          salBispo += entry.salarioBispo
          repasse += entry.salarioTotal
        }
        const prevKm = getPrevDayKm(byDate, date)
        const st = computeConferenciaDayStatus({ date, entry, prevDayKm: prevKm })
        return { date, entry, status: st }
      })

      const lucroSomaDias = Math.round(lucro * 100) / 100
      const lucroLiquidoSemanal = Math.round((lucroSomaDias - despesasFixasSemana) * 100) / 100

      return {
        slice,
        sunday,
        diasPreenchidos,
        totalValesQtd,
        valorVales: Math.round(valorVales * 100) / 100,
        combustivel: Math.round(combustivel * 100) / 100,
        lucro: lucroLiquidoSemanal,
        despesasSemanaisFixas: despesasFixasSemana,
        salEdson: Math.round(salEdson * 100) / 100,
        salBispo: Math.round(salBispo * 100) / 100,
        repasse: Math.round(repasse * 100) / 100,
        rows,
      }
    })
  }, [month, dataRevision])

  const monthTitle = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    if (!y || !m) return month
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [month])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Conferência semanal</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Revise cada semana e cada dia antes do repasse. Status em verde (completo), amarelo
          (conferir) ou vermelho (possível erro).
        </p>
      </div>

      <Field label="Mês" type="month" value={month} onChange={setMonth} />

      {showSaveToast ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-sm"
        >
          Semana atualizada com sucesso
        </div>
      ) : null}

      <p className="text-lg font-semibold capitalize text-slate-800">{monthTitle}</p>

      {weeksModel.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Nenhuma semana neste mês.
        </div>
      ) : (
        <div className="space-y-5">
          {weeksModel.map((w) => {
            const mondayKey = isoDateFromLocalDate(w.slice.monday)
            const isHighlighted = Boolean(destaque) && destaque === mondayKey
            const editSemanaHref = `/lancamento-semanal?mes=${encodeURIComponent(month)}&semana=${w.slice.index}&retorno=conferencia`
            return (
            <section
              key={mondayKey}
              className={[
                'overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow',
                isHighlighted
                  ? 'border-blue-400 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-100'
                  : 'border-slate-200',
              ].join(' ')}
            >
              <header className="border-b border-slate-100 bg-slate-50/90 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Semana {w.slice.index}
                      </p>
                      {isHighlighted ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                          Em edição
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {w.slice.monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                      a {w.sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </h3>
                  </div>
                  <Link
                    to={editSemanaHref}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-700 active:bg-blue-800"
                  >
                    <span aria-hidden>✏️</span>
                    Editar semana
                  </Link>
                </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-8">
                    <div>
                      <dt className="text-slate-500">Dias preenchidos</dt>
                      <dd className="font-semibold text-slate-900">{w.diasPreenchidos} / 7</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Total vales</dt>
                      <dd className="font-semibold text-blue-900">
                        {w.totalValesQtd} · {formatBrl(w.valorVales)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Combustível</dt>
                      <dd className="font-semibold text-red-800">{formatBrl(w.combustivel)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Despesas semanais fixas</dt>
                      <dd className="font-semibold text-amber-900">{formatBrl(w.despesasSemanaisFixas)}</dd>
                      <dd className="text-[10px] leading-snug text-slate-500">APTRAN + Morro + Fiscal</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Lucro líquido</dt>
                      <dd className="font-semibold text-emerald-800">{formatBrl(w.lucro)}</dd>
                      <dd className="text-[10px] leading-snug text-slate-500" title="Soma dos dias menos despesas fixas semanais">
                        Após salários e despesas fixas
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Salário Edson</dt>
                      <dd className="font-semibold text-violet-900">{formatBrl(w.salEdson)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Salário Bispo</dt>
                      <dd className="font-semibold text-violet-900">{formatBrl(w.salBispo)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Repasse motoristas</dt>
                      <dd className="font-semibold text-violet-950">{formatBrl(w.repasse)}</dd>
                    </div>
                  </dl>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-3">Data</th>
                      <th className="whitespace-nowrap px-3 py-3">Dia</th>
                      <th className="whitespace-nowrap px-3 py-3">KM</th>
                      <th className="whitespace-nowrap px-3 py-3">Vales qtd</th>
                      <th className="whitespace-nowrap px-3 py-3">Valor vales</th>
                      <th className="whitespace-nowrap px-3 py-3">Combustível</th>
                      <th className="whitespace-nowrap px-3 py-3">Edson viagens</th>
                      <th className="whitespace-nowrap px-3 py-3">Bispo viagens</th>
                      <th className="whitespace-nowrap px-3 py-3">Total salários</th>
                      <th className="whitespace-nowrap px-3 py-3">Lucro líquido</th>
                      <th className="whitespace-nowrap px-3 py-3">Status</th>
                      <th className="sticky right-0 whitespace-nowrap bg-slate-50 px-3 py-3 text-center shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.rows.map(({ date, entry, status }) => (
                      <tr key={date} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">
                          {formatBrDate(date)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                          {weekdayLongPt(date)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? (entry.km === 0 ? '—' : formatKmForInput(entry.km)) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? entry.valeTransQtd : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? formatBrl(entry.valeTransValor) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? formatBrl(entry.combustivel) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? entry.viagensEdson : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? entry.viagensBispo : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? formatBrl(entry.salarioTotal) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                          {entry ? formatBrl(entry.lucroLiquido) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex max-w-[220px] flex-col gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(status.level)}`}
                            title={status.messages.join(' · ')}
                          >
                            {status.label}
                            {status.messages.length > 0 ? (
                              <span className="font-normal opacity-90">{status.messages[0]}</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="sticky right-0 bg-white px-3 py-2.5 text-center shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)]">
                          <Link
                            to={`/lancamento?date=${encodeURIComponent(date)}`}
                            className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                          >
                            Editar dia
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
