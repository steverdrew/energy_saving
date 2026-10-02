import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { BrandMark } from './components/Logo'
import { OctopusConnectionProvider } from './octopus/OctopusConnectionContext'
import AccountPage from './pages/AccountPage'
import ActualPage from './pages/ActualPage'
import ApplianceSetupPage from './pages/ApplianceSetupPage'
import ComparePage from './pages/ComparePage'
import CompatibilityFeedbackPage from './pages/CompatibilityFeedbackPage'
import ConnectOctopusPage from './pages/ConnectOctopusPage'
import DebugPage from './pages/DebugPage'
import ExplainerPage from './pages/ExplainerPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OptimisedPage from './pages/OptimisedPage'
import SavingsPage from './pages/SavingsPage'

// The marketing landing page is aimed at signed-out visitors (its only CTA
// is "sign in"). A signed-in user landing on "/" — e.g. from a bookmark —
// should see their actual account state instead, so send them to the page
// that already reflects it.
function HomeRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/account" replace />
  return <LandingPage />
}

function App() {
  const { user, loading, logout } = useAuth()

  return (
    <OctopusConnectionProvider>
      <div className="app-shell">
        <header className="app-header">
          <NavLink to="/" className="app-header__brand">
            <BrandMark />
          </NavLink>
          <nav className="app-header__nav">
            <NavLink to="/" end>
              Home
            </NavLink>
            {loading ? null : user ? (
              <>
                <NavLink to="/actual">Actual</NavLink>
                <NavLink to="/compare">Compare</NavLink>
                <NavLink to="/optimised">Optimised</NavLink>
                <NavLink to="/appliances">Appliances</NavLink>
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
            <Route path="/" element={<HomeRoute />} />
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
            <Route path="/tell-us-what-you-have" element={<CompatibilityFeedbackPage />} />
            <Route
              path="/actual"
              element={
                <ProtectedRoute>
                  <ActualPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compare"
              element={
                <ProtectedRoute>
                  <ComparePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/optimised"
              element={
                <ProtectedRoute>
                  <OptimisedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appliances"
              element={
                <ProtectedRoute>
                  <ApplianceSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/savings"
              element={
                <ProtectedRoute>
                  <SavingsPage />
                </ProtectedRoute>
              }
            />
            {/* OA-74: Cheapest Times is retired in favour of My Savings'
                Actual -> Like-for-like journey -- redirect rather than a
                dead link for anyone with the old URL bookmarked. */}
            <Route path="/cheapest-window" element={<Navigate to="/savings" replace />} />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </main>
      </div>
    </OctopusConnectionProvider>
  )
}

export default App
