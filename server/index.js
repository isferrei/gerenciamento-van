import express from 'express'
import cors from 'cors'
import { connectDb } from './db.js'
import { Entry, Settings } from './models.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)
const CORS_ORIGIN = process.env.CORS_ORIGIN
const DEFAULT_SETTINGS = {
  valorRiocardPorCartao: 13.79,
  valorValeTrans: 15.32,
  valorViagemEdson: 50,
  valorViagemBispo: 70,
  viagensPadraoEdson: 3,
  viagensPadraoBispo: 3,
  viagensDomingoPadrao: 4,
  motoristaDomingoPadrao: 'Bispo',
  kmUltimaTrocaOleo: 0,
  intervaloTrocaOleoKm: 10000,
  despesaAptran: 80,
  despesaMorro: 400,
  despesaFiscal: 225,
  despesaMensalParcelaCarro: 6700,
  despesaMensalAluguelLinha: 15000,
}
const NUMERIC_SETTINGS_KEYS = [
  'valorRiocardPorCartao',
  'valorValeTrans',
  'valorViagemEdson',
  'valorViagemBispo',
  'viagensPadraoEdson',
  'viagensPadraoBispo',
  'viagensDomingoPadrao',
  'kmUltimaTrocaOleo',
  'intervaloTrocaOleoKm',
  'despesaAptran',
  'despesaMorro',
  'despesaFiscal',
  'despesaMensalParcelaCarro',
  'despesaMensalAluguelLinha',
]

app.use(
  cors({
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',').map((origin) => origin.trim()) : true,
  }),
)
app.use(express.json())

function createHttpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validateEntryPayload(entry, { requireId = true } = {}) {
  if (!isPlainObject(entry)) {
    throw createHttpError(400, 'Envie um lançamento válido')
  }

  if (requireId && (typeof entry.id !== 'string' || entry.id.trim() === '')) {
    throw createHttpError(400, 'O lançamento precisa ter id')
  }

  if (!isIsoDate(entry.date)) {
    throw createHttpError(400, 'O lançamento precisa ter date no formato YYYY-MM-DD')
  }
}

function normalizeSettings(settings) {
  if (!isPlainObject(settings)) {
    throw createHttpError(400, 'Envie configurações válidas')
  }

  const nextSettings = { ...DEFAULT_SETTINGS, ...settings }

  for (const key of NUMERIC_SETTINGS_KEYS) {
    const value = Number(nextSettings[key])

    if (!Number.isFinite(value) || value < 0) {
      throw createHttpError(400, `Configuração inválida: ${key}`)
    }

    nextSettings[key] = value
  }

  if (!['Edson', 'Bispo'].includes(nextSettings.motoristaDomingoPadrao)) {
    throw createHttpError(400, 'Configuração inválida: motoristaDomingoPadrao')
  }

  nextSettings.viagensPadraoEdson = Math.round(nextSettings.viagensPadraoEdson)
  nextSettings.viagensPadraoBispo = Math.round(nextSettings.viagensPadraoBispo)
  nextSettings.viagensDomingoPadrao = Math.round(nextSettings.viagensDomingoPadrao)

  return nextSettings
}

function toEntryDocument(entry) {
  const { id, ...data } = entry
  return { _id: id, ...data }
}

function dedupeEntries(entries) {
  const entriesByDateOrId = new Map()

  for (const entry of entries) {
    const currentById = entriesByDateOrId.get(entry.id)
    const currentByDate = entriesByDateOrId.get(entry.date)
    const current = currentById ?? currentByDate

    if (current) {
      entriesByDateOrId.delete(current.id)
      entriesByDateOrId.delete(current.date)
    }

    entriesByDateOrId.set(entry.id, entry)
    entriesByDateOrId.set(entry.date, entry)
  }

  return Array.from(new Set(entriesByDateOrId.values())).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  )
}

async function getSettings() {
  const settings = await Settings.findById('default')

  if (!settings) {
    return { ...DEFAULT_SETTINGS }
  }

  return normalizeSettings(settings.toJSON())
}

app.get('/health', (req, res) => {
  res.json({ ok: true, database: 'mongodb', message: 'API funcionando' })
})

app.get('/settings', async (req, res) => {
  res.json(await getSettings())
})

app.put('/settings', async (req, res) => {
  const nextSettings = normalizeSettings(req.body)

  await Settings.findByIdAndUpdate('default', { $set: nextSettings }, { new: true, upsert: true })

  res.json(nextSettings)
})

app.get('/entries', async (req, res) => {
  const entries = await Entry.find().sort({ date: 1 })

  res.json(entries)
})

app.get('/entries/:id', async (req, res) => {
  const entry = await Entry.findById(req.params.id)

  if (!entry) {
    return res.status(404).json({ error: 'Lançamento não encontrado' })
  }

  res.json(entry)
})

app.post('/entries/import', async (req, res) => {
  const entries = req.body?.entries

  if (!Array.isArray(entries)) {
    throw createHttpError(400, 'Envie entries como uma lista')
  }

  entries.forEach((entry) => validateEntryPayload(entry))

  const nextEntries = dedupeEntries(entries)
  const ids = nextEntries.map((entry) => entry.id)
  const dates = nextEntries.map((entry) => entry.date)

  await Entry.deleteMany({ $or: [{ _id: { $in: ids } }, { date: { $in: dates } }] })

  if (nextEntries.length > 0) {
    await Entry.insertMany(nextEntries.map(toEntryDocument))
  }

  const total = await Entry.countDocuments()

  res.status(201).json({ imported: entries.length, total })
})

app.post('/entries', async (req, res) => {
  const entry = req.body
  validateEntryPayload(entry)

  await Entry.deleteMany({ $or: [{ _id: entry.id }, { date: entry.date }] })
  const savedEntry = await Entry.create(toEntryDocument(entry))

  res.status(201).json(savedEntry)
})

app.put('/entries/:id', async (req, res) => {
  const entry = req.body
  validateEntryPayload(entry, { requireId: false })

  const entryExists = await Entry.exists({ _id: req.params.id })

  if (!entryExists) {
    return res.status(404).json({ error: 'Lançamento não encontrado' })
  }

  const nextEntry = { ...entry, id: req.params.id }
  await Entry.deleteMany({ date: nextEntry.date, _id: { $ne: req.params.id } })
  const nextEntryDocument = toEntryDocument(nextEntry)
  delete nextEntryDocument._id
  const savedEntry = await Entry.findByIdAndUpdate(req.params.id, { $set: nextEntryDocument }, {
    new: true,
  })

  res.json(savedEntry)
})

app.delete('/entries/:id', async (req, res) => {
  const result = await Entry.deleteOne({ _id: req.params.id })

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Lançamento não encontrado' })
  }

  res.status(204).send()
})

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

app.use((error, req, res, _next) => {
  const status = error.status ?? 500
  const message =
    error instanceof SyntaxError && 'body' in error
      ? 'JSON inválido'
      : error.message || 'Erro interno do servidor'

  if (status >= 500) {
    console.error(error)
  }

  res.status(status).json({ error: message })
})

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Erro ao conectar no MongoDB:', error.message)
    process.exit(1)
  })
