import { useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './LoginPage.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function destinationFrom(raw: string | null): string {
  // Only ever redirect within the app — never follow an external URL from
  // the ?from= query param.
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/account'
}

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address.'
  return null
}

/**
 * OA-88: polished to match the approved landing-page visual system --
 * dark/purple glass card (the surrounding colours/shell come from
 * App.tsx's shared [data-landing] attribute, now also applied on this
 * route, not a separate implementation here), "Welcome back" heading,
 * a Forgot-password flow, and designed inline validation.
 *
 * `noValidate` on both forms turns off the browser's native validation
 * bubbles -- every field is validated here instead, with inline error
 * text and aria-invalid/aria-describedby so the error reaches assistive
 * tech the same way a native bubble would, per the ticket's "inline
 * designed validation... keyboard/focus/error states are accessible".
 */
function LoginPage() {
  const { user, loading, login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = destinationFrom(searchParams.get('from'))

  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetEmailError, setResetEmailError] = useState<string | null>(null)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const emailErrorId = useId()
  const passwordErrorId = useId()
  const resetEmailErrorId = useId()

  // Don't render the login form (or redirect) until Firebase has reported
  // the current auth state, so an already-signed-in visitor never sees a
  // flash of the login screen first.
  if (loading) return null
  if (user) return <Navigate to={destination} replace />

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    const nextEmailError = validateEmail(email)
    const nextPasswordError = password ? null : 'Enter your password.'
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setFormError(null)
    if (nextEmailError || nextPasswordError) return

    setSubmitting(true)
    try {
      await login(email, password)
      navigate(destination, { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()
    const nextError = validateEmail(resetEmail)
    setResetEmailError(nextError)
    if (nextError) return

    setResetSubmitting(true)
    try {
      await resetPassword(resetEmail)
      setResetSent(true)
    } catch (err) {
      setResetEmailError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setResetSubmitting(false)
    }
  }

  function switchToReset() {
    setResetEmail(email)
    setResetEmailError(null)
    setResetSent(false)
    setMode('reset')
  }

  function switchToSignIn() {
    setMode('sign-in')
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        {mode === 'sign-in' ? (
          <>
            <h1 className="auth-card__title">Welcome back</h1>
            <p className="auth-card__subtitle">Sign in to see your actual usage and cost.</p>

            <form className="auth-form" onSubmit={handleSignIn} noValidate>
              <label className="auth-form__field">
                <span className="auth-form__label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? emailErrorId : undefined}
                  data-invalid={emailError ? true : undefined}
                />
                {emailError && (
                  <span id={emailErrorId} className="auth-form__field-error" role="alert">
                    {emailError}
                  </span>
                )}
              </label>

              <label className="auth-form__field">
                <span className="auth-form__label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? passwordErrorId : undefined}
                  data-invalid={passwordError ? true : undefined}
                />
                {passwordError && (
                  <span id={passwordErrorId} className="auth-form__field-error" role="alert">
                    {passwordError}
                  </span>
                )}
              </label>

              <button type="button" className="auth-form__forgot" onClick={switchToReset}>
                Forgot password?
              </button>

              {formError && (
                <p className="auth-form__error" role="alert">
                  {formError}
                </p>
              )}

              <button type="submit" className="auth-form__submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-card__title">Reset your password</h1>
            <p className="auth-card__subtitle">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            {resetSent ? (
              <>
                <p className="auth-form__confirmation" role="status">
                  If an account exists for that email, we&apos;ve sent a link to reset your password.
                </p>
                <button type="button" className="auth-form__back" onClick={switchToSignIn}>
                  Back to sign in
                </button>
              </>
            ) : (
              <form className="auth-form" onSubmit={handleReset} noValidate>
                <label className="auth-form__field">
                  <span className="auth-form__label">Email</span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoComplete="email"
                    aria-invalid={resetEmailError ? true : undefined}
                    aria-describedby={resetEmailError ? resetEmailErrorId : undefined}
                    data-invalid={resetEmailError ? true : undefined}
                  />
                  {resetEmailError && (
                    <span id={resetEmailErrorId} className="auth-form__field-error" role="alert">
                      {resetEmailError}
                    </span>
                  )}
                </label>

                <button type="submit" className="auth-form__submit" disabled={resetSubmitting}>
                  {resetSubmitting ? 'Sending…' : 'Send reset link'}
                </button>

                <button type="button" className="auth-form__back" onClick={switchToSignIn}>
                  Back to sign in
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default LoginPage
