import { useCallback, useEffect, useState } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, CoverCard, EmptyState, PageTitle, Skeleton } from '../../ui/primitives'
import { api, currency, message } from '../../lib/api'
import { useLocale } from '../../i18n'

type Item = {
  _id: string
  book: { _id: string; title: string; isbn: string; coverImage?: string; price: number; availableCopies: number; author?: { name: string } }
}

export default function WishlistPage() {
  const { t, locale } = useLocale()
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const result = await api<{ items: Item[] }>('/me/wishlist'); setItems(result.items) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const remove = async (bookId: string) => {
    setRemoving(bookId)
    try { await api('/me/wishlist/' + bookId, { method: 'DELETE' }); await load() }
    catch (err) { setError(message(err)) } finally { setRemoving(null) }
  }

  return (
    <>
      <PageTitle eyebrow={t('studentArea')} title={t('wishlist')} description="Books you have saved to read or borrow later." action={<Link to="/books"><Button variant="secondary">{t('browseBooks')}</Button></Link>} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {busy ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item._id} className="card-hover flex gap-4 p-4">
              <CoverCard title={item.book.title} src={item.book.coverImage} size="sm" className="h-28 w-20 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={'/books/' + item.book._id} className="line-clamp-2 text-[13.5px] font-semibold text-slate-900 hover:text-brand-800">{item.book.title}</Link>
                <p className="mt-1 truncate text-[11.5px] text-slate-500">{item.book.author?.name ?? '—'}</p>
                <p className="mt-1 font-display text-[14px] font-semibold text-brand-800">{currency(item.book.price)}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <Badge tone={item.book.availableCopies ? 'green' : 'red'} dot>{item.book.availableCopies ? `${item.book.availableCopies} ${locale === 'bn' ? 'কপি' : 'available'}` : locale === 'bn' ? 'স্টকে নেই' : 'Out of stock'}</Badge>
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={removing === item.book._id} onClick={() => void remove(item.book._id)} aria-label="Remove from wishlist"><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Heart} title={locale === 'bn' ? 'পছন্দের তালিকা খালি' : 'Your wishlist is empty'}
            description={locale === 'bn' ? 'ক্যাটালগ থেকে বই বেছে এখানে যোগ করুন।' : 'Open any book and press Save to keep it here.'}
            action={<Link to="/books"><Button>{t('browseBooks')}</Button></Link>} />
        </Card>
      )}
    </>
  )
}
