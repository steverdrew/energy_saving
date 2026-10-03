import type { HeatMapDay, HeatMapSlot } from '../components/heatMapMath'
import type { ApplianceEvent } from './applianceEvents'
import { FAMILY_TYPICAL_APPLIANCE_EVENTS, isRealApplianceEvent, totalEventKwh } from './applianceEvents'

/**
 * OA-99: fixture data for the logged-out "Typical household" comparison
 * demo, grounded in published UK household energy data rather than
 * invented numbers (OA-77's original "illustrative" fixture) -- see
 * `LANDING_DEMO_DATA_SOURCES` below for the full provenance of each
 * figure, and LandingDemo.tsx's "Sources" disclosure for where this is
 * surfaced in the UI.
 */

// OA-85: "the graph should read as a multi-day time landscape, not a small
// analytical matrix" -- four consecutive example days, the last of which
// is the detail day the headline kWh/£ stat above the chart describes.
// Deliberately identical shape every day (one typical-household day
// repeated) rather than randomised -- the per-slot figures already come
// from real published sources (see below); day-to-day variance is not
// something any of those sources models for this demo.
const DEMO_DAY_DATES = ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15']

// OA-99: Ofgem's current medium Typical Domestic Consumption Value (TDCV)
// for electricity -- Profile Class 1 / standard single-rate, effective
// 1 July 2026 (Ofgem, "Review of typical domestic consumption values:
// decision", 27 May 2026). An annual-average day is this divided by 365.
const OFGEM_TDCV_ELECTRICITY_KWH_PER_YEAR = 2500
const TYPICAL_DAILY_KWH = OFGEM_TDCV_ELECTRICITY_KWH_PER_YEAR / 365 // ~6.85 kWh/day

// OA-105: "Tabs 1, 2 and 3 need to share the same event model" -- one
// shared set of named, identifiable household events, used unchanged
// across Baseline/Compare/Optimise, rather than a single appliance
// invented just for the Optimise tab. Each event's duration/kWh is a
// modelled assumption (OA-73/76), not a published figure -- that's the
// one shape element this demo still has to choose for itself. Every
// half-hour of consumption not claimed by a named event here stays
// unidentified background/base load (BASE_LOAD_KWH below) -- never
// silently folded into one of these, per OA-73's "ambiguous usage is
// never silently treated as shiftable".
// OA-160: the event type and "typical household" event list now live in
// `./applianceEvents.ts`, shared with the canonical savings model's
// `family-typical` archetype -- re-exported here under their established
// names so this module's own consumers (LandingDemo.tsx,
// LandingTimeProfile.tsx) need no changes.
export type HouseholdEventDefinition = ApplianceEvent
export { totalEventKwh }
export const isRealHouseholdEvent = isRealApplianceEvent
export const LANDING_DEMO_EVENTS: readonly HouseholdEventDefinition[] = FAMILY_TYPICAL_APPLIANCE_EVENTS

const TOTAL_EVENTS_KWH = LANDING_DEMO_EVENTS.reduce((sum, e) => sum + totalEventKwh(e), 0)

// OA-99: the diurnal *shape* (relative weight per half-hour slot, before
// scaling) follows the general pattern documented for Elexon's domestic
// Profile Class 1 (Domestic Unrestricted) load profile -- an overnight
// trough, a morning rise, a quieter midday plateau, and a pronounced
// evening peak (Elexon, "Profiling"/"What is a Load Profile?"; Elexon's
// Load Shaping Service, built from actual smart-meter half-hourly data
// across 100,000+ domestic sites, 1 April 2023 - 31 March 2024, describes
// the same general shape). Elexon's own enumerated 48-period coefficient
// table lives in the Elexon Portal's Market Domain Data repository, which
// isn't a public, scrapeable export -- so this is a shape *consistent
// with* PC1's documented characteristics, scaled to the real Ofgem daily
// total below, rather than a literal copy of Elexon's coefficient table.
// `usageSource` in `LANDING_DEMO_DATA_SOURCES` records this limitation
// explicitly rather than implying more precision than this has.
//
// Excludes the flexible load (added separately below) -- these 48
// relative weights are normalised and scaled so that base-load-only
// usage, plus the flexible load, sums to exactly `TYPICAL_DAILY_KWH`.
const BASE_LOAD_SHAPE: number[] = [
  0.1, 0.09, 0.09, 0.08, 0.08, 0.09, 0.09, 0.1, 0.1, 0.11, 0.11, 0.12, 0.22, 0.3, 0.28, 0.24, 0.2, 0.18, 0.14, 0.14,
  0.13, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15, 0.14, 0.14, 0.14, 0.14, 0.22, 0.3, 0.38, 0.42, 0.4, 0.36, 0.34, 0.3,
  0.26, 0.22, 0.18, 0.16, 0.15, 0.14, 0.13, 0.12,
]

