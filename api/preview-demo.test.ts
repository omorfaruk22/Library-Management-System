import { describe, expect, it } from 'vitest'
import { handleDemoApi } from '../demo-server/demoApi.js'

/**
 * The preview API shipped with this repository must satisfy the same contracts
 * the React pages rely on. These checks run without a database, a browser or a
 * network connection.
 */
async function call(url: string, options: { method?: string; body?: Record<string, unknown>; cookie?: string } = {}) {
  return handleDemoApi({
    method: options.method ?? 'GET',
    url,
    body: options.body ?? {},
    cookie: options.cookie ?? null,
  })
}

async function signIn(role: 'admin' | 'student') {
  const result = await call(role === 'admin' ? '/api/auth/admin/login' : '/api/auth/login', {
    method: 'POST',
    body: { email: role === 'admin' ? 'admin@leafline.example' : 'nusrat.jahan@example.com', password: 'demo1234' },
  })
  expect(result.status).toBe(200)
  return result.setCookie?.split('=')[1]?.split(';')[0] ?? ''
}

describe('preview API', () => {
  it('serves public catalogue data without a session', async () => {
    const summary = await call('/api/public/summary')
    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({ books: expect.any(Number), categories: expect.any(Number) })

    const books = await call('/api/books?limit=2')
    const payload = books.body as { books: Array<{ coverImage: string }>; pagination: { total: number } }
    expect(payload.books).toHaveLength(2)
    expect(payload.pagination.total).toBeGreaterThan(2)
    expect(payload.books[0].coverImage.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('requires a session for member and admin data', async () => {
    expect((await call('/api/me/loans')).status).toBe(401)
    expect((await call('/api/admin/reports')).status).toBe(401)
  })

  it('rejects an unknown login but accepts the sample accounts', async () => {
    const bad = await call('/api/auth/login', { method: 'POST', body: { email: 'nusrat.jahan@example.com', password: 'no' } })
    expect(bad.status).toBe(401)
    expect(await signIn('admin')).toContain('admin')
    expect(await signIn('student')).toContain('student')
  })

  it('returns the admin dashboard, reports and settings in the shapes the pages expect', async () => {
    const cookie = await signIn('admin')

    const dashboard = await call('/api/dashboard/admin', { cookie })
    expect(dashboard.body).toMatchObject({ stats: { books: expect.any(Number), issuedBooks: expect.any(Number) }, recentLoans: expect.any(Array) })

    const reports = (await call('/api/admin/reports', { cookie })).body as {
      stats: Record<string, number>
      monthlyActivity: Array<{ _id: string; issues: number }>
      policy: { loanPeriodDays: number; finePerDay: number; maxActiveLoans: number }
    }
    expect(reports.monthlyActivity).toHaveLength(6)
    expect(reports.policy.loanPeriodDays).toBeGreaterThan(0)

    const settings = await call('/api/admin/settings', { method: 'PUT', cookie, body: { loanPeriodDays: 21, finePerDay: 5, maxActiveLoans: 4 } })
    expect(settings.body).toMatchObject({ settings: { loanPeriodDays: 21, finePerDay: 5, maxActiveLoans: 4 } })
  })

  it('lists members, keeps loan history with each member and toggles status', async () => {
    const cookie = await signIn('admin')
    const students = (await call('/api/admin/students?q=nusrat', { cookie })).body as { students: Array<{ _id: string; status: string }> }
    expect(students.students.length).toBeGreaterThan(0)

    const detail = (await call(`/api/admin/students/${students.students[0]._id}`, { cookie })).body as {
      student: { name: string }
      loans: Array<{ book: { title: string } | null; isOverdue: boolean }>
    }
    expect(detail.student.name).toBe('Nusrat Jahan')
    expect(detail.loans.length).toBeGreaterThan(0)
    expect(detail.loans[0].book?.title).toBeTruthy()

    const toggled = await call(`/api/admin/students/${students.students[0]._id}/status`, { method: 'POST', cookie, body: { status: 'suspended' } })
    expect(toggled.body).toMatchObject({ student: { status: 'suspended' } })
  })

  it('issues and returns loans with fines', async () => {
    const cookie = await signIn('admin')
    const issued = await call('/api/admin/loans', { method: 'POST', cookie, body: { studentId: 'STU-100242', bookId: 'book_12' } })
    expect(issued.status).toBe(201)
    const loan = (issued.body as { loan: { _id: string } }).loan

    const returned = await call(`/api/admin/loans/${loan._id}/return`, { method: 'POST', cookie })
    expect(returned.status).toBe(200)
    expect(returned.body).toMatchObject({ loan: { status: 'returned' } })

    const duplicate = await call(`/api/admin/loans/${loan._id}/return`, { method: 'POST', cookie })
    expect(duplicate.status).toBe(409)
  })

  it('records sales, purchases, expenses and stock adjustments', async () => {
    const cookie = await signIn('admin')

    const sale = await call('/api/admin/business/sales', { method: 'POST', cookie, body: { items: [{ book: 'book_1', quantity: 1, unitPrice: 2800 }], customerName: 'Test buyer', paidAmount: 1000 } })
    expect(sale.status).toBe(201)
    expect(sale.body).toMatchObject({ sale: { total: 2800, balanceDue: 1800, paymentStatus: 'partial' } })

    const purchase = await call('/api/admin/business/purchases', { method: 'POST', cookie, body: { supplier: 'sup_1', items: [{ book: 'book_2', quantity: 2, unitPrice: 1900 }] } })
    expect(purchase.status).toBe(201)

    const expense = await call('/api/admin/business/expenses', { method: 'POST', cookie, body: { description: 'Test', category: 'other', amount: 500 } })
    expect(expense.status).toBe(201)

    const adjustment = await call('/api/admin/inventory/adjustments', { method: 'POST', cookie, body: { bookId: 'book_3', kind: 'restock', quantity: 2, reason: 'test' } })
    expect(adjustment.status).toBe(201)
    expect(adjustment.body).toMatchObject({ movement: { kind: 'restock' } })

    const analytics = (await call('/api/admin/business/analytics?from=2026-01-01&to=2026-12-31', { cookie })).body as { monthly: unknown[]; topBooks: unknown[] }
    expect(analytics.monthly).toHaveLength(6)
    expect(analytics.topBooks.length).toBeGreaterThan(0)
  })

  it('gives students their own loans, reservations and wishlist', async () => {
    const cookie = await signIn('student')

    const dashboard = (await call('/api/dashboard/student', { cookie })).body as { stats: { issuedBooks: number }; activeLoans: unknown[] }
    expect(dashboard.stats.issuedBooks).toBe(dashboard.activeLoans.length)

    const loans = (await call('/api/me/loans?status=issued', { cookie })).body as { loans: Array<{ isOverdue: boolean }> }
    expect(loans.loans.length).toBeGreaterThan(0)

    const wishlist = (await call('/api/me/wishlist', { cookie })).body as { items: Array<{ book: { _id: string } }> }
    expect(wishlist.items.length).toBeGreaterThan(0)
    expect((await call(`/api/me/wishlist/${wishlist.items[0].book._id}`, { method: 'DELETE', cookie })).status).toBe(200)

    const reservations = (await call('/api/me/reservations', { cookie })).body as { items: Array<{ queuePosition: number }> }
    expect(reservations.items.every((item) => item.queuePosition >= 1)).toBe(true)
  })

  it('refuses to reserve a book that is on the shelf', async () => {
    const cookie = await signIn('student')
    const response = await call('/api/me/reservations', { method: 'POST', cookie, body: { bookId: 'book_1' } })
    expect(response.status).toBe(409)
    expect(String((response.body as { error: string }).error)).toContain('available')
  })

  it('exports circulation as CSV and clears the session on logout', async () => {
    const cookie = await signIn('admin')
    const csv = await call('/api/admin/loans/export.csv', { cookie })
    expect(csv.status).toBe(200)
    expect(typeof csv.body).toBe('string')
    expect(String(csv.body).split('\n')[0]).toContain('Book')

    const logout = await call('/api/auth/logout', { method: 'POST', cookie })
    expect(logout.setCookie).toContain('Max-Age=0')
  })
})
