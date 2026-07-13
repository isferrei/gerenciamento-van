import type { ReactNode } from 'react'
import type { MonthlyStats } from '../lib/monthly-stats'
import { formatBrl } from '../lib/format'

interface MonthKpiGridProps {
  stats: MonthlyStats
}

interface KpiTone {
  accent: string
  border: string
  valueClass: string
  iconWrap: string
}

const toneLucro: KpiTone = {
  accent: 'from-emerald-500/15 to-emerald-600/5',
  border: 'border-emerald-200',
  valueClass: 'text-emerald-700',
  iconWrap: 'bg-emerald-100 text-emerald-700',
}

const toneVales: KpiTone = {
  accent: 'from-blue-500/15 to-blue-600/5',
  border: 'border-blue-200',
  valueClass: 'text-blue-800',
  iconWrap: 'bg-blue-100 text-blue-700',
}

const toneComb: KpiTone = {
  accent: 'from-red-500/12 to-red-600/5',
  border: 'border-red-200',
  valueClass: 'text-red-700',
  iconWrap: 'bg-red-100 text-red-700',
}

const toneKm: KpiTone = {
  accent: 'from-slate-400/10 to-slate-500/5',
  border: 'border-slate-200',
  valueClass: 'text-slate-800',
  iconWrap: 'bg-slate-100 text-slate-700',
}

const toneSecondary: KpiTone = {
  accent: 'from-slate-300/8 to-transparent',
  border: 'border-slate-200/90',
  valueClass: 'text-slate-800',
  iconWrap: 'bg-slate-100 text-slate-600',
}

const toneAmber: KpiTone = {
  accent: 'from-amber-400/12 to-amber-500/5',
  border: 'border-amber-200',
  valueClass: 'text-amber-900',
  iconWrap: 'bg-amber-100 text-amber-800',
}

export function MonthKpiGrid({ stats }: MonthKpiGridProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight text-slate-500">Resumo do mês</h2>

      <div className="grid gap-3 md:grid-cols-12">
        <LargeKpi
          className="md:col-span-3"
          title="Lucro líquido total"
          value={formatBrl(stats.lucroLiquidoTotal)}
          tone={toneLucro}
          icon={IconTrending}
        />
        <LargeKpi
          className="md:col-span-3"
          title="Valor total dos vales"
          value={formatBrl(stats.valorTotalVales)}
          tone={toneVales}
          icon={IconMoney}
        />
        <LargeKpi
          className="md:col-span-3"
          title="Combustível"
          value={formatBrl(stats.gastoCombustivel)}
          tone={toneComb}
          icon={IconFuel}
        />
        <SmallKpi
          className="md:col-span-3"
          title="Quilometragem no mês"
          value={`${stats.totalKmPercorrido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km`}
          tone={toneKm}
          icon={IconRoad}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <SmallKpi
          title="Total de vales (qtd)"
          value={stats.totalValesQtd.toLocaleString('pt-BR')}
          tone={toneVales}
          icon={IconTicket}
        />
        <SmallKpi
          title="Dias trabalhados"
          value={`${stats.diasTrabalhados} dias`}
          tone={toneSecondary}
          icon={IconCalendar}
        />
        <SmallKpi
          title="Outras despesas"
          value={formatBrl(stats.outrasDespesas)}
          tone={toneAmber}
          icon={IconDoc}
        />
        <SmallKpi
          title="Troca de óleo / próximo KM"
          value={`${stats.kmProximaTrocaOleo.toLocaleString('pt-BR')} km`}
          sub={`Faltam ${stats.kmRestantesOleo.toLocaleString('pt-BR')} km · odôm. ${stats.odometroReferencia.toLocaleString('pt-BR')}`}
          tone={toneAmber}
          icon={IconOil}
        />
      </div>
    </section>
  )
}

function LargeKpi(props: {
  title: string
  value: string
  sub?: string
  tone: KpiTone
  icon: () => ReactNode
  className?: string
}) {
  const { title, value, sub, tone, icon: Icon, className } = props
  return (
    <article
      className={[
        'relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-sm',
        tone.border,
        tone.accent,
        'from-white to-transparent',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${tone.valueClass}`}>
            {value}
          </p>
          {sub ? <p className="mt-2 text-xs leading-snug text-slate-600">{sub}</p> : null}
        </div>
        <span className={`shrink-0 rounded-xl p-2.5 ${tone.iconWrap}`}>
          <Icon />
        </span>
      </div>
    </article>
  )
}

function SmallKpi(props: {
  title: string
  value: string
  sub?: string
  tone: KpiTone
  icon: () => ReactNode
  className?: string
}) {
  const { title, value, sub, tone, icon: Icon, className } = props
  return (
    <article
      className={[
        'rounded-xl border bg-white/90 p-3.5 shadow-sm',
        tone.border,
        className ?? '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-1.5 text-base font-semibold leading-tight sm:text-lg ${tone.valueClass}`}>
            {value}
          </p>
          {sub ? <p className="mt-1 text-[11px] leading-snug text-slate-600">{sub}</p> : null}
        </div>
        <span className={`shrink-0 rounded-lg p-1.5 ${tone.iconWrap}`}>
          <Icon />
        </span>
      </div>
    </article>
  )
}

function IconTicket() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={2}
        d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 100 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 100-4V7a2 2 0 012-2z"
      />
    </svg>
  )
}

function IconRoad() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" d="M4 17l2-10h12l2 10M9 17h6" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} d="M8 7V5m8 2V5M5 11h14M5 7h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z" />
    </svg>
  )
}

function IconMoney() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} d="M12 8c-2 0-4 1-4 3s2 3 4 3 4 1 4 3-2 3-4 3m0-12v2m0 12v2M5 12h14" />
    </svg>
  )
}

function IconFuel() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} d="M4 19h14V8H4v11zM6 8V5h10v3M9 12h4M15 8v6a2 2 0 004 0V9h-2" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} d="M9 12h6m-6 4h6M7 7h6l4 4v8a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" />
    </svg>
  )
}

function IconOil() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
  )
}

function IconTrending() {
  return (
    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-8" />
    </svg>
  )
}
