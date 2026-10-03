import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'

/**
 * OA-93: placeholder public page -- the footer now links to Privacy per
 * the ticket's required link set, but no privacy policy content exists
 * in this codebase yet. Clearly labelled as not-yet-published rather
 * than inventing real legal/privacy copy, which isn't something to
 * fabricate.
 */
function PrivacyPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="Privacy">
        <h1 className="public-page__title">Privacy</h1>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" aria-label="Privacy policy">
          <p>Our full privacy policy is coming soon.</p>
          <p>
            In the meantime: your usage data stays private, and we never sell it. If you have a question about
            your data, <a href="mailto:hello@shiftandsaveapp.com">get in touch</a>.
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default PrivacyPage
