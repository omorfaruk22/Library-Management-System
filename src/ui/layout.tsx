import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowRight, BookOpen, ChartNoAxesCombined, ChevronDown, CircleUserRound, ClipboardList, Globe2,
  Heart, Landmark, LayoutDashboard, LibraryBig, LogOut, Menu, Percent, Receipt, Settings, ShoppingCart,
  Sparkles, Tags, Truck, Users, UsersRound, Wallet, Warehouse, X, BookMarked, CalendarClock,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useLocale } from '../i18n'
import { Badge } from './primitives'

type NavLinkItem = { to: string; label: string; icon: typeof BookOpen; hint?: string }

const studentNav: NavLinkItem[] = [
  { to: '/dashboard', label: 'dashboard', icon: LayoutDashboard },
  { to: '/books', label: 'catalog', icon: LibraryBig },
  { to: '/issued-books', label: 'issuedBooks', icon: BookMarked },
  { to: '/wishlist', label: 'wishlist', icon: Heart },
  { to: '/reservations', label: 'reservations', icon: CalendarClock },
]

const adminGroups: Array<{ id: string; label: string; icon: typeof BookOpen; links: NavLinkItem[] }> = [
  {
    id: 'library', label: 'libraryGroup', icon: LibraryBig, links: [
      { to: '/admin/inventory', label: 'inventory', icon: Warehouse, hint: 'Stock, damage and movement history' },
      { to: '/admin/books', label: 'books', icon: BookOpen, hint: 'Titles, pricing and shelf locations' },
      { to: '/admin/categories', label: 'categories', icon: Tags, hint: 'Subjects used for browsing' },
      { to: '/admin/authors', label: 'authors', icon: UsersRound, hint: 'Author profiles and their books' },
    ],
  },
  {
    id: 'circulation', label: 'circulationGroup', icon: BookMarked, links: [
      { to: '/admin/issued-books', label: 'issuedBooks', icon: Receipt, hint: 'Issue, return and overdue fines' },
      { to: '/admin/students', label: 'students', icon: Users, hint: 'Members, access and loan history' },
      { to: '/admin/activity', label: 'activityLog', icon: Activity, hint: 'Staff actions and record changes' },
    ],
  },
  {
    id: 'business', label: 'businessGroup', icon: ChartNoAxesCombined, links: [
      { to: '/admin/analytics', label: 'analytics', icon: Percent, hint: 'Revenue, expenses and trends' },
      { to: '/admin/sales', label: 'sales', icon: ShoppingCart, hint: 'Counter sales and invoices' },
      { to: '/admin/purchases', label: 'purchases', icon: Truck, hint: 'Supplier invoices and receiving' },
      { to: '/admin/suppliers', label: 'suppliers', icon: Landmark, hint: 'Vendors and contact details' },
      { to: '/admin/expenses', label: 'expenses', icon: Wallet, hint: 'Rent, salaries and utilities' },
    ],
  },
]

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale()
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-lime-accent text-brand-950 shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_4px_12px_rgba(0,0,0,.25)]">
        <BookOpen size={19} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[17px] font-semibold tracking-tight text-white">{t('brand')}</span>
        {!compact && <span className="block truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-emerald-100/55">{t('tagline')}</span>}
      </span>
    </span>
  )
}

function LocaleToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <button
      type="button" onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
      className={'inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[12px] font-semibold text-emerald-50/90 transition hover:border-white/25 hover:bg-white/10 ' + className}
      aria-label="Change language" title="বাংলা / English"
    >
      <Globe2 size={14} aria-hidden="true" />
      {locale === 'en' ? 'বাংলা' : 'English'}
    </button>
  )
}

