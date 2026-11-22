import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, CalendarClock, Check, Eye, EyeOff, Heart, KeyRound, MailCheck, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Alert, Button, Input } from '../ui/primitives'
import { api, message } from '../lib/api'
import { useLocale } from '../i18n'

const highlights = [
  { icon: BookOpen, text: 'Search the whole catalogue by title, author or ISBN' },
  { icon: CalendarClock, text: '14-day loans with due dates calculated automatically' },
  { icon: Heart, text: 'Wishlist and reservation queue for popular titles' },
]

function AuthShell({ title, subtitle, children, footer, tone = 'member', demo }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode; tone?: 'member' | 'staff'; demo?: { role: string; email: string; password: string } }) {
  const { t } = useLocale()
  return (
    <div className="mx-auto grid max-w-5xl gap-0 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-50px_rgba(7,35,25,.5)] lg:grid-cols-[.95fr_1.05fr]">
      <aside className="hero-canvas relative hidden flex-col justify-between overflow-hidden p-8 text-white lg:flex">
        <span className="hero-ring -right-20 -top-20 h-64 w-64" aria-hidden="true" />
        <span className="hero-glow -bottom-6 -left-8 h-40 w-40" aria-hidden="true" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-accent text-brand-950"><BookOpen size={19} /></span>
            <span className="font-display text-[17px] font-semibold">{t('brand')}</span>
          </Link>
          <div className="mt-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-50">
              <ShieldCheck size={12} className="text-lime-accent" />{tone === 'staff' ? t('adminArea') : t('authLine')}
            </span>
            <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.15]">{t('authHeadline')}</h2>
            <p className="mt-3 max-w-xs text-[13px] leading-6 text-emerald-50/70">{t('authText')}</p>
          </div>
        </div>
        <ul className="relative mt-10 space-y-3">
          {highlights.map((item) => {
            const Icon = item.icon
            return <li key={item.text} className="flex items-start gap-2.5 text-[12.5px] leading-6 text-emerald-50/75">
              <Icon size={15} className="mt-0.5 shrink-0 text-lime-accent" aria-hidden="true" />{item.text}
            </li>
          })}
        </ul>
        <p className="relative mt-8 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-50/40">{t('authFooter')}</p>
      </aside>

      <section className="p-6 py-9 sm:p-9 lg:p-10">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition hover:text-brand-700 lg:hidden">
            <ArrowLeft size={13} />{t('brand')}
          </Link>
          <h1 className="text-[24px] font-semibold leading-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-slate-500">{subtitle}</p>
          {demo && (
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/70 p-3 text-[11.5px] leading-5 text-brand-900">
              <p className="font-semibold">Preview mode — no database attached</p>
              <p className="mt-0.5 text-brand-900/70">Any password with 4+ characters works. Sample {demo.role} account: <span className="font-mono">{demo.email}</span></p>
            </div>
          )}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-center text-[13px] text-slate-500">{footer}</div>}
        </div>
      </section>
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete, hint, required = true, name }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; hint?: string; required?: boolean; name?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input label={label} hint={hint} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="pr-11" />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-[26px] grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const [notice] = useState((location.state as { message?: string } | null)?.message ?? '')
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const { t } = useLocale()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await api(admin ? '/auth/admin/login' : '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      await refresh()
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard')
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      tone={admin ? 'staff' : 'member'}
      demo={{ role: admin ? 'admin' : 'student', email: admin ? 'admin@leafline.example' : 'nusrat.jahan@example.com', password: 'demo1234' }}
      title={admin ? t('adminSignInTitle') : t('signInTitle')}
      subtitle={admin ? 'Use the credentials issued to your library team account.' : 'Use your member email to reach your reading desk.'}
      footer={admin
        ? <Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('backToLogin')}</Link>
        : <>{t('noAccount')} <Link to="/register" className="font-semibold text-brand-700 hover:underline">{t('signUp')}</Link></>}
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {notice && <Alert tone="success" message={notice} />}
        {error && <Alert message={error} />}
        <Input type="email" label={t('email')} placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordField label={t('password')} value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="flex items-center justify-between">
          <Link to="/forgot-password" className="text-[12.5px] font-semibold text-brand-700 hover:underline">{t('forgotPassword')}</Link>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><ShieldCheck size={11} />Secure session</span>
        </div>
        <Button className="w-full" size="lg" type="submit" loading={busy}>{t('signIn')}</Button>
      </form>
      {!admin && <p className="mt-5 text-center text-[11.5px] text-slate-400">Library staff? <Link to="/admin-login" className="font-semibold text-slate-600 hover:text-brand-700">Use the staff login</Link></p>}
    </AuthShell>
  )
}

