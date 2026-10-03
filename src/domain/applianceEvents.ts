/**
 * OA-160: the single, shared appliance-event type and "typical household"
 * event list -- the one source of truth both the canonical savings model
 * (`src/domain/savingsModel/archetypes.ts`) and the landing-page demo
 * (`src/domain/landingDemoFixture.ts`) build on, so the two stop being
 * independently-authored copies of "the same household" (OA-154's audit
 * found they'd silently drifted apart). Neither of those two modules
 * imports from the other -- both import from here.
 */

export interface ApplianceEvent {
  id: string
  label: string
  /**
   * OA-128: "do not model appliance events as generic smooth Gaussian/
   * bell-shaped humps -- use appliance-appropriate shapes at half-hour
   * resolution." One kWh figure per half-hour slot this event occupies
   * (length always equals `slotCount`), e.g. a washing machine's heating
   * peak followed by lower-power wash/rinse/spin periods, rather than one
   * flat kWh repeated across the whole event. Moving the event (drag/
   * Optimise) carries this exact shape along with it -- only which slot(s)
   * it starts at changes, never the per-stage values themselves.
   */
  kwhShape: number[]
  /** How many contiguous half-hour slots this event occupies -- fixed (equal to `kwhShape.length`); moving it changes only which slot(s) it starts at. */
  slotCount: number
  /** This archetype's typical/actual start slot, before any optimisation. */
  actualStartSlot: number
  validStartSlotRange: { min: number; max: number }
  /** OA-104: deterministic, documented recurrence assumption -- not a published figure, not the visitor's own usage. */
  occurrencesPerWeek: number
  /** False for an identified-but-fixed load (e.g. the oven) -- shown as an annotation, but never draggable and never touched by "Optimise all". */
  movable: boolean
  /** "Tumble dryer cannot start before the washing machine finishes" -- this event's effective earliest start is the referenced event's *current* end slot, not just this event's own static `validStartSlotRange.min`. */
  dependsOnEventId?: string
  /** OA-165: set only when this event's limited window is a deliberate safety constraint, not just a missed optimisation -- shown to the visitor via an info icon beside the event, so a narrow window they might otherwise read as "the optimiser couldn't do better here" is explained as an intentional choice instead. */
  safetyConstraintNote?: string
  /** Informed by CREST-class evidence per OA-119's crest-domestic-demand-model-methodology entry, but not a literal CREST-extracted figure. Optional: the landing demo's own events don't carry this (OA-99 predates the evidence-pack convention); the canonical model's other archetypes always set it. */
  evidenceBasis?: 'crest-informed' | 'modelled-assumption'
}

/** This event's total kWh across its whole shape -- the one place that sums `kwhShape` rather than every caller doing it inline. */
export function totalEventKwh(event: ApplianceEvent): number {
  return event.kwhShape.reduce((sum, v) => sum + v, 0)
}

/** OA-106/OA-128: "an event overlay must never appear unless it corresponds to a real modelled load" -- a malformed or zero-energy event definition can never reach a chart/simulation as an empty/orphan entry. Every event's shape must actually have one value per slot it claims to occupy, and every one of those values must be real (positive) energy. */
export function isRealApplianceEvent(event: ApplianceEvent): boolean {
  return (
    event.id.trim().length > 0 &&
    event.label.trim().length > 0 &&
    event.slotCount > 0 &&
    event.kwhShape.length === event.slotCount &&
    event.kwhShape.every((kwh) => kwh > 0)
  )
}

