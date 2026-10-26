import mongoose, { Schema } from 'mongoose'

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'student'], default: 'student', required: true },
  studentId: { type: String, unique: true, sparse: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  loanRevision: { type: Number, default: 0, select: false },
}, { timestamps: true })

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 400, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true })
categorySchema.index({ name: 1 }, { unique: true })

const authorSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  biography: { type: String, trim: true, maxlength: 2000, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true })
authorSchema.index({ name: 1 }, { unique: true })

const bookSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  isbn: { type: String, required: true, trim: true, uppercase: true, unique: true },
  description: { type: String, trim: true, maxlength: 3000, default: '' },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'Author', required: true },
  publisher: { type: String, trim: true, maxlength: 160, default: '' },
  publicationYear: { type: Number, min: 0, max: 3000, default: null },
  coverImage: { type: String, trim: true, default: '' },
  shelfLocation: { type: String, trim: true, maxlength: 80, default: '' },
  totalCopies: { type: Number, required: true, min: 0 },
  availableCopies: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true })
bookSchema.index({ title: 'text', isbn: 'text' })
bookSchema.index({ category: 1, status: 1, title: 1 })
bookSchema.index({ author: 1, status: 1, title: 1 })

const loanSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  issuedByRole: { type: String, enum: ['admin', 'student'], default: 'admin' },
  returnedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  issuedAt: { type: Date, required: true, default: Date.now },
  dueAt: { type: Date, required: true },
  returnedAt: { type: Date, default: null },
  status: { type: String, enum: ['issued', 'returned'], default: 'issued', index: true },
  finePaid: { type: Number, min: 0, default: 0 },
}, { timestamps: true })
loanSchema.index({ student: 1, book: 1, status: 1 })
loanSchema.index({ student: 1, book: 1 }, { unique: true, partialFilterExpression: { status: 'issued' } })
loanSchema.index({ status: 1, dueAt: 1 })
loanSchema.index({ student: 1, createdAt: -1 })

const passwordResetSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })
const emailVerificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })
const auditLogSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, default: '' },
  details: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
}, { timestamps: true })
auditLogSchema.index({ createdAt: -1 })
const rateLimitCounterSchema = new Schema({
  _id: { type: String, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { _id: false, versionKey: false })
const settingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'library' },
  loanPeriodDays: { type: Number, required: true, min: 1, max: 90, default: 14 },
  finePerDay: { type: Number, required: true, min: 0, max: 10000, default: 4 },
  maxActiveLoans: { type: Number, required: true, min: 1, max: 50, default: 5 },
  timezone: { type: String, required: true, enum: ['Asia/Dhaka'], default: 'Asia/Dhaka' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

function getModel(name: string, schema: Schema): mongoose.Model<any> {
  return (mongoose.models[name] as mongoose.Model<any> | undefined) ?? mongoose.model(name, schema)
}
export const User = getModel('User', userSchema)
export const Category = getModel('Category', categorySchema)
export const Author = getModel('Author', authorSchema)
export const Book = getModel('Book', bookSchema)
export const Loan = getModel('Loan', loanSchema)
export const PasswordReset = getModel('PasswordReset', passwordResetSchema)
export const EmailVerification = getModel('EmailVerification', emailVerificationSchema)
export const AuditLog = getModel('AuditLog', auditLogSchema)
export const RateLimitCounter = getModel('RateLimitCounter', rateLimitCounterSchema)
export const SystemSettings = getModel('SystemSettings', settingsSchema)
