import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import AccountPage from './pages/AccountPage'
import ExplainerPage from './pages/ExplainerPage'
import LandingPage from './pages/LandingPage'
import SavingsPage from './pages/SavingsPage'
import SignupPage from './pages/SignupPage'

function App() {
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
          <NavLink to="/signup">Sign up</NavLink>
          <NavLink to="/savings">My Savings</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/how-smart-tariffs-work" element={<ExplainerPage />} />
          <Route path="/savings" element={<SavingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
