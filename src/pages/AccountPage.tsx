import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useOctopusConnection } from '../octopus/OctopusConnectionContext'
import './AccountPage.css'

function AccountPage() {
  const { user } = useAuth()
  const { connection, loading } = useOctopusConnection()
  const connected = connection?.connected ?? false

  return (
    <section className="account-page">
      <div className="account-page__header">
        <div>
          <h1>Your account</h1>
          <p className="account-page__status">Signed in as {user?.email}</p>
        </div>
      </div>

      <div className="account-page__cards">
        <div className="account-page__card">
          <h2>Octopus account</h2>
          {loading ? (
            <p>Checking connection…</p>
          ) : connected ? (
            <>
              <p>
                Connected: <strong>{connection?.accountNumberRedacted}</strong>
              </p>
              <Link to="/connect-octopus" className="account-page__cta">
                Manage connection
              </Link>
            </>
          ) : (
            <>
              <p>Connect your Octopus Energy account to see where you could save.</p>
              <Link to="/connect-octopus" className="account-page__cta">
                Get started
              </Link>
            </>
          )}
        </div>

        <div className="account-page__card">
          <h2>Your savings</h2>
          {connected ? (
            <>
              <p>See your results based on your connected account.</p>
              <Link to="/savings" className="account-page__cta">
                See my savings
              </Link>
            </>
          ) : (
            <p>Nothing here yet — connect your account to see your results.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default AccountPage
