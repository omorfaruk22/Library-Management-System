import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Download, Plus, RotateCcw, Search, UserRound } from 'lucide-react'
import { useLocale } from '../i18n'
import {
  Alert, Badge, Button, Card, EmptyState, Input, Modal, PageTitle, Pagination, Select, SkeletonRows, Toolbar,
} from '../ui/primitives'
import { api, currency, date, daysUntil, message } from '../lib/api'

type Loan = {
  _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: 'issued' | 'returned'
  issuedByRole?: 'admin' | 'student'; issuedBy?: { name: string }; isOverdue?: boolean; fine: number
  student?: { name: string; studentId: string; email?: string }; book?: { title: string; isbn: string }
}
type PaginationData = { page: number; pages: number; total: number }
type BookChoice = { _id: string; title: string; isbn: string; availableCopies: number; status?: string }
type StudentChoice = { _id: string; name: string; studentId: string; email: string; status: string }

const PAGE_SIZE = 10

function LoanStatus({ loan, overdueLabel, returnedLabel }: { loan: Loan; overdueLabel: string; returnedLabel: string }) {
  const remaining = daysUntil(loan.dueAt)
  if (loan.status === 'returned') return <Badge tone="slate">{returnedLabel}</Badge>
  if (loan.isOverdue || (remaining !== null && remaining < 0)) return <Badge tone="red" dot>{overdueLabel}</Badge>
  if (remaining === 0) return <Badge tone="amber" dot>Due today</Badge>
  return <Badge tone="green" dot>{remaining}d left</Badge>
}

