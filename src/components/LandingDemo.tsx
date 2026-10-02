import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLandingDemoFixture, type LandingDemoFixture } from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import HeatMap from './HeatMap'
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

/**
 * OA-77/OA-80: logged-out, interactive Baseline -> Compare tariff ->
 * Optimise timing walkthrough. All figures come from
 * `buildLandingDemoFixture` -- fixture data only, never a real
 * household's usage, so every panel says so explicitly rather than
 * leaving it implied. The segmented control behaves as a standard ARIA
 * tablist (roving tabindex, arrow-key navigation) so it's usable by
 * keyboard as well as click/tap, and each step change remounts its
 * content (via `key`) to replay a restrained fade/slide transition --
 * skipped entirely under prefers-reduced-motion (see LandingDemo.css).
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
    <section className="landing-demo" aria-label="Interactive example: how Shift & Save works">
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
        key={step}
        role="tabpanel"
        id={`landing-demo-panel-${step}`}
        aria-labelledby={`landing-demo-tab-${step}`}
      >
        <div className="landing-demo__story">
          {step === 'baseline' && (
            <>
              <h3>This is what happened</h3>
              <p className="landing-demo__summary">
                On a <strong>{fixture.baseline.tariffName}</strong> tariff, this example household used{' '}
                <strong>{fixture.baseline.totalKwh.toFixed(1)} kWh</strong> over the day, at a cost of{' '}
                <strong>{formatGbp(fixture.baseline.totalCostPence)}</strong>.
              </p>
            </>
          )}

          {step === 'compare' && (
            <>
              <h3>
                I&apos;m on {fixture.baseline.tariffName} — what if I&apos;d been on {fixture.compare.tariffName}?
              </h3>
              <p className="landing-demo__summary">
                Same usage. Same times. Only the tariff changes:{' '}
                <strong>{formatGbp(fixture.compare.totalCostPence)}</strong> instead of{' '}
                <strong>{formatGbp(fixture.baseline.totalCostPence)}</strong> — a difference of{' '}
                <strong>{describeDifference(fixture.tariffSwitchSavingPence, 'more', 'less')}</strong> in this
                example.
              </p>
              <p className="landing-demo__caveat">
                This is one example comparison, not a guarantee — which tariff costs less depends on your own usage
                pattern.
              </p>
            </>
          )}

          {step === 'optimise' && (
            <>
              <h3>What could better timing change?</h3>
              <p className="landing-demo__summary">
                Here&apos;s an example of moving flexible use — like a dishwasher — into cheaper periods, while
                keeping the same {fixture.compare.tariffName} tariff and the same total energy use.
              </p>
              <p className="landing-demo__summary">
                That alone is a further{' '}
                <strong>{describeDifference(fixture.timingSavingPence, 'more', 'less')}</strong> in this illustrative
                example — separate from the tariff-choice difference above.
              </p>
              <p className="landing-demo__caveat">
                Illustrative example only. We&apos;re not saying your home has this appliance, or that you could
                achieve this saving.
              </p>
            </>
          )}
        </div>

        <div className="landing-demo__heatmap-card">
          <HeatMap days={[current.day]} title={`${STEP_TAB_LABELS[step]} — ${current.tariffName} (example data)`} />
        </div>
      </div>

      <p className="landing-demo__cta">
        <Link to="/login" className="landing-demo__cta-link">
          See my last 30 days
        </Link>
        <span className="landing-demo__cta-note">
          Connecting your account replaces this example with your own tariff and half-hourly usage.
        </span>
      </p>
    </section>
  )
}

export default LandingDemo
