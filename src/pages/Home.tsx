import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookMarked, BookOpen, CalendarClock, Check, ChevronRight, CircleDollarSign, ClipboardCheck,
  Clock3, Heart, LibraryBig, Search, ShieldCheck, Sparkles, Star, Tags, Users, UsersRound, Warehouse, type LucideIcon,
} from 'lucide-react'
import { Alert, Badge, Card, CoverCard, SectionHeading, Skeleton } from '../ui/primitives'
import { HeroBadge, MetricStrip, TextLink } from '../ui/marketing'
import { useLocale } from '../i18n'
import { api, currency, message } from '../lib/api'

type Book = {
  _id: string; title: string; isbn: string; description?: string; coverImage?: string; price?: number
  availableCopies: number; totalCopies: number; author?: { name: string }; category?: { name: string }
}

const features: Array<{ icon: LucideIcon; title: string; body: string }> = [
  { icon: Search, title: 'Find any title in seconds', body: 'Search by title, ISBN, author or subject, then filter to the copies that are on the shelf right now.' },
  { icon: BookMarked, title: 'Borrow with a due date', body: 'Self-checkout with a 14-day loan, automatic Asia/Dhaka due dates and a clear fine of ৳4 per overdue day.' },
  { icon: Heart, title: 'Wishlist and reservations', body: 'Save books for later and join the waiting queue when every copy is already out on loan.' },
  { icon: Warehouse, title: 'Stock you can trust', body: 'Damaged, lost and stocktake adjustments are recorded, so shelf counts always match the ledger.' },
  { icon: CircleDollarSign, title: 'Counter sales, one ledger', body: 'Sell and lend from the same catalogue. Invoices, dues and supplier payments stay in one place.' },
  { icon: ShieldCheck, title: 'Private by default', body: 'Server-checked roles, hashed passwords, rate limits and audit records keep member data protected.' },
]

const workflow: Array<{ icon: LucideIcon; step: string; title: string; body: string }> = [
  { icon: UsersRound, step: '01', title: 'Join the library', body: 'Create a member account and receive a student ID instantly — no paperwork at the desk.' },
  { icon: Search, step: '02', title: 'Browse the collection', body: 'Scan the catalogue, read detail pages, and check live availability and shelf locations.' },
  { icon: CalendarClock, step: '03', title: 'Borrow and return', body: 'Borrow on the spot or ask the desk. Due dates, renewals and fines are calculated for you.' },
]

