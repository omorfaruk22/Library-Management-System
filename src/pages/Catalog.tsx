import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, SlidersHorizontal, BookOpen, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, Select, Spinner } from '../components'
import { api, message } from '../lib/api'
import { useLocale } from '../i18n'
import { useAuth } from '../auth'

type Item = { _id: string; name: string }
type Book = { _id: string; title: string; isbn: string; description?: string; coverImage?: string; availableCopies: number; totalCopies: number; author?: { name: string }; category?: { name: string } }
type Pagination = { page: number; pages: number; total: number }
export default function Catalog() {
  const { t } = useLocale()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const [params, setParams] = useSearchParams()
  const initialQuery = useRef(params.get('q') ?? '')
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Item[]>([])
  const [q, setQ] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('')
  const [author, setAuthor] = useState('')
  const [available, setAvailable] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const search = useCallback(async (event?: FormEvent, targetPage = 1) => {
    event?.preventDefault()
    setBusy(true)
    setError('')
    const next = new URLSearchParams()
    if (q.trim()) next.set('q', q.trim())
    if (category) next.set('category', category)
    if (author) next.set('author', author)
    if (available) next.set('available', 'true')
    next.set('page', String(targetPage))
    next.set('limit', '12')
    setParams(next)
    try {
      const result = await api<{ books: Book[]; pagination: Pagination }>('/books?' + next.toString())
      setBooks(result.books)
      setPagination(result.pagination)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [q, category, author, available, setParams])
  const borrowMutation = useMutation({
    mutationFn: (bookId: string) => api('/me/loans', { method: 'POST', body: JSON.stringify({ bookId }) }),
    onSuccess: async () => {
      setNotice(t('borrowSuccess'))
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['my-loans'] })])
      await search()
    },
  })
  useEffect(() => {
    let alive = true
    const initialParams = new URLSearchParams({ page: '1', limit: '12' })
    if (initialQuery.current.trim()) initialParams.set('q', initialQuery.current.trim())
    Promise.all([
      api<{ categories: Item[] }>('/categories'),
      api<{ authors: Item[] }>('/authors'),
      api<{ books: Book[]; pagination: Pagination }>('/books?' + initialParams.toString()),
    ]).then(([c, a, result]) => {
      if (alive) { setCategories(c.categories); setAuthors(a.authors); setBooks(result.books); setPagination(result.pagination); setBusy(false) }
    }).catch((err) => { if (alive) { setError(message(err)); setBusy(false) } })
    return () => { alive = false }
  }, [])
  return <>
    <section className="relative mb-9 overflow-hidden rounded-3xl bg-brand-800 px-6 py-10 text-white sm:px-10 sm:py-14"><div className="absolute -right-10 -top-20 h-72 w-72 rounded-full border-[42px] border-white/10" /><div className="relative max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><BookOpen size={14} />{t('brand')}</span><h1 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">{t('libraryHero')}</h1><p className="mt-4 max-w-xl text-sm leading-7 text-emerald-100 sm:text-base">{t('heroText')}</p></div></section>
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-bold text-slate-900">{t('catalog')}</h2><p className="mt-1 text-sm text-slate-500">{t('discover')}</p></div></div>
    <Card className="mb-7"><form className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto_auto]" onSubmit={(e) => void search(e)}><label className="relative"><span className="sr-only">{t('searchBooks')}</span><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100" placeholder={t('searchBooks')} /></label><Select aria-label={t('category')} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">{t('allCategories')}</option>{categories.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select><Select aria-label={t('author')} value={author} onChange={(e) => setAuthor(e.target.value)}><option value="">{t('allAuthors')}</option>{authors.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="accent-brand-700" /><span className="whitespace-nowrap">{t('availableOnly')}</span></label><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white"><SlidersHorizontal size={16} />{t('search')}</button></form></Card>
    {error && <div className="mb-4"><Alert message={error} /></div>}{borrowMutation.error && <div className="mb-4"><Alert message={message(borrowMutation.error)} /></div>}{notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}
    {busy ? <Spinner label={t('loading')} /> : books.length ? <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{books.map((book) => <Card key={book._id} className="group overflow-hidden p-0 transition hover:-translate-y-1 hover:shadow-xl"><div className="relative h-52 overflow-hidden bg-gradient-to-br from-brand-50 to-emerald-100">{book.coverImage ? <img src={book.coverImage} alt={book.title + ' cover'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <div className="grid h-full place-items-center text-brand-700/60"><BookOpen size={54} strokeWidth={1.2} /></div>}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-800">{book.category?.name ?? t('category')}</span></div><div className="p-5"><Link to={'/books/' + book._id} className="mb-2 block line-clamp-2 min-h-12 text-lg font-bold text-slate-900 hover:text-brand-700">{book.title}</Link><p className="text-sm text-slate-600">{book.author?.name ?? '—'}</p><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{book.description || book.isbn}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className={'text-xs font-semibold ' + (book.availableCopies ? 'text-brand-700' : 'text-rose-600')}>{book.availableCopies} / {book.totalCopies} {t('copiesAvailable')}</span>{user?.role === 'student' ? <Button variant="secondary" className="px-3 py-2 text-xs" disabled={!book.availableCopies || borrowMutation.isPending} onClick={() => { setNotice(''); borrowMutation.mutate(book._id) }}>{borrowMutation.isPending ? t('saving') : book.availableCopies ? t('borrowBook') : t('unavailable')}</Button> : user?.role === 'admin' ? <Link to="/admin/issued-books" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">{t('issueBook')}<ArrowUpRight size={14} /></Link> : <Link to="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">{t('signIn')}<ArrowUpRight size={14} /></Link>}</div></div></Card>)}</div>
      <div className="mt-7 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm"><span className="text-slate-500">{t('showing')} {books.length} / {pagination.total}</span><div className="flex items-center gap-2"><button disabled={pagination.page <= 1 || busy} onClick={() => void search(undefined, pagination.page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 disabled:opacity-40"><ChevronLeft size={15} />{t('previous')}</button><span className="min-w-16 text-center text-xs text-slate-500">{t('page')} {pagination.page} / {pagination.pages}</span><button disabled={pagination.page >= pagination.pages || busy} onClick={() => void search(undefined, pagination.page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 disabled:opacity-40">{t('next')}<ChevronRight size={15} /></button></div></div>
    </> : <EmptyState title={t('noBooks')} description={t('noBooksHint')} />}
  </>
}
