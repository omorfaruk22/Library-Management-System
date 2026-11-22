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
  price: { type: Number, required: true, min: 0, default: 0 },
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

const supplierSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  address: { type: String, trim: true, maxlength: 400, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true })

const wishlistSchema = new Schema({ user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, book: { type: Schema.Types.ObjectId, ref: 'Book', required: true } }, { timestamps: true })
wishlistSchema.index({ user: 1, book: 1 }, { unique: true })
const reservationSchema = new Schema({ user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, book: { type: Schema.Types.ObjectId, ref: 'Book', required: true }, status: { type: String, enum: ['waiting', 'ready', 'cancelled', 'fulfilled', 'expired'], default: 'waiting' }, expiresAt: { type: Date, default: null } }, { timestamps: true })
reservationSchema.index({ user: 1, book: 1 }, { unique: true, partialFilterExpression: { status: 'waiting' } })
reservationSchema.index({ user: 1, book: 1, status: 1 })
reservationSchema.index({ book: 1, status: 1, createdAt: 1 })
const stockMovementSchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  kind: { type: String, enum: ['restock', 'damaged', 'lost', 'stocktake'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  totalBefore: { type: Number, required: true, min: 0 },
  totalAfter: { type: Number, required: true, min: 0 },
  availableBefore: { type: Number, required: true, min: 0 },
  availableAfter: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true, maxlength: 500, default: '' },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
stockMovementSchema.index({ createdAt: -1 })
const businessLineSchema = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  title: { type: String, required: true, trim: true },
  isbn: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false })

const saleSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, trim: true, maxlength: 120, default: 'Walk-in customer' },
  customerPhone: { type: String, trim: true, maxlength: 30, default: '' },
  items: { type: [businessLineSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  balanceDue: { type: Number, required: true, min: 0, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'mobile', 'card', 'bank'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'due'], default: 'due' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
saleSchema.index({ createdAt: -1 })
saleSchema.index({ customerPhone: 1, createdAt: -1 })

const purchaseSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierInvoice: { type: String, trim: true, maxlength: 100, default: '' },
  items: { type: [businessLineSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, required: true, min: 0, default: 0 },
  balanceDue: { type: Number, required: true, min: 0, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'mobile', 'card', 'bank'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'due'], default: 'due' },
  receivedAt: { type: Date, required: true, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
purchaseSchema.index({ createdAt: -1 })
purchaseSchema.index({ supplier: 1, createdAt: -1 })

const expenseSchema = new Schema({
  description: { type: String, required: true, trim: true, maxlength: 180 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  amount: { type: Number, required: true, min: 1 },
  paymentMethod: { type: String, enum: ['cash', 'mobile', 'card', 'bank'], default: 'cash' },
  incurredAt: { type: Date, required: true, default: Date.now },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
expenseSchema.index({ incurredAt: -1 })
expenseSchema.index({ category: 1, incurredAt: -1 })
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
export const StockMovement = getModel('StockMovement', stockMovementSchema)
export const Loan = getModel('Loan', loanSchema)
export const Wishlist = getModel('Wishlist', wishlistSchema)
export const Reservation = getModel('Reservation', reservationSchema)
export const Supplier = getModel('Supplier', supplierSchema)
export const Sale = getModel('Sale', saleSchema)
export const Purchase = getModel('Purchase', purchaseSchema)
export const Expense = getModel('Expense', expenseSchema)
export const PasswordReset = getModel('PasswordReset', passwordResetSchema)
export const EmailVerification = getModel('EmailVerification', emailVerificationSchema)
export const AuditLog = getModel('AuditLog', auditLogSchema)
export const RateLimitCounter = getModel('RateLimitCounter', rateLimitCounterSchema)
export const SystemSettings = getModel('SystemSettings', settingsSchema)



