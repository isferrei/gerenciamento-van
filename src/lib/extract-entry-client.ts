/** Campos que o OCR pode preencher (alinhado à Netlify Function) */
export interface ExtractedData {
  date?: string | null
  km?: number | null
  valeTransQtd?: number | null
  combustivel?: number | null
  viagensEdson?: number | null
  viagensBispo?: number | null
  outrasDespesas?: number | null
  observacoes?: string | null
}

export interface ExtractEntryResponse {
  data: ExtractedData
  confidence: Partial<Record<keyof ExtractedData, number>>
  meta?: { warning?: string; model?: string; docUrl?: string }
  error?: string
}

const DEFAULT_PATH = '/.netlify/functions/extract-entry'

/** Em `npm run dev`, o path relativo apontaria para o Vite (HTML), não para a função. */
const DEV_DEFAULT_FUNCTION_URL = 'http://localhost:8888/.netlify/functions/extract-entry'

function endpoint(): string {
  const explicit = (import.meta.env.VITE_EXTRACT_ENTRY_URL as string | undefined)?.trim()
  if (explicit) return explicit
  if (import.meta.env.DEV) return DEV_DEFAULT_FUNCTION_URL
  return DEFAULT_PATH
}

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1)
  return s
}

function previewResponse(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export async function extractEntryFromImages(
  images: Partial<
    Record<'painelKm' | 'notaCombustivel' | 'telaValeTrans' | 'folhaDiaria', string>
  >,
): Promise<ExtractEntryResponse> {
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(images)) {
    if (typeof v === 'string' && v.length > 0) cleaned[k] = v
  }

  const url = endpoint()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: cleaned }),
    })
  } catch {
    return {
      data: {},
      confidence: {},
      error:
        import.meta.env.DEV
          ? 'Não foi possível conectar à função na porta 8888. Em outro terminal, na pasta do projeto, rode: npx netlify dev'
          : 'Falha de rede ao chamar a leitura automática.',
    }
  }

  const rawText = stripBom(await res.text())
  let json: ExtractEntryResponse & { error?: string }
  try {
    json = JSON.parse(rawText) as ExtractEntryResponse & { error?: string }
  } catch {
    const trimmed = rawText.trim()
    const head = trimmed.slice(0, 120).toLowerCase()
    const looksLikeHtml =
      head.startsWith('<!') ||
      head.startsWith('<html') ||
      head.includes('<!doctype') ||
      head.startsWith('<head') ||
      head.startsWith('<body')

    if (!trimmed)
      return {
        data: {},
        confidence: {},
        error: `Resposta vazia do servidor (HTTP ${res.status}). Reinicie \`netlify dev\` ou verifique o deploy.`,
      }

    return {
      data: {},
      confidence: {},
      error: looksLikeHtml
        ? import.meta.env.DEV
          ? 'O servidor devolveu HTML em vez de JSON. Confira se `netlify dev` está rodando na porta 8888.'
          : 'Resposta inválida do servidor (HTML em vez de JSON).'
        : trimmed.length > 800 || /^[\x00-\x08\x0e-\x1f]/.test(trimmed)
          ? `Resposta não é JSON válido (HTTP ${res.status}). O payload pode ser grande demais para a função — use fotos menores ou menos imagens por vez.`
          : `Resposta não é JSON válido (HTTP ${res.status}). ${previewResponse(trimmed, 120)}`,
    }
  }

  if (!res.ok)
    return {
      data: {},
      confidence: {},
      error: json.error || `Erro ${res.status}`,
    }

  return json
}

/** Considera baixa confiança quando < threshold (destaque amarelo). */
export const LOW_CONFIDENCE_THRESHOLD = 0.85

export function isLowConfidence(score: number | undefined): boolean {
  if (score === undefined || Number.isNaN(score)) return false
  return score < LOW_CONFIDENCE_THRESHOLD
}
