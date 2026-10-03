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

// Octopus Agile's own "a dishwasher cycle" framing for the flexible load
// stays a modelled assumption (OA-73/76), not a published figure -- it's
// the one shape element this demo still has to choose for itself, same
// as before.
const FLEXIBLE_LOAD_KWH_PER_SLOT = 0.55 // e.g. a dishwasher cycle, spread over two half-hour slots
const FLEXIBLE_LOAD_TOTAL_KWH = FLEXIBLE_LOAD_KWH_PER_SLOT * 2

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
  const targetBaseTotal = TYPICAL_DAILY_KWH - FLEXIBLE_LOAD_TOTAL_KWH
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

// OA-99: a real, fixed snapshot of Octopus Agile half-hourly unit rates --
// product AGILE-24-10-01, tariff E-1R-AGILE-24-10-01-C (region C,
// London), 15 June 2026, fetched from Octopus's public API
// (api.octopus.energy) and frozen here rather than fetched live on every
// landing-page render (see `LANDING_DEMO_DATA_SOURCES.tariffSource`/
// `sourceUrls` below for the endpoint and retrieval date). Index 0 is
// 00:00 London time, index 47 is 23:30.
const AGILE_RATE_PENCE: number[] = [
  16.8945, 16.1175, 15.603, 15.603, 16.0125, 15.435, 14.973, 15.603, 15.2145, 14.784, 16.1175, 15.792, 16.296, 19.866,
  21.378, 21.693, 20.412, 18.942, 19.5615, 17.745, 15.96, 14.364, 15.057, 14.301, 15.246, 15.12, 15.3405, 14.238,
  14.868, 14.6055, 14.742, 16.149, 29.883, 31.983, 32.592, 35.826, 36.393, 37.359, 24.759, 24.717, 25.3365, 25.41,
  24.654, 24.549, 22.911, 22.155, 20.664, 19.236,
]

// These slots were chosen against the real AGILE_RATE_PENCE snapshot
// above (not re-derived from it at runtime, so a future snapshot change
// doesn't silently move the story): 36/37 (18:00-19:00, ~36-37p/kWh) is
// within the snapshot's most expensive run; 4/5 (02:00-03:00,
// ~15-16p/kWh) sits in its cheap overnight window.
const BASELINE_FLEXIBLE_SLOTS = [36, 37] // 18:00-19:00 -- the snapshot's expensive evening peak
const OPTIMISED_FLEXIBLE_SLOTS = [4, 5] // 02:00-03:00 -- a cheap overnight period in the same snapshot

function withFlexibleLoad(slotIndices: number[]): number[] {
  const usage = [...BASE_LOAD_KWH]
  for (const i of slotIndices) usage[i] += FLEXIBLE_LOAD_KWH_PER_SLOT
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
  tariffRegion: string
  tariffDate: string
  sourceUrls: {
    ofgemTdcv: string
    ofgemPriceCap: string
    elexonProfiling: string
    octopusAgileApi: string
  }
  fixtureVersion: string
}

export const LANDING_DEMO_DATA_SOURCES: LandingDemoDataSources = {
  usageSource:
    "Shape consistent with Elexon's documented domestic Profile Class 1 (Domestic Unrestricted) diurnal pattern -- Elexon's own enumerated 48-period coefficient table is published via the Elexon Portal's Market Domain Data repository, not a public scrapeable export, so this is a representative shape rather than a literal copy of that table.",
  annualKwhSource: "Ofgem medium Typical Domestic Consumption Value for electricity (Profile Class 1), 2,500 kWh/year, effective 1 July 2026.",
  tariffSource: 'Octopus Agile (product AGILE-24-10-01, tariff E-1R-AGILE-24-10-01-C), fetched from the Octopus Energy public API and snapshotted for a deterministic fixture.',
  tariffRegion: 'C (London)',
  tariffDate: '2026-06-15',
  sourceUrls: {
    ofgemTdcv: 'https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf',
    ofgemPriceCap: 'https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-october-and-31-december-2026',
    elexonProfiling: 'https://www.elexon.co.uk/bsc/settlement/profiling/',
    octopusAgileApi: 'https://developer.octopus.energy/guides/rest/api-endpoints/',
  },
  fixtureVersion: '2026-10-03',
}

export interface LandingDemoFixture {
  baseline: LandingDemoStep
  compare: LandingDemoStep
  optimise: LandingDemoStep
  /** baseline cost minus compare cost, for identical usage -- the tariff-choice opportunity. */
  tariffSwitchSavingPence: number
  /** compare cost minus optimise cost, for the same tariff -- the timing opportunity, kept separate from the above. */
  timingSavingPence: number
}

export function buildLandingDemoFixture(): LandingDemoFixture {
  const baselineUsage = withFlexibleLoad(BASELINE_FLEXIBLE_SLOTS)
  const optimisedUsage = withFlexibleLoad(OPTIMISED_FLEXIBLE_SLOTS)

  const baselineDays = buildDays(baselineUsage, STANDARD_VARIABLE_RATE_PENCE)
  const compareDays = buildDays(baselineUsage, AGILE_RATE_PENCE)
  const optimiseDays = buildDays(optimisedUsage, AGILE_RATE_PENCE)

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
    totalCostPence: sumCostPence(baselineUsage, AGILE_RATE_PENCE),
    day: compareDays[compareDays.length - 1],
    days: compareDays,
  }
  const optimise: LandingDemoStep = {
    tariffName: 'Octopus Agile',
    totalKwh: sumKwh(optimisedUsage),
    totalCostPence: sumCostPence(optimisedUsage, AGILE_RATE_PENCE),
    day: optimiseDays[optimiseDays.length - 1],
    days: optimiseDays,
  }

  return {
    baseline,
    compare,
    optimise,
    tariffSwitchSavingPence: baseline.totalCostPence - compare.totalCostPence,
    timingSavingPence: compare.totalCostPence - optimise.totalCostPence,
  }
}
