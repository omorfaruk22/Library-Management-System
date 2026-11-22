import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, type LucideIcon } from 'lucide-react'
import { useLocale } from '../i18n'

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function cx(...values: Array<string | number | false | null | undefined>) {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white shadow-[0_1px_2px_rgba(7,35,25,.2),inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-brand-800 active:bg-brand-900',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-[0_1px_1px_rgba(10,30,20,.04)] hover:border-slate-300 hover:bg-slate-50',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  danger: 'bg-rose-600 text-white shadow-[0_1px_2px_rgba(120,10,30,.25)] hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
}

export function Button({
  variant = 'primary', size = 'md', className = '', loading = false, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        buttonSizes[size], buttonVariants[variant], className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function IconButton({
  label, icon: Icon, className = '', variant = 'ghost', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; variant?: ButtonVariant }) {
  return (
    <button
      aria-label={label} title={label}
      className={cx('inline-grid h-9 w-9 place-items-center rounded-lg transition disabled:opacity-40', buttonVariants[variant], className)}
      {...props}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

const fieldBase = 'w-full rounded-xl border bg-white text-sm text-slate-900 shadow-[0_1px_1px_rgba(10,30,20,.03)] outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50'
const fieldFocus = 'focus:border-brand-500 focus:ring-4 focus:ring-brand-600/10'

export function FieldShell({ label, hint, error, htmlFor, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">{label}</label>}
      {children}
      {error ? <p className="flex items-center gap-1 text-xs font-medium text-rose-700"><AlertCircle size={12} aria-hidden="true" />{error}</p>
        : hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Input({ label, hint, error, icon, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string; icon?: ReactNode }) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">{icon}</span>}
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={cx(
            fieldBase, fieldFocus, 'h-11 px-3.5',
            icon && 'pl-10',
            error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200',
            className,
          )}
          {...props}
        />
      </div>
    </FieldShell>
  )
}

export function Select({ label, hint, error, children, className = '', id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: string }) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <div className="relative">
        <select
          id={fieldId}
          className={cx(
            fieldBase, fieldFocus, 'h-11 cursor-pointer appearance-none py-0 pl-3.5 pr-9',
            error ? 'border-rose-300' : 'border-slate-200', className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronRight size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
      </div>
    </FieldShell>
  )
}

export function Textarea({ label, hint, error, className = '', id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string }) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        className={cx(fieldBase, fieldFocus, 'min-h-[96px] resize-y px-3.5 py-3 leading-6', error ? 'border-rose-300' : 'border-slate-200', className)}
        {...props}
      />
    </FieldShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({ children, className = '', as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'aside' } & Record<string, unknown>) {
  return <As className={cx('surface', className)} {...rest}>{children}</As>
}

export function PageTitle({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight text-slate-900 sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}

export function SectionHeading({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

const alertTones = {
  error: { shell: 'border-rose-200/70 bg-rose-50/80 text-rose-800', Icon: AlertCircle, icon: 'text-rose-600' },
  success: { shell: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900', Icon: CheckCircle2, icon: 'text-emerald-600' },
  info: { shell: 'border-sky-200/70 bg-sky-50/80 text-sky-900', Icon: Info, icon: 'text-sky-600' },
} as const

export function Alert({ message, tone = 'error', onClose, title }: { message: ReactNode; tone?: keyof typeof alertTones; onClose?: () => void; title?: string }) {
  const { shell, Icon, icon } = alertTones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6', shell)}>
      <Icon size={17} className={cx('mt-0.5 shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{message}</div>
      </div>
      {onClose && <button onClick={onClose} aria-label="Dismiss" className="-mr-1 rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"><X size={14} /></button>}
    </div>
  )
}

export function Badge({ children, tone = 'green', dot = false, className = '' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'slate' | 'sky'; dot?: boolean; className?: string }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
    sky: 'bg-sky-50 text-sky-800 ring-sky-600/15',
  }
  const dots = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', slate: 'bg-slate-400', sky: 'bg-sky-500' }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Spinner({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div role="status" className={cx('flex min-h-40 items-center justify-center gap-3 text-sm text-slate-500', className)}>
      <Loader2 size={18} className="animate-spin text-brand-700" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden="true" />
}

export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cx('space-y-2 p-5', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-11 w-full" />)}
    </div>
  )
}

export function EmptyState({ title, description, icon: Icon = BookOpen, action }: { title: ReactNode; description?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700">
        <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({ title, children, onClose, wide = false, footer, description }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean; footer?: ReactNode; description?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [onClose])
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink-950/45 p-3 backdrop-blur-[2px] sm:p-6 sm:pt-[8vh]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        className={cx('fade-up w-full overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-lift outline-none', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <IconButton label="Close" icon={X} onClick={onClose} className="-mr-1 shrink-0" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function FormActions({ onCancel, submitText, loading, cancelText }: { onCancel?: () => void; submitText: string; loading?: boolean; cancelText?: string }) {
  const { t } = useLocale()
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{cancelText ?? t('cancel')}</Button>}
      <Button type="submit" loading={loading}>{loading ? t('saving') : submitText}</Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Data display                                                               */
/* -------------------------------------------------------------------------- */

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className = '' }: {
  label: ReactNode; value: ReactNode; hint?: ReactNode; icon: LucideIcon
  tone?: 'brand' | 'lime' | 'amber' | 'rose' | 'teal' | 'sky'; className?: string
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700', lime: 'bg-lime-50 text-lime-700',
    amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700',
    teal: 'bg-teal-50 text-teal-700', sky: 'bg-sky-50 text-sky-700',
  }
  return (
    <div className={cx('surface card-hover group relative p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className={cx('grid h-10 w-10 place-items-center rounded-xl', tones[tone])}><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
      </div>
      <p className="mt-4 text-[28px] font-semibold leading-none tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-semibold text-slate-700">{label}</p>
      {hint && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  )
}

export function TableShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-x-auto', className)}>{children}</div>
}

export function Pagination({ page, pages, total, shown, onChange, busy = false }: { page: number; pages: number; total: number; shown?: number; onChange: (page: number) => void; busy?: boolean }) {
  const { t } = useLocale()
  if (total === 0) return null
  const window = pageWindow(page, pages)
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-slate-500">
        {t('showing')} <span className="font-semibold text-slate-700">{shown ?? 0}</span> / <span className="font-semibold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)} aria-label={t('previous')}>
          <ChevronLeft size={15} /><span className="hidden sm:inline">{t('previous')}</span>
        </Button>
        {window.map((entry, index) => entry === 'gap'
          ? <span key={'gap-' + index} className="px-1 text-xs text-slate-400">…</span>
          : <button
              key={entry} onClick={() => onChange(entry)} aria-current={entry === page ? 'page' : undefined} disabled={busy}
              className={cx('h-9 min-w-9 rounded-lg px-2 text-[13px] font-semibold transition',
                entry === page ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100')}
            >{entry}</button>)}
        <Button variant="secondary" size="sm" disabled={page >= pages || busy} onClick={() => onChange(page + 1)} aria-label={t('next')}>
          <span className="hidden sm:inline">{t('next')}</span><ChevronRight size={15} />
        </Button>
      </div>
    </nav>
  )
}

function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)
  const entries: Array<number | 'gap'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) entries.push('gap')
  for (let value = start; value <= end; value += 1) entries.push(value)
  if (end < pages - 1) entries.push('gap')
  entries.push(pages)
  return entries
}

export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('toolbar', className)}>{children}</div>
}

export function CoverCard({ title, src, className = '', size = 'md' }: { title: string; src?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  return (
    <div className={cx('cover-plate relative overflow-hidden', className)}>
      {showImage
        ? <img src={src} alt={`${title} cover`} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full flex-col justify-between p-3">
            <BookOpen size={size === 'sm' ? 16 : 22} className="text-brand-700/50" aria-hidden="true" />
            <span className={cx('font-display font-semibold leading-tight text-brand-900/80', size === 'sm' ? 'text-[10px] line-clamp-3' : 'text-xs line-clamp-4')}>{title}</span>
          </div>}
      <span className="cover-spine" aria-hidden="true" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tabs / segmented control                                                   */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }>; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_1px_rgba(10,30,20,.04)]">
      {options.map((option) => (
        <button
          key={option.value} role="tab" aria-selected={option.value === value} onClick={() => onChange(option.value)}
          className={cx('rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', option.value === value ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}
        >{option.label}</button>
      ))}
    </div>
  )
}
