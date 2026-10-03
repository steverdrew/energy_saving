import { describe, expect, it } from 'vitest'
import {
  buildSmoothUsageAreaPath,
  findAnnotations,
  formatSlotTime,
  groupSlotsByLondonDay,
  isStructuralPeakSlot,
  maxUsage,
  rateColorStepIndex,
  rateRange,
  rateRatio,
  RATE_COLOR_STEPS_LIGHT,
  type HeatMapDay,
} from './heatMapMath'

function slot(startsAt: string, kwh: number | null, unitRateIncVatPence: number | null): HeatMapDay['slots'][number] {
  return { startsAt, kwh, unitRateIncVatPence, costPence: null }
}

describe('rateColorStepIndex', () => {
  it('maps the minimum rate to the lightest step', () => {
    expect(rateColorStepIndex(10, 10, 30)).toBe(0)
  })

  it('maps the maximum rate to the darkest step', () => {
    expect(rateColorStepIndex(30, 10, 30)).toBe(RATE_COLOR_STEPS_LIGHT.length - 1)
  })

  it('maps a mid-range rate to a middle step', () => {
    expect(rateColorStepIndex(20, 10, 30)).toBe(4)
  })

  it('returns the middle step for a flat tariff where min equals max', () => {
    expect(rateColorStepIndex(15, 15, 15)).toBe(4)
  })

  it('returns null for an unknown rate', () => {
    expect(rateColorStepIndex(null, 10, 30)).toBe(null)
  })

  it('returns null for a non-finite rate', () => {
    expect(rateColorStepIndex(Number.NaN, 10, 30)).toBe(null)
  })

  it('clamps rates outside the observed range', () => {
    expect(rateColorStepIndex(5, 10, 30)).toBe(0)
    expect(rateColorStepIndex(35, 10, 30)).toBe(RATE_COLOR_STEPS_LIGHT.length - 1)
  })
})

describe('rateRatio', () => {
  it('maps the minimum rate to 0', () => {
    expect(rateRatio(10, 10, 30)).toBe(0)
  })

  it('maps the maximum rate to 1', () => {
    expect(rateRatio(30, 10, 30)).toBe(1)
  })

  it('maps a mid-range rate to 0.5', () => {
    expect(rateRatio(20, 10, 30)).toBe(0.5)
  })

  it('returns 0.5 for a flat tariff where min equals max', () => {
    expect(rateRatio(15, 15, 15)).toBe(0.5)
  })

  it('returns null for an unknown or non-finite rate', () => {
    expect(rateRatio(null, 10, 30)).toBe(null)
    expect(rateRatio(Number.NaN, 10, 30)).toBe(null)
  })

  it('clamps rates outside the observed range into [0, 1]', () => {
    expect(rateRatio(0, 10, 30)).toBe(0)
    expect(rateRatio(100, 10, 30)).toBe(1)
  })
})

describe('isStructuralPeakSlot', () => {
  it('is false just before 16:00 London', () => {
    expect(isStructuralPeakSlot('2026-06-15T14:30:00Z')).toBe(false) // 15:30 BST
  })

  it('is true for every half-hour from 16:00 up to (not including) 19:00 London', () => {
    expect(isStructuralPeakSlot('2026-06-15T15:00:00Z')).toBe(true) // 16:00 BST
    expect(isStructuralPeakSlot('2026-06-15T15:30:00Z')).toBe(true) // 16:30 BST
    expect(isStructuralPeakSlot('2026-06-15T17:30:00Z')).toBe(true) // 18:30 BST
  })

  it('is false from 19:00 London onward', () => {
    expect(isStructuralPeakSlot('2026-06-15T18:00:00Z')).toBe(false) // 19:00 BST
  })

  it('uses Europe/London local time, not UTC, across the DST boundary', () => {
    // 2026-01-15T16:00 UTC is 16:00 London in winter (GMT, no DST offset) --
    // still inside the structural peak window.
    expect(isStructuralPeakSlot('2026-01-15T16:00:00Z')).toBe(true)
    // 2026-01-15T19:00 UTC is 19:00 London in winter -- just outside it.
    expect(isStructuralPeakSlot('2026-01-15T19:00:00Z')).toBe(false)
  })
})

describe('rateRange', () => {
  it('finds the min and max rate across all days and slots, ignoring nulls', () => {
    const days: HeatMapDay[] = [
      { date: '2026-01-01', slots: [slot('2026-01-01T00:00:00Z', 1, 20), slot('2026-01-01T00:30:00Z', 1, null)] },
      { date: '2026-01-02', slots: [slot('2026-01-02T00:00:00Z', 1, 5), slot('2026-01-02T00:30:00Z', 1, 40)] },
    ]
    expect(rateRange(days)).toEqual({ min: 5, max: 40 })
  })

  it('returns 0/0 when every rate is unknown', () => {
    const days: HeatMapDay[] = [{ date: '2026-01-01', slots: [slot('2026-01-01T00:00:00Z', 1, null)] }]
    expect(rateRange(days)).toEqual({ min: 0, max: 0 })
  })
})

