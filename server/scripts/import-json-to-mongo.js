import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { connectDb } from '../db.js'
import { Entry, Settings } from '../models.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'data', 'db.json')

function toEntryDocument(entry) {
  const { id, ...data } = entry
  return { _id: id, ...data }
}

try {
  await connectDb()

  const raw = await readFile(DB_PATH, 'utf8')
  const data = JSON.parse(raw)
  const entries = Array.isArray(data.entries) ? data.entries.filter((entry) => entry.id && entry.date) : []

  if (entries.length > 0) {
    const ids = entries.map((entry) => entry.id)
    const dates = entries.map((entry) => entry.date)

    await Entry.deleteMany({ $or: [{ _id: { $in: ids } }, { date: { $in: dates } }] })
    await Entry.insertMany(entries.map(toEntryDocument))
  }

  if (data.settings && typeof data.settings === 'object') {
    await Settings.findByIdAndUpdate('default', { $set: data.settings }, { upsert: true })
  }

  console.log(`Importação concluída: ${entries.length} lançamento(s).`)
} catch (error) {
  console.error('Falha na importação:', error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
