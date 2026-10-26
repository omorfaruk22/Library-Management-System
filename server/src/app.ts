import express, { type Request } from 'express'
import mongoose, { Types } from 'mongoose'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { connectDB } from './db.js'
import { authRoutes } from './auth.js'
import { Author, AuditLog, Book, Category, EmailVerification, Loan, SystemSettings, User } from './models.js'
import { calculateFine, isOverdue, startOfCalendarDay } from './domain.js'
import { asyncRoute, audit, errorHandler, HttpError, requireAuth, requireRole, validate } from './middleware.js'
import { createLoanWorkflow } from './loan-workflow.js'
import { MongooseLoanWorkflowRepository } from './loan-repository.js'
import { calculateUpdatedBookInventory } from './catalog-inventory.js'
import { getLibraryPolicy, validateLibrarySettings } from './library-settings.js'
import { createEmailChangeToken, createEmailVerificationUrl } from './email-verification.js'
import { sendEmailChangeVerification } from './mail.js'
import { createPersistentRateLimiter, incrementMongoRateLimitCounter } from './persistent-rate-limit.js'

const app = express()
const loanWorkflow = createLoanWorkflow(new MongooseLoanWorkflowRepository(), () => new Date(), getLibraryPolicy)
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, referrerPolicy: { policy: 'no-referrer' } }))
const origins = process.env.APP_URL ? [process.env.APP_URL] : ['http://localhost:5173']
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
app.use('/api', asyncRoute(async (_req, _res, next) => {
  if (!process.env.MONGODB_URI) throw new HttpError(503, 'Database is not configured. Add MONGODB_URI to .env.local.')
  await connectDB()
  next()
}))
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes())
const emailChangeLimiter = createPersistentRateLimiter({ namespace: 'email-change', limit: 4, windowMs: 60 * 60 * 1000, message: 'Too many email change requests. Please wait and try again.', increment: incrementMongoRateLimitCounter })

function pageOptions(req: Request) {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1))
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 12))
  return { page, limit, skip: (page - 1) * limit }
}
function pager(page: number, limit: number, total: number) { return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } }
function parseDhakaDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const calendar = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value) return null
  return new Date(`${value}T00:00:00.000+06:00`)
}
function nextDhakaDate(date: Date): Date {
  const next = new Date(date.getTime() + 86_400_000)
  return next
}
async function adminLoanFilter(req: Request): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {}
  if (req.query.status === 'issued' || req.query.status === 'returned') filter.status = req.query.status
  else if (req.query.status === 'overdue') { filter.status = 'issued'; filter.dueAt = { $lt: startOfCalendarDay(new Date()) } }
  if (req.query.dateFrom || req.query.dateTo) {
    const fromText = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined
    const toText = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined
    const from = fromText ? parseDhakaDate(fromText) : null
    const to = toText ? parseDhakaDate(toText) : null
    if ((fromText && !from) || (toText && !to) || (from && to && from > to)) throw new HttpError(400, 'Choose a valid issue-date range.')
    const range: Record<string, Date> = {}
    if (from) range.$gte = from
    if (to) range.$lt = nextDhakaDate(to)
    filter.issuedAt = range
  }
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' }
    const [students, books] = await Promise.all([
      User.find({ role: 'student', $or: [{ name: pattern }, { email: pattern }, { studentId: pattern }] }).distinct('_id'),
      Book.find({ $or: [{ title: pattern }, { isbn: pattern }] }).distinct('_id'),
    ])
    filter.$or = [{ student: { $in: students } }, { book: { $in: books } }]
  }
  return filter
}
function adminLoanSort(req: Request): Record<string, 1 | -1> {
  const field = String(req.query.sortBy ?? 'createdAt')
  const allowed = ['issuedAt', 'dueAt', 'returnedAt', 'createdAt', 'status', 'finePaid']
  const sortField = allowed.includes(field) ? field : 'createdAt'
  return { [sortField]: req.query.sortDir === 'asc' ? 1 : -1 }
}
function csvCell(value: unknown): string {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
const categoryInput = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(400).optional().default(''), status: z.enum(['active', 'inactive']).optional().default('active') })
const authorInput = z.object({ name: z.string().trim().min(2).max(120), biography: z.string().trim().max(2000).optional().default(''), status: z.enum(['active', 'inactive']).optional().default('active') })
const secureCoverUrl = z.string().trim().url().refine((value) => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password }, 'Use a secure HTTPS cover image URL.').or(z.literal('')).optional().default('')
const bookInput = z.object({ title: z.string().trim().min(1).max(180), isbn: z.string().trim().min(5).max(30), description: z.string().max(3000).optional().default(''), category: z.string().min(1), author: z.string().min(1), publisher: z.string().trim().max(160).optional().default(''), publicationYear: z.coerce.number().int().min(0).max(3000).nullable().optional().default(null), shelfLocation: z.string().trim().max(80).optional().default(''), coverImage: secureCoverUrl, totalCopies: z.coerce.number().int().min(0).max(100000), status: z.enum(['active', 'inactive']).optional().default('active') })

