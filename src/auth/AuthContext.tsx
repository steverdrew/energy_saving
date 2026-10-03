import { FirebaseError } from 'firebase/app'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth } from '../firebase'
import { describeAuthError } from './firebaseErrors'

export interface AuthUser {
  id: string
  email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /**
   * OA-88: used by LoginPage's "Forgot password?" link. Never throws for
   * "no such account" (`auth/user-not-found`) -- callers should show the
   * same generic confirmation either way, so this page never reveals
   * whether a given email has an account.
   */
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toAuthUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) return null
  return { id: firebaseUser.uid, email: firebaseUser.email }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(toAuthUser(firebaseUser))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function login(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Enter your email and password.')
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      throw new Error(describeAuthError(err))
    }
  }

  async function logout() {
    await firebaseSignOut(auth)
  }

  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/user-not-found') return
      throw new Error(describeAuthError(err, 'sending that email'))
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
