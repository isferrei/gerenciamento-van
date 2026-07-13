import { useCallback, useMemo, useState, type FormEvent } from 'react'
import type { DriverFineMotoristaId, DriverFineRecord, FineRecordStatus } from '../lib/driver-fines-types'
import {
  createFine,
  updateFine,
  cancelFine,
  payNextParcelForFine,
  loadDriverFinesDb,
  revertParcelToPending,
  setFineQuitadaManual,
  setFineAtivaManual,
  type CreateFineInput,
} from '../lib/driver-fines-storage'
import { currentWeekMondayIso, motoristaLabel, saldoRestanteFine } from '../lib/driver-fines-logic'
import { formatBrDate } from '../lib/dates'
import { formatBrl, parseDecimal } from '../lib/format'
import { Field } from '../components/field'
import { ConfirmDialog } from '../components/confirm-dialog'
import { useAppShell } from '../context/app-shell-context'
import type { DriverFinesDb } from '../lib/driver-fines-types'

function statusLabelFine(f: DriverFineRecord): string {
  if (f.status === 'ativa') {
    if (f.ativaManual) return 'Ativa (reaberta)'
    return 'Ativa'
  }
  if (f.status === 'quitada') return f.quitadaManual ? 'Quitada (manual)' : 'Quitada'
  return 'Cancelada'
}

