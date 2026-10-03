import { describe, expect, it } from 'vitest'
import { SLOTS_PER_DAY } from './archetypes'
import { buildLandingPageClaimRanges } from './landingPageClaims'
import { runSensitivityAnalysis, type SensitivityScenario } from './sensitivity'
import type { TariffPriceCurve } from './simulator'

function agileScenario(id: string, peakMultiplier: number): SensitivityScenario {
  const ratePence = new Array(SLOTS_PER_DAY).fill(16)
  for (let slot = 32; slot < 38; slot++) ratePence[slot] = 16 * peakMultiplier
  const agileTariff: TariffPriceCurve = { id: `agile-${id}`, label: `Agile (${id})`, ratePence, standingChargePencePerDay: 54.83 }
  return { priceScenarioId: id, agileTariff }
}

describe('buildLandingPageClaimRanges', () => {
  it('produces a tariff-switch claim and separate EV / non-EV timing claims', () => {
    const summary = runSensitivityAnalysis([agileScenario('a', 2), agileScenario('b', 3)])
    const claims = buildLandingPageClaimRanges(summary)
    const claimIds = claims.map((c) => c.claim)
    expect(claimIds).toContain('tariff-switch-saving')
    expect(claimIds).toContain('timing-saving-non-ev-household')
    expect(claimIds).toContain('timing-saving-ev-household')
  })

  it('attaches a non-empty caveat to every claim', () => {
    const summary = runSensitivityAnalysis([agileScenario('a', 2)])
    const claims = buildLandingPageClaimRanges(summary)
    for (const claim of claims) {
      expect(claim.caveat.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps low <= central <= high for every claim', () => {
    const summary = runSensitivityAnalysis([agileScenario('a', 1.5), agileScenario('b', 2), agileScenario('c', 3)])
    const claims = buildLandingPageClaimRanges(summary)
    for (const claim of claims) {
      expect(claim.low).toBeLessThanOrEqual(claim.central)
      expect(claim.central).toBeLessThanOrEqual(claim.high)
    }
  })
})