export default function Home() {
  const { t } = useLocale()
  const [summary, setSummary] = useState({ books: 0, categories: 0 })
  const [books, setBooks] = useState<Book[]>([])
  const [featured, setFeatured] = useState<Book[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([api<typeof summary>('/public/summary'), api<{ books: Book[] }>('/books?limit=8&sort=newest')])
      .then(([s, b]) => {
        if (!alive) return
        setSummary(s)
        setBooks(b.books.slice(0, 4))
        setFeatured(b.books.slice(4, 8))
      })
      .catch((err) => { if (alive) setError(message(err)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="space-y-16 pb-6 sm:space-y-20">
      {/* ---------------------------------------------------------------- hero */}
      <section className="hero-canvas fade-up relative overflow-hidden rounded-[28px] px-6 py-10 text-white shadow-[0_30px_80px_-40px_rgba(7,35,25,.7)] sm:px-10 sm:py-14 lg:px-14">
        <span className="hero-ring -right-24 -top-32 h-[26rem] w-[26rem]" aria-hidden="true" />
        <span className="hero-ring -bottom-40 right-24 h-72 w-72" aria-hidden="true" />
        <span className="hero-glow -right-10 top-10 h-64 w-64" aria-hidden="true" />
        <div className="relative grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div className="min-w-0">
            <HeroBadge>{t('brand')} · Library & counter</HeroBadge>
            <h1 className="mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[46px] lg:text-[52px]">
              {t('libraryHero')}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-[15px]">{t('heroText')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/books" className="inline-flex h-12 items-center gap-2 rounded-xl bg-lime-accent px-5 text-sm font-bold text-brand-950 shadow-[0_10px_30px_-12px_rgba(205,240,106,.8)] transition hover:-translate-y-0.5 hover:bg-lime-200">
                {t('browseBooks')} <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/register" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10">
                {t('joinLibrary')} <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-emerald-50/70">
              {['14-day loans', '৳4 per overdue day', 'Asia/Dhaka calendar'].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5"><Check size={13} className="text-lime-accent" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50/60">On the shelf today</p>
                <Badge tone="green" dot className="bg-lime-accent/15 text-lime-100 ring-lime-200/25">Live</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {loading && [0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full bg-white/10" />)}
                {!loading && books.slice(0, 3).map((book) => (
                  <Link key={book._id} to={'/books/' + book._id} className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-2.5 transition hover:bg-white/[0.12]">
                    <CoverCard title={book.title} src={book.coverImage} size="sm" className="h-14 w-10 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white">{book.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-emerald-50/60">{book.author?.name ?? '—'}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-bold text-lime-100">{book.availableCopies} left</span>
                  </Link>
                ))}
                {!loading && !books.length && <p className="rounded-xl bg-white/5 p-4 text-xs text-emerald-50/60">The catalogue is being prepared. Check back shortly.</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-8">
          <MetricStrip items={[
            { label: t('totalCollection'), value: loading ? '—' : summary.books, icon: LibraryBig },
            { label: t('serviceCategories'), value: loading ? '—' : summary.categories, icon: Tags },
            { label: t('loanPeriod'), value: t('days14'), icon: Clock3 },
          ]} />
        </div>
      </section>

      {error && <Alert message={error} tone="info" />}

      {/* ------------------------------------------------------------ features */}
      <section>
        <SectionHeading
          eyebrow="Why Leafline"
          title="Everything a lending library needs, nothing it doesn't"
          description="Catalogue, circulation, members and counter sales share one clean workspace — with the safeguards a real library depends on."
          action={<TextLink to="/books">{t('browseBooks')}</TextLink>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="card-hover p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700"><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-slate-500">{feature.body}</p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ workflow */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white">
        <div className="grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="hero-canvas relative p-7 text-white sm:p-9">
            <span className="hero-ring -left-16 -top-16 h-56 w-56" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-accent/80">How it works</p>
            <h2 className="mt-2 max-w-sm font-display text-[26px] font-semibold leading-tight sm:text-[30px]">From first visit to first loan in minutes</h2>
            <p className="mt-3 max-w-sm text-[13px] leading-6 text-emerald-50/70">Members manage their own reading. Staff keep the ledger clean. Nothing gets lost between the two.</p>
            <div className="mt-7 space-y-4">
              {workflow.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.step} className="flex gap-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-lime-accent"><Icon size={16} aria-hidden="true" /></span>
                    <div>
                      <p className="text-[10.5px] font-bold tracking-[0.2em] text-emerald-50/45">{item.step}</p>
                      <p className="mt-0.5 text-[14px] font-semibold">{item.title}</p>
                      <p className="mt-1 text-[12.5px] leading-6 text-emerald-50/65">{item.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="p-7 sm:p-9">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{t('discover')}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Recently added to the shelves</h2>
              </div>
              <TextLink to="/books">All books</TextLink>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {loading && [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-[86px] w-full" />)}
              {!loading && featured.map((book) => (
                <Link key={book._id} to={'/books/' + book._id} className="group flex gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:border-brand-200 hover:bg-brand-50/40">
                  <CoverCard title={book.title} src={book.coverImage} size="sm" className="h-[66px] w-12 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-5 text-slate-900 group-hover:text-brand-800">{book.title}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-slate-500">{book.author?.name ?? '—'}</span>
                    <span className="mt-1 block text-[11.5px] font-semibold text-brand-700">{book.availableCopies} {t('copiesAvailable')}</span>
                  </span>
                </Link>
              ))}
              {!loading && !featured.length && <p className="text-sm text-slate-500">{t('noRecentBooks')}</p>}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3.5 text-[12px] text-slate-600">
              <ClipboardCheck size={15} className="text-brand-700" aria-hidden="true" />
              Every loan is checked against stock, duplicate loans and your active-loan limit.
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ new books */}
      <section>
        <SectionHeading
          eyebrow={t('totalCollection')}
          title={t('recentBooks')}
          description={t('discover')}
          action={<TextLink to="/books">{t('viewAll')}</TextLink>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading && [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-72 w-full" />)}
          {!loading && books.map((book) => (
            <Link key={book._id} to={'/books/' + book._id} className="group">
              <article className="surface card-hover h-full overflow-hidden p-0">
                <div className="relative h-44 overflow-hidden">
                  <CoverCard title={book.title} src={book.coverImage} className="h-full w-full" />
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-800 backdrop-blur">{book.category?.name ?? t('category')}</span>
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-brand-950/80 px-2 py-0.5 text-[10.5px] font-bold text-lime-100 backdrop-blur">{book.availableCopies} {t('copiesAvailable')}</span>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 min-h-[2.6rem] text-[14px] font-semibold leading-5 text-slate-900 group-hover:text-brand-800">{book.title}</h3>
                  <p className="mt-1 truncate text-[12px] text-slate-500">{book.author?.name ?? '—'}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="font-display text-base font-semibold text-brand-800">{currency(book.price ?? 0)}</span>
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 group-hover:text-brand-700">{t('details')} <ArrowRight size={12} aria-hidden="true" /></span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- trust */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Access checked on the server', body: 'Roles are verified on every API request, not hidden in the browser.' },
          { icon: Star, title: 'Built around real policy', body: 'Loan length, daily fines and member limits are configurable in library settings.' },
          { icon: Users, title: 'Made for two audiences', body: 'A calm reading portal for members and a working console for the library team.' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="surface flex gap-3.5 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-800 text-lime-accent"><Icon size={17} aria-hidden="true" /></span>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[12.5px] leading-6 text-slate-500">{item.body}</p>
              </div>
            </div>
          )
        })}
      </section>

      {/* -------------------------------------------------------------- closing */}
      <section className="hero-canvas relative isolate overflow-hidden rounded-3xl px-6 py-10 text-white sm:px-10 sm:py-12">
        <span className="hero-glow -right-6 -top-10 h-56 w-56" aria-hidden="true" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-lime-accent/80"><Sparkles size={13} aria-hidden="true" /> {t('brand')}</span>
            <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight sm:text-[32px]">{t('joinLibrary')}</h2>
            <p className="mt-2 max-w-lg text-[13.5px] leading-6 text-emerald-50/70">{t('authText')}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/register" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lime-accent px-5 text-sm font-bold text-brand-950 transition hover:bg-lime-200">{t('signUp')} <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link to="/books" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"><BookOpen size={15} aria-hidden="true" />{t('browseBooks')}</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
