import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, RotateCcw, Search, Plus, ChevronLeft, ChevronRight, Download, UserRound } from 'lucide-react'
import { useLocale } from '../i18n'
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageTitle, Select, Spinner } from '../components'
import { api, currency, date, message } from '../lib/api'

type Loan = { _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: 'issued' | 'returned'; issuedByRole?: 'admin' | 'student'; issuedBy?: { name: string }; isOverdue?: boolean; fine: number; student?: { name: string; studentId: string; email?: string }; book?: { title: string; isbn: string } }
type Pagination = { page: number; pages: number; total: number }
type BookChoice = { _id: string; title: string; isbn: string; availableCopies: number; status?: string }
type StudentChoice = { _id: string; name: string; studentId: string; email: string; status: string }
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
  const params = new URLSearchParams({ page: String(page), limit: '10', sortBy: 'issuedAt', sortDir })
  if (searchText) params.set('q', searchText)
  if (status) params.set('status', status)
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)
  const loanQuery = useQuery({ queryKey: ['admin-loans', params.toString()], queryFn: () => api<{ loans: Loan[]; pagination: Pagination }>('/admin/loans?' + params.toString()) })
  const data = loanQuery.data
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-loans'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }) }
  const issueMutation = useMutation({ mutationFn: () => api('/admin/loans', { method: 'POST', body: JSON.stringify({ studentId: student?.studentId, bookId }) }), onSuccess: async () => { setIssueOpen(false); setNotice(t('success')); await invalidate() } })
  const returnMutation = useMutation({ mutationFn: (loanId: string) => api<{ fine: number }>('/admin/loans/' + loanId + '/return', { method: 'POST' }), onSuccess: async (result) => { setNotice(t('returnBook') + ' · ' + t('fine') + ': ' + currency(result.fine)); await invalidate() } })
  const error = loanQuery.error ? message(loanQuery.error) : issueMutation.error ? message(issueMutation.error) : returnMutation.error ? message(returnMutation.error) : ''
  const openIssue = async () => {
    setModalError(''); setStudentId(''); setStudent(null); setBookId('')
    try { const result = await api<{ books: BookChoice[] }>('/admin/books?limit=100&available=true'); setBooks(result.books.filter((book) => book.status !== 'inactive' && book.availableCopies > 0)); setIssueOpen(true) }
    catch (err) { setModalError(message(err)); setIssueOpen(true) }
  }
  const lookupStudent = async (event?: FormEvent) => {
    event?.preventDefault(); setModalError(''); setStudent(null)
    try { const result = await api<{ students: StudentChoice[] }>('/admin/students?limit=1&q=' + encodeURIComponent(studentId)); const match = result.students.find((item) => item.studentId.toLowerCase() === studentId.trim().toLowerCase()); if (!match) throw new Error('Active student not found. Check the student ID.'); if (match.status !== 'active') throw new Error('This student account is suspended.'); setStudent(match) }
    catch (err) { setModalError(message(err)) }
  }
  const search = (event: FormEvent) => { event.preventDefault(); setSearchText(queryText.trim()); setPage(1) }
  const exportParams = new URLSearchParams(params); exportParams.delete('page'); exportParams.delete('limit')
  return <>
    <PageTitle title={t('manageIssued')} description={t('returnFineHint')} action={<Button onClick={() => void openIssue()}><Plus size={17} />{t('issueBook')}</Button>} />
    {error && <div className="mb-4"><Alert message={error} onClose={() => { issueMutation.reset(); returnMutation.reset() }} /></div>}
    {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}
    <Card className="p-0">
      <div className="border-b border-slate-100 p-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{t('issuedBooks')}</h2><p className="mt-1 text-xs text-slate-500">{t('loanPeriod')} · {t('overdueRate')}</p></div><a href={'/api/admin/loans/export.csv?' + exportParams.toString()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Download size={16} />{t('exportCsv')}</a></div>
        <form onSubmit={search} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder={t('searchStudents')} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label>
          <Select aria-label={t('status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">{t('allStatuses')}</option><option value="issued">{t('issued')}</option><option value="overdue">{t('overdue')}</option><option value="returned">{t('returned')}</option></Select>
          <label className="block space-y-1"><span className="text-xs text-slate-500">{t('dateFrom')}</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="block space-y-1"><span className="text-xs text-slate-500">{t('dateTo')}</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <div className="flex gap-2"><Select aria-label={t('sortBy')} value={sortDir} onChange={(e) => setSortDir(e.target.value)}><option value="desc">{t('newestFirst')}</option><option value="asc">{t('oldestFirst')}</option></Select><Button type="submit" variant="secondary">{t('search')}</Button></div>
        </form>
      </div>
      {loanQuery.isPending ? <Spinner label={t('loading')} /> : data?.loans.length ? <>
        <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3">{t('bookTitle')}</th><th className="px-5 py-3">{t('isbn')}</th><th className="px-5 py-3">{t('studentId')}</th><th className="px-5 py-3">{t('student')}</th><th className="px-5 py-3">{t('issuedBy')}</th><th className="px-5 py-3">{t('issueDate')}</th><th className="px-5 py-3">{t('dueDate')}</th><th className="px-5 py-3">{t('returnDate')}</th><th className="px-5 py-3">{t('status')}</th><th className="px-5 py-3">{t('fine')}</th><th className="px-5 py-3">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">{data.loans.map((loan, index) => <tr key={loan._id} className="hover:bg-slate-50/60"><td className="px-5 py-4 text-slate-400">{(data.pagination.page - 1) * 10 + index + 1}</td><td className="px-5 py-4 font-semibold text-slate-800">{loan.book?.title}</td><td className="px-5 py-4 text-slate-500">{loan.book?.isbn}</td><td className="px-5 py-4 font-mono text-xs">{loan.student?.studentId}</td><td className="px-5 py-4"><div>{loan.student?.name}</div><div className="mt-1 text-xs text-slate-500">{loan.student?.email}</div></td><td className="px-5 py-4"><div>{loan.issuedBy?.name ?? '—'}</div>{loan.issuedByRole === 'student' && <div className="mt-1 text-xs text-slate-500">{t('selfCheckout')}</div>}</td><td className="px-5 py-4 text-slate-500">{date(loan.issuedAt)}</td><td className="px-5 py-4 text-slate-500">{date(loan.dueAt)}</td><td className="px-5 py-4 text-slate-500">{date(loan.returnedAt)}</td><td className="px-5 py-4">{loan.isOverdue ? <Badge tone="amber">{t('overdue')}</Badge> : <Badge tone={loan.status === 'returned' ? 'slate' : 'green'}>{loan.status === 'returned' ? t('returned') : t('issued')}</Badge>}</td><td className="px-5 py-4 font-semibold">{currency(loan.fine ?? 0)}</td><td className="px-5 py-4">{loan.status === 'issued' ? <Button variant="secondary" className="px-3 py-2" onClick={() => { if (window.confirm(t('returnBook') + ': ' + loan.book?.title + '?')) returnMutation.mutate(loan._id) }} disabled={returnMutation.isPending}><RotateCcw size={14} />{t('returnBook')}</Button> : <Badge>{t('returned')}</Badge>}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between gap-3 px-5 py-4"><span className="text-sm text-slate-500">{t('showing')} {data.loans.length} / {data.pagination.total}</span><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} />{t('previous')}</Button><span className="text-sm">{t('page')} {page} / {data.pagination.pages}</span><Button variant="secondary" disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('next')}<ChevronRight size={16} /></Button></div></div>
      </> : <div className="p-5"><EmptyState title={t('noRecords')} description={t('issueBook')} /></div>}
    </Card>
    {issueOpen && <Modal title={t('issueBook')} onClose={() => setIssueOpen(false)}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (student && bookId) issueMutation.mutate() }}>
      {modalError && <Alert message={modalError} />}
      <div className="flex gap-2"><Input label={t('studentId')} value={studentId} onChange={(e) => { setStudentId(e.target.value.toUpperCase()); setStudent(null) }} placeholder="STU-XXXXXX" required /><Button type="button" variant="secondary" className="mt-7" onClick={() => void lookupStudent()}><Search size={15} />{t('search')}</Button></div>
      {student && <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm"><div className="flex items-center gap-2 font-semibold text-brand-900"><UserRound size={16} />{student.name}</div><div className="mt-1 text-brand-800">{student.studentId} · {student.email}</div></div>}
      <Select label={t('selectBook')} value={bookId} onChange={(e) => setBookId(e.target.value)} required><option value="">{t('selectBook')}</option>{books.map((book) => <option key={book._id} value={book._id}>{book.title} · {book.availableCopies} {t('copiesAvailable')}</option>)}</Select>
      <div className="rounded-xl bg-brand-50 p-3 text-xs leading-5 text-brand-800"><BookOpenCheck size={15} className="mb-1" />{t('loanPeriod')} · {t('returnFineHint')}</div>
      <Button className="w-full" type="submit" disabled={issueMutation.isPending || !student || !bookId}>{issueMutation.isPending ? t('saving') : t('issueBook')}</Button>
    </form></Modal>}
  </>
}

export function StudentLoans() {
  const { t } = useLocale()
  const [status, setStatus] = useState('')
  const [queryText, setQueryText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page), limit: '10' })
  if (status) params.set('status', status)
  if (searchText) params.set('q', searchText)
  const query = useQuery({ queryKey: ['my-loans', params.toString()], queryFn: () => api<{ loans: Loan[]; pagination: Pagination }>('/me/loans?' + params.toString()) })
  return <><PageTitle title={t('issuedBooks')} description={t('returnFineHint')} />{query.error && <div className="mb-4"><Alert message={message(query.error)} /></div>}
    <Card className="mb-5"><form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); setSearchText(queryText.trim()); setPage(1) }}><Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={queryText} onChange={(e) => setQueryText(e.target.value)} /><Select aria-label={t('status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">{t('allStatuses')}</option><option value="issued">{t('issued')}</option><option value="overdue">{t('overdue')}</option><option value="returned">{t('returned')}</option></Select><Button type="submit"><Search size={15} />{t('search')}</Button></form></Card>
    <Card className="p-0">{query.isPending ? <Spinner label={t('loading')} /> : query.data?.loans.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3">{t('bookTitle')}</th><th className="px-5 py-3">{t('isbn')}</th><th className="px-5 py-3">{t('issueDate')}</th><th className="px-5 py-3">{t('dueDate')}</th><th className="px-5 py-3">{t('returnDate')}</th><th className="px-5 py-3">{t('status')}</th><th className="px-5 py-3">{t('fine')}</th></tr></thead><tbody className="divide-y divide-slate-100">{query.data.loans.map((loan, i) => <tr key={loan._id}><td className="px-5 py-4 text-slate-400">{(query.data!.pagination.page - 1) * 10 + i + 1}</td><td className="px-5 py-4 font-semibold text-slate-800">{loan.book?.title}</td><td className="px-5 py-4 text-slate-500">{loan.book?.isbn}</td><td className="px-5 py-4 text-slate-500">{date(loan.issuedAt)}</td><td className="px-5 py-4 text-slate-500">{date(loan.dueAt)}</td><td className="px-5 py-4 text-slate-500">{date(loan.returnedAt)}</td><td className="px-5 py-4">{loan.isOverdue ? <Badge tone="amber">{t('overdue')}</Badge> : <Badge tone={loan.status === 'returned' ? 'slate' : 'green'}>{loan.status === 'returned' ? t('returned') : t('issued')}</Badge>}</td><td className="px-5 py-4 font-semibold">{currency(loan.fine ?? 0)}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 px-5 py-4"><span className="text-sm text-slate-500">{t('showing')} {query.data.loans.length} / {query.data.pagination.total}</span><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} />{t('previous')}</Button><span className="text-sm">{t('page')} {page} / {query.data.pagination.pages}</span><Button variant="secondary" disabled={page >= query.data.pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('next')}<ChevronRight size={16} /></Button></div></div></> : <div className="p-5"><EmptyState title={t('noRecords')} /></div>}</Card>
  </>
}
