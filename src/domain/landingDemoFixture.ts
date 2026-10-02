import type { HeatMapDay, HeatMapSlot } from '../components/heatMapMath'

/**
 * OA-77: fixture data for the logged-out interactive tariff-comparison demo.
 * Entirely illustrative -- no real household, meter, or market data. Shapes
 * are chosen to tell a clear story (a flexible load, e.g. a dishwasher,
 * currently running during an expensive evening peak), not derived from any
 * real Octopus tariff or customer.
 */

// OA-85: "the graph should read as a multi-day time landscape, not a small
// analytical matrix" -- four consecutive example days, the last of which
// is the detail day the headline kWh/£ stat above the chart describes.
// Deliberately identical shape every day (same illustrative household,
// same illustrative tariff) rather than randomised: it's still example
// data, not a real meter, so a repeating pattern is the honest way to
// show "this happens every day" without implying real day-to-day variance
// we have no data for.
const DEMO_DAY_DATES = ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15']

// Illustrative half-hourly household demand (kWh), excluding the flexible
// load below -- low overnight, a morning bump, quiet daytime, an evening
// peak, then winding down. 48 values, one per half-hour slot.
const BASE_LOAD_KWH: number[] = [
  0.1, 0.09, 0.09, 0.08, 0.08, 0.09, 0.09, 0.1, 0.1, 0.11, 0.11, 0.12, 0.22, 0.3, 0.28, 0.24, 0.2, 0.18, 0.14, 0.14,
  0.13, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15, 0.14, 0.14, 0.14, 0.14, 0.22, 0.3, 0.38, 0.42, 0.4, 0.36, 0.34, 0.3,
  0.26, 0.22, 0.18, 0.16, 0.15, 0.14, 0.13, 0.12,
]

const STANDARD_VARIABLE_RATE_PENCE: number[] = new Array(48).fill(26.5)

// Illustrative Agile-like shape: cheap overnight, moderate daytime, a
// sharp evening peak. Not a real published Octopus Agile rate.
const AGILE_LIKE_RATE_PENCE: number[] = [
  9, 8, 8, 7, 7, 8, 9, 10, 11, 12, 13, 14, 16, 19, 22, 24, 23, 21, 19, 18, 18, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21,
  22, 28, 35, 45, 52, 55, 50, 42, 35, 28, 22, 20, 18, 16, 14, 12, 10,
]

const FLEXIBLE_LOAD_KWH_PER_SLOT = 0.55 // e.g. a dishwasher cycle, spread over two half-hour slots
const BASELINE_FLEXIBLE_SLOTS = [36, 37] // 18:00-19:00 -- an expensive evening peak on the Agile-like rates
const OPTIMISED_FLEXIBLE_SLOTS = [4, 5] // 02:00-03:00 -- a cheap overnight period on the Agile-like rates

function withFlexibleLoad(slotIndices: number[]): number[] {
  const usage = [...BASE_LOAD_KWH]
  for (const i of slotIndices) usage[i] += FLEXIBLE_LOAD_KWH_PER_SLOT
  return usage
}

function startsAtFor(date: string, slotIndex: number): string {
  const hours = Math.floor(slotIndex / 2)
  const minutes = (slotIndex % 2) * 30
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`
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
  const compareDays = buildDays(baselineUsage, AGILE_LIKE_RATE_PENCE)
  const optimiseDays = buildDays(optimisedUsage, AGILE_LIKE_RATE_PENCE)

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
    totalCostPence: sumCostPence(baselineUsage, AGILE_LIKE_RATE_PENCE),
    day: compareDays[compareDays.length - 1],
    days: compareDays,
  }
  const optimise: LandingDemoStep = {
    tariffName: 'Octopus Agile',
    totalKwh: sumKwh(optimisedUsage),
    totalCostPence: sumCostPence(optimisedUsage, AGILE_LIKE_RATE_PENCE),
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
