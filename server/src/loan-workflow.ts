import { addLoanPeriod, calculateFine } from './domain.js'
import { DEFAULT_LIBRARY_POLICY, type LibraryPolicy } from './library-settings.js'
import { HttpError } from './middleware.js'

export type LoanStatus = 'issued' | 'returned'
export interface WorkflowStudent { id: string; studentId: string }
export interface WorkflowLoan {
  _id: string
  student: string
  book: string
  issuedBy: string
  issuedByRole: 'admin' | 'student'
  returnedBy?: string | null
  issuedAt: Date
  dueAt: Date
  returnedAt: Date | null
  status: LoanStatus
  finePaid: number
}
export interface LoanAuditEntry {
  actorId: string
  action: 'issue' | 'return'
  entity: 'loan'
  entityId: string
  details: Record<string, unknown>
  ip: string
}
export interface LoanTransaction {
  findActiveStudent(studentId: string): Promise<WorkflowStudent | null>
  hasActiveLoan(studentId: string, bookId: string): Promise<boolean>
  /** Writes a per-student lock so concurrent issues serialize before enforcing the loan cap. */
  lockStudent(studentId: string): Promise<void>
  countActiveLoans(studentId: string): Promise<number>
  reserveBook(bookId: string): Promise<boolean>
  createLoan(input: { studentId: string; bookId: string; actorId: string; actorRole: 'admin' | 'student'; issuedAt: Date; dueAt: Date }): Promise<WorkflowLoan>
  findLoan(loanId: string): Promise<WorkflowLoan | null>
  markReturned(loanId: string, actorId: string, returnedAt: Date, finePaid: number): Promise<WorkflowLoan | null>
  restockBook(bookId: string): Promise<boolean>
  writeAudit(entry: LoanAuditEntry): Promise<void>
}
export interface LoanWorkflowRepository {
  transaction<T>(work: (tx: LoanTransaction) => Promise<T>): Promise<T>
}
function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000
}

export function createLoanWorkflow(repository: LoanWorkflowRepository, now: () => Date = () => new Date(), getPolicy: () => Promise<LibraryPolicy> = async () => DEFAULT_LIBRARY_POLICY) {
  return {
    async issue(input: { studentId: string; bookId: string; actorId: string; actorRole?: 'admin' | 'student'; ip: string }): Promise<WorkflowLoan> {
      try {
        const policy = await getPolicy()
        return await repository.transaction(async (tx) => {
          const studentId = input.studentId.trim().toUpperCase()
          const student = await tx.findActiveStudent(studentId)
          if (!student) throw new HttpError(404, 'Active student not found. Check the student ID.')
          if (await tx.hasActiveLoan(student.id, input.bookId)) throw new HttpError(409, 'This student already has this book on loan.')
          await tx.lockStudent(student.id)
          if (await tx.countActiveLoans(student.id) >= policy.maxActiveLoans) throw new HttpError(409, 'This student has reached the active loan limit.')
          if (!(await tx.reserveBook(input.bookId))) throw new HttpError(409, 'This book is unavailable.')

          const issuedAt = now()
          const actorRole = input.actorRole ?? 'admin'
          const loan = await tx.createLoan({ studentId: student.id, bookId: input.bookId, actorId: input.actorId, actorRole, issuedAt, dueAt: addLoanPeriod(issuedAt, policy.loanPeriodDays) })
          await tx.writeAudit({ actorId: input.actorId, action: 'issue', entity: 'loan', entityId: loan._id, details: { studentId: student.studentId, bookId: input.bookId, actorRole }, ip: input.ip })
          return loan
        })
      } catch (error) {
        if (isDuplicateKey(error)) throw new HttpError(409, 'This student already has this book on loan.')
        throw error
      }
    },

    async returnBook(input: { loanId: string; actorId: string; ip: string }): Promise<{ loan: WorkflowLoan; fine: number }> {
      const policy = await getPolicy()
      return repository.transaction(async (tx) => {
        const existing = await tx.findLoan(input.loanId)
        if (!existing) throw new HttpError(404, 'Active loan not found.')
        if (existing.status !== 'issued' || existing.returnedAt) throw new HttpError(409, 'This book has already been returned.')
        const returnedAt = now()
        const fine = calculateFine(existing.dueAt, returnedAt, policy.finePerDay)
        const loan = await tx.markReturned(input.loanId, input.actorId, returnedAt, fine)
        if (!loan) throw new HttpError(409, 'This book has already been returned.')
        if (!(await tx.restockBook(existing.book))) throw new HttpError(409, 'Book inventory is inconsistent; return was not recorded.')
        await tx.writeAudit({ actorId: input.actorId, action: 'return', entity: 'loan', entityId: loan._id, details: { fine, bookId: existing.book }, ip: input.ip })
        return { loan, fine }
      })
    },
  }
}
