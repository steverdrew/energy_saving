# Shifting methodology (OA-73)

**Status: v1, implemented (OA-76).** Per OA-75, this document is a
versioned working model, not a one-time sign-off gate — it's expected to
change as real appliance/household data arrives, and any change should be
recorded as a new dated entry under "Version history" below rather than a
single "signed off" line. The model, constraints, confidence states and
fixtures below are now built in code: `server/src/shiftingOptimiser.js`
(the scheduling engine), `server/src/flexibleLoadEvents.js` (the event
source — currently always `[]`, honestly, since no appliance/household
data exists yet), and `GET /api/octopus/optimised-period` /
`src/pages/OptimisedPage.tsx` (the route and page). The fixtures below are
this implementation's test fixtures verbatim
(`server/test/shiftingOptimiser.test.js`).

## Version history

- **v1 (OA-76)**: first implementation — atomic wet appliances (dishwasher,
  washing machine, tumble dryer) and the splittable dehumidifier only, per
  "EV/battery/smart-heating treatment" below. Event source always returns
  `[]` until the appliance/household setup ticket exists, so Optimised
  today always equals Like-for-like (£0 timing opportunity) in production
  — honest per the product principle, not a placeholder to be embarrassed
  about.

## Where this sits

The journey is now:

1. **Actual** (OA-71) — what happened.
2. **Like-for-like** (OA-72) — the same consumption, repriced on a
   different tariff ("I'm on X — what would this have cost on Y?").
3. **Optimised** (this document; implemented in OA-76) — the same
   household energy requirement, but with genuinely flexible consumption
   shifted into cheaper periods.

The product principle governing all of what follows:

> **Optimised must mean realistically shiftable, not mathematically
> movable.**

Naively moving every kWh to the cheapest half-hour in a 30-day window
produces a theoretical maximum, not a usable consumer estimate. This
document exists to stop that happening.

## Core problem: what are we allowed to move?

Household consumption is not one undifferentiated pool of kWh. For the
purposes of Optimised, every half-hour of consumption falls into
exactly one of two buckets:

- **Fixed/base load** — lighting, fridge/freezer, standby draw,
  cooking tied to when a person wants to eat, anything continuous or
  tied to the moment a person needs it. **Never moved.**
- **Flexible load** — a specific, identifiable appliance cycle or
  deferrable device load that could plausibly have run at a different
  time without changing what the household actually needed. **Only
  this bucket is ever eligible to move.**

A half-hour's consumption is never split into "some generic fraction is
flexible" without a specific identified source for that fraction (see
"Evidence hierarchy" below). If we can't point to *what* is flexible,
none of that half-hour is treated as flexible.

## Flexible load categories

| Category | Plausibly flexible? | Shape | Notes |
|---|---|---|---|
| Dishwasher | Yes | Atomic, contiguous cycle | Must run as one unbroken block once started |
| Washing machine | Yes | Atomic, contiguous cycle | `requiresAwakeHome` safety constraint (see `applianceProfile.ts`) |
| Tumble dryer | Yes | Atomic, contiguous cycle | `requiresAwakeHome` safety constraint |
| Dehumidifier | Yes | Interruptible, splittable | Can run in several shorter blocks |
| EV charging | Yes (when present) | Continuous, splittable, rate-limited | Bounded by charger power and "must be charged by" time |
| Battery storage (charge) | Yes (when present) | Continuous, splittable, rate-limited | Charges from the grid at cheap times; no comfort constraint |
| Smart heating / hot water (thermal storage) | Yes (when present) | Continuous, splittable, bounded by thermal loss | Pre-heating only moves consumption a few hours, not freely across the day |
| Lighting, fridge/freezer, standby, cooking, general base load | No | — | Fixed load, never moved |

This list is deliberately short. A category not on it is fixed load
until a future ticket explicitly adds it with its own shape and
constraints — never silently treated as flexible by default.

Two shapes recur throughout this document:

- **Atomic**: must run as one contiguous block once it starts (a
  dishwasher cycle can't be paused and resumed at a different time of
  day without changing what actually happened).
- **Continuous/splittable**: can be spread across multiple, even
  non-contiguous, half-hours within its valid window (EV/battery
  charging, dehumidifying) — the constraint is on total duration/energy
  and the window, not on being unbroken.

