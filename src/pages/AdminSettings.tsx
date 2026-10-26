import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, message } from '../lib/api'
import { Alert, Button, Card, Input, PageTitle, Spinner } from '../components'
import { useLocale } from '../i18n'

const schema = z.object({
  loanPeriodDays: z.number().int().min(1).max(90),
  finePerDay: z.number().int().min(0).max(10000),
  maxActiveLoans: z.number().int().min(1).max(50),
})
type Values = z.infer<typeof schema>
type Policy = Values & { timezone: 'Asia/Dhaka' }

export default function AdminSettings() {
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<{ settings: Policy }>('/admin/settings') })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { loanPeriodDays: 14, finePerDay: 4, maxActiveLoans: 5 } })
  useEffect(() => { if (query.data) form.reset(query.data.settings) }, [query.data, form])
  const mutation = useMutation({
    mutationFn: (values: Values) => api('/admin/settings', { method: 'PUT', body: JSON.stringify(values) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-settings'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
  if (query.isPending) return <Spinner label={t('loading')} />
  return <>
    <PageTitle title={t('settings')} description={t('returnFineHint')} />
    {query.error && <div className="mb-4"><Alert message={message(query.error)} /></div>}
    {mutation.isSuccess && <div className="mb-4"><Alert tone="success" message={t('policySaved')} /></div>}
    {mutation.error && <div className="mb-4"><Alert message={message(mutation.error)} /></div>}
    <Card className="mx-auto max-w-2xl">
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input type="number" min={1} max={90} label={t('loanPeriodDays')} {...form.register('loanPeriodDays', { valueAsNumber: true })} />
        {form.formState.errors.loanPeriodDays && <p className="text-sm text-rose-700">{t('settingDaysHelp')}</p>}
        <Input type="number" min={0} max={10000} label={t('finePerDay')} {...form.register('finePerDay', { valueAsNumber: true })} />
        {form.formState.errors.finePerDay && <p className="text-sm text-rose-700">{t('settingFineHelp')}</p>}
        <Input type="number" min={1} max={50} label={t('maxActiveLoans')} {...form.register('maxActiveLoans', { valueAsNumber: true })} />
        {form.formState.errors.maxActiveLoans && <p className="text-sm text-rose-700">{t('settingLoansHelp')}</p>}
        <p className="text-sm text-slate-500">{t('timezoneDhaka')}</p>
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('saving') : t('saveSettings')}</Button></div>
      </form>
    </Card>
  </>
}
