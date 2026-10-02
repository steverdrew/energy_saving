import { Link } from 'react-router-dom'
import './LandingPage.css'

const HOW_IT_WORKS = [
  {
    title: 'Connect',
    body: 'Link your Octopus Energy account in a couple of minutes.',
  },
  {
    title: 'See your saving',
    body: 'We look at your actual usage and tariff to find real opportunities.',
  },
  {
    title: 'Do one thing',
    body: "We'll tell you the single highest-impact change to make first.",
  },
]

const TRUST_POINTS = [
  'We never move your money or switch anything without your say.',
  'Your account details are encrypted and never shared.',
  'Built independently of Octopus Energy.',
]

function LandingPage() {
  return (
    <>
      <section className="landing-hero">
        <h1>Take your energy bills into your own hands.</h1>
        <p className="landing-hero__sub">
          Find out how much you could save on Octopus, and how to do it.
        </p>
        <Link to="/login" className="landing-hero__cta">
          Find my saving
        </Link>
      </section>

      <section className="landing-how" aria-label="How it works">
        {HOW_IT_WORKS.map((step, index) => (
          <div className="landing-how__step" key={step.title}>
            <h2>
              {index + 1}. {step.title}
            </h2>
            <p>{step.body}</p>
          </div>
        ))}
      </section>

      <section className="landing-trust" aria-label="Why trust us">
        {TRUST_POINTS.map((point) => (
          <p className="landing-trust__item" key={point}>
            {point}
          </p>
        ))}
      </section>

      <p className="landing-explainer-link">
        New to Agile, Go or Intelligent Go?{' '}
        <Link to="/how-smart-tariffs-work">See how smart tariffs work</Link>.
      </p>
    </>
  )
}

export default LandingPage
