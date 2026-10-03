import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLandingDemoFixture, type LandingDemoFixture } from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import LandingTimeProfile from './LandingTimeProfile'
import './LandingDemo.css'

type DemoStepId = 'baseline' | 'compare' | 'optimise'

const STEP_ORDER: DemoStepId[] = ['baseline', 'compare', 'optimise']

const STEP_TAB_LABELS: Record<DemoStepId, string> = {
  baseline: '1. Baseline',
  compare: '2. Compare tariff',
  optimise: '3. Optimise timing',
}

function describeDifference(pence: number, moreLabel: string, lessLabel: string): string {
  if (pence > 0) return `${formatGbp(pence)} ${lessLabel}`
  if (pence < 0) return `${formatGbp(-pence)} ${moreLabel}`
  return 'no difference'
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
 * household's usage, so every panel says so explicitly rather than
 * leaving it implied. The segmented control behaves as a standard ARIA
 * tablist (roving tabindex, arrow-key navigation) so it's usable by
 * keyboard as well as click/tap, and each step change remounts its
 * content (via `key`) to replay a restrained fade/slide transition --
 * skipped entirely under prefers-reduced-motion (see LandingDemo.css).
 *
 * OA-83 (second pass): the story panel leads with the number (kWh/£),
 * not a sentence -- a short context line above it and a brief
 * supporting line below, per the ticket's "dominant figure" hierarchy.
 * No standalone section heading, no pill/card chrome around that
 * context line or the Optimise step's figures -- the ticket's own
 * review of the first pass asked for fewer generic "another
 * pill/another card" containers, letting the segmented control and the
 * numbers themselves carry the section rather than a labelled box.
 * Reuses the same fixture/copy as before, just reordered/restyled; no
 * new claims are made.
 *
 * OA-85/86: multi-day fixture (colour = cheap/standard/peak, opacity =
 * usage) -- see landingDemoFixture's `days`.
 *
 * OA-89: the visual is `<LandingTimeProfile>`, a continuous price-
 * landscape + usage-bar time profile -- replaces the square-cell
 * `<LandingHeatMap>` (removed), whose colour+opacity-on-one-cell
 * encoding made price and usage too abstract to read at a glance. See
 * LandingTimeProfile.tsx's own comment for the full rationale.
 *
 * OA-86/89: the `key={step}` remount (for the story panel's fade/slide)
 * is scoped to `.landing-demo__story` only, not the whole grid --
 * `<LandingTimeProfile>` itself stays mounted across step changes. Each
 * slot across Baseline/Compare/Optimise shares the same `startsAt`
 * (only price-band colour/usage-bar height differ -- see
 * landingDemoFixture.ts), which are LandingTimeProfile's own React keys,
 * so switching steps updates each column's existing DOM node in place
 * rather than replacing it. That's what lets its CSS transitions
 * actually interpolate between states -- remounting fresh columns on
 * every step would have nothing to transition from.
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

  return (
    // OA-92: the hero's "See how it works" CTA jumps here via a plain
    // #comparison-demo anchor -- tabIndex={-1} makes the section itself
    // programmatically focusable so the browser's native anchor
    // activation also moves keyboard/AT focus into this section, not
    // just the viewport, "ensuring the comparison lands clearly in
    // view" rather than only scrolling past it.
    <section
      className="landing-demo landing-section-band"
      id="comparison-demo"
      aria-label="Interactive example: how Shift & Save works"
      data-active-step={step}
      tabIndex={-1}
    >
      <p className="landing-demo__eyebrow">Example household — illustrative data, not your own</p>

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
        className="landing-demo__grid"
        role="tabpanel"
        id={`landing-demo-panel-${step}`}
        aria-labelledby={`landing-demo-tab-${step}`}
      >
        <div className="landing-demo__story" key={step}>
          {step === 'baseline' && (
            <>
              <p className="landing-demo__context">Example tariff: {fixture.baseline.tariffName}</p>
              <p className="landing-demo__stat">
                <span className="landing-demo__stat-value">{fixture.baseline.totalKwh.toFixed(1)} kWh</span>
                <span className="landing-demo__stat-value">
                  <span aria-hidden="true">· </span>
                  {formatGbp(fixture.baseline.totalCostPence)}
                </span>
              </p>
              <p className="landing-demo__caption">
                This is the baseline — exactly when energy gets used, half hour by half hour.
              </p>
            </>
          )}

          {step === 'compare' && (
            <>
              <p className="landing-demo__context landing-demo__context--accent">
                Same usage. Same times. Compare with {fixture.compare.tariffName}.
              </p>
              <p className="landing-demo__stat">
                <span className="landing-demo__stat-value">{formatGbp(fixture.compare.totalCostPence)}</span>
                <span className="landing-demo__stat-diff">
                  {describeDifference(fixture.tariffSwitchSavingPence, 'more', 'less')}
                </span>
              </p>
              <p className="landing-demo__caption">Only the tariff changes — usage is identical to Baseline.</p>
              <p className="landing-demo__caveat">
                One example comparison, not a guarantee — which tariff costs less depends on your own usage pattern.
              </p>
            </>
          )}

          {step === 'optimise' && (
            <>
              <p className="landing-demo__context">
                {fixture.compare.tariffName}, same usage — flexible load moved out of the expensive window.
              </p>
              <p className="landing-demo__stat">
                <span className="landing-demo__stat-value">{formatGbp(fixture.optimise.totalCostPence)}</span>
                <span className="landing-demo__stat-diff landing-demo__stat-diff--positive">
                  {describeTimingPotential(fixture.timingSavingPence)}
                </span>
              </p>
              <p className="landing-demo__caption">
                Same tariff as Compare, same total energy — only the timing of flexible use (like a dishwasher)
                changes.
              </p>
              <p className="landing-demo__caveat">
                Illustrative example only. We&apos;re not saying your home has this appliance, or that you could
                achieve this saving.
              </p>
            </>
          )}
        </div>

        <div className="landing-demo__heatmap-slot">
          <LandingTimeProfile
            day={current.day}
            title={`${STEP_TAB_LABELS[step]} — ${current.tariffName} (example data)`}
            subtitle="Example day · half-hourly readings"
          />
        </div>
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
