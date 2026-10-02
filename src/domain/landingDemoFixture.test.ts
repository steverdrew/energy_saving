import { describe, expect, it } from 'vitest'
import { buildLandingDemoFixture } from './landingDemoFixture'

describe('buildLandingDemoFixture', () => {
  it('produces 48 half-hourly slots for every step', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.baseline.day.slots).toHaveLength(48)
    expect(fixture.compare.day.slots).toHaveLength(48)
    expect(fixture.optimise.day.slots).toHaveLength(48)
  })

  it('keeps usage identical between baseline and compare -- only the tariff changes', () => {
    const fixture = buildLandingDemoFixture()
    const baselineKwh = fixture.baseline.day.slots.map((s) => s.kwh)
    const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
    expect(compareKwh).toEqual(baselineKwh)
    expect(fixture.baseline.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)
  })

  it('preserves total energy between compare and optimise, only moving the flexible load', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.optimise.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)

    const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
    const optimiseKwh = fixture.optimise.day.slots.map((s) => s.kwh)
    const changedIndices = compareKwh.reduce<number[]>((acc, v, i) => {
      if (Math.abs((v ?? 0) - (optimiseKwh[i] ?? 0)) > 1e-9) acc.push(i)
      return acc
    }, [])
    expect(changedIndices.sort((a, b) => a - b)).toEqual([4, 5, 36, 37])
  })

  it('keeps optimise on the same tariff (rates) as compare', () => {
    const fixture = buildLandingDemoFixture()
    const compareRates = fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
    const optimiseRates = fixture.optimise.day.slots.map((s) => s.unitRateIncVatPence)
    expect(optimiseRates).toEqual(compareRates)
    expect(fixture.optimise.tariffName).toBe(fixture.compare.tariffName)
  })

  it('computes each step total cost as the sum of kwh times rate', () => {
    const fixture = buildLandingDemoFixture()
    for (const step of [fixture.baseline, fixture.compare, fixture.optimise]) {
      const expected = step.day.slots.reduce((sum, s) => sum + (s.kwh ?? 0) * (s.unitRateIncVatPence ?? 0), 0)
      expect(step.totalCostPence).toBeCloseTo(expected, 6)
    }
  })

  it('derives the tariff-switch and timing savings from the step costs', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.tariffSwitchSavingPence).toBeCloseTo(fixture.baseline.totalCostPence - fixture.compare.totalCostPence, 6)
    expect(fixture.timingSavingPence).toBeCloseTo(fixture.compare.totalCostPence - fixture.optimise.totalCostPence, 6)
  })

  it('builds a multi-day landscape (OA-85) ending on the same day as the headline `day`', () => {
    const fixture = buildLandingDemoFixture()
    for (const step of [fixture.baseline, fixture.compare, fixture.optimise]) {
      expect(step.days).toHaveLength(4)
      expect(step.days.every((d) => d.slots.length === 48)).toBe(true)
      expect(step.days[step.days.length - 1]).toEqual(step.day)
      // Dates are distinct and in order.
      expect(step.days.map((d) => d.date)).toEqual([...step.days.map((d) => d.date)].sort())
      expect(new Set(step.days.map((d) => d.date)).size).toBe(4)
    }
  })
})
