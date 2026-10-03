import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildLandingDemoFixture,
  LANDING_DEMO_DATA_SOURCES,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
  type LandingDemoFixture,
} from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import LandingTimeProfile from './LandingTimeProfile'
import './LandingDemo.css'

// OA-99: shown on every tab, identically -- the headline £ figure is
// usage cost only, never silently mixed with the daily standing charge
// (which doesn't vary by tariff or usage timing, so folding it in would
// blur the tariff/timing comparison this demo exists to show).
const COST_BASIS_NOTE = `Figures show usage cost only — excludes the ${formatGbp(OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY)}/day standing charge.`

type DemoStepId = 'baseline' | 'compare' | 'optimise'

const STEP_ORDER: DemoStepId[] = ['baseline', 'compare', 'optimise']

const STEP_TAB_LABELS: Record<DemoStepId, string> = {
  baseline: '1. Baseline',
  compare: '2. Compare tariff',
  optimise: '3. Optimise timing',
}

// OA-95/98: the state heading reads as a plain consumer statement, not
// diagnostic/technical wording like "1. BASELINE -- STANDARD VARIABLE
// (EXAMPLE DATA)".
const STEP_HEADINGS: Record<DemoStepId, string> = {
  baseline: 'Your current setup',
  compare: 'Same usage, different tariff',
  optimise: 'Same tariff, better timing',
}

// OA-101: the reference tariff is named explicitly ("£0.09 less than
// Standard Variable"), not left implicit as it was when this sat next to
// a baseline figure the reader had to remember from the previous tab.
function describeDifference(pence: number, moreLabel: string, lessLabel: string, referenceTariffName: string): string {
  if (pence > 0) return `${formatGbp(pence)} ${lessLabel} than ${referenceTariffName}`
  if (pence < 0) return `${formatGbp(-pence)} ${moreLabel} than ${referenceTariffName}`
  return `no different from ${referenceTariffName}`
}

function describeTimingPotential(pence: number): string {
  if (pence > 0) return `+ ${formatGbp(pence)} potential`
  if (pence < 0) return `${formatGbp(-pence)} more`
  return 'no further difference'
}

/**
 * OA-77/OA-80/OA-83: logged-out, interactive Baseline -> Compare tariff ->
 * Optimise timing walkthrough. All figures come from
 * `buildLandingDemoFixture` -- fixture data only, never a real
 * household's usage. The segmented control behaves as a standard ARIA
 * tablist (roving tabindex, arrow-key navigation) so it's usable by
 * keyboard as well as click/tap.
 *
 * OA-85/86: multi-day fixture (colour = cheap/standard/peak, opacity =
 * usage) -- see landingDemoFixture's `days`.
 *
 * OA-89: the visual is `<LandingTimeProfile>`, a continuous price-
 * landscape + usage-bar time profile. See LandingTimeProfile.tsx's own
 * comment for the full rationale.
 *
 * OA-98: there is no longer a separate narrative column here -- each
 * step's heading/summary/explanation/caveat is handed to
 * `<LandingTimeProfile>` as props and rendered *inside* the same card as
 * the chart, above it, so the comparison reads as one component changing
 * state rather than a text block beside a chart card. `<LandingTimeProfile>`
 * itself stays mounted across step changes (only its narrative block
 * remounts via `stepKey`) so the chart's own background-colour/path
 * transitions keep interpolating -- see that component's doc comment.
 */
