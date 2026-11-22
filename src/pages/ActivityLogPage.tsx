import { useState, type FormEvent } from 'react'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, message } from '../lib/api'
import { Alert, Badge, Button, Card, EmptyState, Input, PageTitle, Pagination, SkeletonRows, TableShell } from '../ui/primitives'
import { useLocale, type Locale, type MessageKey } from '../i18n'

type ActivityRecord = {
  _id: string
  actor?: { name?: string; email?: string } | null
  action: string
  entity: string
  entityId?: string
  details?: Record<string, unknown>
  ip?: string
  createdAt: string
}

type ActivityData = {
  logs: ActivityRecord[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const PAGE_SIZE = 20

const actionLabels: Record<string, MessageKey> = {
  create: 'auditCreated',
  update: 'auditUpdated',
  delete: 'auditDeleted',
  issue: 'auditIssued',
  return: 'auditReturned',
  payment: 'auditPayment',
  suspend: 'auditSuspended',
  activate: 'auditActivated',
  register: 'auditRegistered',
  login: 'auditSignedIn',
  reserve: 'auditReserved',
  cancel: 'auditCancelled',
  add: 'auditAdded',
  remove: 'auditRemoved',
  adjust: 'auditAdjusted',
}

const entityLabels: Record<string, MessageKey> = {
  loan: 'issuedBooks',
  book: 'books',
  category: 'categories',
  author: 'authors',
  user: 'members',
  settings: 'settings',
  supplier: 'suppliers',
  sale: 'sales',
  purchase: 'purchases',
  expense: 'expenses',
  inventory: 'inventory',
  wishlist: 'wishlist',
  reservation: 'reservations',
}

export default function ActivityLogPage() {
  const { t, locale } = useLocale()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['admin-activity', page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search) params.set('search', search)
      return api<ActivityData>('/admin/audit-logs?' + params.toString())
    },
  })

  const logs = query.data?.logs ?? []
  const pagination = query.data?.pagination ?? { page, pages: 1, total: 0, limit: PAGE_SIZE }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  return (
    <>
      <PageTitle
        eyebrow={t('circulationGroup')}
        title={t('activityLog')}
        description={t('activityLogDescription')}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}>
            <RefreshCw size={15} aria-hidden="true" />{t('refresh')}
          </Button>
        }
      />

      {query.error && <Alert message={message(query.error)} className="mb-4" />}

      <Card className="overflow-hidden p-0">
        <form onSubmit={submitSearch} className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                label={t('searchActivity')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                icon={<Search size={15} />}
                type="search"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={query.isFetching}><Search size={15} aria-hidden="true" />{t('search')}</Button>
              {search && <Button type="button" variant="secondary" onClick={clearSearch}>{t('clearSearch')}</Button>}
            </div>
            {query.data && <span className="pb-2 text-xs text-slate-500">{pagination.total} {t('activityEntries')}</span>}
          </div>
        </form>

        {query.isPending ? <SkeletonRows rows={7} /> : logs.length ? (
          <TableShell>
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>{t('activityDate')}</th>
                  <th>{t('activityActor')}</th>
                  <th>{t('activityEvent')}</th>
                  <th>{t('activityRecord')}</th>
                  <th>{t('activityDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => {
                  const details = detailSummary(entry.details)
                  return (
                    <tr key={entry._id}>
                      <td className="whitespace-nowrap text-[12px] text-slate-600">{formatTimestamp(entry.createdAt, locale)}</td>
                      <td>
                        <span className="block max-w-[180px] truncate font-semibold text-slate-800">{entry.actor?.name ?? t('systemActor')}</span>
                        {entry.actor?.email && <span className="mt-0.5 block max-w-[180px] truncate text-[11px] text-slate-500">{entry.actor.email}</span>}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={actionTone(entry.action)}>{actionLabel(entry.action, t)}</Badge>
                          <span className="text-[11px] text-slate-500">{entityLabel(entry.entity, t)}</span>
                        </div>
                      </td>
                      <td><code className="block max-w-[160px] truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-[10.5px] text-slate-600" title={entry.entityId}>{entry.entityId || '—'}</code></td>
                      <td>
                        <div className="max-w-[240px]">
                          <p className="truncate text-[11.5px] text-slate-600" title={details}>{details || '—'}</p>
                          {entry.ip && <p className="mt-0.5 text-[10.5px] text-slate-400">{t('ipAddress')}: {entry.ip}</p>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableShell>
        ) : (
          <EmptyState
            icon={search ? Search : ShieldCheck}
            title={search ? t('noActivityMatches') : t('noActivity')}
            description={search ? t('noActivityMatchesHint') : t('noActivityHint')}
            action={search ? <Button variant="secondary" onClick={clearSearch}>{t('clearSearch')}</Button> : undefined}
          />
        )}

        {query.data && <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} shown={logs.length} busy={query.isFetching} onChange={setPage} />}
      </Card>
    </>
  )
}

function actionLabel(action: string, t: (key: MessageKey) => string) {
  const key = actionLabels[action]
  return key ? t(key) : action.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function entityLabel(entity: string, t: (key: MessageKey) => string) {
  const key = entityLabels[entity]
  return key ? t(key) : entity.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function actionTone(action: string): 'green' | 'amber' | 'red' | 'slate' | 'sky' {
  if (['delete', 'suspend', 'cancel'].includes(action)) return 'red'
  if (['create', 'issue', 'return', 'payment', 'activate', 'register', 'add'].includes(action)) return 'green'
  return 'sky'
}

function detailSummary(details?: Record<string, unknown>) {
  if (!details) return ''
  return Object.entries(details)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) && String(value).trim() !== '')
    .slice(0, 3)
    .map(([key, value]) => key.replace(/[A-Z]/g, (letter) => ' ' + letter.toLowerCase()) + ': ' + String(value))
    .join(' · ')
}

function formatTimestamp(value: string, locale: Locale) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  }).format(timestamp)
}