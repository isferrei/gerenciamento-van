import mongoose from 'mongoose'

const entrySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true, unique: true, index: true },
  },
  {
    strict: false,
    versionKey: false,
  },
)

entrySchema.set('toJSON', {
  transform(_document, returned) {
    returned.id = returned._id
    delete returned._id
  },
})

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
  },
  {
    strict: false,
    versionKey: false,
  },
)

settingsSchema.set('toJSON', {
  transform(_document, returned) {
    delete returned._id
  },
})

export const Entry = mongoose.model('Entry', entrySchema)
export const Settings = mongoose.model('Settings', settingsSchema)
