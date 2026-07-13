import { toBlob } from 'html-to-image'

/** PNG via html-to-image — cores sólidas (hex) funcionam melhor que oklch do Tailwind v4. */
export async function captureElementToPngBlob(el: HTMLElement): Promise<Blob> {
  const base = { cacheBust: true, backgroundColor: '#ffffff' } as const

  let blob: Blob | null = null
  try {
    blob = await toBlob(el, { ...base, pixelRatio: 2 })
  } catch (first) {
    console.warn('capture: pixelRatio 2 falhou, tentando 1', first)
    blob = await toBlob(el, { ...base, pixelRatio: 1 })
  }
  if (!blob) throw new Error('Não foi possível gerar o PNG.')
  return blob
}
