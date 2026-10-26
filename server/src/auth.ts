import express, { type Request, type Response } from 'express'
import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createPersistentRateLimiter, incrementMongoRateLimitCounter } from './persistent-rate-limit.js'
import { z } from 'zod'
import { AuditLog, EmailVerification, User, PasswordReset } from './models.js'
import { createSmtpPasswordResetMailer } from './mail.js'
import { MongoosePasswordRecoveryRepository } from './password-recovery-repository.js'
import { createPasswordRecoveryService } from './password-recovery.js'
import { hashEmailChangeToken } from './email-verification.js'
import { passwordResetTokenTtlMinutes } from './env.js'
import { asyncRoute, audit, HttpError, requireAuth, validate } from './middleware.js'

const signupSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), password: z.string().min(10).max(128), phone: z.string().trim().max(30).refine((value) => !value || /^\+?[0-9()\-\s]{7,30}$/.test(value), 'Enter a valid mobile number.').optional() })
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) })
const credentialLimiter = createPersistentRateLimiter({ namespace: 'credentials', limit: 10, windowMs: 15 * 60 * 1000, message: 'Too many sign-in or registration attempts. Please wait and try again.', increment: incrementMongoRateLimitCounter })
const forgotPasswordLimiter = createPersistentRateLimiter({ namespace: 'forgot-password', limit: 5, windowMs: 15 * 60 * 1000, message: 'Too many password recovery requests. Please wait and try again.', increment: incrementMongoRateLimitCounter })
const resetPasswordLimiter = createPersistentRateLimiter({ namespace: 'reset-password', limit: 8, windowMs: 15 * 60 * 1000, message: 'Too many password reset attempts. Please wait and try again.', increment: incrementMongoRateLimitCounter })
const changePasswordLimiter = createPersistentRateLimiter({ namespace: 'change-password', limit: 5, windowMs: 15 * 60 * 1000, message: 'Too many password change attempts. Please wait and try again.', increment: incrementMongoRateLimitCounter })
const emailVerificationLimiter = createPersistentRateLimiter({ namespace: 'email-verification', limit: 8, windowMs: 15 * 60 * 1000, message: 'Too many email verification attempts. Please wait and try again.', increment: incrementMongoRateLimitCounter })
const sessionCookie = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 604800000 })
function clearSession(res: Response) { res.clearCookie('library_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' }) }
function setSession(res: Response, user: { id: string; role: string; email: string; name: string; studentId?: string }) {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
  const token = jwt.sign({ role: user.role, email: user.email, name: user.name, studentId: user.studentId }, secret, { subject: user.id, expiresIn: '7d' })
  res.cookie('library_session', token, sessionCookie())
}

