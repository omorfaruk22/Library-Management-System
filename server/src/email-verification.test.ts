import { describe, expect, it } from 'vitest'
import { buildEmailChangeVerificationEmail, createEmailChangeToken, createEmailVerificationUrl, hashEmailChangeToken, EMAIL_CHANGE_TOKEN_TTL_MS } from './email-verification.js'

describe('email change verification tokens', () => {
  it('stores only a hash and expires the token after 30 minutes', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const token = createEmailChangeToken(now)
    expect(token.token).toHaveLength(64)
    expect(token.tokenHash).toBe(hashEmailChangeToken(token.token))
    expect(token.tokenHash).not.toBe(token.token)
    expect(token.expiresAt.getTime() - now.getTime()).toBe(EMAIL_CHANGE_TOKEN_TTL_MS)
  })
  it('creates a safe confirmation link and bilingual template', () => {
    const url = createEmailVerificationUrl('a'.repeat(64), 'http://localhost:5173')
    expect(url).toContain('/verify-email?token=')
    expect(buildEmailChangeVerificationEmail('<reader>', url).html).toContain('&lt;reader&gt;')
    expect(() => createEmailVerificationUrl('token', 'http://library.example')).toThrow()
  })
})
