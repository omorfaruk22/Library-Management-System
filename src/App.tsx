import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './ui/layout'
import { Button, Spinner } from './ui/primitives'
import { useAuth } from './auth'
import { useLocale } from './i18n'
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/AuthPages'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import BookDetails from './pages/BookDetails'
import Dashboard from './pages/Dashboard'
import AdminEntity from './pages/AdminEntity'
import AdminBooks from './pages/AdminBooks'
import { AdminLoans, StudentLoans } from './pages/Loans'
import Students from './pages/Students'
import { ChangePasswordPage, ProfilePage } from './pages/Profile'

const AdminReports = lazy(() => import('./pages/AdminReports'))
const BusinessAnalytics = lazy(() => import('./components/pages/BusinessAnalytics'))
const WishlistPage = lazy(() => import('./components/pages/WishlistPage'))
const ReservationsPage = lazy(() => import('./components/pages/ReservationsPage'))
const InventoryPage = lazy(() => import('./components/pages/InventoryPage'))
const SalesPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.SalesPage })))
const PurchasesPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.PurchasesPage })))
const SuppliersPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.SuppliersPage })))
const ExpensesPage = lazy(() => import('./pages/BusinessPages').then((module) => ({ default: module.ExpensesPage })))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))

function Guard({ role, children }: { role?: 'admin' | 'student'; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useLocale()
  if (loading) return <Spinner label={t('loading')} />
  if (!user) return <Navigate to={role === 'admin' ? '/admin-login' : '/login'} replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function Guest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading…" />
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function Missing() {
  const { t } = useLocale()
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-display text-[76px] font-semibold leading-none text-brand-700/20">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">{t('notFound')}</h1>
      <p className="mt-2 text-sm text-slate-500">The page may have moved, or the link may be out of date.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/"><Button>{t('home')}</Button></Link>
        <Link to="/books"><Button variant="secondary">{t('catalog')}</Button></Link>
      </div>
    </div>
  )
}

function LazyLoading() {
  const { t } = useLocale()
  return <Spinner label={t('loading')} />
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<LazyLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/books" element={<Catalog />} />
          <Route path="/books/:id" element={<BookDetails />} />
          <Route path="/login" element={<Guest><LoginPage /></Guest>} />
          <Route path="/admin-login" element={<Guest><LoginPage admin /></Guest>} />
          <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
          <Route path="/forgot-password" element={<Guest><ForgotPasswordPage /></Guest>} />
          <Route path="/reset-password" element={<Guest><ResetPasswordPage /></Guest>} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
          <Route path="/issued-books" element={<Guard role="student"><StudentLoans /></Guard>} />
          <Route path="/wishlist" element={<Guard role="student"><WishlistPage /></Guard>} />
          <Route path="/reservations" element={<Guard role="student"><ReservationsPage /></Guard>} />
          <Route path="/profile" element={<Guard role="student"><ProfilePage /></Guard>} />
          <Route path="/change-password" element={<Guard><ChangePasswordPage /></Guard>} />

          <Route path="/admin/categories" element={<Guard role="admin"><AdminEntity kind="categories" /></Guard>} />
          <Route path="/admin/authors" element={<Guard role="admin"><AdminEntity kind="authors" /></Guard>} />
          <Route path="/admin/books" element={<Guard role="admin"><AdminBooks /></Guard>} />
          <Route path="/admin/inventory" element={<Guard role="admin"><InventoryPage /></Guard>} />
          <Route path="/admin/issued-books" element={<Guard role="admin"><AdminLoans /></Guard>} />
          <Route path="/admin/students" element={<Guard role="admin"><Students /></Guard>} />
          <Route path="/admin/reports" element={<Guard role="admin"><AdminReports /></Guard>} />
          <Route path="/admin/analytics" element={<Guard role="admin"><BusinessAnalytics /></Guard>} />
          <Route path="/admin/sales" element={<Guard role="admin"><SalesPage /></Guard>} />
          <Route path="/admin/purchases" element={<Guard role="admin"><PurchasesPage /></Guard>} />
          <Route path="/admin/suppliers" element={<Guard role="admin"><SuppliersPage /></Guard>} />
          <Route path="/admin/expenses" element={<Guard role="admin"><ExpensesPage /></Guard>} />
          <Route path="/admin/settings" element={<Guard role="admin"><AdminSettings /></Guard>} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
