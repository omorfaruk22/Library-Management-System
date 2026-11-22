import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BookOpen, Plus, Search, SquarePen, Trash2 } from 'lucide-react'
import { useLocale } from '../i18n'
import {
  Alert, Badge, Button, Card, CoverCard, EmptyState, FormActions, IconButton, Input, Modal, PageTitle,
  Pagination, Select, SkeletonRows, Textarea, Toolbar,
} from '../ui/primitives'
import { api, currency, message } from '../lib/api'

type Item = { _id: string; name: string }
type Book = {
  _id: string; title: string; isbn: string; description?: string; category?: { _id: string; name: string }
  author?: { _id: string; name: string }; publisher?: string; publicationYear?: number | null; shelfLocation?: string
  coverImage?: string; price: number; totalCopies: number; availableCopies: number; status: 'active' | 'inactive'
  createdAt: string
}
type PaginationData = { page: number; pages: number; total: number }

const PAGE_SIZE = 10
const emptyForm = {
  title: '', isbn: '', description: '', category: '', author: '', publisher: '', publicationYear: '',
  shelfLocation: '', coverImage: '', price: 0, totalCopies: 1, status: 'active' as 'active' | 'inactive',
}

export default function AdminBooks() {
  const { t } = useLocale()
  const [books, setBooks] = useState<Book[]>([])
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pages: 1, total: 0 })
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
  const [form, setForm] = useState(emptyForm)
  const [confirming, setConfirming] = useState<Book | null>(null)

  const load = useCallback(async (targetPage = page, q = search) => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) })
      if (q) params.set('q', q)
      const [b, c, a] = await Promise.all([
        api<{ books: Book[]; pagination: PaginationData }>('/admin/books?' + params.toString()),
        api<{ categories: Item[] }>('/categories'),
        api<{ authors: Item[] }>('/authors'),
      ])
      setBooks(b.books); setPagination(b.pagination); setCategories(c.categories); setAuthors(a.authors)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [page, search])

  useEffect(() => { void load() }, [load])

  const open = (book?: Book) => {
    setEditing(book ?? null)
    setForm(book ? {
      title: book.title, isbn: book.isbn, description: book.description ?? '', category: book.category?._id ?? '',
      author: book.author?._id ?? '', publisher: book.publisher ?? '',
      publicationYear: book.publicationYear == null ? '' : String(book.publicationYear),
      shelfLocation: book.shelfLocation ?? '', coverImage: book.coverImage ?? '', price: book.price ?? 0,
      totalCopies: book.totalCopies, status: book.status,
    } : emptyForm)
    setError('')
    setModal(true)
  }
  const update = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const body = {
        ...form,
        totalCopies: Number(form.totalCopies),
        price: Number(form.price),
        publicationYear: form.publicationYear ? Number(form.publicationYear) : null,
      }
      await api('/admin/books' + (editing ? '/' + editing._id : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setModal(false); setNotice(editing ? 'Book updated.' : 'Book added to the catalogue.')
      await load(editing ? page : 1)
      if (!editing) setPage(1)
    } catch (err) { setError(message(err)) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirming) return
    try {
      await api('/admin/books/' + confirming._id, { method: 'DELETE' })
      setNotice('Book removed from the catalogue.')
      setConfirming(null)
      await load()
    } catch (err) { setError(message(err)); setConfirming(null) }
  }

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(query.trim()) }

  return (
    <>
      <PageTitle
        eyebrow={t('libraryGroup')}
        title={t('manageBooks')}
        description={`${pagination.total.toLocaleString()} ${t('booksListed').toLowerCase()} — titles, pricing, shelf locations and live availability.`}
        action={<Button onClick={() => open()}><Plus size={16} />{t('add')} {t('book').toLowerCase()}</Button>}
      />

      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <Card className="overflow-hidden p-0">
        <Toolbar className="justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{t('books')}</h2>
            <p className="text-[11.5px] text-slate-500">{pagination.total} {t('recordsPerPage')} · {PAGE_SIZE} per page</p>
          </div>
          <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
            <Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={query} onChange={(event) => setQuery(event.target.value)} icon={<Search size={15} />} className="sm:w-72" />
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
        </Toolbar>

        {busy ? <SkeletonRows rows={6} /> : books.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>{t('bookTitle')}</th><th>{t('category')}</th><th>{t('author')}</th>
                    <th className="text-right">{t('price')}</th><th className="text-center">{t('availableCopies')}</th>
                    <th>{t('shelfLocation')}</th><th>{t('status')}</th><th className="text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <CoverCard title={book.title} src={book.coverImage} size="sm" className="h-12 w-9 shrink-0 rounded-md" />
                          <div className="min-w-0">
                            <span className="block max-w-[260px] truncate font-semibold text-slate-900">{book.title}</span>
                            <span className="mt-0.5 block font-mono text-[10.5px] text-slate-400">{book.isbn}{book.publicationYear ? ' · ' + book.publicationYear : ''}</span>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="slate">{book.category?.name ?? '—'}</Badge></td>
                      <td className="max-w-[160px] truncate text-slate-600">{book.author?.name ?? '—'}</td>
                      <td className="text-right font-semibold text-brand-800">{currency(book.price ?? 0)}</td>
                      <td className="text-center">
                        <span className={'font-semibold ' + (book.availableCopies === 0 ? 'text-rose-600' : book.availableCopies <= 2 ? 'text-amber-600' : 'text-slate-800')}>{book.availableCopies}</span>
                        <span className="text-slate-400"> / {book.totalCopies}</span>
                      </td>
                      <td className="text-[12px] text-slate-500">{book.shelfLocation || '—'}</td>
                      <td><Badge tone={book.status === 'active' ? 'green' : 'slate'} dot>{book.status === 'active' ? t('active') : t('inactive')}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <IconButton label={t('edit')} icon={SquarePen} variant="secondary" onClick={() => open(book)} />
                          <IconButton label={t('delete')} icon={Trash2} variant="secondary" className="text-rose-600 hover:border-rose-200 hover:bg-rose-50" onClick={() => setConfirming(book)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pagination.pages} total={pagination.total} shown={books.length} onChange={setPage} busy={busy} />
          </>
        ) : <EmptyState icon={BookOpen} title={t('noBooks')} description={search ? `No titles match “${search}”.` : 'Add the first title to open the catalogue.'} action={<Button onClick={() => open()}><Plus size={15} />{t('add')} {t('book').toLowerCase()}</Button>} />}
      </Card>

      {modal && (
        <Modal wide title={editing ? t('edit') + ' · ' + editing.title : t('add') + ' ' + t('book').toLowerCase()}
          description="ISBN must be unique. Copies cannot drop below the number currently on loan."
          onClose={() => setModal(false)}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
            {error && <div className="sm:col-span-2"><Alert message={error} /></div>}
            <Input label={t('bookTitle')} value={form.title} onChange={(event) => update('title', event.target.value)} required maxLength={180} />
            <Input label={t('isbn')} value={form.isbn} onChange={(event) => update('isbn', event.target.value)} required maxLength={30} placeholder="978-…" />
            <Select label={t('category')} value={form.category} onChange={(event) => update('category', event.target.value)} required>
              <option value="">{t('allCategories')}</option>
              {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
            <Select label={t('author')} value={form.author} onChange={(event) => update('author', event.target.value)} required>
              <option value="">{t('allAuthors')}</option>
              {authors.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
            <Input label={t('publisher')} value={form.publisher} onChange={(event) => update('publisher', event.target.value)} maxLength={160} />
            <Input type="number" label={t('publicationYear')} min={0} max={3000} value={form.publicationYear} onChange={(event) => update('publicationYear', event.target.value)} />
            <Input type="number" label={t('price')} min={0} max={10000000} value={form.price} onChange={(event) => update('price', Number(event.target.value))} required />
            <Input type="number" label={t('totalCopies')} min={0} value={form.totalCopies} onChange={(event) => update('totalCopies', Number(event.target.value))} required hint={editing ? `${editing.availableCopies} available right now` : undefined} />
            <Input label={t('shelfLocation')} value={form.shelfLocation} onChange={(event) => update('shelfLocation', event.target.value)} maxLength={80} placeholder="A-3 / Reading room" />
            <Input label={t('coverImage')} placeholder="https://…" value={form.coverImage} onChange={(event) => update('coverImage', event.target.value)} />
            <Select label={t('status')} value={form.status} onChange={(event) => update('status', event.target.value as 'active' | 'inactive')}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </Select>
            <div className="sm:col-span-2"><Textarea label={t('description')} value={form.description} onChange={(event) => update('description', event.target.value)} maxLength={3000} /></div>
            <div className="sm:col-span-2"><FormActions submitText={editing ? t('save') : t('create')} loading={saving} onCancel={() => setModal(false)} /></div>
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal title={t('delete') + ' · ' + confirming.title} onClose={() => setConfirming(null)}
          footer={<><Button variant="secondary" onClick={() => setConfirming(null)}>{t('cancel')}</Button><Button variant="danger" onClick={() => void remove()}>{t('delete')}</Button></>}>
          <p className="text-sm leading-6 text-slate-600">This removes the title from the catalogue. Books with loan history cannot be deleted — use the <strong>inactive</strong> status instead.</p>
        </Modal>
      )}
    </>
  )
}
