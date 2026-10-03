import { describe, expect, it } from 'vitest'
import { SLOTS_PER_DAY } from './archetypes'
import { HISTORICAL_PRICE_SCENARIOS } from './historicalPriceFixtures'

describe('HISTORICAL_PRICE_SCENARIOS', () => {
  it('provides exactly 48 half-hour rates for every scenario', () => {
    for (const scenario of HISTORICAL_PRICE_SCENARIOS) {
      expect(scenario.tariff.ratePence).toHaveLength(SLOTS_PER_DAY)
    }
  })

  it('has no duplicate scenario ids', () => {
    const ids = HISTORICAL_PRICE_SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes a scenario that genuinely surfaces a negative price, per OA-118\'s "preserve negative prices" rule', () => {
    const hasNegative = HISTORICAL_PRICE_SCENARIOS.some((s) => s.tariff.ratePence.some((rate) => rate < 0))
    expect(hasNegative).toBe(true)
  })

  it('gives every scenario a source URL and characterisation', () => {
    for (const scenario of HISTORICAL_PRICE_SCENARIOS) {
      expect(scenario.sourceUrl.trim().length).toBeGreaterThan(0)
      expect(scenario.characterisation.trim().length).toBeGreaterThan(0)
    }
  })
})