export function AdminLoans() {
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const [queryText, setQueryText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [issueOpen, setIssueOpen] = useState(false)
  const [books, setBooks] = useState<BookChoice[]>([])
  const [studentId, setStudentId] = useState('')
  const [student, setStudent] = useState<StudentChoice | null>(null)
  const [bookId, setBookId] = useState('')
  const [modalError, setModalError] = useState('')
  const [notice, setNotice] = useState('')
  const [returning, setReturning] = useState<Loan | null>(null)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: 'issuedAt', sortDir })
  if (searchText) params.set('q', searchText)
  if (status) params.set('status', status)
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)

  const loanQuery = useQuery({ queryKey: ['admin-loans', params.toString()], queryFn: () => api<{ loans: Loan[]; pagination: PaginationData }>('/admin/loans?' + params.toString()) })
  const data = loanQuery.data
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-loans'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }) }
  const issueMutation = useMutation({
    mutationFn: () => api('/admin/loans', { method: 'POST', body: JSON.stringify({ studentId: student?.studentId, bookId }) }),
    onSuccess: async () => { setIssueOpen(false); setNotice('Book issued. The due date is on the member\'s record.'); await invalidate() },
    onError: (error) => setModalError(message(error)),
  })
  const returnMutation = useMutation({
    mutationFn: (loanId: string) => api<{ fine: number }>('/admin/loans/' + loanId + '/return', { method: 'POST' }),
    onSuccess: async (result) => { setReturning(null); setNotice(t('returnBook') + ' · ' + t('fine') + ': ' + currency(result.fine)); await invalidate() },
    onError: (error) => { setReturning(null); setNotice(message(error)) },
  })

  const openIssue = async () => {
    setModalError(''); setStudentId(''); setStudent(null); setBookId('')
    try {
      const result = await api<{ books: BookChoice[] }>('/admin/books?limit=100&available=true')
      setBooks(result.books.filter((book) => book.status !== 'inactive' && book.availableCopies > 0))
      setIssueOpen(true)
    } catch (err) { setModalError(message(err)); setIssueOpen(true) }
  }
  const lookupStudent = async (event?: FormEvent) => {
    event?.preventDefault(); setModalError(''); setStudent(null)
    try {
      const result = await api<{ students: StudentChoice[] }>('/admin/students?limit=1&q=' + encodeURIComponent(studentId))
      const match = result.students.find((item) => item.studentId.toLowerCase() === studentId.trim().toLowerCase())
      if (!match) throw new Error('Active student not found. Check the student ID.')
      if (match.status !== 'active') throw new Error('This student account is suspended.')
      setStudent(match)
      if (!books.length) {
        const result2 = await api<{ books: BookChoice[] }>('/admin/books?limit=100&available=true')
        setBooks(result2.books.filter((book) => book.status !== 'inactive' && book.availableCopies > 0))
      }
    } catch (err) { setModalError(message(err)) }
  }
  const exportParams = new URLSearchParams(params)
  exportParams.delete('page'); exportParams.delete('limit')
  const overdueCount = data?.loans.filter((loan) => loan.isOverdue).length ?? 0

  return (
    <>
      <PageTitle
        eyebrow={t('circulationGroup')}
        title={t('manageIssued')}
        description={`${t('loanPeriod')} · ${t('returnFineHint')}`}
        action={<>
          <a href={'/api/admin/loans/export.csv?' + exportParams.toString()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Download size={15} />{t('exportCsv')}</a>
          <Button onClick={() => void openIssue()}><Plus size={16} />{t('issueBook')}</Button>
        </>}
      />

      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}
      {loanQuery.error && <div className="mb-4"><Alert message={message(loanQuery.error)} /></div>}

      <Card className="overflow-hidden p-0">
        <Toolbar className="grid gap-3 lg:grid-cols-[1.4fr_.8fr_.8fr_.8fr_.8fr]">
          <form onSubmit={(event) => { event.preventDefault(); setSearchText(queryText.trim()); setPage(1) }} className="flex gap-2">
            <Input aria-label={t('searchStudents')} placeholder={t('searchStudents')} value={queryText} onChange={(event) => setQueryText(event.target.value)} icon={<Search size={15} />} />
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
          <Select aria-label={t('status')} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
            <option value="">{t('allStatuses')}</option>
            <option value="issued">{t('issued')}</option>
            <option value="overdue">{t('overdue')}</option>
            <option value="returned">{t('returned')}</option>
          </Select>
          <Input type="date" aria-label={t('dateFrom')} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" aria-label={t('dateTo')} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select aria-label={t('sortBy')} value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
            <option value="desc">{t('newestFirst')}</option>
            <option value="asc">{t('oldestFirst')}</option>
          </Select>
        </Toolbar>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-[11.5px] text-slate-500">
          <span><strong className="text-slate-700">{data?.pagination.total ?? 0}</strong> loans recorded</span>
          {overdueCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">{overdueCount} overdue on this page</span>}
          <span className="ml-auto">{t('loanPeriod')}</span>
        </div>

        {loanQuery.isPending ? <SkeletonRows rows={6} /> : data?.loans.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1080px]">
                <thead>
                  <tr>
                    <th>{t('bookTitle')}</th><th>{t('student')}</th><th>{t('issueDate')}</th><th>{t('dueDate')}</th>
                    <th>{t('returnDate')}</th><th>{t('fine')}</th><th>{t('status')}</th><th className="text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loans.map((loan) => (
                    <tr key={loan._id}>
                      <td>
                        <span className="block max-w-[200px] truncate font-semibold text-slate-900">{loan.book?.title}</span>
                        <span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{loan.book?.isbn}</span>
                      </td>
                      <td>
                        <span className="block font-medium text-slate-800">{loan.student?.name}</span>
                        <span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{loan.student?.studentId}</span>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-slate-600">{date(loan.issuedAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-600">{date(loan.dueAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-500">{date(loan.returnedAt)}</td>
                      <td className="font-semibold text-slate-800">{currency(loan.fine ?? 0)}</td>
                      <td><LoanStatus loan={loan} overdueLabel={t('overdue')} returnedLabel={t('returned')} /></td>
                      <td className="text-right">
                        {loan.status === 'issued'
                          ? <Button size="sm" variant="secondary" onClick={() => setReturning(loan)} disabled={returnMutation.isPending}><RotateCcw size={13} />{t('returnBook')}</Button>
                          : <span className="text-[11.5px] text-slate-400">{loan.issuedByRole === 'student' ? t('selfCheckout') : loan.issuedBy?.name ?? '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={data.pagination.pages} total={data.pagination.total} shown={data.loans.length} onChange={setPage} />
          </>
        ) : <EmptyState icon={BookOpenCheck} title={t('noRecords')} description="Issue a book to start the circulation record." action={<Button onClick={() => void openIssue()}><Plus size={15} />{t('issueBook')}</Button>} />}
      </Card>

      {issueOpen && (
        <Modal title={t('issueBook')} description={t('returnFineHint')} onClose={() => setIssueOpen(false)}>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (student && bookId) issueMutation.mutate() }}>
            {modalError && <Alert message={modalError} />}
            <div className="flex items-end gap-2">
              <Input label={t('studentId')} value={studentId} onChange={(event) => { setStudentId(event.target.value.toUpperCase()); setStudent(null) }} placeholder="STU-XXXXXX" required className="font-mono uppercase" />
              <Button type="button" variant="secondary" onClick={() => void lookupStudent()}><Search size={15} />{t('search')}</Button>
            </div>
            {student && <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12.5px]">
              <UserRound size={15} className="mt-0.5 text-brand-700" />
              <div><p className="font-semibold text-brand-900">{student.name}</p><p className="text-brand-800/80">{student.studentId} · {student.email}</p></div>
            </div>}
            <Select label={t('selectBook')} value={bookId} onChange={(event) => setBookId(event.target.value)} required>
              <option value="">{t('selectBook')}</option>
              {books.map((book) => <option key={book._id} value={book._id}>{book.title} · {book.availableCopies} {t('copiesAvailable')}</option>)}
            </Select>
            <div className="rounded-xl bg-slate-50 p-3 text-[11.5px] leading-6 text-slate-600"><BookOpenCheck size={14} className="mb-0.5 inline text-brand-700" /> {t('loanPeriod')} · {t('returnFineHint')}</div>
            <Button className="w-full" type="submit" loading={issueMutation.isPending} disabled={!student || !bookId}>{t('issueBook')}</Button>
          </form>
        </Modal>
      )}

      {returning && (
        <Modal title={t('returnBook')} onClose={() => setReturning(null)}
          footer={<><Button variant="secondary" onClick={() => setReturning(null)}>{t('cancel')}</Button><Button loading={returnMutation.isPending} onClick={() => returnMutation.mutate(returning._id)}>{t('returnBook')}</Button></>}>
          <p className="text-sm leading-6 text-slate-600">Confirm the return of <strong className="text-slate-900">{returning.book?.title}</strong> from {returning.student?.name}.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-[12.5px]">
            <div><dt className="text-slate-500">{t('dueDate')}</dt><dd className="mt-0.5 font-semibold text-slate-800">{date(returning.dueAt)}</dd></div>
            <div><dt className="text-slate-500">{t('fine')}</dt><dd className="mt-0.5 font-semibold text-slate-800">{currency(returning.fine ?? 0)}</dd></div>
          </dl>
          <p className="mt-3 text-[11.5px] text-slate-500">Fines are calculated on overdue calendar days in Asia/Dhaka and recorded with the return.</p>
        </Modal>
      )}
    </>
  )
}

