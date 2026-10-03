import { describe, expect, it } from 'vitest'
import { buildEvidenceReport, CANONICAL_DEMO_ARCHETYPE_ID, KNOWN_DATA_GAPS } from './evidenceReport'

describe('buildEvidenceReport', () => {
  it('does not throw -- the model reproduces a defensible typical-household range', () => {
    expect(() => buildEvidenceReport('2026-10-03')).not.toThrow()
  })

  it('includes a row for the canonical demo archetype, with a central combined opportunity that is positive', () => {
    const report = buildEvidenceReport('2026-10-03')
    const typical = report.archetypeRows.find((r) => r.archetypeId === CANONICAL_DEMO_ARCHETYPE_ID)
    expect(typical).toBeDefined()
    expect(typical!.combinedOpportunityRangeGbp.central).toBeGreaterThan(0)
    expect(typical!.tariffSavingRangeGbp.central).toBeGreaterThan(0)
  })

  it('reports a wide tariff-saving range for the typical household, including a stress scenario where Agile loses to Standard Variable', () => {
    // OA-118: "do not assume Agile is always the best tariff" -- the
    // single winter-high-cost day's usage-concentrated-in-the-peak-window
    // result should surface as a real negative, not be smoothed away.
    const report = buildEvidenceReport('2026-10-03')
    const typical = report.archetypeRows.find((r) => r.archetypeId === CANONICAL_DEMO_ARCHETYPE_ID)
    expect(typical!.tariffSavingRangeGbp.low).toBeLessThan(0)
  })

  it('recommends a demo household backed by a real scenario id', () => {
    const report = buildEvidenceReport('2026-10-03')
    expect(report.priceScenarioIds).toContain(report.recommendedDemoHousehold.priceScenarioId)
  })

  it('surfaces the known data gaps', () => {
    const report = buildEvidenceReport('2026-10-03')
    expect(report.dataGaps).toEqual(KNOWN_DATA_GAPS)
  })

  it('produces non-empty markdown containing every archetype label', () => {
    const report = buildEvidenceReport('2026-10-03')
    for (const row of report.archetypeRows) {
      expect(report.markdown).toContain(row.archetypeLabel)
    }
  })
})

describe('OA-130: real household snapshot sanity check', () => {
  it('includes all 3 real snapshot days, never annualised, flagged as a sanity check only', () => {
    const report = buildEvidenceReport('2026-10-03')
    expect(report.realHouseholdSnapshot.isSanityCheckOnly).toBe(true)
    expect(report.realHouseholdSnapshot.days).toHaveLength(3)
    for (const day of report.realHouseholdSnapshot.days) {
      expect(day.consumptionKwh).toHaveLength(48)
      expect(day.totalKwh).toBeLessThan(50)
    }
  })

  it('identifies the real anomalous day and its ratio to the next-highest day', () => {
    const report = buildEvidenceReport('2026-10-03')
    expect(report.realHouseholdSnapshot.anomalousDayDate).toBe('2026-09-29')
    expect(report.realHouseholdSnapshot.anomalousDayRatioToNextHighestDay).toBeGreaterThan(1)
  })

  it('does not change the canonical landing-page figures', () => {
    // OA-160: `family-typical`'s events were replaced with the landing
    // demo's own event data (now the one shared source for both), so this
    // figure moved from its prior value -- expected, not a regression.
    // OA-165: the washing machine and dishwasher's scheduling windows were
    // widened to the full day (previously daytime/evening-only, which made
    // it impossible for either to ever be optimised into an overnight
    // off-peak window) -- this genuinely raises the combined opportunity,
    // another expected move, not a regression.
    const report = buildEvidenceReport('2026-10-03')
    expect(report.canonicalLandingPageFigures.combinedAnnualOpportunityGbp).toBeCloseTo(169.86, 1)
  })

  it('renders the sanity-check section in the markdown report', () => {
    const report = buildEvidenceReport('2026-10-03')
    expect(report.markdown).toContain('Real household snapshot sanity check')
    expect(report.markdown).toContain('2026-09-29')
    expect(report.markdown).toContain('sanity check, not a representative archetype')
  })
})
