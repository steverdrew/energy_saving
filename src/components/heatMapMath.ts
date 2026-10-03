// OA-70: pure helpers for the shared heat-map component -- kept separate
// from the rendering component so the colour-scale and annotation logic
// can be unit tested without mounting React.
import { formatGbp } from '../format'

export interface HeatMapSlot {
  startsAt: string
  kwh: number | null
  unitRateIncVatPence: number | null
  costPence: number | null
}

export interface HeatMapDay {
  date: string
  slots: HeatMapSlot[]
}

// OA-113/OA-115: a sequential ramp derived from the product's purple
// brand system, but deliberately a *secondary*, cooler/greyer hue --
// slate-indigo (~hue 230) rather than the brand accent's own magenta-
// violet (`--accent` family, #a855f7/#aa3bff/#c084fc, ~hue 272). OA-113's
// first pass reused the accent's own hue for the chart and read as too
// close to it; shifting the chart's hue further toward blue keeps it
// "harmonious with the dark purple brand" while staying visually
// distinct from interactive/CTA purple, so a chart element and a button
// are never confused for the same kind of thing. Light->dark across 9
// steps, cheapest to most expensive: deep slate-indigo at the cheap end,
// muted slate-violet through the middle, pale cool near-neutral at the
// expensive end -- desaturated through the middle/light steps rather
// than a flat saturation ramp, so full-strength brand purple stays
// reserved for interactive/accent use (buttons, selection, CTAs), never
// a chart background fill. One hue family only; usage is encoded
// separately (bar height/shape), never as a second hue, so the chart
// never asks colour to carry two magnitudes at once.
export const RATE_COLOR_STEPS_LIGHT = [
  '#dcdfe9',
  '#aeb3cf',
  '#8890b8',
  '#6670a0',
  '#4a5088',
  '#384176',
  '#2e3564',
  '#242b52',
  '#1b2140',
]
export const RATE_COLOR_STEPS_DARK = [
  '#1b2140',
  '#242b52',
  '#2e3564',
  '#384176',
  '#4a5088',
  '#6670a0',
  '#8890b8',
  '#aeb3cf',
  '#dcdfe9',
]

/**
 * Maps a rate to one of the 9 ramp steps, normalised against the min/max
 * rate actually present in the data -- not a fixed p/kWh scale, since
 * tariffs vary hugely in absolute level (flat vs. Agile vs. Go). Returns
 * null when the rate is unknown, so the caller can render a distinct
 * "no data" cell rather than guessing a colour.
 */
export function rateColorStepIndex(rate: number | null, min: number, max: number): number | null {
  if (rate === null || !Number.isFinite(rate)) return null
  if (max === min) return 4 // flat-rate: every slot is literally identical -- middle step, no implied ranking
  const steps = RATE_COLOR_STEPS_LIGHT.length
  const t = (rate - min) / (max - min)
  return Math.max(0, Math.min(steps - 1, Math.round(t * (steps - 1))))
}

/**
 * OA-101: the landing-page demo's price scale -- Agile has 48 genuinely
 * distinct half-hourly prices, not three fixed tariff bands, so the
 * comparison chart encodes price as a continuous cheaper -> more
 * expensive position (0 = the cheapest slot actually present, 1 = the
 * most expensive) rather than bucketing it into named categories.
 * Replaces the earlier `rateCategoryIndex`/`RATE_CATEGORY_LABELS`
 * cheap/standard/peak model, which OA-99/OA-101 explicitly retired as
 * misrepresenting how Agile pricing actually works. Same min/max
 * normalisation and null/flat-rate handling as `rateColorStepIndex`
 * above; callers map the returned ratio to a colour themselves (see
 * LandingTimeProfile.tsx, which reuses the `rateColorStepIndex` ramp).
 */
export function rateRatio(rate: number | null, min: number, max: number): number | null {
  if (rate === null || !Number.isFinite(rate)) return null
  if (max === min) return 0.5 // flat-rate: no implied ranking -- dead centre of the scale
  const t = (rate - min) / (max - min)
  return Math.max(0, Math.min(1, t))
}

// OA-99/OA-101: Agile's pricing formula includes higher network/grid-
// related costs during 16:00-19:00 London time -- a genuine structural
// feature of how Agile is priced (see LANDING_DEMO_DATA_SOURCES.sourceUrls
// .octopusAgilePricing), independent of any particular day's actual
// price ranking. This is therefore a fixed clock window, not derived
// from rateRatio/rateColorStepIndex -- every one of its six half-hours
// still carries its own distinct price; this only flags which slots fall
// inside that documented window, for an optional subtle annotation.
export const STRUCTURAL_PEAK_WINDOW_HOURS = { startHour: 16, endHour: 19 } as const

const structuralPeakHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: 'numeric',
  hourCycle: 'h23',
})

export function isStructuralPeakSlot(startsAtIso: string): boolean {
  const hour = Number(structuralPeakHourFormatter.format(new Date(startsAtIso)))
  return hour >= STRUCTURAL_PEAK_WINDOW_HOURS.startHour && hour < STRUCTURAL_PEAK_WINDOW_HOURS.endHour
}

export function rateRange(days: HeatMapDay[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.unitRateIncVatPence === null) continue
      if (slot.unitRateIncVatPence < min) min = slot.unitRateIncVatPence
      if (slot.unitRateIncVatPence > max) max = slot.unitRateIncVatPence
    }
  }
  if (min === Infinity) return { min: 0, max: 0 }
  return { min, max }
}

