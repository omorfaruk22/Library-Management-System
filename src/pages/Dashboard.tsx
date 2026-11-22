import {
  ArrowRight, BookCheck, BookOpen, CalendarClock, CalendarDays, CircleAlert, CircleDollarSign, ClipboardList,
  Clock3, PackageSearch, Settings, Sparkles, Tags, TrendingDown, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { Alert, Badge, Card, CoverCard, EmptyState, SectionHeading, Skeleton, StatCard } from '../ui/primitives'
import { api, currency, date, daysUntil, message } from '../lib/api'
import { useLocale } from '../i18n'

type Stats = {
  books?: number; totalCopies?: number; availableBooks?: number; registeredUsers?: number
  authors?: number; categories?: number; issuedBooks?: number; overdueLoans?: number
  returnedBooks?: number; overdueCount?: number; totalCatalogBooks?: number; returned?: number
  notReturned?: number; outstandingFines?: number; maxActiveLoans?: number
}
type Loan = {
  _id: string; issuedAt: string; dueAt: string; returnedAt?: string; status: string
  isOverdue?: boolean; fine?: number; student?: { name?: string; studentId?: string; email?: string }
  book?: { _id?: string; title?: string; isbn?: string; coverImage?: string }
}
type RecentBook = { _id: string; title: string; isbn: string; coverImage?: string; price?: number; availableCopies: number; author?: { name?: string }; category?: { name?: string } }
type DashboardData = { stats: Stats; recentLoans?: Loan[]; activeLoans?: Loan[]; recentBooks?: RecentBook[]; policy?: { loanPeriodDays: number; finePerDay: number; maxActiveLoans: number } }
type BusinessSummary = { todaySales: number; todaySaleCount?: number; todayPurchases: number; todayExpenses: number; receivables: number; payables: number; lowStock: number }

function dueBadge(loan: Loan) {
  const remaining = daysUntil(loan.dueAt)
  if (loan.status === 'returned') return <Badge tone="slate">Returned</Badge>
  if (remaining === null) return <Badge tone="slate">—</Badge>
  if (remaining < 0) return <Badge tone="red" dot>{Math.abs(remaining)}d overdue</Badge>
  if (remaining === 0) return <Badge tone="amber" dot>Due today</Badge>
  if (remaining <= 3) return <Badge tone="amber" dot>{remaining}d left</Badge>
  return <Badge tone="green" dot>{remaining}d left</Badge>
}

function QuickAction({ to, icon: Icon, title, description }: { to: string; icon: LucideIcon; title: string; description: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white"><Icon size={16} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{description}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
    </Link>
  )
}

function LoanTable({ loans, isAdmin }: { loans: Loan[]; isAdmin: boolean }) {
  const { t } = useLocale()
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[560px]">
        <thead>
          <tr>
            <th>{t('book')}</th>
            {isAdmin && <th>{t('student')}</th>}
            <th>{t('dueDate')}</th>
            <th className="text-right">{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan._id}>
              <td>
                <div className="flex items-center gap-2.5">
                  <CoverCard title={loan.book?.title ?? '—'} src={loan.book?.coverImage} size="sm" className="h-10 w-7 shrink-0 rounded" />
                  <div className="min-w-0">
                    <span className="block max-w-[220px] truncate font-semibold text-slate-900">{loan.book?.title ?? '—'}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{loan.book?.isbn}</span>
                  </div>
                </div>
              </td>
              {isAdmin && <td>
                <span className="block font-medium text-slate-800">{loan.student?.name ?? '—'}</span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{loan.student?.studentId}</span>
              </td>}
              <td className="whitespace-nowrap text-slate-600">{date(loan.dueAt)}</td>
              <td className="text-right">{dueBadge(loan)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLocale()
  const isAdmin = user?.role === 'admin'
  const businessQuery = useQuery({ queryKey: ['business-summary'], queryFn: () => api<BusinessSummary>('/admin/business/summary'), enabled: isAdmin })
  const query = useQuery({
    queryKey: ['dashboard', user?.role],
    queryFn: () => api<DashboardData>(isAdmin ? '/dashboard/admin' : '/dashboard/student'),
    enabled: Boolean(user?.role),
  })

  if (query.isPending) {
    return <div className="space-y-5">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div>
      <Skeleton className="h-72 w-full" />
    </div>
  }

  const stats = query.data?.stats ?? {}
  const loans = (isAdmin ? query.data?.recentLoans : query.data?.activeLoans) ?? []
  const overdueCount = stats.overdueCount ?? stats.overdueLoans ?? 0
  const lending = stats.issuedBooks ?? stats.notReturned ?? 0
  const business = businessQuery.data

  const memberStats = [
    { label: t('issued'), value: lending, hint: t('maxActiveLoans') + ' ' + (stats.maxActiveLoans ?? user ? (stats.maxActiveLoans ?? 5) : 5), icon: BookCheck, tone: 'lime' as const },
    { label: t('overdue'), value: overdueCount, hint: overdueCount ? t('returnFineHint') : 'Nothing overdue — nicely done.', icon: CircleAlert, tone: overdueCount ? 'amber' as const : 'brand' as const },
    { label: t('outstandingFines'), value: currency(stats.outstandingFines ?? 0), hint: t('overdueRate'), icon: CalendarDays, tone: 'rose' as const },
    { label: t('totalCatalogBooks'), value: stats.totalCatalogBooks ?? stats.books ?? 0, hint: t('booksListed'), icon: BookOpen, tone: 'teal' as const },
  ]
  const staffStats = [
    { label: t('issued'), value: lending, hint: `${overdueCount} ${t('overdue').toLowerCase()}`, icon: ClipboardList, tone: 'lime' as const },
    { label: t('members'), value: stats.registeredUsers ?? 0, hint: t('registeredStudents'), icon: Users, tone: 'brand' as const },
    { label: t('todaySales'), value: currency(business?.todaySales ?? 0), hint: `${t('receivables')}: ${currency(business?.receivables ?? 0)}`, icon: CircleDollarSign, tone: 'teal' as const },
    { label: t('lowStock'), value: business?.lowStock ?? 0, hint: 'Titles with 3 or fewer copies', icon: TrendingDown, tone: (business?.lowStock ?? 0) > 0 ? 'amber' as const : 'brand' as const },
  ]

  const quickLinks = isAdmin ? [
    { to: '/admin/sales', icon: CircleDollarSign, title: t('sales'), description: 'Create invoices and collect payments' },
    { to: '/admin/issued-books', icon: BookCheck, title: t('manageIssued'), description: 'Issue, return and settle fines' },
    { to: '/admin/inventory', icon: PackageSearch, title: t('inventory'), description: 'Stock counts and movement history' },
    { to: '/admin/students', icon: Users, title: t('students'), description: 'Members, access and loan history' },
    { to: '/admin/reports', icon: ClipboardList, title: t('reports'), description: 'Circulation data and CSV export' },
    { to: '/admin/settings', icon: Settings, title: t('settings'), description: 'Loan period, fines and limits' },
  ] : [
    { to: '/books', icon: PackageSearch, title: t('browseBooks'), description: t('discover') },
    { to: '/issued-books', icon: BookCheck, title: t('issuedBooks'), description: 'Due dates and borrowing history' },
    { to: '/wishlist', icon: Tags, title: t('wishlist'), description: 'Books saved for later' },
    { to: '/reservations', icon: CalendarClock, title: t('reservations'), description: 'Your place in the waiting queue' },
    { to: '/profile', icon: UserRound, title: t('profile'), description: t('account') },
  ]

  const firstName = user?.name.split(' ')[0] ?? ''
  const nextDue = [...loans].filter((loan) => loan.status === 'issued').sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0]

  return (
    <div className="space-y-6">
      {query.error && <Alert message={message(query.error)} />}

      <section className="hero-canvas fade-up relative isolate overflow-hidden rounded-3xl px-5 py-7 text-white sm:px-8 sm:py-8">
        <span className="hero-ring -right-16 -top-24 h-72 w-72" aria-hidden="true" />
        <span className="hero-glow -right-4 top-4 h-40 w-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-50">
              <Sparkles size={12} className="text-lime-accent" aria-hidden="true" />{isAdmin ? t('adminArea') : t('studentArea')}
            </span>
            <h1 className="mt-3 font-display text-[26px] font-semibold leading-tight sm:text-[34px]">
              {isAdmin ? t('adminDashboard') : `${t('welcome')}, ${firstName}`}
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-emerald-50/70">
              {isAdmin ? 'Circulation, members and the counter ledger in one view.' : t('studentDashboard') + ' — everything you have borrowed, at a glance.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to={isAdmin ? '/admin/books' : '/books'} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime-accent px-4 text-[13px] font-bold text-brand-950 transition hover:bg-lime-200">
              {isAdmin ? t('manageBooks') : t('browseBooks')}<ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link to={isAdmin ? '/admin/issued-books' : '/issued-books'} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 px-4 text-[13px] font-semibold text-white transition hover:bg-white/10">
              {t('issuedBooks')}
            </Link>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11.5px] text-emerald-50/70">
          {isAdmin ? <>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lime-accent" />{stats.registeredUsers ?? 0} {t('members').toLowerCase()}</span>
            <span>{t('overdue')}: <span className="font-semibold text-white">{overdueCount}</span></span>
            <span>{t('authors')}: <span className="font-semibold text-white">{stats.authors ?? 0}</span></span>
            <span>{t('categories')}: <span className="font-semibold text-white">{stats.categories ?? 0}</span></span>
          </> : <>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={12} />{t('loanPeriod')}</span>
            <span>{t('maxActiveLoans')}: <span className="font-semibold text-white">{stats.maxActiveLoans ?? 5}</span></span>
            {nextDue ? <span>Next due <span className="font-semibold text-lime-accent">{date(nextDue.dueAt)}</span></span> : <span>No active loans</span>}
          </>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(isAdmin ? staffStats : memberStats).map((item) => <StatCard key={item.label} {...item} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">{isAdmin ? t('recentActivity') : 'Your loans'}</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">{t('issuedBooks')}</h2>
            </div>
            <Link to={isAdmin ? '/admin/issued-books' : '/issued-books'} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800">{t('viewAll')}<ArrowRight size={13} /></Link>
          </div>
          {loans.length ? <LoanTable loans={loans} isAdmin={isAdmin} /> : (
            <EmptyState icon={BookCheck} title={isAdmin ? t('noRecords') : t('emptyDashboard')}
              description={isAdmin ? 'Issued books will appear here as soon as the first loan is created.' : undefined}
              action={<Link to="/books" className="text-[13px] font-semibold text-brand-700">{t('browseBooks')} →</Link>} />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow={t('quickActions')} title={isAdmin ? t('adminArea') : t('account')} />
          <div className="grid gap-2">
            {quickLinks.map((item) => <QuickAction key={item.to} {...item} />)}
          </div>
        </Card>
      </section>

      {isAdmin && business && (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: t('receivables'), value: currency(business.receivables), hint: 'Outstanding customer balances', tone: 'amber' as const },
            { label: t('payables'), value: currency(business.payables), hint: 'Owed to suppliers', tone: 'rose' as const },
            { label: t('expenses'), value: currency(business.todayExpenses), hint: 'Recorded today', tone: 'teal' as const },
          ].map((item) => <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} icon={CalendarDays} tone={item.tone} />)}
        </section>
      )}

      {!isAdmin && (
        <section>
          <SectionHeading eyebrow={t('discover')} title={t('recentBooks')} action={<Link to="/books" className="text-[12.5px] font-semibold text-brand-700">{t('viewAll')} →</Link>} />
          {query.data?.recentBooks?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {query.data.recentBooks.map((book) => (
                <Link key={book._id} to={'/books/' + book._id} className="surface card-hover group overflow-hidden p-0">
                  <div className="relative h-36 overflow-hidden">
                    <CoverCard title={book.title} src={book.coverImage} className="h-full w-full" />
                    <span className="absolute right-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-brand-800 backdrop-blur">{book.availableCopies} {t('copiesAvailable')}</span>
                  </div>
                  <div className="p-3.5">
                    <p className="line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-5 text-slate-900 group-hover:text-brand-800">{book.title}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{book.author?.name ?? '—'}</p>
                    <p className="mt-2 font-display text-[14px] font-semibold text-brand-800">{currency(book.price ?? 0)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : <Card><EmptyState title={t('noRecentBooks')} /></Card>}
        </section>
      )}
    </div>
  )
}
