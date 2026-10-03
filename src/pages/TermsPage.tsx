import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'

/**
 * OA-93: placeholder public page -- see PrivacyPage.tsx's own comment;
 * same reasoning applies here (footer requires a Terms link, no terms
 * content exists yet, not something to fabricate).
 */
function TermsPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="Terms">
        <h1 className="public-page__title">Terms</h1>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" aria-label="Terms of service">
          <p>Our full terms of service are coming soon.</p>
          <p>
            Shift &amp; Save is currently in beta. If you have a question in the meantime,{' '}
            <a href="mailto:hello@shiftandsaveapp.com">get in touch</a>.
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default TermsPage