const BASE_LOAD_KWH: number[] = (() => {
  const shapeTotal = BASE_LOAD_SHAPE.reduce((sum, v) => sum + v, 0)
  const targetBaseTotal = TYPICAL_DAILY_KWH - TOTAL_EVENTS_KWH
  const scale = targetBaseTotal / shapeTotal
  return BASE_LOAD_SHAPE.map((v) => v * scale)
})()

// OA-99: Ofgem's price-cap average Direct Debit electricity unit rate for
// 1 October - 31 December 2026 (Ofgem, "Changes to energy price cap
// between 1 October and 31 December 2026") -- used as the Standard
// Variable reference rate rather than an invented p/kWh figure. Flat
// across all 48 slots, same as a real single-rate tariff.
const OFGEM_PRICE_CAP_AVERAGE_UNIT_RATE_PENCE = 26.32
// Published alongside the unit rate above for completeness (and surfaced
// in the UI's cost-basis note), but deliberately not added into any
// displayed cost figure -- see the "usage cost only" note in
// LandingDemo.tsx. Isolating the tariff/timing effect from a fixed daily
// charge that doesn't vary by tariff or usage timing is what OA-99 asks
// for ("do not silently mix the two").
export const OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY = 54.83

const STANDARD_VARIABLE_RATE_PENCE: number[] = new Array(48).fill(OFGEM_PRICE_CAP_AVERAGE_UNIT_RATE_PENCE)

// OA-132: "Fixed" needs its own real rate, distinct from "Flexible"'s
// Standard Variable price-cap rate, or choosing between the two in the
// demo could never actually change the figure. Sourced the same way as
// Agile (Octopus's own public tariff API, not a derived/invented number):
// Octopus Energy, product `OE-FIX-12M-26-10-02` ("Octopus 12M Fixed
// October 2026 v1"), electricity tariff `E-1R-OE-FIX-12M-26-10-02-C`
// (region C/London, the same region Agile's rates use), `direct_debit_monthly`
// .standard_unit_rate_inc_vat, fetched from api.octopus.energy on
// 2026-10-03. A single agreed rate for the fixed term, flat across all 48
// slots like Standard Variable -- the two tariffs differ in price and in
// what the user is trading (flexibility vs certainty), not in shape.
const FIXED_TARIFF_RATE_PENCE_VALUE = 27.0519
const FIXED_TARIFF_RATE_PENCE: number[] = new Array(48).fill(FIXED_TARIFF_RATE_PENCE_VALUE)

// OA-127: Economy 7's two-rate day/night structure -- a higher daytime
// rate and a cheaper 7-hour overnight rate, rather than a single flat
// rate (Standard Variable) or 48 distinct half-hourly prices (Agile).
// Octopus's own Economy 7 day/night differential (day rate uplifted over
// a single-rate average, night rate roughly half the day rate) isn't
// published as a precise, dated per-kWh figure the way the Ofgem price
// cap average or Octopus's Agile API rates are -- so these are a
// documented *plausible* estimate consistent with that general
// differential, not a verified published figure the way
// OFGEM_PRICE_CAP_AVERAGE_UNIT_RATE_PENCE/AGILE_REPRESENTATIVE_RATE_PENCE
// are. See `LANDING_DEMO_DATA_SOURCES.economy7Source` for this caveat
// surfaced in the UI.
const ECONOMY_7_DAY_RATE_PENCE = 29.5
const ECONOMY_7_NIGHT_RATE_PENCE = 14.5

// OA-127/OA-133: "For Octopus smart meters, the fixed off-peak period is
// 00:30-07:30 UTC, which becomes 01:30-08:30 during BST." The documented
// window is defined in UTC -- it's each slot's real UTC clock time that
// determines off-peak, not an assumed local-time slot range (which would
// silently go wrong the moment a demo date fell outside BST). This checks
// each slot's own `startsAt` instant directly, the same way
// `isStructuralPeakSlot` does for Agile's structural peak, rather than
// hard-coding "slot 3 through slot 16" as a fact about local time.
const ECONOMY_7_OFF_PEAK_WINDOW_UTC_MINUTES = { start: 30, end: 7 * 60 + 30 } // 00:30-07:30 UTC

function isEconomy7OffPeakSlot(startsAtIso: string): boolean {
  const d = new Date(startsAtIso)
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  return (
    utcMinutes >= ECONOMY_7_OFF_PEAK_WINDOW_UTC_MINUTES.start && utcMinutes < ECONOMY_7_OFF_PEAK_WINDOW_UTC_MINUTES.end
  )
}

// OA-127: "do not render it as a fake 48-rate Agile-style tariff" --
// exactly two distinct values across the 48 slots, one for the 7-hour
// off-peak window and one for every other half-hour. OA-133: computed
// from a representative date's real per-slot UTC time (every
// `DEMO_DAY_DATES` entry is June, so every date in this fixture resolves
// to the same local off-peak window) rather than a hand-picked slot
// range -- correct for this fixture's actual dates, and would stay
// correct if a future date crossed a DST boundary, since each slot's own
// instant is what's actually checked.
const ECONOMY_7_RATE_PENCE: number[] = Array.from({ length: 48 }, (_, slot) =>
  isEconomy7OffPeakSlot(startsAtFor(DEMO_DAY_DATES[0], slot)) ? ECONOMY_7_NIGHT_RATE_PENCE : ECONOMY_7_DAY_RATE_PENCE,
)

