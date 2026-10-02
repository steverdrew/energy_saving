import { Link } from 'react-router-dom'
import './ExplainerPage.css'

function ExplainerPage() {
  return (
    <article className="explainer">
      <h1>How smart tariffs work</h1>
      <p className="explainer__intro">
        You've probably heard Octopus has tariffs like Agile, Go and Intelligent Go.
        Here's what they actually do, in plain English — and what it means for you.
      </p>

      <section>
        <h2>The basic idea: price changes by time of day</h2>
        <p>
          On a normal tariff, electricity costs the same price whenever you use it. On a{' '}
          <strong>smart tariff</strong>, the price moves depending on when you use power —
          usually cheaper at quiet times, and more expensive at busy times.
        </p>
      </section>

      <section>
        <h2>The main smart tariffs</h2>
        <dl>
          <dt>Agile</dt>
          <dd>
            Prices change every half hour, and Octopus publishes the next day's prices in
            advance. It's the most detailed — and most changeable — of the three.
          </dd>
          <dt>Go</dt>
          <dd>
            A cheaper rate during one set window overnight, with normal pricing the rest of
            the day. Designed for people charging an electric car.
          </dd>
          <dt>Intelligent Go</dt>
          <dd>
            Works like Go, but can add extra cheap slots automatically when your EV charger
            tells Octopus you're charging, beyond the fixed overnight window.
          </dd>
        </dl>
      </section>

      <section>
        <h2>Why this can save you money — or not</h2>
        <p>
          If you can shift some of your electricity use to cheaper times — running a
          washing machine overnight, for example — a smart tariff can work out cheaper
          overall. But if most of your usage happens at expensive times of day and you
          can't move it, a smart tariff can end up costing <em>more</em> than a standard
          one. It depends entirely on your own household's pattern of use.
        </p>
      </section>

      <section>
        <h2>You don't need to study the prices yourself</h2>
        <p>
          That's what this app is for. Instead of asking you to track half-hourly prices,
          we look at your own historic usage and ask a simple question:{' '}
          <em>would a different tariff have been cheaper for you, based on what you
          actually used?</em> That's a much more reliable answer than a generic estimate.
        </p>
      </section>

      <section>
        <h2>Two different ways to save</h2>
        <p>There are two separate things you can do, and they're not the same:</p>
        <ul>
          <li>
            <strong>Switching tariff</strong> — moving to a tariff that suits your existing
            pattern of usage better, without changing anything about how you live.
          </li>
          <li>
            <strong>Changing when you use electricity</strong> — keeping your tariff, but
            shifting specific appliances (like a dishwasher or tumble dryer) to cheaper
            times to save more.
          </li>
        </ul>
      </section>

      <section>
        <h2>Sometimes the honest answer is "stay where you are"</h2>
        <p>
          We won't tell you to switch if switching wouldn't actually help. For some
          households, their current tariff is already the better fit — and that's a
          perfectly good outcome for us to tell you.
        </p>
      </section>

      <section>
        <Link to="/login" className="explainer__cta">
          Find my saving
        </Link>
      </section>
    </article>
  )
}

export default ExplainerPage
