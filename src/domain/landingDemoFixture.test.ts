import { describe, expect, it } from 'vitest'
import {
  buildLandingDemoFixture,
  LANDING_DEMO_DATA_SOURCES,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
} from './landingDemoFixture'

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

  // OA-99: grounded in published Ofgem/Elexon/Octopus data rather than
  // invented numbers.
  it('scales baseline usage to the Ofgem medium TDCV annual-average day (2,500 kWh/year)', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.baseline.totalKwh).toBeCloseTo(2500 / 365, 2)
  })

  it('uses the Ofgem price-cap average Direct Debit unit rate as a flat Standard Variable rate', () => {
    const fixture = buildLandingDemoFixture()
    const rates = fixture.baseline.day.slots.map((s) => s.unitRateIncVatPence)
    expect(new Set(rates)).toEqual(new Set([26.32]))
  })

  it('exposes the standing charge as a separate, documented figure never folded into usage cost', () => {
    expect(OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY).toBe(54.83)
  })

  it('keeps provenance metadata alongside the fixture, testable and inspectable', () => {
    expect(LANDING_DEMO_DATA_SOURCES.annualKwhSource).toMatch(/2,500 kWh\/year/)
    expect(LANDING_DEMO_DATA_SOURCES.tariffRegion).toBe('C (London)')
    expect(LANDING_DEMO_DATA_SOURCES.tariffDate).toBe('2026-06-15')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemTdcv).toContain('ofgem.gov.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemPriceCap).toContain('ofgem.gov.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.elexonProfiling).toContain('elexon.co.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.octopusAgileApi).toContain('octopus.energy')
    expect(LANDING_DEMO_DATA_SOURCES.fixtureVersion).toBeTruthy()
  })
})
