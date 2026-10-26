import { BookOpen, BookCheck, Users, UserRound, Tags, CircleAlert, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Badge, Card, EmptyState, PageTitle, Spinner } from '../components'
import { api, currency, date, message } from '../lib/api'
import { useLocale } from '../i18n'
import { useQuery } from '@tanstack/react-query'

type Stats = { books: number; totalCopies: number; availableBooks: number; registeredUsers: number; authors: number; categories: number; issuedBooks: number; overdueLoans: number; returnedBooks?: number; overdueCount?: number; totalCatalogBooks?: number; notReturned?: number; outstandingFines?: number; maxActiveLoans?: number }
type Loan = { _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: string; isOverdue?: boolean; fine?: number; student?: { name?: string; studentId?: string }; book?: { title?: string; isbn?: string; coverImage?: string } }
type RecentBook = { _id: string; title: string; isbn: string; coverImage?: string; availableCopies: number; author?: { name?: string }; category?: { name?: string } }
type DashboardData = { stats: Stats; recentLoans?: Loan[]; activeLoans?: Loan[]; recentBooks?: RecentBook[] }
const icons = [BookOpen, BookCheck, Users, UserRound, Tags, CircleAlert]
export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLocale()
  const query = useQuery({ queryKey: ['dashboard', user?.role], queryFn: () => api<DashboardData>(user?.role === 'admin' ? '/dashboard/admin' : '/dashboard/student'), enabled: Boolean(user?.role) })
  if (query.isPending) return <Spinner label={t('loading')} />
  const data = query.data
  const stats = data?.stats
  const adminCards = [
    { label: t('booksListed'), value: stats?.books ?? 0, hint: `${t('totalCopies')}: ${stats?.totalCopies ?? 0}` },
    { label: t('copiesAvailable'), value: stats?.availableBooks ?? 0, hint: t('booksListed') },
    { label: t('issued'), value: stats?.issuedBooks ?? 0, hint: `${t('overdue')}: ${stats?.overdueLoans ?? 0}` },
    { label: t('members'), value: stats?.registeredUsers ?? 0, hint: t('registeredStudents') },
    { label: t('authorsListed'), value: stats?.authors ?? 0, hint: t('authors') },
    { label: t('categoriesListed'), value: stats?.categories ?? 0, hint: t('categories') },
  ]
  const studentCards = [
    { label: t('totalCatalogBooks'), value: stats?.totalCatalogBooks ?? 0, hint: t('booksListed') },
    { label: t('issued'), value: stats?.issuedBooks ?? 0, hint: `${t('maxActiveLoans')}: ${stats?.maxActiveLoans ?? 5}` },
    { label: t('notReturned'), value: stats?.notReturned ?? 0, hint: t('issuedBooks') },
    { label: t('overdue'), value: stats?.overdueCount ?? 0, hint: t('overdueRate') },
    { label: t('outstandingFines'), value: currency(stats?.outstandingFines ?? 0), hint: t('fine') },
  ]
  const loans = user?.role === 'admin' ? data?.recentLoans : data?.activeLoans
  return <>
    <PageTitle title={user?.role === 'admin' ? t('adminDashboard') : t('welcome') + ', ' + user?.name.split(' ')[0]} description={user?.role === 'admin' ? t('tagline') : t('studentDashboard')} action={user?.role === 'student' ? <Link to="/books" className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">{t('browseBooks')}<ArrowUpRight size={16} /></Link> : undefined} />
    {query.error && <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{message(query.error)}</div>}
    <div className={'grid gap-4 ' + (user?.role === 'admin' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3')}>{(user?.role === 'admin' ? adminCards : studentCards).map((card, index) => { const Icon = icons[index % icons.length]; return <Card key={card.label} className="relative overflow-hidden"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon size={21} /></div><ArrowUpRight className="text-slate-300" size={17} /></div><div className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{card.value}</div><div className="mt-1 font-semibold text-slate-700">{card.label}</div><div className="mt-1 text-xs text-slate-500">{card.hint}</div></Card> })}</div>
    <Card className="mt-7 p-0"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-bold text-slate-900">{user?.role === 'admin' ? t('recentActivity') : t('issuedBooks')}</h2><p className="mt-1 text-xs text-slate-500">{user?.role === 'student' ? t('returnFineHint') : t('loanPeriod') + ' · ' + t('overdueRate')}</p></div><Link to={user?.role === 'admin' ? '/admin/issued-books' : '/issued-books'} className="text-sm font-semibold text-brand-700">{t('viewAll')}</Link></div>{!loans?.length ? <div className="p-5"><EmptyState title={user?.role === 'student' ? t('emptyDashboard') : t('noRecords')} /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{t('book')}</th>{user?.role === 'admin' && <th className="px-5 py-3">{t('student')}</th>}<th className="px-5 py-3">{t('issueDate')}</th><th className="px-5 py-3">{t('dueDate')}</th><th className="px-5 py-3">{t('status')}</th></tr></thead><tbody className="divide-y divide-slate-100">{loans.map((loan) => <tr key={loan._id}><td className="px-5 py-4 font-semibold text-slate-800">{loan.book?.title ?? '—'}<span className="mt-1 block text-xs font-normal text-slate-500">{loan.book?.isbn}</span></td>{user?.role === 'admin' && <td className="px-5 py-4">{loan.student?.name}<span className="mt-1 block text-xs text-slate-500">{loan.student?.studentId}</span></td>}<td className="px-5 py-4 text-slate-500">{date(loan.issuedAt)}</td><td className="px-5 py-4 text-slate-500">{date(loan.dueAt)}</td><td className="px-5 py-4">{loan.isOverdue ? <Badge tone="amber">{t('overdue')}</Badge> : <Badge tone="green">{t('issued')}</Badge>}</td></tr>)}</tbody></table></div>}</Card>
    {user?.role === 'student' && <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold text-slate-900">{t('recentBooks')}</h2><p className="mt-1 text-sm text-slate-500">{t('discover')}</p></div><Link to="/books" className="text-sm font-semibold text-brand-700">{t('viewAll')}</Link></div>{data?.recentBooks?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.recentBooks.map((book) => <Card key={book._id} className="overflow-hidden p-0"><div className="h-40 bg-brand-50">{book.coverImage ? <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-brand-700"><BookOpen size={38} /></div>}</div><div className="p-4"><div className="font-bold text-slate-800">{book.title}</div><p className="mt-1 text-xs text-slate-500">{book.author?.name ?? '—'} · {book.category?.name ?? '—'}</p><p className="mt-3 text-xs font-semibold text-brand-700">{book.availableCopies} {t('copiesAvailable')}</p></div></Card>)}</div> : <EmptyState title={t('noRecentBooks')} />}</section>}
  </>
}
