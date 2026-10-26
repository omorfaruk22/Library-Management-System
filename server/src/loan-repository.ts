import mongoose, { type ClientSession } from 'mongoose'
import { AuditLog, Book, Loan, User } from './models.js'
import type { LoanAuditEntry, LoanTransaction, LoanWorkflowRepository, WorkflowLoan } from './loan-workflow.js'

function asWorkflowLoan(value: any): WorkflowLoan {
  return {
    _id: String(value._id),
    student: String(value.student),
    book: String(value.book),
    issuedBy: String(value.issuedBy),
    issuedByRole: value.issuedByRole === 'student' ? 'student' : 'admin',
    returnedBy: value.returnedBy ? String(value.returnedBy) : null,
    issuedAt: new Date(value.issuedAt),
    dueAt: new Date(value.dueAt),
    returnedAt: value.returnedAt ? new Date(value.returnedAt) : null,
    status: value.status,
    finePaid: Number(value.finePaid ?? 0),
  }
}
function transactionMethods(session: ClientSession): LoanTransaction {
  return {
    async findActiveStudent(studentId) {
      const student = await User.findOne({ studentId, role: 'student', status: 'active' }).select('_id studentId').session(session).lean().exec() as { _id: unknown; studentId: string } | null
      return student ? { id: String(student._id), studentId: student.studentId } : null
    },
    async hasActiveLoan(studentId, bookId) {
      return Boolean(await Loan.exists({ student: studentId, book: bookId, status: 'issued', returnedAt: null }).session(session))
    },
    async lockStudent(studentId) {
      await User.updateOne({ _id: studentId, role: 'student' }, { $inc: { loanRevision: 1 } }, { session })
    },
    async countActiveLoans(studentId) {
      return Loan.countDocuments({ student: studentId, status: 'issued', returnedAt: null }).session(session)
    },
    async reserveBook(bookId) {
      const result = await Book.updateOne(
        { _id: bookId, status: 'active', availableCopies: { $gt: 0 }, $expr: { $lte: ['$availableCopies', '$totalCopies'] } },
        { $inc: { availableCopies: -1 } },
        { session },
      )
      return result.modifiedCount === 1
    },
    async createLoan(input) {
      const [loan] = await Loan.create([{
        student: input.studentId,
        book: input.bookId,
        issuedBy: input.actorId,
        issuedByRole: input.actorRole,
        issuedAt: input.issuedAt,
        dueAt: input.dueAt,
        returnedAt: null,
        returnedBy: null,
        status: 'issued',
        finePaid: 0,
      }], { session })
      return asWorkflowLoan(loan)
    },
    async findLoan(loanId) {
      const loan = await Loan.findById(loanId).session(session).lean()
      return loan ? asWorkflowLoan(loan) : null
    },
    async markReturned(loanId, actorId, returnedAt, finePaid) {
      const loan = await Loan.findOneAndUpdate(
        { _id: loanId, status: 'issued', returnedAt: null },
        { $set: { status: 'returned', returnedAt, returnedBy: actorId, finePaid } },
        { new: true, runValidators: true, session },
      )
      return loan ? asWorkflowLoan(loan) : null
    },
    async restockBook(bookId) {
      const result = await Book.updateOne(
        { _id: bookId, availableCopies: { $gte: 0 }, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
        { $inc: { availableCopies: 1 } },
        { session },
      )
      return result.modifiedCount === 1
    },
    async writeAudit(entry: LoanAuditEntry) {
      await AuditLog.create([{
        actor: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details,
        ip: entry.ip,
      }], { session })
    },
  }
}

export class MongooseLoanWorkflowRepository implements LoanWorkflowRepository {
  async transaction<T>(work: (tx: LoanTransaction) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession()
    let result!: T
    try {
      await session.withTransaction(async () => {
        result = await work(transactionMethods(session))
      })
      return result
    } finally {
      await session.endSession()
    }
  }
}
