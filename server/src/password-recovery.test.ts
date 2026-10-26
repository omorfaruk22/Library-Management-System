import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { HttpError } from './middleware.js'
import { buildPasswordResetEmail, createPasswordRecoveryService, createResetUrl, hashResetToken, RESET_REQUEST_RESPONSE, RESET_TOKEN_TTL_MS, type PasswordRecoveryRepository, type PasswordResetTransaction, type ResetEmailRequest, type ResetUser } from './password-recovery.js'
import { readSmtpConfiguration } from './mail.js'
import { createPersistentRateLimiter } from './persistent-rate-limit.js'

const TOKEN = 'a'.repeat(64)
const NOW = new Date('2026-10-26T12:00:00.000Z')

type StoredToken = { userId: string; tokenHash: string; expiresAt: Date; createdAt: Date }
class MemoryRecoveryRepository implements PasswordRecoveryRepository {
  users = new Map<string, ResetUser & { passwordHash: string }>([['user-1', { id: 'user-1', email: 'reader@example.com', name: 'Reader', passwordHash: 'old-hash' }]])
  tokens = new Map<string, StoredToken>()
  requestedAudits: string[] = []
  completedAudits: string[] = []
  private tail: Promise<void> = Promise.resolve()

  async findUserByEmail(email: string) { return [...this.users.values()].find((user) => user.email === email) ?? null }
  async wasRecentlyRequested(userId: string, since: Date) { return [...this.tokens.values()].some((token) => token.userId === userId && token.createdAt >= since) }
  async storeResetToken(userId: string, tokenHash: string, expiresAt: Date, createdAt: Date) {
    for (const [hash, token] of this.tokens) if (token.userId === userId) this.tokens.delete(hash)
    this.tokens.set(tokenHash, { userId, tokenHash, expiresAt, createdAt })
  }
  async removeResetToken(tokenHash: string) { this.tokens.delete(tokenHash) }
  async writeRequestedAudit(userId: string) { this.requestedAudits.push(userId) }
  async transaction<T>(work: (tx: PasswordResetTransaction) => Promise<T>): Promise<T> {
    const previous = this.tail
    let release!: () => void
    this.tail = new Promise<void>((resolve) => { release = resolve })
    await previous
    const oldTokens = structuredClone([...this.tokens.entries()])
    const oldUsers = structuredClone([...this.users.entries()])
    const oldAudits = [...this.completedAudits]
    const tx: PasswordResetTransaction = {
      consumeToken: async (tokenHash, now) => {
        const token = this.tokens.get(tokenHash)
        if (!token || token.expiresAt <= now) return null
        this.tokens.delete(tokenHash)
        return { userId: token.userId }
      },
      updatePasswordHash: async (userId, passwordHash) => {
        const user = this.users.get(userId)
        if (!user) return false
        user.passwordHash = passwordHash
        return true
      },
      deleteUserTokens: async (userId) => {
        for (const [hash, token] of this.tokens) if (token.userId === userId) this.tokens.delete(hash)
      },
      writeCompletedAudit: async (userId) => { this.completedAudits.push(userId) },
    }
    try { return await work(tx) }
    catch (error) {
      this.tokens = new Map(oldTokens)
      this.users = new Map(oldUsers)
      this.completedAudits = oldAudits
      throw error
    } finally { release() }
  }
}

let repository: MemoryRecoveryRepository
let messages: ResetEmailRequest[]
let currentTime: Date
let sendFailure: Error | null
function makeService() {
  return createPasswordRecoveryService(repository, {
    async send(message) { if (sendFailure) throw sendFailure; messages.push(message) },
  }, {
    now: () => new Date(currentTime),
    tokenGenerator: () => TOKEN,
    hashPassword: async (password) => `bcrypt-test:${password}`,
    appUrl: 'https://library.example',
  })
}
beforeEach(() => {
  repository = new MemoryRecoveryRepository()
  messages = []
  currentTime = new Date(NOW)
  sendFailure = null
})

