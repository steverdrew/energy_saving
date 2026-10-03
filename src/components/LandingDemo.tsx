import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
  clampEventStartSlot,
  effectiveValidStartSlotRange,
  isRealHouseholdEvent,
  LANDING_DEMO_DATA_SOURCES,
  LANDING_DEMO_EVENTS,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
  SMART_TARIFF_IDS,
  TARIFF_CATEGORY,
  type LandingDemoFixture,
  type TariffCategory,
  type TariffId,
} from '../domain/landingDemoFixture'
import { formatGbp } from '../format'
import type { HeatMapDay } from './heatMapMath'
import LandingStoryScrubber, { type LandingStoryScrubberStage } from './LandingStoryScrubber'
import LandingTimeProfile, { type LandingTimeProfileEventOverlay, type PriceStripShape } from './LandingTimeProfile'
import './LandingDemo.css'

// OA-99: shown on every stage, identically -- the headline £ figure is
// usage cost only, never silently mixed with the daily standing charge
// (which doesn't vary by tariff or usage timing, so folding it in would
// blur the tariff/timing comparison this demo exists to show).
const COST_BASIS_NOTE = `Figures show usage cost only — excludes the ${formatGbp(OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY)}/day standing charge.`

// OA-126: the same standing-charge disclosure, but shown right next to
// each stage's own result (not just in the below-chart footnote above) --
// "+ 55p/day standing charge", quiet and consistent across Baseline/
// Compare/Optimise, so the headline £ figure is never read as a visitor's
// whole daily bill. The standing charge itself never varies by tariff or
// timing, so the wording never changes per stage either.
const STANDING_CHARGE_NOTE = `+ ${formatGbp(OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY)}/day standing charge`

type DemoStageId = 'baseline' | 'compare' | 'optimise'

const STAGE_ORDER: DemoStageId[] = ['baseline', 'compare', 'optimise']

// OA-109/OA-110: the scrubber's three labelled anchors -- replaces the old
// `role="tablist"` segmented control. OA-110 drops the numeric prefixes
// now the control is clearly continuous -- left-to-right position already
// communicates order.
// OA-127/OA-132: short inline names for use mid-sentence ("actual Agile
// prices") and as the secondary "Smart · <product>" detail -- never the
// primary Compare choice any more (see `CATEGORY_LABELS`/`tariffContextLabel`
// below, which own that).
const TARIFF_SHORT_LABELS: Record<TariffId, string> = {
  'standard-variable': 'Standard Variable',
  fixed: 'Fixed',
  'economy-7': 'Economy 7',
  agile: 'Agile',
}

// OA-132: the three tariff *types* that are now the primary Compare
// choice -- "product names come second."
const CATEGORY_LABELS: Record<TariffCategory, string> = {
  flexible: 'Flexible',
  fixed: 'Fixed',
  smart: 'Smart',
}

// OA-132: "when Smart is selected, show the relevant underlying product as
// secondary context" ("Smart · Agile") -- Flexible/Fixed have no further
// product-level detail to show (there's only ever one rate behind either),
// so they just name the category itself. Used both for Compare's result
// line and as Optimise's quiet tariff context (never a second prominent
// selector there -- see OA-117).
function tariffContextLabel(tariffId: TariffId): string {
  const category = TARIFF_CATEGORY[tariffId]
  return category === 'smart' ? `Smart · ${TARIFF_SHORT_LABELS[tariffId]}` : CATEGORY_LABELS[category]
}

// OA-127/OA-131/OA-132/OA-133: how each tariff's price strip should be
// segmented -- Flexible/Fixed are both one flat tone (OA-132: "represented
// as flat-rate tariff types"), Economy 7 is the explicit binary day/night
// block pair (OA-133: never a continuous gradient), and Agile keeps its 48
// genuinely distinct half-hourly segments.
const TARIFF_PRICE_STRIP_SHAPES: Record<TariffId, PriceStripShape> = {
  'standard-variable': 'flat',
  fixed: 'flat',
  'economy-7': 'two-rate',
  agile: 'dynamic',
}

// OA-132: "the model should determine the relevant smart tariff rather
// than the UI assuming Agile is always the answer" -- here, there's no
// richer eligibility model yet (that's a separate, larger ticket), so this
// just names which smart product the category defaults to the first time
// a visitor switches into Smart. Agile (not Economy 7) because it's this
// demo's longest-standing, most-illustrated example.
const DEFAULT_SMART_TARIFF_ID: TariffId = 'agile'

const SCRUBBER_STAGES: LandingStoryScrubberStage[] = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'compare', label: 'Compare' },
  { id: 'optimise', label: 'Optimise' },
]

// OA-95/98: the stage heading reads as a plain consumer statement, not
// diagnostic/technical wording like "1. BASELINE -- STANDARD VARIABLE
// (EXAMPLE DATA)". Still used as the accessible name for the chart group/
// sr-table caption (see LandingTimeProfile.tsx) -- OA-110's visible
// question-style heading is a separate, additional piece of copy.
const STAGE_HEADINGS: Record<DemoStageId, string> = {
  baseline: 'Your current setup',
  compare: 'Same usage, different tariff',
  optimise: 'Same tariff, better timing',
}

