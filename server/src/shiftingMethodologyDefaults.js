/**
 * OA-75: centralised, explicitly tunable defaults for the Step 3 (OA-76)
 * shifting methodology -- never hard-coded inline at each call site, and
 * never treated as permanent product truths. Every optimisation result
 * carries `METHODOLOGY_VERSION` (see server/src/shiftingOptimiser.js) so a
 * future change to any default here is distinguishable from a result
 * produced under today's values, per OA-75's "result provenance records
 * the version used" requirement -- bump this string whenever a default
 * below changes in a way that could change a result.
 */
export const METHODOLOGY_VERSION = 'oa73-v1'

export const METHODOLOGY_DEFAULTS = {
  version: METHODOLOGY_VERSION,
  // "Every half-hour of consumption" -- the data's own grid.
  slotMinutes: 30,
  // "Default assumption is 07:00-23:00 local time" for a load with
  // requiresAwakeHome -- overridable per-event via an explicit valid
  // window (see FlexibleLoadEvent.validWindowStartsAt/EndsAt).
  awakeHomeStartHour: 7,
  awakeHomeEndHour: 23,
  // "A move only happens when it produces a genuine saving" -- v1's bar
  // is any strictly positive saving (no minimum). A future version could
  // raise this to ignore moves below a materiality threshold without
  // changing the engine, only this default.
  minSavingPence: 0,
}
