import nodemailer from 'nodemailer'
import { buildPasswordResetEmail, type PasswordResetMailer, type ResetEmailRequest } from './password-recovery.js'

export type SmtpEnvironment = {
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_SECURE?: string
  SMTP_USER?: string
  SMTP_PASSWORD?: string
  MAIL_FROM?: string
}
export function readSmtpConfiguration(env: SmtpEnvironment) {
  const host = env.SMTP_HOST?.trim()
  const user = env.SMTP_USER?.trim()
  const password = env.SMTP_PASSWORD
  const from = env.MAIL_FROM?.trim()
  const port = Number(env.SMTP_PORT || 587)
  if (!host || !user || !password || !from) throw new Error('Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and MAIL_FROM.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid TCP port.')
  let secure = port === 465
  if (env.SMTP_SECURE?.trim()) {
    if (!['true', 'false'].includes(env.SMTP_SECURE.trim().toLowerCase())) throw new Error('SMTP_SECURE must be true or false.')
    secure = env.SMTP_SECURE.trim().toLowerCase() === 'true'
  }
  return { host, port, secure, user, password, from }
}

export function createSmtpPasswordResetMailer(env: SmtpEnvironment = process.env): PasswordResetMailer {
  return {
    async send(message: ResetEmailRequest) {
      const config = readSmtpConfiguration(env)
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: { minVersion: 'TLSv1.2' },
      })
      const template = buildPasswordResetEmail(message.name, message.resetUrl, message.expiresInMinutes)
      try {
        await transporter.sendMail({ from: config.from, to: message.to, ...template })
      } finally {
        transporter.close()
      }
    },
  }
}
export async function sendEmailChangeVerification(to: string, name: string, verificationUrl: string, env: SmtpEnvironment = process.env) {
  const config = readSmtpConfiguration(env)
  const transporter = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2' },
  })
  try {
    const { buildEmailChangeVerificationEmail } = await import('./email-verification.js')
    await transporter.sendMail({ from: config.from, to, ...buildEmailChangeVerificationEmail(name, verificationUrl) })
  } finally { transporter.close() }
}
