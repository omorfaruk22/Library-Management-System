import { ArrowLeft, BookOpen, MapPin, CalendarDays, Building2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, currency, message } from '../lib/api'
import { useAuth } from '../auth'
import { Alert, Badge, Button, Card, PageTitle, Spinner } from '../components'
import { useLocale } from '../i18n'

type Book = { _id: string; title: string; isbn: string; description?: string; publisher?: string; publicationYear?: number; shelfLocation?: string; coverImage?: string; price?: number; totalCopies: number; availableCopies: number; author?: { name: string; biography?: string }; category?: { name: string; description?: string } }
export default function BookDetails() {
  const { id = '' } = useParams()
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['book-detail', id], queryFn: () => api<{ book: Book }>('/books/' + encodeURIComponent(id)), enabled: Boolean(id) })
  const reserveMutation = useMutation({ mutationFn: () => api('/me/reservations', { method: 'POST', body: JSON.stringify({ bookId: id }) }), onSuccess: () => setNotice(locale === 'bn' ? 'রিজার্ভেশন তালিকায় যুক্ত হয়েছে' : 'Added to reservation queue') })
  const borrowMutation = useMutation({ mutationFn: () => api('/me/loans', { method: 'POST', body: JSON.stringify({ bookId: id }) }), onSuccess: async () => { setNotice(t('borrowSuccess')); await Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ['dashboard'] }), queryClient.invalidateQueries({ queryKey: ['my-loans'] })]) } })
  if (query.isPending) return <Spinner label={t('loading')} />
  if (query.error) return <><Link to="/books" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} />{t('catalog')}</Link><Alert message={message(query.error)} /></>
  const book = query.data.book
  return <>
    <Link to="/books" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} />{t('catalog')}</Link>
    <PageTitle title={book.title} description={book.author?.name} />
    <div className="grid gap-6 lg:grid-cols-[minmax(250px,.7fr)_1.3fr]">
      <Card className="overflow-hidden p-0"><div className="min-h-80 bg-gradient-to-br from-brand-50 to-emerald-100">{book.coverImage ? <img src={book.coverImage} alt={book.title + ' cover'} className="h-full min-h-80 w-full object-cover" /> : <div className="grid min-h-80 place-items-center text-brand-700"><BookOpen size={72} strokeWidth={1.1} /></div>}</div></Card>
      <Card><div className="flex flex-wrap items-center justify-between gap-3"><Badge>{book.category?.name ?? t('category')}</Badge><Badge tone={book.availableCopies > 0 ? 'green' : 'red'}>{book.availableCopies > 0 ? t('available') : t('unavailable')}</Badge></div>{borrowMutation.error && <div className="mt-4"><Alert message={message(borrowMutation.error)} /></div>}{notice && <div className="mt-4"><Alert tone="success" message={notice} /></div>}<div className="mt-5">{user?.role === 'student' ? <div className="flex flex-wrap gap-2"><Button disabled={!book.availableCopies || borrowMutation.isPending} onClick={() => borrowMutation.mutate()}>{borrowMutation.isPending ? t('saving') : book.availableCopies ? t('borrowBook') : t('unavailable')}</Button>{!book.availableCopies && <Button variant="secondary" disabled={reserveMutation.isPending} onClick={() => reserveMutation.mutate()}>{locale === 'bn' ? 'রিজার্ভ করুন' : 'Join reservation queue'}</Button>}</div>: user?.role === 'admin' ? <Link to="/admin/issued-books" className="inline-flex rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">{t('issueBook')}</Link> : <Link to="/login" className="inline-flex rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">{t('signIn')}</Link>}</div><div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3"><span className="text-xs font-semibold uppercase tracking-wide text-brand-800">{t('price')}</span><span className="text-xl font-bold text-brand-900">{currency(book.price ?? 0)}</span></div><p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">{book.description || t('noDescription')}</p><dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">{t('author')}</dt><dd className="mt-1 font-semibold text-slate-800">{book.author?.name ?? '—'}</dd></div><div><dt className="text-xs text-slate-500">{t('isbn')}</dt><dd className="mt-1 font-semibold text-slate-800">{book.isbn}</dd></div><div><dt className="text-xs text-slate-500">{t('publisher')}</dt><dd className="mt-1 flex items-center gap-2 font-semibold text-slate-800"><Building2 size={15} />{book.publisher || '—'}</dd></div><div><dt className="text-xs text-slate-500">{t('publicationYear')}</dt><dd className="mt-1 flex items-center gap-2 font-semibold text-slate-800"><CalendarDays size={15} />{book.publicationYear || '—'}</dd></div><div><dt className="text-xs text-slate-500">{t('shelfLocation')}</dt><dd className="mt-1 flex items-center gap-2 font-semibold text-slate-800"><MapPin size={15} />{book.shelfLocation || '—'}</dd></div><div><dt className="text-xs text-slate-500">{t('copiesAvailable')}</dt><dd className="mt-1 font-semibold text-slate-800">{book.availableCopies} / {book.totalCopies}</dd></div></dl></Card>
    </div>
  </>
}



