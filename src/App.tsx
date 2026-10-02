import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { OctopusConnectionProvider } from './octopus/OctopusConnectionContext'
import AccountPage from './pages/AccountPage'
import ConnectOctopusPage from './pages/ConnectOctopusPage'
import DebugPage from './pages/DebugPage'
import ExplainerPage from './pages/ExplainerPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SavingsPage from './pages/SavingsPage'

function App() {
  const { user, loading, logout } = useAuth()

  return (
    <OctopusConnectionProvider>
      <div className="app-shell">
        <header className="app-header">
          <NavLink to="/" className="app-header__brand">
            Shift &amp; Save
          </NavLink>
          <nav className="app-header__nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            {loading ? null : user ? (
              <>
                <NavLink to="/savings">My Savings</NavLink>
                <NavLink to="/account">Account</NavLink>
                <button type="button" className="app-header__signout" onClick={() => logout()}>
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login">Sign in</NavLink>
            )}
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect-octopus"
              element={
                <ProtectedRoute>
                  <ConnectOctopusPage />
                </ProtectedRoute>
              }
            />
            <Route path="/how-smart-tariffs-work" element={<ExplainerPage />} />
            <Route
              path="/savings"
              element={
                <ProtectedRoute>
                  <SavingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </main>
      </div>
    </OctopusConnectionProvider>
  )
}

export default App
