import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import { BrandMark } from './components/Logo'
import { OctopusConnectionProvider } from './octopus/OctopusConnectionContext'
import AboutPage from './pages/AboutPage'
import AccountPage from './pages/AccountPage'
import ActualPage from './pages/ActualPage'
import ApplianceSetupPage from './pages/ApplianceSetupPage'
import ComparePage from './pages/ComparePage'
import CompatibilityFeedbackPage from './pages/CompatibilityFeedbackPage'
import ConnectOctopusPage from './pages/ConnectOctopusPage'
import ContactPage from './pages/ContactPage'
import DebugPage from './pages/DebugPage'
import ExplainerPage from './pages/ExplainerPage'
import HowItWorksPage from './pages/HowItWorksPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OptimisedPage from './pages/OptimisedPage'
import PrivacyPage from './pages/PrivacyPage'
import SavingsPage from './pages/SavingsPage'
import TermsPage from './pages/TermsPage'

// OA-93: Privacy/Terms/Contact are footer-only links (not top nav) --
// still public/dark-shelled pages, so included here for isPublicSiteRoute
// below, but deliberately not added to the header nav's link list.
const PUBLIC_SITE_PATHS = ['/', '/login', '/how-it-works', '/about', '/privacy', '/terms', '/contact']

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
  const location = useLocation()
  // OA-79/OA-88/OA-90: the dark/purple visual system (and the wider
  // public-site shell width, see App.css) is scoped to the logged-out
  // "public site" routes -- Home, Sign in, How it works, About -- not the
  // authenticated app, which keeps its existing light theme/narrower
  // shell untouched. OA-88 explicitly requires these routes to share one
  // nav/shell rather than each maintaining its own lookalike version, so
  // all are covered by the same flag/attribute here instead of separate
  // checks per route. A signed-in user visiting How it works/About still
  // gets their normal authenticated nav/theme -- these are marketing
  // pages aimed at prospective users, not account-area content.
  const isPublicSiteRoute = !loading && !user && PUBLIC_SITE_PATHS.includes(location.pathname)

  return (
    <OctopusConnectionProvider>
      <div className="app-shell" data-landing={isPublicSiteRoute || undefined}>
        <header className="app-header">
          <div className="app-header__inner">
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
                <>
                  <NavLink to="/how-it-works">How it works</NavLink>
                  <NavLink to="/about">About</NavLink>
                  <NavLink to="/login">Sign in</NavLink>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
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
