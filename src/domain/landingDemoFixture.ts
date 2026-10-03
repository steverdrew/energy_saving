import type { HeatMapDay, HeatMapSlot } from '../components/heatMapMath'

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
export interface HouseholdEventDefinition {
  id: string
  label: string
  kwhPerSlot: number
  /** How many contiguous half-hour slots this event occupies -- fixed; moving it changes only which slot(s) it starts at (OA-105: "duration and kWh stay constant"). */
  slotCount: number
  /** The slot this event actually ran at -- shown fixed on Baseline/Compare, and Optimise's starting position before any drag (OA-105: "no event appears for the first time on Tab 3"). */
  actualStartSlot: number
  /** Per OA-73's valid-time-window rules: a dishwasher has no `requiresAwakeHome` constraint (any half-hour that day); a washing machine does (07:00-23:00 local). */
  validStartSlotRange: { min: number; max: number }
  /** OA-104: deterministic, documented recurrence assumption -- not a published figure, not the visitor's own usage. */
  occurrencesPerWeek: number
}

export const LANDING_DEMO_EVENTS: readonly HouseholdEventDefinition[] = [
  {
    id: 'dishwasher',
    label: 'Dishwasher cycle',
    kwhPerSlot: 0.55,
    slotCount: 2,
    actualStartSlot: 36, // 18:00-19:00 -- the representative day's most expensive two slots (see AGILE_REPRESENTATIVE_RATE_PENCE below)
    validStartSlotRange: { min: 0, max: 46 }, // no requiresAwakeHome -- any half-hour that day
    occurrencesPerWeek: 4,
  },
  {
    id: 'washing_machine',
    label: 'Washing machine cycle',
    kwhPerSlot: 0.45,
    slotCount: 2,
    actualStartSlot: 14, // 07:00-08:00 -- a plausible morning wash, distinct from the dishwasher's evening slot
    validStartSlotRange: { min: 14, max: 44 }, // requiresAwakeHome: 07:00-23:00 local (last start that still ends by 23:00)
    occurrencesPerWeek: 3,
  },
]

const TOTAL_EVENTS_KWH = LANDING_DEMO_EVENTS.reduce((sum, e) => sum + e.kwhPerSlot * e.slotCount, 0)

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

// OA-105: event IDs are opaque strings elsewhere (component props, test
// fixtures) -- this lookup is the one place that needs to find an event's
// own definition back from its id.
function getEvent(id: string): HouseholdEventDefinition {
  const event = LANDING_DEMO_EVENTS.find((e) => e.id === id)
  if (!event) throw new Error(`Unknown landing demo event id: ${id}`)
  return event
}

/** Snaps a candidate start slot to the half-hour grid and keeps it inside this event's own valid same-day window. */
export function clampEventStartSlot(eventId: string, startSlot: number): number {
  const event = getEvent(eventId)
  const rounded = Math.round(startSlot)
  return Math.max(event.validStartSlotRange.min, Math.min(event.validStartSlotRange.max, rounded))
}

function eventCostPence(event: HouseholdEventDefinition, startSlot: number, ratePence: number[]): number {
  let cost = 0
  for (let i = 0; i < event.slotCount; i++) cost += event.kwhPerSlot * ratePence[startSlot + i]
  return cost
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
    kwh: event.kwhPerSlot * event.slotCount,
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
    for (let i = 0; i < event.slotCount; i++) usage[start + i] += event.kwhPerSlot
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
  }
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
  },
  fixtureVersion: '2026-10-03',
  fixtureBuiltAt: '2026-10-03',
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
}

export function buildLandingDemoFixture(
  // OA-105: "no event appears for the first time on Tab 3" -- Optimise
  // starts from the exact same (actualStartSlot) positions as
  // Baseline/Compare; a caller only needs to pass the events it has
  // actually dragged. Keyed by event id, not array order, so a partial
  // override (one event moved) can't accidentally shift the other.
  optimiseEventStartSlots: Partial<Record<string, number>> = {},
): LandingDemoFixture {
  const baselinePositions: Record<string, number> = {}
  const optimisePositions: Record<string, number> = {}
  for (const event of LANDING_DEMO_EVENTS) {
    baselinePositions[event.id] = event.actualStartSlot
    const requested = optimiseEventStartSlots[event.id] ?? event.actualStartSlot
    optimisePositions[event.id] = clampEventStartSlot(event.id, requested)
  }

  const baselineUsage = withEventsAt(baselinePositions)
  const optimisedUsage = withEventsAt(optimisePositions)

  const baselineDays = buildDays(baselineUsage, STANDARD_VARIABLE_RATE_PENCE)
  const compareDays = buildDays(baselineUsage, AGILE_REPRESENTATIVE_RATE_PENCE)
  const optimiseDays = buildDays(optimisedUsage, AGILE_REPRESENTATIVE_RATE_PENCE)

  const baseline: LandingDemoStep = {
    tariffName: 'Standard Variable',
    totalKwh: sumKwh(baselineUsage),
    totalCostPence: sumCostPence(baselineUsage, STANDARD_VARIABLE_RATE_PENCE),
    day: baselineDays[baselineDays.length - 1],
    days: baselineDays,
  }
  const compare: LandingDemoStep = {
    tariffName: 'Octopus Agile',
    totalKwh: sumKwh(baselineUsage),
    totalCostPence: sumCostPence(baselineUsage, AGILE_REPRESENTATIVE_RATE_PENCE),
    day: compareDays[compareDays.length - 1],
    days: compareDays,
  }
  const optimise: LandingDemoStep = {
    tariffName: 'Octopus Agile',
    totalKwh: sumKwh(optimisedUsage),
    totalCostPence: sumCostPence(optimisedUsage, AGILE_REPRESENTATIVE_RATE_PENCE),
    day: optimiseDays[optimiseDays.length - 1],
    days: optimiseDays,
  }

  const timingSavingPence = compare.totalCostPence - optimise.totalCostPence

  // OA-105: per-event saving is computed directly from that event's own
  // before/after cost (never from a shared total divided up), so it's
  // exact and additive regardless of how many events exist or whether
  // their slots happen to overlap.
  const events = LANDING_DEMO_EVENTS.map((event) => {
    const savingPerOccurrencePence =
      eventCostPence(event, baselinePositions[event.id], AGILE_REPRESENTATIVE_RATE_PENCE) -
      eventCostPence(event, optimisePositions[event.id], AGILE_REPRESENTATIVE_RATE_PENCE)
    return buildEventProjection(event, optimisePositions[event.id], savingPerOccurrencePence)
  })
  const projection: LandingDemoProjection = {
    dailyPotentialSavingPence: timingSavingPence,
    projectedMonthlySavingPence: events.reduce((sum, e) => sum + e.projectedMonthlySavingPence, 0),
    projectedAnnualSavingPence: events.reduce((sum, e) => sum + e.projectedAnnualSavingPence, 0),
    events,
  }

  return {
    baseline,
    compare,
    optimise,
    tariffSwitchSavingPence: baseline.totalCostPence - compare.totalCostPence,
    timingSavingPence,
    projection,
  }
}
