/**
 * OA-120: versioned household archetypes and the appliance/event dataset
 * each draws on, built on top of OA-119's evidence pack. Distinct from
 * OA-99's single landing-page "Typical household" fixture -- this models
 * several household shapes so OA-121's simulator and OA-122's sensitivity
 * analysis can report how opportunity varies by household, not just
 * reproduce the one demo household.
 */

import { requireVerifiedOrPlausible } from './assumptions'

/** 48 half-hour clock slots per day, per OA-118's explicit rule. */
export const SLOTS_PER_DAY = 48

export interface ApplianceEvent {
  id: string
  label: string
  kwhPerSlot: number
  /** Contiguous half-hour slots this event occupies -- fixed; only its start slot can move. */
  slotCount: number
  /** This archetype's typical/actual start slot, before any optimisation. */
  actualStartSlot: number
  validStartSlotRange: { min: number; max: number }
  occurrencesPerWeek: number
  movable: boolean
  dependsOnEventId?: string
  /** Informed by CREST-class evidence per OA-119's crest-domestic-demand-model-methodology entry, but not a literal CREST-extracted figure -- see that assumption's notes. */
  evidenceBasis: 'crest-informed' | 'modelled-assumption'
}

export interface HouseholdArchetype {
  id: string
  label: string
  description: string
  annualKwh: number
  hasEv: boolean
  events: readonly ApplianceEvent[]
  /** OA-118: waste effect modelled separately from tariff/timing, never folded into either. */
  standbyAnnualCostGbp: { low: number; central: number; high: number }
}

// Anchors every archetype's annual total to the same verified Ofgem TDCV
// basis OA-99 already uses, rather than an arbitrary per-archetype figure.
const MEDIUM_TDCV_KWH = requireVerifiedOrPlausible('ofgem-tdcv-electricity-medium').value as number
const STANDBY_COST_RANGE = requireVerifiedOrPlausible('est-standby-annual-cost-range').value as {
  low: number
  central: number
  high: number
}

function scaledStandbyRange(multiplier: number): { low: number; central: number; high: number } {
  return {
    low: STANDBY_COST_RANGE.low * multiplier,
    central: STANDBY_COST_RANGE.central * multiplier,
    high: STANDBY_COST_RANGE.high * multiplier,
  }
}