app.get('/api/public/summary', asyncRoute(async (_req, res) => {
  const [books, categories] = await Promise.all([Book.countDocuments({ status: 'active' }), Category.countDocuments({ status: 'active' })])
  res.json({ books, categories })
}))
app.get('/api/categories', asyncRoute(async (_req, res) => { res.json({ categories: await Category.find({ status: 'active' }).sort({ name: 1 }).select('name description').lean() }) }))
app.get('/api/authors', asyncRoute(async (_req, res) => { res.json({ authors: await Author.find({ status: 'active' }).sort({ name: 1 }).select('name').lean() }) }))
app.get('/api/books/:id', asyncRoute(async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : ''
  if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid book ID.')
  const book = await Book.findOne({ _id: id, status: 'active' }).populate('category', 'name description').populate('author', 'name biography').lean()
  if (!book) throw new HttpError(404, 'Book not found.')
  res.json({ book })
}))
app.get('/api/books', asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = { status: 'active' }
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' }
    const [authors, categories] = await Promise.all([Author.find({ name: pattern }).distinct('_id'), Category.find({ name: pattern }).distinct('_id')])
    filter.$or = [{ title: pattern }, { isbn: pattern }, { author: { $in: authors } }, { category: { $in: categories } }]
  }
  if (req.query.category) filter.category = req.query.category
  if (req.query.author) filter.author = req.query.author
  if (req.query.available === 'true') filter.availableCopies = { $gt: 0 }
  const sortName = String(req.query.sort ?? 'title')
  const sort: Record<string, 1 | -1> = sortName === 'newest' ? { createdAt: -1 } : sortName === 'title-desc' ? { title: -1 } : { title: 1 }
  const [books, total] = await Promise.all([Book.find(filter).populate('category', 'name').populate('author', 'name').sort(sort).skip(skip).limit(limit).lean(), Book.countDocuments(filter)])
  res.json({ books, pagination: pager(page, limit, total) })
}))
app.get('/api/dashboard/admin', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
  const now = new Date()
  const [books, inventory, registeredUsers, authors, categories, issuedBooks, overdueLoans, recentLoans] = await Promise.all([
    Book.countDocuments({ status: 'active' }),
    Book.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, totalCopies: { $sum: '$totalCopies' }, availableCopies: { $sum: '$availableCopies' } } }]).then((x) => x[0] ?? { totalCopies: 0, availableCopies: 0 }),
    User.countDocuments({ role: 'student', status: 'active' }), Author.countDocuments({ status: 'active' }), Category.countDocuments({ status: 'active' }),
    Loan.countDocuments({ status: 'issued' }), Loan.countDocuments({ status: 'issued', dueAt: { $lt: startOfCalendarDay(now) } }),
    Loan.find().populate('student', 'name studentId').populate('book', 'title isbn').populate('issuedBy', 'name role').populate('returnedBy', 'name').sort({ createdAt: -1 }).limit(8).lean(),
  ])
  res.json({ stats: { books, totalCopies: inventory.totalCopies, availableBooks: inventory.availableCopies, registeredUsers, authors, categories, issuedBooks, overdueLoans }, recentLoans: recentLoans.map((loan) => ({ ...loan, isOverdue: loan.status === 'issued' && isOverdue(loan.dueAt, now) })) })
}))
app.get('/api/dashboard/student', requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const now = new Date()
  const policy = await getLibraryPolicy()
  const [totalCatalogBooks, returnedBooks, activeLoans, recentBooks] = await Promise.all([
    Book.countDocuments({ status: 'active' }), Loan.countDocuments({ student: req.user!.id, status: 'returned' }),
    Loan.find({ student: req.user!.id, status: 'issued' }).populate('book', 'title isbn coverImage').sort({ dueAt: 1 }).lean(),
    Book.find({ status: 'active' }).populate('author', 'name').populate('category', 'name').sort({ createdAt: -1 }).limit(4).select('title isbn coverImage availableCopies totalCopies author category createdAt').lean(),
  ])
  const overdueLoans = activeLoans.filter((loan) => isOverdue(loan.dueAt, now))
  const outstandingFines = activeLoans.reduce((sum, loan) => sum + calculateFine(loan.dueAt, now, policy.finePerDay), 0)
  res.json({ stats: { totalCatalogBooks, issuedBooks: activeLoans.length, notReturned: activeLoans.length, returnedBooks, overdueCount: overdueLoans.length, outstandingFines, maxActiveLoans: policy.maxActiveLoans }, activeLoans: activeLoans.map((loan) => ({ ...loan, isOverdue: isOverdue(loan.dueAt, now), fine: calculateFine(loan.dueAt, now, policy.finePerDay) })), recentBooks })
}))
app.get('/api/admin/settings', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
  res.json({ settings: await getLibraryPolicy() })
}))
app.put('/api/admin/settings', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const policy = validateLibrarySettings(req.body)
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'library' },
    { $set: { ...policy, timezone: 'Asia/Dhaka', updatedBy: req.user!.id }, $setOnInsert: { key: 'library' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean().exec() as any
  await audit(req, 'update', 'settings', 'library', { loanPeriodDays: policy.loanPeriodDays, finePerDay: policy.finePerDay, maxActiveLoans: policy.maxActiveLoans })
  res.json({ settings: { loanPeriodDays: settings.loanPeriodDays, finePerDay: settings.finePerDay, maxActiveLoans: settings.maxActiveLoans, timezone: settings.timezone } })
}))
app.get('/api/admin/categories', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = q ? { name: { $regex: escapeRegex(q), $options: 'i' } } : {}
  const requestedSort = String(req.query.sortBy ?? 'name')
  const sortField = ['name', 'status', 'createdAt', 'updatedAt'].includes(requestedSort) ? requestedSort : 'name'
  const direction = req.query.sortDir === 'desc' ? -1 : 1
  const [categories, total] = await Promise.all([
    Category.find(filter).sort({ [sortField]: direction, _id: 1 }).skip(skip).limit(limit).lean(), Category.countDocuments(filter),
  ])
  res.json({ categories, pagination: pager(page, limit, total) })
}))
app.post('/api/admin/categories', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const data = validate(categoryInput, req.body); const category = await Category.create(data)
  await audit(req, 'create', 'category', String(category._id)); res.status(201).json({ category })
}))
app.put('/api/admin/categories/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const data = validate(categoryInput, req.body); const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
  if (!category) throw new HttpError(404, 'Category not found.')
  await audit(req, 'update', 'category', String(category._id)); res.json({ category })
}))
app.delete('/api/admin/categories/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const used = await Book.exists({ category: req.params.id })
  if (used) throw new HttpError(409, 'This category is used by books. Reassign or delete those books first.')
  const category = await Category.findByIdAndDelete(req.params.id)
  if (!category) throw new HttpError(404, 'Category not found.')
  await audit(req, 'delete', 'category', String(category._id)); res.json({ ok: true })
}))

