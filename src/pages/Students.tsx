import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Ban, Mail, Phone, Search, UserCheck, UserRound, Users } from 'lucide-react'
import { useLocale } from '../i18n'
import {
  Alert, Badge, Button, Card, EmptyState, Input, Modal, PageTitle, Pagination, SkeletonRows, Toolbar,
} from '../ui/primitives'
import { api, currency, date, message } from '../lib/api'

type Student = { _id: string; name: string; email: string; studentId: string; phone?: string; status: 'active' | 'suspended'; createdAt: string; updatedAt?: string }
type Loan = { _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: string; fine: number; book?: { title?: string; isbn?: string }; isOverdue?: boolean }
type PaginationData = { page: number; pages: number; total: number }

const PAGE_SIZE = 10

export default function Students() {
  const { t } = useLocale()
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pages: 1, total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState<{ student: Student; loans: Loan[] } | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [confirmStatus, setConfirmStatus] = useState<Student | null>(null)

  const load = useCallback(async (targetPage = page, q = searchText) => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) })
      if (q) params.set('q', q)
      const data = await api<{ students: Student[]; pagination: PaginationData }>('/admin/students?' + params.toString())
      setStudents(data.students); setPagination(data.pagination)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [page, searchText])
  useEffect(() => { void load() }, [load])

  const showDetails = async (student: Student) => {
    setDetailBusy(true); setDetailError(''); setDetail(null)
    try { setDetail(await api<{ student: Student; loans: Loan[] }>('/admin/students/' + student._id)) }
    catch (err) { setDetailError(message(err)) } finally { setDetailBusy(false) }
  }
  const changeStatus = async () => {
    if (!confirmStatus) return
    const next = confirmStatus.status === 'active' ? 'suspended' : 'active'
    try {
      await api('/admin/students/' + confirmStatus._id + '/status', { method: 'PATCH', body: JSON.stringify({ status: next }) })
      setNotice(next === 'active' ? 'Member reactivated.' : 'Member suspended from borrowing.')
      setConfirmStatus(null)
      await load()
    } catch (err) { setError(message(err)); setConfirmStatus(null) }
  }

  const activeCount = students.filter((student) => student.status === 'active').length

  return (
    <>
      <PageTitle
        eyebrow={t('circulationGroup')}
        title={t('registeredStudents')}
        description="Member records, borrowing access and full loan history."
      />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <Card className="overflow-hidden p-0">
        <Toolbar className="justify-between">
          <form onSubmit={(event: FormEvent) => { event.preventDefault(); setPage(1); setSearchText(query.trim()) }} className="flex w-full gap-2 sm:w-auto">
            <Input aria-label={t('searchStudents')} placeholder={t('searchStudents')} value={query} onChange={(event) => setQuery(event.target.value)} icon={<Search size={15} />} className="sm:w-80" />
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
          <p className="text-[11.5px] text-slate-500">{pagination.total} {t('members').toLowerCase()} · <span className="font-semibold text-emerald-700">{activeCount} active on this page</span></p>
        </Toolbar>

        {busy ? <SkeletonRows rows={5} /> : students.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[860px]">
                <thead><tr><th>{t('student')}</th><th>{t('studentId')}</th><th>{t('phone')}</th><th>{t('registrationDate')}</th><th>{t('status')}</th><th className="text-right">{t('actions')}</th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-800">{student.name.trim().slice(0, 1).toUpperCase()}</span>
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-slate-900">{student.name}</span>
                            <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-slate-500"><Mail size={11} />{student.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-[11.5px] text-slate-600">{student.studentId}</td>
                      <td className="text-[12px] text-slate-500">{student.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} />{student.phone}</span> : '—'}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-500">{date(student.createdAt)}</td>
                      <td><Badge tone={student.status === 'active' ? 'green' : 'red'} dot>{student.status === 'active' ? t('active') : t('suspended')}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => void showDetails(student)}>{t('details')}</Button>
                          <Button size="sm" variant={student.status === 'active' ? 'danger' : 'secondary'} onClick={() => setConfirmStatus(student)}>
                            {student.status === 'active' ? <><Ban size={13} />{t('suspend')}</> : <><UserCheck size={13} />{t('activate')}</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pagination.pages} total={pagination.total} shown={students.length} onChange={setPage} />
          </>
        ) : <EmptyState icon={Users} title={t('noRecords')} description="Member accounts appear here after registration." />}
      </Card>

      {(detail || detailBusy || detailError) && (
        <Modal wide title={t('details')} description={detail?.student.name} onClose={() => { setDetail(null); setDetailError('') }}>
          {detailBusy ? <SkeletonRows rows={4} /> : detailError ? <Alert message={detailError} /> : detail && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-[12.5px] sm:grid-cols-2">
                {[
                  [t('fullName'), detail.student.name], [t('email'), detail.student.email],
                  [t('studentId'), detail.student.studentId], [t('phone'), detail.student.phone || '—'],
                  [t('registrationDate'), date(detail.student.createdAt)], [t('status'), detail.student.status],
                ].map(([label, value]) => (
                  <div key={label}><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 font-medium text-slate-800">{value}</dd></div>
                ))}
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900"><UserRound size={14} className="text-brand-700" />{t('issuedBooks')} · {detail.loans.length}</h3>
                {detail.loans.length ? (
                  <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
                    <table className="data-table">
                      <thead><tr><th>{t('bookTitle')}</th><th>{t('issueDate')}</th><th>{t('dueDate')}</th><th>{t('status')}</th><th className="text-right">{t('fine')}</th></tr></thead>
                      <tbody>
                        {detail.loans.map((loan) => (
                          <tr key={loan._id}>
                            <td className="font-medium text-slate-800">{loan.book?.title}</td>
                            <td className="whitespace-nowrap text-[12px] text-slate-500">{date(loan.issuedAt)}</td>
                            <td className="whitespace-nowrap text-[12px] text-slate-500">{date(loan.dueAt)}</td>
                            <td><Badge tone={loan.isOverdue ? 'red' : loan.status === 'returned' ? 'slate' : 'green'}>{loan.isOverdue ? t('overdue') : loan.status === 'returned' ? t('returned') : t('issued')}</Badge></td>
                            <td className="text-right">{currency(loan.fine)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[12.5px] text-slate-500">{t('noRecords')}</p>}
              </div>
            </div>
          )}
        </Modal>
      )}

      {confirmStatus && (
        <Modal title={(confirmStatus.status === 'active' ? t('suspend') : t('activate')) + ' · ' + confirmStatus.name} onClose={() => setConfirmStatus(null)}
          footer={<><Button variant="secondary" onClick={() => setConfirmStatus(null)}>{t('cancel')}</Button><Button variant={confirmStatus.status === 'active' ? 'danger' : 'primary'} onClick={() => void changeStatus()}>{confirmStatus.status === 'active' ? t('suspend') : t('activate')}</Button></>}>
          <p className="text-sm leading-6 text-slate-600">
            {confirmStatus.status === 'active'
              ? 'Suspended members keep their history but cannot borrow new books or sign in to borrow. Existing loans still need returning.'
              : 'Reactivating restores borrowing immediately. Outstanding fines are unaffected.'}
          </p>
        </Modal>
      )}
    </>
  )
}
