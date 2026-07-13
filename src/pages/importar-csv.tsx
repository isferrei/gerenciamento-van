import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  aggregateCorridaTurnsToDailyEntries,
  parseCorridaCsv,
  type CorridaCsvParsedTurn,
  type CorridaCsvPreviewRow,
} from '../lib/corrida-csv-import'
import { mergeImportedEntries, importEntriesFromCsvText } from '../lib/backup-actions'
import { useAppShell } from '../context/app-shell-context'

export function ImportarCsvPage() {
  const { bumpData } = useAppShell()
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<CorridaCsvPreviewRow[]>([])
  const [parsedTurns, setParsedTurns] = useState<CorridaCsvParsedTurn[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [canConfirm, setCanConfirm] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  function resetState() {
    setDoneMsg(null)
    setCanConfirm(false)
    setParsedTurns([])
  }

  async function onPickCorrida(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    resetState()
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCorridaCsv(text)
    setPreviewRows(parsed.previewRows)
    setErrors(parsed.errors)
    const ok = parsed.errors.length === 0 && parsed.turns.length > 0
    setParsedTurns(ok ? parsed.turns : [])
    setCanConfirm(ok)
  }

  function onConfirmImport() {
    if (!parsedTurns.length) return
    const entries = aggregateCorridaTurnsToDailyEntries(parsedTurns)
    const { merged, replaced } = mergeImportedEntries(entries)
    setDoneMsg(
      `Importados ${entries.length} dia(s) (${parsedTurns.length} turno(s)). ${replaced ? `${replaced} data(s) já existiam e foram atualizadas.` : ''} Total: ${merged.length} lançamentos.`,
    )
    setCanConfirm(false)
    setPreviewRows([])
    setErrors([])
    setParsedTurns([])
    setFileName(null)
    bumpData()
  }

  async function onPickBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    resetState()
    setFileName(file.name)
    const text = await file.text()
    const res = importEntriesFromCsvText(text)
    setDoneMsg(res.message)
    setPreviewRows([])
    setErrors(res.ok ? [] : [res.message])
    setCanConfirm(false)
    if (res.ok) bumpData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Importar CSV</h2>
        <p className="mt-1 text-sm text-slate-600">
          UTF-8, separador <code className="rounded bg-slate-100 px-1">;</code>. Um turno por linha;
          o sistema agrupa por data em um lançamento diário (viagens Edson/Bispo, combustível somado,
          etc.).
        </p>
      </div>

      {doneMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          {doneMsg}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Formato corridas / turnos</h3>
        <p className="mt-1 text-xs text-slate-600">
          Cabeçalho:{' '}
          <span className="font-mono text-[11px]">
            data;dia;turno;motorista;cartoes;km;corridas;desconto_motorista;salario_motorista;lucro_bruto;despesa;combustivel
          </span>
          . Obrigatórios por linha: <strong>data</strong>, <strong>turno</strong>,{' '}
          <strong>motorista</strong> (Edson ou Bispo). Sem <span className="font-mono">R$</span> nos
          valores.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
          >
            Escolher arquivo .csv
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPickCorrida}
          />
          {fileName ? (
            <span className="self-center text-sm text-slate-600">{fileName}</span>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <ul className="mt-4 max-h-48 list-inside list-disc space-y-1 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        ) : null}

        {previewRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-[960px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-2 py-2">Linha</th>
                  <th className="px-2 py-2">data</th>
                  <th className="px-2 py-2">dia</th>
                  <th className="px-2 py-2">turno</th>
                  <th className="px-2 py-2">motorista</th>
                  <th className="px-2 py-2">cartoes</th>
                  <th className="px-2 py-2">km</th>
                  <th className="px-2 py-2">corridas</th>
                  <th className="px-2 py-2">desconto</th>
                  <th className="px-2 py-2">salário</th>
                  <th className="px-2 py-2">lucro_bruto</th>
                  <th className="px-2 py-2">despesa</th>
                  <th className="px-2 py-2">combustível</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.lineNumber}
                    className="border-b border-slate-50 odd:bg-white even:bg-slate-50/50"
                  >
                    <td className="px-2 py-1.5 font-mono">{row.lineNumber}</td>
                    <td className="px-2 py-1.5">{row.dataIso}</td>
                    <td className="px-2 py-1.5">{row.dia}</td>
                    <td className="px-2 py-1.5">{row.turno}</td>
                    <td className="px-2 py-1.5">{row.motorista}</td>
                    <td className="px-2 py-1.5">{row.cartoes}</td>
                    <td className="px-2 py-1.5">{row.km}</td>
                    <td className="px-2 py-1.5">{row.corridas}</td>
                    <td className="px-2 py-1.5">{row.desconto_motorista}</td>
                    <td className="px-2 py-1.5">{row.salario_motorista}</td>
                    <td className="px-2 py-1.5">{row.lucro_bruto}</td>
                    <td className="px-2 py-1.5">{row.despesa}</td>
                    <td className="px-2 py-1.5">{row.combustivel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirmImport}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
          >
            Confirmar importação
          </button>
          {!canConfirm && previewRows.length > 0 ? (
            <span className="self-center text-sm text-amber-800">
              Corrija os erros acima ou escolha outro arquivo.
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Backup do próprio app</h3>
        <p className="mt-1 text-xs text-slate-600">
          CSV exportado por «Exportar CSV» no menu (vírgula, colunas id/date/km…). Use quando estiver
          restaurando backup.
        </p>
        <label className="mt-3 inline-block cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
          <input
            ref={backupRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPickBackup}
          />
          Importar backup (.csv)
        </label>
      </section>

      <p className="text-sm">
        <Link to="/lista" className="font-medium text-blue-600 hover:underline">
          ← Voltar à lista
        </Link>
      </p>
    </div>
  )
}