// OA-110: one question-style heading and a short supporting line per
// stage -- answers "understand the household day -> choose a tariff type
// -> optimise against it" at a glance, so the copy reads as one continuous
// narrative rather than three separate screens.
// OA-132: Compare's question is now neutral and type-led ("do not lead
// with product-specific wording such as 'What would that day cost on
// Agile?'") -- the specific resolved product (e.g. "Smart · Agile") is
// still shown, but only as secondary detail in the result line/controls,
// never in this primary question. Optimise's question stays tariff-neutral
// too, per OA-117/OA-132 ("main copy stays neutral... focus on timing and
// household behaviour").
// OA-135/OA-136: Baseline now establishes "the tariff I am on now" as the
// reference point, so Compare's question can be concrete ("how does this
// tariff compare") rather than the old abstract "which type of tariff
// fits this household?" (OA-132's framing, now superseded by OA-136's
// explicit reference-point requirement). Optimise's question/supporting
// pair is resolved separately below once it's known whether there's a
// genuine timing-saving opportunity (OA-137) -- this function only covers
// Baseline/Compare, whose copy never depends on that.
function stageNarrative(stage: 'baseline' | 'compare'): { question: string; supporting: string } {
  if (stage === 'baseline') return { question: 'When do you use energy?', supporting: 'Your typical day, half hour by half hour.' }
  return { question: 'How would this same day cost on other tariffs?', supporting: 'Same usage. Same timings. Only the tariff changes.' }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

// OA-117: "the scrubber itself should demonstrate the optimisation" --
// every eligible (real, movable) event's own cheapest valid slot, using
// the exact same per-event validity window and Agile rates a manual drag
// would use (`cheapestStartSlotForEvent`), never a shared/global search
// that could invent a placement a drag couldn't reach. Fixed events
// (e.g. the oven) and background load are untouched. Dependent events
// (tumble dryer) are resolved after the event they depend on, so their
// own cheapest-slot search sees that event's *already-optimised*
// position, never an earlier start a drag couldn't reach either. This is
// the schedule the story scrubber now auto-reveals on its way to
// Optimise -- not something a visitor has to press a button to see.
// OA-127: takes the currently-selected tariff, so arriving at Optimise
// (or re-applying "Optimise") schedules movable events against whichever
// tariff Compare is showing -- Economy 7 naturally prefers its overnight
// off-peak window, Agile its 48 half-hourly prices, Standard Variable
// (flat) has nothing to move for.
function computeAutoOptimisedStartSlots(tariffId: TariffId): Record<string, number> {
  const next: Record<string, number> = {}
  const dependencyOrderedMovableEvents = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent)
    .filter((event) => event.movable)
    .sort((a, b) => (a.dependsOnEventId ? 1 : 0) - (b.dependsOnEventId ? 1 : 0))
  for (const event of dependencyOrderedMovableEvents) {
    next[event.id] = cheapestStartSlotForEvent(event.id, next, tariffId)
  }
  return next
}

// OA-137: "do not manufacture an optimisation result" -- a flat tariff
// (Flexible/Fixed) has no cheaper slot to move to, but
// `cheapestStartSlotForEvent`'s tie-breaking would otherwise still slide
// every movable event to the earliest minute of its own window (the first
// slot it tries with the lowest-seen cost), which reads as "optimised"
// even though nothing was actually saved. This checks whether the
// resulting schedule would actually clear the deterministic
// meaningful-saving threshold before committing to it -- if it wouldn't,
// the household's original (`actualStartSlot`) schedule is used instead,
// so Optimise's "no genuine opportunity" state (see `hasTimingSavingOpportunity`
// below) is never contradicted by a chart that moved anyway.
function computeEffectiveOptimisedStartSlots(tariffId: TariffId): Record<string, number> {
  const trialSlots = computeAutoOptimisedStartSlots(tariffId)
  const trialFixture = buildLandingDemoFixture(trialSlots, tariffId, tariffId)
  return trialFixture.hasTimingSavingOpportunity ? trialSlots : {}
}

// OA-101/OA-110: the compact result line's difference wording -- no
// reference-tariff name (that attribution is left to the supporting copy,
// which already states the tariff changes), just the bare amount.
function describeDifferenceCompact(pence: number, moreLabel: string, lessLabel: string): string {
  if (pence > 0) return `${formatGbp(pence)} ${lessLabel}`
  if (pence < 0) return `${formatGbp(-pence)} ${moreLabel}`
  return 'no different'
}

// OA-104/OA-110: "the longer-term number should carry more visual weight
// than a small daily amount" -- the compact, visually dominant result
// shown in the Optimise card. Handles the non-positive cases honestly
// rather than ever reading "save -£3/year".
function describeAnnualPayoff(pence: number): string {
  if (pence > 0) return `Save around ${formatGbp(pence)}/year`
  if (pence < 0) return `Costs around ${formatGbp(-pence)}/year more, at the assumed frequency`
  return 'No extra yearly saving from this timing, at the assumed frequency'
}

