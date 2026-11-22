import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet } from 'lucide-react'
import { api, currency, message } from '../lib/api'
import { Alert, Button, Card, PageTitle, Skeleton, StatCard } from '../ui/primitives'
import { useLocale } from '../i18n'

type ReportsData = {
  stats: { activeLoans: number; returnedLoans: number; overdueLoans: number; collectedFines: number; outstandingFines: number }
  monthlyActivity: Array<{ _id: string; issues: number }>
  policy?: { loanPeriodDays: number; finePerDay: number; maxActiveLoans: number }
}

export default function AdminReports() {
  const { t } = useLocale()
  const query = useQuery({ queryKey: ['admin-reports'], queryFn: () => api<ReportsData>('/admin/reports') })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  if (query.isPending) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div><Skeleton className="h-80 w-full" /></div>
  }
  if (query.error) return <Alert message={message(query.error)} />

  const report = query.data
  const params = new URLSearchParams()
  if (from) params.set('dateFrom', from)
  if (to) params.set('dateTo', to)
  params.set('sortBy', 'issuedAt')
  params.set('sortDir', 'desc')
  const exported = (report.stats.returnedLoans + report.stats.activeLoans) || 0

  return (
    <>
      <PageTitle
        eyebrow={t('circulationGroup')}
        title={t('reports')}
        description="Live circulation totals, six-month issue trend and a date-filtered CSV export for your records."
        action={<a href={'/api/admin/loans/export.csv?' + params.toString()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"><Download size={15} />{t('exportCsv')}</a>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('activeLoans')} value={report.stats.activeLoans} hint={t('notReturned')} icon={FileSpreadsheet} tone="lime" />
        <StatCard label={t('returned')} value={report.stats.returnedLoans} hint={t('totalLoans')} icon={FileSpreadsheet} tone="teal" />
        <StatCard label={t('overdue')} value={report.stats.overdueLoans} hint={t('returnFineHint')} icon={FileSpreadsheet} tone={report.stats.overdueLoans ? 'rose' : 'brand'} />
        <StatCard label={t('collectedFines')} value={currency(report.stats.collectedFines)} hint={`${t('outstandingFines')}: ${currency(report.stats.outstandingFines)}`} icon={FileSpreadsheet} tone="amber" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_.85fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">{t('recentActivity')}</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">Books issued per month, last six months.</p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800">{exported} loans</span>
          </div>
          <div className="h-72 w-full" role="img" aria-label="Books issued per month">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthlyActivity} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebe5" />
                <XAxis dataKey="_id" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6c7a70' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6c7a70' }} />
                <Tooltip cursor={{ fill: 'rgba(29,117,80,.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e9e3', fontSize: 12 }} />
                <Bar dataKey="issues" name={t('issued')} fill="#1d7550" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-semibold text-slate-900">{t('exportCsv')}</h2>
          <p className="mt-1 text-[12px] leading-6 text-slate-500">{t('csvRangeHint')}</p>
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); window.location.assign('/api/admin/loans/export.csv?' + params.toString()) }}>
            <label className="block text-[12px] font-semibold text-slate-700">{t('dateFrom')}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] focus:border-brand-500 focus:ring-4 focus:ring-brand-600/10 focus:outline-none" /></label>
            <label className="block text-[12px] font-semibold text-slate-700">{t('dateTo')}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] focus:border-brand-500 focus:ring-4 focus:ring-brand-600/10 focus:outline-none" /></label>
            <Button type="submit" className="w-full"><Download size={15} />{t('exportCsv')}</Button>
          </form>
          <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-[11.5px] text-slate-600">
            <p className="flex justify-between"><span>{t('loanPeriodDays')}</span><strong>{report.policy?.loanPeriodDays ?? 14}</strong></p>
            <p className="flex justify-between"><span>{t('finePerDay')}</span><strong>{currency(report.policy?.finePerDay ?? 4)}</strong></p>
            <p className="flex justify-between"><span>{t('maxActiveLoans')}</span><strong>{report.policy?.maxActiveLoans ?? 5}</strong></p>
          </div>
        </Card>
      </section>
    </>
  )
}