app.get('/api/admin/authors', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = q ? { name: { $regex: escapeRegex(q), $options: 'i' } } : {}
  const requestedSort = String(req.query.sortBy ?? 'name')
  const sortField = ['name', 'status', 'createdAt', 'updatedAt'].includes(requestedSort) ? requestedSort : 'name'
  const direction = req.query.sortDir === 'desc' ? -1 : 1
  const [authors, total] = await Promise.all([
    Author.find(filter).sort({ [sortField]: direction, _id: 1 }).skip(skip).limit(limit).lean(), Author.countDocuments(filter),
  ])
  res.json({ authors, pagination: pager(page, limit, total) })
}))
app.get('/api/admin/authors/:id/books', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const authorId = typeof req.params.id === 'string' ? req.params.id : ''
  if (!Types.ObjectId.isValid(authorId)) throw new HttpError(400, 'Invalid author ID.')
  if (!(await Author.exists({ _id: authorId }))) throw new HttpError(404, 'Author not found.')
  const { page, limit, skip } = pageOptions(req)
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = { author: authorId }
  if (q) filter.$or = [{ title: { $regex: escapeRegex(q), $options: 'i' } }, { isbn: { $regex: escapeRegex(q), $options: 'i' } }]
  const [books, total] = await Promise.all([
    Book.find(filter).select('title isbn status totalCopies availableCopies createdAt').sort({ title: 1, _id: 1 }).skip(skip).limit(limit).lean(), Book.countDocuments(filter),
  ])
  res.json({ books, pagination: pager(page, limit, total) })
}))
app.post('/api/admin/authors', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const author = await Author.create(validate(authorInput, req.body)); await audit(req, 'create', 'author', String(author._id)); res.status(201).json({ author })
}))
app.put('/api/admin/authors/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const author = await Author.findByIdAndUpdate(req.params.id, validate(authorInput, req.body), { new: true, runValidators: true })
  if (!author) throw new HttpError(404, 'Author not found.')
  await audit(req, 'update', 'author', String(author._id)); res.json({ author })
}))
app.delete('/api/admin/authors/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  if (await Book.exists({ author: req.params.id })) throw new HttpError(409, 'This author is used by books. Reassign or delete those books first.')
  const author = await Author.findByIdAndDelete(req.params.id)
  if (!author) throw new HttpError(404, 'Author not found.')
  await audit(req, 'delete', 'author', String(author._id)); res.json({ ok: true })
}))