// OA-118: "household opportunity changes by archetype" -- three
// representative non-EV shapes (small/typical/large) plus one EV-owning
// household, each reusing the OA-99-style event definitions where the
// archetype is a plausible superset/subset of the landing-page household,
// scaled to its own annual total.
export const HOUSEHOLD_ARCHETYPES: readonly HouseholdArchetype[] = [
  {
    id: 'single-occupant-flat',
    label: 'Single occupant, flat',
    description: 'One person, no car, fewer and smaller flexible loads than a family household.',
    annualKwh: 1800,
    hasEv: false,
    standbyAnnualCostGbp: scaledStandbyRange(0.6),
    events: [
      {
        id: 'washing_machine',
        label: 'Washing machine',
        kwhPerSlot: 0.3,
        slotCount: 2,
        actualStartSlot: 38, // 19:00 -- typical post-work evening wash
        validStartSlotRange: { min: 14, max: 44 },
        occurrencesPerWeek: 2,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'dishwasher',
        label: 'Dishwasher',
        kwhPerSlot: 0.4,
        slotCount: 2,
        actualStartSlot: 40, // 20:00
        validStartSlotRange: { min: 36, max: 46 },
        occurrencesPerWeek: 2,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
    ],
  },
  {
    id: 'family-typical',
    label: 'Family household (typical)',
    description: 'OA-99\'s Typical household shape, reused as this model\'s central archetype -- see src/domain/landingDemoFixture.ts for the identical event set backing the landing-page demo.',
    annualKwh: MEDIUM_TDCV_KWH,
    hasEv: false,
    standbyAnnualCostGbp: scaledStandbyRange(1),
    events: [
      {
        id: 'washing_machine',
        label: 'Washing machine',
        kwhPerSlot: 0.35,
        slotCount: 2,
        actualStartSlot: 14,
        validStartSlotRange: { min: 14, max: 36 },
        occurrencesPerWeek: 3,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'tumble_dryer',
        label: 'Tumble dryer',
        kwhPerSlot: 0.45,
        slotCount: 3,
        actualStartSlot: 16,
        validStartSlotRange: { min: 16, max: 44 },
        occurrencesPerWeek: 3,
        movable: true,
        dependsOnEventId: 'washing_machine',
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'dishwasher',
        label: 'Dishwasher',
        kwhPerSlot: 0.45,
        slotCount: 2,
        actualStartSlot: 36,
        validStartSlotRange: { min: 36, max: 46 },
        occurrencesPerWeek: 4,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'oven_cooking',
        label: 'Oven',
        kwhPerSlot: 0.45,
        slotCount: 2,
        actualStartSlot: 35,
        validStartSlotRange: { min: 35, max: 35 },
        occurrencesPerWeek: 7,
        movable: false,
        evidenceBasis: 'modelled-assumption',
      },
    ],
  },
  {
    id: 'family-large',
    label: 'Family household (large)',
    description: 'Larger family, more frequent flexible-load runs, same event types as the typical household.',
    annualKwh: 4200,
    hasEv: false,
    standbyAnnualCostGbp: scaledStandbyRange(1.4),
    events: [
      {
        id: 'washing_machine',
        label: 'Washing machine',
        kwhPerSlot: 0.35,
        slotCount: 2,
        actualStartSlot: 14,
        validStartSlotRange: { min: 14, max: 36 },
        occurrencesPerWeek: 6,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'tumble_dryer',
        label: 'Tumble dryer',
        kwhPerSlot: 0.45,
        slotCount: 3,
        actualStartSlot: 16,
        validStartSlotRange: { min: 16, max: 44 },
        occurrencesPerWeek: 6,
        movable: true,
        dependsOnEventId: 'washing_machine',
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'dishwasher',
        label: 'Dishwasher',
        kwhPerSlot: 0.45,
        slotCount: 2,
        actualStartSlot: 36,
        validStartSlotRange: { min: 36, max: 46 },
        occurrencesPerWeek: 7,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
    ],
  },
  {
    id: 'ev-owning-family',
    label: 'EV-owning family',
    description: 'Adds an overnight EV charge to the typical family\'s event set -- the archetype where timing opportunity is largest, per OA-118\'s "timing alone for a typical non-EV household may often be only tens of pounds per year" caveat.',
    annualKwh: MEDIUM_TDCV_KWH + 2000, // + a partial/moderate EV charging total, not a full-EV-mileage assumption
    hasEv: true,
    standbyAnnualCostGbp: scaledStandbyRange(1),
    events: [
      {
        id: 'ev_charging',
        label: 'EV charging',
        kwhPerSlot: 0.3,
        slotCount: 4,
        actualStartSlot: 2,
        validStartSlotRange: { min: 0, max: 10 },
        occurrencesPerWeek: 3,
        movable: true,
        evidenceBasis: 'modelled-assumption',
      },
      {
        id: 'washing_machine',
        label: 'Washing machine',
        kwhPerSlot: 0.35,
        slotCount: 2,
        actualStartSlot: 14,
        validStartSlotRange: { min: 14, max: 36 },
        occurrencesPerWeek: 3,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'dishwasher',
        label: 'Dishwasher',
        kwhPerSlot: 0.45,
        slotCount: 2,
        actualStartSlot: 36,
        validStartSlotRange: { min: 36, max: 46 },
        occurrencesPerWeek: 4,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
    ],
  },
  {
    // OA-120 (follow-up): a fifth, explicit archetype -- requested
    // separately from "large family" because its opportunity shape is
    // different in kind, not just in scale: one dominant, genuinely large
    // flexible load (an immersion-heater/electric-hot-water boost) rather
    // than more frequent small ones. High *overall* consumption, but the
    // timing opportunity is concentrated almost entirely in that one load,
    // which the "large family" archetype (more frequent small loads) does
    // not represent.
    id: 'high-use-non-ev',
    label: 'High-use household, non-EV (immersion/hot-water boost)',
    description: 'No EV, but one large, genuinely flexible electric hot-water/immersion-heater load dominates its timing opportunity, on top of a higher-than-typical overall consumption.',
    annualKwh: 5500,
    hasEv: false,
    standbyAnnualCostGbp: scaledStandbyRange(1.3),
    events: [
      {
        id: 'immersion_heater',
        label: 'Immersion heater / hot-water boost',
        kwhPerSlot: 1.2, // immersion heaters typically draw ~3kW -- 1.2kWh/slot approximates a part-cycle duty, not a full continuous 3kW draw across the whole event
        slotCount: 3, // 1.5 hours
        actualStartSlot: 36, // 18:00 -- evening hot-water top-up, a plausible unexamined habit
        validStartSlotRange: { min: 0, max: 44 }, // genuinely flexible: no occupancy/safety constraint comparable to a washing machine
        occurrencesPerWeek: 7,
        movable: true,
        evidenceBasis: 'modelled-assumption',
      },
      {
        id: 'washing_machine',
        label: 'Washing machine',
        kwhPerSlot: 0.35,
        slotCount: 2,
        actualStartSlot: 14,
        validStartSlotRange: { min: 14, max: 36 },
        occurrencesPerWeek: 4,
        movable: true,
        evidenceBasis: 'crest-informed',
      },
      {
        id: 'tumble_dryer',
        label: 'Tumble dryer',
        kwhPerSlot: 0.45,
        slotCount: 3,
        actualStartSlot: 16,
        validStartSlotRange: { min: 16, max: 44 },
        occurrencesPerWeek: 4,
        movable: true,
        dependsOnEventId: 'washing_machine',
        evidenceBasis: 'crest-informed',
      },
    ],
  },
] as const

export function getArchetype(id: string): HouseholdArchetype {
  const found = HOUSEHOLD_ARCHETYPES.find((a) => a.id === id)
  if (!found) throw new Error(`Unknown household archetype id: ${id}`)
  return found
}

/** OA-106-style guard, reused from landingDemoFixture's isRealHouseholdEvent convention: an event overlay must correspond to a real, non-zero modelled load. */
export function isRealApplianceEvent(event: ApplianceEvent): boolean {
  return event.id.trim().length > 0 && event.label.trim().length > 0 && event.slotCount > 0 && event.kwhPerSlot > 0
}
