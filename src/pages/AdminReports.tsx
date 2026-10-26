import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, currency, message } from '../lib/api'
import { Alert, Card, PageTitle, Spinner } from '../components'
import { useLocale } from '../i18n'

type ReportsData = { stats: { activeLoans: number; returnedLoans: number; overdueLoans: number; collectedFines: number; outstandingFines: number }; monthlyActivity: { _id: string; issues: number }[] }
export default function AdminReports() {
  const { t } = useLocale()
  const query = useQuery({ queryKey: ['admin-reports'], queryFn: () => api<ReportsData>('/admin/reports') })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  if (query.isPending) return <Spinner label={t('loading')} />
  if (query.error) return <Alert message={message(query.error)} />
  const report = query.data
  const params = new URLSearchParams()
  if (from) params.set('dateFrom', from)
  if (to) params.set('dateTo', to)
  params.set('sortBy', 'issuedAt')
  params.set('sortDir', 'desc')
  return <>
    <PageTitle title={t('reports')} description={t('recentActivity')} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        [t('activeLoans'), report.stats.activeLoans], [t('returned'), report.stats.returnedLoans],
        [t('overdue'), report.stats.overdueLoans], [t('collectedFines'), currency(report.stats.collectedFines)],
      ].map(([label, value]) => <Card key={String(label)}><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-900">{value}</div></Card>)}
    </div>
    <Card className="mt-6">
      <h2 className="mb-5 text-lg font-bold text-slate-900">{t('recentActivity')}</h2>
      <div className="h-72 w-full" role="img" aria-label={t('recentActivity')}><ResponsiveContainer width="100%" height="100%"><BarChart data={report.monthlyActivity}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="_id" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="issues" name={t('issueBook')} fill="#15803D" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <p className="mt-2 text-sm text-slate-600">{t('outstandingFines')}: <strong>{currency(report.stats.outstandingFines)}</strong></p>
    </Card>
    <Card className="mt-6">
      <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">{t('issuedBooks')}</h2><p className="mt-1 text-sm text-slate-500">{t('csvRangeHint')}</p></div>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); window.location.assign('/api/admin/loans/export.csv?' + params.toString()) }}>
        <label className="block flex-1 space-y-1.5"><span className="text-sm font-medium text-slate-700">{t('dateFrom')}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
        <label className="block flex-1 space-y-1.5"><span className="text-sm font-medium text-slate-700">{t('dateTo')}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
        <button className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white">{t('exportCsv')}</button>
      </form>
    </Card>
  </>
}
