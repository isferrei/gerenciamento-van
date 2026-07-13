/**
 * Extrai campos do lançamento a partir de imagens (OpenAI Vision).
 * Variável: OPENAI_API_KEY (variáveis de ambiente no Netlify).
 * Sem chave: retorna data vazio + aviso (200) para o front exibir mensagem.
 *
 * Em `netlify dev`, carrega também `.env` na raiz do repositório (CLI nem sempre injeta na função).
 */

import { config as loadEnv } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

/**
 * `import.meta.url` pode ser undefined no bundler/runtime da Netlify — não usar fileURLToPath.
 * Procura `.env` a partir de `process.cwd()` e pastas pai.
 */
function loadLocalEnv() {
  const dirs = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '..', '..'),
    resolve(process.cwd(), '..', '..', '..'),
  ]
  for (const dir of dirs) {
    const envPath = resolve(dir, '.env')
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, quiet: true })
      return
    }
  }
  loadEnv({ quiet: true })
}

loadLocalEnv()

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

/** Limite seguro abaixo do teto da Netlify (~6 MB) para o POST inteiro. */
const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function stripDataUrl(b64OrDataUrl) {
  if (!b64OrDataUrl || typeof b64OrDataUrl !== 'string') return null
  const m = b64OrDataUrl.match(/^data:image\/\w+;base64,(.+)$/)
  if (m) return b64OrDataUrl
  return `data:image/jpeg;base64,${b64OrDataUrl}`
}

export const handler = async (event) => {
  const headers = corsHeaders()
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  if (event.body) {
    const bytes = Buffer.byteLength(event.body, 'utf8')
    if (bytes > MAX_REQUEST_BODY_BYTES) {
      const mb = (bytes / (1024 * 1024)).toFixed(1)
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({
          error: `Requisição muito grande (~${mb} MB). Reduza a resolução das fotos ou envie menos imagens por vez (limite ~5 MB).`,
        }),
      }
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'JSON inválido' }),
    }
  }

  const images = body.images && typeof body.images === 'object' ? body.images : {}
  const imagePairs = Object.entries(images).filter(([, v]) => typeof v === 'string' && v.length > 0)

  if (imagePairs.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Envie pelo menos uma imagem em images.{painelKm|notaCombustivel|telaValeTrans|folhaDiaria}' }),
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: {},
        confidence: {},
        meta: {
          warning:
            'OPENAI_API_KEY não está definida. No Netlify: Site configuration → Environment variables → adicione OPENAI_API_KEY com o valor da sua chave OpenAI.',
          docUrl: 'https://docs.netlify.com/environment-variables/get-started/',
        },
      }),
    }
  }

  const systemPrompt = `Você analisa fotos de operação de van no Brasil (painel/KM, nota de combustível, tela Vale Transporte, folha diária).
Extraia apenas o que estiver legível nas imagens.

Responda APENAS um JSON válido neste formato exato (sem markdown):
{
  "data": {
    "date": "YYYY-MM-DD" | null,
    "km": number | null,
    "valeTransQtd": number | null,
    "combustivel": number | null,
    "viagensEdson": number | null,
    "viagensBispo": number | null,
    "outrasDespesas": number | null,
    "observacoes": string | null
  },
  "confidence": {
    "date": number,
    "km": number,
    "valeTransQtd": number,
    "combustivel": number,
    "viagensEdson": number,
    "viagensBispo": number,
    "outrasDespesas": number,
    "observacoes": number
  }
}

Regras:
- Use null para campo ilegível ou ausente.
- confidence: 0 a 1 para cada chave presente em data (use 0 se null).
- date: só se houver data clara (recibo, folha).
- km: odômetro inteiro.
- valeTransQtd: quantidade de vales/tickets, não valor em R$.
- valores monetários em número decimal (ex.: 150.50).
- observacoes: texto curto opcional.`

  const userContent = [
    { type: 'text', text: `Imagens na ordem: ${imagePairs.map(([k]) => k).join(', ')}. Extraia o JSON.` },
  ]
  for (const [, dataUrl] of imagePairs) {
    userContent.push({
      type: 'image_url',
      image_url: { url: stripDataUrl(dataUrl), detail: 'low' },
    })
  }

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    const raw = await res.json()
    if (!res.ok) {
      const msg = raw?.error?.message || JSON.stringify(raw)
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `OpenAI: ${msg}` }),
      }
    }

    const text = raw?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Resposta vazia do modelo' }),
      }
    }

    let cleanText = text.trim()
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/s, '')
    }

    let parsed
    try {
      parsed = JSON.parse(cleanText)
    } catch {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'JSON inválido retornado pelo modelo' }),
      }
    }

    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
    const confidence =
      parsed.confidence && typeof parsed.confidence === 'object' ? parsed.confidence : {}

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data,
        confidence,
        meta: { model: 'gpt-4o-mini' },
      }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Erro ao processar' }),
    }
  }
}
