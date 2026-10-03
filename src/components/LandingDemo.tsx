import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
  clampEventStartSlot,
  isRealHouseholdEvent,
  LANDING_DEMO_DATA_SOURCES,
  LANDING_DEMO_EVENTS,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
  type LandingDemoFixture,
} from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import { formatSlotTime } from './heatMapMath'
import LandingTimeProfile, { type LandingTimeProfileEventOverlay } from './LandingTimeProfile'
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

// OA-102: "potential saving from timing", not an achieved saving --
// language the ticket is explicit about not overstating.
function describeTimingPotential(pence: number): string {
  if (pence > 0) return `${formatGbp(pence)} potential saving from timing`
  if (pence < 0) return `${formatGbp(-pence)} more from this timing move`
  return 'no further difference from timing'
}

// OA-104: "the longer-term number should carry more visual weight than a
// small daily amount" -- the headline of the new payoff block. Handles the
// non-positive cases honestly rather than ever reading "save -£3/year".
function describeAnnualPayoff(pence: number): string {
  if (pence > 0) return `You could save around ${formatGbp(pence)}/year by shifting these loads`
  if (pence < 0) return `This timing move would cost around ${formatGbp(-pence)}/year more, at the assumed frequency`
  return 'No extra yearly saving from this timing, at the assumed frequency'
}

