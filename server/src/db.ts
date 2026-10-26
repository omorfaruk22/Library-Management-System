import mongoose from 'mongoose'

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
const globalCache = globalThis as typeof globalThis & { mongooseCache?: Cache }
const cached = globalCache.mongooseCache ?? (globalCache.mongooseCache = { conn: null, promise: null })

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) { cached.conn = null; cached.promise = null }
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  if (!cached.promise) cached.promise = mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    cached.conn = null
    cached.promise = null
    throw error
  }
}
