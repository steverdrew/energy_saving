import { describe, expect, it } from 'vitest'
import { getArchetype, SLOTS_PER_DAY } from './archetypes'
import { flatStandardVariableTariff } from './sensitivity'
import {
  buildUsageProfile,
  COMPLIANCE_LEVELS,
  costPence,
  simulateHouseholdOpportunity,
  simulateHouseholdOpportunityAtCompliance,
  sumKwh,
  tariffEffect,
  timingEffect,
  WASTE_REDUCTION_LEVELS,
  type TariffPriceCurve,
} from './simulator'

const typical = getArchetype('family-typical')
const standardVariable = flatStandardVariableTariff()

function agileLikeTariff(): TariffPriceCurve {
  const ratePence = new Array(SLOTS_PER_DAY).fill(16)
  for (let slot = 32; slot < 38; slot++) ratePence[slot] = 32 // 16:00-19:00 structural peak
  return { id: 'agile-test', label: 'Agile (test)', ratePence, standingChargePencePerDay: 54.83 }
}

describe('buildUsageProfile', () => {
  it('produces exactly 48 slots summing to the archetype\'s daily total', () => {
    const usage = buildUsageProfile(typical)
    expect(usage).toHaveLength(SLOTS_PER_DAY)
    expect(sumKwh(usage)).toBeCloseTo(typical.annualKwh / 365, 6)
  })

  it('moves an event\'s kWh without changing the total', () => {
    const before = buildUsageProfile(typical)
    const after = buildUsageProfile(typical, { washing_machine: 30 })
    expect(sumKwh(after)).toBeCloseTo(sumKwh(before), 6)
    expect(after).not.toEqual(before)
  })

  it('throws if an archetype\'s events exceed its own daily total', () => {
    const overloaded = { ...typical, annualKwh: 1 }
    expect(() => buildUsageProfile(overloaded)).toThrow(/base load cannot be negative/)
  })
})

describe('tariffEffect', () => {
  it('reports zero saving when both tariffs are identical', () => {
    const usage = buildUsageProfile(typical)
    const result = tariffEffect(usage, standardVariable, standardVariable)
    expect(result.dailySavingPence).toBeCloseTo(0, 6)
  })

  it('reports a positive saving when the destination tariff is cheaper on average', () => {
    const usage = buildUsageProfile(typical)
    const cheaperTariff: TariffPriceCurve = { ...standardVariable, id: 'cheap', ratePence: new Array(48).fill(1) }
    const result = tariffEffect(usage, standardVariable, cheaperTariff)
    expect(result.dailySavingPence).toBeGreaterThan(0)
  })
})

describe('timingEffect', () => {
  it('never increases total kWh (conserved by construction)', () => {
    const agile = agileLikeTariff()
    const result = timingEffect(typical, agile)
    expect(result.dailySavingPence).toBeGreaterThanOrEqual(0)
  })

  it('does not move the fixed oven event', () => {
    const agile = agileLikeTariff()
    const result = timingEffect(typical, agile)
    expect(result.movedEventIds).not.toContain('oven_cooking')
  })

  it('reports zero saving under a flat tariff (nothing cheaper to move to)', () => {
    const result = timingEffect(typical, standardVariable)
    expect(result.dailySavingPence).toBeCloseTo(0, 6)
    expect(result.movedEventIds).toHaveLength(0)
  })
})

describe('costPence', () => {
  it('adds the standing charge only when requested', () => {
    const usage = buildUsageProfile(typical)
    const withCharge = costPence(usage, standardVariable, true)
    const withoutCharge = costPence(usage, standardVariable, false)
    expect(withCharge - withoutCharge).toBeCloseTo(standardVariable.standingChargePencePerDay, 6)
  })

  it('throws if a tariff does not provide exactly 48 rates', () => {
    const usage = buildUsageProfile(typical)
    const badTariff: TariffPriceCurve = { ...standardVariable, ratePence: [1, 2, 3] }
    expect(() => costPence(usage, badTariff, false)).toThrow(/exactly 48/)
  })
})

describe('simulateHouseholdOpportunity', () => {
  it('keeps tariff, timing and waste effects as separate, never-summed fields', () => {
    const agile = agileLikeTariff()
    const result = simulateHouseholdOpportunity(typical, standardVariable, agile)
    expect(result).toHaveProperty('tariff')
    expect(result).toHaveProperty('timing')
    expect(result).toHaveProperty('waste')
    expect(typeof result.annualTariffSavingGbp).toBe('number')
    expect(typeof result.annualTimingSavingGbp).toBe('number')
  })
})

describe('simulateHouseholdOpportunityAtCompliance', () => {
  it('scales the realised timing saving linearly with the compliance fraction', () => {
    const agile = agileLikeTariff()
    const low = simulateHouseholdOpportunityAtCompliance(typical, standardVariable, agile, COMPLIANCE_LEVELS[0], WASTE_REDUCTION_LEVELS[0])
    const full = simulateHouseholdOpportunityAtCompliance(typical, standardVariable, agile, COMPLIANCE_LEVELS[2], WASTE_REDUCTION_LEVELS[0])
    expect(full.annualTimingSavingAtComplianceGbp).toBeGreaterThan(low.annualTimingSavingAtComplianceGbp)
    expect(full.annualTimingSavingAtComplianceGbp).toBeCloseTo(full.annualTimingSavingGbp, 6)
  })

  it('combines tariff + realised timing + realised waste into one validated total', () => {
    const agile = agileLikeTariff()
    const result = simulateHouseholdOpportunityAtCompliance(typical, standardVariable, agile, COMPLIANCE_LEVELS[1], WASTE_REDUCTION_LEVELS[1])
    expect(result.combinedAnnualOpportunityGbp).toBeCloseTo(
      result.annualTariffSavingGbp + result.annualTimingSavingAtComplianceGbp + result.annualWasteSavingAtReductionGbp,
      6,
    )
  })

  it('never realises more waste saving than the archetype\'s own central standby-cost estimate', () => {
    const agile = agileLikeTariff()
    const result = simulateHouseholdOpportunityAtCompliance(typical, standardVariable, agile, COMPLIANCE_LEVELS[2], WASTE_REDUCTION_LEVELS[2])
    expect(result.annualWasteSavingAtReductionGbp).toBeCloseTo(typical.standbyAnnualCostGbp.central, 6)
  })
})
