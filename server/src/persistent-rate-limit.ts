import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import type { RequestHandler } from 'express'
import { RateLimitCounter } from './models.js'

export type RateLimitIncrement = (key: string, expiresAt: Date) => Promise<number>
export type PersistentRateLimitOptions = {
  namespace: string
  limit: number
  windowMs: number
  message: string
  increment: RateLimitIncrement
  now?: () => Date
}

export function createPersistentRateLimiter(options: PersistentRateLimitOptions): RequestHandler {
  const clock = options.now ?? (() => new Date())
  return (req, res, next) => {
    const timestamp = clock().getTime()
    const windowStart = Math.floor(timestamp / options.windowMs) * options.windowMs
    const resetAt = windowStart + options.windowMs
    const ip = normalizedIp(req.ip || req.socket.remoteAddress || 'unknown')
    const key = createHash('sha256').update(`${options.namespace}\\0${ip}\\0${windowStart}`).digest('hex')
    void options.increment(key, new Date(resetAt + options.windowMs)).then((count) => {
      if (count > options.limit) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - timestamp) / 1000))))
        res.status(429).json({ error: options.message })
        return
      }
      next()
    }).catch(next)
  }
}

function normalizedIp(value: string): string {
  const ip = value.trim().toLowerCase().split('%')[0] ?? ''
  if (isIP(ip) === 4) return ip
  if (isIP(ip) !== 6) return ip
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip)?.[1]
  if (mappedIpv4) return mappedIpv4
  const [left = '', right = ''] = ip.split('::')
  const leftParts = left ? left.split(':') : []
  const rightParts = right ? right.split(':') : []
  const groups = [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0'), ...rightParts]
  return groups.slice(0, 4).map((group) => Number.parseInt(group || '0', 16).toString(16).padStart(4, '0')).join(':') + '::/64'
}

export async function incrementMongoRateLimitCounter(key: string, expiresAt: Date): Promise<number> {
  try {
    const counter = await RateLimitCounter.findOneAndUpdate(
      { _id: key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean().exec() as { count: number } | null
    if (!counter) throw new Error('Unable to update rate limit counter.')
    return counter.count
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw new Error('Failed to increment persistent rate-limit counter.', { cause: error })
    const counter = await RateLimitCounter.findOneAndUpdate(
      { _id: key },
      { $inc: { count: 1 } },
      { returnDocument: 'after' },
    ).lean().exec() as { count: number } | null
    if (!counter) throw new Error('Unable to update rate limit counter.', { cause: error })
    return counter.count
  }
}
