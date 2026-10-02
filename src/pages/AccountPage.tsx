import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function AccountPage() {
  const { user, loading, logout, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (!user) return <Navigate to="/signup" replace />

  async function handleLogout() {
    await logout()
  }

  async function handleDelete() {
    setError(null)
    try {
      await deleteAccount()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
    }
  }

  return (
    <section>
      <h1>Your account</h1>
      <p>Signed in as {user.email}</p>

      <p>
        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </p>

      {!confirmingDelete ? (
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          Delete account
        </button>
      ) : (
        <div>
          <p>
            This permanently deletes your account. This can&rsquo;t be undone. Are you
            sure?
          </p>
          <button type="button" onClick={handleDelete}>
            Yes, delete my account
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
        </div>
      )}

      {error && <p>{error}</p>}
    </section>
  )
}

export default AccountPage
