import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import AccountPage from './pages/AccountPage'
import DebugPage from './pages/DebugPage'
import ExplainerPage from './pages/ExplainerPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SavingsPage from './pages/SavingsPage'

function App() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="app-header__brand">
          Octopus Agent
        </NavLink>
        <nav className="app-header__nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/savings">My Savings</NavLink>
          {loading ? null : user ? (
            <>
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
          <Route path="/how-smart-tariffs-work" element={<ExplainerPage />} />
          <Route path="/savings" element={<SavingsPage />} />
          <Route path="/debug" element={<DebugPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
