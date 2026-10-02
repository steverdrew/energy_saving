import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, type AuthUser, type SignupInput } from '../api/client'

export type { AuthUser }

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signup: (input: SignupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .me()
      .then((body) => setUser(body?.user ?? null))
      .finally(() => setLoading(false))
  }, [])

  const signup = useCallback(async (input: SignupInput) => {
    const body = await api.auth.signup(input)
    setUser(body?.user ?? null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const body = await api.auth.login(email, password)
    setUser(body?.user ?? null)
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout()
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    await api.auth.deleteAccount()
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
