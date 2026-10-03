import PublicFooter from '../components/PublicFooter'
import '../styles/publicContent.css'
import './WhyOctopusPage.css'

/**
 * OA-169: "What is Octopus? / Why Octopus?" -- a dedicated, personal
 * origin-story page, matching the long-form editorial treatment
 * VisionPage.tsx (OA-151) and HowItWorksPage.tsx already use rather than
 * a dense feature-card grid. Deliberately human and transparent, not
 * affiliate- or partnership-shaped: every section traces back to "we use
 * Octopus ourselves, we like how open they are with customer data, and
 * that's what let us find real savings and build this" -- never "Octopus
 * is the best supplier" or a suggestion that visitors should switch to
 * them. The independence/non-endorsement statement is explicit, not left
 * implicit.
 *
 * OA-173 (copy rewrite): this page previously led with technical detail --
 * "half-hourly data", "developer tools" -- before saying plainly who it's
 * actually for. Added an explicit eligibility statement near the top (per
 * the ticket's "be explicit early... do not make visitors discover
 * eligibility only after reading multiple pages"), plus a short "Not on
 * Octopus?" section on what a non-Octopus visitor can still do here (the
 * homepage demo, which never required a real account). The personal "we
 * use it ourselves" rationale and the "Long may that continue" line are
 * kept verbatim -- the ticket's own "retain the personal rationale"
 * instruction -- only the surrounding technical framing is simplified and
 * moved lower down the page.
 */
function WhyOctopusPage() {
  return (
    <>
      <section className="landing-section-band" aria-label="Why Octopus">
        <h1 className="public-page__title">What is Octopus Energy — and why did we start there?</h1>
        <p className="public-page__intro">
          Shift &amp; Save currently works with Octopus Energy accounts. Octopus is also the electricity supplier
          we use ourselves — here&rsquo;s why that&rsquo;s where we started.
        </p>
      </section>

      <div className="landing-chapter-cta landing-section-band">
        <article className="why-octopus-prose">
          <h2>We use it ourselves</h2>
          <p>
            This didn&rsquo;t start as a supplier partnership. We&rsquo;re Octopus customers ourselves. Like most people, we
            originally just wanted to understand whether we were on the right tariff, and whether changing when we
            used electricity would actually make much difference.
          </p>
          <p>
            Once we started looking at our own usage and tariff information, we found real opportunities to save
            money — not huge, dramatic ones, but useful ones.
          </p>

          <h2>Not on Octopus?</h2>
          <p>
            You can still try the interactive example on the homepage and read how the comparison works — none of
            that needs a real account. Personalising it to your own bills currently needs an Octopus Energy
            account, since that&rsquo;s the only supplier we&rsquo;ve built and tested this against so far.
          </p>

          <h2>We like the open approach</h2>
          <p>
            One of the things we like most about Octopus is how openly it shares customer data — each customer can
            see their own detailed usage and tariff information, and Octopus provides developer tools that make it
            possible to build useful things on top of that. That openness is a big part of what made this product
            possible at all.
          </p>
          <p className="why-octopus-prose__quote">Long may that continue.</p>

          <h2>That openness exposed a bigger problem</h2>
          <p>
            Having access to the data isn&rsquo;t the same as making it understandable. The data was there. The harder
            part was working out what it actually meant.
          </p>
          <p>
            Was a different tariff genuinely cheaper for the way we used electricity? Was moving an appliance worth
            the inconvenience? Were we looking at a tariff saving, a timing saving, or simply avoiding waste?
          </p>
          <p>
            That gap — between having the data and knowing what to do with it — is what led to this product.
          </p>

          <h2>Why we start with Octopus</h2>
          <p>
            We start with Octopus because it gives its customers a practical route to their own detailed energy
            and tariff data. That makes it a good place to prove the product properly, using real household
            information rather than generic averages.
          </p>
          <p>
            We are not building an Octopus companion app. The longer-term principle is supplier-independent: help
            people understand which tariff structures and changes genuinely suit their household, whoever supplies
            them.
          </p>

          <h2>What we do differently</h2>
          <ul className="why-octopus-prose__list">
            <li>Compare using the same household usage — only the tariff or the timing changes, never both at once.</li>
            <li>Keep tariff, timing and waste effects separate, so nothing gets double-counted.</li>
            <li>Apply practical and safety constraints, not just the mathematically cheapest answer.</li>
            <li>Explain whether a figure is measured, inferred, modelled or verified.</li>
            <li>Allow the honest answer to be &ldquo;stay where you are&rdquo;.</li>
            <li>Have no commercial reason to push you toward a particular outcome.</li>
          </ul>

          <p className="why-octopus-prose__independence">
            Shift &amp; Save is an independent tool and is not affiliated with or endorsed by Octopus Energy.
          </p>
        </article>
      </div>

      <PublicFooter />
    </>
  )
}

export default WhyOctopusPage