// OA-133: the real off-peak slot range, derived from the same per-slot
// UTC check above rather than asserted -- kept exported so tests (and
// `cheapestStartSlotForEvent`'s Economy 7 overnight-window reasoning
// elsewhere) can reference "the off-peak window" without re-deriving it,
// while staying structurally impossible to drift out of sync with
// `ECONOMY_7_RATE_PENCE` itself.
export const ECONOMY_7_OFF_PEAK_SLOT_RANGE = (() => {
  const offPeakSlots = Array.from({ length: 48 }, (_, slot) => slot).filter((slot) =>
    isEconomy7OffPeakSlot(startsAtFor(DEMO_DAY_DATES[0], slot)),
  )
  return { min: Math.min(...offPeakSlots), max: Math.max(...offPeakSlots) }
})()

// OA-99 (second pass): a representative Agile day, not a cherry-picked
// historical date -- the median of each of the 48 daily clock slots'
// real published Octopus Agile half-hourly unit rates (product
// AGILE-24-10-01, tariff E-1R-AGILE-24-10-01-C, region C/London), over
// the latest complete 12-month period at the time this fixture was
// built (1 October 2025 - 30 September 2026: 365 observations per slot,
// fetched page-by-page from api.octopus.energy and bucketed into
// Europe/London clock slots before taking the median -- see
// `LANDING_DEMO_DATA_SOURCES.aggregationMethod`/`sourceUrls` below).
// Frozen here rather than re-fetched/re-aggregated on every landing-page
// render, same as the earlier single-day snapshot this replaces. Index 0
// is 00:00 London time, index 47 is 23:30.
//
// This keeps the genuine tendency for 16:00-19:00 to be more expensive
// (medians ~31-36p/kWh vs. a ~16-20p/kWh baseline either side) while
// every one of the 48 slots still carries its own distinct price --
// Agile is not three fixed tariff bands (see heatMapMath.ts's
// `rateRatio`/`isStructuralPeakSlot`, which replaced the earlier
// `rateCategoryIndex` cheap/standard/peak model).
//
// The *median* across 365 days smooths away the rare extremes real
// Agile pricing can produce -- none of these 48 values happens to be
// negative, even though 497 of the 17,520 underlying half-hourly
// observations were (observed range: -11.28p to 86.73p/kWh, well inside
// Agile's documented £1/kWh cap). That range is preserved in
// `LANDING_DEMO_DATA_SOURCES` so the UI/sources disclosure can say so
// honestly, per OA-99's "preserve those possibilities in the data model
// even if the representative fixture does not happen to contain a
// negative slot."
const AGILE_REPRESENTATIVE_RATE_PENCE: number[] = [
  17.0415, 17.5665, 16.9785, 16.653, 16.632, 15.96, 16.338, 15.813, 16.38, 16.107, 16.905, 16.8, 17.8605, 19.425,
  19.1835, 20.7585, 19.635, 19.53, 18.711, 17.976, 17.577, 17.01, 16.611, 16.296, 16.2015, 16.023, 16.3485, 15.918,
  16.17, 16.1595, 16.653, 17.514, 31.059, 32.6865, 33.432, 34.3245, 35.364, 35.7, 23.163, 22.6065, 22.26, 21.7665,
  21.651, 19.74, 19.383, 17.283, 18.333, 17.514,
]

// OA-127/OA-132: the four named tariffs Compare/Optimise can resolve to --
// "do not use invented placeholder savings in production" means every one
// keeps using a real, sourced rate (see each rate constant's own comment),
// never an invented structure. OA-132 reframes the *primary* Compare
// choice around tariff type rather than these product names (see
// `TariffCategory` below) -- named products are now the detail underneath
// that choice, not peers of it.
export type TariffId = 'standard-variable' | 'fixed' | 'economy-7' | 'agile'

export const TARIFF_IDS: readonly TariffId[] = ['standard-variable', 'fixed', 'economy-7', 'agile']

export const TARIFF_LABELS: Record<TariffId, string> = {
  'standard-variable': 'Standard Variable',
  fixed: 'Octopus 12M Fixed',
  'economy-7': 'Octopus Economy 7',
  agile: 'Octopus Agile',
}

// OA-132: "first help the user understand which kind of tariff suits
// their household -- product names come second." The three broad tariff
// models the Compare-stage primary selector is actually built around.
// Named products (Economy 7, Agile, and any future time-of-use tariff)
// sit *underneath* 'smart', never as peers of 'flexible'/'fixed' in the
// primary choice.
export type TariffCategory = 'flexible' | 'fixed' | 'smart'

