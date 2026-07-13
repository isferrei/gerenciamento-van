import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppShell } from '../context/app-shell-context'
import { downloadEntriesCsv, importEntriesFromCsvText } from '../lib/backup-actions'
import { clearAllAppData } from '../lib/storage'
import { ConfirmDialog } from './confirm-dialog'

export function ShortcutsCard() {
  const { bumpData } = useAppShell()
  const inputRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const res = importEntriesFromCsvText(text)
    setMsg(res.message)
    if (res.ok) bumpData()
  }

  function onClearConfirm() {
    clearAllAppData()
    setClearOpen(false)
    bumpData()
    window.location.reload()
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Atalhos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Backup CSV (sem imagens) e manutenção dos dados locais.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => downloadEntriesCsv()}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Exportar CSV
          </button>
          <Link
            to="/importar-csv"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Importar corridas (CSV turnos)
          </Link>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Importar backup exportado
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onPick}
          />
          <Link
            to="/config"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Configurações completas
          </Link>
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Limpar todos os dados
          </button>
        </div>
        {msg ? <p className="mt-3 text-xs text-slate-600">{msg}</p> : null}
      </section>

      <ConfirmDialog
        open={clearOpen}
        title="Apagar todos os dados?"
        message="Isso remove lançamentos e configurações salvos neste navegador. Exporte um CSV antes se precisar de backup."
        confirmLabel="Apagar tudo"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={onClearConfirm}
      />
    </>
  )
}
