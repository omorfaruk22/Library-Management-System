import {
  ArrowRight, ArrowUpRight, BookCheck, BookOpen, CalendarDays, CircleAlert,
  ClipboardList, Search, Settings, Sparkles, Tags, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Badge, Card, EmptyState, Spinner } from '../components'
import { api, currency, date, message } from '../lib/api'
import { useLocale } from '../i18n'
import { useQuery } from '@tanstack/react-query'

type Stats = {
  books: number; totalCopies: number; availableBooks: number; registeredUsers: number
  authors: number; categories: number; issuedBooks: number; overdueLoans: number
  returnedBooks?: number; overdueCount?: number; totalCatalogBooks?: number
  notReturned?: number; outstandingFines?: number; maxActiveLoans?: number
}
type Loan = {
  _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: string
  isOverdue?: boolean; fine?: number; student?: { name?: string; studentId?: string }
  book?: { title?: string; isbn?: string; coverImage?: string }
}
type RecentBook = {
  _id: string; title: string; isbn: string; coverImage?: string; availableCopies: number
  author?: { name?: string }; category?: { name?: string }
}
type DashboardData = { stats: Stats; recentLoans?: Loan[]; activeLoans?: Loan[]; recentBooks?: RecentBook[] }
type Metric = { label: string; value: string | number; hint: string; icon: LucideIcon; tone: string }

function MetricCard({ item }: { item: Metric }) {
  const Icon = item.icon
  return <Card className="dashboard-metric group relative overflow-hidden">
    <div className="flex items-center justify-between">
      <span className={'grid h-11 w-11 place-items-center rounded-2xl ' + item.tone}><Icon size={20} /></span>
      <ArrowUpRight size={17} className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-700" />
    </div>
    <div className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{item.value}</div>
    <div className="mt-1 font-semibold text-slate-800">{item.label}</div>
    <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
  </Card>
}

