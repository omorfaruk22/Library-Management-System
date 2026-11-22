import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, BookOpen, Bookmark, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CoverCard, EmptyState, Input, Pagination, Select, Skeleton } from '../ui/primitives'
import { api, currency, message } from '../lib/api'
import { useLocale } from '../i18n'
import { useAuth } from '../auth'

type Item = { _id: string; name: string }
type Book = {
  _id: string; title: string; isbn: string; description?: string; coverImage?: string; price?: number
  availableCopies: number; totalCopies: number; publisher?: string; publicationYear?: number
  author?: { name: string }; category?: { name: string }
}
type PaginationData = { page: number; pages: number; total: number }

const PAGE_SIZE = 12

function availabilityTone(book: Book) {
  if (book.availableCopies <= 0) return { tone: 'red' as const, label: 'Out of stock' }
  if (book.availableCopies <= 2) return { tone: 'amber' as const, label: 'Few left' }
  return { tone: 'green' as const, label: 'On the shelf' }
}

export default function Catalog() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const initialQuery = useRef(params.get('q') ?? '')

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Item[]>([])
  const [q, setQ] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState(params.get('category') ?? '')
  const [author, setAuthor] = useState(params.get('author') ?? '')
  const [available, setAvailable] = useState(params.get('available') === 'true')
  const [sort, setSort] = useState(params.get('sort') ?? 'title')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pages: 1, total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const search = useCallback(async (event?: FormEvent, targetPage = 1, overrides?: { category?: string; author?: string; available?: boolean; sort?: string; q?: string }) => {
    event?.preventDefault()
    setBusy(true)
    setError('')
    const next = new URLSearchParams()
    const nextQ = (overrides?.q ?? q).trim()
    const nextCategory = overrides?.category ?? category
    const nextAuthor = overrides?.author ?? author
    const nextAvailable = overrides?.available ?? available
    const nextSort = overrides?.sort ?? sort
    if (nextQ) next.set('q', nextQ)
    if (nextCategory) next.set('category', nextCategory)
    if (nextAuthor) next.set('author', nextAuthor)
    if (nextAvailable) next.set('available', 'true')
    if (nextSort && nextSort !== 'title') next.set('sort', nextSort)
    if (targetPage > 1) next.set('page', String(targetPage))
    next.set('limit', String(PAGE_SIZE))
    setParams(next, { replace: true })
    try {
      const result = await api<{ books: Book[]; pagination: PaginationData }>('/books?' + next.toString())
      setBooks(result.books)
      setPagination(result.pagination)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [q, category, author, available, sort, setParams])

  const borrowMutation = useMutation({
    mutationFn: (bookId: string) => api('/me/loans', { method: 'POST', body: JSON.stringify({ bookId }) }),
    onSuccess: async () => {
      setNotice(t('borrowSuccess'))
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['my-loans'] })])
      await search(undefined, pagination.page)
    },
  })

  useEffect(() => {
    let alive = true
    const initial = new URLSearchParams({ page: '1', limit: String(PAGE_SIZE) })
    if (initialQuery.current.trim()) initial.set('q', initialQuery.current.trim())
    if (params.get('category')) initial.set('category', params.get('category')!)
    if (params.get('author')) initial.set('author', params.get('author')!)
    if (params.get('available')) initial.set('available', params.get('available')!)
    if (params.get('sort')) initial.set('sort', params.get('sort')!)
    Promise.all([
      api<{ categories: Item[] }>('/categories'),
      api<{ authors: Item[] }>('/authors'),
      api<{ books: Book[]; pagination: PaginationData }>('/books?' + initial.toString()),
    ]).then(([c, a, result]) => {
      if (!alive) return
      setCategories(c.categories); setAuthors(a.authors); setBooks(result.books); setPagination(result.pagination)
    }).catch((err) => { if (alive) setError(message(err)) }).finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
    // Only the first render performs the bootstrap fetch; later searches are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetFilters = () => {
    setQ(''); setCategory(''); setAuthor(''); setAvailable(false); setSort('title')
    void search(undefined, 1, { q: '', category: '', author: '', available: false, sort: 'title' })
  }
  const activeFilters = [q.trim() && 'search', category && 'category', author && 'author', available && 'available'].filter(Boolean).length
  const canBorrow = user?.role === 'student'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{t('brand')}</p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight text-slate-900 sm:text-[34px]">{t('catalog')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('discover')} — {pagination.total.toLocaleString()} {t('booksListed').toLowerCase()}, all on the shelf.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {(['grid', 'list'] as const).map((mode) => (
              <button key={mode} onClick={() => setView(mode)} aria-pressed={view === mode} aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                className={'grid h-8 w-8 place-items-center rounded-lg transition ' + (view === mode ? 'bg-brand-700 text-white' : 'text-slate-500 hover:bg-slate-100')}>
                {mode === 'grid' ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>
        </div>
      </header>

      <Card className="p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(220px,1.6fr)_1fr_1fr_auto]" onSubmit={(event) => void search(event)}>
          <Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={q} onChange={(event) => setQ(event.target.value)} icon={<Search size={16} />} />
          <Select aria-label={t('category')} value={category} onChange={(event) => { setCategory(event.target.value); void search(undefined, 1, { category: event.target.value }) }}>
            <option value="">{t('allCategories')}</option>
            {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </Select>
          <Select aria-label={t('author')} value={author} onChange={(event) => { setAuthor(event.target.value); void search(undefined, 1, { author: event.target.value }) }}>
            <option value="">{t('allAuthors')}</option>
            {authors.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select aria-label={t('sortBy')} value={sort} onChange={(event) => { setSort(event.target.value); void search(undefined, 1, { sort: event.target.value }) }} className="min-w-36">
              <option value="title">A → Z</option>
              <option value="title-desc">Z → A</option>
              <option value="newest">{t('newestFirst')}</option>
            </Select>
            <Button type="submit" className="shrink-0"><SlidersHorizontal size={15} />{t('search')}</Button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button" onClick={() => { const next = !available; setAvailable(next); void search(undefined, 1, { available: next }) }}
            className={'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ' + (available ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}
            aria-pressed={available}
          ><BookOpen size={13} />{t('availableOnly')}</button>
          {activeFilters > 0 && <button type="button" onClick={resetFilters} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"><X size={13} />Clear filters</button>}
          <span className="ml-auto text-[12px] text-slate-500">{pagination.total.toLocaleString()} {t('booksListed').toLowerCase()}</span>
        </div>
      </Card>

      {error && <Alert message={error} onClose={() => setError('')} />}
      {borrowMutation.error && <Alert message={message(borrowMutation.error)} />}
      {notice && <Alert tone="success" message={notice} onClose={() => setNotice('')} />}

      {busy ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[330px] w-full" />)}
        </div>
      ) : books.length ? (
        <>
          {view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => {
                const state = availabilityTone(book)
                return (
                  <article key={book._id} className="surface card-hover group flex flex-col overflow-hidden p-0">
                    <div className="relative h-48 overflow-hidden">
                      <Link to={'/books/' + book._id} aria-label={book.title}>
                        <CoverCard title={book.title} src={book.coverImage} className="h-48 w-full" />
                      </Link>
                      <span className="absolute left-2.5 top-2.5 max-w-[70%] truncate rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand-800 backdrop-blur">{book.category?.name ?? t('category')}</span>
                      <span className="absolute right-2.5 top-2.5"><Badge tone={state.tone} dot>{book.availableCopies > 0 ? `${book.availableCopies} ${t('available').toLowerCase()}` : t('unavailable')}</Badge></span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <Link to={'/books/' + book._id} className="line-clamp-2 text-[14.5px] font-semibold leading-5 text-slate-900 transition hover:text-brand-800">{book.title}</Link>
                      <p className="mt-1 truncate text-[12px] text-slate-500">{book.author?.name ?? '—'}</p>
                      <p className="mt-2 line-clamp-2 min-h-[2.4rem] text-[12px] leading-[1.5rem] text-slate-500">{book.description || book.isbn}</p>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div>
                          <p className="font-display text-[15px] font-semibold text-brand-800">{currency(book.price ?? 0)}</p>
                          <p className="text-[10.5px] text-slate-400">{book.availableCopies}/{book.totalCopies} {locale === 'bn' ? 'কপি' : 'copies'}</p>
                        </div>
                        {canBorrow ? (
                          <Button size="sm" variant={book.availableCopies ? 'subtle' : 'secondary'} disabled={!book.availableCopies || borrowMutation.isPending}
                            onClick={() => { setNotice(''); borrowMutation.mutate(book._id) }}>
                            {borrowMutation.isPending ? t('saving') : book.availableCopies ? t('borrowBook') : t('unavailable')}
                          </Button>
                        ) : (
                          <Link to={'/books/' + book._id} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700">{t('details')}<ArrowUpRight size={13} /></Link>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <Card className="divide-y divide-slate-100 p-0">
              {books.map((book) => {
                const state = availabilityTone(book)
                return (
                  <div key={book._id} className="flex items-center gap-4 p-4 transition hover:bg-brand-50/30">
                    <CoverCard title={book.title} src={book.coverImage} size="sm" className="h-20 w-14 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Link to={'/books/' + book._id} className="block truncate text-[14px] font-semibold text-slate-900 hover:text-brand-800">{book.title}</Link>
                      <p className="mt-0.5 truncate text-[12px] text-slate-500">{book.author?.name ?? '—'} · {book.category?.name ?? t('category')}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">{book.isbn}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-display text-[15px] font-semibold text-brand-800">{currency(book.price ?? 0)}</p>
                      <p className="text-[11px] text-slate-500">{book.availableCopies} / {book.totalCopies}</p>
                    </div>
                    <Badge tone={state.tone} dot>{state.label}</Badge>
                    {canBorrow && <Button size="sm" variant="secondary" disabled={!book.availableCopies || borrowMutation.isPending} onClick={() => { setNotice(''); borrowMutation.mutate(book._id) }}>{t('borrowBook')}</Button>}
                    <Link to={'/books/' + book._id} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-700" aria-label={t('details')}><ChevronRight size={16} /></Link>
                  </div>
                )
              })}
            </Card>
          )}
          <Card className="p-0">
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} shown={books.length} busy={busy} onChange={(page) => void search(undefined, page)} />
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={Bookmark} title={t('noBooks')} description={t('noBooksHint')}
            action={<Button variant="secondary" onClick={resetFilters}>Clear filters</Button>}
          />
        </Card>
      )}
    </div>
  )
}