export function authRoutes() {
  const router = express.Router()
  const passwordRecovery = createPasswordRecoveryService(new MongoosePasswordRecoveryRepository(), createSmtpPasswordResetMailer(), {
    hashPassword: (password) => bcrypt.hash(password, 12),
    appUrl: process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
    tokenTtlMs: passwordResetTokenTtlMinutes() * 60_000,
  })
  router.post('/register', credentialLimiter, asyncRoute(async (req: Request, res: Response) => {
    const data = validate(signupSchema, req.body)
    const passwordHash = await bcrypt.hash(data.password, 12)
    const user = await User.create({ name: data.name, email: data.email.toLowerCase(), passwordHash, phone: data.phone ?? '', role: 'student', studentId: 'STU-' + randomBytes(3).toString('hex').toUpperCase() })
    setSession(res, { id: String(user._id), role: user.role, email: user.email, name: user.name, studentId: user.studentId })
    await audit(req, 'register', 'user', String(user._id))
    res.status(201).json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, studentId: user.studentId, phone: user.phone } })
  }))
  const login = (role: 'admin' | 'student') => asyncRoute(async (req: Request, res: Response) => {
    const data = validate(loginSchema, req.body)
    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash')
    if (!user || user.status !== 'active' || !(await bcrypt.compare(data.password, user.passwordHash)) || user.role !== role) throw new HttpError(401, 'Email or password is incorrect.')
    setSession(res, { id: String(user._id), role: user.role, email: user.email, name: user.name, studentId: user.studentId })
    await audit(req, 'login', 'user', String(user._id), { role })
    res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, studentId: user.studentId, phone: user.phone } })
  })
  router.post('/login', credentialLimiter, login('student'))
  router.post('/admin/login', credentialLimiter, login('admin'))
  router.post('/logout', (_req: Request, res: Response) => { clearSession(res); res.json({ ok: true }) })
  router.get('/me', requireAuth, asyncRoute(async (req: Request, res: Response) => {
    const user = await User.findOne({ _id: req.user!.id }).select('name email role studentId phone status createdAt updatedAt').lean() as unknown as { _id: unknown; status: string; name: string; email: string; role: string; studentId?: string; phone?: string; createdAt?: Date; updatedAt?: Date } | null
    if (!user || user.status !== 'active') throw new HttpError(401, 'Please sign in to continue.')
    res.json({ user: { ...user, id: String(user._id) } })
  }))
  router.post('/change-password', changePasswordLimiter, requireAuth, asyncRoute(async (req: Request, res: Response) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) }).parse(req.body)
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(req.user!.id).select('+passwordHash').session(session).exec()
        if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect.')
        if (await bcrypt.compare(body.newPassword, user.passwordHash)) throw new HttpError(400, 'New password must be different from the current password.')
        user.passwordHash = await bcrypt.hash(body.newPassword, 12)
        await user.save({ session })
        await PasswordReset.deleteMany({ user: user._id }, { session })
        await EmailVerification.deleteMany({ user: user._id }, { session })
        await AuditLog.create([{ actor: user._id, action: 'change_password', entity: 'user', entityId: String(user._id), details: {}, ip: req.ip }], { session })
      })
    } finally { await session.endSession() }
    clearSession(res)
    res.json({ ok: true, message: 'Password updated. Please sign in again.' })
  }))
  router.post('/forgot-password', forgotPasswordLimiter, asyncRoute(async (req: Request, res: Response) => {
    const { email } = validate(z.object({ email: z.string().trim().email().max(254) }), req.body)
    res.status(202).json(await passwordRecovery.requestReset(email))
  }))
  router.post('/reset-password', resetPasswordLimiter, asyncRoute(async (req: Request, res: Response) => {
    const { token, password } = validate(z.object({ token: z.string().regex(/^[a-f\d]{64}$/i), password: z.string().min(10).max(128) }), req.body)
    res.json(await passwordRecovery.completeReset(token, password))
  }))
  router.post('/verify-email', emailVerificationLimiter, asyncRoute(async (req: Request, res: Response) => {
    const { token } = validate(z.object({ token: z.string().regex(/^[a-f\d]{64}$/i) }), req.body)
    const session = await mongoose.startSession()
    let verified = false
    try {
      await session.withTransaction(async () => {
        const record = await EmailVerification.findOneAndDelete({ tokenHash: hashEmailChangeToken(token), expiresAt: { $gt: new Date() } }, { session }).lean().exec() as any
        if (!record) return
        const user = await User.findByIdAndUpdate(record.user, { $set: { email: record.email } }, { new: true, runValidators: true, session }).select('name email role studentId phone').lean().exec()
        if (!user) return
        await EmailVerification.deleteMany({ user: record.user }, { session })
        await AuditLog.create([{ actor: record.user, action: 'verify_email_change', entity: 'user', entityId: String(record.user), details: {}, ip: req.ip }], { session })
        verified = true
      })
    } finally { await session.endSession() }
    if (!verified) throw new HttpError(400, 'This verification link is invalid or has expired.')
    res.json({ ok: true, message: 'Email address verified. Sign in again to refresh your account.' })
  }))
  return router
}