export function StudentLoans() {
  const { t } = useLocale()
  const [status, setStatus] = useState('')
  const [queryText, setQueryText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  if (searchText) params.set('q', searchText)
  const query = useQuery({ queryKey: ['my-loans', params.toString()], queryFn: () => api<{ loans: Loan[]; pagination: PaginationData }>('/me/loans?' + params.toString()) })
  const active = query.data?.loans.filter((loan) => loan.status === 'issued') ?? []
  const overdue = active.filter((loan) => loan.isOverdue).length

  return (
    <>
      <PageTitle eyebrow={t('studentArea')} title={t('issuedBooks')} description={`${t('loanPeriod')} · ${t('returnFineHint')}`} />
      {query.error && <div className="mb-4"><Alert message={message(query.error)} /></div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: t('activeLoans'), value: active.length },
          { label: t('overdue'), value: overdue },
          { label: t('outstandingFines'), value: currency(active.reduce((sum, loan) => sum + (loan.fine ?? 0), 0)) },
        ].map((item) => <div key={item.label} className="surface px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p><p className="mt-1 font-display text-xl font-semibold text-slate-900">{item.value}</p></div>)}
      </div>

      <Card className="overflow-hidden p-0">
        <Toolbar>
          <form className="grid w-full gap-3 sm:grid-cols-[1fr_.6fr_auto]" onSubmit={(event) => { event.preventDefault(); setSearchText(queryText.trim()); setPage(1) }}>
            <Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={queryText} onChange={(event) => setQueryText(event.target.value)} icon={<Search size={15} />} />
            <Select aria-label={t('status')} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">{t('allStatuses')}</option>
              <option value="issued">{t('issued')}</option>
              <option value="overdue">{t('overdue')}</option>
              <option value="returned">{t('returned')}</option>
            </Select>
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
        </Toolbar>
        {query.isPending ? <SkeletonRows rows={4} /> : query.data?.loans.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead><tr><th>{t('bookTitle')}</th><th>{t('issueDate')}</th><th>{t('dueDate')}</th><th>{t('returnDate')}</th><th>{t('status')}</th><th className="text-right">{t('fine')}</th></tr></thead>
                <tbody>
                  {query.data.loans.map((loan) => (
                    <tr key={loan._id}>
                      <td><span className="block font-semibold text-slate-900">{loan.book?.title}</span><span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{loan.book?.isbn}</span></td>
                      <td className="whitespace-nowrap text-[12px] text-slate-600">{date(loan.issuedAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-600">{date(loan.dueAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-500">{date(loan.returnedAt)}</td>
                      <td><LoanStatus loan={loan} overdueLabel={t('overdue')} returnedLabel={t('returned')} /></td>
                      <td className="text-right font-semibold text-slate-800">{currency(loan.fine ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={query.data.pagination.pages} total={query.data.pagination.total} shown={query.data.loans.length} onChange={setPage} />
          </>
        ) : <EmptyState icon={BookOpenCheck} title={t('noRecords')} description={t('emptyDashboard')} />}
      </Card>
    </>
  )
}
