import { useState, type FormEvent } from 'react'
import { CalendarDays, KeyRound, MailCheck, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Alert, Badge, Button, Card, Input, PageTitle } from '../ui/primitives'
import { api, date, message } from '../lib/api'
import { useLocale } from '../i18n'

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const { t } = useLocale()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const emailChanged = email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const result = await api<{ emailVerificationPending: boolean }>('/profile', { method: 'PUT', body: JSON.stringify({ name, email, phone }) })
      await refresh()
      setNotice(result.emailVerificationPending ? t('emailVerificationSent') : t('success'))
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle eyebrow={t('studentArea')} title={t('profile')} description={t('profileDetails')} />
      <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-4">
          <Card className="hero-canvas relative isolate overflow-hidden border-0 text-white">
            <span className="hero-ring -right-12 -top-16 h-44 w-44" aria-hidden="true" />
            <div className="relative">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-[22px] font-bold">{user?.name.trim().slice(0, 1).toUpperCase()}</span>
              <h2 className="mt-4 font-display text-xl font-semibold">{user?.name}</h2>
              <p className="mt-0.5 text-[12.5px] text-emerald-50/70">{user?.email}</p>
              <div className="mt-4 flex items-center gap-2">
                <Badge tone="green" className="bg-lime-accent/20 text-lime-100 ring-lime-200/30">{t('studentArea')}</Badge>
                <Badge tone="slate" className="bg-white/10 text-emerald-50 ring-white/20">{user?.status === 'active' ? t('active') : t('suspended')}</Badge>
              </div>
              <dl className="mt-5 space-y-3 border-t border-white/10 pt-4 text-[12.5px]">
                <div className="flex items-start gap-2.5"><ShieldCheck size={15} className="mt-0.5 text-lime-accent" /><div><dt className="text-[10.5px] uppercase tracking-wide text-emerald-50/50">{t('studentId')}</dt><dd className="font-mono font-semibold">{user?.studentId ?? '—'}</dd></div></div>
                <div className="flex items-start gap-2.5"><CalendarDays size={15} className="mt-0.5 text-lime-accent" /><div><dt className="text-[10.5px] uppercase tracking-wide text-emerald-50/50">{t('registrationDate')}</dt><dd className="font-semibold">{date(user?.createdAt)}</dd></div></div>
                <div className="flex items-start gap-2.5"><MailCheck size={15} className="mt-0.5 text-lime-accent" /><div><dt className="text-[10.5px] uppercase tracking-wide text-emerald-50/50">{t('updatedAt')}</dt><dd className="font-semibold">{date(user?.updatedAt)}</dd></div></div>
              </dl>
            </div>
          </Card>
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800"><KeyRound size={14} className="text-brand-700" />{t('changePassword')}</p>
            <p className="mt-1 text-[11.5px] leading-5 text-slate-500">Changing your password signs out every session.</p>
            <a href="/change-password" className="mt-3 inline-flex text-[12.5px] font-semibold text-brand-700 hover:underline">{t('changePassword')} →</a>
          </Card>
        </div>

        <Card>
          <h2 className="text-[15px] font-semibold text-slate-900">{t('profileDetails')}</h2>
          <p className="mt-1 text-[12px] text-slate-500">Your name and phone are visible to library staff only.</p>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            {error && <Alert message={error} />}
            {notice && <Alert tone="success" message={notice} onClose={() => setNotice('')} />}
            <Input label={t('fullName')} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
            <Input label={t('email')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required icon={<MailCheck size={15} />}
              hint={emailChanged ? t('emailVerificationSent') : 'Used for sign-in and password recovery.'} />
            <Input label={t('phone')} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} hint="Optional. Include country code if outside Bangladesh." />
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" loading={busy}>{busy ? t('saving') : t('saveProfile')}</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}

export function ChangePasswordPage() {
  const { t } = useLocale()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (newPassword !== confirm) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      await signOut()
      navigate('/login', { state: { message: t('passwordChanged') } })
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageTitle eyebrow={t('account')} title={t('changePassword')} description="Use at least 10 characters. You will be signed out everywhere after saving." />
      <Card className="mx-auto max-w-xl">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-white"><KeyRound size={16} /></span>
          <div><p className="text-[13px] font-semibold text-brand-900">Keep your account safe</p><p className="mt-0.5 text-[11.5px] leading-5 text-brand-900/70">Never reuse a library password on other websites.</p></div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {error && <Alert message={error} />}
          <Input type="password" label={t('currentPassword')} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <Input type="password" label={t('newPassword')} autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required hint={t('passwordRule')} />
          <Input type="password" label={t('confirmPassword')} autoComplete="new-password" minLength={10} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-400"><UserRound size={12} />Signed in as your library account</span>
            <Button type="submit" loading={busy}>{busy ? t('saving') : t('save')}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
