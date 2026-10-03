import { describe, expect, it } from 'vitest'
import { HOUSEHOLD_ARCHETYPES, SLOTS_PER_DAY } from './archetypes'
import { analyseSnapshot, buildSnapshotDays, compareSnapshotToArchetypes, SNAPSHOT_IS_SANITY_CHECK_ONLY } from './realHouseholdSnapshot'
import { RAW_SNAPSHOT_PERIODS } from './realHouseholdSnapshotData'

describe('RAW_SNAPSHOT_PERIODS', () => {
  it('preserves exactly 144 half-hour periods', () => {
    expect(RAW_SNAPSHOT_PERIODS).toHaveLength(144)
  })

  it('is flagged as a sanity-check dataset only, not a representative archetype', () => {
    expect(SNAPSHOT_IS_SANITY_CHECK_ONLY).toBe(true)
  })
})

describe('buildSnapshotDays', () => {
  it('groups the 144 periods into exactly 3 real calendar days of 48 periods each', () => {
    const days = buildSnapshotDays()
    expect(days).toHaveLength(3)
    for (const day of days) {
      expect(day.consumptionKwh).toHaveLength(SLOTS_PER_DAY)
    }
  })

  it('reproduces the real observed daily totals from the source export', () => {
    const days = buildSnapshotDays()
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.totalKwh]))
    expect(byDate['2026-09-29']).toBeCloseTo(29.587, 2)
    expect(byDate['2026-09-30']).toBeCloseTo(6.729, 2)
    expect(byDate['2026-10-01']).toBeCloseTo(4.715, 2)
  })

  it('orders days chronologically', () => {
    const days = buildSnapshotDays()
    expect(days.map((d) => d.date)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01'])
  })
})

describe('analyseSnapshot', () => {
  it('identifies 2026-09-29 as the real anomalous/high-load day', () => {
    const findings = analyseSnapshot()
    expect(findings.anomalousDayDate).toBe('2026-09-29')
    expect(findings.anomalousDayRatioToNextHighestDay).toBeGreaterThan(1)
  })

  it('never annualises the 3-day sample (no 365x or 52x multiplication anywhere in its output)', () => {
    const findings = analyseSnapshot()
    for (const day of findings.days) {
      expect(day.totalKwh).toBeLessThan(50) // a real half-hourly daily total, not an annualised figure
    }
  })
})

describe('compareSnapshotToArchetypes', () => {
  it('produces one comparison row per archetype per snapshot day', () => {
    const days = buildSnapshotDays()
    const rows = compareSnapshotToArchetypes(days, HOUSEHOLD_ARCHETYPES)
    expect(rows).toHaveLength(HOUSEHOLD_ARCHETYPES.length * days.length)
  })

  it('reports the anomalous day as a multiple of every archetype\'s typical daily usage', () => {
    const days = buildSnapshotDays()
    const rows = compareSnapshotToArchetypes(days, HOUSEHOLD_ARCHETYPES)
    const anomalousRows = rows.filter((r) => r.snapshotDate === '2026-09-29')
    for (const row of anomalousRows) {
      expect(row.dailyScaleRatio).toBeGreaterThan(1)
    }
  })
})
