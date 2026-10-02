import { describe, expect, it } from 'vitest'
import {
  findAnnotations,
  formatSlotTime,
  maxUsage,
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
