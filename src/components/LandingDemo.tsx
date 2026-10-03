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
// -> optimise against it" at a glance. OA-135/136 made both Baseline's and
// Compare's copy depend on the live current/chosen tariff (Compare's
// heading names the current tariff dynamically), so these are now set
// inline per-branch below, alongside each branch's `result`/`controls` --
// not from one static lookup table.

// OA-136: "14p less"/"5p more", not "£0.14 less" -- the ticket's own worked
// example stays in pence for any difference under a pound, only switching
// to formatGbp's £ form once it's large enough that pence would read
// oddly. `diffPence` is signed the same way
// `differencePenceVsCurrentTariffPence` already is: positive means the
// comparison tariff costs *more* than the current one.
function formatPenceCompact(pence: number): string {
  const rounded = Math.round(Math.abs(pence))
  return rounded < 100 ? `${rounded}p` : formatGbp(rounded)
}

// OA-136 (second pass): "14p less/day"/"5p more/day" -- now the
// *secondary* daily-equivalent line (the annual figure below is the
// dominant headline). Omitted entirely by the caller once the difference
// rounds to zero, since the annual headline's own "About the same over a
// year" already covers that case -- a secondary "About the same" under it
// would just repeat the same statement twice.
function describeComparisonHeadline(diffPence: number): string {
  const rounded = Math.round(diffPence)
  return rounded < 0 ? `${formatPenceCompact(rounded)} less/day` : `${formatPenceCompact(rounded)} more/day`
}

