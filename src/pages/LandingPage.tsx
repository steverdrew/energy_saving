import { Link } from 'react-router-dom'
import './LandingPage.css'

const HOW_IT_WORKS = [
  {
    title: 'Connect',
    body: 'Link your Octopus Energy account in a couple of minutes.',
  },
  {
    title: 'See your saving',
    body: 'We look at your actual usage to show what a dynamic tariff would have cost you.',
  },
  {
    title: 'Make it easy',
    body: "We'll lay out the single highest-impact change to make first, in plain English — the move is always yours to make.",
  },
]

const TRUST_POINTS = [
  'Your usage stays private. We never sell your data.',
  'We never move your money or switch anything without your say.',
  'Built independently of Octopus Energy.',
]

// OA-55: only ever list something here once it's been tested end to end in
// the beta -- today that's Octopus Energy (tariff import) and manual
// appliance timers (the Cheapest Times guidance), presented as a real
// supported mode, not a fallback. No device/smart-plug integration exists
// yet (that's OA-12/OA-15, deliberately not started), so none is named.
const WORKS_WITH = ['Octopus Energy', 'Manual appliance timers']
const COMING_SOON = ['Smart plugs', 'More connected appliances']

function LandingPage() {
  return (
    <>
      <section className="landing-hero">
        <h1>Take control of when you use energy — and what it costs you.</h1>
        <p className="landing-hero__sub">
          Dynamic tariffs like Octopus Agile can cut your bills, but tracking
          half-hourly prices yourself is a hassle. Shift &amp; Save looks at
          your actual usage and makes a dynamic tariff easy to understand and
          act on.
        </p>
        <Link to="/login" className="landing-hero__cta">
          See what I could save
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

      <section className="landing-compat" aria-label="Compatibility">
        <div className="landing-compat__group">
          <h2>Works with</h2>
          <p>{WORKS_WITH.join(' · ')}</p>
        </div>
        <div className="landing-compat__group">
          <h2>Coming soon</h2>
          <p>{COMING_SOON.join(' · ')}</p>
        </div>
        <p className="landing-compat__cta">
          Use something else?{' '}
          <Link to="/tell-us-what-you-have">Tell us what you have.</Link>
        </p>
      </section>

      <p className="landing-explainer-link">
        <Link to="/how-smart-tariffs-work">How dynamic tariffs work</Link>
      </p>
    </>
  )
}

export default LandingPage