## Evidence hierarchy

Per the ticket, in order of trust:

1. **Connected device/model data** — a real reading or schedule from an
   integrated device (not built yet — OA-12/OA-15).
2. **User-supplied appliance/runtime/energy information** — the user
   told us this appliance's real duration/energy (maps to
   `applianceProfile.ts`'s `user_confirmed` source, extended to also
   cover user-supplied runtime/energy fields, not just a yes/no
   confirmation).
3. **Explicit user-confirmed flexible load** — the user confirmed *that
   a specific cycle on a specific day* was genuinely flexible (e.g.
   answering "could this have run at a different time?" per-event),
   as distinct from #2's general appliance profile confirmation.
4. **Generic appliance assumptions, clearly labelled** — the existing
   `DEFAULT_APPLIANCE_PROFILES` (`generic_default`/`manufacturer_profile`
   sources in `applianceProfile.ts`): a plausible UK-average duration
   and energy for an appliance type, used only when the household has
   told us they have that appliance type.
5. **Inferred whole-house load** — recognising a flexible-shaped
   pattern directly from half-hourly consumption data with no appliance
   declaration at all. **Not used for the first implementation.** The
   confidence bar for inferring "this unlabelled 1.1kWh bump was a
   dishwasher" from shape alone is high and unvalidated; this tier is
   named here so the hierarchy is complete, not because it's ready to
   build.

Every Optimised figure must carry the confidence tier(s) actually used
to produce it, the same way `comparisonMethod` does for tariff
reconstruction (`exact` / `bounded_estimate` / `unavailable`). A figure
built entirely from tier 4 is a materially different (weaker) claim
than one built from tier 2, and the UI must say so — this document
doesn't prescribe the exact copy, but no implementation should collapse
the tiers into a single unlabelled number.

**Ambiguous usage is never silently treated as shiftable.** If no tier
above applies to a given appliance/period, it stays in fixed load.

## Runtime constraints

For an **atomic** load (dishwasher, washing machine, tumble dryer):

- Total duration is fixed at the source value (user-supplied or
  generic default) — moving it never changes how long it runs.
- It must be scheduled as one unbroken contiguous block of that exact
  length, snapped to the data's half-hour grid.
- `interruptible: false` in `applianceProfile.ts` already encodes this;
  this document treats `interruptible` as authoritative for whether a
  load may be split.

For a **continuous/splittable** load (dehumidifier, EV, battery, smart
heating):

- Total energy for the period is fixed (the same kWh the household
  actually used); only its distribution across half-hours within the
  valid window may change.
- A maximum power/rate constraint still applies (e.g. an EV charger's
  rated kW caps how much energy can land in any one half-hour) — never
  move more energy into a single slot than the load could physically
  draw in 30 minutes.

## Valid time windows

Every flexible load needs an explicit valid window, not "anywhere in
the 30-day history":

- Default window is **the same calendar day** the load actually ran —
  Optimised answers "could this have run at a cheaper time *that same
  day*", not "could laundry from a Tuesday have been moved to the
  following Sunday". Moving across days is a materially bigger claim
  and is out of scope for the first implementation.
- A load with `safety.requiresAwakeHome: true` (washing machine, tumble
  dryer) may only move within hours the household is plausibly awake.
  Lacking any household-specific schedule, the default assumption is
  **07:00–23:00 local time** — conservative, clearly labelled as a
  default, and overridable once household schedule data exists.
- A load with no such safety constraint (dishwasher, dehumidifier) may
  move to any half-hour that calendar day.
- EV charging's window is bounded by a "must be ready by" time if the
  user has supplied one (tier 2/3 evidence); absent that, no EV move is
  modelled at all rather than guessing a departure time (tier 4/5
  guessing a personal schedule is not acceptable — this is exactly the
  kind of silent assumption the product principle rules out).

## Maximum moves per day

**At most one modelled move per identified flexible-load event.** We
reconstruct that the dishwasher ran once on Tuesday and model moving
*that one cycle*, never a hypothetical "it could have run twice" or
"split across three shorter cycles instead of one" — those change what
the household actually did, not just when. The event count comes from
the actual consumption data (a recognised cycle-shaped bump), never
invented to maximise the shown saving.