export function Header() {
  const { user, signOut } = useAuth()
  const { t } = useLocale()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => { setMobileOpen(false); setOpenMenu(null); setAccountOpen(false) }, [location.pathname])
  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (headerRef.current && !headerRef.current.contains(event.target as Node)) { setOpenMenu(null); setAccountOpen(false) } }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenMenu(null); setAccountOpen(false); setMobileOpen(false) } }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const logout = async () => { await signOut(); navigate('/') }
  const isAdmin = user?.role === 'admin'

  const topLink = (item: NavLinkItem) => (
    <NavLink
      key={item.to} to={item.to}
      className={({ isActive }) => 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold transition ' + (isActive ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]' : 'text-emerald-50/70 hover:bg-white/8 hover:text-white')}
    >{t(item.label as Parameters<typeof t>[0])}</NavLink>
  )

  return (
    <header ref={headerRef} className="app-header sticky top-0 z-50 text-white">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to={user ? '/dashboard' : '/'} className="shrink-0 rounded-lg outline-offset-4"><Brand /></Link>

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 lg:flex">
          {!user && <>
            {topLink({ to: '/', label: 'home', icon: BookOpen })}
            {topLink({ to: '/books', label: 'catalog', icon: LibraryBig })}
            <span className="mx-2 h-5 w-px bg-white/12" aria-hidden="true" />
            <Link to="/login" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold text-emerald-50/75 transition hover:bg-white/8 hover:text-white">For members</Link>
          </>}
          {user && !isAdmin && studentNav.map(topLink)}
          {isAdmin && <>
            {topLink({ to: '/dashboard', label: 'dashboard', icon: LayoutDashboard })}
            {adminGroups.map((group) => {
              const GroupIcon = group.icon
              const active = group.links.some((link) => location.pathname.startsWith(link.to))
              const open = openMenu === group.id
              return (
                <div key={group.id} className="relative">
                  <button
                    type="button" onClick={() => setOpenMenu(open ? null : group.id)} aria-expanded={open} aria-haspopup="true"
                    className={'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold transition ' + (open || active ? 'bg-white/12 text-white' : 'text-emerald-50/70 hover:bg-white/8 hover:text-white')}
                  >
                    <GroupIcon size={15} aria-hidden="true" />{t(group.label as Parameters<typeof t>[0])}
                    <ChevronDown size={13} className={'transition ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="mega-panel absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden p-1.5" role="menu">
                      {group.links.map((link) => {
                        const Icon = link.icon
                        return (
                          <NavLink
                            key={link.to} to={link.to} role="menuitem"
                            className={({ isActive }) => 'flex items-start gap-3 rounded-lg p-2.5 transition ' + (isActive ? 'bg-brand-50' : 'hover:bg-slate-50')}
                          >
                            {({ isActive }) => <>
                              <span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ' + (isActive ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600')}><Icon size={15} aria-hidden="true" /></span>
                              <span className="min-w-0">
                                <span className="block text-[13px] font-semibold text-slate-900">{t(link.label as Parameters<typeof t>[0])}</span>
                                <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">{link.hint}</span>
                              </span>
                            </>}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {topLink({ to: '/admin/reports', label: 'reports', icon: ClipboardList })}
            {topLink({ to: '/admin/settings', label: 'settings', icon: Settings })}
          </>}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleToggle />
          {!user && (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="inline-flex h-9 items-center rounded-lg px-3 text-[13.5px] font-semibold text-emerald-50/85 transition hover:bg-white/8 hover:text-white">{t('signIn')}</Link>
              <Link to="/register" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-lime-accent px-3.5 text-[13.5px] font-bold text-brand-950 shadow-[0_1px_2px_rgba(0,0,0,.25)] transition hover:bg-lime-200">
                {t('signUp')} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
          {user && (
            <div className="relative">
              <button
                type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-haspopup="true"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 pl-1.5 pr-2 text-[13px] font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-lime-accent/90 text-[11px] font-bold text-brand-950">
                  {user.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-24 truncate sm:block">{user.name.split(' ')[0]}</span>
                <ChevronDown size={13} className="text-emerald-100/70" aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="mega-panel absolute right-0 top-full mt-2 w-64 overflow-hidden p-1.5" role="menu">
                  <div className="border-b border-slate-100 px-2.5 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{user.name}</p>
                    <p className="truncate text-[11.5px] text-slate-500">{user.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge tone={isAdmin ? 'sky' : 'green'}>{isAdmin ? t('adminArea') : t('studentArea')}</Badge>
                      {user.studentId && <span className="font-mono text-[10.5px] text-slate-500">{user.studentId}</span>}
                    </div>
                  </div>
                  <Link to={isAdmin ? '/change-password' : '/profile'} className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50" role="menuitem">
                    <CircleUserRound size={15} className="text-slate-400" aria-hidden="true" />{isAdmin ? t('changePassword') : t('profile')}
                  </Link>
                  {!isAdmin && <Link to="/change-password" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50" role="menuitem"><Settings size={15} className="text-slate-400" aria-hidden="true" />{t('changePassword')}</Link>}
                </div>
              )}
            </div>
          )}
          {user && (
            <button
              type="button"
              onClick={logout}
              aria-label={t('signOut')}
              title={t('signOut')}
              className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 px-3 text-[13px] font-semibold text-emerald-50/90 transition hover:border-white/25 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <LogOut size={15} aria-hidden="true" />{t('signOut')}
            </button>
          )}
          <button type="button" onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-white transition hover:bg-white/10 lg:hidden" aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-[#08160f] p-4 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Brand compact />
              <button onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Close menu"><X size={20} /></button>
            </div>
            <nav className="flex-1 space-y-4" aria-label="Mobile">
              {!user && <div className="space-y-1">
                {[{ to: '/', label: 'Home' }, { to: '/books', label: t('catalog') }, { to: '/login', label: t('signIn') }, { to: '/register', label: t('signUp') }].map((item) => (
                  <NavLink key={item.to} to={item.to} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-50/80 hover:bg-white/10 hover:text-white">{item.label}</NavLink>
                ))}
              </div>}
              {user && !isAdmin && <div className="space-y-1">
                {studentNav.map((item) => <MobileLink key={item.to} item={item} label={t(item.label as Parameters<typeof t>[0])} />)}
              </div>}
              {isAdmin && <div className="space-y-3">
                <MobileLink item={{ to: '/dashboard', label: 'dashboard', icon: LayoutDashboard }} label={t('dashboard')} />
                {adminGroups.map((group) => (
                  <section key={group.id}>
                    <p className="mb-1 px-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-lime-accent/70">{t(group.label as Parameters<typeof t>[0])}</p>
                    <div className="space-y-0.5">{group.links.map((link) => <MobileLink key={link.to} item={link} label={t(link.label as Parameters<typeof t>[0])} />)}</div>
                  </section>
                ))}
                <MobileLink item={{ to: '/admin/reports', label: 'reports', icon: ClipboardList }} label={t('reports')} />
                <MobileLink item={{ to: '/admin/settings', label: 'settings', icon: Settings }} label={t('settings')} />
              </div>}
            </nav>
            {user && <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
              <p className="px-3 pb-1 text-[11px] text-emerald-100/50">{user.email}</p>
              <MobileLink item={{ to: isAdmin ? '/change-password' : '/profile', label: 'profile', icon: CircleUserRound }} label={isAdmin ? t('changePassword') : t('profile')} />
              <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 hover:bg-white/10"><LogOut size={16} />{t('signOut')}</button>
            </div>}
          </div>
        </div>
      )}
    </header>
  )
}

function MobileLink({ item, label }: { item: NavLinkItem; label: string }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => 'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ' + (isActive ? 'bg-lime-accent text-brand-950' : 'text-emerald-50/80 hover:bg-white/10 hover:text-white')}
    ><Icon size={16} aria-hidden="true" />{label}</NavLink>
  )
}

export function Footer() {
  const { t } = useLocale()
  const { user } = useAuth()
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer mt-16 border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-800 text-lime-accent"><BookOpen size={17} aria-hidden="true" /></span>
              <span className="font-display text-lg font-semibold text-slate-900">{t('brand')}</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-6 text-slate-500">
              A calmer way to run a lending library — catalogue, circulation, members and counter sales in one place.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <Sparkles size={12} className="text-brand-700" aria-hidden="true" /> Asia/Dhaka · 14-day loans
            </div>
          </div>
          <FooterColumn title="Explore" links={[{ to: '/', label: t('home') }, { to: '/books', label: t('catalog') }, { to: user ? '/dashboard' : '/login', label: user ? t('dashboard') : t('signIn') }]} />
          <FooterColumn title="Members" links={[{ to: '/issued-books', label: t('issuedBooks') }, { to: '/wishlist', label: t('wishlist') }, { to: '/reservations', label: t('reservations') }]} />
          <FooterColumn title="Library team" links={[{ to: '/admin/inventory', label: t('inventory') }, { to: '/admin/issued-books', label: t('issuedBooks') }, { to: '/admin/reports', label: t('reports') }]} />
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200/70 pt-5 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {t('brand')}. Built for readers and library teams.</p>
          <p className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />{t('loanPeriod')} · {t('overdueRate')}</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<{ to: string; label: string }> }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => <li key={link.to + link.label}><Link to={link.to} className="text-[13px] font-medium text-slate-600 transition hover:text-brand-700">{link.label}</Link></li>)}
      </ul>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl grow px-4 py-7 outline-none sm:px-6 sm:py-9 lg:px-8">{children}</main>
      <Footer />
    </div>
  )
}
