import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

/**
 * Auth state backed by the httpOnly session cookie: on mount we ask the API
 * who we are, so a page refresh keeps the user signed in. The user object is
 * the only thing held client-side — the credential itself never touches JS.
 */

interface AuthState {
  user: User | null
  /** True while the initial /auth/me check is in flight. */
  initializing: boolean
  login: (email: string, password: string, remember: boolean) => Promise<User | null>
  register: (input: { name: string; email: string; password: string; confirmPassword: string }) => Promise<User | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.me()
      .then((result) => { if (!cancelled) setUser(result.user) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setInitializing(false) })
    return () => { cancelled = true }
  }, [])

  const value: AuthState = {
    user,
    initializing,
    async login(email, password, remember) {
      const { user: signedIn } = await api.login({ email, password, remember })
      setUser(signedIn)
      return signedIn
    },
    async register(input) {
      const { user: created } = await api.register(input)
      setUser(created)
      return created
    },
    async logout() {
      try {
        await api.logout()
      } finally {
        setUser(null)
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
