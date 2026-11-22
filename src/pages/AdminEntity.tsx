import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDownUp, BookOpen, Plus, Search, Tags, Trash2, UsersRound } from 'lucide-react'
import { useLocale } from '../i18n'
import {
  Alert, Badge, Button, Card, EmptyState, FormActions, IconButton, Input, Modal, PageTitle, Pagination,
  Select, SkeletonRows, Textarea, Toolbar,
} from '../ui/primitives'
import { api, date, message } from '../lib/api'

type Entity = { _id: string; name: string; description?: string; biography?: string; status: 'active' | 'inactive'; createdAt: string; updatedAt: string }
type Book = { _id: string; title: string; isbn: string; status: 'active' | 'inactive'; totalCopies: number; availableCopies: number; createdAt: string }
type PaginationData = { page: number; pages: number; total: number }
const PAGE_SIZE = 10

export default function AdminEntity({ kind }: { kind: 'categories' | 'authors' }) {
  const { t } = useLocale()
  const isCategory = kind === 'categories'
  const route = '/admin/' + kind

  const [items, setItems] = useState<Entity[]>([])
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pages: 1, total: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Entity | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [confirming, setConfirming] = useState<Entity | null>(null)

  const [relatedAuthor, setRelatedAuthor] = useState<Entity | null>(null)
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([])
  const [relatedPagination, setRelatedPagination] = useState<PaginationData>({ page: 1, pages: 1, total: 0 })
  const [relatedBusy, setRelatedBusy] = useState(false)
  const [relatedQuery, setRelatedQuery] = useState('')
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedPage, setRelatedPage] = useState(1)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: 'name', sortDir: sortDirection })
      if (searchText) params.set('q', searchText)
      const data = await api<{ categories?: Entity[]; authors?: Entity[]; pagination: PaginationData }>(route + '?' + params.toString())
      setItems((isCategory ? data.categories : data.authors) ?? [])
      setPagination(data.pagination)
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [route, isCategory, page, searchText, sortDirection])
  useEffect(() => { void load() }, [load])

  const loadRelatedBooks = useCallback(async () => {
    if (!relatedAuthor) return
    setRelatedBusy(true)
    try {
      const params = new URLSearchParams({ page: String(relatedPage), limit: String(PAGE_SIZE) })
      if (relatedSearch) params.set('q', relatedSearch)
      const data = await api<{ books: Book[]; pagination: PaginationData }>('/admin/authors/' + relatedAuthor._id + '/books?' + params.toString())
      setRelatedBooks(data.books); setRelatedPagination(data.pagination)
    } catch (err) { setError(message(err)) } finally { setRelatedBusy(false) }
  }, [relatedAuthor, relatedPage, relatedSearch])
  useEffect(() => { void loadRelatedBooks() }, [loadRelatedBooks])

  const open = (item?: Entity) => {
    setEditing(item ?? null)
    setName(item?.name ?? '')
    setDescription(item?.description ?? item?.biography ?? '')
    setStatus(item?.status ?? 'active')
    setError('')
    setModal(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const field = isCategory ? 'description' : 'biography'
      const body = { name, [field]: description, status }
      await api(route + (editing ? '/' + editing._id : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setModal(false); setNotice(t('success')); await load()
    } catch (err) { setError(message(err)) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirming) return
    try {
      await api(route + '/' + confirming._id, { method: 'DELETE' })
      setNotice(t('success')); setConfirming(null); await load()
    } catch (err) { setError(message(err)); setConfirming(null) }
  }

  const openRelatedBooks = (item: Entity) => {
    setRelatedAuthor(item); setRelatedBooks([]); setRelatedPage(1); setRelatedQuery(''); setRelatedSearch('')
  }

  const Icon = isCategory ? Tags : UsersRound
  const noun = isCategory ? t('category').toLowerCase() : t('author').toLowerCase()

  return (
    <>
      <PageTitle
        eyebrow={t('libraryGroup')}
        title={isCategory ? t('manageCategories') : t('manageAuthors')}
        description={isCategory ? 'Subjects used for browsing and filtering the catalogue.' : 'Author records, biographies and the books linked to each name.'}
        action={<Button onClick={() => open()}><Plus size={16} />{t('add')} {noun}</Button>}
      />

      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {notice && <div className="mb-4"><Alert tone="success" message={notice} onClose={() => setNotice('')} /></div>}

      <Card className="overflow-hidden p-0">
        <Toolbar className="justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">{isCategory ? t('categories') : t('authors')}</h2>
              <p className="text-[11.5px] text-slate-500">{pagination.total} {t('recordsPerPage')}</p>
            </div>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearchText(query.trim()) }} className="flex w-full gap-2 sm:w-auto">
            <Input aria-label={t('search')} placeholder={isCategory ? 'Search categories' : 'Search authors'} value={query} onChange={(event) => setQuery(event.target.value)} icon={<Search size={15} />} className="sm:w-64" />
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
        </Toolbar>

        {busy ? <SkeletonRows rows={5} /> : items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>
                      <button className="inline-flex items-center gap-1.5 hover:text-slate-900" onClick={() => { setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); setPage(1) }}>
                        {isCategory ? t('category') : t('author')}<ArrowDownUp size={12} />
                      </button>
                    </th>
                    <th>{t('status')}</th><th>{t('createdAt')}</th><th>{t('updatedAt')}</th><th className="text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item._id}>
                      <td className="text-slate-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                      <td>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-0.5 max-w-sm truncate text-[11.5px] text-slate-500">{item.description || item.biography || '—'}</div>
                      </td>
                      <td><Badge tone={item.status === 'active' ? 'green' : 'slate'} dot>{item.status === 'active' ? t('active') : t('inactive')}</Badge></td>
                      <td className="whitespace-nowrap text-[12px] text-slate-500">{date(item.createdAt)}</td>
                      <td className="whitespace-nowrap text-[12px] text-slate-500">{date(item.updatedAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {!isCategory && <Button size="sm" variant="secondary" onClick={() => openRelatedBooks(item)}><BookOpen size={13} />{t('viewBooks')}</Button>}
                          <Button size="sm" variant="secondary" onClick={() => open(item)}>{t('edit')}</Button>
                          <IconButton label={t('delete')} icon={Trash2} variant="secondary" className="text-rose-600 hover:border-rose-200 hover:bg-rose-50" onClick={() => setConfirming(item)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pagination.pages} total={pagination.total} shown={items.length} onChange={setPage} busy={busy} />
          </>
        ) : (
          <EmptyState icon={Icon} title={t('noRecords')} description={`No ${noun} records yet.`} action={<Button onClick={() => open()}><Plus size={15} />{t('add')} {noun}</Button>} />
        )}
      </Card>

      {modal && (
        <Modal title={(editing ? t('edit') : t('add')) + ' ' + noun} description={isCategory ? 'Category names must be unique.' : 'Author names must be unique.'} onClose={() => setModal(false)}>
          <form className="space-y-4" onSubmit={save}>
            {error && <Alert message={error} />}
            <Input label={t('name')} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={isCategory ? 80 : 120} required />
            <Textarea label={isCategory ? t('description') : t('biography')} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={isCategory ? 400 : 2000} />
            <Select label={t('status')} value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </Select>
            <FormActions submitText={editing ? t('save') : t('create')} loading={saving} onCancel={() => setModal(false)} />
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal title={t('delete') + ' · ' + confirming.name} onClose={() => setConfirming(null)}
          footer={<><Button variant="secondary" onClick={() => setConfirming(null)}>{t('cancel')}</Button><Button variant="danger" onClick={() => void remove()}>{t('delete')}</Button></>}>
          <p className="text-sm leading-6 text-slate-600">Records linked to books cannot be deleted. Reassign those books first, or set the record to inactive.</p>
        </Modal>
      )}

      {relatedAuthor && (
        <Modal wide title={t('associatedBooks') + ' · ' + relatedAuthor.name} onClose={() => setRelatedAuthor(null)}>
          <form className="mb-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setRelatedPage(1); setRelatedSearch(relatedQuery.trim()) }}>
            <Input aria-label={t('searchBooks')} placeholder={t('searchBooks')} value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} icon={<Search size={15} />} />
            <Button type="submit" variant="secondary">{t('search')}</Button>
          </form>
          {relatedBusy ? <SkeletonRows rows={4} /> : relatedBooks.length ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="data-table">
                  <thead><tr><th>{t('bookTitle')}</th><th>{t('isbn')}</th><th>{t('status')}</th><th className="text-right">{t('copiesAvailable')}</th></tr></thead>
                  <tbody>
                    {relatedBooks.map((book) => (
                      <tr key={book._id}>
                        <td className="font-semibold text-slate-800">{book.title}</td>
                        <td className="font-mono text-[11.5px] text-slate-500">{book.isbn}</td>
                        <td><Badge tone={book.status === 'active' ? 'green' : 'slate'}>{book.status === 'active' ? t('active') : t('inactive')}</Badge></td>
                        <td className="text-right">{book.availableCopies} / {book.totalCopies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
                <span>{t('showing')} {relatedBooks.length} / {relatedPagination.total}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={relatedPage <= 1} onClick={() => setRelatedPage(relatedPage - 1)}>{t('previous')}</Button>
                  <Button size="sm" variant="secondary" disabled={relatedPage >= relatedPagination.pages} onClick={() => setRelatedPage(relatedPage + 1)}>{t('next')}</Button>
                </div>
              </div>
            </>
          ) : <EmptyState icon={BookOpen} title={t('noAssociatedBooks')} />}
        </Modal>
      )}
    </>
  )
}
