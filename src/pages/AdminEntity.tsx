import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Search, Tags, UsersRound, ChevronLeft, ChevronRight, ArrowDownUp, BookOpen } from 'lucide-react'
import { useLocale } from '../i18n'
import { Alert, Badge, Button, Card, EmptyState, FormActions, Input, Modal, PageTitle, Spinner, Textarea } from '../components'
import { api, date, message } from '../lib/api'

type Entity = { _id: string; name: string; description?: string; biography?: string; status: 'active' | 'inactive'; createdAt: string; updatedAt: string }
type Book = { _id: string; title: string; isbn: string; status: 'active' | 'inactive'; totalCopies: number; availableCopies: number; createdAt: string }
type Pagination = { page: number; pages: number; total: number }
const PAGE_SIZE = 10
export default function AdminEntity({ kind }: { kind: 'categories' | 'authors' }) {
  const { t } = useLocale()
  const isCategory = kind === 'categories'
  const route = '/admin/' + kind
  const title = isCategory ? t('manageCategories') : t('manageAuthors')
  const [items, setItems] = useState<Entity[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [searchText, setSearchText] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Entity | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [page, setPage] = useState(1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [relatedAuthor, setRelatedAuthor] = useState<Entity | null>(null)
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([])
  const [relatedPagination, setRelatedPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 })
  const [relatedBusy, setRelatedBusy] = useState(false)
  const [relatedQuery, setRelatedQuery] = useState('')
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedPage, setRelatedPage] = useState(1)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: 'name', sortDir: sortDirection })
      if (searchText) params.set('q', searchText)
      const data = await api<{ categories?: Entity[]; authors?: Entity[]; pagination: Pagination }>(route + '?' + params)
      setItems((kind === 'categories' ? data.categories : data.authors) ?? [])
      setPagination(data.pagination)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [route, kind, page, searchText, sortDirection])
  useEffect(() => { void load() }, [load])

  const loadRelatedBooks = useCallback(async () => {
    if (!relatedAuthor) return
    setRelatedBusy(true)
    try {
      const params = new URLSearchParams({ page: String(relatedPage), limit: String(PAGE_SIZE) })
      if (relatedSearch) params.set('q', relatedSearch)
      const data = await api<{ books: Book[]; pagination: Pagination }>('/admin/authors/' + relatedAuthor._id + '/books?' + params)
      setRelatedBooks(data.books)
      setRelatedPagination(data.pagination)
    } catch (err) { setError(message(err)) } finally { setRelatedBusy(false) }
  }, [relatedAuthor, relatedPage, relatedSearch])
  useEffect(() => { void loadRelatedBooks() }, [loadRelatedBooks])

  const open = (item?: Entity) => { setEditing(item ?? null); setName(item?.name ?? ''); setDescription(item?.description ?? item?.biography ?? ''); setStatus(item?.status ?? 'active'); setError(''); setModal(true) }
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearchText(query.trim()) }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const field = isCategory ? 'description' : 'biography'
      const body = { name, [field]: description, status }
      await api(route + (editing ? '/' + editing._id : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setModal(false); setNotice(t('success')); await load()
    } catch (err) { setError(message(err)) } finally { setSaving(false) }
  }
  const remove = async (item: Entity) => {
    if (!window.confirm(t('confirmDelete') + ' ' + item.name)) return
    try { await api(route + '/' + item._id, { method: 'DELETE' }); setNotice(t('success')); await load() }
    catch (err) { setError(message(err)) }
  }
  const openRelatedBooks = (item: Entity) => {
    setRelatedAuthor(item); setRelatedBooks([]); setRelatedPage(1); setRelatedQuery(''); setRelatedSearch('')
  }
  const Icon = isCategory ? Tags : UsersRound
  return <>
    <PageTitle title={title} description={isCategory ? t('categoriesListed') : t('authorsListed')} action={<Button onClick={() => open()}><Plus size={17} />{t('add')} {isCategory ? t('category') : t('author')}</Button>} />
    {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
    {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}
    <Card className="p-0">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} /></span><div><h2 className="font-semibold text-slate-900">{isCategory ? t('categories') : t('authors')}</h2><p className="text-xs text-slate-500">{pagination.total} {t('recordsPerPage')}</p></div></div>
        <form onSubmit={submitSearch} className="flex gap-2"><label className="relative sm:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600" /></label><Button type="submit" variant="secondary">{t('search')}</Button></form>
      </div>
      {busy ? <Spinner label={t('loading')} /> : items.length ? <>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3"><button className="inline-flex items-center gap-2" onClick={() => { setSortDirection((value) => value === 'asc' ? 'desc' : 'asc'); setPage(1) }}>{isCategory ? t('category') : t('author')}<ArrowDownUp size={13} /></button></th><th className="px-5 py-3">{t('status')}</th><th className="px-5 py-3">{t('createdAt')}</th><th className="px-5 py-3">{t('updatedAt')}</th><th className="px-5 py-3">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item, index) => <tr key={item._id} className="hover:bg-slate-50/70"><td className="px-5 py-4 text-slate-400">{(page - 1) * PAGE_SIZE + index + 1}</td><td className="px-5 py-4"><div className="font-semibold text-slate-800">{item.name}</div><div className="mt-1 max-w-sm truncate text-xs text-slate-500">{item.description ?? item.biography}</div></td><td className="px-5 py-4"><Badge tone={item.status === 'active' ? 'green' : 'slate'}>{item.status === 'active' ? t('active') : t('inactive')}</Badge></td><td className="px-5 py-4 text-slate-500">{date(item.createdAt)}</td><td className="px-5 py-4 text-slate-500">{date(item.updatedAt)}</td><td className="px-5 py-4"><div className="flex gap-2">{!isCategory && <Button variant="secondary" className="px-3 py-2" onClick={() => openRelatedBooks(item)}><BookOpen size={14} />{t('viewBooks')}</Button>}<Button variant="secondary" className="px-3 py-2" onClick={() => open(item)}><Pencil size={14} />{t('edit')}</Button><Button variant="danger" className="px-3 py-2" onClick={() => void remove(item)}><Trash2 size={14} />{t('delete')}</Button></div></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between px-5 py-4"><span className="text-sm text-slate-500">{t('showing')} {items.length} / {pagination.total}</span><div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} />{t('previous')}</Button><span className="text-sm">{t('page')} {page} / {pagination.pages}</span><Button variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('next')}<ChevronRight size={15} /></Button></div></div>
      </> : <div className="p-5"><EmptyState title={t('noRecords')} description={t('noBooksHint')} /></div>}
    </Card>
    {modal && <Modal title={(editing ? t('edit') : t('add')) + ' ' + (isCategory ? t('category') : t('author'))} onClose={() => setModal(false)}><form className="space-y-4" onSubmit={save}>{error && <Alert message={error} />}<Input label={t('name')} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /><Textarea label={isCategory ? t('description') : t('biography')} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /><label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">{t('status')}</span><select className="w-full rounded-xl border border-slate-200 p-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></select></label><FormActions submitText={editing ? t('save') : t('create')} loading={saving} onCancel={() => setModal(false)} /></form></Modal>}
    {relatedAuthor && <Modal wide title={t('associatedBooks') + ': ' + relatedAuthor.name} onClose={() => setRelatedAuthor(null)}><form className="mb-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setRelatedPage(1); setRelatedSearch(relatedQuery.trim()) }}><Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} /><Button type="submit" variant="secondary"><Search size={15} />{t('search')}</Button></form>{relatedBusy ? <Spinner label={t('loading')} /> : relatedBooks.length ? <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">{t('bookTitle')}</th><th className="px-4 py-3">{t('isbn')}</th><th className="px-4 py-3">{t('status')}</th><th className="px-4 py-3">{t('copiesAvailable')}</th></tr></thead><tbody className="divide-y divide-slate-100">{relatedBooks.map((book) => <tr key={book._id}><td className="px-4 py-3 font-semibold">{book.title}</td><td className="px-4 py-3">{book.isbn}</td><td className="px-4 py-3">{book.status === 'active' ? t('active') : t('inactive')}</td><td className="px-4 py-3">{book.availableCopies} / {book.totalCopies}</td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between"><span className="text-sm text-slate-500">{t('showing')} {relatedBooks.length} / {relatedPagination.total}</span><div className="flex items-center gap-2"><Button variant="secondary" disabled={relatedPage <= 1} onClick={() => setRelatedPage((value) => value - 1)}><ChevronLeft size={15} />{t('previous')}</Button><span className="text-sm">{t('page')} {relatedPage} / {relatedPagination.pages}</span><Button variant="secondary" disabled={relatedPage >= relatedPagination.pages} onClick={() => setRelatedPage((value) => value + 1)}>{t('next')}<ChevronRight size={15} /></Button></div></div></> : <EmptyState title={t('noAssociatedBooks')} />}</Modal>}
  </>
}
