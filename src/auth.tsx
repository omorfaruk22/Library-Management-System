import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './lib/api'

export interface User { id: string; name: string; email: string; role: 'admin' | 'student'; studentId?: string; phone?: string; status?: string; createdAt?: string; updatedAt?: string }
interface AuthState { user: User | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Context = createContext<AuthState>({ user: null, loading: true, refresh: async () => {}, signOut: async () => {} })
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { try { const data = await api<{ user: User }>('/auth/me'); setUser(data.user) } catch { setUser(null) } finally { setLoading(false) } }, [])
  useEffect(() => { void refresh() }, [refresh])
  const signOut = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setUser(null) } }, [])
  const value = useMemo(() => ({ user, loading, refresh, signOut }), [user, loading, refresh, signOut])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
