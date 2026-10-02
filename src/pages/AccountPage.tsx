import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './AccountPage.css'

function AccountPage() {
  const { user, logout } = useAuth()

  return (
    <section className="account-page">
      <div className="account-page__header">
        <div>
          <h1>Your account</h1>
          <p className="account-page__status">Signed in as {user?.email}</p>
        </div>
        <button type="button" className="account-page__signout" onClick={() => logout()}>
          Sign out
        </button>
      </div>

      <div className="account-page__cards">
        <div className="account-page__card">
          <h2>Find my saving</h2>
          <p>Connect your Octopus Energy account to see where you could save.</p>
          <Link to="/savings" className="account-page__cta">
            Get started
          </Link>
        </div>

        <div className="account-page__card">
          <h2>Your savings</h2>
          <p>Nothing here yet — connect your account to see your results.</p>
        </div>
      </div>
    </section>
  )
}

export default AccountPage
