import { NavLink } from 'react-router-dom'
import { downloadEntriesCsv } from '../lib/backup-actions'

const nav = [
  { to: '/lancamento-semanal', label: 'Lançamento Semanal' },
  { to: '/conferencia-semanal', label: 'Conferência semanal' },
  { to: '/repasse-motoristas', label: 'Repasse motoristas' },
  { to: '/multas-motoristas', label: 'Multas / descontos' },
  { to: '/resumo', label: 'Resumo mensal' },
  { to: '/config', label: 'Configurações' },
  { to: '/', label: 'Dashboard', end: true },
  { to: '/lancamento', label: 'Lançamento diário' },
] as const

function linkClass(active: boolean): string {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
    active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white',
  ].join(' ')
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg shadow-inner shadow-black/20">
          🚐
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Gerenciamento
          </p>
          <p className="text-lg font-bold leading-tight">Van</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={() => onNavigate?.()}
            className={({ isActive }) => linkClass(isActive)}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={() => downloadEntriesCsv()}
          className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-medium text-slate-100 hover:bg-white/10"
        >
          <span aria-hidden>⬇️</span>
          Exportar CSV
        </button>
        <NavLink
          to="/importar-csv"
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            [
              'flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-medium transition',
              isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-white/5 text-slate-100 hover:bg-white/10',
            ].join(' ')
          }
        >
          <span aria-hidden>⬆️</span>
          Importar CSV
        </NavLink>
        <div className="flex items-center gap-2 px-2 pt-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Dados salvos localmente
        </div>
      </div>
    </div>
  )
}
