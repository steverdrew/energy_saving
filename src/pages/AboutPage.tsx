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
 * independence line raised into its own callout (About.css) so it reads
 * as the page's trust statement rather than one more paragraph.
 *
 * OA-173 (copy rewrite): dropped "evidence-led" -- the ticket names it
 * directly as a stiff phrase to avoid where simpler wording works -- and
 * reworded the intro around the same fix/switch/stay decision the rest of
 * the public site now leads with, rather than "dynamic energy tariffs".
 * Reuses Vision's own "Sometimes the answer should be 'nothing'" line
 * verbatim in the trust panel, per the ticket's "pull a small number of
 * the strongest Vision ideas onto higher-traffic pages" instruction --
 * About, reachable from the header nav, gets far more traffic than Vision
 * itself.
 */
function AboutPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="About Shift & Save">
        <h1 className="public-page__title">About Shift &amp; Save</h1>
        <p className="public-page__intro">
          An independent product helping you work out whether fixing, switching or staying put is worth it —
          including when the honest answer is nothing.
        </p>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card about__lead" aria-label="Who we are">
          <h2>Who we are</h2>
          <p>
            Shift &amp; Save is an independent UK product that makes it easier to work out what, if anything,
            is worth changing about your electricity.
          </p>
        </section>

        <div className="about__grid">
          <section className="landing-card about__panel" aria-label="Why we built it">
            <h2>Why we built it</h2>
            <p>
              Cheaper electricity is often available at different times of day — but no one should have to
              study dozens of prices a day to benefit from it.
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
            guesswork. Sometimes the answer should be &ldquo;nothing&rdquo;, and we&rsquo;d rather tell you that
            than manufacture a reason for you to change.
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default AboutPage