function statusClass(s: FineRecordStatus): string {
  if (s === 'ativa') return 'bg-amber-100 text-amber-950 ring-amber-200'
  if (s === 'quitada') return 'bg-emerald-100 text-emerald-900 ring-emerald-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

export function MultasMotoristasPage() {
  const { bumpData, dataRevision } = useAppShell()
  const weekMon = useMemo(() => currentWeekMondayIso(), [])

  const db = useMemo(() => {
    void dataRevision
    return loadDriverFinesDb()
  }, [dataRevision])

  const [motoristaFilter, setMotoristaFilter] = useState<'' | DriverFineMotoristaId>('')
  const [statusFilter, setStatusFilter] = useState<'' | FineRecordStatus>('')
  const [monthFilter, setMonthFilter] = useState('')
  const [ativasOnly, setAtivasOnly] = useState(false)
  const [quitadasOnly, setQuitadasOnly] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DriverFineRecord | null>(null)
  const [historyFineId, setHistoryFineId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [revertParcelId, setRevertParcelId] = useState<string | null>(null)
  const [quitadaManualConfirm, setQuitadaManualConfirm] = useState<{ id: string; enable: boolean } | null>(
    null,
  )
  const [ativaManualConfirm, setAtivaManualConfirm] = useState<{ id: string; enable: boolean } | null>(
    null,
  )

  const filtered = useMemo(() => {
    let rows = [...db.fines]
    if (motoristaFilter) rows = rows.filter((f) => f.motoristaId === motoristaFilter)
    if (statusFilter) rows = rows.filter((f) => f.status === statusFilter)
    if (monthFilter) rows = rows.filter((f) => f.dataMulta.startsWith(monthFilter))
    if (ativasOnly) rows = rows.filter((f) => f.status === 'ativa')
    if (quitadasOnly) rows = rows.filter((f) => f.status === 'quitada')
    rows.sort((a, b) => b.dataMulta.localeCompare(a.dataMulta) || b.createdAt.localeCompare(a.createdAt))
    return rows
  }, [db.fines, motoristaFilter, statusFilter, monthFilter, ativasOnly, quitadasOnly])

  const totalsByDriver = useMemo(() => {
    const active = db.fines.filter((f) => f.status === 'ativa')
    let edson = 0
    let bispo = 0
    for (const f of active) {
      const saldo = saldoRestanteFine(f, db.installments)
      if (f.motoristaId === 'edson') edson += saldo
      else bispo += saldo
    }
    return {
      edson: Math.round(edson * 100) / 100,
      bispo: Math.round(bispo * 100) / 100,
    }
  }, [db])

  const dueThisWeekIds = useMemo(() => {
    const activeFineIds = new Set(db.fines.filter((x) => x.status === 'ativa').map((x) => x.id))
    const ids = new Set<string>()
    for (const p of db.installments) {
      if (p.status !== 'pendente') continue
      if (p.semanaReferencia !== weekMon) continue
      if (!activeFineIds.has(p.multaId)) continue
      ids.add(p.multaId)
    }
    return ids
  }, [db.fines, db.installments, weekMon])

  const refresh = useCallback(() => bumpData(), [bumpData])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Multas / Descontos de Motoristas
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Controle parcelado semanal no contra-cheque. Descontos confirmados em «Repasse motoristas»
          marcam as parcelas como descontadas. Descontos <strong>a confirmar</strong> no repasse só
          valem para multa <strong>ativa</strong>; use «Reabrir multa» se precisar voltar a confirmar
          após quitada.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-violet-900">Saldo ativo — Edson</p>
          <p className="mt-1 text-lg font-bold text-violet-950">{formatBrl(totalsByDriver.edson)}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-violet-900">Saldo ativo — Bispo</p>
          <p className="mt-1 text-lg font-bold text-violet-950">{formatBrl(totalsByDriver.bispo)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-amber-900">Semana atual</p>
          <p className="mt-1 text-sm text-amber-950">
            Parcelas com desconto nesta semana (segunda {formatBrDate(weekMon)}):{' '}
            <strong>{dueThisWeekIds.size}</strong> multa(s) com parcela pendente.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase text-slate-600">Motorista</span>
          <select
            value={motoristaFilter}
            onChange={(e) => setMotoristaFilter(e.target.value as '' | DriverFineMotoristaId)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="edson">Edson</option>
            <option value="bispo">Bispo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase text-slate-600">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | FineRecordStatus)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="ativa">Ativa</option>
            <option value="quitada">Quitada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase text-slate-600">Mês (data da multa)</span>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={ativasOnly}
            onChange={(e) => {
              setAtivasOnly(e.target.checked)
              if (e.target.checked) setQuitadasOnly(false)
            }}
          />
          Só ativas
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={quitadasOnly}
            onChange={(e) => {
              setQuitadasOnly(e.target.checked)
              if (e.target.checked) setAtivasOnly(false)
            }}
          />
          Só quitadas
        </label>
        <button
          type="button"
          onClick={() => {
            setMotoristaFilter('')
            setStatusFilter('')
            setMonthFilter('')
            setAtivasOnly(false)
            setQuitadasOnly(false)
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Limpar filtros
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="ml-auto rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Nova multa
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">Motorista</th>
              <th className="px-3 py-3">Descrição</th>
              <th className="px-3 py-3 text-right">Valor total</th>
              <th className="px-3 py-3 text-right">Parcelas</th>
              <th className="px-3 py-3 text-right">Valor semanal</th>
              <th className="px-3 py-3 text-right">Pagas</th>
              <th className="px-3 py-3 text-right">Falta pagar</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma multa com estes filtros.
                </td>
              </tr>
            ) : (
              filtered.map((f) => {
                const saldo = saldoRestanteFine(f, db.installments)
                const highlight = dueThisWeekIds.has(f.id) && f.status === 'ativa'
                return (
                  <tr
                    key={f.id}
                    className={['border-t border-slate-100', highlight ? 'bg-amber-50/90' : ''].join(
                      ' ',
                    )}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatBrDate(f.dataMulta)}</td>
                    <td className="px-3 py-2.5 font-medium">{f.motoristaNome}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5" title={f.descricao}>
                      {f.descricao}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(f.valorTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{f.quantidadeParcelas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(f.valorParcela)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{f.parcelasPagas}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {formatBrl(saldo)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset',
                          statusClass(f.status),
                        ].join(' ')}
                      >
                        {statusLabelFine(f)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                          onClick={() => setHistoryFineId(f.id)}
                        >
                          Histórico
                        </button>
                        {f.status === 'ativa' ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-200"
                              onClick={() => {
                                setEditing(f)
                                setFormOpen(true)
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-200"
                              onClick={() => {
                                payNextParcelForFine(f.id)
                                refresh()
                              }}
                            >
                              Próxima parcela
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-900 hover:bg-red-200"
                              onClick={() => setCancelId(f.id)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-200"
                              onClick={() => setQuitadaManualConfirm({ id: f.id, enable: true })}
                            >
                              Marcar quitada (manual)
                            </button>
                            {f.ativaManual ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                onClick={() => setAtivaManualConfirm({ id: f.id, enable: false })}
                              >
                                Voltar status automático
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {f.status === 'quitada' ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-200"
                              onClick={() => {
                                setEditing(f)
                                setFormOpen(true)
                              }}
                            >
                              Editar
                            </button>
                            {f.quitadaManual ? (
                              <button
                                type="button"
                                className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-200"
                                onClick={() => setQuitadaManualConfirm({ id: f.id, enable: false })}
                              >
                                Remover quitada manual
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-200"
                              onClick={() => setAtivaManualConfirm({ id: f.id, enable: true })}
                            >
                              Reabrir multa (ativa no repasse)
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <FineFormModal
          initial={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSaved={() => {
            refresh()
            setFormOpen(false)
            setEditing(null)
          }}
        />
      ) : null}

      {historyFineId ? (
        <HistoryModal
          fineId={historyFineId}
          db={db}
          onClose={() => setHistoryFineId(null)}
          onRequestRevertParcel={(parcelId) => setRevertParcelId(parcelId)}
        />
      ) : null}

      <ConfirmDialog
        open={cancelId !== null}
        title="Cancelar multa?"
        message="Parcelas não descontadas serão canceladas. Parcelas já descontadas permanecem."
        confirmLabel="Cancelar multa"
        danger
        onCancel={() => setCancelId(null)}
        onConfirm={() => {
          if (cancelId) {
            cancelFine(cancelId)
            refresh()
          }
          setCancelId(null)
        }}
      />

      <ConfirmDialog
        open={quitadaManualConfirm !== null}
        title={quitadaManualConfirm?.enable ? 'Marcar como quitada (manual)?' : 'Remover quitada manual?'}
        message={
          quitadaManualConfirm?.enable ?
            'A multa aparece como quitada mesmo com saldo em aberto. Parcelas pendentes deixam de entrar no repasse até você remover esta marca ou estornar parcelas no histórico.'
          : 'O status volta a ser calculado pelo saldo e pelas parcelas descontadas.'
        }
        confirmLabel={quitadaManualConfirm?.enable ? 'Marcar quitada' : 'Remover marcação'}
        danger={Boolean(quitadaManualConfirm?.enable)}
        onCancel={() => setQuitadaManualConfirm(null)}
        onConfirm={() => {
          if (quitadaManualConfirm) {
            setFineQuitadaManual(quitadaManualConfirm.id, quitadaManualConfirm.enable)
            refresh()
          }
          setQuitadaManualConfirm(null)
        }}
      />

      <ConfirmDialog
        open={ativaManualConfirm !== null}
        title={
          ativaManualConfirm?.enable ? 'Reabrir multa como ativa?' : 'Voltar ao status automático?'
        }
        message={
          ativaManualConfirm?.enable ?
            'A multa fica ativa de novo e volta a aparecer no repasse (descontos daquele motorista). Se estava quitada só por parcelas pagas, o app continua mostrando «Ativa (reaberta)» até você usar «Voltar status automático» ou estornar parcelas no histórico.'
          : 'A multa deixa de ser forçada como ativa: o status volta a ser calculado pelas parcelas e pelo saldo (pode voltar a quitada).'
        }
        confirmLabel={ativaManualConfirm?.enable ? 'Reabrir' : 'Voltar automático'}
        danger={Boolean(ativaManualConfirm?.enable)}
        onCancel={() => setAtivaManualConfirm(null)}
        onConfirm={() => {
          if (ativaManualConfirm) {
            setFineAtivaManual(ativaManualConfirm.id, ativaManualConfirm.enable)
            refresh()
          }
          setAtivaManualConfirm(null)
        }}
      />

      <ConfirmDialog
        open={revertParcelId !== null}
        title="Estornar parcela?"
        message="A parcela volta para pendente. O status da multa deixa de ser quitada se ainda houver saldo ou parcelas em aberto."
        confirmLabel="Estornar parcela"
        danger
        onCancel={() => setRevertParcelId(null)}
        onConfirm={() => {
          if (revertParcelId) {
            revertParcelToPending(revertParcelId)
            refresh()
          }
          setRevertParcelId(null)
        }}
      />
    </div>
  )
}

function FineFormModal(props: {
  initial: DriverFineRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const { initial, onClose, onSaved } = props
  const lockedFields = useMemo(() => {
    if (!initial) return false
    const finesDb = loadDriverFinesDb()
    const hasPaid = finesDb.installments.some(
      (i) => i.multaId === initial.id && i.status === 'descontada',
    )
    return hasPaid || initial.status === 'quitada' || initial.quitadaManual === true
  }, [initial])

  const [motoristaId, setMotoristaId] = useState<DriverFineMotoristaId>(initial?.motoristaId ?? 'bispo')
  const [dataMulta, setDataMulta] = useState(initial?.dataMulta ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [valorRaw, setValorRaw] = useState(initial ? String(initial.valorTotal) : '')
  const [qParcelas, setQParcelas] = useState(initial ? String(initial.quantidadeParcelas) : '1')
  const [dataInicio, setDataInicio] = useState(initial?.dataInicioDesconto ?? '')
  const [observacao, setObservacao] = useState(initial?.observacao ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    const valorTotal = parseDecimal(valorRaw || '0')
    const quantidadeParcelas = Math.max(1, Math.round(Number(qParcelas) || 1))
    if (!dataMulta || !descricao.trim() || valorTotal <= 0 || !dataInicio) return

    if (initial) {
      if (lockedFields) updateFine(initial.id, { descricao, observacao })
      else {
        updateFine(initial.id, {
          descricao,
          observacao,
          dataMulta,
          dataInicioDesconto: dataInicio,
          valorTotal,
          quantidadeParcelas,
        })
      }
    } else {
      const input: CreateFineInput = {
        motoristaId,
        dataMulta,
        descricao,
        valorTotal,
        quantidadeParcelas,
        dataInicioDesconto: dataInicio,
        observacao,
      }
      createFine(input)
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{initial ? 'Editar multa' : 'Nova multa'}</h3>
        {lockedFields ? (
          <p className="mt-2 text-sm text-amber-800">
            Parcelas já descontadas ou multa quitada — apenas descrição e observação podem ser alteradas.
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-4 space-y-3">
          {!initial || !lockedFields ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Motorista</span>
                <select
                  value={motoristaId}
                  onChange={(e) => setMotoristaId(e.target.value as DriverFineMotoristaId)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-base"
                  disabled={Boolean(initial)}
                >
                  <option value="edson">Edson</option>
                  <option value="bispo">Bispo</option>
                </select>
              </label>
              <Field label="Data da multa" type="date" value={dataMulta} onChange={setDataMulta} />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Descrição</span>
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-base"
                  required
                />
              </label>
              <Field
                label="Valor total (R$)"
                type="text"
                inputMode="decimal"
                value={valorRaw}
                onChange={setValorRaw}
                hint="Aceita R$ 500,15 ou 500.15"
              />
              <Field
                label="Quantidade de parcelas"
                type="number"
                inputMode="numeric"
                value={qParcelas}
                onChange={setQParcelas}
              />
              <Field
                label="Data início do desconto"
                type="date"
                value={dataInicio}
                onChange={setDataInicio}
                hint="Primeira parcela na semana desta data (segunda-feira da semana)."
              />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Motorista: <strong>{motoristaLabel(motoristaId)}</strong>
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Descrição</span>
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-base"
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Observação</span>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-base"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold"
            >
              Fechar
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HistoryModal(props: {
  fineId: string
  db: DriverFinesDb
  onClose: () => void
  onRequestRevertParcel: (parcelId: string) => void
}) {
  const { fineId, db, onClose, onRequestRevertParcel } = props
  const fine = db.fines.find((f) => f.id === fineId)
  const rows = db.installments
    .filter((i) => i.multaId === fineId)
    .sort((a, b) => a.numeroParcela - b.numeroParcela)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">Histórico de parcelas</h3>
        {fine ? (
          <p className="mt-1 text-sm text-slate-600">
            {fine.descricao} — {fine.motoristaNome}
          </p>
        ) : null}
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-600">
            <tr>
              <th className="py-2">Nº</th>
              <th className="py-2">Valor</th>
              <th className="py-2">Semana ref.</th>
              <th className="py-2">Status</th>
              <th className="py-2">Data desconto</th>
              <th className="py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2">{r.numeroParcela}</td>
                <td className="py-2 tabular-nums">{formatBrl(r.valor)}</td>
                <td className="py-2">{formatBrDate(r.semanaReferencia)}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">{r.dataDesconto ? formatBrDate(r.dataDesconto) : '—'}</td>
                <td className="py-2">
                  {r.status === 'descontada' ? (
                    <button
                      type="button"
                      className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-200"
                      onClick={() => onRequestRevertParcel(r.id)}
                    >
                      Voltar a pendente
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
