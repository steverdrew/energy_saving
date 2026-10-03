import type { MouseEvent } from 'react'
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
        {/* OA-92: hero CTA starts the explanatory journey (Hero -> See how
            it works -> Interactive comparison -> Sign up free) -- an
            in-page jump to the comparison section below, not a route
            change. href="#comparison-demo" is the no-JS/keyboard-default
            fallback; handleSeeHowItWorksClick takes over for a real click
            to avoid the scroll container mismatch described there. */}
        <a href="#comparison-demo" className="landing-hero__cta" onClick={handleSeeHowItWorksClick}>
          See how it works
        </a>
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
