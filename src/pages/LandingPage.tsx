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
        {/* OA-111: testing "Hunt the energy vampires in your home." as the
            primary hook while the product/app name is still being
            decided -- a memorable problem statement, not the whole
            product identity. "energy vampires" gets the existing
            gradient treatment (reused from OA-87's design system, not a
            new vampire-themed style) so it reads as the one emphasised
            phrase; the rest of the headline and the subhead stay plain,
            credible copy with no further vampire/fang/Halloween
            language, per the ticket's guardrails. Doesn't reference
            "Shift & Save" by name, so this copy still works if the final
            app name changes later. */}
        <h1 className="landing-hero__headline">
          Hunt the <span className="landing-hero__line--gradient">energy vampires</span> in your home.
        </h1>
        <p className="landing-hero__sub">
          See where your electricity goes, what&rsquo;s costing you, and what you could save by changing when you use
          it.
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
