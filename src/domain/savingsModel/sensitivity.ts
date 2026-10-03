/**
 * OA-122: sensitivity analysis across household archetypes (OA-120),
 * representative/historical Agile price periods (OA-122 follow-up:
 * `historicalPriceFixtures.ts`), and compliance/waste-reduction
 * assumptions, so OA-123's landing-page claims can be set from a range
 * rather than one single favourable run.
 */

import { HOUSEHOLD_ARCHETYPES, type HouseholdArchetype } from './archetypes'
import { requireVerifiedOrPlausible } from './assumptions'
import {
  COMPLIANCE_LEVELS,
  simulateHouseholdOpportunity,
  simulateHouseholdOpportunityAtCompliance,
  WASTE_REDUCTION_LEVELS,
  type TariffPriceCurve,
} from './simulator'

const STANDARD_VARIABLE_RATE_PENCE = requireVerifiedOrPlausible('ofgem-price-cap-average-unit-rate').value as number
const STANDING_CHARGE_PENCE = requireVerifiedOrPlausible('ofgem-price-cap-standing-charge').value as number

export function flatStandardVariableTariff(): TariffPriceCurve {
  return {
    id: 'standard-variable',
    label: 'Standard Variable',
    ratePence: new Array(48).fill(STANDARD_VARIABLE_RATE_PENCE),
    standingChargePencePerDay: STANDING_CHARGE_PENCE,
  }
}

/**
 * OA-118: "do not assume Agile is always the best tariff" -- callers must
 * supply the Agile price curve(s) to sweep (e.g. several representative
 * 48-slot curves built from different historical periods/years), rather
 * than this module hard-coding one. This keeps the sensitivity sweep
 * honest about which input years it actually covers. `historicalPriceFixtures.ts`
 * provides the real-data scenarios OA-122 asked for; this stays
 * source-agnostic so a caller can still pass synthetic scenarios too.
 */
export interface SensitivityScenario {
  /** A label for the price-history scenario, e.g. a year or "low-volatility year". */
  priceScenarioId: string
  agileTariff: TariffPriceCurve
}

export interface SensitivityResultRow {
  archetypeId: string
  archetypeLabel: string
  priceScenarioId: string
  annualTariffSavingGbp: number
  annualTimingSavingGbp: number
  wasteAnnualSavingGbp: { low: number; central: number; high: number }
}

export interface SensitivitySummary {
  rows: readonly SensitivityResultRow[]
  /** Across every archetype x scenario combination -- the range OA-123 should set defensible copy from, never a single favourable cell. */
  timingSavingRangeGbp: { low: number; central: number; high: number }
  tariffSavingRangeGbp: { low: number; central: number; high: number }
}

function range(values: readonly number[]): { low: number; central: number; high: number } {
  if (values.length === 0) return { low: 0, central: 0, high: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const low = sorted[0]
  const high = sorted[sorted.length - 1]
  const central = sorted[Math.floor(sorted.length / 2)]
  return { low, central, high }
}

/** Runs every archetype against every supplied Agile price scenario, from the same Standard Variable baseline. */
export function runSensitivityAnalysis(
  scenarios: readonly SensitivityScenario[],
  archetypes: readonly HouseholdArchetype[] = HOUSEHOLD_ARCHETYPES,
): SensitivitySummary {
  const standardVariable = flatStandardVariableTariff()
  const rows: SensitivityResultRow[] = []

  for (const archetype of archetypes) {
    for (const scenario of scenarios) {
      const result = simulateHouseholdOpportunity(archetype, standardVariable, scenario.agileTariff)
      rows.push({
        archetypeId: archetype.id,
        archetypeLabel: archetype.label,
        priceScenarioId: scenario.priceScenarioId,
        annualTariffSavingGbp: result.annualTariffSavingGbp,
        annualTimingSavingGbp: result.annualTimingSavingGbp,
        wasteAnnualSavingGbp: archetype.standbyAnnualCostGbp,
      })
    }
  }

  return {
    rows,
    timingSavingRangeGbp: range(rows.map((r) => r.annualTimingSavingGbp)),
    tariffSavingRangeGbp: range(rows.map((r) => r.annualTariffSavingGbp)),
  }
}

export interface ComplianceSensitivityRow {
  archetypeId: string
  archetypeLabel: string
  priceScenarioId: string
  complianceId: string
  wasteReductionId: string
  annualTariffSavingGbp: number
  annualTimingSavingAtComplianceGbp: number
  annualWasteSavingAtReductionGbp: number
  combinedAnnualOpportunityGbp: number
}

export interface ComplianceSensitivitySummary {
  rows: readonly ComplianceSensitivityRow[]
  combinedOpportunityRangeGbp: { low: number; central: number; high: number }
}

/**
 * OA-122 (follow-up): the full cross-product of archetype x price
 * scenario x compliance level x waste-reduction level -- every cell
 * reports tariff/timing/waste separately plus the validated non-
 * overlapping combined total (see `simulateHouseholdOpportunityAtCompliance`).
 * Deliberately a separate function from `runSensitivityAnalysis` (which
 * predates the compliance/waste dimensions) rather than changing that
 * function's existing return shape.
 */
export function runComplianceSensitivityAnalysis(
  scenarios: readonly SensitivityScenario[],
  archetypes: readonly HouseholdArchetype[] = HOUSEHOLD_ARCHETYPES,
  complianceLevels: readonly { id: string; label: string; fraction: number }[] = COMPLIANCE_LEVELS,
  wasteReductionLevels: readonly { id: string; label: string; fraction: number }[] = WASTE_REDUCTION_LEVELS,
): ComplianceSensitivitySummary {
  const standardVariable = flatStandardVariableTariff()
  const rows: ComplianceSensitivityRow[] = []

  for (const archetype of archetypes) {
    for (const scenario of scenarios) {
      for (const compliance of complianceLevels) {
        for (const wasteReduction of wasteReductionLevels) {
          const result = simulateHouseholdOpportunityAtCompliance(
            archetype,
            standardVariable,
            scenario.agileTariff,
            compliance,
            wasteReduction,
          )
          rows.push({
            archetypeId: archetype.id,
            archetypeLabel: archetype.label,
            priceScenarioId: scenario.priceScenarioId,
            complianceId: compliance.id,
            wasteReductionId: wasteReduction.id,
            annualTariffSavingGbp: result.annualTariffSavingGbp,
            annualTimingSavingAtComplianceGbp: result.annualTimingSavingAtComplianceGbp,
            annualWasteSavingAtReductionGbp: result.annualWasteSavingAtReductionGbp,
            combinedAnnualOpportunityGbp: result.combinedAnnualOpportunityGbp,
          })
        }
      }
    }
  }

  return {
    rows,
    combinedOpportunityRangeGbp: range(rows.map((r) => r.combinedAnnualOpportunityGbp)),
  }
}