export const TARIFF_CATEGORY: Record<TariffId, TariffCategory> = {
  'standard-variable': 'flexible',
  fixed: 'fixed',
  'economy-7': 'smart',
  agile: 'smart',
}

// OA-132: which named products the 'smart' category can resolve to in
// this demo -- "the model should determine the relevant smart tariff
// rather than the UI assuming Agile is always the answer" means this is
// a list to choose among (surfaced as secondary "Smart · <product>"
// detail), not a single hard-coded answer.
export const SMART_TARIFF_IDS: readonly TariffId[] = TARIFF_IDS.filter((id) => TARIFF_CATEGORY[id] === 'smart')

const TARIFF_RATES_PENCE: Record<TariffId, number[]> = {
  'standard-variable': STANDARD_VARIABLE_RATE_PENCE,
  fixed: FIXED_TARIFF_RATE_PENCE,
  'economy-7': ECONOMY_7_RATE_PENCE,
  agile: AGILE_REPRESENTATIVE_RATE_PENCE,
}

function ratesForTariff(tariffId: TariffId): number[] {
  return TARIFF_RATES_PENCE[tariffId]
}

// OA-105: event IDs are opaque strings elsewhere (component props, test
// fixtures) -- this lookup is the one place that needs to find an event's
// own definition back from its id.
function getEvent(id: string): HouseholdEventDefinition {
  const event = LANDING_DEMO_EVENTS.find((e) => e.id === id)
  if (!event) throw new Error(`Unknown landing demo event id: ${id}`)
  return event
}

/** OA-107: the earliest slot `event` may start at, given `currentPositions` (keyed by event id -- an override if that event has moved, else undefined). For a dependent event (tumble dryer), this is the referenced event's current end slot, floored at this event's own static window minimum; for any other event it's just that static minimum. */
function dependencyMinStartSlot(event: HouseholdEventDefinition, currentPositions: Record<string, number>): number {
  if (!event.dependsOnEventId) return event.validStartSlotRange.min
  const dependency = getEvent(event.dependsOnEventId)
  const dependencyStart = currentPositions[dependency.id] ?? dependency.actualStartSlot
  return Math.max(event.validStartSlotRange.min, dependencyStart + dependency.slotCount)
}

/** OA-107: this event's actual valid window right now -- the static `validStartSlotRange`, narrowed by `dependencyMinStartSlot` when it depends on another event. `currentPositions` only needs an entry for events that have moved away from their `actualStartSlot`. Defensive against a dependency pushing the effective min past this event's own static max (clamped so min never exceeds max). */
export function effectiveValidStartSlotRange(
  eventId: string,
  currentPositions: Record<string, number> = {},
): { min: number; max: number } {
  const event = getEvent(eventId)
  const max = event.validStartSlotRange.max
  const min = Math.min(dependencyMinStartSlot(event, currentPositions), max)
  return { min, max }
}

/** Snaps a candidate start slot to the half-hour grid and keeps it inside this event's own valid same-day window -- dependency-narrowed per `effectiveValidStartSlotRange` when `currentPositions` is supplied. */
export function clampEventStartSlot(
  eventId: string,
  startSlot: number,
  currentPositions: Record<string, number> = {},
): number {
  const { min, max } = effectiveValidStartSlotRange(eventId, currentPositions)
  const rounded = Math.round(startSlot)
  return Math.max(min, Math.min(max, rounded))
}

function eventCostPence(event: HouseholdEventDefinition, startSlot: number, ratePence: number[]): number {
  let cost = 0
  for (let i = 0; i < event.slotCount; i++) cost += event.kwhShape[i] * ratePence[startSlot + i]
  return cost
}

/** OA-106/OA-107/OA-127: "Optimise all" -- the single cheapest *valid* start slot for this event, costed against the given tariff's rates (Agile by default, for existing callers) and same-day validity window as manual dragging (dependency-narrowed via `effectiveValidStartSlotRange` when `currentPositions` is supplied), so it can never place an event somewhere a drag couldn't, and never ahead of a dependency it hasn't resolved yet. Callers that optimise several events at once (LandingDemo.tsx's `optimiseAll`) must resolve a dependency's own event before calling this for its dependent, passing the growing `currentPositions` map along. OA-127: "Economy 7 optimisation should prefer the valid overnight off-peak window, Agile should continue to use its 48 half-hour prices" -- both fall naturally out of the same cheapest-valid-slot search once it's costed against the selected tariff's own rate array. */
export function cheapestStartSlotForEvent(
  eventId: string,
  currentPositions: Record<string, number> = {},
  tariffId: TariffId = 'agile',
): number {
  const event = getEvent(eventId)
  const { min, max } = effectiveValidStartSlotRange(eventId, currentPositions)
  const ratePence = ratesForTariff(tariffId)
  let bestSlot = min
  let bestCost = Infinity
  for (let slot = min; slot <= max; slot++) {
    const cost = eventCostPence(event, slot, ratePence)
    if (cost < bestCost) {
      bestCost = cost
      bestSlot = slot
    }
  }
  return bestSlot
}

