import { useId } from 'react'
import { fileToPreviewDataUrl } from '../lib/image-preview'

interface ImageSlotProps {
  label: string
  description?: string
  value?: string
  onChange: (dataUrl: string | undefined) => void
}

export function ImageSlot({ label, description, value, onChange }: ImageSlotProps) {
  const inputId = useId()

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await fileToPreviewDataUrl(file)
      onChange(dataUrl)
    } catch {
      onChange(undefined)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {description ? <span className="text-xs text-slate-500">{description}</span> : null}
      </div>
      {value ? (
        <div className="relative mb-2 overflow-hidden rounded-lg border border-slate-100">
          <img src={value} alt="" className="max-h-40 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-medium text-white shadow"
          >
            Remover
          </button>
        </div>
      ) : null}
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
      >
        <input id={inputId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} />
        {value ? 'Trocar foto' : 'Adicionar foto'}
      </label>
      <p className="mt-1 text-[11px] text-slate-400">
        Só visualização nesta tela. Não é salva; após o lançamento, a imagem é descartada.
      </p>
    </div>
  )
}
