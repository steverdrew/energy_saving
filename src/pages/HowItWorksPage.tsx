import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'

// OA-55: only ever list something here once it's been tested end to end in
// the beta -- today that's Octopus Energy (tariff import, actual usage and
// cost, like-for-like tariff comparison). No device/smart-plug integration
// exists yet (that's OA-12/OA-15, deliberately not started), so none is
// named. Kept in sync with LandingPage's own copy of this list.
const WORKS_WITH = ['Octopus Energy accounts']
const COMING_SOON = ['Smart plugs', 'More connected appliances']

/**
 * OA-90/OA-93: public "How it works" page -- the supporting product
 * content that used to sit in a large card on the landing page itself
 * (see LandingPage.tsx before OA-90). Moved here, not deleted, so the
 * landing page can stay focused on Hero -> Comparison -> Sign up while
 * this detail remains reachable via the shared nav/footer. Copy is the
 * landing page's own previously-approved wording, reorganised into the
 * ticket's suggested section structure -- no new product claims.
 *
 * OA-93: the footer's standalone "How dynamic tariffs work" link
 * (-> ExplainerPage.tsx) is removed; its core idea is folded in here
 * instead as its own section, condensed from ExplainerPage's own
 * approved wording rather than duplicated wholesale. ExplainerPage
 * itself (route /how-smart-tariffs-work) still exists for the fuller
 * per-tariff breakdown (Agile/Go/Intelligent Go) -- linked from here,
 * not deleted, since nothing in OA-93 asks for that.
 */
function HowItWorksPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="How Shift & Save works">
        <h1 className="public-page__title">How Shift &amp; Save works</h1>
        <p className="public-page__intro">
          Here's what the product actually does, and how it uses your own energy data to find a saving.
        </p>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" aria-label="What Shift & Save does">
          <h2>What Shift &amp; Save does</h2>
          <p>
            Shift &amp; Save helps you get more from dynamic energy tariffs without having to watch electricity
            prices all day. You stay in control — we make the complicated bit simple.
          </p>
        </section>

        <section className="landing-card landing-about" aria-label="Same usage, different tariff">
          <h2>Same usage, different tariff</h2>
          <p>
            We look at your real energy use and compare it against a different tariff — same usage, same
            times — so you can see what another tariff would actually have cost you, not a generic estimate.
          </p>
        </section>

        <section className="landing-card landing-about" aria-label="Better timing">
          <h2>Better timing</h2>
          <p>
            Beyond switching tariff, we also show what better timing could change too — moving flexible usage
            (like a dishwasher or washing machine) to cheaper times, without changing your total energy use.
          </p>
        </section>

        <section className="landing-card landing-about" aria-label="How dynamic tariffs work">
          <h2>How dynamic tariffs work</h2>
          <p>
            On a normal tariff, electricity costs the same price whenever you use it. On a dynamic tariff
            like Octopus Agile, the price moves depending on when you use power — usually cheaper at quiet
            times, and more expensive at busy times. That's what makes timing matter.
          </p>
          <p>
            <Link to="/how-smart-tariffs-work">More on how Agile, Go and Intelligent Go work.</Link>
          </p>
        </section>

        <section className="landing-card landing-compat" aria-label="Compatibility">
          <div className="landing-compat__group">
            <h2>Currently supports</h2>
            <p>{WORKS_WITH.join(' · ')}</p>
          </div>
          <div className="landing-compat__group">
            <h2>Coming soon</h2>
            <p>{COMING_SOON.join(' · ')}</p>
          </div>
          <p className="landing-compat__cta">
            Use something else? <Link to="/tell-us-what-you-have">Tell us what you have.</Link>
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default HowItWorksPage
