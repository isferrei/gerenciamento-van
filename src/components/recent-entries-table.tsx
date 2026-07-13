import { Link } from 'react-router-dom'
import type { DailyEntry } from '../types'
import { formatBrl } from '../lib/format'
import { formatBrDate } from '../lib/dates'

interface RecentEntriesTableProps {
  entries: DailyEntry[]
  maxRows?: number
}

export function RecentEntriesTable({ entries, maxRows = 8 }: RecentEntriesTableProps) {
  const rows = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxRows)

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
        Nenhum lançamento registrado ainda.
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Últimos lançamentos</h2>
        <Link to="/lista" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Ver todos
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">KM</th>
              <th className="px-3 py-3">Vales</th>
              <th className="px-3 py-3">R$ vales</th>
              <th className="px-3 py-3">Comb.</th>
              <th className="px-3 py-3">Viag. E</th>
              <th className="px-3 py-3">Viag. B</th>
              <th className="px-3 py-3">Salário dia</th>
              <th className="px-3 py-3">Lucro</th>
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900">
                  {formatBrDate(e.date)}
                </td>
                <td className="px-3 py-2.5 text-slate-800">{e.km.toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2.5 text-slate-800">{e.valeTransQtd}</td>
                <td className="px-3 py-2.5 text-slate-800">{formatBrl(e.valeTransValor)}</td>
                <td className="px-3 py-2.5 text-slate-800">{formatBrl(e.combustivel)}</td>
                <td className="px-3 py-2.5 text-slate-800">{e.viagensEdson}</td>
                <td className="px-3 py-2.5 text-slate-800">{e.viagensBispo}</td>
                <td className="px-3 py-2.5 text-slate-800">{formatBrl(e.salarioTotal)}</td>
                <td className="px-3 py-2.5 font-medium text-emerald-700">{formatBrl(e.lucroLiquido)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    to={`/lancamento?date=${e.date}`}
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
