import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'

/**
 * OA-90: public "About" page -- the "Who we are" content that used to
 * sit in a large card on the landing page itself (see LandingPage.tsx
 * before this ticket). Moved here, not deleted. Copy is the landing
 * page's own previously-approved wording, reorganised into the ticket's
 * suggested section structure; the independence statement is kept
 * verbatim, as the ticket explicitly requires.
 */
function AboutPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="About Shift & Save">
        <h1 className="public-page__title">About Shift &amp; Save</h1>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" aria-label="Who we are">
          <h2>Who we are</h2>
          <p>
            Shift &amp; Save is an independent UK product built to make smart energy tariffs easier to
            understand and use.
          </p>
        </section>

        <section className="landing-card landing-about" aria-label="Why we built it">
          <h2>Why we built it</h2>
          <p>
            We started with a simple question: if cheaper electricity is available at different times of the
            day, why should ordinary households have to study 48 prices to benefit from it?
          </p>
        </section>

        <section className="landing-card landing-about" aria-label="What we believe">
          <h2>What we believe the product should make easier</h2>
          <p>
            So we built Shift &amp; Save to do the maths, make the options clear and help people decide what
            is actually worth doing.
          </p>
          <p className="landing-about__independence">
            <strong>Shift &amp; Save is independent of Octopus Energy.</strong>
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default AboutPage
