import { describe, expect, it } from 'vitest'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { createRequireAuth, HttpError, requireRole, type SessionAccount } from './middleware.js'

const SECRET = 'test-only-session-secret-at-least-32-chars'
function requestFor(accountId = 'user-1', claimedRole = 'admin') {
  const token = jwt.sign({ role: claimedRole }, SECRET, { subject: accountId, expiresIn: '15m' })
  return { cookies: { library_session: token } } as unknown as Request
}
function invoke(middleware: (req: Request, res: Response, next: (error?: unknown) => void) => unknown, req: Request) {
  return new Promise<unknown>((resolve) => middleware(req, {} as Response, (error) => resolve(error ?? null)))
}
const activeStudent: SessionAccount = { id: 'user-1', role: 'student', email: 's@example.com', name: 'Student', studentId: 'STU-1', status: 'active' }

describe('session authorization boundaries', () => {
  it('loads the current database role instead of trusting the role in the cookie', async () => {
    const req = requestFor('user-1', 'admin')
    const requireAuth = createRequireAuth(async () => activeStudent, () => SECRET)
    expect(await invoke(requireAuth, req)).toBeNull()
    expect(req.user?.role).toBe('student')
    const roleError = await invoke(requireRole('admin'), req)
    expect(roleError).toBeInstanceOf(HttpError)
    expect((roleError as HttpError).status).toBe(403)
  })

  it('revokes access immediately for suspended or deleted accounts', async () => {
    const suspended = createRequireAuth(async () => ({ ...activeStudent, status: 'suspended' }), () => SECRET)
    const denied = await invoke(suspended, requestFor())
    expect(denied).toBeInstanceOf(HttpError)
    expect((denied as HttpError).status).toBe(401)
    const deleted = createRequireAuth(async () => null, () => SECRET)
    expect((await invoke(deleted, requestFor()))).toMatchObject({ status: 401 })
  })

  it('rejects missing, malformed, and bad-signature cookies', async () => {
    const requireAuth = createRequireAuth(async () => activeStudent, () => SECRET)
    const noCookie = await invoke(requireAuth, {} as Request)
    const badCookie = await invoke(requireAuth, { cookies: { library_session: 'bad-token' } } as unknown as Request)
    expect(noCookie).toMatchObject({ status: 401 })
    expect(badCookie).toMatchObject({ status: 401 })
  })

  it('allows an active student through the student role boundary', async () => {
    const req = requestFor()
    await invoke(createRequireAuth(async () => activeStudent, () => SECRET), req)
    expect(await invoke(requireRole('student'), req)).toBeNull()
  })
})