app.get('/api/admin/books', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = {}
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' }
    const [authors, categories] = await Promise.all([Author.find({ name: pattern }).distinct('_id'), Category.find({ name: pattern }).distinct('_id')])
    filter.$or = [{ title: pattern }, { isbn: pattern }, { author: { $in: authors } }, { category: { $in: categories } }]
  }
  if (req.query.category) filter.category = req.query.category
  if (req.query.available === 'true') filter.availableCopies = { $gt: 0 }
  const [books, total] = await Promise.all([Book.find(filter).populate('category', 'name').populate('author', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Book.countDocuments(filter)])
  res.json({ books, pagination: pager(page, limit, total) })
}))
app.post('/api/admin/books', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const data = validate(bookInput, req.body)
  if (!(await Category.exists({ _id: data.category })) || !(await Author.exists({ _id: data.author }))) throw new HttpError(400, 'Choose a valid category and author.')
  const book = await Book.create({ ...data, availableCopies: data.totalCopies })
  await audit(req, 'create', 'book', String(book._id)); res.status(201).json({ book })
}))
app.put('/api/admin/books/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const data = validate(bookInput, req.body)
  const book = await Book.findById(req.params.id)
  if (!book) throw new HttpError(404, 'Book not found.')
  if (!(await Category.exists({ _id: data.category })) || !(await Author.exists({ _id: data.author }))) throw new HttpError(400, 'Choose a valid category and author.')
  const inventory = calculateUpdatedBookInventory(book.totalCopies, book.availableCopies, data.totalCopies)
  const updated = await Book.findOneAndUpdate(
    { _id: book._id, totalCopies: book.totalCopies, availableCopies: book.availableCopies },
    { $set: { ...data, availableCopies: inventory.availableCopies } },
    { new: true, runValidators: true },
  )
  if (!updated) throw new HttpError(409, 'Book inventory changed while you were editing. Refresh and try again.')
  await audit(req, 'update', 'book', String(updated._id)); res.json({ book: updated })
}))
app.delete('/api/admin/books/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const book = await Book.findById(req.params.id)
  if (!book) throw new HttpError(404, 'Book not found.')
  if (await Loan.exists({ book: book._id })) throw new HttpError(409, 'This book has loan history and cannot be deleted.')
  const deleted = await Book.findOneAndDelete({ _id: book._id, totalCopies: book.totalCopies, availableCopies: book.availableCopies })
  if (!deleted) throw new HttpError(409, 'Book inventory changed while you were editing. Refresh and try again.')
  await audit(req, 'delete', 'book', String(book._id)); res.json({ ok: true })
}))

