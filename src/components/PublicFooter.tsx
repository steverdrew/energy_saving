import { Link } from 'react-router-dom'
import './PublicFooter.css'

/**
 * OA-90/OA-93: shared footer for the public site (Home/How it
 * works/About/Privacy/Terms/Contact).
 *
 * OA-93: simplified to a primarily navigational close -- the three
 * oversized trust statements ("Your usage stays private...", "We never
 * move your money...", "Built independently of Octopus Energy.") and
 * the standalone "How dynamic tariffs work" link are removed (the
 * independence statement already lives on AboutPage.tsx; the privacy/
 * control reassurances belong where account connection is actually
 * explained, not a landing-page footer; the tariff explainer content is
 * folded into HowItWorksPage.tsx instead of linked separately). What's
 * left is a simple link row plus one subdued closing line, so the page
 * reads as ending, not continuing into another content section.
 */
function PublicFooter() {
  return (
    <footer className="landing-footer landing-section-band" id="footer">
      <nav className="landing-footer__links" aria-label="More about Shift & Save">
        <Link to="/how-it-works">How it works</Link>
        <Link to="/vision">Vision</Link>
        <Link to="/about">About</Link>
        <Link to="/why-octopus">Why Octopus?</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
      </nav>

      <p className="landing-footer__closing">Shift &amp; Save — independent of Octopus Energy.</p>
    </footer>
  )
}

export default PublicFooter
