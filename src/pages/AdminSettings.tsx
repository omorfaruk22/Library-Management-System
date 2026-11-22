import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CircleAlert, Settings2, Timer, Wallet } from 'lucide-react'
import { api, message } from '../lib/api'
import { Alert, Badge, Button, Card, Input, PageTitle, Skeleton } from '../ui/primitives'
import { useLocale } from '../i18n'

const schema = z.object({
  loanPeriodDays: z.number().int().min(1).max(90),
  finePerDay: z.number().int().min(0).max(10000),
  maxActiveLoans: z.number().int().min(1).max(50),
})
type Values = z.infer<typeof schema>
type Policy = Values & { timezone: 'Asia/Dhaka'; updatedAt?: string }

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

  const live = useWatch({ control: form.control, defaultValue: { loanPeriodDays: 14, finePerDay: 4, maxActiveLoans: 5 } })
  const errors = form.formState.errors

  if (query.isPending) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>

  return (
    <>
      <PageTitle eyebrow={t('libraryGroup')} title={t('settings')} description="Borrowing policy applied to every new loan — changes never rewrite existing due dates." />
      {query.error && <div className="mb-4"><Alert message={message(query.error)} /></div>}
      {mutation.isSuccess && <div className="mb-4"><Alert tone="success" message={t('policySaved')} /></div>}
      {mutation.error && <div className="mb-4"><Alert message={message(mutation.error)} /></div>}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Settings2 size={18} /></span>
            <div><h2 className="text-[15px] font-semibold text-slate-900">Borrowing policy</h2><p className="text-[11.5px] text-slate-500">{t('timezoneDhaka')}</p></div>
          </div>
          <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div className="flex items-start gap-3">
              <Timer size={16} className="mt-2.5 shrink-0 text-slate-400" />
              <div className="flex-1">
                <Input type="number" min={1} max={90} label={t('loanPeriodDays')} {...form.register('loanPeriodDays', { valueAsNumber: true })} error={errors.loanPeriodDays ? t('settingDaysHelp') : undefined} />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wallet size={16} className="mt-2.5 shrink-0 text-slate-400" />
              <div className="flex-1">
                <Input type="number" min={0} max={10000} label={t('finePerDay')} {...form.register('finePerDay', { valueAsNumber: true })} error={errors.finePerDay ? t('settingFineHelp') : undefined} />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen size={16} className="mt-2.5 shrink-0 text-slate-400" />
              <div className="flex-1">
                <Input type="number" min={1} max={50} label={t('maxActiveLoans')} {...form.register('maxActiveLoans', { valueAsNumber: true })} error={errors.maxActiveLoans ? t('settingLoansHelp') : undefined} />
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" loading={mutation.isPending}>{mutation.isPending ? t('saving') : t('saveSettings')}</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="hero-canvas relative isolate overflow-hidden border-0 text-white">
            <span className="hero-glow -right-6 -top-8 h-32 w-32" aria-hidden="true" />
            <div className="relative">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-lime-accent/80">Live preview</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold">{live.loanPeriodDays || 0}-day loans</h2>
              <p className="mt-1 text-[12.5px] text-emerald-50/70">Every loan issued from now on uses this policy.</p>
              <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-[12.5px]">
                <div className="flex justify-between"><dt className="text-emerald-50/60">{t('finePerDay')}</dt><dd className="font-semibold">৳{live.finePerDay || 0}</dd></div>
                <div className="flex justify-between"><dt className="text-emerald-50/60">{t('maxActiveLoans')}</dt><dd className="font-semibold">{live.maxActiveLoans || 0}</dd></div>
                <div className="flex justify-between"><dt className="text-emerald-50/60">Timezone</dt><dd className="font-semibold">Asia/Dhaka</dd></div>
              </dl>
            </div>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800"><CircleAlert size={14} className="text-amber-600" />Applies to new loans only</p>
            <p className="mt-1 text-[11.5px] leading-6 text-slate-500">Existing loans keep the due date they were issued with. Fines already recorded are unchanged.</p>
            <div className="mt-3 flex items-center gap-2"><Badge tone="green" dot>Server enforced</Badge><span className="text-[11px] text-slate-500">Members cannot bypass these limits.</span></div>
          </Card>
        </div>
      </div>
    </>
  )
}
