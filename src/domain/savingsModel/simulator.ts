/**
 * OA-121: a reproducible half-hourly simulator that reports a household
 * archetype's (OA-120) saving opportunity as three separate, never-summed-
 * by-accident effects, per OA-118's rules:
 *
 *   1. Tariff effect  -- same usage, same timings, alternative tariff.
 *   2. Timing effect  -- same total kWh, flexible loads moved within the
 *      same tariff.
 *   3. Waste effect   -- avoidable standby/background consumption removed,
 *      independent of tariff or timing.
 *
 * Deterministic: no Math.random(), no wall-clock dependence -- same inputs
 * always produce the same output, so this can be snapshot-tested and
 * safely re-run for OA-122's sensitivity analysis.
 */

import type { ApplianceEvent, HouseholdArchetype } from './archetypes'
import { SLOTS_PER_DAY } from './archetypes'

export interface TariffPriceCurve {
  id: string
  label: string
  /** Exactly 48 half-hour unit rates, inc. VAT. Flat-rate tariffs still provide 48 equal values, per OA-118's "never collapse into a single rate" rule. */
  ratePence: readonly number[]
  standingChargePencePerDay: number
}

function assertFortyEightSlots(ratePence: readonly number[], tariffId: string): void {
  if (ratePence.length !== SLOTS_PER_DAY) {
    throw new Error(`Tariff "${tariffId}" must provide exactly ${SLOTS_PER_DAY} half-hour rates, got ${ratePence.length}.`)
  }
}

function eventPositions(events: readonly ApplianceEvent[], overrides: Readonly<Record<string, number>>): Record<string, number> {
  const positions: Record<string, number> = {}
  // Dependency-ordered, same pattern as landingDemoFixture.ts's
  // buildLandingDemoFixture -- resolve independent events first so a
  // dependent event's clamp sees its dependency's already-resolved slot.
  const ordered = [...events].sort((a, b) => (a.dependsOnEventId ? 1 : 0) - (b.dependsOnEventId ? 1 : 0))
  for (const event of ordered) {
    const requested = overrides[event.id] ?? event.actualStartSlot
    positions[event.id] = clampToValidWindow(event, requested)
  }
  return positions
}

function dependencyMinStartSlot(event: ApplianceEvent, positions: Readonly<Record<string, number>>, allEvents: readonly ApplianceEvent[]): number {
  if (!event.dependsOnEventId) return event.validStartSlotRange.min
  const dependency = allEvents.find((e) => e.id === event.dependsOnEventId)
  if (!dependency) return event.validStartSlotRange.min
  const dependencyStart = positions[dependency.id] ?? dependency.actualStartSlot
  return Math.max(event.validStartSlotRange.min, dependencyStart + dependency.slotCount)
}

function clampToValidWindow(event: ApplianceEvent, startSlot: number): number {
  const min = Math.min(event.validStartSlotRange.min, event.validStartSlotRange.max)
  const max = event.validStartSlotRange.max
  const rounded = Math.round(startSlot)
  return Math.max(min, Math.min(max, rounded))
}

/** Lays an archetype's events plus base/background load onto a 48-slot kWh array, preserving total kWh regardless of event positions. */
export function buildUsageProfile(archetype: HouseholdArchetype, eventOverrides: Readonly<Record<string, number>> = {}): number[] {
  const positions = eventPositions(archetype.events, eventOverrides)
  const eventKwhTotal = archetype.events.reduce((sum, e) => sum + e.kwhPerSlot * e.slotCount, 0)
  const baseLoadTotal = archetype.annualKwh / 365 - eventKwhTotal
  if (baseLoadTotal < 0) {
    throw new Error(
      `Archetype "${archetype.id}": modelled events (${eventKwhTotal.toFixed(2)} kWh) exceed its daily total (${(archetype.annualKwh / 365).toFixed(2)} kWh) -- base load cannot be negative.`,
    )
  }

  // Same documented-shape-not-literal-table caveat as OA-99's
  // BASE_LOAD_SHAPE (see OA-119's elexon-pc1-domestic-load-shape
  // assumption): a diurnal weighting consistent with Elexon PC1's
  // published characteristics, scaled to this archetype's own residual
  // base-load total.
  const shape = [
    0.1, 0.09, 0.09, 0.08, 0.08, 0.09, 0.09, 0.1, 0.1, 0.11, 0.11, 0.12, 0.22, 0.3, 0.28, 0.24, 0.2, 0.18, 0.14, 0.14,
    0.13, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15, 0.14, 0.14, 0.14, 0.14, 0.22, 0.3, 0.38, 0.42, 0.4, 0.36, 0.34, 0.3,
    0.26, 0.22, 0.18, 0.16, 0.15, 0.14, 0.13, 0.12,
  ]
  const shapeTotal = shape.reduce((sum, v) => sum + v, 0)
  const scale = baseLoadTotal / shapeTotal
  const usage = shape.map((v) => v * scale)

  for (const event of archetype.events) {
    const start = positions[event.id]
    for (let i = 0; i < event.slotCount; i++) usage[start + i] += event.kwhPerSlot
  }
  return usage
}

