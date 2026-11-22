import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, PackageCheck, Warehouse } from 'lucide-react'
import { Alert, Badge, Button, Card, EmptyState, Input, PageTitle, Select, SkeletonRows, Toolbar } from '../../ui/primitives'
import { api, date, message } from '../../lib/api'
import { useLocale } from '../../i18n'

type Book = { _id: string; title: string; isbn: string; totalCopies: number; availableCopies: number; shelfLocation?: string }
type Movement = {
  _id: string; book: Book; kind: string; quantity: number
  totalBefore: number; totalAfter: number; availableBefore: number; availableAfter: number
  reason: string; createdAt: string; actor?: { name: string }
}

const kinds = [
  { value: 'restock', en: 'Restock', bn: 'স্টক যোগ' },
  { value: 'damaged', en: 'Damaged', bn: 'ক্ষতিগ্রস্ত' },
  { value: 'lost', en: 'Lost', bn: 'হারানো' },
  { value: 'stocktake', en: 'Stocktake', bn: 'স্টক গণনা' },
]

export default function InventoryPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [books, setBooks] = useState<Book[]>([])
  const [rows, setRows] = useState<Movement[]>([])
  const [low, setLow] = useState<Book[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ bookId: '', kind: 'restock', quantity: '1', reason: '' })

  const load = useCallback(async () => {
    try {
      const [bookResult, inventory] = await Promise.all([
        api<{ books: Book[] }>('/admin/books?limit=100'),
        api<{ movements: Movement[]; lowStock: Book[] }>('/admin/inventory'),
      ])
      setBooks(bookResult.books)
      setRows(inventory.movements)
      setLow(inventory.lowStock)
      setForm((previous) => ({ ...previous, bookId: previous.bookId || bookResult.books[0]?._id || '' }))
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(true)
    try {
      await api('/admin/inventory/adjustments', { method: 'POST', body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) })
      setNotice(bn ? 'স্টক সমন্বয় নথিভুক্ত হয়েছে।' : 'Stock adjustment recorded.')
      setForm((previous) => ({ ...previous, quantity: '1', reason: '' }))
      await load()
    } catch (err) { setError(message(err)) } finally { setSaving(false) }
  }

  const selected = books.find((book) => book._id === form.bookId)
  const totalCopies = books.reduce((sum, book) => sum + book.totalCopies, 0)

  return (
    <div className="space-y-5">
      <PageTitle eyebrow={t('libraryGroup')} title={bn ? 'ইনভেন্টরি ও স্টক' : 'Inventory & stock control'} description={bn ? 'স্টক যোগ, ক্ষতিগ্রস্ত/হারানো হিসাব ও audit history।' : 'Adjust stock, review low inventory and keep an auditable movement history.'} />
      {error && <Alert message={error} onClose={() => setError('')} />}
      {notice && <Alert tone="success" message={notice} onClose={() => setNotice('')} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: bn ? 'মোট কপি' : 'Total copies', value: totalCopies, icon: Warehouse },
          { label: bn ? 'কম স্টক' : 'Low-stock titles', value: low.length, icon: ArrowDownRight },
          { label: bn ? 'সমন্বয়' : 'Recorded adjustments', value: rows.length, icon: PackageCheck },
        ].map((item) => {
          const Icon = item.icon
          return <div key={item.label} className="surface flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={17} /></span>
            <div><p className="font-display text-xl font-semibold text-slate-900">{item.value}</p><p className="text-[11.5px] text-slate-500">{item.label}</p></div>
          </div>
        })}
      </div>

      <form onSubmit={submit}>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'স্টক সমন্বয়' : 'Adjust stock'}</h2>
            {selected && <span className="text-[11.5px] text-slate-500">{selected.title} · {selected.availableCopies}/{selected.totalCopies}</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Select label={bn ? 'বই' : 'Book'} value={form.bookId} onChange={(event) => setForm({ ...form, bookId: event.target.value })}>
              {books.map((book) => <option key={book._id} value={book._id}>{book.title} · {book.availableCopies}/{book.totalCopies}</option>)}
            </Select>
            <Select label={bn ? 'ধরন' : 'Adjustment'} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {kinds.map((kind) => <option key={kind.value} value={kind.value}>{bn ? kind.bn : kind.en}</option>)}
            </Select>
            <Input label={form.kind === 'stocktake' ? (bn ? 'গণনায় পাওয়া কপি' : 'Counted copies') : (bn ? 'কপি' : 'Copies')} type="number" min="1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            <div className="flex gap-2">
              <Input label={bn ? 'কারণ' : 'Reason'} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="flex-1" />
              <Button type="submit" className="mt-[26px]" loading={saving}>{bn ? 'সংরক্ষণ' : 'Save'}</Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">{bn ? 'ক্ষতিগ্রস্ত/হারানো শুধু উপলব্ধ কপিতে প্রযোজ্য; ধারে থাকা কপি সুরক্ষিত।' : 'Damaged and lost adjustments only affect available copies; copies out on loan are protected.'}</p>
        </Card>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <Toolbar><h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'কম স্টক' : 'Low stock'}</h2><Badge tone={low.length ? 'amber' : 'green'} dot>{low.length}</Badge></Toolbar>
          {busy ? <SkeletonRows rows={3} /> : low.length ? (
            <ul className="divide-y divide-slate-100">
              {low.map((book) => (
                <li key={book._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-800">{book.title}</p><p className="mt-0.5 truncate font-mono text-[10.5px] text-slate-400">{book.isbn} · {book.shelfLocation || '—'}</p></div>
                  <Badge tone={book.availableCopies === 0 ? 'red' : 'amber'}>{book.availableCopies}/{book.totalCopies}</Badge>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={PackageCheck} title={bn ? 'কম স্টকের বই নেই' : 'Stock levels look healthy'} />}
        </Card>

        <Card className="overflow-hidden p-0">
          <Toolbar><h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সাম্প্রতিক সমন্বয়' : 'Recent movements'}</h2></Toolbar>
          {busy ? <SkeletonRows rows={4} /> : rows.length ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-auto">
              {rows.map((movement) => {
                const positive = movement.availableAfter >= movement.availableBefore
                return (
                  <li key={movement._id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">{movement.book?.title || 'Book'}</p>
                      <Badge tone={movement.kind === 'restock' ? 'green' : movement.kind === 'stocktake' ? 'sky' : 'amber'}>{movement.kind}</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      {positive ? <ArrowUpRight size={11} className="text-emerald-600" /> : <ArrowDownRight size={11} className="text-rose-600" />}
                      {movement.availableBefore} → {movement.availableAfter} available · {date(movement.createdAt)} · {movement.actor?.name || 'Admin'}
                    </p>
                    {movement.reason && <p className="mt-0.5 truncate text-[11px] text-slate-400">{movement.reason}</p>}
                  </li>
                )
              })}
            </ul>
          ) : <EmptyState icon={Warehouse} title={bn ? 'কোনো সমন্বয় নেই' : 'No adjustments yet'} description="Restocks and corrections will be listed here." />}
        </Card>
      </div>
    </div>
  )
}
