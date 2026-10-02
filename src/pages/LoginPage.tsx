import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './LoginPage.css'

function destinationFrom(raw: string | null): string {
  // Only ever redirect within the app — never follow an external URL from
  // the ?from= query param.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/account'
}

function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = destinationFrom(searchParams.get('from'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Don't render the login form (or redirect) until Firebase has reported
  // the current auth state, so an already-signed-in visitor never sees a
  // flash of the login screen first.
  if (loading) return null
  if (user) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <p className="auth-form__error">{error}</p>}

        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}

export default LoginPage
