import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, LibraryBig, Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function MetricStrip({ items }: { items: Array<{ label: string; value: ReactNode; icon?: LucideIcon }> }) {
  return (
    <dl className="grid divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="flex items-center gap-3 px-5 py-4">
            {Icon && <Icon size={18} className="text-lime-accent/80" aria-hidden="true" />}
            <div>
              <dd className="font-display text-xl font-semibold leading-none text-white">{item.value}</dd>
              <dt className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-50/55">{item.label}</dt>
            </div>
          </div>
        )
      })}
    </dl>
  )
}

export function HeroBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-50 backdrop-blur-sm">
      <Sparkles size={13} className="text-lime-accent" aria-hidden="true" />{children}
    </span>
  )
}

export function TextLink({ to, children, tone = 'brand' }: { to: string; children: ReactNode; tone?: 'brand' | 'muted' }) {
  return (
    <Link to={to} className={'group inline-flex items-center gap-1 text-[13px] font-semibold transition ' + (tone === 'brand' ? 'text-brand-700 hover:text-brand-800' : 'text-slate-600 hover:text-slate-900')}>
      {children}<ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

export function BrandMark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span className={'grid h-9 w-9 place-items-center rounded-xl ' + (tone === 'light' ? 'bg-brand-800 text-lime-accent' : 'bg-lime-accent text-brand-950')}>
      <LibraryBig size={17} aria-hidden="true" />
    </span>
  )
}

export function BookGlyph({ className = '' }: { className?: string }) {
  return <BookOpen size={16} className={className} aria-hidden="true" />
}