export function sumKwh(usage: readonly number[]): number {
  return usage.reduce((sum, v) => sum + v, 0)
}

export function costPence(usage: readonly number[], tariff: TariffPriceCurve, includeStandingCharge: boolean): number {
  assertFortyEightSlots(tariff.ratePence, tariff.id)
  const usageCost = usage.reduce((sum, v, i) => sum + v * tariff.ratePence[i], 0)
  return includeStandingCharge ? usageCost + tariff.standingChargePencePerDay : usageCost
}

export interface TariffEffectResult {
  fromTariffId: string
  toTariffId: string
  /** Positive = switching saves money (same usage-cost-only basis for both tariffs, per OA-118's "never double-count" rule). */
  dailySavingPence: number
}

/** Effect 1: same usage, same timings, alternative tariff. Usage-cost-only by construction -- standing charges are a separate, explicit comparison, never silently mixed in. */
export function tariffEffect(usage: readonly number[], fromTariff: TariffPriceCurve, toTariff: TariffPriceCurve): TariffEffectResult {
  const fromCost = costPence(usage, fromTariff, false)
  const toCost = costPence(usage, toTariff, false)
  return { fromTariffId: fromTariff.id, toTariffId: toTariff.id, dailySavingPence: fromCost - toCost }
}

export interface TimingEffectResult {
  tariffId: string
  /** Positive = moving flexible loads to their cheapest valid slot saves money under this one tariff. */
  dailySavingPence: number
  movedEventIds: string[]
}

/**
 * Effect 2: same tariff, same total kWh -- only genuinely movable events
 * may shift, each to its own cheapest valid slot (dependency-aware, same
 * algorithm as landingDemoFixture.ts's cheapestStartSlotForEvent). Fixed
 * events and base load are untouched, so total kWh is provably conserved.
 */
export function timingEffect(archetype: HouseholdArchetype, tariff: TariffPriceCurve): TimingEffectResult {
  assertFortyEightSlots(tariff.ratePence, tariff.id)
  const baselineUsage = buildUsageProfile(archetype)
  const baselineCost = costPence(baselineUsage, tariff, false)

  const optimisedOverrides: Record<string, number> = {}
  const movedEventIds: string[] = []
  const ordered = [...archetype.events].sort((a, b) => (a.dependsOnEventId ? 1 : 0) - (b.dependsOnEventId ? 1 : 0))
  for (const event of ordered) {
    if (!event.movable) continue
    const min = Math.max(event.validStartSlotRange.min, dependencyMinStartSlot(event, optimisedOverrides, archetype.events))
    const max = event.validStartSlotRange.max
    let bestSlot = event.actualStartSlot
    let bestCost = Infinity
    for (let slot = min; slot <= max; slot++) {
      let cost = 0
      for (let i = 0; i < event.slotCount; i++) cost += event.kwhPerSlot * tariff.ratePence[slot + i]
      if (cost < bestCost) {
        bestCost = cost
        bestSlot = slot
      }
    }
    optimisedOverrides[event.id] = bestSlot
    if (bestSlot !== event.actualStartSlot) movedEventIds.push(event.id)
  }

  const optimisedUsage = buildUsageProfile(archetype, optimisedOverrides)
  const optimisedCost = costPence(optimisedUsage, tariff, false)

  // Total kWh conserved -- events only move, base load untouched.
  if (Math.abs(sumKwh(optimisedUsage) - sumKwh(baselineUsage)) > 1e-9) {
    throw new Error(`Timing effect for archetype "${archetype.id}" did not conserve total kWh -- this is a bug, not a modelling choice.`)
  }

  return { tariffId: tariff.id, dailySavingPence: baselineCost - optimisedCost, movedEventIds }
}

export interface WasteEffectResult {
  /** Standby/background cost removed, independent of tariff or timing -- OA-118's "treat waste reduction separately from load shifting" rule. */
  annualSavingGbp: { low: number; central: number; high: number }
}

/** Effect 3: avoidable standby/background consumption, modelled entirely independently of the tariff/timing effects above -- never derived from usage-profile kWh, so it can never double-count slots already counted as a tariff or timing saving. */
export function wasteEffect(archetype: HouseholdArchetype): WasteEffectResult {
  return { annualSavingGbp: archetype.standbyAnnualCostGbp }
}

export interface HouseholdOpportunityResult {
  archetypeId: string
  tariff: TariffEffectResult
  timing: TimingEffectResult
  waste: WasteEffectResult
  /** Annualised using the same 52-weeks-per-year convention as OA-104/landingDemoFixture -- daily figures above are never naively multiplied by 365. */
  annualTariffSavingGbp: number
  annualTimingSavingGbp: number
}

