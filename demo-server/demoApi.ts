/**
 * Preview-only in-memory API.
 *
 * The real application talks to Express + MongoDB (see `server/src`). Vercel has
 * no database in this preview environment, so the Vite dev server mounts this
 * small handler instead, seeded with believable catalogue and circulation data.
 * It is never bundled into the production client and never deployed to Vercel.
 */
import { coverDataUri, paged, sessionCookie, clearedSessionCookie, type Json } from './helpers.js'

type Entity = { _id: string; name: string; description?: string; biography?: string; status: 'active' | 'inactive'; createdAt: string; updatedAt: string }
type Book = {
  _id: string; title: string; isbn: string; description: string; category: string; author: string
  publisher: string; publicationYear: number; shelfLocation: string; coverImage: string; price: number
  totalCopies: number; availableCopies: number; status: 'active' | 'inactive'; createdAt: string; updatedAt: string
}
type Student = { _id: string; name: string; email: string; studentId: string; phone: string; status: 'active' | 'suspended'; createdAt: string; updatedAt: string }
type Loan = { _id: string; student: string; book: string; issuedAt: string; dueAt: string; returnedAt: string | null; status: 'issued' | 'returned'; finePaid: number; issuedByRole: 'admin' | 'student'; issuedBy: string }
type Supplier = { _id: string; name: string; phone: string; email: string; address: string; notes: string; status: 'active' | 'inactive'; createdAt: string }
type Sale = { _id: string; invoiceNo: string; customerName: string; customerPhone: string; items: Line[]; subtotal: number; discount: number; total: number; paidAmount: number; balanceDue: number; paymentMethod: string; paymentStatus: string; createdAt: string }
type Purchase = { _id: string; invoiceNo: string; supplier: string; supplierInvoice: string; items: Line[]; subtotal: number; discount: number; total: number; paidAmount: number; balanceDue: number; paymentMethod: string; paymentStatus: string; createdAt: string }
type Expense = { _id: string; description: string; category: string; amount: number; paymentMethod: string; incurredAt: string; notes: string }
type Movement = { _id: string; book: string; kind: string; quantity: number; totalBefore: number; totalAfter: number; availableBefore: number; availableAfter: number; reason: string; actor: string; createdAt: string }
type Line = { book: string; title: string; isbn: string; quantity: number; unitPrice: number; lineTotal: number }

let counter = 1000
const id = (prefix: string) => `${prefix}_${(counter += 1).toString(36)}`
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString()
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

/* -------------------------------------------------------------------------- */
/* Seed                                                                       */
/* -------------------------------------------------------------------------- */

const categoryNames = ['Literary Fiction', 'Programming', 'Computer Science', 'History', 'Business', 'Children']
const categories: Entity[] = categoryNames.map((name, index) => ({
  _id: `cat_${index + 1}`, name, status: 'active', createdAt: ago(120), updatedAt: ago(10),
  description: [
    'Novels, short stories and translated fiction from South Asia and beyond.',
    'Practical software craft: patterns, tooling and engineering habits.',
    'Algorithms, systems, theory and the science behind computing.',
    'Histories of Bengal, South Asia and the wider world.',
    'Management, economics, accounting and entrepreneurship.',
    'Picture books and early readers for younger members.',
  ][index],
}))

const authorSeed: Array<[string, string]> = [
  ['Robert C. Martin', 'Software craftsman and author of Clean Code, known for advocating readable, testable code.'],
  ['David Thomas & Andrew Hunt', 'Authors of The Pragmatic Programmer and founders of the Pragmatic Bookshelf.'],
  ['Thomas H. Cormen', 'Computer scientist at Dartmouth College, co-author of Introduction to Algorithms.'],
  ['Eric Matthes', 'Python educator and author of Python Crash Course.'],
  ['Arundhati Roy', 'Indian novelist and essayist, author of The God of Small Things.'],
  ['Humayun Ahmed', 'One of the most widely read Bengali writers of the modern era.'],
  ['Tahmima Anam', 'Bangladeshi novelist whose work explores family, memory and independence.'],
  ['Martin Kleppmann', 'Author of Designing Data-Intensive Applications and distributed-systems researcher.'],
  ['Kathy Sierra', 'Co-author of Head First Java and advocate for learner-centred technical writing.'],
  ['Winston Churchill', 'Historian and statesman, author of A History of the English-Speaking Peoples.'],
]
const authors: Entity[] = authorSeed.map(([name, biography], index) => ({
  _id: `aut_${index + 1}`, name, biography, status: 'active', createdAt: ago(150), updatedAt: ago(20),
}))

const bookSeed: Array<[string, number, number, string, number, string]> = [
  // title, categoryIndex, authorIndex, publisher, year, shelf
  ['Clean Code', 1, 0, 'Prentice Hall', 2008, 'A-1 · Programming'],
  ['The Pragmatic Programmer', 1, 1, 'Addison-Wesley', 2019, 'A-1 · Programming'],
  ['Introduction to Algorithms', 2, 2, 'MIT Press', 2022, 'B-2 · CS core'],
  ['Python Crash Course', 1, 3, 'No Starch Press', 2023, 'A-2 · Programming'],
  ['Designing Data-Intensive Applications', 2, 7, 'O\'Reilly Media', 2017, 'B-3 · Systems'],
  ['Head First Java', 1, 8, 'O\'Reilly Media', 2022, 'A-3 · Programming'],
  ['The God of Small Things', 0, 4, 'Penguin India', 1997, 'C-1 · Fiction'],
  ['মিসির আলি অমনিবাস', 0, 5, 'অন্যপ্রকাশ', 2015, 'C-2 · Fiction'],
  ['A Golden Age', 0, 6, 'Canongate', 2007, 'C-1 · Fiction'],
  ['A History of the English-Speaking Peoples', 3, 9, 'Bloomsbury', 2015, 'D-1 · History'],
  ['Refactoring', 1, 0, 'Addison-Wesley', 2018, 'A-1 · Programming'],
  ['Working Effectively with Legacy Code', 1, 0, 'Prentice Hall', 2004, 'A-1 · Programming'],
  ['The Mythical Man-Month', 2, 2, 'Addison-Wesley', 1995, 'B-2 · CS core'],
  ['Eloquent JavaScript', 1, 3, 'No Starch Press', 2018, 'A-2 · Programming'],
  ['Automate the Boring Stuff', 1, 3, 'No Starch Press', 2019, 'A-2 · Programming'],
  ['The Art of Statistics', 2, 2, 'Pelican', 2019, 'B-1 · Maths'],
  ['Thinking, Fast and Slow', 4, 9, 'Penguin', 2011, 'E-1 · Business'],
  ['The Lean Startup', 4, 6, 'Crown Business', 2011, 'E-1 · Business'],
  ['Zero to One', 4, 7, 'Crown Business', 2014, 'E-2 · Business'],
  ['Sapiens', 3, 6, 'Harper', 2014, 'D-2 · History'],
  ['The Very Hungry Caterpillar', 5, 4, 'Puffin', 1994, 'F-1 · Children'],
  ['Where the Wild Things Are', 5, 8, 'Red Fox', 2000, 'F-1 · Children'],
  ['Building Microservices', 2, 7, 'O\'Reilly Media', 2021, 'B-3 · Systems'],
  ['The Phoenix Project', 4, 1, 'IT Revolution', 2018, 'E-2 · Business'],
]
const books: Book[] = bookSeed.map(([title, categoryIndex, authorIndex, publisher, year, shelf], index) => {
  const total = 2 + (index % 4)
  const out = index % 7 === 5 ? total : index % 5 === 3 ? Math.max(0, total - 2) : 0
  return {
    _id: `book_${index + 1}`,
    title,
    isbn: `LIB-${String(index + 1).padStart(4, '0')}`,
    description: [
      'A practical, example-driven guide for working developers. Each chapter closes with review questions and exercises you can apply on a real codebase.',
      'A wide-ranging exploration written for curious readers, balancing narrative pacing with carefully sourced research.',
      'Clear explanations, worked examples and reference material make this a book to keep beside the desk.',
      'A short, focused read that stays useful long after the first pass — ideal for a lending collection.',
    ][index % 4],
    category: categories[categoryIndex]._id,
    author: authors[authorIndex]._id,
    publisher,
    publicationYear: year,
    shelfLocation: shelf,
    coverImage: '',
    price: [2800, 3500, 6800, 3200, 4200, 3900, 1450, 1900, 1650, 2450, 3100, 2950][index % 12],
    totalCopies: total,
    availableCopies: total - out,
    status: 'active' as const,
    createdAt: ago(60 - index),
    updatedAt: ago(1),
  }
}).map((book, index) => ({ ...book, coverImage: coverDataUri(book.title, authors.find((author) => author._id === book.author)?.name ?? 'Leafline', index) }))