## Appliance/user convenience constraints

- `safety.notes` and `requiresAwakeHome` from `applianceProfile.ts`
  apply as above.
- Nothing in this model schedules a load earlier than it actually
  needs to run just because an earlier slot happens to be cheaper
  within the window — "same day" already prevents forcing it hours
  away from when the household wanted it done, but within that window
  we still don't manufacture a *reason* to move it beyond "this was
  cheaper"; there is no separate convenience-optimisation layer beyond
  the constraints already listed.

## EV/battery/smart-heating treatment

Deferred until a connected device or explicit user-supplied capacity
exists (tier 1 or 2 evidence) — never modelled from generic defaults
(tier 4), because unlike a dishwasher's duration, a charger's power
rating and a battery's capacity vary too widely to default safely, and
a wrong default here could materially overstate the saving. Named in
the categories table above so the model is forward-compatible, but the
first implementation should model only the atomic wet appliances and
the dehumidifier, where generic defaults are defensible.

## Overlap / concurrency constraints

Two or more flexible loads can legitimately want the same cheap
half-hour (e.g. dishwasher and washing machine both cheapest at 2am).
Rather than inventing a circuit-capacity model, the constraint is a
plausibility cap: **the modelled load in any single half-hour, across
all moved appliances combined, never exceeds the household's own
highest actually-observed half-hourly kWh elsewhere in the imported
window.** If satisfying every load's preferred cheap slot would exceed
that cap, loads are moved in evidence-tier order (higher tier first),
and a lower-tier load that can't fit moves to its next-best slot
instead, or doesn't move at all if none fits — never silently
overlapping.

## Preventing double counting

- Each identified flexible-load event is tagged with the appliance
  category and the exact consumption points it covers, and consumed
  the moment it's modelled as moved — no other category's logic may
  also claim those same half-hourly consumption points.
- A move changes a half-hour's *tariff rate applied* and *which day's
  row it displays in on the heat map*; it never changes the total kWh
  recorded for that appliance event. The sum of all flexible-load kWh
  before and after moving must be identical — this is the energy
  preservation check below, and it's also the double-counting check:
  if the totals don't match, kWh has been duplicated or dropped
  somewhere and the result must not be shown.

## Preserving total energy while moving timing

For every modelled move:

```
Σ kWh(appliance event, before) == Σ kWh(appliance event, after)
```

Moving only ever changes *which half-hour(s)* an appliance event's kWh
is attributed to and *which tariff rate* applies there — never the kWh
amount itself, and never the household's total 30-day consumption.
This is the same "never move consumption" rule OA-72 already applies to
Like-for-like, extended from "never move it in time at all" to "only
move the specific, identified flexible portion, by exactly its own
amount, nowhere else."

## No-cheaper-slot handling

If, within a load's valid window, no half-hour (or contiguous block,
for atomic loads) is cheaper than the slot(s) the load actually ran in
— including the case where the tariff is flat across that window — the
load **does not move**. It is reported at its actual cost, same as
Actual and Like-for-like. A day with zero realised moves is a valid,
honest Optimised result, not an error or an empty state to hide. The
model never searches for a marginally cheaper slot and moves a load
"for form's sake" when the saving would be negligible or zero — a
move only happens when it produces a genuine saving, which also means
"no-cheaper-slot" naturally covers "the saving would round to zero".

## Output and attribution

For the imported window:

```
Actual cost:                 £X   (OA-71)
Same usage on <tariff>:      £Y   (OA-72)
<Tariff> + realistic shifting: £Z (this ticket's eventual implementation)
```

split as:

```
tariff-choice opportunity = X − Y   (switching tariff, same behaviour)
timing opportunity        = Y − Z   (same tariff, shifting flexible load)
```

Both opportunities are always shown together, never one implying the
other — a household could have a large tariff-choice opportunity and
zero timing opportunity (nothing flexible identified) or vice versa.

## Heat map behaviour (Step 3)

