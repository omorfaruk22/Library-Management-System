import { createHash, randomBytes } from 'node:crypto'
import { HttpError } from './middleware.js'

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
export const RESET_REQUEST_COOLDOWN_MS = 60 * 1000
export const RESET_REQUEST_RESPONSE = 'If an account exists for that email, a reset link will be sent.'
export const RESET_COMPLETE_RESPONSE = 'Password updated. You can sign in now.'
export const INVALID_RESET_RESPONSE = 'This reset link is invalid or has expired.'

export type ResetUser = { id: string; email: string; name: string }
export type ResetEmail = { subject: string; text: string; html: string }
export type ResetEmailRequest = { to: string; name: string; resetUrl: string; expiresInMinutes: number }
export interface PasswordResetTransaction {
  consumeToken(tokenHash: string, now: Date): Promise<{ userId: string } | null>
  updatePasswordHash(userId: string, passwordHash: string): Promise<boolean>
  deleteUserTokens(userId: string): Promise<void>
  writeCompletedAudit(userId: string): Promise<void>
}
export interface PasswordRecoveryRepository {
  findUserByEmail(email: string): Promise<ResetUser | null>
  wasRecentlyRequested(userId: string, since: Date): Promise<boolean>
  storeResetToken(userId: string, tokenHash: string, expiresAt: Date, createdAt: Date): Promise<void>
  removeResetToken(tokenHash: string): Promise<void>
  writeRequestedAudit(userId: string): Promise<void>
  transaction<T>(work: (tx: PasswordResetTransaction) => Promise<T>): Promise<T>
}
export interface PasswordResetMailer { send(message: ResetEmailRequest): Promise<void> }
type ServiceOptions = { now?: () => Date; tokenGenerator?: () => string; hashPassword: (password: string) => Promise<string>; appUrl: string; tokenTtlMs?: number }

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
export function createResetToken(now = new Date(), tokenGenerator: () => string = () => randomBytes(32).toString('hex'), ttlMs = RESET_TOKEN_TTL_MS) {
  const token = tokenGenerator()
  if (!/^[a-f\d]{64}$/i.test(token)) throw new Error('Reset token generator returned an invalid token.')
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + ttlMs) }
}
export function createResetUrl(token: string, appUrl: string): string {
  const base = new URL(appUrl)
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || (base.protocol === 'http:' && !localhost)) throw new Error('APP_URL must be HTTPS, except for a local development URL.')
  const url = new URL('/reset-password', base)
  url.searchParams.set('token', token)
  return url.toString()
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
export function buildPasswordResetEmail(name: string, resetUrl: string, expiresInMinutes = 30): ResetEmail {
  const safeName = name.replace(/[\r\n\t]/g, ' ').trim() || 'reader'
  const htmlName = escapeHtml(safeName)
  const htmlUrl = escapeHtml(resetUrl)
  const subject = 'Reset your Leafline Library password | পাসওয়ার্ড রিসেট'
  const text = `Hello ${safeName},\n\nWe received a request to reset your Leafline Library password. Use this one-time link within ${expiresInMinutes} minutes:\n${resetUrl}\n\nIf you did not request this change, you can ignore this email.\n\n---\n\nপ্রিয় ${safeName},\nআপনার Leafline Library পাসওয়ার্ড রিসেটের অনুরোধ এসেছে। ${expiresInMinutes} মিনিটের মধ্যে একবার ব্যবহারযোগ্য লিংকটি ব্যবহার করুন:\n${resetUrl}\n\nআপনি অনুরোধটি না করলে ইমেইলটি উপেক্ষা করুন।`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f4f7f5"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 32px;background:#166534;color:#fff;font-size:20px;font-weight:700">Leafline Library</td></tr><tr><td style="padding:32px"><p>Hello ${htmlName},</p><h1 style="font-size:23px;margin:12px 0">Reset your password</h1><p style="line-height:1.6;color:#475569">We received a request to reset your library password. This link expires in ${expiresInMinutes} minutes and can be used once.</p><p style="margin:28px 0"><a href="${htmlUrl}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#15803d;color:#fff;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:13px;line-height:1.6;color:#64748b">If the button does not work, copy this link into your browser:<br><a href="${htmlUrl}" style="color:#15803d;word-break:break-all">${htmlUrl}</a></p><hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0"><div lang="bn"><h2 style="font-size:19px">পাসওয়ার্ড রিসেট করুন</h2><p style="line-height:1.7;color:#475569">এই লিংকটি ${expiresInMinutes} মিনিটের মধ্যে একবার ব্যবহার করা যাবে। আপনি অনুরোধটি না করলে ইমেইলটি উপেক্ষা করুন।</p><p><a href="${htmlUrl}" style="color:#15803d;word-break:break-all">পাসওয়ার্ড রিসেট লিংক</a></p></div><p style="margin-top:30px;font-size:12px;color:#64748b">If you did not request this change, ignore this email. / আপনি অনুরোধটি না করলে ইমেইলটি উপেক্ষা করুন।</p></td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}

export function createPasswordRecoveryService(repository: PasswordRecoveryRepository, mailer: PasswordResetMailer, options: ServiceOptions) {
  const now = options.now ?? (() => new Date())
  return {
    async requestReset(emailInput: string): Promise<{ message: string }> {
      const user = await repository.findUserByEmail(emailInput.trim().toLowerCase())
      if (!user) return { message: RESET_REQUEST_RESPONSE }
      const createdAt = now()
      if (await repository.wasRecentlyRequested(user.id, new Date(createdAt.getTime() - RESET_REQUEST_COOLDOWN_MS))) return { message: RESET_REQUEST_RESPONSE }

      const reset = createResetToken(createdAt, options.tokenGenerator, options.tokenTtlMs)
      await repository.storeResetToken(user.id, reset.tokenHash, reset.expiresAt, createdAt)
      try {
        const resetUrl = createResetUrl(reset.token, options.appUrl)
        await mailer.send({ to: user.email, name: user.name, resetUrl, expiresInMinutes: (options.tokenTtlMs ?? RESET_TOKEN_TTL_MS) / 60_000 })
      } catch {
        await repository.removeResetToken(reset.tokenHash).catch(() => undefined)
        console.error('Password reset email delivery failed. Check SMTP configuration and provider logs.')
        return { message: RESET_REQUEST_RESPONSE }
      }
      await repository.writeRequestedAudit(user.id).catch(() => console.error('Password reset request audit write failed.'))
      return { message: RESET_REQUEST_RESPONSE }
    },

    async completeReset(token: string, newPassword: string): Promise<{ message: string }> {
      if (!/^[a-f\d]{64}$/i.test(token)) throw new HttpError(400, INVALID_RESET_RESPONSE)
      const passwordHash = await options.hashPassword(newPassword)
      const tokenHash = hashResetToken(token)
      const completed = await repository.transaction(async (tx) => {
        const reset = await tx.consumeToken(tokenHash, now())
        if (!reset) return false
        if (!(await tx.updatePasswordHash(reset.userId, passwordHash))) return false
        await tx.deleteUserTokens(reset.userId)
        await tx.writeCompletedAudit(reset.userId)
        return true
      })
      if (!completed) throw new HttpError(400, INVALID_RESET_RESPONSE)
      return { message: RESET_COMPLETE_RESPONSE }
    },
  }
}