// OA-104: "do not simply calculate today's saving x 365" -- a deterministic,
// explicitly-documented recurrence assumption instead (`occurrencesPerWeek`
// on each `HouseholdEventDefinition` above). There is no published
// Ofgem/Elexon figure for "how often does a household run its dishwasher",
// so these are named as demo assumptions, not implied to be measured.
const WEEKS_PER_YEAR = 52

/** OA-104/105: the per-event detail needed to inspect and project one household event's opportunity. */
export interface LandingDemoEventProjection {
  id: string
  label: string
  durationMinutes: number
  kwh: number
  currentStartSlot: number
  validStartSlotRange: { min: number; max: number }
  /** Saving for this one occurrence, at its current position -- same sign convention as `timingSavingPence` (positive = cheaper). */
  savingPerOccurrencePence: number
  occurrencesPerWeek: number
  projectedMonthlySavingPence: number
  projectedAnnualSavingPence: number
}

/** OA-104: the household-level projection -- today's modelled saving plus the recurrence-based monthly/annual estimate it implies, summed across every household event. */
export interface LandingDemoProjection {
  dailyPotentialSavingPence: number
  projectedMonthlySavingPence: number
  projectedAnnualSavingPence: number
  events: LandingDemoEventProjection[]
}

function buildEventProjection(
  event: HouseholdEventDefinition,
  currentStartSlot: number,
  savingPerOccurrencePence: number,
): LandingDemoEventProjection {
  const projectedAnnualSavingPence = savingPerOccurrencePence * event.occurrencesPerWeek * WEEKS_PER_YEAR
  return {
    id: event.id,
    label: event.label,
    durationMinutes: event.slotCount * 30,
    kwh: totalEventKwh(event),
    currentStartSlot,
    validStartSlotRange: event.validStartSlotRange,
    savingPerOccurrencePence,
    occurrencesPerWeek: event.occurrencesPerWeek,
    // A calendar year's 12 months don't divide 52 weeks evenly -- deriving
    // monthly from the annual figure (rather than its own
    // weeks-per-month x occurrences calculation) keeps monthly x 12
    // exactly equal to the annual figure shown alongside it.
    projectedMonthlySavingPence: projectedAnnualSavingPence / 12,
    projectedAnnualSavingPence,
  }
}

/** OA-105: lays every household event's kWh onto the base/background load at the given per-event positions -- the base load plus this is what "named events + residual demand reconcile to the baseline half-hour profile" means. */
function withEventsAt(positions: Record<string, number>): number[] {
  const usage = [...BASE_LOAD_KWH]
  for (const event of LANDING_DEMO_EVENTS) {
    const start = positions[event.id]
    for (let i = 0; i < event.slotCount; i++) usage[start + i] += event.kwhShape[i]
  }
  return usage
}

