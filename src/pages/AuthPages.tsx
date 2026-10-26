import { useState, type FormEvent } from 'react'
import { BookOpen, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Alert, Button, Input } from '../components'
import { api, message } from '../lib/api'
import { useLocale } from '../i18n'

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { t } = useLocale()
  return <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft lg:grid-cols-[.9fr_1.1fr]"><div className="relative hidden min-h-[590px] flex-col justify-between overflow-hidden bg-brand-800 p-10 text-white lg:flex"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[40px] border-white/10" /><div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-emerald-600/40 blur-sm" /><div className="relative flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><BookOpen size={26} /></span><span className="text-xl font-bold">{t('brand')}</span></div><div className="relative"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><ShieldCheck size={15} />{t('authLine')}</div><h2 className="max-w-sm text-4xl font-bold leading-tight">{t('authHeadline')}</h2><p className="mt-4 max-w-sm text-sm leading-7 text-emerald-100">{t('authText')}</p></div><p className="relative text-xs text-emerald-100/75">{t('authFooter')}</p></div><div className="flex items-center p-6 py-10 sm:p-10"><div className="mx-auto w-full max-w-md"><div className="mb-7 lg:hidden"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-white"><BookOpen /></div></div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p><div className="mt-7">{children}</div></div></div></div>
}

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const location = useLocation()
  const [notice] = useState((location.state as { message?: string } | null)?.message ?? '')
  const { refresh } = useAuth(); const navigate = useNavigate(); const { t } = useLocale()
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await api(admin ? '/auth/admin/login' : '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); await refresh(); navigate('/dashboard') } catch (err) { setError(message(err)) } finally { setBusy(false) } }
  return <AuthCard title={admin ? t('adminSignInTitle') : t('signInTitle')} subtitle={admin ? t('adminArea') : t('studentArea')}><form className="space-y-4" onSubmit={submit}>{notice && <Alert tone="success" message={notice} />}{error && <Alert message={error} />}<Input type="email" label={t('email')} placeholder="name@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input type="password" label={t('password')} placeholder="••••••••••" autoComplete={admin ? 'current-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /><div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">{t('forgotPassword')}</Link></div><Button className="w-full" type="submit" disabled={busy}>{busy ? t('loading') : t('signIn')}</Button></form>{!admin && <p className="mt-6 text-center text-sm text-slate-500">{t('noAccount')} <Link to="/register" className="font-semibold text-brand-700 hover:underline">{t('signUp')}</Link></p>}{admin && <p className="mt-6 text-center text-sm text-slate-500"><Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('backToLogin')}</Link></p>}</AuthCard>
}

export function RegisterPage() {
  const { t } = useLocale(); const { refresh } = useAuth(); const navigate = useNavigate(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (password !== confirm) { setError(t('passwordMismatch')); return } setBusy(true); try { await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) }); await refresh(); navigate('/dashboard') } catch (err) { setError(message(err)) } finally { setBusy(false) } }
  return <AuthCard title={t('createAccountTitle')} subtitle={t('studentArea')}><form className="space-y-4" onSubmit={submit}>{error && <Alert message={error} />}<Input label={t('fullName')} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /><Input type="email" label={t('email')} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input type="tel" label={t('phone')} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /><Input type="password" label={t('password')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /><Input type="password" label={t('confirmPassword')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} /><Button className="w-full" type="submit" disabled={busy}>{busy ? t('loading') : t('createAccountTitle')}</Button></form><p className="mt-6 text-center text-sm text-slate-500">{t('haveAccount')} <Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('signIn')}</Link></p></AuthCard>
}

export function ForgotPasswordPage() {
  const { t } = useLocale(); const [email, setEmail] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); setNotice(''); try { await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setNotice(t('resetRequestSent')) } catch (err) { setError(message(err)) } finally { setBusy(false) } }
  return <AuthCard title={t('forgotTitle')} subtitle={t('resetInstructions')}><form className="space-y-4" onSubmit={submit}>{error && <Alert message={error} />}{notice && <Alert tone="success" message={notice} />}<Input type="email" label={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} required /><Button className="w-full" type="submit" disabled={busy}>{busy ? t('loading') : t('sendResetLink')}</Button></form><p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-brand-700">{t('backToLogin')}</Link></p></AuthCard>
}

export function ResetPasswordPage() {
  const { t } = useLocale(); const [params] = useSearchParams(); const token = params.get('token') ?? ''; const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (password !== confirm) { setError(t('passwordMismatch')); return } setBusy(true); try { await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setNotice(t('resetSuccess')) } catch (err) { setError(message(err)) } finally { setBusy(false) } }
  return <AuthCard title={t('resetTitle')} subtitle={t('newPassword')}>{error && <Alert message={error} />}{notice ? <div className="space-y-4"><Alert tone="success" message={notice} /><Link className="inline-block text-sm font-semibold text-brand-700" to="/login">{t('backToLogin')}</Link></div> : !token ? <div className="space-y-4"><Alert message={t('resetLinkMissing')} /><Link className="inline-block text-sm font-semibold text-brand-700" to="/forgot-password">{t('requestResetLink')}</Link></div> : <form className="space-y-4" onSubmit={submit}><Input type="password" label={t('newPassword')} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required /><Input type="password" label={t('confirmPassword')} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={10} required /><Button className="w-full" type="submit" disabled={busy}>{busy ? t('loading') : t('resetPassword')}</Button></form>}</AuthCard>
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
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      await refresh()
      setNotice(t('emailVerified'))
    } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }
  return <AuthCard title={t('verifyEmail')} subtitle={t('studentArea')}>
    {error && <Alert message={error} />}
    {notice ? <div className="space-y-4"><Alert tone="success" message={notice} /><Link className="font-semibold text-brand-700" to={user ? '/dashboard' : '/login'}>{user ? t('dashboard') : t('backToLogin')}</Link></div> : token ? <form className="space-y-4" onSubmit={verify}><p className="text-sm leading-6 text-slate-600">Confirm the email change requested from your profile. The link expires after 30 minutes.</p><Button className="w-full" type="submit" disabled={busy}>{busy ? t('loading') : t('verifyEmail')}</Button></form> : <Alert message={t('emailVerifyFailed')} />}
  </AuthCard>
}