// OA-104: the per-occurrence line in the worked example format the ticket
// gives ("Saves 18p this cycle").
function describeSavingPerOccurrence(pence: number): string {
  if (pence > 0) return `Saves ${formatGbp(pence)} this cycle`
  if (pence < 0) return `Costs ${formatGbp(-pence)} more this cycle`
  return 'No saving this cycle'
}

/**
 * OA-109: blends two days' worth of slots into one, for the scrubber's
 * continuous transitional state. Usage (`kwh`) blends compare -> optimise
 * as `optFrac` goes 0 -> 1 (baseline and compare share identical usage,
 * so this single blend covers both the 0->1 and 1->2 halves of the
 * scrubber correctly); the unit rate blends baseline -> compare as
 * `baseFrac` goes 0 -> 1 (compare and optimise share identical rates, so
 * this covers the 1->2 half too, holding the rate constant there).
 */
function interpolateDay(fixture: LandingDemoFixture, baseFrac: number, optFrac: number): HeatMapDay {
  const { baseline, compare, optimise } = fixture
  const slots = baseline.day.slots.map((baselineSlot, i) => {
    const compareSlot = compare.day.slots[i]
    const optimiseSlot = optimise.day.slots[i]
    const kwh = lerp(compareSlot.kwh ?? 0, optimiseSlot.kwh ?? 0, optFrac)
    const unitRateIncVatPence = lerp(baselineSlot.unitRateIncVatPence ?? 0, compareSlot.unitRateIncVatPence ?? 0, baseFrac)
    return {
      startsAt: baselineSlot.startsAt,
      kwh,
      unitRateIncVatPence,
      costPence: kwh * unitRateIncVatPence,
    }
  })
  return { date: baseline.day.date, slots }
}

/**
 * OA-108/OA-109: logged-out, interactive Baseline -> Compare tariff ->
 * Optimise timing story. All figures come from `buildLandingDemoFixture`
 * -- fixture data only, never a real household's usage.
 *
 * OA-109: replaces the old 3-tab segmented control with a continuous drag
 * scrubber (`<LandingStoryScrubber>`) over one persistent
 * `<LandingTimeProfile>` chart. `progress` (0..2) is the single source of
 * truth for where the story currently is -- an integer when snapped to a
 * stage, fractional while being dragged. The chart itself never remounts
 * across the whole range: its `day` prop is a per-slot blend
 * (`interpolateDay`) of the three fixture steps, and its event overlays'
 * positions are blended the same way, so colour/usage/event-position
 * transitions all interpolate smoothly as `progress` changes, with no
 * hard cut at the old tab boundaries.
 *
 * OA-108/OA-112/OA-117: once the scrubber is at (or within half a stage
 * of) Optimise, the dominant `result` line becomes the annual saving, a
 * collapsed "How we calculated this" disclosure holds the secondary
 * methodology/caveats, and Reset sits directly above the now-draggable
 * chart (OA-117 removed "Optimise all" -- the scrubber auto-optimises on
 * its own by the time it reaches Optimise; see `computeAutoOptimisedStartSlots`
 * and the `optimiseEventStartSlots` state doc below). The old permanent
 * per-appliance list is gone;
 * `eventSavingText` instead hands LandingTimeProfile a contextual popover
 * shown only while a given event is focused/hovered/dragged.
 */
