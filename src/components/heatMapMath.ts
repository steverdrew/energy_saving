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
