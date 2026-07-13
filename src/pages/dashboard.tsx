import { useMemo } from 'react'
import { loadEntries, loadSettings } from '../lib/storage'
import { computeMonthlyStats, filterEntriesByMonth } from '../lib/monthly-stats'
import { todayIso } from '../lib/dates'
import { useAppShell } from '../context/app-shell-context'
import { MonthKpiGrid } from '../components/month-kpi-grid'
import { LancamentoForm } from '../components/lancamento-form'
import { WeeklyPaymentBlock } from '../components/weekly-payment-block'
import { EvolucaoChart } from '../components/evolucao-chart'
import { RecentEntriesTable } from '../components/recent-entries-table'
import { ShortcutsCard } from '../components/shortcuts-card'

export function DashboardPage() {
  const { month, dataRevision, bumpData } = useAppShell()

  const allEntries = useMemo(() => {
    void dataRevision
    return loadEntries()
  }, [dataRevision])

  const settings = useMemo(() => {
    void dataRevision
    return loadSettings()
  }, [dataRevision])

  const inMonth = useMemo(
    () => filterEntriesByMonth(allEntries, month),
    [allEntries, month],
  )

  const stats = useMemo(
    () => computeMonthlyStats(inMonth, settings, allEntries),
    [inMonth, settings, allEntries],
  )

  return (
    <div className="space-y-10">
      <MonthKpiGrid stats={stats} />

      <div className="grid gap-8 xl:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          <LancamentoForm
            key={`dash-${dataRevision}`}
            seedDate={todayIso()}
            variant="embedded"
            navigateAfterSave={false}
            onSaved={bumpData}
          />
          <WeeklyPaymentBlock entries={allEntries} month={month} />
          <EvolucaoChart entries={inMonth} />
          <RecentEntriesTable entries={allEntries} />
        </div>
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <ShortcutsCard />
        </div>
      </div>
    </div>
  )
}
