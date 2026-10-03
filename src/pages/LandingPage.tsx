import { Link } from 'react-router-dom'
import LandingDemo from '../components/LandingDemo'
import './LandingPage.css'

const TRUST_POINTS = [
  'Your usage stays private. We never sell your data.',
  'We never move your money or switch anything without your say.',
  'Built independently of Octopus Energy.',
]

// OA-55: only ever list something here once it's been tested end to end in
// the beta -- today that's Octopus Energy (tariff import, actual usage and
// cost, like-for-like tariff comparison). OA-74 retired the standalone
// Cheapest Times page (manual appliance timer guidance) in favour of the
// Actual/Compare journey, so it's no longer named here either. No
// device/smart-plug integration exists yet (that's OA-12/OA-15,
// deliberately not started), so none is named.
const WORKS_WITH = ['Octopus Energy accounts']
const COMING_SOON = ['Smart plugs', 'More connected appliances']

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

      {/* OA-87: "Hero -> understand the idea, Comparison -> see it work,
          CTA -> act on it, Footer -> close" -- this chapter groups the
          existing about/compatibility/who-we-are content under one
          cleaner, darker band (the mockup's own CTA-section tone) so it
          reads as the page's next chapter after the comparison, not a
          continuation of the same surface. Individual section ids/
          aria-labels (used by OA-82's automation-friendliness work)
          are unchanged -- this only adds a shared background wrapper. */}
      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" id="about" aria-label="What is Shift & Save?">
          <h2>What is Shift &amp; Save?</h2>
          <p>
            Shift &amp; Save helps you get more from dynamic energy tariffs without having to watch
            electricity prices all day.
          </p>
          <p>
            We look at your real energy use, compare it against a different tariff — same usage,
            same times — and show what better timing could change too.
          </p>
          <p>You stay in control. We make the complicated bit simple.</p>
        </section>

        <section className="landing-card landing-compat" id="compatibility" aria-label="Compatibility">
          <div className="landing-compat__group">
            <h2>Currently supports</h2>
            <p>{WORKS_WITH.join(' · ')}</p>
          </div>
          <div className="landing-compat__group">
            <h2>Coming soon</h2>
            <p>{COMING_SOON.join(' · ')}</p>
          </div>
          <p className="landing-compat__cta">
            Use something else?{' '}
            <Link to="/tell-us-what-you-have">Tell us what you have.</Link>
          </p>
        </section>

        <section className="landing-card landing-about" id="who-we-are" aria-label="Who we are">
          <h2>Who we are</h2>
          <p>
            Shift &amp; Save is an independent UK product built to make smart energy tariffs easier to
            understand and use.
          </p>
          <p>
            We started with a simple question: if cheaper electricity is available at different times
            of the day, why should ordinary households have to study 48 prices to benefit from it?
          </p>
          <p>
            So we built Shift &amp; Save to do the maths, make the options clear and help people decide
            what is actually worth doing.
          </p>
          <p className="landing-about__independence">
            <strong>Shift &amp; Save is independent of Octopus Energy.</strong>
          </p>
        </section>
      </div>

      <footer className="landing-footer landing-section-band" id="footer">
        <div className="landing-trust" aria-label="Why trust us">
          {TRUST_POINTS.map((point) => (
            <p className="landing-trust__item" key={point}>
              {point}
            </p>
          ))}
        </div>

        <p className="landing-explainer-link">
          <Link to="/how-smart-tariffs-work">How dynamic tariffs work</Link>
        </p>
      </footer>
    </>
  )
}

export default LandingPage