function QuickLink({ to, icon: Icon, title, description }: { to: string; icon: LucideIcon; title: string; description: string }) {
  return <Link to={to} className="dashboard-quick group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800"><Icon size={20} /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span></span>
    <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-700" />
  </Link>
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLocale()
  const isAdmin = user?.role === 'admin'
  const query = useQuery({
    queryKey: ['dashboard', user?.role],
    queryFn: () => api<DashboardData>(isAdmin ? '/dashboard/admin' : '/dashboard/student'),
    enabled: Boolean(user?.role),
  })
  if (query.isPending) return <Spinner label={t('loading')} />
  const stats = query.data?.stats
  const adminMetrics: Metric[] = [
    { label: t('booksListed'), value: stats?.books ?? 0, hint: t('totalCopies') + ': ' + (stats?.totalCopies ?? 0), icon: BookOpen, tone: 'bg-emerald-50 text-emerald-800' },
    { label: t('copiesAvailable'), value: stats?.availableBooks ?? 0, hint: t('booksListed'), icon: BookCheck, tone: 'bg-lime-50 text-lime-800' },
    { label: t('issued'), value: stats?.issuedBooks ?? 0, hint: t('overdue') + ': ' + (stats?.overdueLoans ?? 0), icon: ClipboardList, tone: 'bg-teal-50 text-teal-800' },
    { label: t('members'), value: stats?.registeredUsers ?? 0, hint: t('registeredStudents'), icon: Users, tone: 'bg-green-50 text-green-800' },
    { label: t('authorsListed'), value: stats?.authors ?? 0, hint: t('authors'), icon: UserRound, tone: 'bg-emerald-50 text-emerald-800' },
    { label: t('categoriesListed'), value: stats?.categories ?? 0, hint: t('categories'), icon: Tags, tone: 'bg-lime-50 text-lime-800' },
  ]
  const studentMetrics: Metric[] = [
    { label: t('totalCatalogBooks'), value: stats?.totalCatalogBooks ?? 0, hint: t('booksListed'), icon: BookOpen, tone: 'bg-emerald-50 text-emerald-800' },
    { label: t('issued'), value: stats?.issuedBooks ?? 0, hint: t('maxActiveLoans') + ': ' + (stats?.maxActiveLoans ?? 5), icon: BookCheck, tone: 'bg-lime-50 text-lime-800' },
    { label: t('overdue'), value: stats?.overdueCount ?? 0, hint: t('overdueRate'), icon: CircleAlert, tone: 'bg-amber-50 text-amber-800' },
    { label: t('outstandingFines'), value: currency(stats?.outstandingFines ?? 0), hint: t('fine'), icon: CalendarDays, tone: 'bg-teal-50 text-teal-800' },
  ]
  const loans = isAdmin ? query.data?.recentLoans : query.data?.activeLoans
  const quickLinks = isAdmin ? [
    { to: '/admin/books', icon: BookOpen, title: t('books'), description: t('booksListed') },
    { to: '/admin/issued-books', icon: BookCheck, title: t('issuedBooks'), description: t('recentActivity') },
    { to: '/admin/students', icon: Users, title: t('students'), description: t('registeredStudents') },
    { to: '/admin/reports', icon: ClipboardList, title: t('reports'), description: t('recentActivity') },
    { to: '/admin/categories', icon: Tags, title: t('categories'), description: t('categoriesListed') },
    { to: '/admin/settings', icon: Settings, title: t('settings'), description: t('loanPeriod') },
  ] : [
    { to: '/books', icon: Search, title: t('browseBooks'), description: t('discover') },
    { to: '/issued-books', icon: BookCheck, title: t('issuedBooks'), description: t('returnFineHint') },
    { to: '/profile', icon: UserRound, title: t('profile'), description: t('account') },
  ]
  return <div className="dashboard-page space-y-7">
    <section className="dashboard-hero relative isolate overflow-hidden rounded-[2rem] px-6 py-7 text-white shadow-xl sm:px-9 sm:py-9">
      <div className="dashboard-orb dashboard-orb-one" /><div className="dashboard-orb dashboard-orb-two" />
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
            <Sparkles size={14} /> {t('brand')} <span className="text-white/40">/</span> {isAdmin ? t('adminArea') : t('studentArea')}
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{isAdmin ? t('adminDashboard') : t('welcome') + ', ' + (user?.name.split(' ')[0] ?? '')}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75 sm:text-base">{isAdmin ? t('tagline') : t('studentDashboard')}</p>
        </div>
        <Link to={isAdmin ? '/admin/books' : '/books'} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-emerald-950 shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-lime-200">
          {isAdmin ? t('books') : t('browseBooks')} <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="relative z-10 mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-emerald-50/75">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-lime-300" />{isAdmin ? t('registeredStudents') : t('maxActiveLoans') + ': ' + (stats?.maxActiveLoans ?? 5)}</span>
        <span>{isAdmin ? (stats?.registeredUsers ?? 0) + ' ' + t('members') : (stats?.issuedBooks ?? 0) + ' ' + t('issued').toLowerCase()}</span>
        {isAdmin && <span>{t('overdue')}: {stats?.overdueLoans ?? 0}</span>}
      </div>
    </section>

    {query.error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{message(query.error)}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {(isAdmin ? adminMetrics : studentMetrics).map((item) => <MetricCard key={item.label} item={item} />)}
    </section>

    <section className="grid gap-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
      <Card className="dashboard-panel overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{isAdmin ? t('recentActivity') : t('studentArea')}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{t('issuedBooks')}</h2></div>
          <Link to={isAdmin ? '/admin/issued-books' : '/issued-books'} className="inline-flex items-center gap-1 text-sm font-bold text-brand-800 hover:text-brand-600">{t('viewAll')} <ArrowRight size={15} /></Link>
        </div>
        {!loans?.length ? <div className="p-5"><EmptyState title={isAdmin ? t('noRecords') : t('emptyDashboard')} description={isAdmin ? t('recentActivity') : t('discover')} /></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">{t('book')}</th>{isAdmin && <th className="px-5 py-3">{t('student')}</th>}<th className="px-5 py-3">{t('dueDate')}</th><th className="px-5 py-3">{t('status')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{loans.map((loan) => <tr key={loan._id} className="transition hover:bg-emerald-50/40">
              <td className="px-5 py-4"><span className="font-semibold text-slate-900">{loan.book?.title ?? '—'}</span><span className="mt-1 block text-xs text-slate-500">{loan.book?.isbn}</span></td>
              {isAdmin && <td className="px-5 py-4"><span className="font-medium text-slate-800">{loan.student?.name ?? '—'}</span><span className="mt-1 block text-xs text-slate-500">{loan.student?.studentId}</span></td>}
              <td className="px-5 py-4 text-slate-600">{date(loan.dueAt)}</td><td className="px-5 py-4">{loan.isOverdue ? <Badge tone="amber">{t('overdue')}</Badge> : <Badge tone="green">{t('issued')}</Badge>}</td>
            </tr>)}</tbody>
          </table></div>}
      </Card>

      <Card className="dashboard-panel">
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{t('dashboard')}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{isAdmin ? t('adminArea') : t('account')}</h2></div>
        <div className="grid gap-3">{quickLinks.map((item) => <QuickLink key={item.to} {...item} />)}</div>
      </Card>
    </section>

    {!isAdmin && <section>
      <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{t('discover')}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{t('recentBooks')}</h2></div><Link to="/books" className="inline-flex items-center gap-1 text-sm font-bold text-brand-800">{t('viewAll')} <ArrowRight size={15} /></Link></div>
      {query.data?.recentBooks?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{query.data.recentBooks.map((book) =>
        <Link to={'/books/' + book._id} key={book._id} className="dashboard-book group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div className="relative h-40 overflow-hidden bg-gradient-to-br from-emerald-50 to-lime-100">{book.coverImage ? <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-brand-800"><BookOpen size={38} /></div>}<span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-emerald-900">{book.availableCopies} {t('copiesAvailable')}</span></div>
          <div className="p-4"><div className="line-clamp-2 min-h-10 font-bold text-slate-900">{book.title}</div><p className="mt-1 truncate text-xs text-slate-500">{book.author?.name ?? '—'} · {book.category?.name ?? '—'}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-800">{t('viewAll')} <ArrowRight size={13} /></span></div>
        </Link>)}</div> : <EmptyState title={t('noRecentBooks')} />}
    </section>}
  </div>
}
