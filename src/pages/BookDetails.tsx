import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Building2, CalendarClock, CalendarDays, CheckCircle2, Clock3, Heart, MapPin,
  Share2, Tag, UserRound, Wallet,
} from 'lucide-react'
import { api, currency, date, message } from '../lib/api'
import { useAuth } from '../auth'
import { Alert, Badge, Button, Card, CoverCard, EmptyState, Skeleton } from '../ui/primitives'
import { useLocale } from '../i18n'

type Book = {
  _id: string; title: string; isbn: string; description?: string; publisher?: string; publicationYear?: number
  shelfLocation?: string; coverImage?: string; price?: number; totalCopies: number; availableCopies: number
  author?: { name: string; biography?: string }; category?: { name: string; description?: string }
}
type MyLoan = { _id: string; dueAt: string; status: string; book?: { _id: string } }

export default function BookDetails() {
  const { id = '' } = useParams()
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['book-detail', id], queryFn: () => api<{ book: Book }>('/books/' + encodeURIComponent(id)), enabled: Boolean(id) })
  const myLoans = useQuery({ queryKey: ['my-loans', 'active'], queryFn: () => api<{ loans: MyLoan[] }>('/me/loans?status=issued&limit=100'), enabled: user?.role === 'student' })
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: () => api<{ items: Array<{ book: { _id: string } }> }>('/me/wishlist'), enabled: user?.role === 'student' })
  const isWishlisted = Boolean(wishlist.data?.items?.some((item) => item.book?._id === id))

  const reserveMutation = useMutation({
    mutationFn: () => api('/me/reservations', { method: 'POST', body: JSON.stringify({ bookId: id }) }),
    onSuccess: () => setNotice(locale === 'bn' ? 'রিজার্ভেশন তালিকায় যুক্ত হয়েছে।' : 'Added to the reservation queue.'),
    onError: (error) => setNotice(message(error)),
  })
  const wishlistMutation = useMutation({
    mutationFn: () => isWishlisted
      ? api('/me/wishlist/' + id, { method: 'DELETE' })
      : api('/me/wishlist', { method: 'POST', body: JSON.stringify({ bookId: id }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['wishlist'] }) },
  })
  const borrowMutation = useMutation({
    mutationFn: () => api('/me/loans', { method: 'POST', body: JSON.stringify({ bookId: id }) }),
    onSuccess: async () => {
      setNotice(t('borrowSuccess'))
      await Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['my-loans'] })])
    },
  })

  if (query.isPending) {
    return <div className="grid gap-6 lg:grid-cols-[minmax(240px,.75fr)_1.25fr]">
      <Skeleton className="h-[420px] w-full" />
      <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-24 w-full" /></div>
    </div>
  }
  if (query.error) {
    return <Card>
      <EmptyState icon={BookOpen} title={t('noBooks')} description={message(query.error)} action={<Link to="/books"><Button variant="secondary">{t('catalog')}</Button></Link>} />
    </Card>
  }

  const book = query.data.book
  const onLoanHere = myLoans.data?.loans?.find((loan) => loan.book?._id === id)
  const available = book.availableCopies > 0
  const stockRatio = book.totalCopies ? Math.max(0, Math.min(1, book.availableCopies / book.totalCopies)) : 0

  const meta = [
    { icon: UserRound, label: t('author'), value: book.author?.name ?? '—' },
    { icon: Tag, label: t('category'), value: book.category?.name ?? '—' },
    { icon: Building2, label: t('publisher'), value: book.publisher || '—' },
    { icon: CalendarDays, label: t('publicationYear'), value: book.publicationYear ? String(book.publicationYear) : '—' },
    { icon: MapPin, label: t('shelfLocation'), value: book.shelfLocation || '—' },
    { icon: BookOpen, label: t('isbn'), value: book.isbn },
  ]

  return (
    <div className="space-y-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
        <Link to="/books" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"><ArrowLeft size={14} />{t('catalog')}</Link>
        {book.category?.name && <><span className="text-slate-300">/</span><span>{book.category.name}</span></>}
        <span className="text-slate-300">/</span><span className="truncate">{book.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,.72fr)_1.28fr]">
        <div className="space-y-4">
          <div className="surface overflow-hidden p-0">
            <CoverCard title={book.title} src={book.coverImage} className="aspect-[3/4] w-full" />
          </div>
          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Availability</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-[28px] font-semibold leading-none text-slate-900">{book.availableCopies}</span>
              <span className="text-[13px] text-slate-500">/ {book.totalCopies} copies on the shelf</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${book.availableCopies} of ${book.totalCopies} copies available`}>
              <span className={'block h-full rounded-full ' + (available ? 'bg-brand-600' : 'bg-rose-400')} style={{ width: Math.max(6, stockRatio * 100) + '%' }} />
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">{available ? 'Ready to borrow today.' : 'Every copy is currently on loan.'}</p>
          </Card>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={available ? 'green' : 'red'} dot>{available ? t('available') : t('unavailable')}</Badge>
              {book.category?.name && <Badge tone="slate">{book.category.name}</Badge>}
              {onLoanHere && <Badge tone="amber">You have this on loan</Badge>}
            </div>
            <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight text-slate-900 sm:text-[34px]">{book.title}</h1>
            <p className="mt-1.5 text-[14px] text-slate-500">{t('author')}: <span className="font-semibold text-slate-700">{book.author?.name ?? '—'}</span></p>
          </div>

          {borrowMutation.error && <Alert message={message(borrowMutation.error)} />}
          {notice && <Alert tone="success" message={notice} onClose={() => setNotice('')} />}

          <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('price')}</p>
              <p className="font-display text-[24px] font-semibold leading-none text-brand-800">{currency(book.price ?? 0)}</p>
              <p className="mt-1 text-[11.5px] text-slate-500">{t('loanPeriod')} · {t('overdueRate')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.role === 'student' ? <>
                <Button disabled={!available || borrowMutation.isPending || Boolean(onLoanHere)} onClick={() => { setNotice(''); borrowMutation.mutate() }} loading={borrowMutation.isPending}>
                  {onLoanHere ? 'Already borrowed' : available ? t('borrowBook') : t('unavailable')}
                </Button>
                {!available && <Button variant="secondary" disabled={reserveMutation.isPending} onClick={() => { setNotice(''); reserveMutation.mutate() }}>
                  <Clock3 size={15} />{locale === 'bn' ? 'রিজার্ভ করুন' : 'Join queue'}
                </Button>}
                <Button variant="secondary" aria-pressed={isWishlisted} onClick={() => wishlistMutation.mutate()} loading={wishlistMutation.isPending}>
                  <Heart size={15} className={isWishlisted ? 'fill-rose-500 text-rose-500' : ''} />{isWishlisted ? 'Saved' : 'Save'}
                </Button>
              </> : user?.role === 'admin' ? (
                <Link to="/admin/issued-books"><Button><BookOpen size={15} />{t('issueBook')}</Button></Link>
              ) : (
                <>
                  <Link to="/login"><Button>{t('signIn')} to borrow</Button></Link>
                  <Link to="/register"><Button variant="secondary">{t('signUp')}</Button></Link>
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">{t('description')}</h2>
            <p className="prose-lib mt-2 whitespace-pre-line">{book.description || t('noDescription')}</p>
          </Card>

          <Card className="p-0">
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">Book record</h2>
            <dl className="grid sm:grid-cols-2">
              {meta.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className={'flex items-start gap-3 px-5 py-3.5 ' + (index < meta.length - 2 ? 'border-b border-slate-50' : '')}>
                    <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.label}</dt>
                      <dd className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-800">{item.value}</dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          </Card>

          {book.author?.biography && (
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRound size={17} /></span>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-slate-900">About {book.author.name}</h2>
                  <p className="prose-lib mt-1">{book.author.biography}</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: CalendarClock, title: '14-day loan', body: 'Due date set on issue.' },
              { icon: Wallet, title: '৳4 / day late', body: 'Only overdue days are charged.' },
              { icon: CheckCircle2, title: 'One borrow at a time', body: 'Duplicate loans are blocked.' },
            ].map((item) => {
              const Icon = item.icon
              return <div key={item.title} className="surface flex items-start gap-2.5 p-3.5">
                <Icon size={15} className="mt-0.5 text-brand-700" aria-hidden="true" />
                <div><p className="text-[12.5px] font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11.5px] leading-5 text-slate-500">{item.body}</p></div>
              </div>
            })}
          </div>

          <p className="flex items-center gap-1.5 text-[11.5px] text-slate-400"><Share2 size={12} />Catalogue code {book.isbn} · updated {date(new Date())}</p>
        </div>
      </div>
    </div>
  )
}
