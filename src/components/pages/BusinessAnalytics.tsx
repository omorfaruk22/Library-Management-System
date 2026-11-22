import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, CircleDollarSign, Receipt, TrendingDown } from 'lucide-react'
import { api, currency, date, message } from '../../lib/api'
import { Alert, Badge, Card, EmptyState, Input, PageTitle, Skeleton, StatCard } from '../../ui/primitives'
import { useLocale } from '../../i18n'

type Data = {
  monthly: Array<{ month: string; revenue: number; expenses: number; orders: number }>
  topBooks: Array<{ title: string; borrowCount: number }>
  recentSales: Array<{ invoiceNo: string; customerName: string; total: number; paymentStatus: string; createdAt: string }>
  recentActivity: Array<{ action: string; entity: string; details: Record<string, string>; createdAt: string }>
}

export default function BusinessAnalytics() {
  const { t, locale } = useLocale()
  const bn = locale === 'bn'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const queryKey = useMemo(() => ['business-analytics', from, to], [from, to])
  const query = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      return api<Data>('/admin/business/analytics?' + params.toString())
    },
  })

  if (query.isPending) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div><Skeleton className="h-80 w-full" /></div>
  }
  if (query.error) return <Alert message={message(query.error)} />

  const data = query.data
  const revenue = data.monthly.reduce((sum, row) => sum + row.revenue, 0)
  const expenses = data.monthly.reduce((sum, row) => sum + row.expenses, 0)
  const orders = data.monthly.reduce((sum, row) => sum + row.orders, 0)
  const margin = revenue ? Math.round(((revenue - expenses) / revenue) * 100) : 0

  return (
    <>
      <PageTitle eyebrow={t('businessGroup')} title={bn ? 'ব্যবসা বিশ্লেষণ' : 'Business analytics'} description={bn ? 'বিক্রি, খরচ, জনপ্রিয় বই ও সাম্প্রতিক লেনদেন।' : 'Revenue and expense trends, popular loans and the latest counter activity.'} />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input type="date" label={bn ? 'শুরুর তারিখ' : 'From'} value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" label={bn ? 'শেষ তারিখ' : 'To'} value={to} onChange={(event) => setTo(event.target.value)} />
          <div className="flex gap-2 pb-0.5">
            <Badge tone="slate">{from || to ? 'Filtered range' : 'All time'}</Badge>
            {(from || to) && <button onClick={() => { setFrom(''); setTo('') }} className="text-[12px] font-semibold text-brand-700 hover:underline">Reset</button>}
          </div>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label={bn ? 'মোট বিক্রি' : 'Revenue'} value={currency(revenue)} hint={`${orders} orders`} icon={CircleDollarSign} tone="lime" />
        <StatCard label={bn ? 'মোট খরচ' : 'Expenses'} value={currency(expenses)} hint={`${margin}% margin`} icon={TrendingDown} tone="rose" />
        <StatCard label={bn ? 'মোট অর্ডার' : 'Orders'} value={orders} hint={bn ? 'লাভের হিসাব আলাদা' : 'Profit is withheld until cost accounting is reliable'} icon={Receipt} tone="teal" />
      </div>

      <Card>
        <h2 className="mb-4 text-[15px] font-semibold text-slate-900">{bn ? 'মাসিক বিক্রি ও খরচ' : 'Monthly revenue and expenses'}</h2>
        <div className="h-72" role="img" aria-label="Monthly revenue and expenses">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthly} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebe5" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6c7a70' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6c7a70' }} />
              <Tooltip cursor={{ fill: 'rgba(29,117,80,.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e3', fontSize: 12 }} formatter={(value) => currency(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name={bn ? 'বিক্রি' : 'Revenue'} fill="#1d7550" radius={[6, 6, 0, 0]} maxBarSize={34} />
              <Bar dataKey="expenses" name={bn ? 'খরচ' : 'Expenses'} fill="#c9d3c6" radius={[6, 6, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><BookOpen size={15} className="text-brand-700" /><h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সবচেয়ে বেশি ধার নেওয়া' : 'Most borrowed books'}</h2></div>
          {data.topBooks.length ? <ol className="divide-y divide-slate-100">
            {data.topBooks.slice(0, 8).map((row, index) => (
              <li key={row.title} className="flex items-center gap-3 px-5 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{row.title}</span>
                <span className="text-[12px] font-semibold text-brand-700">{row.borrowCount}</span>
              </li>
            ))}
          </ol> : <EmptyState icon={BookOpen} title={t('noRecords')} />}
        </Card>

        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Receipt size={15} className="text-brand-700" /><h2 className="text-[15px] font-semibold text-slate-900">{bn ? 'সাম্প্রতিক বিক্রি' : 'Recent sales'}</h2></div>
          {data.recentSales.length ? <ul className="divide-y divide-slate-100">
            {data.recentSales.map((sale) => (
              <li key={sale.invoiceNo} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-slate-800">{sale.invoiceNo} · {sale.customerName}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">{date(sale.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-semibold text-slate-800">{currency(sale.total)}</p>
                  <Badge tone={sale.paymentStatus === 'paid' ? 'green' : sale.paymentStatus === 'partial' ? 'amber' : 'red'}>{sale.paymentStatus}</Badge>
                </div>
              </li>
            ))}
          </ul> : <EmptyState icon={Receipt} title={t('noRecords')} />}
        </Card>
      </div>
    </>
  )
}