describe('secure password recovery', () => {
  it('stores only a SHA-256 token hash and mails a 30-minute one-time reset URL', async () => {
    const result = await makeService().requestReset(' READER@example.com ')
    const tokenHash = hashResetToken(TOKEN)
    expect(result.message).toBe(RESET_REQUEST_RESPONSE)
    expect(repository.tokens.has(tokenHash)).toBe(true)
    expect(repository.tokens.has(TOKEN)).toBe(false)
    expect(repository.tokens.get(tokenHash)?.expiresAt.toISOString()).toBe(new Date(NOW.getTime() + RESET_TOKEN_TTL_MS).toISOString())
    expect(messages).toHaveLength(1)
    expect(messages[0]?.resetUrl).toBe(`https://library.example/reset-password?token=${TOKEN}`)
    expect(repository.requestedAudits).toEqual(['user-1'])
  })

  it('returns the same generic response for unknown accounts and enforces the per-account cooldown', async () => {
    const service = makeService()
    const first = await service.requestReset('reader@example.com')
    const second = await service.requestReset('reader@example.com')
    const unknown = await service.requestReset('nobody@example.com')
    expect(first.message).toBe(second.message)
    expect(second.message).toBe(unknown.message)
    expect(messages).toHaveLength(1)
  })

  it('removes the token after an email delivery failure and keeps the response generic', async () => {
    sendFailure = new Error('provider outage')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await makeService().requestReset('reader@example.com')
    expect(result.message).toBe(RESET_REQUEST_RESPONSE)
    expect(repository.tokens.size).toBe(0)
    expect(messages).toHaveLength(0)
    errorLog.mockRestore()
  })

  it('rejects expired tokens without changing the password', async () => {
    await makeService().requestReset('reader@example.com')
    currentTime = new Date(NOW.getTime() + RESET_TOKEN_TTL_MS + 1)
    await expect(makeService().completeReset(TOKEN, 'new-password-123')).rejects.toMatchObject({ status: 400 })
    expect(repository.users.get('user-1')?.passwordHash).toBe('old-hash')
  })

  it('consumes a valid reset token once, changes the password, clears tokens, and audits', async () => {
    await makeService().requestReset('reader@example.com')
    const result = await makeService().completeReset(TOKEN, 'new-password-123')
    expect(result.message).toContain('Password updated')
    expect(repository.users.get('user-1')?.passwordHash).toBe('bcrypt-test:new-password-123')
    expect(repository.tokens.size).toBe(0)
    expect(repository.completedAudits).toEqual(['user-1'])
    await expect(makeService().completeReset(TOKEN, 'another-password-123')).rejects.toBeInstanceOf(HttpError)
  })

  it('allows only one concurrent reset to consume a token', async () => {
    await makeService().requestReset('reader@example.com')
    const results = await Promise.allSettled([
      makeService().completeReset(TOKEN, 'first-password-123'),
      makeService().completeReset(TOKEN, 'second-password-123'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(repository.completedAudits).toHaveLength(1)
    expect(repository.users.get('user-1')?.passwordHash).toMatch(/^bcrypt-test:(first|second)-password-123$/)
  })

  it('requires HTTPS reset links except on loopback during local development', () => {
    expect(createResetUrl(TOKEN, 'https://library.example')).toContain('https://library.example/reset-password')
    expect(createResetUrl(TOKEN, 'http://localhost:5173')).toContain('http://localhost:5173/reset-password')
    expect(() => createResetUrl(TOKEN, 'http://library.example')).toThrow('APP_URL must be HTTPS')
  })

  it('escapes user-controlled content in bilingual HTML reset templates', () => {
    const { html, text, subject } = buildPasswordResetEmail('<script>alert("x")</script>', 'https://library.example/reset-password?token=abc', 30)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
    expect(text).toContain('একবার ব্যবহারযোগ্য')
    expect(subject).toContain('পাসওয়ার্ড')
  })
})

describe('SMTP configuration', () => {
  it('uses provider SMTP settings and infers TLS for the standard secure port', () => {
    expect(readSmtpConfiguration({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASSWORD: 'p', MAIL_FROM: 'Library <mail@example.com>' })).toMatchObject({ host: 'smtp.example.com', port: 465, secure: true, user: 'u', password: 'p' })
    expect(readSmtpConfiguration({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'u', SMTP_PASSWORD: 'p', MAIL_FROM: 'mail@example.com' }).secure).toBe(false)
  })
  it('rejects missing provider credentials and invalid ports', () => {
    expect(() => readSmtpConfiguration({})).toThrow('SMTP_HOST')
    expect(() => readSmtpConfiguration({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '0', SMTP_USER: 'u', SMTP_PASSWORD: 'p', MAIL_FROM: 'mail@example.com' })).toThrow('SMTP_PORT')
  })
})

describe('persistent per-IP rate limiting', () => {
  it('applies an atomic fixed-window limit and gives a retry hint', async () => {
    const counts = new Map<string, number>()
    const limiter = createPersistentRateLimiter({
      namespace: 'forgot-password', limit: 2, windowMs: 60_000, message: 'Too many password recovery requests.',
      now: () => new Date('2026-10-26T12:00:15.000Z'),
      async increment(key) { const count = (counts.get(key) ?? 0) + 1; counts.set(key, count); return count },
    })
    const call = async (ip = '203.0.113.10') => new Promise<{ status: number; body: unknown; headers: Record<string, string>; next: boolean }>((resolve, reject) => {
      let status = 200; let body: unknown; let nextCalled = false; const headers: Record<string, string> = {}
      const response = {
        setHeader(name: string, value: string) { headers[name] = value; return this },
        status(value: number) { status = value; return this },
        json(value: unknown) { body = value; resolve({ status, body, headers, next: nextCalled }); return this },
      } as unknown as Response
      const request = { ip, socket: { remoteAddress: ip } } as Request
      limiter(request, response, (error?: unknown) => { if (error) reject(error); else { nextCalled = true; resolve({ status, body, headers, next: nextCalled }) } })
    })
    expect((await call()).next).toBe(true)
    expect((await call()).next).toBe(true)
    const limited = await call()
    expect(limited.status).toBe(429)
    expect(limited.body).toEqual({ error: 'Too many password recovery requests.' })
    expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0)
    expect((await call('2001:db8:abcd:12::1')).next).toBe(true)
    expect((await call('2001:db8:abcd:12:ffff::1')).next).toBe(true)
    expect((await call('2001:db8:abcd:12:eeee::1')).status).toBe(429)
  })
})
