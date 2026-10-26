import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout, Spinner } from './components'
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
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
function Guard({ role, children }: { role?: 'admin' | 'student'; children: React.ReactNode }) {
  const { user, loading } = useAuth(); const location = useLocation(); const { t } = useLocale()
  if (loading) return <Spinner label={t('loading')} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
function Guest({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return null; return user ? <Navigate to="/dashboard" replace /> : <>{children}</> }
function Missing() { const { t } = useLocale(); return <div className="py-24 text-center"><div className="text-7xl font-bold text-brand-700">404</div><p className="mt-3 text-slate-600">{t('notFound')}</p><a className="mt-5 inline-block font-semibold text-brand-700" href="/">{t('home')}</a></div> }
function LazyLoading() { const { t } = useLocale(); return <Spinner label={t('loading')} /> }
export default function App() {
  return <Layout><Suspense fallback={<LazyLoading />}><Routes>
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
    <Route path="/profile" element={<Guard role="student"><ProfilePage /></Guard>} />
    <Route path="/change-password" element={<Guard><ChangePasswordPage /></Guard>} />
    <Route path="/admin/categories" element={<Guard role="admin"><AdminEntity kind="categories" /></Guard>} />
    <Route path="/admin/authors" element={<Guard role="admin"><AdminEntity kind="authors" /></Guard>} />
    <Route path="/admin/books" element={<Guard role="admin"><AdminBooks /></Guard>} />
    <Route path="/admin/issued-books" element={<Guard role="admin"><AdminLoans /></Guard>} />
    <Route path="/admin/students" element={<Guard role="admin"><Students /></Guard>} />
    <Route path="/admin/reports" element={<Guard role="admin"><AdminReports /></Guard>} />
    <Route path="/admin/settings" element={<Guard role="admin"><AdminSettings /></Guard>} />
    <Route path="*" element={<Missing />} />
  </Routes></Suspense></Layout>
}
