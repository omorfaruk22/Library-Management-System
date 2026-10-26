import dotenv from 'dotenv'
dotenv.config({ path: ['.env.local', '.env'] })

export function passwordResetTokenTtlMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.PASSWORD_RESET_TOKEN_TTL_MINUTES === undefined ? 30 : Number(env.PASSWORD_RESET_TOKEN_TTL_MINUTES)
  if (!Number.isInteger(value) || value < 5 || value > 120) throw new Error('PASSWORD_RESET_TOKEN_TTL_MINUTES must be a whole number from 5 to 120.')
  return value
}

export function validateServerEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required for the Library API.')
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
  passwordResetTokenTtlMinutes(env)
  if (env.NODE_ENV === 'production' && (!env.APP_URL || !env.APP_URL.startsWith('https://'))) throw new Error('APP_URL must be an HTTPS origin in production.')
  const smtpValues = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASSWORD, env.MAIL_FROM]
  if (smtpValues.some(Boolean) && !smtpValues.every(Boolean)) throw new Error('Configure all SMTP variables or leave them unset to disable email delivery.')
}
