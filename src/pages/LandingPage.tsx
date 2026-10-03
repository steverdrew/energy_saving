import { Link } from 'react-router-dom'
import LandingDemo from '../components/LandingDemo'
import PublicFooter from '../components/PublicFooter'
import './LandingPage.css'

function LandingPage() {
  return (
    <>
      <section className="landing-hero" id="hero">
        {/* OA-87: the mockup is used for *design* here (three-line split,
            gradient/weight treatment per line, tight tracking) -- the
            product's own existing copy is kept verbatim, not replaced
            with the mockup's wording (Steve: "use the html for design
            only, not text/copy"). Split at the same natural phrase
            boundaries the mockup uses; the break before line 2 only
            applies at the `md`-equivalent breakpoint and up (see
            .landing-hero__break in LandingPage.css) -- below that, lines
            1-2 flow and wrap naturally as one phrase.
            Bugfix (linked to OA-87): the literal `{" "}` below is load-
            bearing -- below the breakpoint `.landing-hero__break` is
            `display:none`, which removes the <br> from the render
            entirely rather than just suppressing a line break, so
            without an explicit space here "of" and "when" concatenate
            into "ofwhen". */}
        <h1 className="landing-hero__headline">
          Take control of{' '}
          <br className="landing-hero__break" />
          <span className="landing-hero__line--gradient">when you use energy</span>
          <br />
          <span className="landing-hero__line--muted">— and what it costs you.</span>
        </h1>
        <p className="landing-hero__sub">
          Different tariffs suit different patterns of energy use. Shift
          &amp; Save shows what your <strong>actual usage</strong> would have cost on another
          tariff — and what better timing could change.
        </p>
        <Link to="/login" className="landing-hero__cta">
          See my last 30 days
        </Link>
      </section>

      <LandingDemo />

      {/* OA-90: the about/compatibility/who-we-are cards that used to sit
          here moved to their own public pages (HowItWorksPage.tsx,
          AboutPage.tsx) -- the landing page stays focused on Hero ->
          Comparison -> Sign up, with that supporting depth reachable via
          the shared nav/footer instead of interrupting this journey. */}
      <PublicFooter />
    </>
  )
}

export default LandingPage