// OA-136 (second pass): "make the annual saving / annual cost increase the
// dominant result" -- "Save about £70/year" / "Costs about £18/year more"
// / "About the same over a year", replacing the old daily-led headline.
// Keyed on the *daily* difference for the negligible case (rather than a
// rounded annual figure) so a genuinely tiny daily difference can never
// read as a materially different annual one just from multiplying up
// rounding noise.
function describeComparisonAnnualHeadline(annualPence: number, dailyDiffPence: number): string {
  if (Math.round(dailyDiffPence) === 0) return 'About the same over a year'
  const rounded = Math.round(Math.abs(annualPence))
  return annualPence < 0 ? `Save about ${formatGbp(rounded)}/year` : `Costs about ${formatGbp(rounded)}/year more`
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

// OA-153: Optimise's hero headline is now a *total* (tariff-choice saving
// + timing saving combined), not the timing-only figure
// `describeComparisonAnnualHeadline` keys on a daily difference for --
// there's no single daily figure for a combined annual total, so this
// keys directly on the rounded total pence instead. Same wording as
// Compare's own headline (`describeComparisonAnnualHeadline`) so the two
// stages' hero cards read as the same component, not a near-duplicate.
function describeAnnualOutcomeHeadline(totalPence: number): string {
  if (Math.round(totalPence) === 0) return 'About the same over a year'
  const rounded = Math.round(Math.abs(totalPence))
  return totalPence > 0 ? `Save about ${formatGbp(rounded)}/year` : `Costs about ${formatGbp(rounded)}/year more`
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

  // OA-136: "select exactly one alternative tariff to compare" -- Compare
  // starts with nothing chosen yet (the A/B result only appears once a
  // genuine alternative has been picked), which this derives as "the
  // chosen tariff differs from the current one" rather than a separate
  // boolean to keep in sync. `chosenTariffId` starts, and gets reset back
  // to, `currentTariffId` itself (see `selectCurrentTariff` below) exactly
  // when there's no alternative selected -- so this stays correct through
  // every state transition without extra state.
  const hasSelectedComparisonTariff = chosenTariffId !== currentTariffId

  // OA-117/OA-136: "only a Smart comparison tariff can proceed to
  // Optimise" -- Flexible/Fixed have no timing structure at all to
  // optimise against, so Optimise must be visibly unavailable rather than
  // landing on a flat "little to save" result for a tariff type that was
  // never going to have one. Deliberately keyed on the chosen tariff's
  // *category*, not `hasSelectedComparisonTariff` -- before the user picks
  // an alternative, `chosenTariffId` still equals `currentTariffId`, and if
  // that starting tariff already happens to be Smart, Optimise should stay
  // reachable rather than requiring a redundant re-selection of it.
  const canReachOptimiseStage = TARIFF_CATEGORY[chosenTariffId] === 'smart'

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

  // OA-136: "the tariff selected as current in Tab 1 must be visible,
  // clearly disabled, and not selectable as the comparison target."
  // Flexible/Fixed each resolve to exactly one tariff, so the category
  // button itself is the thing to disable when it would just re-select
  // the current tariff. Smart never gets disabled at the category level --
  // it covers multiple products, so the specific matching product is
  // disabled in the secondary row instead (see the Compare `controls`
  // below), never the whole category.
  function isCategoryDisabledAsComparisonTarget(category: TariffCategory): boolean {
    return category !== 'smart' && resolveTariffForCategory(category, chosenTariffId) === currentTariffId
  }

  // OA-117: the scrubber itself (LandingStoryScrubber) already refuses to
  // drag/click/key its way past a locked stage, but `progress` can still
  // momentarily hold an unclamped value the instant `canReachOptimiseStage`
  // flips from true to false (e.g. scrubbing back to Compare and switching
  // to Flexible while still mid-drag toward Optimise) -- this is the single
  // place that derives every other value in this component from `progress`,
  // so clamping here too keeps the whole render consistent even in that
  // instant, with no separate effect needed to correct the stored state.
  const maxReachableStageIndex = canReachOptimiseStage ? 2 : 1
  const clampedProgress = Math.max(0, Math.min(maxReachableStageIndex, progress))
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

  // OA-110/OA-126: the compact, visually dominant primary result for the
  // current stage -- kept separate from the question heading/supporting
  // copy above it and from any further per-stage detail below, so there's
  // exactly one bold figure per stage, not a repeated or duplicated one.
  // `resultLabel` names what that figure actually is (OA-126: "6.8 kWh"
  // is the Typical household's modelled daily usage, not a visitor's own
  // spend) and `standingChargeNote` discloses the excluded standing
  // charge right next to it, consistently across all three stages.
  let questionHeading: React.ReactNode
  let supportingCopy: React.ReactNode
  let resultLabel: React.ReactNode
  let result: React.ReactNode
  let standingChargeNote: React.ReactNode = STANDING_CHARGE_NOTE
  let explanation: React.ReactNode
  let caveat: React.ReactNode
  let payoff: React.ReactNode
  let controls: React.ReactNode
  let primarySelector: React.ReactNode

  if (nearestStage === 'baseline') {
    // OA-135: "Tab 1's primary job is choosing the tariff this household
    // is on now" -- replaces the old usage-led "When do you use energy?"
    // heading, which no longer names the actual primary action here.
    questionHeading = 'What tariff are you on now?'
    supportingCopy = 'Choose your current tariff so we can compare this same household day against the alternatives.'

    // OA-126/OA-135: previously one combined "6.8 kWh · £1.80" line, which
    // read as a single authoritative "average household spend" figure.
    // Split into a quiet "Typical day · 6.8 kWh" label (names the Typical
    // household's modelled daily usage) above the bold "£1.80/day on
    // <tariff>" result (OA-135's own worked example wording), with the
    // standing charge disclosed separately beneath both.
    resultLabel = <>Typical day · {interpolatedTotalKwh.toFixed(1)} kWh</>
    result = (
      <>
        <strong>{formatGbp(interpolatedTotalCostPence)}/day</strong> on {tariffContextLabel(currentTariffId)}
      </>
    )

    // OA-135/OA-141: "the key decision on Tab 1 ... should have stronger
    // hierarchy than secondary controls and labels" -- promoted out of the
    // small `controls` slot (which Compare/Optimise still use for their
    // own, deliberately secondary controls) into its own full-width,
    // visually prominent `primarySelector` block, under a directive label
    // with real visual weight ("Your current tariff", not just an
    // accessible name).
    const currentCategory = TARIFF_CATEGORY[currentTariffId]
    primarySelector = (
      <div className="landing-time-profile__primary-selector-stack">
        <span className="landing-time-profile__primary-selector-label">Your current tariff</span>
        <div className="landing-time-profile__segmented" role="group" aria-label="Your current tariff">
          {(['flexible', 'fixed', 'smart'] as const).map((category) => (
            <button
              key={category}
              type="button"
              className="landing-time-profile__segmented-button"
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
    // OA-136: "select one tariff to compare against the current tariff
    // chosen in Tab 1" -- a simple A/B interaction, current tariff fixed
    // as the reference, not a table of every tariff's result at once.
    // The heading/result stay in terms of the current tariff until a
    // genuine alternative is picked (see `hasSelectedComparisonTariff`).
    questionHeading = `Compare ${tariffContextLabel(currentTariffId)} with another tariff`
    supportingCopy = 'Same household. Same usage. Same timings. Only the tariff changes.'
    const currentEntry = fixture.tariffComparison.find((entry) => entry.isCurrentTariff)!
    if (hasSelectedComparisonTariff) {
      // OA-136 (second pass): "make the annual saving the dominant result
      // ... a dedicated result-block treatment rather than ordinary
      // right-aligned text" -- the annual headline, tariff-vs-tariff
      // context and the now-secondary daily figure all live together in
      // one visually distinct block (`__annual-hero`, LandingTimeProfile.css),
      // not spread across the plain `result`/`payoff` slots other stages
      // use for a single flat figure. `data-direction` lets that block's
      // CSS give a saving/cost/neutral outcome a distinct accent without
      // three near-duplicate class names.
      const chosenEntry = fixture.tariffComparison.find((entry) => entry.tariffId === chosenTariffId)!
      const dailyDiffPence = chosenEntry.differencePenceVsCurrentTariffPence
      const isNegligible = Math.round(dailyDiffPence) === 0
      const direction = isNegligible ? 'neutral' : dailyDiffPence < 0 ? 'save' : 'cost'
      resultLabel = undefined
      result = (
        <span className="landing-time-profile__annual-hero" data-direction={direction}>
          <strong className="landing-time-profile__annual-hero-figure">
            {describeComparisonAnnualHeadline(chosenEntry.annualDifferencePence, dailyDiffPence)}
          </strong>
          <span className="landing-time-profile__compare-row">{tariffContextLabel(chosenTariffId)}</span>
          <span className="landing-time-profile__compare-row">vs {tariffContextLabel(currentTariffId)}</span>
          {/* OA-136: the daily pence figure is now secondary supporting
              context, not the headline -- and dropped entirely once it's
              already negligible, since the headline's own "About the same
              over a year" already says so. */}
          {!isNegligible && (
            <span className="landing-time-profile__annual-hero-daily">{describeComparisonHeadline(dailyDiffPence)}</span>
          )}
        </span>
      )
      payoff = undefined
    } else {
      // OA-136: "starting state" -- only the fixed current-tariff
      // reference, before any alternative has been chosen to compare it
      // against.
      resultLabel = <>Same usage · {interpolatedTotalKwh.toFixed(1)} kWh</>
      result = (
        <>
          Current tariff: {tariffContextLabel(currentTariffId)} · <strong>{formatGbp(currentEntry.totalCostPence)}</strong>
        </>
      )
    }
    // OA-101/OA-127: "representative comparison", not "one example" --
    // matches OA-99's representative-day methodology rather than implying
    // this was a single arbitrarily-picked example.
    caveat =
      'Representative comparison — which tariff costs less depends on your own usage, region and actual prices on the day.'

    // OA-136 (second pass): "reduce the control hierarchy... do not
    // include [the current tariff's category] as a large disabled segment
    // if removing it makes the choice simpler" -- the current tariff's own
    // category (if it resolves to exactly one tariff -- Flexible/Fixed) is
    // dropped from the row entirely rather than shown disabled, since it's
    // already explicit in the heading/result context above. Smart stays in
    // the row even when the current tariff is itself Smart -- there's
    // still a genuine, different smart product to compare against -- with
    // only that one matching product excluded from its own compact
    // subtype row below.
    const chosenCategory = TARIFF_CATEGORY[chosenTariffId]
    const compareCategoryOptions = (['flexible', 'fixed', 'smart'] as const).filter(
      (category) => !isCategoryDisabledAsComparisonTarget(category),
    )
    const compareSmartTariffOptions = SMART_TARIFF_IDS.filter((tariffId) => tariffId !== currentTariffId)
    primarySelector = (
      <div className="landing-time-profile__primary-selector-stack">
        <span className="landing-time-profile__primary-selector-label">
          Compare {tariffContextLabel(currentTariffId)} with:
        </span>
        <div
          className="landing-time-profile__segmented"
          role="group"
          aria-label={`Compare ${tariffContextLabel(currentTariffId)} with`}
        >
          {compareCategoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              className="landing-time-profile__segmented-button"
              aria-pressed={category === chosenCategory}
              onClick={() => selectChosenTariffCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        {/* OA-136 (second pass): "should not look like another full-width
            segmented tab bar... clearly feel secondary to the primary
            tariff-type choice" -- the same compact pill treatment
            Baseline's own Smart subtype row already uses, not the large
            `__segmented` control the first pass gave this. The current
            tariff's own matching product is excluded entirely (see
            `compareSmartTariffOptions`) rather than shown disabled, for
            the same "don't show what can't be chosen" reason as the
            primary row above. */}
        {chosenCategory === 'smart' && (
          <div
            className="landing-time-profile__controls landing-time-profile__controls--secondary"
            role="group"
            aria-label="Choose a smart tariff to compare"
          >
            {compareSmartTariffOptions.map((tariffId) => (
              <button
                key={tariffId}
                type="button"
                className="landing-time-profile__controls-button landing-time-profile__controls-button--secondary"
                aria-pressed={tariffId === chosenTariffId && hasSelectedComparisonTariff}
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
    questionHeading = 'What could you save by moving flexible use?'
    supportingCopy = 'Shift only the things that can realistically move.'
    // OA-153: "make Optimise explicitly cumulative" -- `tariffAnnualSavingPence`
    // is the exact same canonical figure Compare's own hero derives
    // (`chosenEntry.annualDifferencePence`, OA-146's rounded-once value),
    // negated so a saving reads positive here the same way the timing
    // figures already do. It's constant through the 1->2 transition
    // (already "banked" by the time Optimise is reached); only the timing
    // portion animates in via `optFrac`, so the hero visibly grows from
    // "tariff saving alone" to "tariff + timing" as the scrubber arrives.
    const chosenEntry = fixture.tariffComparison.find((entry) => entry.tariffId === chosenTariffId)!
    const tariffAnnualSavingPence = -chosenEntry.annualDifferencePence
    const annualSavingPence = lerp(0, fixture.projection.projectedAnnualSavingPence, optFrac)
    const monthlySavingPence = lerp(0, fixture.projection.projectedMonthlySavingPence, optFrac)
    const dailySavingPence = lerp(0, fixture.timingSavingPence, optFrac)
    const totalAnnualSavingPence = tariffAnnualSavingPence + annualSavingPence

    // OA-153: reuses Compare's own `__annual-hero` markup/styling
    // (LandingTimeProfile.css) rather than a parallel implementation --
    // same card, same `data-direction` tinting, just a cumulative figure
    // and a breakdown row instead of a tariff-vs-tariff one.
    resultLabel = undefined
    const direction = Math.round(totalAnnualSavingPence) === 0 ? 'neutral' : totalAnnualSavingPence > 0 ? 'save' : 'cost'
    result = (
      <span className="landing-time-profile__annual-hero" data-direction={direction}>
        <strong className="landing-time-profile__annual-hero-figure">
          {describeAnnualOutcomeHeadline(totalAnnualSavingPence)}
        </strong>
        <span className="landing-time-profile__compare-row">{tariffContextLabel(chosenTariffId)}</span>
        <span className="landing-time-profile__compare-row">vs {tariffContextLabel(currentTariffId)}</span>
        {/* OA-153: the explicit "tariff + timing = total" breakdown the
            ticket asks for -- a clearly-labelled extra layer, not folded
            silently into the headline figure. */}
        <span className="landing-time-profile__annual-hero-daily">
          {formatGbp(Math.abs(tariffAnnualSavingPence))} tariff saving + {formatGbp(Math.abs(annualSavingPence))} timing
          saving
        </span>
      </span>
    )
    // OA-126: "do not present the standing charge as part of the
    // shiftable/optimisable amount" -- explicit here, since Optimise's
    // result is a saving rather than a daily cost, so the generic "+
    // standing charge" note (as if it were an add-on cost) would read
    // oddly; this stage instead states the standing charge is untouched.
    standingChargeNote = 'Standing charge unaffected — never part of this saving'

    // OA-146/OA-153: `monthlySavingPence` is derived from the same
    // canonical `projectedAnnualSavingPence` the breakdown row above
    // already shows (annual/12, see `buildEventProjection`), so this line
    // and the headline always reconcile; the tariff portion is added on
    // the same monthly basis (`tariffAnnualSavingPence / 12`) so the
    // *total* monthly figure here reconciles with the *total* annual
    // headline too, not just the timing slice of it. `dailySavingPence`
    // (`fixture.timingSavingPence`) is a genuinely different measure --
    // today's example day's actual before/after cost, not an equivalent
    // daily rate for the annual/monthly recurrence projection above (see
    // the "do not simply calculate today's saving x 365" comment on
    // `WEEKS_PER_YEAR` in landingDemoFixture.ts) -- so it's labelled and
    // explained on its own line, in the same quiet `payoff-caveat`
    // treatment as the other secondary caveats, rather than grouped next
    // to the monthly figure as if one annualises into the other.
    const totalMonthlySavingPence = tariffAnnualSavingPence / 12 + monthlySavingPence
    payoff = (
      <>
        <span className="landing-time-profile__payoff-detail">
          ≈ {formatGbp(Math.abs(totalMonthlySavingPence))}/month total, at the assumed cycle frequency
        </span>
        <span className="landing-time-profile__payoff-caveat">
          Today's example day alone saves {formatGbp(Math.abs(dailySavingPence))} from timing — a separate, single-day
          figure, not this estimate's daily rate.
        </span>
      </>
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

    // OA-137: "Reset"/"Optimise" removed as top-level actions -- arriving
    // at Optimise already auto-optimises on its own (OA-117), so a manual
    // "Optimise" button was always redundant, and the ticket is explicit
    // that Reset should not remain a primary top-level action here either.
    // What's left is exactly the tariff-context label the no-opportunity
    // branch below already uses -- both branches now share the same quiet,
    // button-free `controls`.
    controls = <span className="landing-time-profile__tariff-context">{tariffContextLabel(chosenTariffId)}</span>
  } else {
    // OA-137/OA-153: a Smart tariff is selected (Optimise is otherwise
    // unreachable -- see `canReachOptimiseStage`), but it has no genuine
    // timing-saving opportunity under its real pricing structure -- a
    // factual, neutral result rather than manufacturing a saving figure of
    // ~£0 dressed up as an "aha moment". The chart shows the household's
    // real, unmoved schedule (`optimiseEventStartSlots` is never
    // auto-populated with a trial schedule that didn't clear the
    // threshold -- see `computeEffectiveOptimisedStartSlots`). OA-153:
    // "total collapses to the tariff-only saving, not £0 or an error" --
    // this still uses the same `__annual-hero` card as the opportunity
    // branch above, with the timing layer at zero and explicitly labelled
    // as such, rather than swapping to a different, plainer result shape.
    questionHeading = 'What could you save by moving flexible use?'
    supportingCopy = 'Shift only the things that can realistically move.'
    const chosenEntry = fixture.tariffComparison.find((entry) => entry.tariffId === chosenTariffId)!
    const tariffAnnualSavingPence = -chosenEntry.annualDifferencePence
    resultLabel = undefined
    const direction = Math.round(tariffAnnualSavingPence) === 0 ? 'neutral' : tariffAnnualSavingPence > 0 ? 'save' : 'cost'
    result = (
      <span className="landing-time-profile__annual-hero" data-direction={direction}>
        <strong className="landing-time-profile__annual-hero-figure">
          {describeAnnualOutcomeHeadline(tariffAnnualSavingPence)}
        </strong>
        <span className="landing-time-profile__compare-row">{tariffContextLabel(chosenTariffId)}</span>
        <span className="landing-time-profile__compare-row">vs {tariffContextLabel(currentTariffId)}</span>
        <span className="landing-time-profile__annual-hero-daily">
          {formatGbp(Math.abs(tariffAnnualSavingPence))} tariff saving + £0.00 timing saving
        </span>
      </span>
    )
    standingChargeNote = undefined
    payoff = (
      <span className="landing-time-profile__payoff-detail">
        Your flexible use is already close to the cheaper periods — no further timing saving available.
      </span>
    )
    explanation = undefined
    controls = <span className="landing-time-profile__tariff-context">{tariffContextLabel(chosenTariffId)}</span>
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
        // OA-117: locks the Optimise label/drag range until the chosen
        // comparison tariff is Smart.
        maxReachableIndex={maxReachableStageIndex}
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
          primarySelector={primarySelector}
          // OA-143/OA-136: "Tab 1 and Tab 2 should share the same
          // high-level layout" -- left = choice, right = outcome, for both
          // Baseline and Compare. OA-137: Optimise now uses the same
          // two-column grammar too, but inverted -- the headline saving is
          // dominant *left*-hand content, with only the quiet tariff
          // context on the right.
          splitLayout={nearestStage === 'optimise' ? 'context-right' : 'result-right'}
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
