import { describe, expect, it } from 'vitest'
import { HOUSEHOLD_ARCHETYPES, SLOTS_PER_DAY } from './archetypes'
import {
  flatStandardVariableTariff,
  runComplianceSensitivityAnalysis,
  runSensitivityAnalysis,
  type SensitivityScenario,
} from './sensitivity'
import type { TariffPriceCurve } from './simulator'

function agileScenario(id: string, peakMultiplier: number): SensitivityScenario {
  const ratePence = new Array(SLOTS_PER_DAY).fill(16)
  for (let slot = 32; slot < 38; slot++) ratePence[slot] = 16 * peakMultiplier
  const agileTariff: TariffPriceCurve = { id: `agile-${id}`, label: `Agile (${id})`, ratePence, standingChargePencePerDay: 54.83 }
  return { priceScenarioId: id, agileTariff }
}

describe('runSensitivityAnalysis', () => {
  it('produces one row per archetype per scenario', () => {
    const scenarios = [agileScenario('low-volatility', 1.5), agileScenario('high-volatility', 3)]
    const summary = runSensitivityAnalysis(scenarios)
    expect(summary.rows).toHaveLength(HOUSEHOLD_ARCHETYPES.length * scenarios.length)
  })

  it('reports low <= central <= high for both saving ranges', () => {
    const scenarios = [agileScenario('a', 1.2), agileScenario('b', 2), agileScenario('c', 4)]
    const summary = runSensitivityAnalysis(scenarios)
    expect(summary.timingSavingRangeGbp.low).toBeLessThanOrEqual(summary.timingSavingRangeGbp.central)
    expect(summary.timingSavingRangeGbp.central).toBeLessThanOrEqual(summary.timingSavingRangeGbp.high)
    expect(summary.tariffSavingRangeGbp.low).toBeLessThanOrEqual(summary.tariffSavingRangeGbp.central)
    expect(summary.tariffSavingRangeGbp.central).toBeLessThanOrEqual(summary.tariffSavingRangeGbp.high)
  })

  it('returns a zero range for an empty scenario list without throwing', () => {
    const summary = runSensitivityAnalysis([])
    expect(summary.rows).toHaveLength(0)
    expect(summary.timingSavingRangeGbp).toEqual({ low: 0, central: 0, high: 0 })
  })
})

describe('runComplianceSensitivityAnalysis', () => {
  it('produces one row per archetype per scenario per compliance level per waste-reduction level', () => {
    const scenarios = [agileScenario('a', 2), agileScenario('b', 3)]
    const summary = runComplianceSensitivityAnalysis(scenarios)
    expect(summary.rows).toHaveLength(HOUSEHOLD_ARCHETYPES.length * scenarios.length * 3 * 3)
  })

  it('reports a combined-opportunity range with low <= central <= high', () => {
    const summary = runComplianceSensitivityAnalysis([agileScenario('a', 2), agileScenario('b', 4)])
    expect(summary.combinedOpportunityRangeGbp.low).toBeLessThanOrEqual(summary.combinedOpportunityRangeGbp.central)
    expect(summary.combinedOpportunityRangeGbp.central).toBeLessThanOrEqual(summary.combinedOpportunityRangeGbp.high)
  })
})

describe('flatStandardVariableTariff', () => {
  it('provides exactly 48 equal rates', () => {
    const tariff = flatStandardVariableTariff()
    expect(tariff.ratePence).toHaveLength(SLOTS_PER_DAY)
    expect(new Set(tariff.ratePence).size).toBe(1)
  })
})