const studentSeed: Array<[string, string, string, string]> = [
  ['Nusrat Jahan', 'nusrat.jahan@example.com', 'STU-100241', '01711 200 341'],
  ['Rafiul Islam', 'rafiul.islam@example.com', 'STU-100242', '01822 118 902'],
  ['Sabrina Chowdhury', 'sabrina.c@example.com', 'STU-100243', '01933 447 210'],
  ['Tanvir Ahmed', 'tanvir.ahmed@example.com', 'STU-100244', '01678 902 114'],
  ['Mehjabin Karim', 'mehjabin.k@example.com', 'STU-100245', '01555 320 887'],
  ['Imran Hossain', 'imran.hossain@example.com', 'STU-100246', '01344 766 502'],
]
const students: Student[] = studentSeed.map(([name, email, studentId, phone], index) => ({
  _id: `stu_${index + 1}`, name, email, studentId, phone,
  status: index === 5 ? 'suspended' : 'active', createdAt: ago(90 - index * 9), updatedAt: ago(3),
}))

const loans: Loan[] = [
  { _id: 'loan_1', student: students[0]._id, book: books[0]._id, issuedAt: ago(6), dueAt: ahead(8), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_2', student: students[0]._id, book: books[6]._id, issuedAt: ago(19), dueAt: ago(5), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'student', issuedBy: 'stu_1' },
  { _id: 'loan_3', student: students[1]._id, book: books[2]._id, issuedAt: ago(2), dueAt: ahead(12), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_4', student: students[1]._id, book: books[4]._id, issuedAt: ago(30), dueAt: ago(16), returnedAt: ago(14), status: 'returned', finePaid: 8, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_5', student: students[2]._id, book: books[8]._id, issuedAt: ago(11), dueAt: ahead(3), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_6', student: students[2]._id, book: books[1]._id, issuedAt: ago(45), dueAt: ago(31), returnedAt: ago(28), status: 'returned', finePaid: 12, issuedByRole: 'student', issuedBy: 'stu_3' },
  { _id: 'loan_7', student: students[3]._id, book: books[10]._id, issuedAt: ago(9), dueAt: ahead(5), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_8', student: students[4]._id, book: books[16]._id, issuedAt: ago(24), dueAt: ago(10), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'student', issuedBy: 'stu_5' },
  { _id: 'loan_9', student: students[4]._id, book: books[19]._id, issuedAt: ago(70), dueAt: ago(56), returnedAt: ago(54), status: 'returned', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
  { _id: 'loan_10', student: students[5]._id, book: books[13]._id, issuedAt: ago(120), dueAt: ago(106), returnedAt: ago(108), status: 'returned', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' },
]

const suppliers: Supplier[] = [
  { _id: 'sup_1', name: 'Boipath Distributors', phone: '02 9611 2400', email: 'orders@boipath.example', address: '24 Bangla Bazar, Dhaka 1100', notes: 'Weekly Thursday delivery.', status: 'active', createdAt: ago(80) },
  { _id: 'sup_2', name: 'Nilkhet Book House', phone: '01711 445 220', email: 'sales@nilkhet.example', address: 'Nilkhet, Dhaka 1205', notes: '', status: 'active', createdAt: ago(70) },
  { _id: 'sup_3', name: 'Chittagong Academic Supply', phone: '031 611 882', email: 'hello@cas.example', address: 'Agrabad, Chattogram 4100', notes: 'Academic titles only.', status: 'active', createdAt: ago(40) },
]

const makeLine = (bookIndex: number, quantity: number, unitPrice: number): Line => {
  const book = books[bookIndex]
  return { book: book._id, title: book.title, isbn: book.isbn, quantity, unitPrice, lineTotal: quantity * unitPrice }
}

const sales: Sale[] = [
  { _id: 'sale_1', invoiceNo: 'SL-100241', customerName: 'Walk-in customer', customerPhone: '', items: [makeLine(0, 1, 2800)], subtotal: 2800, discount: 100, total: 2700, paidAmount: 2700, balanceDue: 0, paymentMethod: 'cash', paymentStatus: 'paid', createdAt: ago(0, 2) },
  { _id: 'sale_2', invoiceNo: 'SL-100240', customerName: 'Farhana Akter', customerPhone: '01812 998 001', items: [makeLine(3, 1, 3200), makeLine(13, 2, 2700)], subtotal: 8600, discount: 300, total: 8300, paidAmount: 5000, balanceDue: 3300, paymentMethod: 'mobile', paymentStatus: 'partial', createdAt: ago(1, 5) },
  { _id: 'sale_3', invoiceNo: 'SL-100239', customerName: 'Book club order', customerPhone: '', items: [makeLine(16, 3, 1450)], subtotal: 4350, discount: 350, total: 4000, paidAmount: 0, balanceDue: 4000, paymentMethod: 'cash', paymentStatus: 'due', createdAt: ago(2) },
]

const purchases: Purchase[] = [
  { _id: 'pur_1', invoiceNo: 'PR-100118', supplier: suppliers[0]._id, supplierInvoice: 'BP-INV-8841', items: [makeLine(0, 4, 1900), makeLine(2, 2, 5100)], subtotal: 17800, discount: 800, total: 17000, paidAmount: 12000, balanceDue: 5000, paymentMethod: 'bank', paymentStatus: 'partial', createdAt: ago(4) },
  { _id: 'pur_2', invoiceNo: 'PR-100117', supplier: suppliers[1]._id, supplierInvoice: 'NK-2026-311', items: [makeLine(6, 5, 950)], subtotal: 4750, discount: 0, total: 4750, paidAmount: 4750, balanceDue: 0, paymentMethod: 'cash', paymentStatus: 'paid', createdAt: ago(12) },
]

const expenses: Expense[] = [
  { _id: 'exp_1', description: 'Reading room electricity', category: 'utilities', amount: 4200, paymentMethod: 'mobile', incurredAt: ago(1), notes: 'October meter reading' },
  { _id: 'exp_2', description: 'Librarian salary — October', category: 'salary', amount: 32000, paymentMethod: 'bank', incurredAt: ago(3), notes: '' },
  { _id: 'exp_3', description: 'Shelf repair and paint', category: 'maintenance', amount: 6500, paymentMethod: 'cash', incurredAt: ago(6), notes: 'Second floor' },
  { _id: 'exp_4', description: 'Monthly hall rent', category: 'rent', amount: 24000, paymentMethod: 'bank', incurredAt: ago(9), notes: '' },
  { _id: 'exp_5', description: 'Courier for member cards', category: 'transport', amount: 1250, paymentMethod: 'cash', incurredAt: ago(14), notes: '' },
  { _id: 'exp_6', description: 'Barcode labels and stationery', category: 'supplies', amount: 2100, paymentMethod: 'cash', incurredAt: ago(22), notes: '' },
]

const movements: Movement[] = [
  { _id: 'mov_1', book: books[0]._id, kind: 'restock', quantity: 4, totalBefore: 2, totalAfter: 6, availableBefore: 1, availableAfter: 5, reason: 'Opening balance top-up', actor: 'admin_1', createdAt: ago(4) },
  { _id: 'mov_2', book: books[6]._id, kind: 'damaged', quantity: 1, totalBefore: 3, totalAfter: 2, availableBefore: 2, availableAfter: 1, reason: 'Water damage from roof leak', actor: 'admin_1', createdAt: ago(8) },
  { _id: 'mov_3', book: books[2]._id, kind: 'stocktake', quantity: 3, totalBefore: 4, totalAfter: 4, availableBefore: 2, availableAfter: 2, reason: 'Annual count matched the ledger', actor: 'admin_1', createdAt: ago(15) },
  { _id: 'mov_4', book: books[13]._id, kind: 'lost', quantity: 1, totalBefore: 3, totalAfter: 2, availableBefore: 2, availableAfter: 1, reason: 'Not returned since August', actor: 'admin_1', createdAt: ago(19) },
  { _id: 'mov_5', book: books[16]._id, kind: 'restock', quantity: 2, totalBefore: 3, totalAfter: 5, availableBefore: 1, availableAfter: 3, reason: 'Book club donation', actor: 'admin_1', createdAt: ago(27) },
]

/* Historical ledger, so the analytics charts show real shape rather than one day. */
for (let monthsAgo = 5; monthsAgo >= 1; monthsAgo -= 1) {
  for (let batch = 0; batch < 4; batch += 1) {
    const bookIndex = (monthsAgo * 3 + batch) % books.length
    const quantity = 1 + (batch % 2)
    const unitPrice = books[bookIndex].price
    const date = new Date()
    date.setDate(8 + batch * 5)
    date.setMonth(date.getMonth() - monthsAgo)
    const total = unitPrice * quantity
    const paidAmount = batch === 3 ? Math.round(total / 2) : total
    sales.push({
      _id: `sale_h${monthsAgo}${batch}`,
      invoiceNo: `SL-10${(50 + monthsAgo * 10 + batch).toString()}`,
      customerName: batch === 0 ? 'Walk-in customer' : ['Tanvir Hasan', 'Shirin Sultana', 'Rifat Books Corner'][batch - 1],
      customerPhone: '',
      items: [{ book: books[bookIndex]._id, title: books[bookIndex].title, isbn: books[bookIndex].isbn, quantity, unitPrice, lineTotal: total }],
      subtotal: total, discount: 0, total, paidAmount,
      balanceDue: total - paidAmount,
      paymentMethod: batch % 2 === 0 ? 'cash' : 'mobile',
      paymentStatus: total - paidAmount === 0 ? 'paid' : 'partial',
      createdAt: date.toISOString(),
    })
  }
  const expenseDate = new Date()
  expenseDate.setDate(2)
  expenseDate.setMonth(expenseDate.getMonth() - monthsAgo)
  expenses.push(
    { _id: `exp_h${monthsAgo}a`, description: 'Monthly hall rent', category: 'rent', amount: 24000, paymentMethod: 'bank', incurredAt: expenseDate.toISOString(), notes: '' },
    { _id: `exp_h${monthsAgo}b`, description: 'Librarian salary', category: 'salary', amount: 32000, paymentMethod: 'bank', incurredAt: expenseDate.toISOString(), notes: '' },
    { _id: `exp_h${monthsAgo}c`, description: 'Utilities and internet', category: 'utilities', amount: 3800 + monthsAgo * 120, paymentMethod: 'mobile', incurredAt: expenseDate.toISOString(), notes: '' },
  )
}

const wishlist: Array<{ book: string; createdAt: string }> = [{ book: books[4]._id, createdAt: ago(3) }, { book: books[19]._id, createdAt: ago(8) }]
const reservations: Array<{ _id: string; book: string; status: string; createdAt: string; expiresAt: string | null }> = [
  { _id: 'res_1', book: books[5]._id, status: 'waiting', createdAt: ago(5), expiresAt: null },
  { _id: 'res_2', book: books[7]._id, status: 'waiting', createdAt: ago(9), expiresAt: null },
]

let settings = { loanPeriodDays: 14, finePerDay: 4, maxActiveLoans: 5, timezone: 'Asia/Dhaka' as const, updatedAt: ago(30) }
let studentSession = students[0]

/* -------------------------------------------------------------------------- */
/* Projections                                                                */
/* -------------------------------------------------------------------------- */

const categoryOf = (bookId: string) => categories.find((category) => category._id === books.find((book) => book._id === bookId)?.category)
const authorOf = (bookId: string) => authors.find((author) => author._id === books.find((book) => book._id === bookId)?.author)

function bookView(book: Book) {
  return {
    ...book,
    category: categoryOf(book._id) ? { _id: categoryOf(book._id)!._id, name: categoryOf(book._id)!.name, description: categoryOf(book._id)!.description } : null,
    author: authorOf(book._id) ? { _id: authorOf(book._id)!._id, name: authorOf(book._id)!.name, biography: authorOf(book._id)!.biography } : null,
  }
}

function loanView(loan: Loan) {
  const book = books.find((item) => item._id === loan.book)
  const student = students.find((item) => item._id === loan.student)
  const overdue = loan.status === 'issued' && new Date(loan.dueAt) < new Date()
  const overdueDays = overdue ? Math.ceil((Date.now() - new Date(loan.dueAt).getTime()) / 86_400_000) : 0
  return {
    ...loan,
    book: book ? { _id: book._id, title: book.title, isbn: book.isbn, coverImage: book.coverImage } : null,
    student: student ? { _id: student._id, name: student.name, studentId: student.studentId, email: student.email } : null,
    issuedBy: { name: loan.issuedByRole === 'student' ? 'Self-checkout' : 'Library desk' },
    isOverdue: overdue,
    fine: loan.status === 'returned' ? loan.finePaid : overdueDays * settings.finePerDay,
  }
}

function financeView(record: Sale | Purchase, kind: 'sales' | 'purchases') {
  const supplierId = kind === 'purchases' ? (record as Purchase).supplier : ''
  const supplier = suppliers.find((item) => item._id === supplierId)
  return { ...record, supplier: supplier ? { _id: supplier._id, name: supplier.name } : null }
}

function movementView(movement: Movement) {
  const book = books.find((item) => item._id === movement.book)
  return { ...movement, book: book ? { _id: book._id, title: book.title, isbn: book.isbn } : null, actor: { name: 'Library desk' } }
}

/* -------------------------------------------------------------------------- */
/* Router                                                                     */
/* -------------------------------------------------------------------------- */

export type DemoRequest = { method: string; url: string; body: Json; cookie: string | null }
export type DemoResult = { status: number; body: unknown; setCookie?: string }

const ADMIN_PROFILE = { id: 'admin_1', name: 'Ayesha Rahman', email: 'admin@leafline.example', role: 'admin', status: 'active', createdAt: ago(400), updatedAt: ago(2) }

function studentProfile(student: Student) {
  return { id: student._id, name: student.name, email: student.email, role: 'student', studentId: student.studentId, phone: student.phone, status: student.status, createdAt: student.createdAt, updatedAt: student.updatedAt }
}

const fail = (status: number, error: string): DemoResult => ({ status, body: { error } })
const ok = (body: unknown, status = 200): DemoResult => ({ status, body })

export async function handleDemoApi(request: DemoRequest): Promise<DemoResult> {
  const { pathname, searchParams } = new URL(request.url, 'http://preview.local')
  const route = pathname.replace(/^\/api/, '') || '/'
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('limit') ?? 12)
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const session = request.cookie === 'admin' ? 'admin' : request.cookie === 'student' ? 'student' : null
  const isAdmin = session === 'admin'
  const isStudent = session === 'student'

  /* health & public ----------------------------------------------------- */
  if (route === '/health') return ok({ ok: true })
  if (route === '/public/summary') return ok({ books: books.filter((book) => book.status === 'active').length, categories: categories.filter((category) => category.status === 'active').length })
  if (route === '/categories') return ok({ categories: categories.filter((category) => category.status === 'active').map(({ _id, name, description }) => ({ _id, name, description })) })
  if (route === '/authors') return ok({ authors: authors.filter((author) => author.status === 'active').map(({ _id, name }) => ({ _id, name })) })

  /* auth ---------------------------------------------------------------- */
  if (route === '/auth/me') {
    if (!session) return fail(401, 'Please sign in to continue.')
    return ok({ user: isAdmin ? ADMIN_PROFILE : studentProfile(studentSession) })
  }
  if (route === '/auth/login' || route === '/auth/admin/login') {
    const email = String(request.body.email ?? '').trim().toLowerCase()
    const password = String(request.body.password ?? '')
    if (!email || !password) return fail(400, 'Please check the submitted information.')
    if (!validDemoPassword(password)) return fail(401, 'Email or password is incorrect.')
    if (route === '/auth/admin/login') return { status: 200, body: { user: ADMIN_PROFILE }, setCookie: sessionCookie('admin') }
    const match = students.find((student) => student.email.toLowerCase() === email)
    studentSession = match ?? students[0]
    return { status: 200, body: { user: studentProfile(studentSession) }, setCookie: sessionCookie('student') }
  }
  if (route === '/auth/logout') return { status: 200, body: { ok: true }, setCookie: clearedSessionCookie() }
  if (route === '/auth/register') return { status: 201, body: { user: studentProfile(studentSession) }, setCookie: sessionCookie('student') }
  if (route === '/auth/forgot-password' || route === '/auth/reset-password' || route === '/auth/verify-email' || route === '/auth/change-password') return ok({ ok: true })

  /* catalogue ----------------------------------------------------------- */
  if (route.startsWith('/books/') && request.method === 'GET') {
    const book = books.find((item) => item._id === route.slice('/books/'.length))
    return book ? ok({ book: bookView(book) }) : fail(404, 'Book not found.')
  }
  if (route === '/books') {
    let list = books.filter((book) => book.status === 'active')
    if (q) list = list.filter((book) => `${book.title} ${book.isbn} ${authorOf(book._id)?.name ?? ''} ${categoryOf(book._id)?.name ?? ''}`.toLowerCase().includes(q))
    const categoryId = searchParams.get('category'); if (categoryId) list = list.filter((book) => book.category === categoryId)
    const authorId = searchParams.get('author'); if (authorId) list = list.filter((book) => book.author === authorId)
    if (searchParams.get('available') === 'true') list = list.filter((book) => book.availableCopies > 0)
    const sort = searchParams.get('sort')
    list = [...list].sort((a, b) => sort === 'newest' ? +new Date(b.createdAt) - +new Date(a.createdAt) : sort === 'title-desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title))
    const result = paged(list, page, limit)
    return ok({ books: result.slice.map(bookView), pagination: result.pagination })
  }

  /* member tools -------------------------------------------------------- */
  if (route === '/me/loans' && request.method === 'GET') {
    if (!isStudent) return fail(401, 'Please sign in to continue.')
    let list = loans.filter((loan) => loan.student === studentSession._id).map(loanView)
    const status = searchParams.get('status')
    if (status === 'issued' || status === 'returned') list = list.filter((loan) => loan.status === status)
    if (status === 'overdue') list = list.filter((loan) => loan.isOverdue)
    if (q) list = list.filter((loan) => `${loan.book?.title ?? ''} ${loan.book?.isbn ?? ''}`.toLowerCase().includes(q))
    list.sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt))
    const result = paged(list, page, limit)
    return ok({ loans: result.slice, pagination: result.pagination })
  }
  if (route === '/me/loans' && request.method === 'POST') {
    if (!isStudent) return fail(401, 'Please sign in to continue.')
    const book = books.find((item) => item._id === request.body.bookId)
    if (!book) return fail(404, 'Book not found.')
    if (book.availableCopies <= 0) return fail(409, 'This book is unavailable.')
    if (loans.some((loan) => loan.student === studentSession._id && loan.book === book._id && loan.status === 'issued')) return fail(409, 'This student already has this book on loan.')
    book.availableCopies -= 1
    const loan: Loan = { _id: id('loan'), student: studentSession._id, book: book._id, issuedAt: new Date().toISOString(), dueAt: ahead(settings.loanPeriodDays), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'student', issuedBy: studentSession._id }
    loans.unshift(loan)
    return ok({ loan: loanView(loan) }, 201)
  }
  if (route === '/me/wishlist' && request.method === 'GET') {
    if (!isStudent) return fail(401, 'Please sign in to continue.')
    return ok({ items: wishlist.map((item) => ({ _id: 'wish_' + item.book, createdAt: item.createdAt, book: bookView(books.find((book) => book._id === item.book)!) })) })
  }
  if (route === '/me/wishlist' && request.method === 'POST') {
    const bookId = String(request.body.bookId ?? '')
    if (!books.some((book) => book._id === bookId)) return fail(404, 'Book not found.')
    if (!wishlist.some((item) => item.book === bookId)) wishlist.unshift({ book: bookId, createdAt: new Date().toISOString() })
    return ok({ item: { book: bookId } }, 201)
  }
  if (route.startsWith('/me/wishlist/') && request.method === 'DELETE') {
    const bookId = route.slice('/me/wishlist/'.length)
    const index = wishlist.findIndex((item) => item.book === bookId)
    if (index >= 0) wishlist.splice(index, 1)
    return ok({ ok: true })
  }
  if (route === '/me/reservations' && request.method === 'GET') {
    if (!isStudent) return fail(401, 'Please sign in to continue.')
    return ok({ items: reservations.map((item) => ({
      ...item, queuePosition: reservations.filter((other) => other.book === item.book && other.status === 'waiting' && other.createdAt <= item.createdAt).length,
      book: (() => { const book = books.find((entry) => entry._id === item.book)!; return { _id: book._id, title: book.title, isbn: book.isbn, coverImage: book.coverImage, availableCopies: book.availableCopies } })(),
    })) })
  }
  if (route === '/me/reservations' && request.method === 'POST') {
    const bookId = String(request.body.bookId ?? '')
    const book = books.find((item) => item._id === bookId)
    if (!book) return fail(404, 'Book not found.')
    if (book.availableCopies > 0) return fail(409, 'This book is available now; borrow it from the catalogue.')
    reservations.unshift({ _id: id('res'), book: bookId, status: 'waiting', createdAt: new Date().toISOString(), expiresAt: null })
    return ok({ item: reservations[0] }, 201)
  }
  if (route.startsWith('/me/reservations/') && request.method === 'DELETE') {
    const index = reservations.findIndex((item) => item._id === route.slice('/me/reservations/'.length))
    if (index >= 0) reservations.splice(index, 1)
    return ok({ ok: true })
  }

  /* dashboards ---------------------------------------------------------- */
  if (route === '/dashboard/admin') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const issued = loans.filter((loan) => loan.status === 'issued')
    return ok({
      stats: {
        books: books.length, totalCopies: books.reduce((sum, book) => sum + book.totalCopies, 0),
        availableBooks: books.reduce((sum, book) => sum + book.availableCopies, 0),
        registeredUsers: students.length, authors: authors.length, categories: categories.length,
        issuedBooks: issued.length, overdueLoans: issued.filter((loan) => new Date(loan.dueAt) < new Date()).length,
      },
      recentLoans: loans.slice(0, 6).map(loanView),
      policy: settings,
    })
  }
  if (route === '/dashboard/student') {
    if (!isStudent) return fail(401, 'Please sign in to continue.')
    const mine = loans.filter((loan) => loan.student === studentSession._id)
    const active = mine.filter((loan) => loan.status === 'issued')
    return ok({
      stats: {
        totalCatalogBooks: books.length, issuedBooks: active.length, overdueCount: active.filter((loan) => new Date(loan.dueAt) < new Date()).length,
        outstandingFines: active.reduce((sum, loan) => sum + (loanView(loan).fine ?? 0), 0), maxActiveLoans: settings.maxActiveLoans, returnedBooks: mine.filter((loan) => loan.status === 'returned').length,
      },
      activeLoans: active.map(loanView),
      recentBooks: [...books].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4).map(bookView),
      policy: settings,
    })
  }

  /* admin: settings & catalogue ---------------------------------------- */
  if (route === '/admin/settings') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'PUT') {
      settings = { ...settings, loanPeriodDays: Number(request.body.loanPeriodDays ?? settings.loanPeriodDays), finePerDay: Number(request.body.finePerDay ?? settings.finePerDay), maxActiveLoans: Number(request.body.maxActiveLoans ?? settings.maxActiveLoans), updatedAt: new Date().toISOString() }
    }
    return ok({ settings })
  }
  if (route === '/admin/categories' || route === '/admin/authors') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const source = route.endsWith('categories') ? categories : authors
    if (request.method === 'POST') {
      const item: Entity = { _id: id('ent'), name: String(request.body.name ?? 'Untitled'), description: String(request.body.description ?? ''), biography: String(request.body.biography ?? ''), status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      source.unshift(item)
      return ok({ [route.endsWith('categories') ? 'category' : 'author']: item }, 201)
    }
    if (request.method === 'PUT') {
      const targetId = route.split('/').pop()
      const item = source.find((entry) => entry._id === targetId)
      if (!item) return fail(404, 'Record not found.')
      Object.assign(item, { name: String(request.body.name ?? item.name), description: request.body.description, biography: request.body.biography, status: request.body.status ?? item.status, updatedAt: new Date().toISOString() })
      return ok({ item })
    }
    const filterInput = searchParams.get('q')?.trim().toLowerCase()
    let list = filterInput ? source.filter((item) => item.name.toLowerCase().includes(filterInput)) : source
    const direction = searchParams.get('sortDir') === 'desc' ? -1 : 1
    list = [...list].sort((a, b) => a.name.localeCompare(b.name) * direction)
    const result = paged(list, page, limit)
    return ok({ [route.endsWith('categories') ? 'categories' : 'authors']: result.slice, pagination: result.pagination })
  }
  if (route.startsWith('/admin/authors/')) {
    const authorId = route.split('/')[3]
    const author = authors.find((entry) => entry._id === authorId)
    if (!author) return fail(404, 'Author not found.')
    if (route.endsWith('/books')) {
      const list = books.filter((book) => book.author === authorId)
      const result = paged(list, page, limit)
      return ok({ books: result.slice, pagination: result.pagination })
    }
    if (request.method === 'DELETE') {
      if (books.some((book) => book.author === authorId)) return fail(409, 'This author has books and cannot be deleted.')
      authors.splice(authors.indexOf(author), 1)
      return ok({ ok: true })
    }
  }
  if (route.startsWith('/admin/categories/') || route.startsWith('/admin/authors/')) {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const singular = route.startsWith('/admin/categories/')
    const source = singular ? categories : authors
    const item = source.find((entry) => entry._id === route.split('/')[3])
    if (!item) return fail(404, 'Record not found.')
    if (request.method === 'PUT') {
      Object.assign(item, {
        name: String(request.body.name ?? item.name),
        description: request.body.description === undefined ? item.description : request.body.description,
        biography: request.body.biography === undefined ? item.biography : request.body.biography,
        status: request.body.status === 'inactive' ? 'inactive' : 'active',
        updatedAt: new Date().toISOString(),
      })
      return ok({ [singular ? 'category' : 'author']: item })
    }
    if (request.method === 'DELETE') {
      const used = singular ? books.some((book) => book.category === item._id) : books.some((book) => book.author === item._id)
      if (used) return fail(409, `This ${singular ? 'category' : 'author'} has books and cannot be deleted.`)
      source.splice(source.indexOf(item), 1)
      return ok({ ok: true })
    }
  }
  if (route === '/admin/books') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'POST') {
      const created: Book = { _id: id('book'), title: String(request.body.title ?? 'Untitled'), isbn: String(request.body.isbn ?? id('ISBN')), description: String(request.body.description ?? ''), category: String(request.body.category ?? categories[0]._id), author: String(request.body.author ?? authors[0]._id), publisher: String(request.body.publisher ?? ''), publicationYear: Number(request.body.publicationYear ?? new Date().getFullYear()), shelfLocation: String(request.body.shelfLocation ?? ''), coverImage: String(request.body.coverImage ?? ''), price: Number(request.body.price ?? 0), totalCopies: Number(request.body.totalCopies ?? 1), availableCopies: Number(request.body.totalCopies ?? 1), status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      books.unshift(created)
      return ok({ book: created }, 201)
    }
    let list = books
    if (q) list = list.filter((book) => `${book.title} ${book.isbn} ${authorOf(book._id)?.name ?? ''}`.toLowerCase().includes(q))
    if (searchParams.get('available') === 'true') list = list.filter((book) => book.availableCopies > 0)
    const categoryId = searchParams.get('category'); if (categoryId) list = list.filter((book) => book.category === categoryId)
    const result = paged([...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), page, limit)
    return ok({ books: result.slice.map(bookView), pagination: result.pagination })
  }
  if (route.startsWith('/admin/books/')) {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const bookId = route.slice('/admin/books/'.length)
    const book = books.find((item) => item._id === bookId)
    if (!book) return fail(404, 'Book not found.')
    if (request.method === 'PUT') {
      const assigned = book.totalCopies - book.availableCopies
      const total = Number(request.body.totalCopies ?? book.totalCopies)
      Object.assign(book, {
        title: String(request.body.title ?? book.title), isbn: String(request.body.isbn ?? book.isbn),
        description: String(request.body.description ?? book.description), category: String(request.body.category ?? book.category),
        author: String(request.body.author ?? book.author), publisher: String(request.body.publisher ?? book.publisher),
        publicationYear: Number(request.body.publicationYear ?? book.publicationYear), shelfLocation: String(request.body.shelfLocation ?? book.shelfLocation),
        coverImage: String(request.body.coverImage ?? book.coverImage), price: Number(request.body.price ?? book.price),
        totalCopies: total, availableCopies: Math.max(0, total - assigned), status: request.body.status ?? book.status, updatedAt: new Date().toISOString(),
      })
      return ok({ book: bookView(book) })
    }
    if (request.method === 'DELETE') {
      if (loans.some((loan) => loan.book === bookId)) return fail(409, 'This book has loan history and cannot be deleted.')
      books.splice(books.indexOf(book), 1)
      return ok({ ok: true })
    }
  }

  /* admin: members ------------------------------------------------------ */
  if (route === '/admin/students') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    let list = students
    if (q) list = list.filter((student) => `${student.name} ${student.email} ${student.studentId}`.toLowerCase().includes(q))
    const result = paged(list, page, limit)
    return ok({ students: result.slice, pagination: result.pagination })
  }
  if (route.startsWith('/admin/students/') && route.endsWith('/status')) {
    const studentId = route.split('/')[3]
    const student = students.find((item) => item._id === studentId)
    if (!student) return fail(404, 'Student not found.')
    student.status = request.body.status === 'active' ? 'active' : 'suspended'
    return ok({ student })
  }
  if (route.startsWith('/admin/students/')) {
    const student = students.find((item) => item._id === route.slice('/admin/students/'.length))
    if (!student) return fail(404, 'Student not found.')
    return ok({ student, loans: loans.filter((loan) => loan.student === student._id).map(loanView) })
  }

  /* admin: circulation -------------------------------------------------- */
  if (route === '/admin/loans' && request.method === 'GET') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    let list = loans.map(loanView)
    const status = searchParams.get('status')
    if (status === 'issued' || status === 'returned') list = list.filter((loan) => loan.status === status)
    if (status === 'overdue') list = list.filter((loan) => loan.isOverdue)
    if (q) list = list.filter((loan) => `${loan.student?.name ?? ''} ${loan.student?.studentId ?? ''} ${loan.book?.title ?? ''} ${loan.book?.isbn ?? ''}`.toLowerCase().includes(q))
    list.sort((a, b) => searchParams.get('sortDir') === 'asc' ? +new Date(a.issuedAt) - +new Date(b.issuedAt) : +new Date(b.issuedAt) - +new Date(a.issuedAt))
    const result = paged(list, page, limit)
    return ok({ loans: result.slice, pagination: result.pagination })
  }
  if (route === '/admin/loans' && request.method === 'POST') {
    const student = students.find((item) => item.studentId === String(request.body.studentId ?? '').toUpperCase())
    const book = books.find((item) => item._id === request.body.bookId)
    if (!student) return fail(404, 'Active student not found. Check the student ID.')
    if (!book) return fail(404, 'Book not found.')
    if (book.availableCopies <= 0) return fail(409, 'This book is unavailable.')
    if (loans.filter((loan) => loan.student === student._id && loan.status === 'issued').length >= settings.maxActiveLoans) return fail(409, 'This student has reached the active loan limit.')
    book.availableCopies -= 1
    const loan: Loan = { _id: id('loan'), student: student._id, book: book._id, issuedAt: new Date().toISOString(), dueAt: ahead(settings.loanPeriodDays), returnedAt: null, status: 'issued', finePaid: 0, issuedByRole: 'admin', issuedBy: 'admin_1' }
    loans.unshift(loan)
    return ok({ loan: loanView(loan) }, 201)
  }
  if (route.startsWith('/admin/loans/') && route.endsWith('/return')) {
    const loan = loans.find((item) => item._id === route.split('/')[3])
    if (!loan) return fail(404, 'Active loan not found.')
    if (loan.status === 'returned') return fail(409, 'This book has already been returned.')
    const view = loanView(loan)
    loan.status = 'returned'; loan.returnedAt = new Date().toISOString(); loan.finePaid = view.fine ?? 0
    const book = books.find((item) => item._id === loan.book)
    if (book) book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1)
    return ok({ loan: loanView(loan), fine: loan.finePaid })
  }
  if (route === '/admin/reports') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const issued = loans.filter((loan) => loan.status === 'issued')
    const monthly = new Map<string, number>()
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index)
      monthly.set(date.toISOString().slice(0, 7), 0)
    }
    for (const loan of loans) {
      const key = loan.issuedAt.slice(0, 7)
      if (monthly.has(key)) monthly.set(key, (monthly.get(key) ?? 0) + 1)
    }
    return ok({
      stats: {
        activeLoans: issued.length,
        returnedLoans: loans.filter((loan) => loan.status === 'returned').length,
        overdueLoans: issued.filter((loan) => new Date(loan.dueAt) < new Date()).length,
        collectedFines: loans.reduce((sum, loan) => sum + loan.finePaid, 0),
        outstandingFines: issued.reduce((sum, loan) => sum + (loanView(loan).fine ?? 0), 0),
      },
      monthlyActivity: [...monthly].map(([_id, issues]) => ({ _id, issues })),
      policy: settings,
    })
  }
  if (route === '/admin/loans/export.csv') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const rows = [['Book', 'ISBN', 'Member', 'Member ID', 'Issued', 'Due', 'Returned', 'Status'], ...loans.map((loan) => {
      const view = loanView(loan)
      return [view.book?.title ?? '', view.book?.isbn ?? '', view.student?.name ?? '', view.student?.studentId ?? '', loan.issuedAt.slice(0, 10), loan.dueAt.slice(0, 10), loan.returnedAt?.slice(0, 10) ?? '', loan.status]
    })]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    return { status: 200, body: csv }
  }

  /* admin: inventory ---------------------------------------------------- */
  if (route === '/admin/inventory' && request.method === 'GET') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    return ok({ movements: movements.map(movementView), lowStock: books.filter((book) => book.availableCopies <= 3).map(({ _id, title, isbn, totalCopies, availableCopies, shelfLocation }) => ({ _id, title, isbn, totalCopies, availableCopies, shelfLocation })) })
  }
  if (route === '/admin/inventory/adjustments') {
    const book = books.find((item) => item._id === request.body.bookId)
    if (!book) return fail(404, 'Book not found.')
    const kind = String(request.body.kind ?? 'restock')
    const quantity = Math.max(1, Number(request.body.quantity ?? 1))
    const before = { total: book.totalCopies, available: book.availableCopies }
    if (kind === 'restock') { book.totalCopies += quantity; book.availableCopies += quantity }
    if (kind === 'stocktake') { const delta = quantity - book.availableCopies; book.totalCopies = Math.max(book.totalCopies, book.totalCopies + delta); book.availableCopies = quantity }
    if (kind === 'damaged' || kind === 'lost') { const applied = Math.min(quantity, book.availableCopies); book.totalCopies -= applied; book.availableCopies -= applied }
    const movement: Movement = { _id: id('mov'), book: book._id, kind, quantity, totalBefore: before.total, totalAfter: book.totalCopies, availableBefore: before.available, availableAfter: book.availableCopies, reason: String(request.body.reason ?? ''), actor: 'admin_1', createdAt: new Date().toISOString() }
    movements.unshift(movement)
    return ok({ movement: movementView(movement) }, 201)
  }

  /* admin: business ----------------------------------------------------- */
  if (route === '/admin/business/summary') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const today = new Date().toDateString()
    return ok({
      todaySales: sales.filter((sale) => new Date(sale.createdAt).toDateString() === today).reduce((sum, sale) => sum + sale.total, 0),
      todaySaleCount: sales.filter((sale) => new Date(sale.createdAt).toDateString() === today).length,
      todayPurchases: purchases.filter((purchase) => new Date(purchase.createdAt).toDateString() === today).reduce((sum, purchase) => sum + purchase.total, 0),
      todayExpenses: expenses.filter((expense) => new Date(expense.incurredAt).toDateString() === today).reduce((sum, expense) => sum + expense.amount, 0),
      receivables: sales.reduce((sum, sale) => sum + sale.balanceDue, 0),
      payables: purchases.reduce((sum, purchase) => sum + purchase.balanceDue, 0),
      lowStock: books.filter((book) => book.availableCopies <= 3).length,
    })
  }
  if (route.startsWith('/admin/business/suppliers/')) {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const supplier = suppliers.find((item) => item._id === route.slice('/admin/business/suppliers/'.length))
    if (!supplier) return fail(404, 'Supplier not found.')
    if (request.method === 'PUT') {
      Object.assign(supplier, {
        name: String(request.body.name ?? supplier.name), phone: String(request.body.phone ?? supplier.phone),
        email: String(request.body.email ?? supplier.email), address: String(request.body.address ?? supplier.address),
        notes: String(request.body.notes ?? supplier.notes), status: request.body.status === 'inactive' ? 'inactive' : 'active',
      })
      return ok({ supplier })
    }
    if (request.method === 'DELETE') {
      if (purchases.some((purchase) => purchase.supplier === supplier._id)) return fail(409, 'This supplier has purchase history and cannot be deleted.')
      suppliers.splice(suppliers.indexOf(supplier), 1)
      return ok({ ok: true })
    }
  }
  if (route === '/admin/business/suppliers') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'POST') {
      const supplier: Supplier = { _id: id('sup'), name: String(request.body.name ?? 'Supplier'), phone: String(request.body.phone ?? ''), email: String(request.body.email ?? ''), address: String(request.body.address ?? ''), notes: String(request.body.notes ?? ''), status: 'active', createdAt: new Date().toISOString() }
      suppliers.unshift(supplier)
      return ok({ supplier }, 201)
    }
    return ok({ suppliers })
  }
  if (route === '/admin/business/sales') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'POST') {
      const items = (request.body.items as Array<{ book: string; quantity: number; unitPrice: number }>) ?? []
      const lines: Line[] = items.map((item) => {
        const book = books.find((entry) => entry._id === item.book)
        const quantity = Math.max(1, Number(item.quantity))
        const unitPrice = Math.max(0, Number(item.unitPrice))
        return { book: item.book, title: book?.title ?? 'Book', isbn: book?.isbn ?? '', quantity, unitPrice, lineTotal: quantity * unitPrice }
      })
      for (const line of lines) {
        const book = books.find((entry) => entry._id === line.book)
        if (!book || book.availableCopies < line.quantity) return fail(409, 'Insufficient available stock for this sale.')
      }
      for (const line of lines) { const book = books.find((entry) => entry._id === line.book); if (book) { book.availableCopies -= line.quantity; book.totalCopies -= line.quantity } }
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
      const discount = Math.max(0, Number(request.body.discount ?? 0))
      const total = Math.max(0, subtotal - discount)
      const paidAmount = Math.max(0, Math.min(total, Number(request.body.paidAmount ?? total)))
      const balanceDue = total - paidAmount
      const sale: Sale = { _id: id('sale'), invoiceNo: 'SL-' + (100242 + sales.length), customerName: String(request.body.customerName ?? 'Walk-in customer'), customerPhone: String(request.body.customerPhone ?? ''), items: lines, subtotal, discount, total, paidAmount, balanceDue, paymentMethod: String(request.body.paymentMethod ?? 'cash'), paymentStatus: balanceDue === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due', createdAt: new Date().toISOString() }
      sales.unshift(sale)
      return ok({ sale }, 201)
    }
    return ok({ sales })
  }
  if (route === '/admin/business/purchases') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'POST') {
      const items = (request.body.items as Array<{ book: string; quantity: number; unitPrice: number }>) ?? []
      const lines: Line[] = items.map((item) => {
        const book = books.find((entry) => entry._id === item.book)
        const quantity = Math.max(1, Number(item.quantity))
        const unitPrice = Math.max(0, Number(item.unitPrice))
        return { book: item.book, title: book?.title ?? 'Book', isbn: book?.isbn ?? '', quantity, unitPrice, lineTotal: quantity * unitPrice }
      })
      for (const line of lines) { const book = books.find((entry) => entry._id === line.book); if (book) { book.totalCopies += line.quantity; book.availableCopies += line.quantity } }
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
      const discount = Math.max(0, Number(request.body.discount ?? 0))
      const total = Math.max(0, subtotal - discount)
      const paidAmount = Math.max(0, Math.min(total, Number(request.body.paidAmount ?? total)))
      const balanceDue = total - paidAmount
      const purchase: Purchase = { _id: id('pur'), invoiceNo: 'PR-' + (100119 + purchases.length), supplier: String(request.body.supplier ?? suppliers[0]?._id ?? ''), supplierInvoice: String(request.body.supplierInvoice ?? ''), items: lines, subtotal, discount, total, paidAmount, balanceDue, paymentMethod: String(request.body.paymentMethod ?? 'cash'), paymentStatus: balanceDue === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due', createdAt: new Date().toISOString() }
      purchases.unshift(purchase)
      return ok({ purchase }, 201)
    }
    return ok({ purchases: purchases.map((purchase) => financeView(purchase, 'purchases')) })
  }
  if (route.match(/^\/admin\/business\/(sales|purchases)\/[^/]+\/payments$/)) {
    const [, , , kind, targetId] = route.split('/')
    const source: Array<Sale | Purchase> = kind === 'sales' ? sales : purchases
    const record = source.find((item) => item._id === targetId)
    if (!record) return fail(404, 'Record not found.')
    const amount = Math.max(0, Number(request.body.amount ?? 0))
    if (amount > record.balanceDue) return fail(400, 'Payment cannot exceed balance due.')
    record.paidAmount += amount; record.balanceDue -= amount
    record.paymentStatus = record.balanceDue === 0 ? 'paid' : 'partial'
    return ok(kind === 'sales' ? { sale: record } : { purchase: financeView(record, 'purchases') })
  }
  if (route.startsWith('/admin/business/expenses/')) {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const index = expenses.findIndex((item) => item._id === route.slice('/admin/business/expenses/'.length))
    if (index < 0) return fail(404, 'Expense not found.')
    if (request.method === 'PUT') {
      const current = expenses[index]
      expenses[index] = {
        ...current,
        description: String(request.body.description ?? current.description),
        category: String(request.body.category ?? current.category),
        amount: Math.max(1, Number(request.body.amount ?? current.amount)),
        paymentMethod: String(request.body.paymentMethod ?? current.paymentMethod),
        notes: String(request.body.notes ?? current.notes),
      }
      return ok({ expense: expenses[index] })
    }
    if (request.method === 'DELETE') { expenses.splice(index, 1); return ok({ ok: true }) }
  }
  if (route === '/admin/business/expenses') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    if (request.method === 'POST') {
      const expense: Expense = { _id: id('exp'), description: String(request.body.description ?? 'Expense'), category: String(request.body.category ?? 'other'), amount: Math.max(1, Number(request.body.amount ?? 1)), paymentMethod: String(request.body.paymentMethod ?? 'cash'), incurredAt: new Date().toISOString(), notes: String(request.body.notes ?? '') }
      expenses.unshift(expense)
      return ok({ expense }, 201)
    }
    return ok({ expenses })
  }
  if (route === '/admin/business/analytics') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const monthly = new Map<string, { revenue: number; expenses: number; orders: number }>()
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index)
      monthly.set(date.toISOString().slice(0, 7), { revenue: 0, expenses: 0, orders: 0 })
    }
    for (const sale of sales) { const bucket = monthly.get(sale.createdAt.slice(0, 7)); if (bucket) { bucket.revenue += sale.total; bucket.orders += 1 } }
    for (const expense of expenses) { const bucket = monthly.get(expense.incurredAt.slice(0, 7)); if (bucket) bucket.expenses += expense.amount }
    const borrowCounts = new Map<string, number>()
    for (const loan of loans) borrowCounts.set(loan.book, (borrowCounts.get(loan.book) ?? 0) + 1)
    return ok({
      monthly: [...monthly].map(([month, value]) => ({ month, ...value })),
      topBooks: [...borrowCounts].map(([bookId, borrowCount]) => ({ title: books.find((book) => book._id === bookId)?.title ?? 'Book', borrowCount })).sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 8),
      recentSales: sales.slice(0, 6),
      recentActivity: loans.slice(0, 6).map((loan) => ({ action: loan.status === 'returned' ? 'return' : 'issue', entity: 'loan', details: { book: loanView(loan).book?.title ?? '' }, createdAt: loan.issuedAt })),
    })
  }

  /* audit log ----------------------------------------------------------- */
  if (route === '/admin/audit-logs') {
    if (!isAdmin) return fail(401, 'Please sign in to continue.')
    const auditLogs = loans.map((loan) => {
      const student = students.find((item) => item._id === loan.issuedBy)
      const actor = loan.issuedByRole === 'student' && student
        ? { name: student.name, email: student.email }
        : { name: ADMIN_PROFILE.name, email: ADMIN_PROFILE.email }
      const view = loanView(loan)
      return {
        _id: 'audit_' + loan._id,
        actor,
        action: loan.status === 'returned' ? 'return' : 'issue',
        entity: 'loan',
        entityId: loan._id,
        details: { book: view.book?.title ?? '', student: view.student?.name ?? '', studentId: view.student?.studentId ?? '' },
        ip: '127.0.0.1',
        createdAt: loan.returnedAt ?? loan.issuedAt,
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()
    const matchingLogs = search
      ? auditLogs.filter((entry) => [entry.action, entry.entity, entry.entityId, entry.ip, entry.actor.name, entry.actor.email, ...Object.values(entry.details)].join(' ').toLowerCase().includes(search))
      : auditLogs
    const result = paged(matchingLogs, page, limit)
    return ok({ logs: result.slice, pagination: result.pagination })
  }

  return fail(404, 'Endpoint not found in the preview API.')
}

/** Demo login accepts any password with at least 4 characters. */
function validDemoPassword(password: string) {
  return password.length >= 4
}
