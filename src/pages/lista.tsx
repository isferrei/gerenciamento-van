import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteEntryById, loadEntries } from '../lib/storage'
import { entriesToCsv } from '../lib/csv'
import { formatBrl } from '../lib/format'
import { formatBrDate } from '../lib/dates'
import { ConfirmDialog } from '../components/confirm-dialog'

export function ListaPage() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const entries = useMemo(() => {
    void version
    return loadEntries().sort((a, b) => b.date.localeCompare(a.date))
  }, [version])

  function refresh() {
    setVersion((v) => v + 1)
  }

  function onExport() {
    const blob = new Blob([entriesToCsv(loadEntries())], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lancamentos-van-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function confirmDelete() {
    if (!removeId) return
    deleteEntryById(removeId)
    setRemoveId(null)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lançamentos</h2>
          <p className="text-sm text-slate-600">Todos os dias registrados, do mais recente ao mais antigo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => navigate('/lancamento')}
            className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Novo lançamento
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Nenhum lançamento ainda. Comece pelo formulário de lançamento diário.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <article
              key={e.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">{formatBrDate(e.date)}</p>
                  <p className="text-sm text-slate-600">
                    KM {e.km.toLocaleString('pt-BR')} · Vales {e.valeTransQtd} · Edson {e.viagensEdson}{' '}
                    / Bispo {e.viagensBispo} viagens · Lucro {formatBrl(e.lucroLiquido)}
                  </p>
                  {e.observacoes ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">{e.observacoes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/lancamento?date=${e.date}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-sky-700"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRemoveId(e.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={removeId !== null}
        title="Excluir lançamento?"
        message="Esta ação não pode ser desfeita. Os dados deste dia serão removidos do armazenamento local."
        confirmLabel="Excluir"
        danger
        onCancel={() => setRemoveId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
