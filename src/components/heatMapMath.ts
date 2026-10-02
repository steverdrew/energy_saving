// OA-70: pure helpers for the shared heat-map component -- kept separate
// from the rendering component so the colour-scale and annotation logic
// can be unit tested without mounting React.

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

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
