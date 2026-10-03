/**
 * OA-130: ingests the real, user-supplied 3-day half-hourly household
 * snapshot (`realHouseholdSnapshotData.ts`, parsed verbatim from
 * `fixtures/real-household-snapshot-2026-09-29.csv`) as an explicit
 * sanity-check fixture -- NOT a representative archetype.
 *
 * Per OA-130's own rules:
 *   - all 144 half-hour periods are preserved, unmodified, with their
 *     original timestamps;
 *   - the 3-day sample is never annualised;
 *   - this module only compares shape/scale against the canonical
 *     archetypes (OA-120) -- it does not attempt appliance disaggregation.
 */

import { SLOTS_PER_DAY, type HouseholdArchetype } from './archetypes'
import { RAW_SNAPSHOT_PERIODS, type RawSnapshotPeriod } from './realHouseholdSnapshotData'

export const SNAPSHOT_PROVENANCE =
  'User-supplied real household half-hourly export (Steve, OA-130), covering 2026-09-29 to 2026-10-01. Sanity-check dataset only -- not a representative archetype, never annualised.'

export const SNAPSHOT_IS_SANITY_CHECK_ONLY = true

export interface SnapshotDay {
  date: string
  /** Exactly 48 half-hour consumption values (kWh), in original chronological order, unmodified. */
  consumptionKwh: readonly number[]
  totalKwh: number
  peakHalfHourKwh: number
  peakHalfHourStart: string
  /** Mean of the 6 half-hours 01:00-04:00 -- a background/standby-load proxy, same window used elsewhere in this model for "overnight". */
  overnightMeanKwh: number
}

function dateOf(period: RawSnapshotPeriod): string {
  return period.start.slice(0, 10)
}

/** Groups the raw 144 periods into their 3 real calendar days, preserving original order and values exactly. */
export function buildSnapshotDays(periods: readonly RawSnapshotPeriod[] = RAW_SNAPSHOT_PERIODS): readonly SnapshotDay[] {
  const byDate = new Map<string, RawSnapshotPeriod[]>()
  for (const period of periods) {
    const date = dateOf(period)
    const existing = byDate.get(date) ?? []
    existing.push(period)
    byDate.set(date, existing)
  }

  const days: SnapshotDay[] = []
  for (const [date, dayPeriods] of byDate) {
    if (dayPeriods.length !== SLOTS_PER_DAY) {
      throw new Error(`Snapshot day ${date} has ${dayPeriods.length} half-hour periods, expected exactly ${SLOTS_PER_DAY}.`)
    }
    const consumptionKwh = dayPeriods.map((p) => p.consumptionKwh)
    const totalKwh = consumptionKwh.reduce((sum, v) => sum + v, 0)
    let peakIndex = 0
    for (let i = 1; i < consumptionKwh.length; i++) {
      if (consumptionKwh[i] > consumptionKwh[peakIndex]) peakIndex = i
    }
    // Overnight proxy window: half-hour slots 2-7 inclusive == 01:00-04:00,
    // the same low-activity window a background-load check should use.
    const overnightSlots = consumptionKwh.slice(2, 8)
    const overnightMeanKwh = overnightSlots.reduce((sum, v) => sum + v, 0) / overnightSlots.length

    days.push({
      date,
      consumptionKwh,
      totalKwh,
      peakHalfHourKwh: consumptionKwh[peakIndex],
      peakHalfHourStart: dayPeriods[peakIndex].start,
      overnightMeanKwh,
    })
  }

  return days.sort((a, b) => a.date.localeCompare(b.date))
}

export interface ArchetypeComparisonRow {
  archetypeId: string
  archetypeLabel: string
  archetypeDailyKwh: number
  snapshotDate: string
  snapshotDailyKwh: number
  /** snapshotDailyKwh / archetypeDailyKwh -- 1.0 means the same daily scale. */
  dailyScaleRatio: number
  archetypeOvernightShareOfDaily: number
  snapshotOvernightShareOfDaily: number
}

/**
 * Compares each real snapshot day against each canonical archetype on
 * daily kWh scale and overnight-background share of the daily total --
 * shape/scale only, no appliance-level claims. A household's actual
 * background load is approximated from its fixed, non-movable events plus
 * its base load share (archetype-level data doesn't expose a true
 * standing/vampire draw figure directly, so this stays a comparison of
 * what is actually measurable from both sides: total and overnight share).
 */
export function compareSnapshotToArchetypes(
  days: readonly SnapshotDay[],
  archetypes: readonly HouseholdArchetype[],
): readonly ArchetypeComparisonRow[] {
  const rows: ArchetypeComparisonRow[] = []
  for (const archetype of archetypes) {
    const archetypeDailyKwh = archetype.annualKwh / 365
    for (const day of days) {
      const overnightSlots = day.consumptionKwh.slice(2, 8)
      const snapshotOvernightTotal = overnightSlots.reduce((sum, v) => sum + v, 0)
      rows.push({
        archetypeId: archetype.id,
        archetypeLabel: archetype.label,
        archetypeDailyKwh,
        snapshotDate: day.date,
        snapshotDailyKwh: day.totalKwh,
        dailyScaleRatio: day.totalKwh / archetypeDailyKwh,
        // Archetypes don't define an explicit overnight base-load figure;
        // this model only asserts standby cost annually (OA-119/OA-120),
        // so the archetype side of this comparison is left as "not modelled
        // at half-hour resolution" rather than invented -- NaN signals that
        // explicitly rather than silently implying a false 0.
        archetypeOvernightShareOfDaily: Number.NaN,
        snapshotOvernightShareOfDaily: day.totalKwh > 0 ? snapshotOvernightTotal / day.totalKwh : 0,
      })
    }
  }
  return rows
}

export interface SnapshotFindings {
  days: readonly SnapshotDay[]
  /** The first day (2026-09-29) is a real, observed anomalous/high-load day relative to the other two -- flagged explicitly, never smoothed into an "average". */
  anomalousDayDate: string
  anomalousDayRatioToNextHighestDay: number
}

export function analyseSnapshot(periods: readonly RawSnapshotPeriod[] = RAW_SNAPSHOT_PERIODS): SnapshotFindings {
  const days = buildSnapshotDays(periods)
  const sortedByTotal = [...days].sort((a, b) => b.totalKwh - a.totalKwh)
  const anomalousDay = sortedByTotal[0]
  const nextHighest = sortedByTotal[1]

  return {
    days,
    anomalousDayDate: anomalousDay.date,
    anomalousDayRatioToNextHighestDay: nextHighest.totalKwh > 0 ? anomalousDay.totalKwh / nextHighest.totalKwh : Number.POSITIVE_INFINITY,
  }
}
