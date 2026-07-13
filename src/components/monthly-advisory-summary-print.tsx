import type { MonthlyStats } from '../lib/monthly-stats'
import { formatBrl } from '../lib/format'

export const MONTHLY_ADVISORY_SUMMARY_PRINT_ID = 'resumo-contabilidade-print-area'

const cellBorder = '1px solid #000000'
const fontFamily = 'Arial, Helvetica, sans-serif'

interface MonthlyAdvisorySummaryPrintProps {
  monthLabel: string
  stats: MonthlyStats
}

function formatCount(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export function MonthlyAdvisorySummaryPrint({ monthLabel, stats }: MonthlyAdvisorySummaryPrintProps) {
  return (
    <div
      id={MONTHLY_ADVISORY_SUMMARY_PRINT_ID}
      style={{
        width: 720,
        maxWidth: '100%',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        fontFamily,
        color: '#000000',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        <thead>
          <tr>
            <th
              colSpan={2}
              style={{
                border: cellBorder,
                padding: '14px 16px',
                textAlign: 'center',
                backgroundColor: '#d9e2f3',
                fontSize: 26,
              }}
            >
              {monthLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          <MetricRow label="Total de bilhetes" value={formatCount(stats.totalValesQtd)} valueBlue />
          <MetricRow
            label="Total de quilometragem"
            value={formatCount(stats.totalKmPercorrido)}
            valueBlue
          />
          <MetricRow label="Total Viagens" value={formatCount(stats.totalViagensGeral)} valueBlue />
          <MetricRow label="Dias trabalhados" value={formatCount(stats.diasTrabalhados)} valueBlue />
          <MetricRow label="Lucro liquido Total" value={formatBrl(stats.lucroLiquidoTotal)} />
          <MetricRow label="Gasto com combustível" value={formatBrl(stats.gastoCombustivel)} />
          <tr>
            <td
              style={{
                border: cellBorder,
                padding: '12px 16px',
                backgroundColor: '#ff9900',
                width: '55%',
              }}
            >
              Troca de Oleo KM
            </td>
            <td
              style={{
                border: cellBorder,
                padding: '12px 16px',
                textAlign: 'center',
                backgroundColor: '#ff9900',
              }}
            >
              {formatCount(stats.kmProximaTrocaOleo)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MetricRow(props: { label: string; value: string; valueBlue?: boolean }) {
  const { label, value, valueBlue } = props
  return (
    <tr>
      <td
        style={{
          border: cellBorder,
          padding: '12px 16px',
          width: '55%',
          verticalAlign: 'middle',
        }}
      >
        {label}
      </td>
      <td
        style={{
          border: cellBorder,
          padding: '12px 16px',
          textAlign: 'center',
          verticalAlign: 'middle',
          color: valueBlue ? '#0000ff' : '#000000',
        }}
      >
        {value}
      </td>
    </tr>
  )
}