The Optimised heat map reuses OA-70's shared component unchanged — it
is handed a third `HeatMapDay[]` series, same shape as Actual and
Like-for-like. The only new requirement is at the data layer, not the
component: a moved flexible-load event's kWh disappears from its
origin half-hour(s) and reappears at its destination half-hour(s) in
that series — so the *bar heights* visibly redistribute within a day
(energy moving from an expensive-coloured cell to a cheap-coloured
one), while the day's total bar-height area is conserved. This is the
same "usage silhouette" principle OA-72 already established for
Like-for-like (there, the silhouette is identical because nothing
moves; here, it's allowed to change exactly where flexible load moved,
and nowhere else).

## Deterministic test fixtures

These are implemented verbatim as `server/test/shiftingOptimiser.test.js`'s
fixture tests (fixture 3 is tested qualitatively there — tier ordering and
the concurrency cap — since this doc doesn't give a full rate series to
check exact pence against).

### Fixture 1: a dishwasher cycle moves to a cheaper window, same day

- Household's only flexible event that day: dishwasher, generic
  default profile (tier 4), 150 minutes / 1.1 kWh, actually ran
  18:00–20:30, rates that day: 18:00–20:30 averages 28p/kWh.
- Valid window: 07:00–23:00 that day (no `requiresAwakeHome`
  constraint for dishwasher — see `applianceProfile.ts`).
- Cheapest 150-minute contiguous window in 07:00–23:00: 13:00–15:30,
  averaging 9p/kWh.
- Before: cost = 1.1 kWh × 28p = 30.8p, at 18:00–20:30.
- After: cost = 1.1 kWh × 9p = 9.9p, at 13:00–15:30.
- Timing opportunity for this event: 30.8p − 9.9p = **20.9p**.
- Energy check: 1.1 kWh before == 1.1 kWh after. ✓.

### Fixture 2: no cheaper slot exists (flat tariff that day)

- Same dishwasher event, actually ran 18:00–20:30, but the tariff is
  flat (e.g. a fixed-rate tariff, or an Agile day with identical
  rates) across the whole 07:00–23:00 window.
- No contiguous 150-minute window is cheaper than the actual slot.
- Result: **does not move.** Reported cost stays 30.8p at its actual
  time. Timing opportunity for this event: **0p**, not hidden, not an
  error.

### Fixture 3: two loads compete for the same cheap window

- Dishwasher (tier 4, 150 min / 1.1 kWh) and washing machine (tier 2,
  user-supplied: 100 min / 0.95 kWh, `requiresAwakeHome: true`) both
  actually ran that day; both find the same 13:00–15:30-ish window
  cheapest.
- Washing machine is higher evidence tier (2 vs 4), so it gets first
  claim on its preferred window (13:00–14:40, within the
  07:00–23:00 awake-home bound).
- Dishwasher's identical first choice (13:00–15:30) would overlap the
  household's highest-ever observed half-hourly kWh cap once both are
  placed together (per the concurrency rule) — it is moved to its
  *next-best* non-overlapping contiguous 150-minute window instead
  (say 15:00–17:30), still cheaper than its original 18:00–20:30 slot,
  so it still moves, just not to its global optimum.
- Both events individually still pass the energy-preservation check.

### Fixture 4: an EV event with no supplied charger capacity

- Household has an EV-shaped consumption bump, but no connected
  charger and no user-supplied charger power/deadline exists.
- Per "EV/battery/smart-heating treatment" above: **not modelled**.
  The bump stays in fixed load. (If the household later supplies a
  charger rating and a "ready by" time — tier 2 evidence — this
  fixture should be revisited as a positive EV-shifting case.)

## Next step

Implemented in OA-76. What's left, in the build order Steve set:

1. Appliance/household setup — the ticket that lets a household declare
   the appliances they own (tier 4 evidence) and, later, confirm real
   runtime/energy (tier 2) or a specific cycle's flexibility (tier 3).
   Until it exists, `detectFlexibleLoadEvents` stays `[]` and Optimised
   stays honestly at £0 timing opportunity.
2. OA-65 (Today/Tomorrow schedule + heat map) — after appliance/household
   setup, per the current roadmap.
3. EV/battery/smart-heating remain deferred until tier 1 or 2 evidence
   exists for them, per "EV/battery/smart-heating treatment" above — not
   blocked on anything else in this doc.