// OA-107/OA-128/OA-160: "do not invent arbitrary appliances purely to fill
// the chart" -- a representative set of recognisable movable loads plus one
// identified-but-fixed load (the oven), each with its own realistic
// scheduling window (and, for the tumble dryer, a same-day dependency).
// "The default Typical household must not include EV charging" -- EV
// remains its own archetype in `src/domain/savingsModel/archetypes.ts`'s
// `ev-owning-family`, a deliberately separate model. Each event's per-slot
// shape is a modelled assumption (OA-73/76/OA-128), not a published figure
// -- an appliance-appropriate multi-stage profile (heating peak, lower-
// power wash/spin, sharp step up/down, etc.) rather than a flat kWh
// repeated across the event's slots.
//
// OA-160: this is now also canonical's `family-typical` archetype's event
// list (see `archetypes.ts`), not just the landing demo's -- the two no
// longer independently author "the typical household".
export const FAMILY_TYPICAL_APPLIANCE_EVENTS: readonly ApplianceEvent[] = [
  {
    id: 'washing_machine',
    label: 'Washing machine',
    // OA-128: heating the water draws the most, then a lower-power wash/
    // rinse period, then a smaller spin-dry uptick -- not one flat draw
    // for the whole cycle.
    kwhShape: [0.5, 0.15, 0.2],
    slotCount: 3, // 1.5 hours
    actualStartSlot: 14, // 07:00 -- a plausible morning wash
    // OA-165: previously daytime-only (07:00-19:00), which made it
    // impossible for "Optimise" to ever move this into an overnight
    // off-peak window (e.g. Economy 7's 01:30-08:30) -- widened to the
    // full day so a tariff-aware optimiser can actually consider every
    // genuinely available slot, not just the ones a pre-Economy-7 window
    // happened to include.
    validStartSlotRange: { min: 0, max: 35 }, // full day, last start that still ends by 19:00
    occurrencesPerWeek: 3,
    movable: true,
    evidenceBasis: 'crest-informed',
  },
  {
    id: 'tumble_dryer',
    label: 'Tumble dryer',
    // OA-128: "relatively sustained high draw with possible cycling" --
    // stays high throughout rather than one flat value, tapering slightly
    // as the load dries out.
    kwhShape: [0.5, 0.42, 0.3],
    slotCount: 3, // 1.5 hours
    actualStartSlot: 17, // 08:30 -- immediately after the washing machine's own (now 1.5-hour) actual cycle
    // "Cannot start before the washing machine finishes" -- the static min
    // here is only the fallback used if the dependency can't be resolved;
    // the real constraint is `dependsOnEventId`, resolved dynamically
    // against the washing machine's *current* position.
    //
    // OA-165: unlike the washing machine and dishwasher, this static
    // min is deliberately NOT widened to include the overnight off-peak
    // window -- fire-risk guidance generally advises against unattended
    // tumble drying (see `applianceProfile.ts`'s
    // `requiresAwakeHome: true` for 'tumble_dryer'), so this floor also
    // doubles as that real-world constraint: even if the washing machine
    // moves earlier under a cheaper tariff, the dryer's own min (08:30)
    // stops it from ever being scheduled overnight.
    validStartSlotRange: { min: 17, max: 44 }, // outer window: same day, finished by 22:00
    occurrencesPerWeek: 3,
    movable: true,
    dependsOnEventId: 'washing_machine',
    // OA-165: distinguishes this from a missed optimisation -- the window
    // is kept to daytime on purpose, not because a cheaper overnight slot
    // went unnoticed.
    safetyConstraintNote:
      "Kept in a daytime window for safety. We don't recommend running a tumble dryer unattended overnight. Follow the manufacturer's guidance for your appliance.",
    evidenceBasis: 'crest-informed',
  },
  {
    id: 'dishwasher',
    label: 'Dishwasher',
    // OA-128: multi-stage -- a heating phase, a lower-demand wash/rinse
    // period, then a second, shorter heating phase (final rinse/dry).
    kwhShape: [0.6, 0.2, 0.45],
    slotCount: 3, // 1.5 hours
    actualStartSlot: 36, // 18:00-19:30 -- the representative day's most expensive slots
    // OA-165: previously evening/overnight-only from 18:00 (18:00-24:00),
    // which excluded the small-hours end of an overnight off-peak window
    // (e.g. Economy 7's 01:30-08:30) entirely -- widened to the full day.
    // A dishwasher is fine to run unattended (`requiresAwakeHome: false`
    // in `applianceProfile.ts`), so there's no real-world reason to keep
    // it out of that window.
    validStartSlotRange: { min: 0, max: 45 }, // full day, last start that still ends by 24:00
    occurrencesPerWeek: 4,
    movable: true,
    evidenceBasis: 'crest-informed',
  },
  {
    id: 'dehumidifier',
    label: 'Dehumidifier',
    // OA-128: "sustained moderate load, flatter block/cycling profile" --
    // close to flat, with only a small cycling dip, not a sharp shape.
    kwhShape: [0.15, 0.17, 0.13],
    slotCount: 3, // 1.5 hours
    actualStartSlot: 20, // 10:00
    validStartSlotRange: { min: 0, max: 44 }, // broad, flexible window: anywhere that finishes by 22:00
    occurrencesPerWeek: 5,
    movable: true,
    evidenceBasis: 'modelled-assumption',
  },
  {
    id: 'oven_cooking',
    label: 'Oven',
    // OA-128: "sharp step-up, cycling/sustained heating, sharp reduction
    // at end" -- preheat/initial heat draws more than the lower-power
    // thermostat-cycling second half.
    kwhShape: [0.55, 0.35],
    slotCount: 2, // 1 hour
    actualStartSlot: 35, // 17:30 -- identified but fixed: never draggable, never touched by "Optimise all"
    validStartSlotRange: { min: 35, max: 35 },
    occurrencesPerWeek: 7,
    movable: false,
    evidenceBasis: 'modelled-assumption',
  },
]
