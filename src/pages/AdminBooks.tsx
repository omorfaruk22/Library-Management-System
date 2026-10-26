import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Search, BookOpen, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale } from '../i18n'
import { Alert, Badge, Button, Card, EmptyState, FormActions, Input, Modal, PageTitle, Select, Spinner, Textarea } from '../components'
import { api, message } from '../lib/api'

type Item = { _id: string; name: string }
type Book = { _id: string; title: string; isbn: string; description?: string; category: Item; author: Item; publisher?: string; publicationYear?: number | null; shelfLocation?: string; coverImage?: string; totalCopies: number; availableCopies: number; status: 'active' | 'inactive'; createdAt: string }
type Pagination = { page: number; pages: number; total: number }
const initial = { title: '', isbn: '', description: '', category: '', author: '', publisher: '', publicationYear: '', shelfLocation: '', coverImage: '', totalCopies: 1, status: 'active' as 'active' | 'inactive' }
export default function AdminBooks() {
  const { t } = useLocale()
  const [books, setBooks] = useState<Book[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 })
  const [categories, setCategories] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Book | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initial)
  const load = useCallback(async (targetPage = page, q = search) => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: '10' })
      if (q) params.set('q', q)
      const [b, c, a] = await Promise.all([api<{ books: Book[]; pagination: Pagination }>('/admin/books?' + params), api<{ categories: Item[] }>('/categories'), api<{ authors: Item[] }>('/authors')])
      setBooks(b.books); setPagination(b.pagination); setCategories(c.categories); setAuthors(a.authors)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [page, search])
  useEffect(() => { void load() }, [load])
  const open = (book?: Book) => {
    setEditing(book ?? null)
    setForm(book ? { title: book.title, isbn: book.isbn, description: book.description ?? '', category: book.category?._id ?? '', author: book.author?._id ?? '', publisher: book.publisher ?? '', publicationYear: book.publicationYear == null ? '' : String(book.publicationYear), shelfLocation: book.shelfLocation ?? '', coverImage: book.coverImage ?? '', totalCopies: book.totalCopies, status: book.status } : initial)
    setError(''); setModal(true)
  }
  const update = (key: keyof typeof initial, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }))
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const body = { ...form, totalCopies: Number(form.totalCopies), publicationYear: form.publicationYear ? Number(form.publicationYear) : null }
      await api('/admin/books' + (editing ? '/' + editing._id : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setModal(false); setNotice(t('success')); await load()
    } catch (err) { setError(message(err)) } finally { setSaving(false) }
  }
  const remove = async (book: Book) => { if (!window.confirm(t('confirmDelete') + ' ' + book.title)) return; try { await api('/admin/books/' + book._id, { method: 'DELETE' }); setNotice(t('success')); await load() } catch (err) { setError(message(err)) } }
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(query.trim()) }
  return <>
    <PageTitle title={t('manageBooks')} description={t('booksListed')} action={<Button onClick={() => open()}><Plus size={17} />{t('add')} {t('book')}</Button>} />
    {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}{notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}
    <Card className="p-0"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="font-semibold text-slate-900">{t('books')}</h2><p className="mt-1 text-xs text-slate-500">{pagination.total} {t('recordsPerPage')}</p></div><form onSubmit={submitSearch} className="flex gap-2"><label className="relative sm:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchBooks')} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600" /></label><Button type="submit" variant="secondary">{t('search')}</Button></form></div>
      {busy ? <Spinner label={t('loading')} /> : books.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{t('bookTitle')}</th><th className="px-5 py-3">{t('isbn')}</th><th className="px-5 py-3">{t('author')}</th><th className="px-5 py-3">{t('category')}</th><th className="px-5 py-3">{t('publisher')}</th><th className="px-5 py-3">{t('shelfLocation')}</th><th className="px-5 py-3">{t('availableCopies')}</th><th className="px-5 py-3">{t('status')}</th><th className="px-5 py-3">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">{books.map((book) => <tr key={book._id} className="hover:bg-slate-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-11 w-9 place-items-center overflow-hidden rounded-lg bg-brand-50 text-brand-700">{book.coverImage ? <img src={book.coverImage} alt="" className="h-full w-full object-cover" /> : <BookOpen size={17} />}</div><span className="max-w-xs font-semibold text-slate-800">{book.title}<span className="mt-1 block text-xs font-normal text-slate-500">{book.publicationYear || '—'}</span></span></div></td><td className="px-5 py-4 text-slate-500">{book.isbn}</td><td className="px-5 py-4">{book.author?.name}</td><td className="px-5 py-4">{book.category?.name}</td><td className="px-5 py-4">{book.publisher || '—'}</td><td className="px-5 py-4">{book.shelfLocation || '—'}</td><td className="px-5 py-4 text-slate-600">{book.availableCopies} / {book.totalCopies}</td><td className="px-5 py-4"><Badge tone={book.status === 'active' ? 'green' : 'slate'}>{book.status === 'active' ? t('active') : t('inactive')}</Badge></td><td className="px-5 py-4"><div className="flex gap-2"><Button variant="secondary" className="px-3 py-2" onClick={() => open(book)}><Pencil size={14} /></Button><Button variant="danger" className="px-3 py-2" onClick={() => void remove(book)}><Trash2 size={14} /></Button></div></td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 px-5 py-4"><span className="text-sm text-slate-500">{t('showing')} {books.length} / {pagination.total}</span><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} />{t('previous')}</Button><span className="text-sm">{t('page')} {page} / {pagination.pages}</span><Button variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('next')}<ChevronRight size={16} /></Button></div></div></> : <div className="p-5"><EmptyState title={t('noBooks')} /></div>}
    </Card>
    {modal && <Modal title={(editing ? t('edit') : t('add')) + ' ' + t('book')} onClose={() => setModal(false)} wide><form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>{error && <div className="sm:col-span-2"><Alert message={error} /></div>}<Input label={t('bookTitle')} value={form.title} onChange={(e) => update('title', e.target.value)} required maxLength={180} /><Input label={t('isbn')} value={form.isbn} onChange={(e) => update('isbn', e.target.value)} required maxLength={30} /><Select label={t('category')} value={form.category} onChange={(e) => update('category', e.target.value)} required><option value="">{t('allCategories')}</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select><Select label={t('author')} value={form.author} onChange={(e) => update('author', e.target.value)} required><option value="">{t('allAuthors')}</option>{authors.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select><Input label={t('publisher')} value={form.publisher} onChange={(e) => update('publisher', e.target.value)} maxLength={160} /><Input type="number" label={t('publicationYear')} min={0} max={3000} value={form.publicationYear} onChange={(e) => update('publicationYear', e.target.value)} /><Input label={t('shelfLocation')} value={form.shelfLocation} onChange={(e) => update('shelfLocation', e.target.value)} maxLength={80} /><Input type="number" label={t('totalCopies')} min={0} value={form.totalCopies} onChange={(e) => update('totalCopies', e.target.value)} required /><Input label={t('coverImage')} placeholder="https://..." value={form.coverImage} onChange={(e) => update('coverImage', e.target.value)} /><div className="sm:col-span-2"><Textarea label={t('description')} value={form.description} onChange={(e) => update('description', e.target.value)} /></div><Select label={t('status')} value={form.status} onChange={(e) => update('status', e.target.value as 'active' | 'inactive')}><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></Select><div className="flex items-end gap-2 text-xs text-slate-500"><ImageIcon size={15} />{t('coverImage')}</div><div className="sm:col-span-2"><FormActions submitText={editing ? t('save') : t('create')} loading={saving} onCancel={() => setModal(false)} /></div></form></Modal>}
  </>
}
