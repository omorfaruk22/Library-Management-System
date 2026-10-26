import { createHash, randomBytes } from 'node:crypto'

export const EMAIL_CHANGE_TOKEN_TTL_MS = 30 * 60 * 1000
export function hashEmailChangeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
export function createEmailChangeToken(now = new Date()) {
  const token = randomBytes(32).toString('hex')
  return { token, tokenHash: hashEmailChangeToken(token), expiresAt: new Date(now.getTime() + EMAIL_CHANGE_TOKEN_TTL_MS) }
}
export function createEmailVerificationUrl(token: string, appUrl: string): string {
  const base = new URL(appUrl)
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || (base.protocol === 'http:' && !localhost)) throw new Error('APP_URL must be HTTPS, except for a local development URL.')
  const url = new URL('/verify-email', base)
  url.searchParams.set('token', token)
  return url.toString()
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
export function buildEmailChangeVerificationEmail(name: string, verificationUrl: string) {
  const safeName = name.replace(/[\r\n\t]/g, ' ').trim() || 'reader'
  const safeUrl = escapeHtml(verificationUrl)
  return {
    subject: 'Verify your Leafline Library email | ইমেইল নিশ্চিত করুন',
    text: `Hello ${safeName},\n\nConfirm your new library email address by opening this one-time link within 30 minutes:\n${verificationUrl}\n\nIf you did not request this change, ignore this message.\n\nপ্রিয় ${safeName},\nনতুন ইমেইল ঠিকানাটি নিশ্চিত করতে ৩০ মিনিটের মধ্যে এই একবার ব্যবহারযোগ্য লিংকটি খুলুন:\n${verificationUrl}`,
    html: `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;background:#f4f7f5;color:#172033;padding:24px"><main style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px"><h1 style="color:#166534">Leafline Library</h1><p>Hello ${escapeHtml(safeName)},</p><p>Verify your new email address. This one-time link expires in 30 minutes.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#15803d;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p><p lang="bn">নতুন ইমেইল ঠিকানাটি নিশ্চিত করতে ৩০ মিনিটের মধ্যে এই লিংকটি ব্যবহার করুন।</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you did not request this change, ignore this message. / আপনি অনুরোধটি না করলে ইমেইলটি উপেক্ষা করুন।</p></main></body></html>`,
  }
}
