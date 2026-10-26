import { beforeEach, describe, expect, it } from 'vitest'
import { HttpError } from './middleware.js'
import { createLoanWorkflow, type LoanAuditEntry, type LoanTransaction, type LoanWorkflowRepository, type WorkflowLoan } from './loan-workflow.js'

type BookState = { id: string; totalCopies: number; availableCopies: number; active: boolean }
type StudentState = { id: string; studentId: string; active: boolean }

class MemoryLoanRepository implements LoanWorkflowRepository {
  students = new Map<string, StudentState>()
  books = new Map<string, BookState>()
  loans = new Map<string, WorkflowLoan>()
  audits: LoanAuditEntry[] = []
  failAuditAction?: LoanAuditEntry['action']
  private nextId = 1
  private tail: Promise<void> = Promise.resolve()

  async transaction<T>(work: (tx: LoanTransaction) => Promise<T>): Promise<T> {
    const previous = this.tail
    let release!: () => void
    this.tail = new Promise<void>((resolve) => { release = resolve })
    await previous
    const snapshot = {
      books: structuredClone([...this.books.entries()]),
      loans: structuredClone([...this.loans.entries()]),
      audits: structuredClone(this.audits),
      nextId: this.nextId,
    }
    const tx: LoanTransaction = {
      findActiveStudent: async (studentId) => {
        const student = [...this.students.values()].find((value) => value.studentId === studentId && value.active)
        return student ? { id: student.id, studentId: student.studentId } : null
      },
      hasActiveLoan: async (studentId, bookId) => [...this.loans.values()].some((loan) => loan.student === studentId && loan.book === bookId && loan.status === 'issued'),
      lockStudent: async () => {},
      countActiveLoans: async (studentId) => [...this.loans.values()].filter((loan) => loan.student === studentId && loan.status === 'issued').length,
      reserveBook: async (bookId) => {
        const book = this.books.get(bookId)
        if (!book || !book.active || book.availableCopies <= 0 || book.availableCopies > book.totalCopies) return false
        book.availableCopies -= 1
        return true
      },
      createLoan: async (input) => {
        const loan: WorkflowLoan = {
          _id: `loan-${this.nextId++}`,
          student: input.studentId,
          book: input.bookId,
          issuedBy: input.actorId,
          issuedByRole: input.actorRole,
          returnedBy: null,
          issuedAt: input.issuedAt,
          dueAt: input.dueAt,
          returnedAt: null,
          status: 'issued',
          finePaid: 0,
        }
        this.loans.set(loan._id, loan)
        return structuredClone(loan)
      },
      findLoan: async (loanId) => {
        const loan = this.loans.get(loanId)
        return loan ? structuredClone(loan) : null
      },
      markReturned: async (loanId, actorId, returnedAt, finePaid) => {
        const loan = this.loans.get(loanId)
        if (!loan || loan.status !== 'issued' || loan.returnedAt) return null
        loan.status = 'returned'
        loan.returnedBy = actorId
        loan.returnedAt = returnedAt
        loan.finePaid = finePaid
        return structuredClone(loan)
      },
      restockBook: async (bookId) => {
        const book = this.books.get(bookId)
        if (!book || book.availableCopies < 0 || book.availableCopies >= book.totalCopies) return false
        book.availableCopies += 1
        return true
      },
      writeAudit: async (entry) => {
        if (entry.action === this.failAuditAction) throw new Error('Simulated audit storage failure')
        this.audits.push(structuredClone(entry))
      },
    }
    try {
      return await work(tx)
    } catch (error) {
      this.books = new Map(snapshot.books)
      this.loans = new Map(snapshot.loans)
      this.audits = snapshot.audits
      this.nextId = snapshot.nextId
      throw error
    } finally {
      release()
    }
  }
}

const issueInput = (studentId: string, bookId = 'book-1') => ({ studentId, bookId, actorId: 'admin-1', ip: '127.0.0.1' })
const returnInput = (loanId: string) => ({ loanId, actorId: 'admin-1', ip: '127.0.0.1' })

let repository: MemoryLoanRepository
let issueAt: Date
let workflow: ReturnType<typeof createLoanWorkflow>
beforeEach(() => {
  repository = new MemoryLoanRepository()
  repository.students.set('student-1', { id: 'student-1', studentId: 'STU-0001', active: true })
  repository.students.set('student-2', { id: 'student-2', studentId: 'STU-0002', active: true })
  repository.books.set('book-1', { id: 'book-1', totalCopies: 2, availableCopies: 2, active: true })
  issueAt = new Date('2024-04-01T12:00:00.000Z')
  workflow = createLoanWorkflow(repository, () => new Date(issueAt))
})