export function maxUsage(days: HeatMapDay[]): number {
  let max = 0
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.kwh !== null && slot.kwh > max) max = slot.kwh
    }
  }
  return max
}

interface CurvePoint {
  x: number
  y: number
}

/**
 * Catmull-Rom-to-Bezier conversion -- a smooth curve that passes through
 * every input point exactly (unlike e.g. a Bezier fit, which would only
 * approximate them). OA-97: this keeps the usage profile grounded in the
 * real half-hour values (no point is skipped or averaged away) while
 * reading as a smooth silhouette instead of hard rectangular steps.
 */
function catmullRomToBezierPath(points: CurvePoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return d
}

/**
 * OA-97: a smooth SVG area path through the 48 half-hourly usage ratios
 * (each already clamped to [0, 1] of the day's peak), in a normalised
 * `0..slots.length` x / `0..1` y coordinate space -- the caller scales it
 * to its own pixel box via the SVG viewBox, so this stays a pure,
 * testable function of the data rather than any rendered size. y is
 * inverted (0 = top = max usage, 1 = bottom = no usage) to match SVG's
 * downward y-axis, and the path closes down to the y=1 baseline so it
 * fills as an area, not just an outline.
 *
 * The number of path commands depends only on `usageRatios.length` (always
 * 48 for this component), never on the ratios themselves -- so the same
 * state's path structurally lines up across Baseline/Compare/Optimise,
 * which is what lets a CSS transition on `d` morph between them instead of
 * snapping.
 */
export function buildSmoothUsageAreaPath(usageRatios: number[]): string {
  const n = usageRatios.length
  if (n === 0) return ''
  const points: CurvePoint[] = usageRatios.map((ratio, i) => ({
    x: i + 0.5,
    y: 1 - Math.max(0, Math.min(1, ratio)),
  }))
  return `${catmullRomToBezierPath(points)} L ${n} 1 L 0 1 Z`
}

export interface HeatMapAnnotation {
  dayIndex: number
  slotIndex: number
  label: string
}

/**
 * OA-70: "annotate meaningful periods... avoid visual clutter" -- exactly
 * three labels across the whole 30-day grid, not per-day, so they read as
 * highlights rather than noise.
 */
export function findAnnotations(days: HeatMapDay[]): HeatMapAnnotation[] {
  let cheapest: HeatMapAnnotation | null = null
  let mostExpensive: HeatMapAnnotation | null = null
  let highestUsage: HeatMapAnnotation | null = null
  let cheapestRate = Infinity
  let expensiveRate = -Infinity
  let usageMax = -Infinity

  days.forEach((day, dayIndex) => {
    day.slots.forEach((slot, slotIndex) => {
      if (slot.unitRateIncVatPence !== null) {
        if (slot.unitRateIncVatPence < cheapestRate) {
          cheapestRate = slot.unitRateIncVatPence
          cheapest = { dayIndex, slotIndex, label: 'Cheapest period' }
        }
        if (slot.unitRateIncVatPence > expensiveRate) {
          expensiveRate = slot.unitRateIncVatPence
          mostExpensive = { dayIndex, slotIndex, label: 'Most expensive period' }
        }
      }
      if (slot.kwh !== null && slot.kwh > usageMax) {
        usageMax = slot.kwh
        highestUsage = { dayIndex, slotIndex, label: 'Highest usage period' }
      }
    })
  })

  const candidates: Array<HeatMapAnnotation | null> = [cheapest, mostExpensive, highestUsage]
  return candidates.filter((a): a is HeatMapAnnotation => a !== null)
}

/**
 * OA-70/OA-87/OA-89: the shared per-slot accessible description (time,
 * usage, rate, cost) -- used as every cell/column button's aria-label by
 * both the authenticated-app HeatMap and the landing page's own
 * dedicated comparison graph (LandingTimeProfile.tsx), so the two
 * presentations never drift into two slightly different descriptions of
 * the same data shape.
 */
export function describeSlot(slot: HeatMapSlot): string {
  const time = formatSlotTime(slot.startsAt)
  const rate = slot.unitRateIncVatPence !== null ? `${slot.unitRateIncVatPence.toFixed(1)}p/kWh` : 'rate unknown'
  const usage = slot.kwh !== null ? `${slot.kwh.toFixed(2)} kWh` : 'usage unknown'
  const cost = slot.costPence !== null ? formatGbp(slot.costPence) : 'cost unknown'
  return `${time} — ${usage}, ${rate}, ${cost}`
}

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Buckets a flat half-hourly point list (as the server returns from
 * /actual-period and /like-for-like) into one HeatMapDay per
 * Europe/London calendar date -- a UTC day boundary would split a London
 * evening across two rows, which this en-CA (YYYY-MM-DD) key avoids.
 */
export function groupSlotsByLondonDay(slots: HeatMapSlot[]): HeatMapDay[] {
  const byDate = new Map<string, HeatMapSlot[]>()
  for (const slot of slots) {
    const key = dateKeyFormatter.format(new Date(slot.startsAt))
    const bucket = byDate.get(key) ?? []
    bucket.push(slot)
    byDate.set(key, bucket)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({
      date,
      slots: [...daySlots].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    }))
}