// Bug fix: this previously suffixed the wall-clock time with "Z" (UTC),
// so slot 0 (meant to be 00:00 London) was stored as 00:00 UTC -- which
// formatSlotTime (Europe/London) then rendered as 01:00 during British
// Summer Time, since DEMO_DAY_DATES are all June dates. The whole 48-slot
// day read as 01:00-00:30 instead of the intended 00:00-23:30. All four
// demo dates fall in BST (UTC+1 year-round for this fixed June range), so
// an explicit "+01:00" offset -- rather than "Z" -- stores each slot as
// the London wall-clock time it's meant to represent.
function startsAtFor(date: string, slotIndex: number): string {
  const hours = Math.floor(slotIndex / 2)
  const minutes = (slotIndex % 2) * 30
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+01:00`
}

function buildDay(date: string, usageKwh: number[], ratePence: number[]): HeatMapDay {
  const slots: HeatMapSlot[] = usageKwh.map((kwh, i) => ({
    startsAt: startsAtFor(date, i),
    kwh,
    unitRateIncVatPence: ratePence[i],
    costPence: kwh * ratePence[i],
  }))
  return { date, slots }
}

function buildDays(usageKwh: number[], ratePence: number[]): HeatMapDay[] {
  return DEMO_DAY_DATES.map((date) => buildDay(date, usageKwh, ratePence))
}

function sumKwh(usage: number[]): number {
  return usage.reduce((sum, v) => sum + v, 0)
}

function sumCostPence(usage: number[], rate: number[]): number {
  return usage.reduce((sum, v, i) => sum + v * rate[i], 0)
}

export interface LandingDemoStep {
  tariffName: string
  totalKwh: number
  totalCostPence: number
  /** The detail day the headline kWh/£ stat describes -- the last entry of `days`. */
  day: HeatMapDay
  /** OA-85: the multi-day landscape shown in the heat map (see DEMO_DAY_DATES). */
  days: HeatMapDay[]
}

/**
 * OA-99: provenance for every figure in the fixture, kept in code (not
 * only in landing-page copy) so it's testable and inspectable by browser
 * automation -- see LandingDemo.tsx's "Sources" disclosure for where this
 * surfaces in the UI.
 */
export interface LandingDemoDataSources {
  /** Basis for the 48-slot usage shape, and its known limitation (see BASE_LOAD_SHAPE's own comment). */
  usageSource: string
  /** Basis for the annual/daily kWh total used to scale that shape. */
  annualKwhSource: string
  /** Basis for the Compare/Optimise tariff's half-hourly rates. */
  tariffSource: string
  /** OA-132: basis for the "Fixed" category's own rate, distinct from "Flexible"'s Standard Variable rate. */
  fixedTariffSource: string
  /** OA-99: a single, explicitly-labelled reference region -- Agile prices vary by region, and a documented multi-region UK blend wasn't methodologically supportable within this fixture's scope, so this is named rather than silently implied to be national. */
  tariffRegion: string
  /** The historical period the representative rates were aggregated from (see `aggregationMethod`). */
  tariffDateRange: string
  /** How `representativeRates48` was derived from real published Agile rates. */
  aggregationMethod: string
  /** The 48 representative median p/kWh values themselves -- the exact rates Compare/Optimise are costed against, exposed here so the fixture's own provenance is inspectable without reaching into module-private constants. */
  representativeRates48: number[]
  /** The real min/max unit rate actually observed across every underlying half-hourly record aggregated into `representativeRates48` -- not the (smoothed) median values above, which don't happen to include a negative slot. Documents that Agile's documented possibility of negative prices and its £1/kWh cap are real, observed behaviour, even though the representative day built from them doesn't surface a negative median. */
  observedRateRangePence: { min: number; max: number }
  /** How many of the underlying half-hourly records (out of 17,520) were negative. */
  negativeRateObservationCount: number
  sourceUrls: {
    ofgemTdcv: string
    ofgemPriceCap: string
    elexonProfiling: string
    octopusAgileApi: string
    /** Octopus's own explanation of how Agile prices are calculated -- the source for the 16:00-19:00 structural peak and the £1/kWh cap / negative-price behaviour. */
    octopusAgilePricing: string
    /** Octopus's Economy 7 explainer -- the source for the smart-meter 00:30-07:30 UTC off-peak window. */
    octopusEconomy7: string
  }
  /** OA-127: Economy 7's day/night rate split -- flagged explicitly as a plausible estimate, not a verified published figure (unlike `tariffSource`/`ofgemPriceCap` above). See the constant's own comment in this file for why. */
  economy7Source: string
  fixtureVersion: string
  /** When this fixture (including the representative-rate aggregation) was last built/snapshotted. */
  fixtureBuiltAt: string
}

export const LANDING_DEMO_DATA_SOURCES: LandingDemoDataSources = {
  usageSource:
    "Shape consistent with Elexon's documented domestic Profile Class 1 (Domestic Unrestricted) diurnal pattern -- Elexon's own enumerated 48-period coefficient table is published via the Elexon Portal's Market Domain Data repository, not a public scrapeable export, so this is a representative shape rather than a literal copy of that table.",
  annualKwhSource: "Ofgem medium Typical Domestic Consumption Value for electricity (Profile Class 1), 2,500 kWh/year, effective 1 July 2026.",
  tariffSource:
    'Octopus Agile (product AGILE-24-10-01, tariff E-1R-AGILE-24-10-01-C) -- median of real published half-hourly unit rates for each of the 48 daily clock slots, fetched from the Octopus Energy public API.',
  fixedTariffSource:
    'Octopus 12M Fixed October 2026 v1 (product OE-FIX-12M-26-10-02, tariff E-1R-OE-FIX-12M-26-10-02-C, region C/London) -- standard_unit_rate_inc_vat, fetched from the Octopus Energy public API on 2026-10-03.',
  tariffRegion: 'C (London)',
  tariffDateRange: '2025-10-01 to 2026-09-30 (latest complete 12 months)',
  aggregationMethod:
    'For each of the 48 daily half-hour clock slots (Europe/London time), the median of that slot’s real published Agile unit rate across all 365 days in the date range above (17,520 half-hourly records total, 365 observations per slot) -- not a single cherry-picked historical day.',
  representativeRates48: AGILE_REPRESENTATIVE_RATE_PENCE,
  observedRateRangePence: { min: -11.277, max: 86.73 },
  negativeRateObservationCount: 497,
  sourceUrls: {
    ofgemTdcv: 'https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf',
    ofgemPriceCap: 'https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026',
    elexonProfiling: 'https://www.elexon.co.uk/bsc/settlement/profiling/',
    octopusAgileApi: 'https://developer.octopus.energy/guides/rest/api-endpoints/',
    octopusAgilePricing: 'https://octopus.energy/help-and-faqs/articles/how-calculate-prices-shape-shifters-agile/',
    octopusEconomy7: 'https://octopus.energy/smart/economy-7/',
  },
  economy7Source:
    'Economy 7 day/night rates are a plausible estimate consistent with the general published differential between Economy 7 day and night unit rates (day rate uplifted over a single-rate average, night rate roughly half the day rate) -- not a single verified, dated per-kWh figure the way the Ofgem price cap average or Octopus Agile API rates are.',
  fixtureVersion: '2026-10-03',
  fixtureBuiltAt: '2026-10-03',
}

// OA-137: "define a deterministic threshold for what counts as a
// meaningful timing saving rather than relying on UI judgement" -- used
// consistently for the headline Optimise state, whether events auto-move,
// whether optimisation controls appear, and the savings copy itself. £10/
// year is a demo-level judgement call (documented here, not scattered
// across the UI layer) -- small enough not to hide a real Smart-tariff
// opportunity, large enough that a flat Flexible/Fixed tariff's near-zero
// optimiser noise never gets rounded up into an apparent saving.
export const MEANINGFUL_ANNUAL_TIMING_SAVING_THRESHOLD_PENCE = 1000

/** OA-137: the one place that decides whether a projected annual timing saving counts as "genuine" -- never a negative or negligible figure dressed up as an opportunity. */
export function hasMeaningfulTimingSavingOpportunity(projectedAnnualSavingPence: number): boolean {
  return projectedAnnualSavingPence >= MEANINGFUL_ANNUAL_TIMING_SAVING_THRESHOLD_PENCE
}

/** OA-136: one alternative tariff's modelled cost for the exact same household day Compare/Baseline already show -- "same usage, same timings, same total kWh; only pricing changes." `differencePenceVsCurrentTariffPence` is signed so the UI can read it directly: positive means this alternative costs more than the current tariff, negative means it costs less. */
export interface LandingDemoTariffComparisonEntry {
  tariffId: TariffId
  tariffName: string
  totalCostPence: number
  differencePenceVsCurrentTariffPence: number
  // OA-136 (updated spec): "annualised value can be shown as a secondary
  // figure where the model supports it" -- unlike the timing-saving
  // projection above, a tariff's per-day rate difference genuinely recurs
  // every day of the year (it isn't tied to how often a flexible event
  // happens to run), so a straight x365 projection is the correct model
  // here, not the "do not simply calculate today's saving x 365" case
  // `projection.projectedAnnualSavingPence` exists to avoid.
  //
  // OA-146: derived from the *displayed* (penny-rounded) daily figure, not
  // the raw one -- the UI's daily line already rounds
  // `differencePenceVsCurrentTariffPence` to the nearest penny, and an
  // unrounded x365 can disagree with that rounded daily figure by several
  // pounds a year once it's then rounded again for its own display (e.g.
  // 14.22p/day genuinely rounds to "14p" but 14.22p x 365 rounds to
  // "£51.90", not the £51.10 that 14p x 365 actually is). Rounding once,
  // here, and deriving every other period from that same rounded value is
  // what keeps daily x365 == annual after display rounding, for any
  // precision the UI chooses to show either at.
  annualDifferencePence: number
  isCurrentTariff: boolean
}

export interface LandingDemoFixture {
  baseline: LandingDemoStep
  compare: LandingDemoStep
  optimise: LandingDemoStep
  /** baseline cost minus compare cost, for identical usage -- the tariff-choice opportunity. */
  tariffSwitchSavingPence: number
  /** compare cost minus optimise cost, for the same tariff -- the timing opportunity, kept separate from the above. */
  timingSavingPence: number
  /** OA-104: today's timing saving projected into a monthly/annual equivalent, from each flexible event's own recurrence assumption -- never a naive "today x 365". */
  projection: LandingDemoProjection
  /** OA-136: every tariff (including the current one) modelled against this exact same household day -- "show the alternative tariff types/products with their modelled daily energy cost and difference from the current tariff." */
  tariffComparison: LandingDemoTariffComparisonEntry[]
  /** OA-137: whether `projection.projectedAnnualSavingPence` clears the deterministic meaningful-saving threshold -- the single flag the UI gates auto-optimisation, controls and copy on, so none of those can drift out of sync with each other. */
  hasTimingSavingOpportunity: boolean
}

export function buildLandingDemoFixture(
  // OA-105: "no event appears for the first time on Tab 3" -- Optimise
  // starts from the exact same (actualStartSlot) positions as
  // Baseline/Compare; a caller only needs to pass the events it has
  // actually dragged. Keyed by event id, not array order, so a partial
  // override (one event moved) can't accidentally shift the other.
  optimiseEventStartSlots: Partial<Record<string, number>> = {},
  // OA-127: which tariff Compare/Optimise are costed against. Defaults to
  // 'agile' so every existing caller (and this file's own tests) keeps
  // its original behaviour unchanged.
  tariffId: TariffId = 'agile',
  // OA-135: the tariff the household is modelled as currently being on --
  // Baseline is costed against this (not always Standard Variable any
  // more), and it's the reference `tariffSwitchSavingPence`/
  // `tariffComparison` are measured against. Defaults to
  // 'standard-variable' so every existing caller keeps its original
  // Baseline-is-Standard-Variable behaviour unchanged.
  currentTariffId: TariffId = 'standard-variable',
): LandingDemoFixture {
  const baselinePositions: Record<string, number> = {}
  const optimisePositions: Record<string, number> = {}
  // OA-107: resolve independent events before any event that depends on
  // one of them, so `clampEventStartSlot`'s dependency check sees the
  // dependency's *already-resolved* position (override or actual), not an
  // unresolved placeholder -- a plain stable sort keeps this correct for
  // the one dependency level this fixture models (tumble dryer after
  // washing machine) without needing a general topological sort.
  const dependencyOrderedEvents = [...LANDING_DEMO_EVENTS].sort(
    (a, b) => (a.dependsOnEventId ? 1 : 0) - (b.dependsOnEventId ? 1 : 0),
  )
  for (const event of dependencyOrderedEvents) {
    baselinePositions[event.id] = event.actualStartSlot
    const requested = optimiseEventStartSlots[event.id] ?? event.actualStartSlot
    optimisePositions[event.id] = clampEventStartSlot(event.id, requested, optimisePositions)
  }

  const baselineUsage = withEventsAt(baselinePositions)
  const optimisedUsage = withEventsAt(optimisePositions)

  const currentTariffRatePence = ratesForTariff(currentTariffId)
  const selectedTariffRatePence = ratesForTariff(tariffId)

  const baselineDays = buildDays(baselineUsage, currentTariffRatePence)
  const compareDays = buildDays(baselineUsage, selectedTariffRatePence)
  const optimiseDays = buildDays(optimisedUsage, selectedTariffRatePence)

  const baseline: LandingDemoStep = {
    tariffName: TARIFF_LABELS[currentTariffId],
    totalKwh: sumKwh(baselineUsage),
    totalCostPence: sumCostPence(baselineUsage, currentTariffRatePence),
    day: baselineDays[baselineDays.length - 1],
    days: baselineDays,
  }
  const compare: LandingDemoStep = {
    tariffName: TARIFF_LABELS[tariffId],
    totalKwh: sumKwh(baselineUsage),
    totalCostPence: sumCostPence(baselineUsage, selectedTariffRatePence),
    day: compareDays[compareDays.length - 1],
    days: compareDays,
  }
  const optimise: LandingDemoStep = {
    tariffName: TARIFF_LABELS[tariffId],
    totalKwh: sumKwh(optimisedUsage),
    totalCostPence: sumCostPence(optimisedUsage, selectedTariffRatePence),
    day: optimiseDays[optimiseDays.length - 1],
    days: optimiseDays,
  }

  const timingSavingPence = compare.totalCostPence - optimise.totalCostPence

  // OA-105/OA-127: per-event saving is computed directly from that event's
  // own before/after cost under the *selected* tariff (never from a shared
  // total divided up), so it's exact and additive regardless of how many
  // events exist or whether their slots happen to overlap, and reflects
  // Economy 7's overnight window rather than always assuming Agile.
  const events = LANDING_DEMO_EVENTS.map((event) => {
    const savingPerOccurrencePence =
      eventCostPence(event, baselinePositions[event.id], selectedTariffRatePence) -
      eventCostPence(event, optimisePositions[event.id], selectedTariffRatePence)
    return buildEventProjection(event, optimisePositions[event.id], savingPerOccurrencePence)
  })
  const projection: LandingDemoProjection = {
    dailyPotentialSavingPence: timingSavingPence,
    projectedMonthlySavingPence: events.reduce((sum, e) => sum + e.projectedMonthlySavingPence, 0),
    projectedAnnualSavingPence: events.reduce((sum, e) => sum + e.projectedAnnualSavingPence, 0),
    events,
  }

  // OA-136: every tariff modelled against this exact same baseline usage --
  // "same household, same half-hour usage, same appliance events, same
  // timings, same total kWh; only pricing changes." Signed difference vs.
  // the current tariff's own cost, so a cheaper alternative reads negative
  // and a more expensive one positive without the UI re-deriving the sign.
  const currentTariffCostPence = sumCostPence(baselineUsage, currentTariffRatePence)
  const tariffComparison: LandingDemoTariffComparisonEntry[] = TARIFF_IDS.map((id) => {
    const totalCostPence = sumCostPence(baselineUsage, ratesForTariff(id))
    const differencePenceVsCurrentTariffPence = totalCostPence - currentTariffCostPence
    return {
      tariffId: id,
      tariffName: TARIFF_LABELS[id],
      totalCostPence,
      differencePenceVsCurrentTariffPence,
      annualDifferencePence: Math.round(differencePenceVsCurrentTariffPence) * 365,
      isCurrentTariff: id === currentTariffId,
    }
  })

  return {
    baseline,
    compare,
    optimise,
    tariffSwitchSavingPence: baseline.totalCostPence - compare.totalCostPence,
    timingSavingPence,
    projection,
    tariffComparison,
    hasTimingSavingOpportunity: hasMeaningfulTimingSavingOpportunity(projection.projectedAnnualSavingPence),
  }
}
