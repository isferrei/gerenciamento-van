import { Link, useLocation } from 'react-router-dom'
import { useAppShell } from '../context/app-shell-context'
import { currentYearMonth } from '../lib/dates'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/lancamento-semanal': 'Lançamento semanal',
  '/lancamento': 'Lançamento diário',
  '/lista': 'Lançamentos',
  '/resumo': 'Resumo mensal',
  '/conferencia-semanal': 'Conferência semanal',
  '/repasse-motoristas': 'Repasse motoristas',
  '/multas-motoristas': 'Multas / descontos',
  '/pagamento-semanal': 'Repasse motoristas',
  '/relatorios': 'Relatórios',
  '/importar-csv': 'Importar CSV',
  '/config': 'Configurações',
}

export function AppTopBar() {
  const { pathname } = useLocation()
  const { month, setMonth, setSidebarOpen } = useAppShell()
  const title = titles[pathname] ?? 'Gerenciamento Van'
  const showMonthPicker = pathname === '/'

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden"
          aria-label="Abrir menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {showMonthPicker ? (
          <label className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Mês
            </span>
            <input
              type="month"
              value={month || currentYearMonth()}
              onChange={(e) => setMonth(e.target.value)}
              className="max-w-[14rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
            />
          </label>
        ) : (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Van</p>
            <p className="truncate text-lg font-semibold text-slate-900">{title}</p>
          </div>
        )}
      </div>
      <Link
        to="/lancamento"
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700"
      >
        + Novo lançamento
      </Link>
    </header>
  )
}
