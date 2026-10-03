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

// The validated sequential blue ramp (dataviz skill, references/palette.md)
// -- light->dark across 9 steps, cheapest to most expensive. One hue only;
// usage is encoded separately (bar height), never as a second hue, so the
// chart never asks colour to carry two magnitudes at once.
export const RATE_COLOR_STEPS_LIGHT = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
]
export const RATE_COLOR_STEPS_DARK = [
  '#184f95',
  '#1c5cab',
  '#256abf',
  '#2a78d6',
  '#3987e5',
  '#5598e7',
  '#6da7ec',
  '#86b6ef',
  '#9ec5f4',
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
 * OA-85: the landing-page demo's "tariff" variant encodes price as one of
 * three categorical bands (cheap/standard/peak) rather than the 9-step
 * sequential ramp above -- same min/max normalisation approach, just
 * fewer, named buckets so colour reads as "cheap vs. peak" at a glance
 * instead of a continuous gradient. Returns null/1 for the same reasons
 * as rateColorStepIndex.
 */
export const RATE_CATEGORY_LABELS = ['Cheap', 'Standard', 'Peak'] as const

export function rateCategoryIndex(rate: number | null, min: number, max: number): number | null {
  if (rate === null || !Number.isFinite(rate)) return null
  if (max === min) return 1 // flat-rate: no implied ranking -- the "standard" middle band
  const t = (rate - min) / (max - min)
  if (t < 1 / 3) return 0
  if (t < 2 / 3) return 1
  return 2
}

/**
 * OA-95: which of the 3 rate categories are actually present in a day's
 * data (vs. always showing all 3) -- a flat-rate tariff (e.g. Standard
 * Variable) buckets every slot into the "standard" middle band, so its
 * legend should read "Standard" only, not "Cheap · Standard · Peak".
 */
export function presentRateCategories(days: HeatMapDay[], min: number, max: number): number[] {
  const present = new Set<number>()
  for (const day of days) {
    for (const slot of day.slots) {
      const category = rateCategoryIndex(slot.unitRateIncVatPence, min, max)
      if (category !== null) present.add(category)
    }
  }
  return [...present].sort((a, b) => a - b)
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

export interface PeakWindow {
  startSlot: number
  endSlot: number
}

/**
 * OA-86: the landing-page demo's peak-window overlay -- the longest run of
 * consecutive "peak" (rateCategoryIndex === 2) slots in a representative
 * day, used to highlight *where* the expensive window actually falls in
 * the current illustrative tariff data. Deliberately not a hard-coded
 * time band (the reference mockup's "16:00-19:00" was fixed to one
 * example Agile shape) -- a flat tariff has no peak band at all, so this
 * returns null and the overlay simply doesn't render, rather than a
 * union/day considered. Ties for longest run keep the first.
 */
export function findPeakWindow(day: HeatMapDay | undefined, min: number, max: number): PeakWindow | null {
  if (!day) return null
  let bestStart = -1
  let bestLength = 0
  let runStart = -1
  let runLength = 0

  day.slots.forEach((slot, index) => {
    if (rateCategoryIndex(slot.unitRateIncVatPence, min, max) === 2) {
      if (runLength === 0) runStart = index
      runLength++
      if (runLength > bestLength) {
        bestLength = runLength
        bestStart = runStart
      }
    } else {
      runLength = 0
    }
  })

  if (bestLength === 0) return null
  return { startSlot: bestStart, endSlot: bestStart + bestLength - 1 }
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
