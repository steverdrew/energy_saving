import { useAuth } from '../auth/AuthContext'

function AccountPage() {
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
  }

  return (
    <section>
      <h1>Your account</h1>
      <p>Signed in as {user?.email}</p>

      <p>
        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </p>
    </section>
  )
}

export default AccountPage
