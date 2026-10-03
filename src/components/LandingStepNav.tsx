import './LandingStepNav.css'

/** OA-156: one labelled step (Baseline / Compare tariff / Optimise timing). */
export interface LandingStepNavStep {
  id: string
  label: string
}

export interface LandingStepNavProps {
  /** Exactly the steps this nav has anchors for, in order. */
  steps: readonly LandingStepNavStep[]
  /** The current step, as an integer index into `steps`. Controlled by the caller. */
  activeIndex: number
  /** Called with the step index to jump to -- either a step label click or Back/Next. */
  onStepChange: (stepIndex: number) => void
  /** OA-156 (carried over from the old scrubber's `maxReachableIndex`): the furthest step index currently reachable -- e.g. locks Optimise until the comparison tariff selected in Compare is a Smart tariff. Defaults to the last step (no gating). The gated step's label renders visibly but disabled, never hidden, and Next stops one step short of it. */
  maxReachableIndex?: number
  'aria-label'?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * OA-156: replaces the old continuous drag scrubber (`LandingStoryScrubber`,
 * removed) with a simple, discrete "Step 1 -> Step 2 -> Step 3" nav -- a
 * guided flow a visitor steps through deliberately, rather than a slider
 * they drag or jump around on. Lives inside the card, between the
 * choices/result narrative and the chart (see LandingTimeProfile.tsx's
 * `stepNav` slot), not above the whole section the way the scrubber sat.
 * Each step label is itself the navigation -- clicking "Compare" or
 * "Optimise" jumps straight there (when unlocked); there's no separate
 * Back/Next pair duplicating that.
 *
 * Deliberately stateless about *what* each step means -- LandingDemo.tsx
 * owns all of that (fixture, narrative); this component only ever reports
 * a step index back via `onStepChange`.
 */
function LandingStepNav({ steps, activeIndex, onStepChange, maxReachableIndex, ...rest }: LandingStepNavProps) {
  const maxIndex = steps.length - 1
  const effectiveMaxIndex = clamp(maxReachableIndex ?? maxIndex, 0, maxIndex)
  const clampedActiveIndex = clamp(activeIndex, 0, effectiveMaxIndex)

  function goTo(index: number) {
    onStepChange(clamp(index, 0, effectiveMaxIndex))
  }

  return (
    <nav className="landing-step-nav" aria-label={rest['aria-label'] ?? 'Story stage'}>
      <ol className="landing-step-nav__steps">
        {steps.map((step, index) => {
          const isLocked = index > effectiveMaxIndex
          return (
            <li key={step.id} className="landing-step-nav__item">
              <button
                type="button"
                className="landing-step-nav__step"
                data-active={clampedActiveIndex === index || undefined}
                data-locked={isLocked || undefined}
                aria-current={clampedActiveIndex === index || undefined}
                aria-disabled={isLocked || undefined}
                disabled={isLocked}
                onClick={() => goTo(index)}
              >
                {/* OA-156: "Step N" is a decorative badge, not part of the
                    button's accessible name -- the step's own label
                    (Baseline/Compare/Optimise) stays the name a visitor
                    (and assistive tech) actually identifies the step by. */}
                <span className="landing-step-nav__badge" aria-hidden="true">
                  Step {index + 1}
                </span>
                {step.label}
              </button>
              {index < steps.length - 1 && (
                <span className="landing-step-nav__connector" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default LandingStepNav
