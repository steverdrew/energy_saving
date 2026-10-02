import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { BrandMark } from './components/Logo'
import LandingPage from './pages/LandingPage'

// OA-82: build-time-only entry point, never shipped to the browser.
// Renders the signed-out landing page (header chrome + LandingPage's own
// content/CTAs) to static HTML so `scripts/prerender.mjs` can inject it
// into dist/index.html. Deliberately skips AuthContext/Firebase -- the
// landing route it's standing in for is only ever shown signed-out (see
// App.tsx's HomeRoute), so "loading"/"signed in" states don't apply here.
export function renderLandingPage(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/']}>
      <div className="app-shell" data-landing="true">
        <header className="app-header">
          <a href="/" className="app-header__brand">
            <BrandMark />
          </a>
          <nav className="app-header__nav">
            <a href="/">Home</a>
            <a href="/login">Sign in</a>
          </nav>
        </header>
        <main className="app-main">
          <LandingPage />
        </main>
      </div>
    </MemoryRouter>,
  )
}
