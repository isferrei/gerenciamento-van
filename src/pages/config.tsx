import { Link } from 'react-router-dom'
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { AppSettings, MotoristaDomingo } from '../types'
import { defaultSettings } from '../types'
import { clearAllAppData, loadSettings, saveSettings } from '../lib/storage'
import {
  downloadEntriesCsv,
  importEntriesFromCsvText,
} from '../lib/backup-actions'
import { migrateLocalStorageToApi } from '../lib/migrate-to-api'
import { Field } from '../components/field'
import { ConfirmDialog } from '../components/confirm-dialog'
import { useAppShell } from '../context/app-shell-context'

export function ConfigPage() {
  const { bumpData } = useAppShell()
  const initial = useMemo(() => loadSettings(), [])
  const [settings, setSettings] = useState<AppSettings>(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [migrating, setMigrating] = useState(false)

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    saveSettings(settings)
    bumpData()
    setMsg('Configurações salvas neste dispositivo.')
    window.setTimeout(() => setMsg(null), 2500)
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const res = importEntriesFromCsvText(text)
    setMsg(res.message)
  }

  async function onMigrateToApi() {
    setMigrating(true)
    setMsg(null)

    try {
      const result = await migrateLocalStorageToApi()
      setMsg(
        `Migração concluída: ${result.entriesCount} lançamentos enviados. Total na API: ${result.totalEntriesInApi}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      setMsg(`Falha ao migrar para a API: ${message}`)
    } finally {
      setMigrating(false)
    }
  }

  function onClear() {
    clearAllAppData()
    setSettings({ ...defaultSettings })
    setClearOpen(false)
    setMsg('Todos os dados locais foram apagados.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Configurações</h2>
        <p className="text-sm text-slate-600">
          Vales, viagens, óleo; despesas fixas semanais (APTRAN, Morro, Fiscal) e mensais (parcela,
          aluguel da linha). Os lançamentos usam os parâmetros de vales/viagens nos cálculos.
        </p>
      </div>

      {msg ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {msg}
        </div>
      ) : null}

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Valor Riocard por cartão (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={
              settings.valorRiocardPorCartao === 0 ? '' : String(settings.valorRiocardPorCartao)
            }
            onChange={(v) =>
              update('valorRiocardPorCartao', v === '' ? 0 : Number(v.replace(',', '.')))
            }
          />
          <Field
            label="Valor de cada vale transporte (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={settings.valorValeTrans === 0 ? '' : String(settings.valorValeTrans)}
            onChange={(v) => update('valorValeTrans', v === '' ? 0 : Number(v.replace(',', '.')))}
          />
          <Field
            label="Valor por viagem — Edson (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={settings.valorViagemEdson === 0 ? '' : String(settings.valorViagemEdson)}
            onChange={(v) => update('valorViagemEdson', v === '' ? 0 : Number(v.replace(',', '.')))}
          />
          <Field
            label="Valor por viagem — Bispo (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={settings.valorViagemBispo === 0 ? '' : String(settings.valorViagemBispo)}
            onChange={(v) => update('valorViagemBispo', v === '' ? 0 : Number(v.replace(',', '.')))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Viagens padrão — Edson (seg–sáb)"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={settings.viagensPadraoEdson === 0 ? '' : String(settings.viagensPadraoEdson)}
            onChange={(v) =>
              update('viagensPadraoEdson', v === '' ? 0 : Math.max(0, Math.round(Number(v))))
            }
          />
          <Field
            label="Viagens padrão — Bispo (seg–sáb)"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={settings.viagensPadraoBispo === 0 ? '' : String(settings.viagensPadraoBispo)}
            onChange={(v) =>
              update('viagensPadraoBispo', v === '' ? 0 : Math.max(0, Math.round(Number(v))))
            }
          />
          <Field
            label="Viagens padrão — domingo (motorista ativo)"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={
              settings.viagensDomingoPadrao === 0 ? '' : String(settings.viagensDomingoPadrao)
            }
            onChange={(v) =>
              update('viagensDomingoPadrao', v === '' ? 0 : Math.max(0, Math.round(Number(v))))
            }
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Motorista no domingo (padrão)</span>
            <select
              value={settings.motoristaDomingoPadrao}
              onChange={(e) =>
                update('motoristaDomingoPadrao', e.target.value as MotoristaDomingo)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none ring-blue-500/25 focus:border-blue-500 focus:ring-4"
            >
              <option value="Bispo">Bispo</option>
              <option value="Edson">Edson</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Despesas fixas semanais</h3>
          <p className="mt-1 text-xs text-slate-600">
            Valores de referência por semana (R$). Use nos lançamentos ou conferências conforme sua
            rotina.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field
              label="APTRAN (R$ / semana)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={settings.despesaAptran === 0 ? '' : String(settings.despesaAptran)}
              onChange={(v) =>
                update('despesaAptran', v === '' ? 0 : Number(v.replace(',', '.')))
              }
            />
            <Field
              label="Morro (R$ / semana)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={settings.despesaMorro === 0 ? '' : String(settings.despesaMorro)}
              onChange={(v) =>
                update('despesaMorro', v === '' ? 0 : Number(v.replace(',', '.')))
              }
            />
            <Field
              label="Fiscal (R$ / semana)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={settings.despesaFiscal === 0 ? '' : String(settings.despesaFiscal)}
              onChange={(v) =>
                update('despesaFiscal', v === '' ? 0 : Number(v.replace(',', '.')))
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Despesas fixas mensais</h3>
          <p className="mt-1 text-xs text-slate-600">
            Valores de referência por mês (R$).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Parcela do carro (R$ / mês)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={
                settings.despesaMensalParcelaCarro === 0 ?
                  ''
                : String(settings.despesaMensalParcelaCarro)
              }
              onChange={(v) =>
                update(
                  'despesaMensalParcelaCarro',
                  v === '' ? 0 : Number(v.replace(',', '.')),
                )
              }
            />
            <Field
              label="Aluguel da linha (R$ / mês)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={
                settings.despesaMensalAluguelLinha === 0 ?
                  ''
                : String(settings.despesaMensalAluguelLinha)
              }
              onChange={(v) =>
                update(
                  'despesaMensalAluguelLinha',
                  v === '' ? 0 : Number(v.replace(',', '.')),
                )
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="KM da última troca de óleo"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={settings.kmUltimaTrocaOleo === 0 ? '' : String(settings.kmUltimaTrocaOleo)}
            onChange={(v) => update('kmUltimaTrocaOleo', v === '' ? 0 : Number(v.replace(',', '.')))}
          />
          <Field
            label="Intervalo de troca de óleo (km)"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={
              settings.intervaloTrocaOleoKm === 0 ? '' : String(settings.intervaloTrocaOleoKm)
            }
            onChange={(v) =>
              update('intervaloTrocaOleoKm', v === '' ? 0 : Number(v.replace(',', '.')))
            }
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800"
        >
          Salvar configurações
        </button>
      </form>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Dados (CSV)</h3>
        <p className="text-sm text-slate-600">
          Exportação inclui apenas números e datas dos lançamentos (sem imagens).
        </p>
        <Link
          to="/importar-csv"
          className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
        >
          Importar corridas / turnos (CSV com ;)
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => downloadEntriesCsv()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Exportar CSV
          </button>
          <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onImportFile} />
            Importar backup exportado
          </label>
          <button
            type="button"
            onClick={onMigrateToApi}
            disabled={migrating}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {migrating ? 'Migrando...' : 'Migrar dados locais para API'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-900">Zona perigosa</h3>
        <p className="mt-1 text-sm text-red-800">
          Limpar dados remove lançamentos e configurações salvos no navegador deste aparelho.
        </p>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Limpar todos os dados
        </button>
      </section>

      <ConfirmDialog
        open={clearOpen}
        title="Apagar tudo?"
        message="Isso apaga lançamentos e configurações do armazenamento local. Faça um export CSV antes, se precisar de backup."
        confirmLabel="Apagar"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={onClear}
      />
    </div>
  )
}
