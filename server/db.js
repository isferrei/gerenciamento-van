import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import mongoose from 'mongoose'

let connectionPromise
const __dirname = dirname(fileURLToPath(import.meta.url))

config({ path: join(__dirname, '.env') })

export async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI não está definida')
  }

  connectionPromise ??= mongoose.connect(process.env.MONGODB_URI)

  return connectionPromise
}
