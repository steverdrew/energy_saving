/**
 * OA-76: supplies the flexible-load events for Step 3 (Optimised) to
 * schedule -- see server/src/shiftingOptimiser.js and
 * docs/SHIFTING_METHODOLOGY.md.
 *
 * Detecting a real event needs evidence tier 2, 3 or 4: a household that
 * has told us it owns a given appliance (generic default), confirmed its
 * real duration/energy, or confirmed a specific cycle was flexible. None
 * of that exists yet -- there is no appliance/household declaration store
 * in this app; that's its own, later ticket in Steve's sequence
 * (appliances/household setup, scheduled straight after OA-76).
 *
 * Returning [] here is itself the correct, honest behaviour per the
 * methodology doc's product principle ("optimised must mean realistically
 * shiftable, not mathematically movable"): with no evidence-tier source
 * for any specific appliance, nothing is flexible, so Optimised degrades
 * cleanly to Like-for-like's own figures -- a genuine £0 timing
 * opportunity, never a guessed one. Swap this for a real lookup (keyed by
 * uid) once household appliance data exists; the optimiser's interface
 * doesn't need to change.
 */
export async function detectFlexibleLoadEvents(_uid) {
  return []
}
