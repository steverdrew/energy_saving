import { Link } from 'react-router-dom'
import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'
import './HowItWorksPage.css'

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
 * this detail remains reachable via the shared nav/footer.
 *
 * OA-93: the footer's standalone "How dynamic tariffs work" link
 * (-> ExplainerPage.tsx) is removed; its core idea is folded in here
 * instead as its own section, condensed from ExplainerPage's own
 * approved wording rather than duplicated wholesale. ExplainerPage
 * itself (route /how-smart-tariffs-work) still exists for the fuller
 * per-tariff breakdown (Agile/Go/Intelligent Go) -- linked from here,
 * not deleted, since nothing in OA-93 asks for that.
 *
 * OA-142: Phase One UI mockup pass -- the three core sections render as
 * a numbered step grid (HowItWorksPage.css) instead of a flat stack of
 * identical cards, with a CTA placed right after them. The dynamic-
 * tariffs and compatibility sections are kept (OA-93 content) but
 * visually de-emphasised below so the step grid stays the obvious focal
 * point.
 *
 * OA-173 (copy rewrite): this page previously opened with "dynamic
 * energy tariffs" and described product mechanics (tariff types,
 * timing) before any user outcome -- exactly the "tech-adjacent" voice
 * the ticket calls out, inconsistent with the homepage's plain, benefit-
 * led register. Rewritten outcomes-first, around the same canonical
 * fix/switch/stay persona the landing demo (OA-172) now uses: "your bill
 * now" -> "your options" -> "ways to save more", with the (now much
 * shorter) dynamic-tariff explanation moved down to the point it's
 * actually needed, not the opening line. "Smart tariff"/"dynamic
 * tariff" are still named once each, inside that explanation itself
 * (point-of-use, not the headline), per the ticket's "technical terms
 * explained only when unavoidable" rule.
 */
function HowItWorksPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="How Shift & Save works">
        <h1 className="public-page__title">How Shift &amp; Save works</h1>
        <p className="public-page__intro">
          We look at what you pay now, compare the options, and show what — if anything — is worth changing.
        </p>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <div className="how-it-works__steps">
          <section className="landing-card how-it-works__step" aria-label="Your bill now">
            <span className="how-it-works__step-badge" aria-hidden="true">
              1
            </span>
            <h2>Your bill now</h2>
            <p>
              We start with what you're actually paying — your real electricity use, not a generic estimate —
              so every comparison that follows is grounded in your own numbers.
            </p>
          </section>

          <section className="landing-card how-it-works__step" aria-label="Your options">
            <span className="how-it-works__step-badge" aria-hidden="true">
              2
            </span>
            <h2>Your options</h2>
            <p>
              Using that same usage, we show what fixing, switching tariff, or simply staying where you are
              would each actually have cost you — so you can see which one makes sense, including if that's
              doing nothing at all.
            </p>
          </section>

          <section className="landing-card how-it-works__step" aria-label="Ways to save more">
            <span className="how-it-works__step-badge" aria-hidden="true">
              3
            </span>
            <h2>Ways to save more</h2>
            <p>
              Once that's settled, we show whether a few small changes — like running the dishwasher or
              washing machine at a cheaper time — could save you a bit more. This part's always optional.
            </p>
          </section>
        </div>

        <p className="how-it-works__cta-row">
          <Link to="/login" className="how-it-works__cta">
            Sign up free
          </Link>
          <span className="how-it-works__cta-note">Connecting your account replaces this example with your own tariff and usage.</span>
        </p>

        <div className="how-it-works__secondary">
          <section className="landing-card landing-about" aria-label="Why timing can matter">
            <h2>Why timing can matter</h2>
            <p>
              On a standard tariff, electricity costs the same whatever time you use it. Some tariffs — Octopus
              calls theirs "smart" or "Agile" — charge a price that changes through the day instead, usually
              cheaper at quiet times and more expensive at busy ones. That's the only reason timing ever makes
              a difference, and it's entirely optional to use one.
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
      </div>

      <PublicFooter />
    </>
  )
}

export default HowItWorksPage
