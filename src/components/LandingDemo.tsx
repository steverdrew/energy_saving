import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLandingDemoFixture, type LandingDemoFixture } from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import HeatMap from './HeatMap'
import './LandingDemo.css'

type DemoStepId = 'baseline' | 'compare' | 'optimise'

const STEP_ORDER: DemoStepId[] = ['baseline', 'compare', 'optimise']

const STEP_TAB_LABELS: Record<DemoStepId, string> = {
  baseline: '1. What happened',
  compare: '2. Compare tariff',
  optimise: '3. Optimise timing',
}

function describeDifference(pence: number, moreLabel: string, lessLabel: string): string {
  if (pence > 0) return `${formatGbp(pence)} ${lessLabel}`
  if (pence < 0) return `${formatGbp(-pence)} ${moreLabel}`
  return 'no difference'
}

/**
 * OA-77: logged-out, interactive Baseline -> Compare tariff -> Optimise
 * timing walkthrough. All figures come from `buildLandingDemoFixture` --
 * fixture data only, never a real household's usage, so every panel says
 * so explicitly rather than leaving it implied.
 */
function LandingDemo() {
  const [step, setStep] = useState<DemoStepId>('baseline')
  const fixture: LandingDemoFixture = useMemo(() => buildLandingDemoFixture(), [])
  const current = fixture[step]

  return (
    <section className="landing-demo" aria-label="Interactive example: how Shift & Save works">
      <p className="landing-demo__eyebrow">Example household — illustrative data, not your own</p>

      <div className="landing-demo__tabs" role="tablist" aria-label="Demo steps">
        {STEP_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={step === id}
            className="landing-demo__tab"
            data-active={step === id || undefined}
            onClick={() => setStep(id)}
          >
            {STEP_TAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="landing-demo__panel">
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

      <HeatMap days={[current.day]} title={`${STEP_TAB_LABELS[step]} — ${current.tariffName} (example data)`} />

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