describe('maxUsage', () => {
  it('finds the highest kwh across all days and slots, ignoring nulls', () => {
    const days: HeatMapDay[] = [
      { date: '2026-01-01', slots: [slot('2026-01-01T00:00:00Z', 0.2, 10), slot('2026-01-01T00:30:00Z', null, 10)] },
      { date: '2026-01-02', slots: [slot('2026-01-02T00:00:00Z', 1.4, 10)] },
    ]
    expect(maxUsage(days)).toBe(1.4)
  })

  it('returns 0 when there is no usage data', () => {
    const days: HeatMapDay[] = [{ date: '2026-01-01', slots: [slot('2026-01-01T00:00:00Z', null, 10)] }]
    expect(maxUsage(days)).toBe(0)
  })
})

describe('findAnnotations', () => {
  it('finds exactly the cheapest period, most expensive period and highest usage period', () => {
    const days: HeatMapDay[] = [
      {
        date: '2026-01-01',
        slots: [
          slot('2026-01-01T00:00:00Z', 0.1, 15),
          slot('2026-01-01T00:30:00Z', 0.1, 5), // cheapest
          slot('2026-01-01T01:00:00Z', 2.0, 15), // highest usage
        ],
      },
      {
        date: '2026-01-02',
        slots: [slot('2026-01-02T00:00:00Z', 0.1, 50)], // most expensive
      },
    ]

    const annotations = findAnnotations(days)
    expect(annotations).toHaveLength(3)
    expect(annotations).toEqual([
      { dayIndex: 0, slotIndex: 1, label: 'Cheapest period' },
      { dayIndex: 1, slotIndex: 0, label: 'Most expensive period' },
      { dayIndex: 0, slotIndex: 2, label: 'Highest usage period' },
    ])
  })

  it('omits annotations entirely absent from the data', () => {
    const days: HeatMapDay[] = [{ date: '2026-01-01', slots: [slot('2026-01-01T00:00:00Z', null, null)] }]
    expect(findAnnotations(days)).toEqual([])
  })
})

describe('formatSlotTime', () => {
  it('formats an ISO timestamp as a London local time', () => {
    expect(formatSlotTime('2026-06-15T13:30:00Z')).toBe('14:30')
  })
})

describe('groupSlotsByLondonDay', () => {
  it('groups slots into one day per Europe/London calendar date, sorted', () => {
    const days = groupSlotsByLondonDay([
      slot('2026-01-02T00:30:00Z', 1, 10),
      slot('2026-01-01T00:00:00Z', 1, 10),
      slot('2026-01-01T00:30:00Z', 1, 10),
    ])

    expect(days.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02'])
    expect(days[0].slots.map((s) => s.startsAt)).toEqual(['2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z'])
  })

  it('buckets a London evening into one day even though its UTC date has already rolled over (BST, UTC+1)', () => {
    // 2026-06-15T23:30 UTC is 2026-06-16T00:30 London during BST -- this
    // must land in the 16th's row, not the UTC-dated 15th's.
    const days = groupSlotsByLondonDay([slot('2026-06-15T23:30:00Z', 1, 10)])

    expect(days.map((d) => d.date)).toEqual(['2026-06-16'])
  })

  it('returns no days for an empty slot list', () => {
    expect(groupSlotsByLondonDay([])).toEqual([])
  })
})

describe('buildSmoothUsageAreaPath', () => {
  it('returns an empty string for no data', () => {
    expect(buildSmoothUsageAreaPath([])).toBe('')
  })

  it('starts the curve at the first slot and passes through every input ratio exactly', () => {
    const d = buildSmoothUsageAreaPath([0, 1, 0.5])
    // x = slotIndex + 0.5, y = 1 - ratio (SVG y is inverted: 0 = top = max usage)
    expect(d.startsWith('M 0.5 1')).toBe(true) // first point: ratio 0 -> y 1 (baseline)
    expect(d).toContain('1.5 0') // second point: ratio 1 -> y 0 (peak)
    expect(d).toContain('2.5 0.5') // third point: ratio 0.5 -> y 0.5
  })

  it('closes the area down to the y=1 baseline across the full slot-index width', () => {
    const d = buildSmoothUsageAreaPath([0.2, 0.8, 0.4, 0.1])
    expect(d.trim().endsWith('L 4 1 L 0 1 Z')).toBe(true)
  })

  it('produces the same number of curve commands regardless of the ratio values, so Compare/Optimise states stay structurally comparable', () => {
    const commandCount = (d: string) => (d.match(/ C /g) ?? []).length
    const flat = buildSmoothUsageAreaPath(new Array(48).fill(0.3))
    const peaky = buildSmoothUsageAreaPath(Array.from({ length: 48 }, (_, i) => (i === 36 ? 1 : 0.1)))
    expect(commandCount(flat)).toBe(47)
    expect(commandCount(flat)).toBe(commandCount(peaky))
  })

  it('clamps out-of-range ratios into [0, 1]', () => {
    const d = buildSmoothUsageAreaPath([-0.5, 1.5])
    expect(d).toContain('0.5 1') // -0.5 clamped to 0 -> y 1
    expect(d).toContain('1.5 0') // 1.5 clamped to 1 -> y 0
  })
})
