/**
 * OA-123: derives defensible copy/claim ranges from OA-121/OA-122's model
 * output, for comparison against (not automatic replacement of) OA-99's
 * existing landing-page demo household and OA-104's annualisation. Per
 * OA-118's "this epic does not replace OA-99/OA-104/OA-117" -- this module
 * is read by a human (or a future, separately-scoped ticket) deciding
 * whether the landing page's existing numbers are still defensible, not
 * wired into LandingDemo.tsx directly.
 */

import { HOUSEHOLD_ARCHETYPES } from './archetypes'
import type { SensitivitySummary } from './sensitivity'

export interface LandingPageClaimRange {
  claim: string
  low: number
  central: number
  high: number
  unit: string
  /** Why this range should or shouldn't be used verbatim in customer-facing copy. */
  caveat: string
}

/**
 * OA-118: "the research also suggests that timing alone for a typical
 * non-EV household may often be only tens of pounds per year, so the
 * product must not inflate this into a larger promise." This turns a
 * sensitivity summary into claim ranges with that caveat attached
 * explicitly, rather than letting a headline figure travel without it.
 */
export function buildLandingPageClaimRanges(sensitivity: SensitivitySummary): readonly LandingPageClaimRange[] {
  const nonEvArchetypeIds = new Set(HOUSEHOLD_ARCHETYPES.filter((a) => !a.hasEv).map((a) => a.id))
  const nonEvTimingSavings = sensitivity.rows
    .filter((r) => nonEvArchetypeIds.has(r.archetypeId))
    .map((r) => r.annualTimingSavingGbp)
  const evTimingSavings = sensitivity.rows
    .filter((r) => !nonEvArchetypeIds.has(r.archetypeId))
    .map((r) => r.annualTimingSavingGbp)

  const sorted = (values: number[]) => [...values].sort((a, b) => a - b)

  return [
    {
      claim: 'tariff-switch-saving',
      low: round2(sensitivity.tariffSavingRangeGbp.low),
      central: round2(sensitivity.tariffSavingRangeGbp.central),
      high: round2(sensitivity.tariffSavingRangeGbp.high),
      unit: 'GBP/year',
      caveat: 'Tariff-switch saving is independent of timing and should be presented as its own claim, never summed with the timing claim below without clearly labelling both.',
    },
    {
      claim: 'timing-saving-non-ev-household',
      low: round2(Math.min(...sorted(nonEvTimingSavings), 0)),
      central: round2(median(nonEvTimingSavings)),
      high: round2(Math.max(...sorted(nonEvTimingSavings), 0)),
      unit: 'GBP/year',
      caveat: 'Per OA-118: timing alone for a typical non-EV household is often only "tens of pounds per year" -- do not headline a figure outside this range for a non-EV household, and do not imply this is typical for EV-owning households.',
    },
    {
      claim: 'timing-saving-ev-household',
      low: round2(Math.min(...sorted(evTimingSavings), 0)),
      central: round2(median(evTimingSavings)),
      high: round2(Math.max(...sorted(evTimingSavings), 0)),
      unit: 'GBP/year',
      caveat: 'EV-owning households show materially larger timing opportunity (overnight charging is the single largest movable load) -- keep this claim scoped to EV-owning archetypes, never generalised to the typical household.',
    },
  ]
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
