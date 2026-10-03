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
        {/* OA-168 (revised): "Small changes. Bigger consequences." tested
            as brand-clever rather than literal -- a first-time visitor
            arriving with "prices are going up, should I stay, fix, or
            switch?" still had to decode what the product does before the
            headline answered it. Replaced with the user's own question,
            stated directly; the old headline isn't deleted, just moved
            further down the page (VisionPage.tsx) where a visitor who
            already understands the product can appreciate the framing.
            OA-171 (second revision): the subhead had over-corrected into a
            pure tariff-comparison pitch -- "would another tariff cost
            less?" -- which undersells the product's other half (what to
            run when, and whether a change actually paid off). Every
            public line here now has to answer "what could I change, when,
            or what it's worth" -- this subhead now names both halves:
            comparing tariffs against real usage, *and* finding cheaper
            times to run things, with the saving itself named as the
            payoff of both -- deliberately without jargon like "load
            shifting" or "optimisation". */}
        <h1 className="landing-hero__headline">See where you could save on your electricity bill.</h1>
        <p className="landing-hero__sub">
          We use your actual electricity use to compare tariffs, find things you could run at cheaper times, and
          show how much those changes could save you.
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
          Requires an Octopus Energy account · <Link to="/why-octopus">Why Octopus?</Link>
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
