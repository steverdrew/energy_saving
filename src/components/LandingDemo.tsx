import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
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
import Dialog from './Dialog'
import type { HeatMapDay } from './heatMapMath'
import LandingStepNav, { type LandingStepNavStep } from './LandingStepNav'
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

// OA-109/OA-110/OA-156: the step nav's three labelled anchors.
// OA-127/OA-132: short inline names for use mid-sentence ("actual Agile
// prices") and as the secondary "Smart · <product>" detail -- never the
// primary Compare choice any more (see `CATEGORY_LABELS`/`tariffContextLabel`
// below, which own that).
const TARIFF_SHORT_LABELS: Record<TariffId, string> = {
  'standard-variable': 'Standard Variable',
  fixed: 'Fixed',
  'economy-7': 'Octopus Economy 7',
  agile: 'Octopus Agile',
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

const STEP_NAV_STAGES: LandingStepNavStep[] = [
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

// OA-152: "£51 tariff saving" / "+ £42 timing saving" -- the cumulative
// hero's own breakdown rows are deliberately whole-pound, not `formatGbp`'s
// usual pence precision, matching the ticket's own worked example. The
// headline figure above it still uses `formatGbp`'s pence precision via
// `describeAnnualOutcomeHeadline` (unchanged), so this is only for the two
// quieter rows underneath it.
function formatGbpWhole(pence: number): string {
  return `£${Math.round(Math.abs(pence) / 100)}`
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

// OA-117: "the nav itself should demonstrate the optimisation" -- every
// eligible (real, movable) event's own cheapest valid slot, using the
// exact same per-event validity window and Agile rates a manual drag
// would use (`cheapestStartSlotForEvent`), never a shared/global search
// that could invent a placement a drag couldn't reach. Fixed events
// (e.g. the oven) and background load are untouched. Dependent events
// (tumble dryer) are resolved after the event they depend on, so their
// own cheapest-slot search sees that event's *already-optimised*
// position, never an earlier start a drag couldn't reach either. This is
// the schedule that auto-reveals on stepping to Optimise -- not
// something a visitor has to press a button to see.
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
 * OA-109/OA-156: blends two days' worth of slots into one. `baseFrac`/
 * `optFrac` are always 0 or 1 now (OA-156 removed the continuous drag
 * scrubber this blend originally existed to support mid-drag), so this
 * simply selects the current step's day -- kept as a blend rather than a
 * switch because `baseFrac`/`optFrac` already express that selection
 * correctly at their integer endpoints, and it keeps the chart's `day`
 * prop computed the same way regardless of step. Usage (`kwh`) blends
 * compare -> optimise as `optFrac` goes 0 -> 1 (baseline and compare share
 * identical usage, so this single blend covers both the Baseline->Compare
 * and Compare->Optimise steps correctly); the unit rate blends baseline ->
 * compare as `baseFrac` goes 0 -> 1 (compare and optimise share identical
 * rates, so this covers the Compare->Optimise step too, holding the rate
 * constant there).
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
 * OA-108/OA-109/OA-156: logged-out, interactive Baseline -> Compare tariff
 * -> Optimise timing story. All figures come from `buildLandingDemoFixture`
 * -- fixture data only, never a real household's usage.
 *
 * OA-156: a guided, discrete Step 1 -> Step 2 -> Step 3 flow
 * (`<LandingStepNav>` -- each step label is itself the navigation, clicking
 * one jumps straight there) over one persistent
 * `<LandingTimeProfile>` chart -- replaces OA-109's continuous drag
 * scrubber. `progress` (0..2) is the single source of truth for where the
 * story currently is; it only ever holds a whole stage index now; there is
 * no more fractional mid-drag value. The chart itself still never remounts
 * across steps: its `day` prop is still computed via `interpolateDay`
 * (unchanged -- a blend that is exact, not approximate, at the integer
 * `baseFrac`/`optFrac` values a discrete `progress` now always produces),
 * so switching steps keeps the same chart mounted rather than swapping in
 * a new one.
 *
 * OA-108/OA-112/OA-117: once the nav is at Optimise, the dominant `result`
 * line becomes the annual saving, a collapsed "How we calculated this"
 * disclosure holds the secondary methodology/caveats, and the schedule
 * auto-optimises on arrival (OA-117 removed "Optimise all"; see
 * `computeAutoOptimisedStartSlots` and the `optimiseEventStartSlots` doc
 * below). The old permanent per-appliance list is gone; `eventSavingText`
 * instead supplies each movable event's own card with a short saving note
 * once Optimise is reached.
 *
 * OA-168: the chart's events are no longer draggable -- see
 * LandingTimeProfile.tsx's own doc comment for the redesign this replaced
 * it with.
 */
function LandingDemo() {
  // OA-109/OA-156: the one piece of story state -- 0 = Baseline, 1 =
  // Compare tariff, 2 = Optimise timing. Always a whole stage index now
  // (OA-156 removed the old continuous drag scrubber's fractional
  // mid-transition value).
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
  // OA-117/OA-137/OA-168: each movable event's Optimise-stage position --
  // purely derived from the chosen tariff now that OA-168 removed manual
  // dragging (there's no longer any user-set override to layer on top).
  // An event with no entry here falls back to its actual (Baseline/
  // Compare) slot -- OA-105's "no event appears for the first time on
  // Optimise". `computeEffectiveOptimisedStartSlots` only auto-moves
  // anything if doing so would clear the meaningful-saving threshold --
  // Standard Variable is flat, so there's genuinely nothing to optimise,
  // and the schedule correctly stays at the original positions rather
  // than appearing to move for no real saving.
  const optimiseEventStartSlots = useMemo(() => computeEffectiveOptimisedStartSlots(chosenTariffId), [chosenTariffId])
  // OA-166: the "More info" dialog explaining what "Typical household"
  // means, what it's based on, what assumptions it includes, and where
  // the detailed savings calculation lives -- opened from the header,
  // closed via its own close button, Escape, or the overlay (see Dialog).
  const [isHouseholdInfoOpen, setIsHouseholdInfoOpen] = useState(false)
  // OA-167: the fuller appliance-safety dialog, opened from the short
  // safety note shown alongside Optimise's results.
  const [isSafetyInfoOpen, setIsSafetyInfoOpen] = useState(false)
  const householdInfoTitleId = useId()
  const safetyInfoTitleId = useId()
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

  // OA-155: "the public demo stays linear, while Smart-tariff users exit
  // into signup/personalised analysis rather than being forced through a
  // fake Standard -> Smart comparison" -- a visitor who says on Baseline
  // that they're *already* on a smart tariff has nothing genuine to
  // compare against on Compare (there's no "upgrade to Smart" story left
  // to tell them), so the nav stops at Baseline for them entirely rather
  // than continuing into that fake comparison.
  const currentTariffIsSmart = TARIFF_CATEGORY[currentTariffId] === 'smart'

  // OA-136: picking an alternative tariff to inspect/carry into Optimise --
  // `optimiseEventStartSlots` above re-derives automatically against
  // whichever tariff this sets.
  function selectChosenTariff(tariffId: TariffId) {
    setChosenTariffId(tariffId)
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

  // OA-117/OA-156: the step nav itself (LandingStepNav) already refuses to
  // click its way past a locked stage, but `progress` can still hold a
  // stale value the instant `canReachOptimiseStage` flips from true to
  // false (e.g. stepping back to Compare while already at Optimise, then
  // switching to Flexible) -- this is the single place that derives every
  // other value in this component from `progress`, so clamping here too
  // keeps the whole render consistent even in that instant, with no
  // separate effect needed to correct the stored state.
  // OA-155: capped at Baseline (0) entirely when the current tariff is
  // already Smart -- takes priority over `canReachOptimiseStage` (which
  // only gates Optimise), since here there's nowhere genuine to go at all.
  const maxReachableStageIndex = currentTariffIsSmart ? 0 : canReachOptimiseStage ? 2 : 1
  const clampedProgress = Math.max(0, Math.min(maxReachableStageIndex, progress))
  const nearestStageIndex = Math.round(clampedProgress)
  const nearestStage = STAGE_ORDER[nearestStageIndex]
  // OA-108: whether the nav has actually stepped to Optimise -- gates the
  // per-event saving note (events are shown at their auto-optimised
  // position on every stage once there's a genuine opportunity, but the
  // saving note itself is only meaningful once Optimise is the active
  // stage).
  const isAtOptimiseStage = clampedProgress === 2

  const baseFrac = clamp01(clampedProgress)
  const optFrac = clamp01(clampedProgress - 1)

  const interpolatedDay = useMemo(() => interpolateDay(fixture, baseFrac, optFrac), [fixture, baseFrac, optFrac])
  const interpolatedTotalKwh = interpolatedDay.slots.reduce((sum, s) => sum + (s.kwh ?? 0), 0)
  const interpolatedTotalCostPence = interpolatedDay.slots.reduce((sum, s) => sum + (s.costPence ?? 0), 0)

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
  // OA-167: a short, calm safety note shown alongside Optimise's results
  // only -- Baseline/Compare don't move anything, so there's nothing to
  // caution about yet. Both Optimise branches below set this to the same
  // note; it stays undefined everywhere else.
  let safetyNote: React.ReactNode
  const safetyNoteContent = (
    <p className="landing-demo__safety-note">
      <strong>Use appliances safely.</strong> Follow manufacturer guidance and only move loads to suitable times.{' '}
      <button type="button" className="landing-demo__safety-link" onClick={() => setIsSafetyInfoOpen(true)}>
        Safety information
      </button>
    </p>
  )

  if (nearestStage === 'baseline') {
    // OA-135/OA-171 (revised): "Tab 1's primary job is choosing the tariff
    // this household is on now" -- but the heading itself now states the
    // visitor's own underlying question ("would another tariff cost
    // less?") rather than just naming the control action, so it reads as
    // exactly why they're here rather than a form-field instruction.
    questionHeading = 'Would another tariff cost less?'
    supportingCopy = "Choose your current tariff and we'll compare the same electricity use against the alternatives."

    // OA-126/OA-135: previously one combined "6.8 kWh · £1.80" line, which
    // read as a single authoritative "average household spend" figure.
    // Split into a quiet "Typical day · 6.8 kWh" label (names the Typical
    // household's modelled daily usage) above the bold "£1.80/day on
    // <tariff>" result (OA-135's own worked example wording), with the
    // standing charge disclosed separately beneath both. Shown as normal
    // even when the current tariff is Smart -- OA-155's sign-up prompt
    // (below) sits alongside this figure, not in place of it.
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
    questionHeading = `Compare ${tariffContextLabel(currentTariffId)} with a smart tariff`
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

    // OA-136 (fifth pass): "just Economy 7 and Agile" -- Flexible and
    // Fixed are no longer offered as comparison targets at all; the only
    // thing left to compare the current tariff against is a genuine Smart
    // tariff, since that's the only comparison this demo's story (Standard
    // -> Smart -> Optimise) is actually about.
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
          {compareSmartTariffOptions.map((tariffId) => (
            <button
              key={tariffId}
              type="button"
              className="landing-time-profile__segmented-button"
              aria-pressed={tariffId === chosenTariffId}
              onClick={() => selectChosenTariff(tariffId)}
            >
              {TARIFF_SHORT_LABELS[tariffId]}
            </button>
          ))}
        </div>
      </div>
    )
  } else if (tariffHasTimingSavingOpportunity) {
    // OA-152: "turn Tab 3 into a simple cumulative payoff screen" -- new
    // heading naming the total directly, replacing OA-153's "what could
    // you save by moving flexible use" framing (which undersold this as a
    // timing-only question when the hero below it is now a tariff+timing
    // total). The one-line "by switching to..." explanation the ticket
    // asks for is folded into the supporting copy itself (not a separate
    // `explanation` block, which renders below the chart) so it actually
    // sits with the heading on the left -- this also fully replaces the
    // old top-right tariff-context badge, which is removed entirely.
    questionHeading = 'What could you save in total?'
    supportingCopy = (
      <>
        Your tariff saving, plus what you could save by moving flexible use. By switching to{' '}
        {tariffContextLabel(chosenTariffId)} and moving flexible use to cheaper practical times.
      </>
    )
    // OA-153: `tariffAnnualSavingPence` is the exact same canonical figure
    // Compare's own hero derives (`chosenEntry.annualDifferencePence`,
    // OA-146's rounded-once value), negated so a saving reads positive
    // here the same way the timing figures already do. It's constant
    // already "banked" by the time Optimise is reached; `optFrac` is 1
    // once there (OA-156: always 0 or 1, no mid-transition value), so the
    // hero reads as "tariff saving alone" on Compare and "tariff + timing"
    // on Optimise.
    const chosenEntry = fixture.tariffComparison.find((entry) => entry.tariffId === chosenTariffId)!
    const tariffAnnualSavingPence = -chosenEntry.annualDifferencePence
    const annualSavingPence = lerp(0, fixture.projection.projectedAnnualSavingPence, optFrac)
    const dailySavingPence = lerp(0, fixture.timingSavingPence, optFrac)
    const totalAnnualSavingPence = tariffAnnualSavingPence + annualSavingPence

    // OA-152/OA-153: reuses Compare's own `__annual-hero` markup/styling
    // (LandingTimeProfile.css) rather than a parallel implementation --
    // same card, same `data-direction` tinting. OA-152 trims the card's
    // own content down to just the total and a two-line tariff/timing
    // breakdown ("reduce the breakdown to tariff saving + timing saving")
    // -- the tariff-vs-tariff context rows OA-153 put inside the card move
    // to the supporting copy above, and the monthly/daily/standing-charge
    // detail move into the disclosure below.
    resultLabel = undefined
    const direction = Math.round(totalAnnualSavingPence) === 0 ? 'neutral' : totalAnnualSavingPence > 0 ? 'save' : 'cost'
    // OA-164: "the headline is the total annual saving, not the
    // incremental optimisation amount" -- reverses OA-164's own earlier
    // draft (which led with "+£X extra"). The total is the dominant
    // figure once, a two-line breakdown underneath attributes it to its
    // two sources (tariff switch, then timing), and an optional monthly
    // figure gives tertiary context in a different unit -- never the same
    // £/year total restated a second time.
    result = (
      <span className="landing-time-profile__annual-hero landing-time-profile__annual-hero--compact" data-direction={direction}>
        <strong className="landing-time-profile__annual-hero-figure">
          {describeAnnualOutcomeHeadline(totalAnnualSavingPence)}
        </strong>
        <span className="landing-time-profile__annual-hero-breakdown">
          <span className="landing-time-profile__annual-hero-breakdown-row">
            {formatGbpWhole(tariffAnnualSavingPence)}/year from switching to Smart
          </span>
          <span className="landing-time-profile__annual-hero-breakdown-row">
            + {formatGbpWhole(annualSavingPence)}/year from optimisation
          </span>
        </span>
        <span className="landing-time-profile__annual-hero-daily">
          ≈ {formatGbp(totalAnnualSavingPence / 12)}/month total
        </span>
      </span>
    )
    standingChargeNote = undefined
    payoff = undefined
    // OA-152: "move caveats out of the primary view" -- the daily/
    // standing-charge detail OA-153 put directly under the hero card now
    // lives here instead, collapsed by default, alongside the existing
    // methodology bullets. OA-146's own reconciliation (today's figure is
    // labelled as a separate single-day measure) is unchanged, just
    // relocated. OA-164: the monthly total itself moved the other way --
    // out of this disclosure and into the hero's own tertiary line (see
    // `result` above) -- so it's no longer restated here too; this bullet
    // keeps only the methodology caveat behind it.
    explanation = (
      <details className="landing-demo__assumptions">
        <summary>How we calculated this</summary>
        <ul>
          <li>The monthly figure assumes the same cycle frequency every month.</li>
          <li>
            Today's example day alone saves {formatGbp(Math.abs(dailySavingPence))} from timing — a separate, single-day
            figure, not this estimate's daily rate.
          </li>
          <li>Standing charge unaffected — never part of this saving.</li>
          <li>Same household events shown in Baseline and Compare, with each event&rsquo;s duration and kWh unchanged.</li>
          <li>
            Only loads that can realistically shift move — each one respects its own timing window and any dependency on
            another event. The tumble dryer never moves into an overnight window, even under Economy 7: it can&rsquo;t start
            before the washing machine finishes, and — for fire safety — isn&rsquo;t scheduled to run unattended overnight.
          </li>
          <li>The timing saving is simply the original schedule&rsquo;s cost minus the optimised schedule&rsquo;s cost.</li>
          <li>Figures are usage cost only — the standing charge doesn&rsquo;t vary by tariff or timing, so it&rsquo;s excluded.</li>
          <li>Illustrative example frequency — how often each load actually runs is a documented assumption, not your own usage.</li>
          <li>
            Your actual saving will vary with what you use, how often, your region and real {TARIFF_SHORT_LABELS[chosenTariffId]} prices on the
            day.
          </li>
        </ul>
      </details>
    )
    // OA-152: the top-right tariff-context badge is removed -- the
    // supporting copy above already names the chosen tariff, so a second,
    // redundant "Smart · Agile" label floating in the corner no longer
    // earns its place.
    controls = undefined
    // OA-167: timing suggestions are informational, not an instruction to
    // leave an appliance running unattended -- shown next to the result
    // whenever something has actually moved.
    safetyNote = safetyNoteContent
  } else {
    // OA-137/OA-152/OA-153: a Smart tariff is selected (Optimise is
    // otherwise unreachable -- see `canReachOptimiseStage`), but it has no
    // genuine timing-saving opportunity under its real pricing structure
    // -- a factual, neutral result rather than manufacturing a saving
    // figure of ~£0 dressed up as an "aha moment". The chart shows the
    // household's real, unmoved schedule (`optimiseEventStartSlots` is
    // never auto-populated with a trial schedule that didn't clear the
    // threshold -- see `computeEffectiveOptimisedStartSlots`). OA-152:
    // "do not manufacture extra value" -- still the same compact
    // `__annual-hero` card as the opportunity branch above, with the
    // timing layer explicitly at £0 rather than a different, plainer
    // result shape.
    questionHeading = 'What could you save in total?'
    const chosenEntry = fixture.tariffComparison.find((entry) => entry.tariffId === chosenTariffId)!
    const tariffAnnualSavingPence = -chosenEntry.annualDifferencePence
    supportingCopy = (
      <>
        Your tariff saving, plus what you could save by moving flexible use. By switching to{' '}
        {tariffContextLabel(chosenTariffId)} — your flexible use is already close to the cheaper periods, so there&rsquo;s
        no further timing saving available right now.
      </>
    )
    resultLabel = undefined
    const direction = Math.round(tariffAnnualSavingPence) === 0 ? 'neutral' : tariffAnnualSavingPence > 0 ? 'save' : 'cost'
    // OA-164: same headline-then-breakdown structure as the genuine-
    // opportunity branch above (consistency across the three steps), with
    // the optimisation row honestly at £0 rather than a different shape.
    result = (
      <span className="landing-time-profile__annual-hero landing-time-profile__annual-hero--compact" data-direction={direction}>
        <strong className="landing-time-profile__annual-hero-figure">
          {describeAnnualOutcomeHeadline(tariffAnnualSavingPence)}
        </strong>
        <span className="landing-time-profile__annual-hero-breakdown">
          <span className="landing-time-profile__annual-hero-breakdown-row">
            {formatGbpWhole(tariffAnnualSavingPence)}/year from switching to Smart
          </span>
          <span className="landing-time-profile__annual-hero-breakdown-row">+ £0/year from optimisation</span>
        </span>
      </span>
    )
    standingChargeNote = undefined
    payoff = undefined
    explanation = (
      <details className="landing-demo__assumptions">
        <summary>How we calculated this</summary>
        <ul>
          <li>Standing charge unaffected — never part of this saving.</li>
          <li>
            Your actual saving will vary with what you use, how often, your region and real {TARIFF_SHORT_LABELS[chosenTariffId]} prices on the
            day.
          </li>
        </ul>
      </details>
    )
    controls = undefined
    safetyNote = safetyNoteContent
  }

  // OA-108: a short, quiet per-event saving note -- only meaningful once
  // Optimise is the active stage and the chosen tariff has a genuine
  // timing-saving opportunity.
  function eventSavingText(eventId: string): string | undefined {
    if (!isAtOptimiseStage || !tariffHasTimingSavingOpportunity) return undefined
    const projected = fixture.projection.events.find((e) => e.id === eventId)
    if (!projected) return undefined
    return `${describeSavingPerOccurrence(projected.savingPerOccurrencePence)} · ≈ ${formatGbp(
      Math.abs(projected.projectedAnnualSavingPence),
    )}/year at ${projected.occurrencesPerWeek} cycles/week`
  }

  // OA-105/OA-109/OA-156/OA-168: the exact same shared events, in the
  // exact same positions, throughout the story -- Baseline/Compare always
  // show each event's real (actualStartSlot) position; a movable event's
  // displayed position jumps to its optimised slot once the nav steps to
  // Optimise (`optFrac`, always 0 or 1). An identified-but-fixed event
  // (the oven) never moves -- "Optimise all" never touches it. OA-168:
  // every event is now a plain annotation (nothing on the chart is
  // draggable), so there's no longer a movable/fixed branch here -- only
  // the displayed position and (for a movable event, once there's a
  // genuine opportunity) its saving note differ.
  const eventOverlays: LandingTimeProfileEventOverlay[] = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent).map((event) => {
    const projected = event.movable ? fixture.projection.events.find((e) => e.id === event.id) : undefined
    const optimisedStartSlot = projected?.currentStartSlot ?? event.actualStartSlot
    // OA-109: half-hour-slot granularity -- the underlying model has no
    // finer resolution than a slot, so the overlay's displayed position
    // during the transition rounds to the nearest one rather than
    // rendering at a sub-slot (and un-indexable) fractional position.
    const displayedStartSlot = event.movable
      ? Math.round(lerp(event.actualStartSlot, optimisedStartSlot, optFrac))
      : event.actualStartSlot
    const showSaving = event.movable && isAtOptimiseStage && tariffHasTimingSavingOpportunity
    return {
      id: event.id,
      label: event.label,
      startSlot: displayedStartSlot,
      slotCount: event.slotCount,
      safetyConstraintNote: event.safetyConstraintNote,
      savingText: showSaving ? eventSavingText(event.id) : undefined,
    }
  })

  // OA-166: the "More info" dialog's assumptions list names the real
  // household events backing this model, derived from the same shared
  // `LANDING_DEMO_EVENTS` the chart itself renders -- never a hand-typed
  // list that could drift from what's actually simulated.
  const applianceLabelList = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent)
    .map((event) => event.label)
    .join(', ')

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
      {/* OA-99/OA-100/OA-171 (revised): "Typical household" read as a
          strange transition for a first-time visitor -- "why am I looking
          at somebody else's household?" before they understand the
          exercise. Reframed as what's actually happening ("see how the
          comparison works") plus the one-line explanation that this is a
          stand-in for their own usage until they connect an account,
          rather than naming the model itself as the heading. The figures
          are still grounded in published Ofgem/Elexon/Octopus data (see
          landingDemoFixture.ts's LANDING_DEMO_DATA_SOURCES); OA-166's
          "More info" action still opens the fuller dialog explaining the
          model, what it's based on, its assumptions, and the sources
          themselves, so that detail isn't lost, just no longer the
          section's own heading. */}
      <div className="landing-demo__heading-row">
        <h2 className="landing-demo__heading">See how the comparison works</h2>
        <p className="landing-demo__subheading">
          Start with a typical household. When you connect your account, we&rsquo;ll use your actual electricity use. ·{' '}
          <button
            type="button"
            className="landing-demo__more-info-link"
            onClick={() => setIsHouseholdInfoOpen(true)}
          >
            More info
          </button>
        </p>
      </div>

      {/* OA-92/OA-171 (moved): previously sat below the chart, so a
          visitor had to read through all three stages before reaching it
          -- too late if the goal is conversion. By this point the heading
          row above has already said this compares tariffs and switches
          to the visitor's own data once connected; what the chart itself
          still only shows is *how much* that could be worth, which the
          chart's own stages exist to answer for someone still deciding
          whether to read on. Moved to right after that intro, with more
          benefit-led copy ("what to change and how much you could save",
          not just "free") -- the chart now supports the signup decision
          rather than gating it. Still routes to /login: there is no
          dedicated signup flow yet (AuthContext only has login/
          resetPassword), so this reuses the existing sign-in/account-
          creation entry point, matching OA-92's scope of fixing CTA
          copy/behaviour rather than building new auth. */}
      <p className="landing-demo__cta">
        <Link to="/login" className="landing-demo__cta-link">
          Sign up to see what to change and how much you could save
        </Link>
        <span className="landing-demo__cta-note">
          Connect your account to replace this example with your own tariff and half-hourly electricity use.
        </span>
      </p>

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
          safetyNote={safetyNote}
          controls={controls}
          primarySelector={primarySelector}
          // OA-143/OA-136/OA-152: "Tab 1, 2 and 3 should share the same
          // high-level layout" -- left = choice/explanation, right =
          // outcome, for all three stages now. OA-152 moved Optimise off
          // OA-137's inverted "context-right" arrangement (headline saving
          // dominant on the left) to this same `'result-right'` grammar, so
          // its hero card sits in the same compact right-hand column
          // Compare's own hero already uses, "reusing the same actual
          // result-card component as Tab 2" rather than a mirrored layout
          // of it.
          splitLayout="result-right"
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
          // OA-105/OA-109/OA-168: the same shared events throughout the
          // story, as plain annotations (see LandingTimeProfile.tsx's doc
          // comment for why nothing here is draggable any more).
          events={eventOverlays}
          // OA-156: the Step 1 -> Step 2 -> Step 3 nav, rendered inside
          // this card between the narrative above and the chart below --
          // replaces the old top-of-section drag scrubber.
          // OA-155: once the current tariff is Smart, this whole slot
          // becomes the sign-up prompt instead -- there's no genuine next
          // step to show the step nav for, so it's replaced here, not
          // left visible-but-disabled next to an unrelated message
          // elsewhere on the card.
          stepNav={
            currentTariffIsSmart ? (
              <p className="landing-demo__smart-gate">
                Already on a smart tariff?{' '}
                <Link to="/login" className="landing-demo__smart-gate-link">
                  Sign up
                </Link>{' '}
                to start finding what you could save by using it better.
              </p>
            ) : (
              <LandingStepNav
                steps={STEP_NAV_STAGES}
                activeIndex={clampedProgress}
                onStepChange={setProgress}
                // OA-117: locks the Optimise step until the chosen
                // comparison tariff is Smart.
                maxReachableIndex={maxReachableStageIndex}
                aria-label="Demo story stage"
              />
            )
          }
        />
      </div>

      {/* OA-166: "Typical household" explained -- what the model is, what
          it's based on, what it includes, where the sources are, and a
          route to the detailed savings calculation. Opened from the
          header above; this dialog never duplicates that detailed
          calculation itself (the "How we calculated this" disclosure at
          Optimise), only links to it. */}
      <Dialog
        isOpen={isHouseholdInfoOpen}
        onClose={() => setIsHouseholdInfoOpen(false)}
        titleId={householdInfoTitleId}
        title="About this model"
      >
        <h3>What &ldquo;Typical household&rdquo; means</h3>
        <p>
          This is a representative household model used to demonstrate how Shift &amp; Save works — it is{' '}
          <strong>not your own smart-meter data</strong>, and it is not claiming to describe every household. Every
          figure you see in this demo is a modelled estimate for the scenario currently selected, not a measurement.
        </p>

        <h3>What it&rsquo;s based on</h3>
        <p>The usage and pricing shown here are built from published, sourced data:</p>
        <ul>
          <li>Ofgem&rsquo;s typical domestic electricity-usage assumptions (annual kWh and the price cap).</li>
          <li>Elexon&rsquo;s domestic half-hourly load-profiling methodology, for how usage is spread across a day.</li>
          <li>Representative appliance and timing assumptions for the demo household (see below).</li>
          <li>Real published tariff-rate data for the comparison (Octopus Energy&rsquo;s Agile and Fixed products).</li>
        </ul>
        <p>
          Ofgem and Elexon inform the overall shape and scale of usage — they don&rsquo;t specify exactly when any one
          named appliance runs. Appliance timings are the demo&rsquo;s own representative assumption, not a figure
          published by either source.
        </p>

        <h3>What assumptions are included</h3>
        <p>The demo household&rsquo;s events ({applianceLabelList}) are each modelled with:</p>
        <ul>
          <li>A representative time of day it typically runs.</li>
          <li>How often it recurs in a typical week.</li>
          <li>Whether it&rsquo;s flexible (its timing can realistically move) or fixed in place.</li>
        </ul>
        <p>These are kept deliberately understandable rather than exposing every modelling detail.</p>

        <h3>How the savings are calculated</h3>
        <p>
          The tariff and timing savings shown on Optimise come from a documented calculation, not this dialog&rsquo;s
          summary.{' '}
          {canReachOptimiseStage ? (
            <button
              type="button"
              className="dialog__link-button"
              onClick={() => {
                setIsHouseholdInfoOpen(false)
                setProgress(2)
              }}
            >
              See how we calculated the savings
            </button>
          ) : (
            'Choose a Smart tariff on Baseline, then open "How we calculated this" on the Optimise step to see the full breakdown.'
          )}
        </p>

        <h3>Sources</h3>
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
        <p>
          Agile profile based on median half-hour prices from real published Agile rates, {LANDING_DEMO_DATA_SOURCES.tariffRegion},{' '}
          {LANDING_DEMO_DATA_SOURCES.tariffDateRange}.
        </p>
      </Dialog>

      {/* OA-167: the fuller appliance-safety information, opened from the
          short note shown alongside Optimise's results. */}
      <Dialog
        isOpen={isSafetyInfoOpen}
        onClose={() => setIsSafetyInfoOpen(false)}
        titleId={safetyInfoTitleId}
        title="Safety information"
      >
        <p>
          Timing suggestions here are informational. Shift &amp; Save doesn&rsquo;t control your appliances — you
          decide whether a suggested time is safe and appropriate for your appliance, your home and your
          circumstances.
        </p>
        <ul>
          <li>Always follow your appliance&rsquo;s manufacturer instructions.</li>
          <li>Don&rsquo;t leave an appliance running unattended if the manufacturer, or normal safe-use guidance, advises against it.</li>
          <li>Never override fire, electrical or ventilation safety to use cheaper electricity.</li>
          <li>Don&rsquo;t obstruct an appliance&rsquo;s ventilation.</li>
          <li>Don&rsquo;t use a damaged appliance, plug or cable.</li>
          <li>Only schedule appliances that are designed and suitable for delayed or unattended operation.</li>
        </ul>
        <p>
          These suggestions are based on tariff timing and the modelled constraints shown in this demo — not an
          inspection of your specific appliance or home. Shift &amp; Save provides informational, modelled timing
          suggestions only; unless a future, explicit automation feature says otherwise, it never controls your
          appliances for you.
        </p>
      </Dialog>
    </section>
  )
}

export default LandingDemo
