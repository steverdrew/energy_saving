import { describe, expect, it } from 'vitest'
import {
  findAnnotations,
  findPeakWindow,
  formatSlotTime,
  groupSlotsByLondonDay,
  maxUsage,
  rateCategoryIndex,
  rateColorStepIndex,
  rateRange,
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

describe('rateCategoryIndex', () => {
  it('maps the lowest third of the range to cheap (0)', () => {
    expect(rateCategoryIndex(10, 10, 40)).toBe(0)
    expect(rateCategoryIndex(19, 10, 40)).toBe(0)
  })

  it('maps the middle third of the range to standard (1)', () => {
    expect(rateCategoryIndex(20, 10, 40)).toBe(1)
    expect(rateCategoryIndex(29, 10, 40)).toBe(1)
  })

  it('maps the top third of the range to peak (2)', () => {
    expect(rateCategoryIndex(30, 10, 40)).toBe(2)
    expect(rateCategoryIndex(40, 10, 40)).toBe(2)
  })

  it('returns the standard band for a flat tariff where min equals max', () => {
    expect(rateCategoryIndex(15, 15, 15)).toBe(1)
  })

  it('returns null for an unknown or non-finite rate', () => {
    expect(rateCategoryIndex(null, 10, 40)).toBe(null)
    expect(rateCategoryIndex(Number.NaN, 10, 40)).toBe(null)
  })

  it('clamps rates outside the observed range', () => {
    expect(rateCategoryIndex(0, 10, 40)).toBe(0)
    expect(rateCategoryIndex(100, 10, 40)).toBe(2)
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

describe('findPeakWindow', () => {
  it('finds the longest run of peak-band slots', () => {
    const day: HeatMapDay = {
      date: '2026-01-01',
      slots: [
        slot('2026-01-01T00:00:00Z', 0.1, 10), // cheap
        slot('2026-01-01T00:30:00Z', 0.1, 40), // peak
        slot('2026-01-01T01:00:00Z', 0.1, 10), // cheap -- breaks the run
        slot('2026-01-01T01:30:00Z', 0.1, 35), // peak
        slot('2026-01-01T02:00:00Z', 0.1, 38), // peak -- longest run: slots 3-4
      ],
    }
    expect(findPeakWindow(day, 10, 40)).toEqual({ startSlot: 3, endSlot: 4 })
  })

  it('returns null for a flat tariff with no peak band', () => {
    const day: HeatMapDay = {
      date: '2026-01-01',
      slots: [slot('2026-01-01T00:00:00Z', 0.1, 15), slot('2026-01-01T00:30:00Z', 0.1, 15)],
    }
    expect(findPeakWindow(day, 15, 15)).toBe(null)
  })

  it('returns null for an undefined day', () => {
    expect(findPeakWindow(undefined, 10, 40)).toBe(null)
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