const WEEKS_PER_YEAR = 52
const DAYS_PER_WEEK = 7

/** The full three-effect opportunity for one archetype under a from/to tariff pair -- the single entry point OA-122's sensitivity sweep and OA-123's claim-setting should call. */
export function simulateHouseholdOpportunity(
  archetype: HouseholdArchetype,
  fromTariff: TariffPriceCurve,
  toTariff: TariffPriceCurve,
): HouseholdOpportunityResult {
  const usage = buildUsageProfile(archetype)
  const tariff = tariffEffect(usage, fromTariff, toTariff)
  const timing = timingEffect(archetype, toTariff)
  const waste = wasteEffect(archetype)

  return {
    archetypeId: archetype.id,
    tariff,
    timing,
    waste,
    annualTariffSavingGbp: (tariff.dailySavingPence * DAYS_PER_WEEK * WEEKS_PER_YEAR) / 100,
    annualTimingSavingGbp: (timing.dailySavingPence * DAYS_PER_WEEK * WEEKS_PER_YEAR) / 100,
  }
}

/**
 * OA-122 (follow-up): "sensitivity to compliance -- e.g. 30%/70%/automated
 * shifting" and "sensitivity to waste reduction". A household rarely
 * achieves the fully-optimised timing saving or fully eliminates its
 * identified standby waste -- `timingEffect`/`wasteEffect` above compute
 * the *ceiling* for each; this named set of realistic achievement
 * fractions is a modelled assumption (not a measured adherence rate), kept
 * explicit and named rather than silently assumed at 100%.
 */
export const COMPLIANCE_LEVELS: readonly { id: string; label: string; fraction: number }[] = [
  { id: 'manual-30', label: 'Manual, low adherence (30%)', fraction: 0.3 },
  { id: 'manual-70', label: 'Manual, engaged household (70%)', fraction: 0.7 },
  { id: 'automated-100', label: 'Automated shifting (100%)', fraction: 1.0 },
] as const

export const WASTE_REDUCTION_LEVELS: readonly { id: string; label: string; fraction: number }[] = [
  { id: 'waste-reduction-30', label: 'Low effort (30% of identified waste removed)', fraction: 0.3 },
  { id: 'waste-reduction-70', label: 'Engaged household (70% removed)', fraction: 0.7 },
  { id: 'waste-reduction-100', label: 'Full elimination (100% removed)', fraction: 1.0 },
] as const

export interface HouseholdOpportunityAtComplianceResult extends HouseholdOpportunityResult {
  complianceId: string
  complianceFraction: number
  wasteReductionId: string
  wasteReductionFraction: number
  /** Timing saving actually realised at this compliance fraction -- linear in the fraction of the fully-optimised saving achieved, a modelled simplification, not a claim that savings scale exactly linearly with effort in reality. */
  annualTimingSavingAtComplianceGbp: number
  /** Waste saving actually realised at this reduction fraction, using the archetype's central standby-cost estimate. */
  annualWasteSavingAtReductionGbp: number
  /**
   * OA-123: tariff, timing and waste are independently calculated from
   * disjoint inputs (tariff effect holds usage fixed; timing effect only
   * moves already-identified flexible events within the same tariff;
   * waste effect is a standalone standby-cost figure never derived from
   * the usage profile) -- so, unlike a sum of overlapping/double-counted
   * claims, this total is valid to present as one combined figure. Still
   * exposed alongside every component above so a caller can show the
   * breakdown, never only the total.
   */
  combinedAnnualOpportunityGbp: number
}

/** The three-effect opportunity at a named compliance/waste-reduction level, plus a validated non-overlapping combined total -- OA-122's compliance/waste sensitivity sweep and OA-123's canonical claim should call this, not `simulateHouseholdOpportunity` directly, once a compliance assumption is in play. */
export function simulateHouseholdOpportunityAtCompliance(
  archetype: HouseholdArchetype,
  fromTariff: TariffPriceCurve,
  toTariff: TariffPriceCurve,
  compliance: { id: string; fraction: number },
  wasteReduction: { id: string; fraction: number },
): HouseholdOpportunityAtComplianceResult {
  const base = simulateHouseholdOpportunity(archetype, fromTariff, toTariff)
  const annualTimingSavingAtComplianceGbp = base.annualTimingSavingGbp * compliance.fraction
  const annualWasteSavingAtReductionGbp = base.waste.annualSavingGbp.central * wasteReduction.fraction

  return {
    ...base,
    complianceId: compliance.id,
    complianceFraction: compliance.fraction,
    wasteReductionId: wasteReduction.id,
    wasteReductionFraction: wasteReduction.fraction,
    annualTimingSavingAtComplianceGbp,
    annualWasteSavingAtReductionGbp,
    combinedAnnualOpportunityGbp: base.annualTariffSavingGbp + annualTimingSavingAtComplianceGbp + annualWasteSavingAtReductionGbp,
  }
}
