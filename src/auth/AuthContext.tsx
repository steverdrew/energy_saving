import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export interface AuthUser {
  id: string
  email: string
}

interface SignupInput {
  email: string
  password: string
  acceptedTerms: boolean
  acceptedPrivacy: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error ?? 'Something went wrong')
  }
  return body
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setUser(body?.user ?? null))
      .finally(() => setLoading(false))
  }, [])

  const signup = useCallback(async (input: SignupInput) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = await parseJsonOrThrow(res)
    setUser(body.user)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await parseJsonOrThrow(res)
    setUser(body.user)
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? 'Could not delete account')
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
