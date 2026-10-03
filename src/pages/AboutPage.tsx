import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'
import './AboutPage.css'

/**
 * OA-90: public "About" page -- the "Who we are" content that used to
 * sit in a large card on the landing page itself (see LandingPage.tsx
 * before this ticket). Moved here, not deleted. Copy is the landing
 * page's own previously-approved wording, reorganised into the ticket's
 * suggested section structure; the independence statement is kept
 * verbatim, as the ticket explicitly requires.
 *
 * OA-145: polish pass to match How it works' (HowItWorksPage.tsx) visual
 * hierarchy -- intro line under the title, a single lead statement, a
 * "why/what" panel grid instead of three equal-weight cards, and the
 * independence/evidence-led line raised into its own callout (About.css)
 * so it reads as the page's trust statement rather than one more
 * paragraph. Copy is condensed per the ticket's "shorter sections,
 * stronger subheads" request -- same claims, no new ones.
 */
function AboutPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="About Shift & Save">
        <h1 className="public-page__title">About Shift &amp; Save</h1>
        <p className="public-page__intro">
          An independent, evidence-led product helping households get more from dynamic energy tariffs.
        </p>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card about__lead" aria-label="Who we are">
          <h2>Who we are</h2>
          <p>
            Shift &amp; Save is an independent UK product that makes dynamic energy tariffs easier to
            understand and use.
          </p>
        </section>

        <div className="about__grid">
          <section className="landing-card about__panel" aria-label="Why we built it">
            <h2>Why we built it</h2>
            <p>
              Cheaper electricity is often available at different times of day — but no one should have to
              study 48 prices a day to benefit from it.
            </p>
          </section>

          <section className="landing-card about__panel" aria-label="What we help you do">
            <h2>What we help you do</h2>
            <p>We do the maths, make the options clear, and help you decide what's actually worth doing.</p>
          </section>
        </div>

        <section className="about__trust" aria-label="Independence and approach">
          <p className="about__trust-statement">
            <strong>Shift &amp; Save is independent of Octopus Energy.</strong>
          </p>
          <p className="about__trust-note">
            Every comparison is based on your own real usage and published tariff prices — not estimates or
            guesswork.
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default AboutPage