describe('issue and return workflows', () => {
  it('issues a 14-calendar-day loan, reserves one copy, and audits the issue', async () => {
    const loan = await workflow.issue(issueInput('stu-0001'))
    expect(loan.dueAt.toISOString()).toBe('2024-04-15T12:00:00.000Z')
    expect(repository.books.get('book-1')?.availableCopies).toBe(1)
    expect(repository.loans.get(loan._id)?.status).toBe('issued')
    expect(repository.audits.map((entry) => entry.action)).toEqual(['issue'])
    expect(loan.issuedByRole).toBe('admin')
  })

  it('records student self-checkout as the issuing actor', async () => {
    const loan = await workflow.issue({ ...issueInput('STU-0001'), actorId: 'student-1', actorRole: 'student' })
    expect(loan.issuedBy).toBe('student-1')
    expect(loan.issuedByRole).toBe('student')
    expect(repository.audits[0].details.actorRole).toBe('student')
  })
  it('prevents concurrent issues from making inventory negative', async () => {
    repository.books.get('book-1')!.totalCopies = 1
    repository.books.get('book-1')!.availableCopies = 1
    const results = await Promise.allSettled([
      workflow.issue(issueInput('STU-0001')),
      workflow.issue(issueInput('STU-0002')),
      workflow.issue(issueInput('STU-0001', 'book-1')),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(repository.books.get('book-1')?.availableCopies).toBe(0)
    expect([...repository.loans.values()]).toHaveLength(1)
    expect(repository.books.get('book-1')!.availableCopies).toBeGreaterThanOrEqual(0)
  })

  it('prevents the same student from receiving a duplicate active copy', async () => {
    await workflow.issue(issueInput('STU-0001'))
    await expect(workflow.issue(issueInput('STU-0001'))).rejects.toMatchObject({ status: 409 })
    expect(repository.books.get('book-1')?.availableCopies).toBe(1)
    expect(repository.loans.size).toBe(1)
  })

  it('applies configurable loan days, fine rates, and concurrent active-loan limits', async () => {
    repository.books.set('book-2', { id: 'book-2', totalCopies: 1, availableCopies: 1, active: true })
    const configurable = createLoanWorkflow(repository, () => new Date(issueAt), async () => ({ loanPeriodDays: 10, finePerDay: 7, maxActiveLoans: 1, timezone: 'Asia/Dhaka' }))
    const concurrent = await Promise.allSettled([
      configurable.issue(issueInput('STU-0001', 'book-1')),
      configurable.issue(issueInput('STU-0001', 'book-2')),
    ])
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(repository.books.get('book-1')!.availableCopies + repository.books.get('book-2')!.availableCopies).toBe(2)
    const first = (concurrent.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<WorkflowLoan>).value
    expect(first.dueAt.toISOString()).toBe('2024-04-11T12:00:00.000Z')
    issueAt = new Date('2024-04-13T12:00:00.000Z')
    const result = await configurable.returnBook(returnInput(first._id))
    expect(result.fine).toBe(14)
  })
  it('calculates and records the fine on return, restocks, and audits once', async () => {
    const loan = await workflow.issue(issueInput('STU-0001'))
    issueAt = new Date('2024-04-17T12:00:00.000Z') // two Dhaka calendar days after the due date
    const result = await workflow.returnBook(returnInput(loan._id))
    expect(result.fine).toBe(8)
    expect(result.loan.status).toBe('returned')
    expect(result.loan.finePaid).toBe(8)
    expect(result.loan.returnedBy).toBe('admin-1')
    expect(repository.books.get('book-1')?.availableCopies).toBe(2)
    expect(repository.audits.map((entry) => entry.action)).toEqual(['issue', 'return'])
  })

  it('allows only one of two concurrent return requests to restock a copy', async () => {
    const loan = await workflow.issue(issueInput('STU-0001'))
    const results = await Promise.allSettled([
      workflow.returnBook(returnInput(loan._id)),
      workflow.returnBook(returnInput(loan._id)),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(HttpError)
    expect(rejected.reason.status).toBe(409)
    expect(repository.books.get('book-1')?.availableCopies).toBe(2)
    expect(repository.audits.filter((entry) => entry.action === 'return')).toHaveLength(1)
  })

  it('rolls back a return when inventory cannot be safely incremented', async () => {
    const loan = await workflow.issue(issueInput('STU-0001'))
    repository.books.get('book-1')!.availableCopies = repository.books.get('book-1')!.totalCopies
    await expect(workflow.returnBook(returnInput(loan._id))).rejects.toMatchObject({ status: 409 })
    expect(repository.loans.get(loan._id)?.status).toBe('issued')
    expect(repository.audits.filter((entry) => entry.action === 'return')).toHaveLength(0)
  })

  it('rolls back reserved inventory when auditing an issue fails', async () => {
    repository.failAuditAction = 'issue'
    await expect(workflow.issue(issueInput('STU-0001'))).rejects.toThrow('Simulated audit storage failure')
    expect(repository.books.get('book-1')?.availableCopies).toBe(2)
    expect(repository.loans.size).toBe(0)
  })
  it('rejects inactive or unknown students without changing inventory', async () => {
    await expect(workflow.issue(issueInput('STU-9999'))).rejects.toMatchObject({ status: 404 })
    expect(repository.books.get('book-1')?.availableCopies).toBe(2)
    expect(repository.loans.size).toBe(0)
  })

  it('rejects unavailable inventory without allowing a negative count', async () => {
    repository.books.get('book-1')!.availableCopies = 0
    await expect(workflow.issue(issueInput('STU-0001'))).rejects.toMatchObject({ status: 409 })
    expect(repository.books.get('book-1')?.availableCopies).toBe(0)
    expect(repository.loans.size).toBe(0)
  })

  it('rolls back loan return and inventory when return audit logging fails', async () => {
    const loan = await workflow.issue(issueInput('STU-0001'))
    repository.failAuditAction = 'return'
    await expect(workflow.returnBook(returnInput(loan._id))).rejects.toThrow('Simulated audit storage failure')
    expect(repository.loans.get(loan._id)?.status).toBe('issued')
    expect(repository.books.get('book-1')?.availableCopies).toBe(1)
    expect(repository.audits.filter((entry) => entry.action === 'return')).toHaveLength(0)
  })
})