// OA-104: the per-occurrence line in the worked example format the ticket
// gives ("Saves 18p this cycle"), kept separate from the household-level
// `describeTimingPotential` above since this is about one cycle, not the
// whole day's figure (identical today, since there's one flexible event).
function describeSavingPerOccurrence(pence: number): string {
  if (pence > 0) return `Saves ${formatGbp(pence)} this cycle`
  if (pence < 0) return `Costs ${formatGbp(-pence)} more this cycle`
  return 'No saving this cycle'
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
  // OA-103/105: each household event's position on the Optimise tab is
  // live, user-movable state -- lifted here (rather than into
  // LandingTimeProfile) so it persists across tab switches and drives the
  // fixture rebuild below. Keyed by event id; an event with no entry here
  // starts from its actual (Baseline/Compare) slot -- OA-105's "no event
  // appears for the first time on Tab 3".
  const [optimiseEventStartSlots, setOptimiseEventStartSlots] = useState<Record<string, number>>({})
  const fixture: LandingDemoFixture = useMemo(
    () => buildLandingDemoFixture(optimiseEventStartSlots),
    [optimiseEventStartSlots],
  )
  const current = fixture[step]
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function moveEvent(eventId: string, startSlot: number) {
    setOptimiseEventStartSlots((prev) => ({ ...prev, [eventId]: clampEventStartSlot(eventId, startSlot) }))
  }

  // OA-106: "Optimise all" -- move every eligible (real) event to its own
  // cheapest valid slot in one step, using the exact same per-event
  // validity window and Agile rates a manual drag would use
  // (cheapestStartSlotForEvent), never a shared/global search that could
  // invent a placement a drag couldn't reach. Fixed events and background
  // load are untouched -- only entries in `optimiseEventStartSlots` move.
  function optimiseAll() {
    setOptimiseEventStartSlots(() => {
      const next: Record<string, number> = {}
      for (const event of LANDING_DEMO_EVENTS) {
        if (!isRealHouseholdEvent(event)) continue
        next[event.id] = cheapestStartSlotForEvent(event.id)
      }
      return next
    })
  }

  // OA-106: "Reset" means return to the original household schedule, not
  // undo the last move -- clearing all overrides makes every event fall
  // back to its `actualStartSlot`, the exact same position shown fixed on
  // Tabs 1/2 (see `buildLandingDemoFixture`'s default).
  function resetSchedule() {
    setOptimiseEventStartSlots({})
  }

  const hasMovedFromOriginalSchedule = Object.keys(optimiseEventStartSlots).length > 0

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
  let payoff: React.ReactNode
  let eventDetail: React.ReactNode
  let controls: React.ReactNode

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
    // OA-101: "representative comparison", not "one example" -- matches
    // OA-99's representative-day methodology rather than implying this
    // was a single arbitrarily-picked example.
    caveat = 'Representative comparison — which tariff costs less depends on your own usage, region and actual Agile prices.'
  } else {
    summary = (
      // OA-102: same two-line hierarchy as Compare (OA-101) -- tariff +
      // price, then the potential timing saving on its own line.
      <>
        {fixture.compare.tariffName} · <strong>{formatGbp(fixture.optimise.totalCostPence)}</strong>
        <br />
        <strong className="landing-time-profile__summary-diff">
          {describeTimingPotential(fixture.timingSavingPence)}
        </strong>
      </>
    )
    // OA-102/105: plain language for *what* moves (identify flexible
    // usage, move only that, everything else stays put) plus the "same
    // tariff / same total energy / better timing" reinforcement -- not a
    // claim that the whole household's load was rearranged. OA-105: starts
    // from the exact same events/positions as Baseline/Compare -- nothing
    // has moved yet, so the invitation to drag is the active instruction,
    // not just a hint alongside an already-staged example.
    explanation =
      'We identify energy use that can realistically move — like a dishwasher or washing machine cycle — and shift it to a cheaper half-hour. Everything else stays where it was: same tariff, same total energy, just better timing. Drag either event in the chart below into a cheaper half-hour to see the saving appear and update live.'
    caveat =
      'Illustrative optimisation — your actual opportunities depend on what you use, when it can move, your region and your actual Agile prices.'

    // OA-104/105: the household-level annual/monthly projection -- summed
    // across every household event's own recurrence assumption
    // (fixture.projection), never a naive "today's saving x 365".
    // Recomputes live as any event moves, since `fixture` is rebuilt from
    // `optimiseEventStartSlots`.
    const { projection } = fixture
    payoff = (
      <>
        <span className="landing-time-profile__payoff-headline">
          {describeAnnualPayoff(projection.projectedAnnualSavingPence)}
        </span>
        <span className="landing-time-profile__payoff-detail">
          {formatGbp(Math.abs(projection.dailyPotentialSavingPence))} today · ≈{' '}
          {formatGbp(Math.abs(projection.projectedMonthlySavingPence))}/month
        </span>
        {/* OA-104: "keep this secondary but discoverable" -- placed right
            under the projection it qualifies, not buried in the general
            Optimise caveat above/below. */}
        <span className="landing-time-profile__payoff-caveat">
          Estimated from the example household&rsquo;s assumed usage frequency. Your actual saving will depend on what
          you use, how often, when it can move, your region and Agile prices.
        </span>
      </>
    )

    // OA-104/105: "event-level projection can remain secondary to the
    // overall household projection" -- one line per household event,
    // inspectable but subordinate to `payoff` above.
    eventDetail = (
      <>
        {projection.events.map((ev) => (
          <span key={ev.id} className="landing-time-profile__event-detail-row">
            {ev.label} moved to {formatSlotTime(fixture.optimise.day.slots[ev.currentStartSlot].startsAt)}
            <br />
            {describeSavingPerOccurrence(ev.savingPerOccurrencePence)}
            <br />≈ {formatGbp(Math.abs(ev.projectedAnnualSavingPence))}/year at {ev.occurrencesPerWeek} cycles/week
          </span>
        ))}
      </>
    )

    // OA-106: "Optimise all" / "Reset" as clear secondary controls above
    // the chart -- Optimise all first, then Reset, per the ticket's
    // suggested order.
    controls = (
      <div className="landing-time-profile__controls">
        <button type="button" className="landing-time-profile__controls-button" onClick={optimiseAll}>
          Optimise all
        </button>
        <button
          type="button"
          className="landing-time-profile__controls-button landing-time-profile__controls-button--secondary"
          onClick={resetSchedule}
          disabled={!hasMovedFromOriginalSchedule}
        >
          Reset
        </button>
      </div>
    )
  }

  // OA-105/OA-106: the exact same shared events, in the exact same
  // positions, on every tab -- Baseline/Compare always show each event's
  // real (actualStartSlot) position as a fixed annotation; only Optimise
  // makes them draggable, starting from that same position until moved.
  // `isRealHouseholdEvent` is the one guard (shared with
  // LandingTimeProfile.tsx's own render-time check) that keeps a
  // malformed or zero-energy event definition from ever reaching the
  // chart as an empty/orphan outlined block.
  const eventOverlays: LandingTimeProfileEventOverlay[] = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent).map((event) => {
    const projected = fixture.projection.events.find((e) => e.id === event.id)
    if (step !== 'optimise') {
      return { id: event.id, label: event.label, startSlot: event.actualStartSlot, slotCount: event.slotCount, movable: false }
    }
    return {
      id: event.id,
      label: event.label,
      startSlot: projected?.currentStartSlot ?? event.actualStartSlot,
      slotCount: event.slotCount,
      movable: true,
      minStartSlot: event.validStartSlotRange.min,
      maxStartSlot: event.validStartSlotRange.max,
      onMove: (startSlot) => moveEvent(event.id, startSlot),
    }
  })

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
            <li>
              <a href={LANDING_DEMO_DATA_SOURCES.sourceUrls.octopusAgilePricing} target="_blank" rel="noreferrer">
                Octopus Energy — how Agile prices are calculated
              </a>
            </li>
          </ul>
          {/* OA-99: "Agile profile based on median half-hour prices from
              real published Agile rates over a defined historical
              period" -- the representative-day methodology itself, not
              just the raw sources above. */}
          <p className="landing-demo__sources-method">
            Agile profile based on median half-hour prices from real published Agile rates,{' '}
            {LANDING_DEMO_DATA_SOURCES.tariffRegion}, {LANDING_DEMO_DATA_SOURCES.tariffDateRange}.
          </p>
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
          payoff={payoff}
          eventDetail={eventDetail}
          controls={controls}
          stepKey={step}
          // OA-99/OA-101: the 16:00-19:00 structural peak is a documented
          // feature of Agile's pricing specifically -- only Compare/
          // Optimise are actually on Agile (see LandingTimeProfile.tsx's
          // prop doc).
          showStructuralPeakAnnotation={step !== 'baseline'}
          // OA-105: the same shared events on every tab -- fixed
          // annotations on Baseline/Compare, draggable overlays on Optimise.
          events={eventOverlays}
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
