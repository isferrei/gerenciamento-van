import { Link } from 'react-router-dom'
import { useAppShell } from '../context/app-shell-context'

const links = [
  { to: '/lancamento-semanal', label: 'Lançamento semanal' },
  { to: '/multas-motoristas', label: 'Multas / descontos' },
  { to: '/', label: 'Dashboard' },
  { to: '/lancamento', label: 'Lançamento diário' },
  { to: '/lista', label: 'Lançamentos' },
  { to: '/resumo', label: 'Resumo mensal' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/importar-csv', label: 'Importar CSV' },
  { to: '/config', label: 'Configurações' },
] as const

export function MaisSheet() {
  const { maisOpen, setMaisOpen } = useAppShell()

  if (!maisOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={() => setMaisOpen(false)}
      />
      <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <p className="mb-3 text-sm font-semibold text-slate-900">Mais opções</p>
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setMaisOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setMaisOpen(false)}
          className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
