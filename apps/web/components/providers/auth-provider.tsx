'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, clearToken, setToken } from '../../src/lib/auth'
import { api } from '../../src/lib/api'

interface User { id: string; email: string; name?: string; role: string }
interface AuthCtx { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void }

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    api.get<User>('auth/me').then(setUser).catch(() => clearToken()).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { token, user } = await api.post<{ token: string; user: User }>('auth/login', { email, password })
    setToken(token); setUser(user); router.push('/dashboard')
  }

  function logout() { clearToken(); setUser(null); router.push('/login') }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
