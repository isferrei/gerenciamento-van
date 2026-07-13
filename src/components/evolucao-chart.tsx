import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyEntry } from '../types'
import { formatBrDate } from '../lib/dates'

interface EvolucaoChartProps {
  entries: DailyEntry[]
}

export function EvolucaoChart({ entries }: EvolucaoChartProps) {
  const data = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      label: formatBrDate(e.date),
      km: e.km,
      lucro: e.lucroLiquido,
    }))

  if (data.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
        Sem lançamentos neste mês para exibir o gráfico.
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Evolução do mês</h2>
      <div className="h-72 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis
              yAxisId="km"
              orientation="left"
              tick={{ fontSize: 11 }}
              stroke="#2563eb"
              width={44}
            />
            <YAxis
              yAxisId="lucro"
              orientation="right"
              tick={{ fontSize: 11 }}
              stroke="#059669"
              width={52}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              formatter={(value, name) => {
                const v = Number(value ?? 0)
                const label = String(name)
                return [
                  label === 'km'
                    ? `${v.toLocaleString('pt-BR')} km`
                    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                  label === 'km' ? 'KM (painel)' : 'Lucro líquido',
                ]
              }}
            />
            <Legend />
            <Line
              yAxisId="km"
              type="monotone"
              dataKey="km"
              name="km"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="lucro"
              type="monotone"
              dataKey="lucro"
              name="lucro"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500">
        Linha azul: odômetro registrado no dia. Linha verde: lucro líquido calculado no dia.
      </p>
    </section>
  )
}
