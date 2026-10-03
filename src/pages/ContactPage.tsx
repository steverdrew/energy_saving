import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'

/**
 * OA-93: placeholder public page -- see PrivacyPage.tsx's own comment.
 * Contact is the simplest of the three: just a real way to reach us.
 */
function ContactPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="Contact">
        <h1 className="public-page__title">Contact</h1>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <section className="landing-card landing-about" aria-label="Get in touch">
          <p>
            Questions, feedback or something not working?{' '}
            <a href="mailto:hello@shiftandsaveapp.com">hello@shiftandsaveapp.com</a>
          </p>
        </section>
      </div>

      <PublicFooter />
    </>
  )
}

export default ContactPage
