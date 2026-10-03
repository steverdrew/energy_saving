import { Link } from 'react-router-dom'
import './PublicFooter.css'

const TRUST_POINTS = [
  'Your usage stays private. We never sell your data.',
  'We never move your money or switch anything without your say.',
  'Built independently of Octopus Energy.',
]

/**
 * OA-90: shared footer for the public site (Home/How it works/About) --
 * previously inlined in LandingPage.tsx only. Pulled out into its own
 * component so the new How it works/About pages can reuse the same
 * trust points and public-page links rather than duplicating them, per
 * the ticket's "shared footer" requirement.
 */
function PublicFooter() {
  return (
    <footer className="landing-footer landing-section-band" id="footer">
      <div className="landing-trust" aria-label="Why trust us">
        {TRUST_POINTS.map((point) => (
          <p className="landing-trust__item" key={point}>
            {point}
          </p>
        ))}
      </div>

      <nav className="landing-footer__links" aria-label="More about Shift & Save">
        <Link to="/how-it-works">How it works</Link>
        <Link to="/about">About</Link>
        <Link to="/how-smart-tariffs-work">How dynamic tariffs work</Link>
      </nav>
    </footer>
  )
}

export default PublicFooter
