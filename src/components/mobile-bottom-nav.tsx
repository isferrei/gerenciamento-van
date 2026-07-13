import { NavLink } from 'react-router-dom'
import { useAppShell } from '../context/app-shell-context'

function itemClass(active: boolean): string {
  return [
    'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold',
    active ? 'text-blue-600' : 'text-slate-500',
  ].join(' ')
}

export function MobileBottomNav() {
  const { setMaisOpen } = useAppShell()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <NavLink to="/lancamento-semanal" className={({ isActive }) => itemClass(isActive)}>
        <span className="text-lg" aria-hidden>
          📅
        </span>
        Semanal
      </NavLink>
      <NavLink to="/conferencia-semanal" className={({ isActive }) => itemClass(isActive)}>
        <span className="text-lg" aria-hidden>
          ✓
        </span>
        Conferência
      </NavLink>
      <NavLink to="/repasse-motoristas" className={({ isActive }) => itemClass(isActive)}>
        <span className="text-lg" aria-hidden>
          R$
        </span>
        Repasse
      </NavLink>
      <button type="button" onClick={() => setMaisOpen(true)} className={itemClass(false)}>
        <span className="text-lg" aria-hidden>
          ···
        </span>
        Mais
      </button>
    </nav>
  )
}
