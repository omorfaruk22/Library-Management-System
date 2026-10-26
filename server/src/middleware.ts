import type { NextFunction, Request, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'
import { z, ZodError } from 'zod'
import { AuditLog, User } from './models.js'

export interface SessionUser { id: string; role: 'admin' | 'student'; email: string; name: string; studentId?: string }
export interface SessionAccount extends SessionUser { status: 'active' | 'suspended' }
export type SessionAccountLookup = (id: string) => Promise<SessionAccount | null>
// Express request augmentation is required to type authenticated API handlers.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request { user?: SessionUser } } }
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'HttpError' } }
export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next) }
}

/** Verifies the cookie and reloads the account so revoked or changed roles take effect immediately. */
export function createRequireAuth(lookup: SessionAccountLookup, getSecret: () => string | undefined = () => process.env.JWT_SECRET): RequestHandler {
  return (req, _res, next) => {
    const token = req.cookies?.library_session
    if (!token) return next(new HttpError(401, 'Please sign in to continue.'))
    let subject: string
    try {
      const secret = getSecret()
      if (!secret || secret.length < 32) throw new Error('Invalid JWT configuration')
      const claims = jwt.verify(token, secret)
      if (typeof claims === 'string' || typeof claims.sub !== 'string' || !claims.sub) throw new Error('Invalid session subject')
      subject = claims.sub
    } catch { return next(new HttpError(401, 'Your session has expired. Please sign in again.')) }
    void lookup(subject).then((account) => {
      if (!account || account.status !== 'active') return next(new HttpError(401, 'Please sign in to continue.'))
      req.user = { id: account.id, role: account.role, email: account.email, name: account.name, studentId: account.studentId }
      return next()
    }).catch(next)
  }
}

const lookupSessionAccount: SessionAccountLookup = async (id) => {
  const account = await User.findById(id).select('name email role studentId status').lean().exec() as { _id: unknown; name: string; email: string; role: 'admin' | 'student'; studentId?: string; status: 'active' | 'suspended' } | null
  return account ? { id: String(account._id), name: account.name, email: account.email, role: account.role, studentId: account.studentId, status: account.status } : null
}
export const requireAuth = createRequireAuth(lookupSessionAccount)

export function requireRole(role: 'admin' | 'student') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'))
    if (req.user.role !== role) return next(new HttpError(403, 'You do not have permission to access this resource.'))
    return next()
  }
}
export async function audit(req: Request, action: string, entity: string, entityId = '', details: Record<string, unknown> = {}) {
  await AuditLog.create({ actor: req.user?.id ?? null, action, entity, entityId, details, ip: req.ip })
}
export function validate<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> { return schema.parse(body) }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Please check the submitted information.', details: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })) })
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  const e = err as { code?: number | string; name?: string; message?: string }
  if (e.code === 11000) return res.status(409).json({ error: 'A record with that value already exists.' })
  const safeMessage = String(e.message ?? 'Unknown server error').replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'MongoDB URI [redacted]').slice(0, 400)
  const errorName = e.name ?? 'Error'
  console.error('API error:', { name: errorName, code: e.code, message: safeMessage })
  const message = process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : `${errorName}: ${safeMessage}`
  return res.status(500).json({ error: message })
}