export function RegisterPage() {
  const { t } = useLocale()
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const strength = passwordStrength(password)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password !== confirm) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) })
      await refresh()
      navigate('/dashboard')
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }

  return (
    <AuthShell
      title={t('createAccountTitle')}
      subtitle="A member account gives you borrowing, wishlists and reservation queues."
      footer={<>{t('haveAccount')} <Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('signIn')}</Link></>}
    >
      <form className="space-y-3.5" onSubmit={submit} noValidate>
        {error && <Alert message={error} />}
        <Input label={t('fullName')} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Your full name" />
        <Input type="email" label={t('email')} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
        <Input type="tel" label={t('phone')} hint="Optional — helps the desk reach you about due books." autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" />
        <PasswordField label={t('password')} value={password} onChange={setPassword} autoComplete="new-password" hint={t('passwordRule')} />
        {password && (
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((level) => <span key={level} className={'h-1 flex-1 rounded-full ' + (strength.score > level ? strength.color : 'bg-slate-100')} />)}
            </div>
            <span className="w-16 text-right text-[11px] font-semibold text-slate-500">{strength.label}</span>
          </div>
        )}
        <PasswordField label={t('confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <Button className="w-full" size="lg" type="submit" loading={busy}>{t('signUp')}</Button>
        <p className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-400"><Check size={12} className="mt-0.5 shrink-0 text-brand-600" />By creating an account you agree to return borrowed books by their due date.</p>
      </form>
    </AuthShell>
  )
}

function passwordStrength(password: string) {
  let score = 0
  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 16) score += 1
  const table = [
    { label: 'Too short', color: 'bg-rose-400' },
    { label: 'Weak', color: 'bg-amber-400' },
    { label: 'Fair', color: 'bg-amber-500' },
    { label: 'Good', color: 'bg-emerald-500' },
    { label: 'Strong', color: 'bg-emerald-600' },
  ]
  return { score, ...table[score] }
}

export function ForgotPasswordPage() {
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setNotice(t('resetRequestSent')) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return (
    <AuthShell title={t('forgotTitle')} subtitle={t('resetInstructions')} footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('backToLogin')}</Link>}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        {error && <Alert message={error} />}
        {notice && <Alert tone="success" message={notice} />}
        <Input type="email" label={t('email')} value={email} onChange={(event) => setEmail(event.target.value)} required icon={<MailCheck size={16} />} placeholder="you@example.com" />
        <Button className="w-full" size="lg" type="submit" loading={busy}>{t('sendResetLink')}</Button>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { t } = useLocale()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (password !== confirm) { setError(t('passwordMismatch')); return }
    setBusy(true)
    try { await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setNotice(t('resetSuccess')) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return (
    <AuthShell title={t('resetTitle')} subtitle="Choose a strong password you have not used before." footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('backToLogin')}</Link>}>
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {notice
        ? <div className="space-y-4"><Alert tone="success" message={notice} /><Link to="/login"><Button className="w-full" size="lg">{t('backToLogin')}</Button></Link></div>
        : !token
          ? <div className="space-y-4"><Alert message={t('resetLinkMissing')} /><Link to="/forgot-password"><Button className="w-full" variant="secondary">{t('requestResetLink')}</Button></Link></div>
          : <form className="space-y-4" onSubmit={submit} noValidate>
              <PasswordField label={t('newPassword')} value={password} onChange={setPassword} autoComplete="new-password" hint={t('passwordRule')} />
              <PasswordField label={t('confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
              <Button className="w-full" size="lg" type="submit" loading={busy}>{t('resetPassword')}</Button>
            </form>}
    </AuthShell>
  )
}

export function VerifyEmailPage() {
  const { t } = useLocale()
  const { refresh, user } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const verify = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try { await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }); await refresh(); setNotice(t('emailVerified')) }
    catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return (
    <AuthShell title={t('verifyEmail')} subtitle="Confirm the new address so it can replace your current email." footer={<Link to={user ? '/dashboard' : '/login'} className="font-semibold text-brand-700 hover:underline">{user ? t('dashboard') : t('backToLogin')}</Link>}>
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {notice
        ? <div className="space-y-4"><Alert tone="success" message={notice} /></div>
        : token
          ? <form className="space-y-4" onSubmit={verify}>
              <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 p-3.5 text-[12.5px] leading-6 text-brand-900">
                <KeyRound size={15} className="mt-0.5 shrink-0" />Confirm the email change requested from your profile. The link expires after 30 minutes.
              </div>
              <Button className="w-full" size="lg" type="submit" loading={busy}>{t('verifyEmail')}</Button>
            </form>
          : <Alert message={t('emailVerifyFailed')} />}
    </AuthShell>
  )
}