function LandingDemo() {
  const [step, setStep] = useState<DemoStepId>('baseline')
  const fixture: LandingDemoFixture = useMemo(() => buildLandingDemoFixture(), [])
  const current = fixture[step]
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function selectStep(index: number) {
    const clamped = (index + STEP_ORDER.length) % STEP_ORDER.length
    setStep(STEP_ORDER[clamped])
    tabRefs.current[clamped]?.focus()
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      selectStep(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      selectStep(index - 1)
    }
  }

  let summary: React.ReactNode
  let explanation: string
  let caveat: string | undefined

  if (step === 'baseline') {
    summary = (
      <>
        {fixture.baseline.tariffName} · <strong>{fixture.baseline.totalKwh.toFixed(1)} kWh</strong> ·{' '}
        <strong>{formatGbp(fixture.baseline.totalCostPence)}</strong>
      </>
    )
    explanation = 'This is the baseline — exactly when energy gets used, half hour by half hour.'
  } else if (step === 'compare') {
    summary = (
      // OA-101: two-line hierarchy -- tariff + price, then the
      // difference named against the specific reference tariff it's
      // being compared to -- replacing the earlier compressed single
      // line ("Octopus Agile · £1.72 · £0.09 less") the ticket called out.
      <>
        {fixture.compare.tariffName} · <strong>{formatGbp(fixture.compare.totalCostPence)}</strong>
        <br />
        <strong className="landing-time-profile__summary-diff">
          {describeDifference(fixture.tariffSwitchSavingPence, 'more', 'less', fixture.baseline.tariffName)}
        </strong>
      </>
    )
    explanation = 'Only the tariff changes — usage stays exactly the same.'
    caveat = 'One example comparison, not a guarantee — which tariff costs less depends on your own usage pattern.'
  } else {
    summary = (
      <>
        {fixture.compare.tariffName} · <strong>{formatGbp(fixture.optimise.totalCostPence)}</strong> ·{' '}
        <strong className="landing-time-profile__summary-diff">
          {describeTimingPotential(fixture.timingSavingPence)}
        </strong>
      </>
    )
    explanation = 'Only flexible usage moves; total energy stays the same.'
    caveat =
      "Illustrative example only. We're not saying your home has this appliance, or that you could achieve this saving."
  }

  return (
    // OA-92: the hero's "See how it works" CTA jumps here (#comparison-
    // demo) -- tabIndex={-1} makes the section programmatically
    // focusable (sections aren't by default) so LandingPage.tsx's click
    // handler can call .focus({preventScroll: true}) on it after
    // scrolling, "ensuring the comparison lands clearly in view" without
    // triggering a second, uncoordinated scroll (see that handler's own
    // comment for why a second scroll was the actual bug).
    <section
      className="landing-demo landing-section-band"
      id="comparison-demo"
      aria-label="Interactive example: how Shift & Save works"
      data-active-step={step}
      tabIndex={-1}
    >
      {/* OA-99/OA-100: "Typical household" is the section's one real
          heading (promoted from a quiet all-caps eyebrow in OA-100, once
          it started competing with Tab 1's own "Your current setup"
          heading -- removed, see LandingTimeProfile.tsx) -- the figures
          are grounded in published Ofgem/Elexon/Octopus data (see
          landingDemoFixture.ts's LANDING_DEMO_DATA_SOURCES) rather than
          invented numbers, but it's still not the visitor's own usage
          until they connect an account (see the CTA note below). */}
      <div className="landing-demo__heading-row">
        <h2 className="landing-demo__heading">Typical household</h2>
        <details className="landing-demo__sources">
          <summary>Based on Ofgem and Elexon data — not your own usage · Sources</summary>
          <ul>
            <li>
              <a href={LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemTdcv} target="_blank" rel="noreferrer">
                Ofgem — typical domestic consumption values (2026 decision)
              </a>
            </li>
            <li>
              <a href={LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemPriceCap} target="_blank" rel="noreferrer">
                Ofgem — energy price cap, October–December 2026
              </a>
            </li>
            <li>
              <a href={LANDING_DEMO_DATA_SOURCES.sourceUrls.elexonProfiling} target="_blank" rel="noreferrer">
                Elexon — domestic half-hourly load profiling
              </a>
            </li>
            <li>
              <a href={LANDING_DEMO_DATA_SOURCES.sourceUrls.octopusAgileApi} target="_blank" rel="noreferrer">
                Octopus Energy — Agile tariff rates (API)
              </a>
            </li>
          </ul>
        </details>
      </div>

      <div className="landing-demo__tabs" role="tablist" aria-label="Demo steps">
        {STEP_ORDER.map((id, index) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            id={`landing-demo-tab-${id}`}
            aria-selected={step === id}
            aria-controls={`landing-demo-panel-${id}`}
            tabIndex={step === id ? 0 : -1}
            className="landing-demo__tab"
            data-active={step === id || undefined}
            onClick={() => setStep(id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {STEP_TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div
        className="landing-demo__panel"
        role="tabpanel"
        id={`landing-demo-panel-${step}`}
        aria-labelledby={`landing-demo-tab-${step}`}
      >
        <LandingTimeProfile
          day={current.day}
          heading={STEP_HEADINGS[step]}
          summary={summary}
          explanation={explanation}
          costNote={COST_BASIS_NOTE}
          caveat={caveat}
          stepKey={step}
        />
      </div>

      {/* OA-92: the post-comparison conversion CTA -- "Sign up free",
          never "last 30 days" wording. Still routes to /login: there is
          no dedicated signup flow yet (AuthContext only has
          login/resetPassword), so this reuses the existing sign-in/
          account-creation entry point, matching OA-92's scope of fixing
          CTA copy/behaviour rather than building new auth. */}
      <p className="landing-demo__cta">
        <Link to="/login" className="landing-demo__cta-link">
          Sign up free
        </Link>
        <span className="landing-demo__cta-note">
          Connecting your account replaces this example with your own tariff and half-hourly usage.
        </span>
      </p>
    </section>
  )
}

export default LandingDemo
