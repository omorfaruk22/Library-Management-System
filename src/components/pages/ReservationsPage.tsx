import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Alert, Badge, Button, Card, CoverCard, EmptyState, PageTitle, Skeleton } from '../../ui/primitives'
import { api, date, message } from '../../lib/api'
import { useLocale } from '../../i18n'

type Item = {
  _id: string; status: string; queuePosition: number; createdAt: string
  book: { _id: string; title: string; isbn: string; coverImage?: string; availableCopies: number }
}

export default function ReservationsPage() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const result = await api<{ items: Item[] }>('/me/reservations'); setItems(result.items) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <>
      <PageTitle eyebrow={t('studentArea')} title={bn ? 'আমার রিজার্ভেশন' : 'My reservations'} description={bn ? 'স্টকে না থাকা বইয়ের অপেক্ষার তালিকা।' : 'Your place in the queue for books that are currently out on loan.'} />
      {error && <div className="mb-4"><Alert message={error} onClose={() => setError('')} /></div>}
      {busy ? <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div>
        : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <CoverCard title={item.book.title} src={item.book.coverImage} size="sm" className="h-16 w-11 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link to={'/books/' + item.book._id} className="block truncate text-[14px] font-semibold text-slate-900 hover:text-brand-800">{item.book.title}</Link>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">{bn ? 'অনুরোধ' : 'Requested'} {date(item.createdAt)} · {item.book.isbn}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={item.status === 'ready' ? 'green' : 'amber'} dot>{item.status === 'ready' ? (bn ? 'প্রস্তুত' : 'Ready to borrow') : item.status}</Badge>
                    {item.status === 'waiting' && <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500"><CalendarClock size={12} />{bn ? 'সারিতে' : 'Queue position'} <strong className="text-slate-700">#{item.queuePosition}</strong></span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={'/books/' + item.book._id}><Button size="sm" variant="secondary">{t('details')}</Button></Link>
                  {item.status === 'waiting' && (
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" loading={cancelling === item._id} onClick={async () => {
                      setCancelling(item._id)
                      try { await api('/me/reservations/' + item._id, { method: 'DELETE' }); await load() }
                      catch (err) { setError(message(err)) } finally { setCancelling(null) }
                    }}>{bn ? 'বাতিল' : 'Leave queue'}</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={CalendarClock} title={bn ? 'কোনো রিজার্ভেশন নেই' : 'No active reservations'}
              description={bn ? 'স্টক শেষ হওয়া বইয়ের পাতায় গিয়ে সারিতে যোগ দিতে পারেন।' : 'When every copy of a book is out, open its page and join the queue.'}
              action={<Link to="/books"><Button>{t('browseBooks')}</Button></Link>} />
          </Card>
        )}
    </>
  )
}