app.get('/api/admin/students', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req); const q = String(req.query.q ?? '').trim().slice(0, 120)
  const filter: Record<string, unknown> = { role: 'student' }
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { email: { $regex: escapeRegex(q), $options: 'i' } }, { studentId: { $regex: escapeRegex(q), $options: 'i' } }]
  const [students, total] = await Promise.all([User.find(filter).select('name email studentId phone status createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)])
  res.json({ students, pagination: pager(page, limit, total) })
}))
app.get('/api/admin/students/:id', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const studentObjectId = typeof req.params.id === 'string' ? req.params.id : ''
  if (!Types.ObjectId.isValid(studentObjectId)) throw new HttpError(400, 'Invalid student ID.')
  const student = await User.findOne({ _id: studentObjectId, role: 'student' }).select('name email studentId phone status createdAt updatedAt').lean().exec() as any
  if (!student) throw new HttpError(404, 'Student not found.')
  const [loans, policy] = await Promise.all([
    Loan.find({ student: student._id }).populate('book', 'title isbn').sort({ createdAt: -1 }).limit(100).lean(), getLibraryPolicy(),
  ])
  const now = new Date()
  res.json({ student, loans: loans.map((loan) => ({ ...loan, isOverdue: loan.status === 'issued' && isOverdue(loan.dueAt, now), fine: loan.returnedAt ? loan.finePaid : calculateFine(loan.dueAt, now, policy.finePerDay) })) })
}))
app.patch('/api/admin/students/:id/status', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const studentObjectId = typeof req.params.id === 'string' ? req.params.id : ''
  if (!Types.ObjectId.isValid(studentObjectId)) throw new HttpError(400, 'Invalid student ID.')
  const { status } = validate(z.object({ status: z.enum(['active', 'suspended']) }), req.body)
  const student = await User.findOneAndUpdate({ _id: studentObjectId, role: 'student' }, { $set: { status } }, { new: true, runValidators: true }).select('name email studentId phone status createdAt updatedAt').lean() as any
  if (!student) throw new HttpError(404, 'Student not found.')
  await audit(req, status === 'active' ? 'activate' : 'suspend', 'user', String(student._id), { studentId: student.studentId })
  res.json({ student })
}))
app.put('/api/profile', requireAuth, requireRole('student'), emailChangeLimiter, asyncRoute(async (req, res) => {
  const data = validate(z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).refine((value) => !value || /^\+?[0-9()\-\s]{7,30}$/.test(value), 'Enter a valid mobile number.').optional().default('') }), req.body)
  const email = data.email.toLowerCase()
  const session = await mongoose.startSession()
  let user: any = null
  let pending: { token: string; email: string; name: string } | null = null
  try {
    await session.withTransaction(async () => {
      const current = await User.findById(req.user!.id).select('email name').session(session).exec()
      if (!current) throw new HttpError(404, 'Profile not found.')
      if (current.email !== email && await User.exists({ email, _id: { $ne: current._id } }).session(session)) throw new HttpError(409, 'That email address is already in use.')
      user = await User.findByIdAndUpdate(req.user!.id, { $set: { name: data.name, phone: data.phone } }, { new: true, runValidators: true, session }).select('name email role studentId phone status createdAt updatedAt').exec()
      if (!user) throw new HttpError(404, 'Profile not found.')
      if (current.email !== email) {
        const generated = createEmailChangeToken()
        await EmailVerification.deleteMany({ user: current._id }, { session })
        await EmailVerification.create([{ user: current._id, email, tokenHash: generated.tokenHash, expiresAt: generated.expiresAt }], { session })
        pending = { token: generated.token, email, name: data.name }
      }
      await AuditLog.create([{ actor: current._id, action: current.email === email ? 'update_profile' : 'request_email_change', entity: 'user', entityId: String(current._id), details: {}, ip: req.ip }], { session })
    })
  } finally { await session.endSession() }
  const emailPending = pending as { token: string; email: string; name: string } | null
  if (emailPending) {
    try {
      const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')
      const url = createEmailVerificationUrl(emailPending.token, appUrl)
      await sendEmailChangeVerification(emailPending.email, emailPending.name, url)
    } catch {
      await EmailVerification.deleteMany({ user: req.user!.id }).catch(() => undefined)
      console.error('Profile email verification delivery failed. Check SMTP configuration and provider logs.')
      throw new HttpError(503, 'Could not send the verification email. Your current email address is unchanged; please try again later.')
    }
  }
  res.json({ user, emailVerificationPending: Boolean(emailPending) })
}))
app.post('/api/me/loans', requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const { bookId } = validate(z.object({ bookId: z.string().regex(/^[a-f\d]{24}$/i) }), req.body)
  const student = await User.findOne({ _id: req.user!.id, role: 'student', status: 'active' }).select('studentId').lean().exec() as { studentId?: string } | null
  if (!student?.studentId) throw new HttpError(404, 'Active student not found. Check the student ID.')
  const loan = await loanWorkflow.issue({ studentId: student.studentId, bookId, actorId: req.user!.id, actorRole: 'student', ip: req.ip ?? '' })
  res.status(201).json({ loan })
}))
app.get('/api/me/loans', requireAuth, requireRole('student'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const filter: Record<string, unknown> = { student: req.user!.id }
  if (req.query.status === 'issued' || req.query.status === 'returned') filter.status = req.query.status
  else if (req.query.status === 'overdue') { filter.status = 'issued'; filter.dueAt = { $lt: startOfCalendarDay(new Date()) } }
  const q = String(req.query.q ?? '').trim().slice(0, 120)
  if (q) filter.book = { $in: await Book.find({ $or: [{ title: { $regex: escapeRegex(q), $options: 'i' } }, { isbn: { $regex: escapeRegex(q), $options: 'i' } }] }).distinct('_id') }
  const [loans, total, policy] = await Promise.all([
    Loan.find(filter).populate('book', 'title isbn coverImage').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Loan.countDocuments(filter), getLibraryPolicy(),
  ])
  const now = new Date()
  res.json({ loans: loans.map((loan) => ({ ...loan, isOverdue: loan.status === 'issued' && isOverdue(loan.dueAt, now), fine: loan.returnedAt ? loan.finePaid : calculateFine(loan.dueAt, now, policy.finePerDay) })), pagination: pager(page, limit, total) })
}))
app.get('/api/admin/loans/export.csv', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const filter = await adminLoanFilter(req)
  const total = await Loan.countDocuments(filter)
  if (total > 10000) throw new HttpError(413, 'Narrow the report filters before exporting more than 10,000 loans.')
  const [loans, policy] = await Promise.all([
    Loan.find(filter).populate('student', 'name studentId').populate('book', 'title isbn').populate('issuedBy', 'name role').populate('returnedBy', 'name').sort(adminLoanSort(req)).limit(10000).lean(),
    getLibraryPolicy(),
  ])
  const header = ['Book name', 'ISBN', 'Student ID', 'Student name', 'Issue date', 'Due date', 'Return date', 'Status', 'Fine (BDT)', 'Issued by', 'Returned by']
  const rows = loans.map((loan: any) => [loan.book?.title, loan.book?.isbn, loan.student?.studentId, loan.student?.name, loan.issuedAt, loan.dueAt, loan.returnedAt, loan.status, loan.returnedAt ? loan.finePaid : calculateFine(loan.dueAt, new Date(), policy.finePerDay), loan.issuedByRole === 'student' ? 'Self-checkout: ' + loan.issuedBy?.name : loan.issuedBy?.name, loan.returnedBy?.name].map(csvCell).join(','))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="library-loans-${new Date().toISOString().slice(0, 10)}.csv"`)
  res.send(['\uFEFF' + header.map(csvCell).join(','), ...rows].join('\r\n'))
}))
app.get('/api/admin/loans', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const [filter, policy] = await Promise.all([adminLoanFilter(req), getLibraryPolicy()])
  const [loans, total] = await Promise.all([
    Loan.find(filter).populate('student', 'name email studentId').populate('book', 'title isbn').populate('issuedBy', 'name role').populate('returnedBy', 'name').sort(adminLoanSort(req)).skip(skip).limit(limit).lean(),
    Loan.countDocuments(filter),
  ])
  const now = new Date()
  res.json({ loans: loans.map((loan) => ({ ...loan, isOverdue: loan.status === 'issued' && isOverdue(loan.dueAt, now), fine: loan.returnedAt ? loan.finePaid : calculateFine(loan.dueAt, now, policy.finePerDay) })), pagination: pager(page, limit, total) })
}))
app.get('/api/admin/reports', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
  const now = new Date()
  const policy = await getLibraryPolicy()
  const [issuedLoans, returnedLoans, collected, monthlyActivity] = await Promise.all([
    Loan.find({ status: 'issued' }).select('dueAt').lean(), Loan.countDocuments({ status: 'returned' }),
    Loan.aggregate([{ $match: { status: 'returned' } }, { $group: { _id: null, total: { $sum: '$finePaid' } } }]).then((result) => result[0]?.total ?? 0),
    Loan.aggregate([
      { $match: { issuedAt: { $gte: new Date(now.getTime() - 180 * 86_400_000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$issuedAt', timezone: 'Asia/Dhaka' } }, issues: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ])
  const overdueLoans = issuedLoans.filter((loan) => isOverdue(loan.dueAt, now))
  const outstandingFines = issuedLoans.reduce((sum, loan) => sum + calculateFine(loan.dueAt, now, policy.finePerDay), 0)
  res.json({ stats: { activeLoans: issuedLoans.length, returnedLoans, overdueLoans: overdueLoans.length, collectedFines: collected, outstandingFines }, monthlyActivity, policy })
}))
app.post('/api/admin/loans', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { studentId, bookId } = validate(z.object({ studentId: z.string().trim().min(3).max(40), bookId: z.string().regex(/^[a-f\d]{24}$/i) }), req.body)
  const loan = await loanWorkflow.issue({ studentId, bookId, actorId: req.user!.id, ip: req.ip ?? '' })
  res.status(201).json({ loan })
}))
app.post('/api/admin/loans/:id/return', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const loanId = req.params.id
  if (typeof loanId !== 'string' || !Types.ObjectId.isValid(loanId)) throw new HttpError(400, 'Invalid loan ID.')
  const result = await loanWorkflow.returnBook({ loanId, actorId: req.user!.id, ip: req.ip ?? '' })
  res.json(result)
}))
app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { page, limit, skip } = pageOptions(req)
  const [logs, total] = await Promise.all([AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments()])
  res.json({ logs, pagination: pager(page, limit, total) })
}))

app.use('/api/*', (_req, _res, next) => next(new HttpError(404, 'API route not found.')))
app.use(errorHandler)
export default app

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
