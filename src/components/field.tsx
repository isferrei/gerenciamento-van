import { useId, type InputHTMLAttributes } from 'react'

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'month'
  step?: string
  min?: string
  hint?: string
  required?: boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  /** Destaque amarelo (ex.: leitura automática com baixa confiança) */
  lowConfidence?: boolean
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
  min,
  hint,
  required,
  inputMode,
  lowConfidence,
}: FieldProps) {
  const id = useId()
  const inputClass = lowConfidence
    ? 'rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none ring-amber-500/25 transition focus:border-amber-500 focus:ring-4'
    : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none ring-sky-500/30 transition focus:border-sky-500 focus:ring-4'
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        id={id}
        type={type}
        step={step}
        min={min}
        required={required}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}