function LandingDemo() {
  // OA-109: the one piece of story state -- 0 = Baseline, 1 = Compare
  // tariff, 2 = Optimise timing, any real number in between is a live
  // transitional position.
  const [progress, setProgress] = useState(0)
  // OA-135: the tariff Baseline establishes as "the tariff I am on now" --
  // the reference point for Compare, and (until the user picks a
  // different "chosen" tariff there) what Optimise is costed against too.
  // Defaults to Standard Variable -- the most common starting point for a
  // household that hasn't actively chosen a time-of-use tariff yet.
  const [currentTariffId, setCurrentTariffId] = useState<TariffId>('standard-variable')
  // OA-136: "current/base tariff" and "chosen tariff" are two explicit,
  // separable states -- they may be the same (the common case, before the
  // user has picked an alternative on Compare), but changing the current
  // tariff on Baseline and choosing an alternative to inspect on Compare
  // are different actions. This is what Compare/Optimise are actually
  // costed against; it starts equal to `currentTariffId` and only diverges
  // once the user explicitly selects an alternative on Compare.
  const [chosenTariffId, setChosenTariffId] = useState<TariffId>('standard-variable')
  // OA-103/105/117: each household event's position on the Optimise stage
  // is live, user-movable state -- lifted here (rather than into
  // LandingTimeProfile) so it persists across scrubbing and drives the
  // fixture rebuild below. Keyed by event id; an event with no entry here
  // falls back to its actual (Baseline/Compare) slot -- OA-105's "no event
  // appears for the first time on Optimise". OA-117/OA-137: the *initial*
  // value is the auto-optimised schedule *only if that schedule would
  // clear the meaningful-saving threshold* (see `computeEffectiveOptimisedStartSlots`)
  // -- Standard Variable is flat, so there's genuinely nothing to optimise
  // on arrival by default, and the schedule correctly starts at the
  // original positions rather than appearing to move for no real saving.
  // A manual drag (`moveEvent`) still overwrites a single event's entry
  // from here on, same as before.
  const [optimiseEventStartSlots, setOptimiseEventStartSlots] = useState<Record<string, number>>(() =>
    computeEffectiveOptimisedStartSlots('standard-variable'),
  )
  const fixture: LandingDemoFixture = useMemo(
    () => buildLandingDemoFixture(optimiseEventStartSlots, chosenTariffId, currentTariffId),
    [optimiseEventStartSlots, chosenTariffId, currentTariffId],
  )

  // OA-137: whether the *chosen tariff itself* has a genuine timing-saving
  // opportunity -- deliberately independent of the live
  // `optimiseEventStartSlots` state (which legitimately reaches zero
  // saving right after Reset, or while a visitor is mid-manual-drag).
  // `fixture.hasTimingSavingOpportunity` reflects the *currently displayed*
  // schedule's saving and stays useful for that; this is the one the
  // Optimise headline/controls/auto-move gate on, so Reset or an
  // exploratory drag can never flip Optimise into its "no opportunity"
  // state for a tariff that genuinely has one.
  const tariffHasTimingSavingOpportunity = useMemo(() => {
    const trialSlots = computeAutoOptimisedStartSlots(chosenTariffId)
    return buildLandingDemoFixture(trialSlots, chosenTariffId, chosenTariffId).hasTimingSavingOpportunity
  }, [chosenTariffId])

  // OA-136: picking an alternative tariff to inspect/carry into Optimise --
  // re-optimises against the newly chosen tariff's own rates (OA-137-aware:
  // falls back to the original schedule if that tariff has no genuine
  // timing-saving opportunity), since the previous tariff's schedule isn't
  // a valid "cheapest slot" search under a different pricing structure.
  function selectChosenTariff(tariffId: TariffId) {
    setChosenTariffId(tariffId)
    setOptimiseEventStartSlots(computeEffectiveOptimisedStartSlots(tariffId))
  }

  // OA-135: changing the household's *current* tariff on Baseline also
  // resets the Compare/Optimise reference back to it -- "the initial
  // Compare reference remains the Baseline/current tariff" means a fresh
  // current-tariff choice shouldn't leave a stale, previously-chosen
  // alternative in place.
  function selectCurrentTariff(tariffId: TariffId) {
    setCurrentTariffId(tariffId)
    selectChosenTariff(tariffId)
  }

  // OA-132/135: the primary selector picks a *category* -- Flexible and
  // Fixed each resolve to exactly one tariff, so picking the category is
  // enough. Smart has no single rate of its own: picking it when not
  // already on a smart tariff resolves to `DEFAULT_SMART_TARIFF_ID` (the
  // model's choice, not the UI always assuming Agile); re-clicking "Smart"
  // while already on a smart tariff is a no-op, since a specific smart
  // product is already selected via the secondary row. Shared between
  // Baseline's current-tariff selector and Compare's chosen-tariff one --
  // only which underlying setter it ends up calling differs.
  function resolveTariffForCategory(category: TariffCategory, currentlySelected: TariffId): TariffId {
    if (category === 'flexible') return 'standard-variable'
    if (category === 'fixed') return 'fixed'
    return TARIFF_CATEGORY[currentlySelected] === 'smart' ? currentlySelected : DEFAULT_SMART_TARIFF_ID
  }

  function selectCurrentTariffCategory(category: TariffCategory) {
    selectCurrentTariff(resolveTariffForCategory(category, currentTariffId))
  }

  function selectChosenTariffCategory(category: TariffCategory) {
    selectChosenTariff(resolveTariffForCategory(category, chosenTariffId))
  }

  const clampedProgress = Math.max(0, Math.min(2, progress))
  const nearestStageIndex = Math.round(clampedProgress)
  const nearestStage = STAGE_ORDER[nearestStageIndex]
  // OA-109: "event dragging only at stage 3" -- gated on having actually
  // arrived (snapped) there, not merely being more than halfway through
  // the 2->3 transition, since the overlay is still sliding into position
  // until then.
  const isAtOptimiseStage = clampedProgress === 2
  // OA-108: the three-section Optimise hierarchy (and its controls) start
  // showing once the scrubber is within the Optimise half of the story
  // (`nearestStageIndex === 2`), not only once it's fully arrived --
  // matching the continuous feel the rest of the transition has.

  const baseFrac = clamp01(clampedProgress)
  const optFrac = clamp01(clampedProgress - 1)

  const interpolatedDay = useMemo(() => interpolateDay(fixture, baseFrac, optFrac), [fixture, baseFrac, optFrac])
  const interpolatedTotalKwh = interpolatedDay.slots.reduce((sum, s) => sum + (s.kwh ?? 0), 0)
  const interpolatedTotalCostPence = interpolatedDay.slots.reduce((sum, s) => sum + (s.costPence ?? 0), 0)

  // OA-107: dependency-aware -- passes the *current* positions (prior
  // state, before this move) so clamping a dependent event (tumble dryer)
  // correctly uses its dependency's (washing machine's) current position,
  // not just that dependent event's own static window.
  function moveEvent(eventId: string, startSlot: number) {
    setOptimiseEventStartSlots((prev) => ({ ...prev, [eventId]: clampEventStartSlot(eventId, startSlot, prev) }))
  }

  // OA-106/OA-117: "Reset" means return to the original household
  // schedule, not undo the last move, and not undo auto-optimisation --
  // clearing all overrides makes every event fall back to its
  // `actualStartSlot`, the exact same position shown fixed on Baseline/
  // Compare (see `buildLandingDemoFixture`'s default). OA-117 removed the
  // "Optimise all" button this used to pair with (the scrubber now
  // auto-optimises on its own), but Reset keeps its original meaning
  // unchanged -- now the one way back to the original schedule from
  // Optimise's auto-optimised default, same as it was from a manual drag.
  function resetSchedule() {
    setOptimiseEventStartSlots({})
  }

  // Re-applies the same auto-optimised schedule the scrubber arrives at by
  // default -- only ever needed after Reset has returned every event to
  // its original slot (see the button's `disabled` condition below), since
  // arriving at Optimise is already auto-optimised on its own (OA-117).
  // OA-137: this button is only rendered at all once
  // `fixture.hasTimingSavingOpportunity` is true, so it's safe to always
  // use the real auto-optimised schedule here, never the
  // threshold-guarded fallback `computeEffectiveOptimisedStartSlots` uses
  // on arrival.
  function optimiseAll() {
    setOptimiseEventStartSlots(computeAutoOptimisedStartSlots(chosenTariffId))
  }

  // OA-117: "has moved" now means *differs from the original schedule*,
  // not merely "has an entry in the override map" -- the map is
  // auto-populated with the optimised schedule from the start, so an
  // emptiness check would leave Reset permanently enabled even right
  // after Reset itself re-populated nothing. Compares each movable
  // event's current position against its own actual one.
  const hasMovedFromOriginalSchedule = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent)
    .filter((event) => event.movable)
    .some((event) => (optimiseEventStartSlots[event.id] ?? event.actualStartSlot) !== event.actualStartSlot)

  // OA-110/OA-126: the compact, visually dominant primary result for the
  // current stage -- kept separate from the question heading/supporting
  // copy above it and from any further per-stage detail below, so there's
  // exactly one bold figure per stage, not a repeated or duplicated one.
  // `resultLabel` names what that figure actually is (OA-126: "6.8 kWh"
  // is the Typical household's modelled daily usage, not a visitor's own
  // spend) and `standingChargeNote` discloses the excluded standing
  // charge right next to it, consistently across all three stages.
  let resultLabel: React.ReactNode
  let result: React.ReactNode
  let standingChargeNote: React.ReactNode = STANDING_CHARGE_NOTE
  let explanation: React.ReactNode
  let caveat: React.ReactNode
  let payoff: React.ReactNode
  let controls: React.ReactNode

  if (nearestStage === 'baseline') {
    // OA-126/OA-135: previously one combined "6.8 kWh · £1.80" line, which
    // read as a single authoritative "average household spend" figure.
    // Split into a quiet "Typical day · 6.8 kWh" label (names the Typical
    // household's modelled daily usage) above the bold, explicitly
    // labelled "£1.80 energy cost on <tariff>" result (OA-135: "the main
    // Baseline cost names the selected tariff"), with the standing charge
    // disclosed separately beneath both.
    resultLabel = <>Typical day · {interpolatedTotalKwh.toFixed(1)} kWh</>
    result = (
      <>
        <strong>{formatGbp(interpolatedTotalCostPence)}</strong> energy cost on {tariffContextLabel(currentTariffId)}
      </>
    )

    // OA-135: "add a compact tariff selector within Baseline... Primary
    // choices: Flexible | Fixed | Smart. If Smart is selected, reveal the
    // relevant second-level tariff choice." The exact same Flexible/Fixed/
    // Smart two-level control Compare used to own (OA-132) -- Baseline is
    // now where "the tariff I am on now" is actually set.
    const currentCategory = TARIFF_CATEGORY[currentTariffId]
    controls = (
      <div className="landing-time-profile__controls-stack">
        <div className="landing-time-profile__controls" role="group" aria-label="Your current tariff">
          {(['flexible', 'fixed', 'smart'] as const).map((category) => (
            <button
              key={category}
              type="button"
              className="landing-time-profile__controls-button"
              aria-pressed={category === currentCategory}
              onClick={() => selectCurrentTariffCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        {currentCategory === 'smart' && (
          <div
            className="landing-time-profile__controls landing-time-profile__controls--secondary"
            role="group"
            aria-label="Choose your current smart tariff"
          >
            {SMART_TARIFF_IDS.map((tariffId) => (
              <button
                key={tariffId}
                type="button"
                className="landing-time-profile__controls-button landing-time-profile__controls-button--secondary"
                aria-pressed={tariffId === currentTariffId}
                onClick={() => selectCurrentTariff(tariffId)}
              >
                {TARIFF_SHORT_LABELS[tariffId]}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  } else if (nearestStage === 'compare') {
    // OA-136: Compare now reads directly off `fixture.tariffComparison` --
    // the current tariff's own cost plus every alternative's, each
    // modelled against this exact same baseline usage, with a signed
    // difference vs. the current tariff. The dominant `result` line names
    // the current tariff explicitly ("Current tariff: Flexible"); the
    // alternatives (with their own cost and directional difference) are
    // the clickable comparison list below, in `controls`.
    resultLabel = <>Same usage · {interpolatedTotalKwh.toFixed(1)} kWh</>
    const currentEntry = fixture.tariffComparison.find((entry) => entry.isCurrentTariff)!
    result = (
      <>
        Current tariff: {tariffContextLabel(currentTariffId)} · <strong>{formatGbp(currentEntry.totalCostPence)}</strong>
      </>
    )
    // OA-101/OA-127: "representative comparison", not "one example" --
    // matches OA-99's representative-day methodology rather than implying
    // this was a single arbitrarily-picked example.
    caveat =
      'Representative comparison — which tariff costs less depends on your own usage, region and actual prices on the day.'

    const chosenCategory = TARIFF_CATEGORY[chosenTariffId]
    controls = (
      <div className="landing-time-profile__controls-stack">
        {/* OA-136: "show the alternative tariff types/products with
            their modelled daily energy cost and difference from the
            current tariff" -- every tariff (including the current one,
            clearly marked) as one clickable, directional comparison
            list, not a plain type selector any more. Clicking an
            alternative sets it as the *chosen* tariff carried into
            Optimise (OA-136: "current/base tariff" and "chosen tariff"
            are separate states, which may be the same). */}
        <div
          className="landing-time-profile__tariff-comparison"
          role="group"
          aria-label="How this tariff compares with the alternatives"
        >
          {fixture.tariffComparison.map((entry) => (
            <button
              key={entry.tariffId}
              type="button"
              className="landing-time-profile__tariff-comparison-row"
              aria-pressed={entry.tariffId === chosenTariffId}
              onClick={() => selectChosenTariff(entry.tariffId)}
            >
              <span className="landing-time-profile__tariff-comparison-label">
                {entry.isCurrentTariff ? 'Current · ' : ''}
                {tariffContextLabel(entry.tariffId)}
              </span>
              <span className="landing-time-profile__tariff-comparison-figures">
                <strong>{formatGbp(entry.totalCostPence)}</strong>
                {!entry.isCurrentTariff && (
                  <span className="landing-time-profile__tariff-comparison-diff">
                    {' · '}
                    {describeDifferenceCompact(-entry.differencePenceVsCurrentTariffPence, 'more', 'less')}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {/* OA-132/136: the Flexible/Fixed/Smart category shortcut remains
            available as a quicker way to pick among the four tariffs
            (and to reach Smart's own secondary product row), alongside
            the comparison list above rather than replacing it. */}
        <div className="landing-time-profile__controls" role="group" aria-label="Choose a tariff type to compare">
          {(['flexible', 'fixed', 'smart'] as const).map((category) => (
            <button
              key={category}
              type="button"
              className="landing-time-profile__controls-button"
              aria-pressed={category === chosenCategory}
              onClick={() => selectChosenTariffCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        {chosenCategory === 'smart' && (
          <div
            className="landing-time-profile__controls landing-time-profile__controls--secondary"
            role="group"
            aria-label="Choose a smart tariff"
          >
            {SMART_TARIFF_IDS.map((tariffId) => (
              <button
                key={tariffId}
                type="button"
                className="landing-time-profile__controls-button landing-time-profile__controls-button--secondary"
                aria-pressed={tariffId === chosenTariffId}
                onClick={() => selectChosenTariff(tariffId)}
              >
                {TARIFF_SHORT_LABELS[tariffId]}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  } else if (tariffHasTimingSavingOpportunity) {
    // OA-137: a genuine timing-saving opportunity exists under the chosen
    // tariff's real pricing structure -- the existing auto-optimise/Reset
    // behaviour, unchanged.
    const annualSavingPence = lerp(0, fixture.projection.projectedAnnualSavingPence, optFrac)
    const monthlySavingPence = lerp(0, fixture.projection.projectedMonthlySavingPence, optFrac)
    const dailySavingPence = lerp(0, fixture.timingSavingPence, optFrac)

    // OA-110/OA-112/OA-126: the annual saving is the one dominant `result`
    // line above (shared with the question heading/supporting copy) --
    // the "aha moment" of the whole flow, so nothing below repeats it.
    // `resultLabel` makes explicit this is a *timing-only* saving (never
    // the standing charge, which the note below reiterates), matching the
    // same labelled-figure convention as Baseline/Compare. Only a compact
    // daily/monthly secondary figure follows, matching Baseline/Compare's
    // card height instead of the old always-visible "What we've done"/
    // "How we calculated it" sections.
    resultLabel = 'Timing saving only'
    result = <strong>{describeAnnualPayoff(annualSavingPence)}</strong>
    // OA-126: "do not present the standing charge as part of the
    // shiftable/optimisable amount" -- explicit here, since Optimise's
    // result is a saving rather than a daily cost, so the generic "+
    // standing charge" note (as if it were an add-on cost) would read
    // oddly; this stage instead states the standing charge is untouched.
    standingChargeNote = 'Standing charge unaffected — never part of this saving'

    payoff = (
      <span className="landing-time-profile__payoff-detail">
        {formatGbp(Math.abs(dailySavingPence))} today · ≈ {formatGbp(Math.abs(monthlySavingPence))}/month
      </span>
    )

    // OA-112: every secondary detail (methodology, standing-charge
    // treatment, frequency/region/variance caveats) collapses into one
    // quiet, collapsed-by-default disclosure -- replaces OA-108's
    // always-visible "How we calculated it" paragraph plus its nested
    // "View assumptions" disclosure with a single one, so the card goes
    // straight from the result/controls into the chart.
    explanation = (
      <details className="landing-demo__assumptions">
        <summary>How we calculated this</summary>
        <ul>
          <li>Same household events shown in Baseline and Compare, with each event&rsquo;s duration and kWh unchanged.</li>
          <li>Only loads that can realistically shift move — each one respects its own timing window and any dependency on another event.</li>
          <li>The saving is simply the original schedule&rsquo;s cost minus the optimised schedule&rsquo;s cost.</li>
          <li>Figures are usage cost only — the standing charge doesn&rsquo;t vary by tariff or timing, so it&rsquo;s excluded.</li>
          <li>Illustrative example frequency — how often each load actually runs is a documented assumption, not your own usage.</li>
          <li>
            Your actual saving will vary with what you use, how often, your region and real {TARIFF_SHORT_LABELS[chosenTariffId]} prices on the
            day.
          </li>
        </ul>
      </details>
    )

    // OA-106/OA-112/OA-117: "Reset" returns to the un-optimised schedule,
    // for a visitor who has manually experimented with events, or who
    // simply wants to compare against the original timings. "Optimise"
    // sits alongside it but only re-enables once the schedule is back at
    // original (i.e. after Reset) -- arriving at Optimise is already
    // auto-optimised on its own (OA-117), so the button would be
    // redundant until Reset (or a manual drag back to original) undoes
    // that.
    controls = (
      <div className="landing-time-profile__controls-stack">
        {/* OA-117/OA-132/OA-137: the tariff chosen on Compare carries into
            Optimise as quiet context only -- never a second prominent
            selector here. Changing tariff means scrubbing back to
            Compare, selecting there, and scrubbing forward again. */}
        <span className="landing-time-profile__tariff-context">{tariffContextLabel(chosenTariffId)}</span>
        <div className="landing-time-profile__controls">
          <button
            type="button"
            className="landing-time-profile__controls-button"
            onClick={resetSchedule}
            disabled={!hasMovedFromOriginalSchedule}
          >
            Reset
          </button>
          <button
            type="button"
            className="landing-time-profile__controls-button"
            onClick={optimiseAll}
            disabled={hasMovedFromOriginalSchedule}
          >
            Optimise
          </button>
        </div>
      </div>
    )
  } else {
    // OA-137: "where the tariff is effectively flat across the day, or
    // valid shifts produce no meaningful saving, do not manufacture an
    // optimisation result" -- a factual, neutral state rather than a
    // saving figure of ~£0 dressed up as an "aha moment". No Reset/
    // Optimise controls (there's nothing meaningful to reset or apply),
    // and the chart shows the household's real, unmoved schedule
    // (`optimiseEventStartSlots` is never auto-populated with a trial
    // schedule that didn't clear the threshold -- see
    // `computeEffectiveOptimisedStartSlots`).
    resultLabel = undefined
    result = <strong>There&rsquo;s little to save by changing when you use electricity on this tariff.</strong>
    standingChargeNote = undefined
    payoff = (
      <span className="landing-time-profile__payoff-detail">
        {tariffContextLabel(chosenTariffId)} charges broadly the same throughout the day, so shifting these loads
        won&rsquo;t materially reduce the cost.
      </span>
    )
    explanation = undefined
    controls = <span className="landing-time-profile__tariff-context">{tariffContextLabel(chosenTariffId)}</span>
  }

  // OA-137: Optimise's own question/supporting copy depends on whether a
  // genuine opportunity was found, so it can't come from the shared
  // Baseline/Compare `stageNarrative` helper above.
  const { question: questionHeading, supporting: supportingCopy } =
    nearestStage === 'baseline' || nearestStage === 'compare'
      ? stageNarrative(nearestStage)
      : tariffHasTimingSavingOpportunity
        ? { question: 'What could you save by moving flexible use?', supporting: 'Shift only the things that can realistically move.' }
        : {
            question: 'Can this tariff be improved by moving flexible use?',
            supporting: 'Your tariff charges broadly the same throughout the day.',
          }

  // OA-108: "per-event feedback should appear contextually... in/near the
  // event block itself" -- only meaningful once events are actually
  // draggable (Optimise), and only for a movable event.
  function eventSavingText(eventId: string): string | undefined {
    if (!isAtOptimiseStage || !tariffHasTimingSavingOpportunity) return undefined
    const projected = fixture.projection.events.find((e) => e.id === eventId)
    if (!projected) return undefined
    return `${describeSavingPerOccurrence(projected.savingPerOccurrencePence)} · ≈ ${formatGbp(
      Math.abs(projected.projectedAnnualSavingPence),
    )}/year at ${projected.occurrencesPerWeek} cycles/week`
  }

  // OA-105/OA-107/OA-109: the exact same shared events, in the exact same
  // positions, throughout the story -- Baseline/Compare always show each
  // event's real (actualStartSlot) position as a fixed annotation; a
  // movable event's displayed position blends toward its optimised slot
  // as the scrubber moves through the 2->3 transition (`optFrac`), and
  // only becomes an actually-draggable slider once the scrubber has fully
  // arrived at Optimise (OA-109: "do not make event dragging active in
  // stages 1 or 2"). An identified-but-fixed event (the oven) stays a
  // fixed annotation throughout -- it's never draggable and "Optimise
  // all" never touches it.
  const eventOverlays: LandingTimeProfileEventOverlay[] = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent).map((event) => {
    if (!event.movable) {
      return { id: event.id, label: event.label, startSlot: event.actualStartSlot, slotCount: event.slotCount, movable: false }
    }

    const projected = fixture.projection.events.find((e) => e.id === event.id)
    const optimisedStartSlot = projected?.currentStartSlot ?? event.actualStartSlot
    // OA-109: half-hour-slot granularity -- the underlying model has no
    // finer resolution than a slot, so the overlay's displayed position
    // during the transition rounds to the nearest one rather than
    // rendering at a sub-slot (and un-indexable) fractional position.
    const displayedStartSlot = Math.round(lerp(event.actualStartSlot, optimisedStartSlot, optFrac))

    // OA-137: no genuine timing-saving opportunity -- never a draggable
    // slider, at any stage, since there's nothing meaningful to
    // experiment with (and the schedule is already the household's
    // original one -- `optimiseEventStartSlots` was never auto-populated
    // with a trial schedule that didn't clear the threshold).
    if (!isAtOptimiseStage || !tariffHasTimingSavingOpportunity) {
      return { id: event.id, label: event.label, startSlot: displayedStartSlot, slotCount: event.slotCount, movable: false }
    }

    // OA-107: the dependent tumble dryer's draggable range is narrowed to
    // whatever's currently valid (washing machine's current end slot),
    // not just its own static window -- so a visitor can never drag it
    // earlier than the dependency actually allows right now.
    const { min, max } = effectiveValidStartSlotRange(event.id, optimiseEventStartSlots)
    return {
      id: event.id,
      label: event.label,
      startSlot: displayedStartSlot,
      slotCount: event.slotCount,
      movable: true,
      minStartSlot: min,
      maxStartSlot: max,
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
      data-active-stage={nearestStage}
      tabIndex={-1}
    >
      {/* OA-99/OA-100: "Typical household" is the section's one real
          heading -- the figures are grounded in published Ofgem/Elexon/
          Octopus data (see landingDemoFixture.ts's
          LANDING_DEMO_DATA_SOURCES) rather than invented numbers, but
          it's still not the visitor's own usage until they connect an
          account (see the CTA note below). */}
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

      {/* OA-109: the continuous drag scrubber -- replaces the old
          `role="tablist"` segmented control. `progress` is the single
          source of truth driving every interpolated value below. */}
      <LandingStoryScrubber
        stages={SCRUBBER_STAGES}
        progress={clampedProgress}
        onProgressChange={setProgress}
        aria-label="Demo story stage"
      />

      <div className="landing-demo__panel">
        <LandingTimeProfile
          day={interpolatedDay}
          heading={STAGE_HEADINGS[nearestStage]}
          questionHeading={questionHeading}
          supportingCopy={supportingCopy}
          resultLabel={resultLabel}
          result={result}
          explanation={explanation}
          costNote={COST_BASIS_NOTE}
          caveat={caveat}
          payoff={payoff}
          standingChargeNote={standingChargeNote}
          controls={controls}
          stepKey={nearestStage}
          // OA-99/OA-101/OA-127/OA-135: the 16:00-19:00 structural peak is
          // a documented feature of Agile's pricing specifically -- shown
          // whenever the stage currently being displayed is actually
          // costed against Agile (Baseline costs against the current
          // tariff, Compare/Optimise against the chosen one).
          showStructuralPeakAnnotation={(nearestStageIndex === 0 ? currentTariffId : chosenTariffId) === 'agile'}
          // OA-127/OA-131/OA-135: Baseline's chart shows whichever tariff
          // the household is currently modelled as being on; Compare/
          // Optimise show whichever tariff is currently chosen.
          priceStripShape={TARIFF_PRICE_STRIP_SHAPES[nearestStageIndex === 0 ? currentTariffId : chosenTariffId]}
          // OA-105/OA-109: the same shared events throughout the story --
          // fixed annotations outside Optimise, draggable overlays once
          // fully arrived there.
          events={eventOverlays}
          eventSavingText={eventSavingText}
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
