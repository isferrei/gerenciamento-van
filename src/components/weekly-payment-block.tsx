import { Link } from 'react-router-dom'
import { formatBrl } from '../lib/format'
import { groupPagamentoSemanal } from '../lib/pagamento-semanal'
import type { DailyEntry } from '../types'

interface WeeklyPaymentBlockProps {
  entries: DailyEntry[]
  month: string
}

export function WeeklyPaymentBlock({ entries, month }: WeeklyPaymentBlockProps) {
  const weeks = groupPagamentoSemanal(entries, month)

  if (weeks.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Repasse na semana</h2>
          <Link
            to="/repasse-motoristas"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Ver contra-cheque
          </Link>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Sem lançamentos neste mês para agrupar pagamentos.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Repasse na semana</h2>
        <Link
          to="/repasse-motoristas"
          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          Ver contra-cheque
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-3">Semana</th>
              <th className="px-3 py-3">Período</th>
              <th className="px-3 py-3">Viagens Edson</th>
              <th className="px-3 py-3">Pagar Edson</th>
              <th className="px-3 py-3">Viagens Bispo</th>
              <th className="px-3 py-3">Pagar Bispo</th>
              <th className="px-3 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={w.weekKey} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5 font-medium text-slate-900">{i + 1}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-800">{w.label}</td>
                <td className="px-3 py-2.5 text-slate-800">{w.viagensEdson}</td>
                <td className="px-3 py-2.5 text-slate-800">{formatBrl(w.pagarEdson)}</td>
                <td className="px-3 py-2.5 text-slate-800">{w.viagensBispo}</td>
                <td className="px-3 py-2.5 text-slate-800">{formatBrl(w.pagarBispo)}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">{formatBrl(w.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
