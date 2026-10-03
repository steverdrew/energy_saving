import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import LandingDemo from '../components/LandingDemo'
import PublicFooter from '../components/PublicFooter'
import './LandingPage.css'

/**
 * OA-92 (fix): `.app-shell[data-landing]` is itself the scrolling
 * container, not `window` -- its `overflow-x: hidden` (App.css) forces
 * `overflow-y: auto` per the CSS spec ("if one of overflow-x/-y is
 * visible and the other isn't, the visible one computes to auto"). A
 * plain `<a href="#comparison-demo">` relying on the browser's native
 * fragment-scroll plus `tabIndex={-1}`'s implicit focus-scroll actually
 * triggered two separate scrolls that landed ~60px (exactly the sticky
 * header's height) past the section's top, hiding its eyebrow line
 * under the header instead of revealing it below. Handling the click
 * directly removes that ambiguity: one scrollIntoView call against
 * whichever element the target actually sits in, then focus with
 * `preventScroll` so moving keyboard/AT focus there can't trigger a
 * second, uncoordinated scroll.
 */
function handleSeeHowItWorksClick(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('comparison-demo')
  if (!target) return
  event.preventDefault()

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
  target.focus({ preventScroll: true })
}

function LandingPage() {
  return (
    <>
      <section className="landing-hero" id="hero">
        {/* OA-168: replaces OA-111's "Hunt the energy vampires in your
            home" hook -- that framing was too narrow (it only spoke to
            waste detection), while the product is now about tariff
            comparison, practical timing optimisation, waste, neutral
            recommendations, and "do nothing" being a genuine valid
            answer. The new headline is the exact copy already used as
            VisionPage's own title (OA-151) -- the hero and the vision
            page now open with the same statement rather than two
            competing ones. The vampire phrase itself isn't deleted: it's
            repositioned as the waste section's own heading (see
            VisionPage.tsx's "energy vampires" section). No gradient
            emphasis on any one word here -- unlike "energy vampires",
            there's no single phrase this headline is built to spotlight. */}
        <h1 className="landing-hero__headline">Small changes. Bigger consequences.</h1>
        <p className="landing-hero__sub">
          See what your electricity is costing you, whether another tariff would suit you better, and what — if
          anything — is actually worth changing.
        </p>
        <div className="landing-hero__ctas">
          {/* OA-92: hero CTA starts the explanatory journey (Hero -> See
              how it works -> Interactive comparison -> Sign up free) --
              an in-page jump to the comparison section below, not a
              route change. href="#comparison-demo" is the no-JS/keyboard-
              default fallback; handleSeeHowItWorksClick takes over for a
              real click to avoid the scroll container mismatch described
              there. */}
          <a href="#comparison-demo" className="landing-hero__cta" onClick={handleSeeHowItWorksClick}>
            See how it works
          </a>
        </div>
        {/* OA-171: sets the account expectation right under the CTA so
            visitors aren't surprised by it during onboarding, without
            cluttering the hero with the Smart tariff / smart meter
            detail -- that stays in onboarding where it's actionable. */}
        <p className="landing-hero__requirement">
          Requires an Octopus Energy account · <Link to="/why-octopus">Learn more</Link>
        </p>
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
