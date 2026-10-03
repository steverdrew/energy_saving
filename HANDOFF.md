# HANDOFF

_Last updated: 2026-10-03 13:40 BST_

_Note: detailed history before 2026-10-03 lives in `git log` and the Jira
tickets themselves (project `OA`, `altitudeconsulting.atlassian.net`), not
here — keep this file under one page._

## Most recent session: OA-135, OA-136, OA-137 (built, verified, not committed)

Picks up directly on top of the OA-132/133 session below (same tariff
model), in the same working tree. All three tickets form one connected
trilogy -- "establish the current tariff, compare it against
alternatives, only claim a timing saving when one genuinely exists" --
and were built together since each one's acceptance criteria depends on
the state the previous one introduces.

- **OA-135 (Baseline gets a current-tariff selector)**: Baseline now owns
  the Flexible/Fixed/Smart (+ secondary Smart product row) selector that
  OA-132 had put on Compare -- "the tariff I am on now." New `currentTariffId`
  state in `LandingDemo.tsx` (default `'standard-variable'`); Baseline's
  result line changed from "£1.80 energy cost" to "£1.80 energy cost on
  Flexible", naming the selected tariff per the ticket's own example.
  `landingDemoFixture.ts`'s `buildLandingDemoFixture` gained a third
  parameter, `currentTariffId` (defaults to `'standard-variable'`, so every
  existing caller/test keeps its prior behaviour) -- Baseline is now costed
  against it instead of always `STANDARD_VARIABLE_RATE_PENCE` literally.
- **OA-136 (Compare reframed around current vs. alternatives)**: Compare's
  question changed from OA-132's abstract "Which type of tariff fits this
  household?" to "How would this same day cost on other tariffs?". New
  `chosenTariffId` state, separate from `currentTariffId` -- "current/base
  tariff" and "chosen tariff" are two explicit states that may be the same
  (the common case) but diverge once a visitor picks an alternative to
  carry into Optimise. Compare's `result` line now reads "Current tariff:
  Flexible · £1.80"; `controls` replaced the old plain type selector with
  a clickable `tariffComparison` list (new fixture field: every tariff's
  cost against the exact same baseline usage, with a signed
  `differencePenceVsCurrentTariffPence`), each row showing cost and
  directional difference, current tariff marked "Current ·". The old
  Flexible/Fixed/Smart category shortcut stayed too, underneath the list,
  as a quicker way to reach the same selection. Switching the *current*
  tariff on Baseline resets `chosenTariffId` back to match it (a fresh
  current-tariff choice shouldn't leave a stale previously-chosen
  alternative in place).
- **OA-137 (Optimise conditional on a genuine opportunity)**: new
  `MEANINGFUL_ANNUAL_TIMING_SAVING_THRESHOLD_PENCE = 1000` (£10/year,
  documented in `landingDemoFixture.ts` as the one deterministic threshold
  everything gates on) and `hasMeaningfulTimingSavingOpportunity()`. The
  fixture now exposes `hasTimingSavingOpportunity` (whether the *currently
  displayed* schedule's saving clears the threshold). `LandingDemo.tsx`
  separately computes `tariffHasTimingSavingOpportunity` (memoised on
  `chosenTariffId` alone, via a fresh auto-optimised trial) -- deliberately
  *not* the same flag, since the live schedule's own saving legitimately
  drops to zero right after Reset or mid-manual-drag, and Optimise's
  headline/controls must not flip into the "no opportunity" state just
  because of that. `computeEffectiveOptimisedStartSlots()` wraps the
  existing auto-optimise search and discards the result (falls back to
  the original, unmoved schedule) whenever it wouldn't clear the
  threshold -- this is what makes flat Flexible/Fixed tariffs correctly
  show "no opportunity" by default rather than the optimiser's own
  tie-breaking sliding every event to the start of its window for zero
  real saving. No-opportunity state: neutral copy ("There's little to save
  by changing when you use electricity on this tariff"), no Reset/Optimise
  controls, no draggable sliders, no per-event saving popovers -- events
  render as fixed annotations, same as Baseline/Compare.
- Since the default tariff is now Standard Variable (flat), **Optimise's
  default state changed**: arriving at Optimise with no tariff chosen now
  shows the no-opportunity message, not an auto-optimised Agile schedule.
  Rewrote `LandingDemo.test.tsx` accordingly -- added a
  `switchToSmartAgile()` helper most Optimise-path tests now call first,
  plus new describe blocks for the Baseline selector (OA-135), the Compare
  comparison list (OA-136), and both Optimise states (OA-137).
- **Verified**: `npx tsc -b` (clean), `npm run lint` (clean, same
  pre-existing unrelated warnings), `npm run build` (clean), `npm test`
  (244/244). **Not verified live in the browser** -- the other concurrent
  session held port 5173 throughout this session too (`preview_start`
  errored on the port conflict), same as every OA-127-133 session before
  it.

### Decisions made this session

- `tariffHasTimingSavingOpportunity` is deliberately computed independently
  of the live `optimiseEventStartSlots` state, not read off
  `fixture.hasTimingSavingOpportunity` directly -- the first attempt did
  exactly that and broke Reset (resetting to the original schedule zeroes
  the live saving, which isn't the same fact as "this tariff has no
  genuine opportunity" and shouldn't flip Optimise's headline/controls
  off).
- Default `currentTariffId`/`chosenTariffId` is `'standard-variable'`, not
  `'agile'` (the old default before OA-135/136) -- Standard Variable is the
  most common real starting point for a household that hasn't actively
  chosen a time-of-use tariff, and it's also what makes OA-137's
  no-opportunity state visible by default rather than only reachable by
  explicitly picking a flat tariff.

### Possible follow-up (not actioned, flagged only)

- **OA-139** (new ticket, created mid-session, not started): keep the
  tumble dryer's optimisation window daytime-only (never overnight/
  unattended), with a keyboard/touch-accessible info icon explaining the
  constraint when a cheaper overnight slot exists but isn't used. Builds
  directly on this session's OA-137 threshold/no-manufactured-saving
  logic and OA-107's existing per-event `validStartSlotRange`/
  `dependsOnEventId` model -- the tumble dryer already has a same-day
  dependency on the washing machine; this adds a second, independent
  constraint (daytime-only) on top, plus a new UI affordance (the icon)
  neither OA-107 nor this session built.
- Confirm this session's work live in the browser once the other
  session's dev server is no longer holding port 5173.

## Most recent session: OA-132, OA-133 (built, verified, not committed)

Separate concurrent session, same working tree as the OA-127/128/129 entry
below (that session appears to still be active -- its dev server held port
5173 throughout this one too). Steve updated these tickets' Jira
descriptions mid-session to tighten the product flow ("Understand -> Choose
-> Optimise"); this work targets the *updated* descriptions, not the
originals.

- **OA-132 (Reframe Compare around Flexible/Fixed/Smart)**: the Compare
  stage's primary tariff selector is no longer the three named products
  (Standard Variable/Economy 7/Agile) -- it's now **Flexible | Fixed |
  Smart**, with named products demoted to a secondary row shown only once
  Smart is active ("Smart · Agile"/"Smart · Economy 7"), never peers of
  Flexible/Fixed. New in `landingDemoFixture.ts`: `TariffId` gained a
  fourth value, `'fixed'` (own sourced rate -- see OA-133 below for why
  this needed real research, not an invented number); `TariffCategory =
  'flexible' | 'fixed' | 'smart'`; `TARIFF_CATEGORY: Record<TariffId,
  TariffCategory>`; `SMART_TARIFF_IDS` (derived by filtering `TARIFF_IDS`
  by category, not hand-listed). `LandingDemo.tsx`: Compare's question
  heading changed from product-specific ("What would that day cost on
  Agile?") to neutral ("Which type of tariff fits this household?" /
  "Same usage. Same timings. Compare the options.") -- `stageNarrative()`
  no longer takes a tariff-label param at all, since no stage's *question*
  names a product any more. New `tariffContextLabel()` helper (used both
  for Compare's result line and Optimise's new quiet context, see below)
  resolves a `TariffId` to "Flexible"/"Fixed"/"Smart · <product>". New
  `selectTariffCategory()` handles the primary selector: Flexible/Fixed
  each resolve to exactly one tariff; clicking Smart while not already on
  a smart tariff resolves to `DEFAULT_SMART_TARIFF_ID` ('agile' -- a
  documented placeholder for "the model decides", since there's no real
  eligibility/usage-based resolution model yet, flagged as a gap below).
  Optimise never shows this selector (`controls` only renders Reset/
  Optimise there, same as before) -- the selected tariff now additionally
  shows as small quiet text (`.landing-time-profile__tariff-context`)
  near those buttons, satisfying "selected tariff is only quiet contextual
  information in Optimise" without adding a second clickable control.
- **OA-133 (correct Economy 7 off-peak window + binary visual)**:
  - **Off-peak window**: `isEconomy7OffPeakSlot` no longer takes a slot
    index and compares it against a hand-picked range (`{min: 3, max:
    16}`, which happened to already be numerically correct for this
    fixture's all-June dates, but was asserted as a fact about local time
    rather than derived) -- it now takes each slot's real `startsAt` ISO
    instant and checks its actual UTC clock time against the documented
    00:30-07:30 UTC window, the same pattern `isStructuralPeakSlot`
    already used for Agile's structural peak. `ECONOMY_7_OFF_PEAK_SLOT_RANGE`
    (still exported, same shape, for existing test/consumer compatibility)
    is now *derived* from that per-slot check via an IIFE, not asserted --
    structurally impossible to drift out of sync with the rates array
    built from the same check. Confirmed unchanged output (`{min: 3, max:
    16}`, 14 slots).
  - **Binary visual**: `LandingTimeProfile.tsx`'s price-strip segment
    colouring for `'two-rate'` no longer samples the continuous 9-step
    ramp via `rateColorStepIndex` (which happened to land on the two
    extreme steps here, since only two rates exist, but was conceptually
    "a position on a gradient") -- it now explicitly assigns step 0 (off-
    peak, the lower of the two rates) or step 8 (day rate), two fixed
    tones, independent of ramp normalisation. New `priceStripLegendText()`
    replaces the old "Off-peak (night) ← price → Day rate" wording (which
    read as a continuous scale) with explicit states: "Day rate · Off-peak
    `<real time range>`" -- the time range is resolved from the day's own
    rendered segments (`offPeakTimeRange`, a new memo in the component),
    never a hand-written clock window, so it can't drift from the actual
    data either. (Time shown unpadded -- "1:30–8:30", not "01:30–08:30" --
    matching `formatSlotTime`'s existing convention used everywhere else
    in this component, e.g. the "4–7pm peak period" label.)
  - New test coverage: `LandingTimeProfile.test.tsx`'s `describe('Economy
    7 binary visual (OA-133)')` (3 tests: explicit-states legend text, the
    full 7-hour/14-slot off-peak period, exactly two distinct tones not a
    gradient sample) and two new `LandingDemo.test.tsx` tests (no selector
    on Baseline; no selector but quiet context on Optimise) plus a
    rewritten "switches tariff in Compare" test and a new "switches to
    Flexible/Fixed" test for the two-level selector.
  - **Fixed tariff's rate — sourced, not invented** (Steve's explicit
    choice when asked): Octopus Energy's own public tariff API (same
    methodology as the existing Agile sourcing), product
    `OE-FIX-12M-26-10-02` ("Octopus 12M Fixed October 2026 v1"),
    electricity tariff `E-1R-OE-FIX-12M-26-10-02-C` (region C/London, same
    region Agile uses), `standard_unit_rate_inc_vat` = **27.0519p/kWh**,
    fetched 2026-10-03. Documented in a new `fixedTariffSource` field on
    `LANDING_DEMO_DATA_SOURCES`, same pattern as the existing
    `tariffSource`/`economy7Source` fields.
  - **Verified**: `npx tsc -b` (clean), `npm run lint` (clean, one new
    `erasing-op` warning introduced then fixed -- `0 * 60 + 30` simplified
    to `30`), `npm run build` (clean), `npm run check-bundle` (passed),
    `npm test` (238/238). **Not verified live in the browser** -- the
    other concurrent session held port 5173 throughout this session too
    (confirmed via `preview_start` erroring on the port conflict both at
    the start and the end of this session).

### Decisions made this session

- `DEFAULT_SMART_TARIFF_ID = 'agile'` is a placeholder for "the model
  determines the relevant smart tariff" (OA-132's own wording) -- there's
  no real eligibility/usage-based resolution logic in this codebase yet
  (no EV-ownership check, no Economy-7-metering check). Flagged as a gap,
  not actioned -- OA-132's "Eligibility" section and OA-127's "Economy 7
  remains scenario-only unless the product knows the user has/can use a
  suitable two-rate setup" are both still open for a dedicated ticket.
- Fixed tariff's own standing charge (41.39p/day for this Octopus product,
  per the same API response) was deliberately **not** wired in separately
  -- every tariff in this demo already shares one displayed standing-
  charge figure (`OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY`), and
  Economy 7's own standing charge was never split out either. Introducing
  a per-tariff standing charge would be new scope beyond what either
  ticket asked for.

### Possible follow-up (not actioned, flagged only)

- No real Smart-tariff eligibility model (EV-only tariffs, Economy 7
  metering/setup) -- both OA-127 and OA-132 call for this; `DEFAULT_SMART_TARIFF_ID`
  is a placeholder, not an implementation of it.
- Confirm this session's work live in the browser once the other
  session's dev server is no longer holding port 5173.

## Most recent session: OA-127, OA-128, OA-129 (built, verified, not committed)

Built on top of this file's existing "Current task"/"Previous task" entries
below (OA-108 through OA-126, already uncommitted) plus an already-
in-progress, uncommitted OA-131 price-strip refactor of
`LandingTimeProfile.tsx`/`.css` (the dedicated `.landing-time-profile__price-strip`/
`__price-segment` elements, `PriceStripShape` prop) that was present in the
working tree at the start of this session, not something this session
started -- this session only finished wiring it in from `LandingDemo.tsx`
(see OA-127 below), since it was left unwired (a missing required
`priceStripShape` prop, caught by `tsc -b`).

- **OA-127 (Economy 7 as a non-EV tariff comparison)**: `landingDemoFixture.ts`
  gained a `TariffId` (`'standard-variable' | 'economy-7' | 'agile'`),
  `TARIFF_LABELS`, and `buildLandingDemoFixture(optimiseEventStartSlots, tariffId)`'s
  new second parameter (defaults to `'agile'`, so every existing caller/test
  keeps its prior behaviour). Economy 7 is modelled as exactly two rates
  (`ECONOMY_7_DAY_RATE_PENCE`/`ECONOMY_7_NIGHT_RATE_PENCE`) over the
  Octopus smart-meter off-peak window (`ECONOMY_7_OFF_PEAK_SLOT_RANGE`,
  01:30-08:30 local/BST, i.e. 00:30-07:30 UTC) -- never a fake 48-rate
  Agile-style tariff. **The day/night rate split itself is flagged
  `economy7Source` as a plausible estimate, not a verified published
  figure** -- Ofgem/Octopus don't publish one precise, dated Economy 7
  day/night p/kWh pair the way they do for the price-cap average or Agile's
  API rates (confirmed by browser research this session: official pages
  404'd for this fixture's forward-dated 2026 period). `cheapestStartSlotForEvent`
  gained the same `tariffId` parameter (default `'agile'`), so Optimise's
  auto-schedule naturally prefers Economy 7's overnight window when that's
  the selected tariff. `LandingDemo.tsx` adds a Compare-stage tariff
  selector (`TARIFF_IDS` buttons, `aria-pressed`), carries the selection
  into Optimise (switching tariff re-optimises against the new tariff's
  rates), and maps each tariff to a `PriceStripShape` (`'flat'`/`'two-rate'`/`'dynamic'`)
  for the chart. Baseline always stays on Standard Variable regardless of
  the Compare/Optimise selection (the reference the tariff-switch saving is
  measured against). New tests in both files' test suites.
- **OA-128 (busy, appliance-driven household day)**: removed EV charging
  from `LANDING_DEMO_EVENTS` entirely (EV remains its own archetype in
  `src/domain/savingsModel/archetypes.ts`'s `ev-owning-family`, untouched,
  deliberately separate per OA-118). `HouseholdEventDefinition.kwhPerSlot`
  (one flat value) became `kwhShape: number[]` (one value per slot,
  `totalEventKwh()` sums it) -- washing machine/tumble dryer/dishwasher/
  dehumidifier/oven all now have multi-stage, appliance-appropriate shapes
  (heating peak + lower wash/rinse/spin, sustained-with-cycling, etc.)
  instead of a flat per-slot draw. Washing machine/dishwasher grew from 2
  to 3 slots (1.5h) to fit a 3-stage shape; validStartSlotRange/dependent
  tumble-dryer-timing updated to match. Total daily kWh still reconciles to
  the Ofgem TDCV automatically (`BASE_LOAD_KWH` absorbs whatever
  `TOTAL_EVENTS_KWH` leaves over, unchanged mechanism) -- freeing EV's 1.2
  kWh/day into base load shifted Compare/Optimise's exact £ figures
  (Agile cost is shape/position-sensitive; Standard Variable's flat-rate
  totals are not), so several previously-hardcoded test assertions were
  recomputed against the new fixture output, not just updated to make
  tests pass blindly. Did **not** touch `BASE_LOAD_SHAPE` itself (the
  Elexon-consistent diurnal curve) -- out of the time this session had;
  flagged as a possible follow-up below if sharper discrete morning/evening
  background activity (kettle/toaster bumps) is wanted beyond what the
  named appliance events now provide.
- **OA-129 (typography scale)**: added semantic tokens on `.landing-time-profile`
  in `LandingTimeProfile.css` (`--demo-stage-heading-size`,
  `--demo-supporting-size`, `--demo-primary-metric-size`,
  `--demo-secondary-metric-size`, `--chart-event-label-size`,
  `--chart-event-secondary-size`, `--chart-axis-label-size`,
  `--chart-footnote-size`), applied to the question/supporting/result/
  result-label/standing-charge/payoff/explanation/caveat/cost-note/
  structural-peak-label/axis-label/detail/event-popover/event-chip-name/
  event-chip-time classes (desktop sizes matching the ticket's suggested
  targets), with a `max-width: 640px` block scaling every token down
  together for mobile rather than inheriting desktop sizes. Grew
  `LandingTimeProfile.tsx`'s `EVENT_CHIP_HEIGHT_PX`/`_GAP_PX`/`_TOP_OFFSET_PX`
  (19/4/16 -> 28/6/20) and the chip's own padding/handle size to fit the
  larger event-label/time text without crowding (the track's own height
  already scales with `--event-lanes`, so this doesn't shrink the chart).
- **Verified**: `npm test` (227/227), `npx tsc -b` (clean), `npm run lint`
  (clean, same pre-existing unrelated warnings), `npm run build` (clean),
  `npm run check-bundle` (passed). **Not verified live in the browser** --
  another session already held the dev server's port (5173) for this same
  working tree throughout this session, so `preview_start` could not be
  used; only the automated checks above confirm this work.
- **Addendum (separate concurrent session, same working tree)**: found
  OA-131's acceptance criteria for the `'flat'`/`'two-rate'` price-strip
  shapes, its legend text, and the strip's own accessible-on-tap rate
  label untested (only the `'dynamic'`/Agile shape and the structural-peak
  annotation had coverage). Added 5 tests to
  `LandingTimeProfile.test.tsx`'s new `describe('price strip (OA-131)')`
  block: flat renders exactly 1 segment, Economy 7 renders its real
  day-night-day run count (not 48) with exactly 2 distinct colours, Agile
  still renders 48, the legend text is shown, and a segment is a real
  `<button>` with its rate in `aria-label` (not a hover-only `title`).
  `npm test` now 232/232, `npx tsc -b`/`npm run lint`/`npm run build` all
  still clean. Could not verify live (same port-5173 conflict as above).

### Decisions made this session

- Economy 7 day/night rates (29.5p/14.5p) are a judgement call, explicitly
  flagged in the fixture's own `economy7Source` field as "plausible", not
  "verified" -- see OA-127 above for why a precise published figure wasn't
  available.
- Washing machine/dishwasher's slot count grew 2->3 to fit a believable
  3-stage shape (OA-128's acceptance criteria example), rather than forcing
  3 stages into 2 slots or inventing a 2-stage shape that undersells the
  ticket's own washing-machine/dishwasher examples.

### Possible follow-up (not actioned, flagged only)

- `BASE_LOAD_SHAPE` (the unlabelled background/base demand curve) wasn't
  itself revisited for OA-128's "sharper morning/evening activity" -- the
  named appliance events now carry much of that signal, but a dedicated
  pass adding small, deliberately-unlabelled kettle/toaster/TV-type bumps
  to the base shape (per the ticket's "those can contribute to the profile
  without becoming draggable event cards") is still open if wanted.
- Confirm this session's work live in the browser once the other session's
  dev server is no longer holding port 5173.

## Current task

**OA-118 through OA-123** (epic + 5 child tickets, built, verified, not yet
committed) -- see below. Also still outstanding from before: **OA-108
through OA-117** (built, verified, not yet committed).

- **OA-118/OA-119/OA-120/OA-121/OA-122/OA-123 (MODEL epic -- household
  energy opportunity simulator)**: new `src/domain/savingsModel/` module,
  deliberately separate from `landingDemoFixture.ts` (OA-99) -- per
  OA-118's explicit "this epic does not replace OA-21/OA-23/OA-99/OA-104/
  OA-117, it provides the empirical/model authority those tickets should
  consume" -- so the landing page's existing deterministic fixture was
  **not** rewired to use this model in this pass.
  - **`assumptions.ts` (OA-119)**: versioned, sourced evidence pack --
    `SAVINGS_MODEL_ASSUMPTIONS`, each entry with id/value (or low/central/
    high range)/unit/source/sourceDate/confidence (`verified` /
    `plausible` / `illustrative` / `rejected`)/notes/modelVersion.
    Verified via web research this session: Ofgem TDCV (2,500 kWh/yr) and
    price-cap unit rate/standing charge (reused from OA-99, same figures);
    Agile's `min(D x wholesale + P, cap)` formula, £1/kWh cap, 16:00-19:00
    structural-peak uplift, and real negative-price behaviour (all
    `verified`). Marked **`plausible`, not verified** where this research
    pass could not pin down one single authoritative primary source:
    Elexon PC1's literal 48-period coefficient table (only the documented
    shape is public), Energy Saving Trust's standby-cost figure (multiple
    inconsistent EST-attributed numbers circulate: £35/£55/£60-80/£65-100
    -- used a conservative low/central/high range, not one precise
    number), CREST's specific per-appliance output tables (only the
    model's methodology/credibility is verified), and Intelligent Octopus
    Go's current rate (varies by region and changed several times in
    2026). `requireVerifiedOrPlausible()` throws if any model-critical
    constant ever tries to use an `illustrative`/`rejected` entry --
    tested in `assumptions.test.ts`.
  - **`archetypes.ts` (OA-120)**: four versioned household archetypes
    (single-occupant flat, typical family -- reusing OA-99's exact event
    set/kWh, large family, EV-owning family), each with its own appliance
    `ApplianceEvent[]` (duration/kWh/validStartSlotRange/dependsOnEventId,
    same shape as `landingDemoFixture.ts`'s `HouseholdEventDefinition`)
    and its own standby-cost range (scaled from OA-119's EST range, never
    invented per-archetype). `annualKwh` for the typical archetype is
    pinned to OA-119's verified Ofgem TDCV, not a separate guess.
  - **`simulator.ts` (OA-121)**: deterministic half-hourly simulator
    (`simulateHouseholdOpportunity`) that reports **three separate,
    never-summed-by-construction effects** per OA-118's rule: `tariffEffect`
    (same usage/timings, alternative tariff, usage-cost-only -- standing
    charge handled as an explicit separate add, never silently mixed in),
    `timingEffect` (same tariff, each movable event optimised to its own
    cheapest valid dependency-aware slot, base load and fixed events
    untouched -- total kWh conservation is asserted in code, not just
    tested), and `wasteEffect` (standby cost, entirely independent of the
    usage profile, so it can never double-count a slot already counted as
    a tariff/timing saving). No `Math.random()`/wall-clock dependence.
  - **`sensitivity.ts` (OA-122)**: `runSensitivityAnalysis` sweeps every
    archetype x caller-supplied Agile price-history scenario from the
    same Standard Variable baseline, returning low/central/high ranges --
    callers must supply the Agile curve(s) to sweep (this module doesn't
    hard-code one), per OA-118's "do not assume Agile is always the best
    tariff."
  - **`landingPageClaims.ts` (OA-123)**: turns a sensitivity summary into
    three labelled claim ranges (tariff-switch, timing-saving for non-EV
    households, timing-saving for EV households), each with an explicit
    caveat string -- directly encodes OA-118's warning that "timing alone
    for a typical non-EV household may often be only tens of pounds per
    year, so the product must not inflate this into a larger promise" by
    keeping EV and non-EV timing claims in separate ranges rather than one
    blended figure. This module is a comparison/decision aid for a human
    (or a future, separately-scoped ticket) to check the landing page's
    existing numbers against -- it does not call into `LandingDemo.tsx` or
    `landingDemoFixture.ts`.
  - **Validation pass (follow-up, same epic, after Steve's review of the
    first pass)** -- addressed every gap Steve flagged:
    - **5th archetype added to `archetypes.ts`**: `high-use-non-ev`
      ("High-use household, non-EV (immersion/hot-water boost)") -- a
      distinct shape from `family-large` (one dominant, genuinely large
      flexible load -- an immersion-heater/hot-water-boost event -- rather
      than more frequent small loads), not folded into "large". Its
      immersion-heater kWh figure is sourced from a new `assumptions.ts`
      entry (`immersion-heater-typical-power`) explicitly marked
      **`illustrative`** (not CREST-metered data), flagged honestly rather
      than dressed up as verified.
    - **`historicalPriceFixtures.ts` (new, OA-122 follow-up)**: real
      historical Octopus Agile half-hourly rates fetched from the public
      `api.octopus.energy` API (product `AGILE-24-10-01`, tariff
      `E-1R-AGILE-24-10-01-C`, region C/London) for three real calendar
      days -- `winter-high-cost-2026-01-18`, `negative-price-night-2026-04-05`
      (its -11.277p/kWh minimum exactly matches OA-99's own cited
      `observedRateRangePence.min`, cross-checked), `calm-summer-day-2026-06-20`
      -- plus `representative-median-year` (reuses OA-99's existing
      48-value representative curve, not duplicated). Every scenario
      records its real source URL.
    - **Compliance + waste-reduction sensitivity added to `simulator.ts`**:
      `COMPLIANCE_LEVELS`/`WASTE_REDUCTION_LEVELS` (manual-30/manual-70/
      automated-100, same 3-tier pattern for waste), `simulateHouseholdOpportunityAtCompliance`
      scales the realised timing/waste saving by the chosen fraction and
      exposes `combinedAnnualOpportunityGbp` (tariff + realised-timing +
      realised-waste) as an explicit *additional* field alongside, never
      instead of, the three independent components -- valid specifically
      because those three are computed from disjoint, non-overlapping
      inputs, not a sum of possibly-double-counted figures.
      `runComplianceSensitivityAnalysis` (`sensitivity.ts`) sweeps the full
      archetype x scenario x compliance x waste-reduction cross-product.
    - **`evidenceReport.ts` (new)**: the single evidence report Steve
      asked for -- runs every archetype against every real historical
      price scenario, reports tariff/timing/waste/combined per archetype
      as low/central/high ranges, **and** a `canonicalLandingPageFigures`
      block with the exact numbers for the recommended demo household
      (`family-typical`, `representative-median-year` scenario, at
      `manual-70` compliance / `waste-reduction-70` -- a realistic
      partial-adoption assumption, not the optimistic automated ceiling):
      baseline 6.85 kWh/day, tariff saving £36.08/yr, fully-optimised
      timing ceiling £80.44/yr, realised timing saving £56.31/yr, waste
      saving £52.50/yr, **combined £144.89/yr**. Rendered to
      `docs/evidence/household-savings-evidence-report.md`.
      `assertDefensibleTypicalHouseholdRange` is the STOP guard Steve
      asked for -- throws if the canonical demo household's tariff/timing/
      combined saving goes negative *specifically on the
      representative-median-year scenario* (the one actually recommended
      for landing-page use).
    - **Important finding, not a bug**: on the single
      `winter-high-cost-2026-01-18` real historical day, `family-typical`'s
      tariff-switch saving naively annualises to *negative* (-£22.05) --
      that day's fixed-time dishwasher/oven usage happens to land inside
      an unusually expensive real 16:00-19:00 peak. This is exactly OA-118's
      own "do not assume Agile is always the best tariff" rule surfacing
      correctly, which is why the STOP guard checks only the recommended
      representative scenario, not the full stress-tested range (which is
      supposed to include this). Documented in the report's own
      "Price-volatility finding" section so it's never mistaken for a
      model defect later.
    - **Unresolved data gap, cannot be closed by me**: the "real 3-day
      half-hourly household snapshot" OA-118 itself names as a sanity-check
      reference does not exist anywhere in this repo (searched) or attached
      to the OA-118 Jira ticket (`attachment: []`) -- flagged in
      `KNOWN_DATA_GAPS` and in the generated report. **Needs the actual
      file/export from Steve before this can close.**
    - 51 tests across 7 files in `src/domain/savingsModel` (`npm test` --
      all passing), `npm run lint` clean, `npm run build` clean (the
      `canonicalLandingPageFigures` field that previously made `tsc -b`
      fail, noted below under OA-126, is now implemented).
  - None of OA-118 through OA-123 transitioned in Jira this session (left
    as "To Do"); OA-118 remains the parent epic, OA-119-123 are its five
    child tickets (cloudId `82bc0aac-6540-45cd-af3b-bbe8ab843532`).
  - **OA-130 (ingest the real 3-day snapshot, closes the data gap above)**:
    Steve supplied the real export (`download (3).csv`, 2026-09-29 to
    2026-10-01, 144 half-hourly periods) and created OA-130 to ingest it.
    - `fixtures/real-household-snapshot-2026-09-29.csv` (committed
      verbatim, source of truth) + `realHouseholdSnapshotData.ts`
      (generated once from that CSV by a throwaway script, not hand-
      edited -- 144 `RawSnapshotPeriod` entries, original timestamps/
      values preserved exactly; daily totals cross-checked against the
      CSV's own sums: 29.587 / 6.729 / 4.715 kWh).
    - `realHouseholdSnapshot.ts`: groups the 144 periods into their 3 real
      days (`buildSnapshotDays`), flags `SNAPSHOT_IS_SANITY_CHECK_ONLY =
      true` and a `SNAPSHOT_PROVENANCE` string, identifies the real
      anomalous day (`analyseSnapshot` -- 29 Sep is ~4.4x the next-highest
      day), and compares daily-kWh scale + overnight (01:00-04:00) share
      against every canonical archetype (`compareSnapshotToArchetypes`) --
      deliberately scale/shape only, no appliance disaggregation, per the
      ticket's explicit "do not attempt appliance identification unless
      the data genuinely supports it".
    - `evidenceReport.ts` extended with a `realHouseholdSnapshot` field and
      a new "Real household snapshot sanity check (OA-130)" markdown
      section -- `canonicalLandingPageFigures` (£144.89/year) is
      untouched; no assumption in `assumptions.ts`/`archetypes.ts` was
      changed off the back of a 3-day, single-household sample.
    - 9 new tests (`realHouseholdSnapshot.test.ts`) + 4 more in
      `evidenceReport.test.ts` (64 tests total across
      `src/domain/savingsModel`, all passing); `npm run lint`/`npm run
      build` clean. Regenerated
      `docs/evidence/household-savings-evidence-report.md`.
    - Not yet decided/actioned: transitioning OA-130 in Jira, or whether
      to post a comment back to OA-118/OA-130 — ask Steve first, nothing
      committed yet.

## Previous task

**OA-108 through OA-117** (built, verified, not yet committed).

- **OA-109 (scrubber)**: continuous drag control (`<LandingStoryScrubber>`,
  `src/components/LandingStoryScrubber.tsx`) replacing the old 3-tab
  `role="tablist"`, driving a single `progress` number (0/1/2, fractional
  while dragging) that `LandingDemo.tsx` derives every other value from.
  `<LandingTimeProfile>` stays mounted once; its `day` prop is a per-slot
  blend (`interpolateDay`) of the three fixture steps, event overlays
  interpolate the same way, and dragging an event is only enabled exactly
  at `progress === 2`.
- **OA-108 (Optimise content hierarchy)**: *What we've done* / *How we
  calculated it* / *Try it yourself* sections inside the Optimise stage,
  figures scaling continuously with `progress`. Permanent per-appliance
  list replaced by a contextual popover tied to the focused/hovered/
  dragged event (`eventSavingText`).
- **OA-110 (stage copy clarity, this pass)**: added a visible per-stage
  question heading + one-line supporting copy + a single compact, bold
  "result" line, replacing the old tariff-recitation summary and the
  per-stage long explanatory sentences:
  - Baseline: "When do you use energy?" / "Your typical day, half hour by
    half hour." / `6.8 kWh · £1.80`.
  - Compare: "What would that day cost on Agile?" / "Same usage. Same
    timings. Different prices." / `£1.61 on Agile · £0.19 less`.
  - Optimise: "What could you save by moving flexible use?" / "Shift only
    the things that can realistically move." / `Save around £X/year`.
  - Scrubber labels lost their numeric prefixes (`Baseline`/`Compare`/
    `Optimise`, not `1. Baseline`/etc) — left-to-right position already
    communicates order.
  - `LandingTimeProfile`'s `summary` prop was removed/replaced by
    `questionHeading`/`supportingCopy`/`result` (all `ReactNode`);
    `explanation` is now optional, used only for Optimise's "How we
    calculated it" detail block.
  - The Optimise stage's "What we've done" section no longer repeats the
    annual-saving headline (that's the dominant `result` line now) — it
    keeps its own heading, one sentence, and the today/month detail line.
  - Calculations/event data untouched, per the ticket's explicit scope.
- **OA-111 (hero hook test)**: `src/pages/LandingPage.tsx`'s hero
  headline/subhead replaced to test "Hunt the energy vampires in your
  home." as the landing-page hook while the product/app name is still
  undecided. Headline: "Hunt the **energy vampires** in your home." (only
  "energy vampires" keeps the existing gradient-text emphasis, reused from
  OA-87's design system rather than a new vampire-themed style). Subhead:
  "See where your electricity goes, what's costing you, and what you could
  save by changing when you use it." Nothing else on the page changed —
  no vampire/fang/Halloween language elsewhere, flexible/movable loads in
  `LandingDemo`/`LandingTimeProfile` keep their existing plain-language
  terminology, and the copy never names "Shift & Save" so it still works
  if the app name changes later. Removed `.landing-hero__break` and
  `.landing-hero__line--muted` from `LandingPage.css` — both were only
  ever used by the old three-line headline split this replaces.
- **OA-112 (Optimise height parity / collapse explanation)**: Optimise now
  follows the exact same question → explanation → key number → chart
  rhythm as Baseline/Compare, with "Optimise all"/"Reset" simply inserted
  between the number and the chart (as the ticket explicitly allows).
  Removed the three always-visible OA-108 sections ("What we've done" /
  "How we calculated it" / "Try it yourself" headings and their
  paragraphs) entirely:
  - The compact daily/monthly detail line (`£0.23 today · ≈ £3.73/month`)
    now renders on its own, no heading/sentence above it — the annual
    `result` line above already carries the headline.
  - All secondary methodology/caveats (same events/kWh/duration, only
    eligible loads move, timing windows/dependencies, standing-charge
    treatment, illustrative frequency, region/variance caveats) merged
    into one `<details>` — **"How we calculated this"** — collapsed by
    default (verified in `LandingDemo.test.tsx` via `not.toHaveAttribute('open')`).
  - "Optimise all"/"Reset" lost their "Try it yourself" heading — shown
    immediately beneath the result/detail line, directly above the chart.
  - Measured live: card height is 482px (Baseline) / 512px (Compare,
    slightly taller for its one-line caveat) / 586px (Optimise, taller
    only by the controls row height) — no large layout jump scrubbing
    between stages, per the acceptance criteria.
  - Removed the now-unused `.landing-demo__section-heading`/
    `__section-text` CSS (only the removed headings/paragraphs used them).
  - Calculation logic, events and interaction behaviour untouched, per the
    ticket's explicit scope.
- **OA-113 (purple/indigo chart palette)**: replaced the shared blue
  `RATE_COLOR_STEPS_LIGHT`/`RATE_COLOR_STEPS_DARK` 9-step ramp in
  `src/components/heatMapMath.ts` with an indigo/violet ramp derived from
  the product's own `--accent` family (#a855f7/#aa3bff/#c084fc) — deep
  indigo/violet (cheap) → muted plum/blue-grey (mid) → pale lavender
  (expensive), deliberately desaturated through the middle rather than a
  flat-saturation ramp, so full-strength brand purple stays reserved for
  interactive/CTA use, not a chart background fill. `LandingTimeProfile`
  (and its legend gradient, which reads the same array) picks this up
  automatically with no component changes. The 4–7pm structural-peak
  annotation, usage silhouette, and event overlays were already
  white/neutral (no hardcoded blue anywhere in that CSS), so they needed
  no changes and still read clearly over the new palette.
  - Deliberately **left `src/components/HeatMap.css`/`HeatMap.tsx`
    untouched** (the older heatmap used by the authenticated app's
    `ActualPage`/`ComparePage`/`OptimisedPage`, with its own duplicated
    hex values, not sourced from `heatMapMath.ts`'s constants) — OA-113's
    acceptance criteria all reference "the chart"/"the logo, slider and
    CTA", i.e. the landing page specifically; the ticket's "should be
    reused for future energy/price charts" is phrased as future work, not
    an in-scope rename of a separate, unrelated authenticated-app
    component. Flagged as a candidate follow-up below.
  - Added `docs/BRAND_GUIDELINES.md` (new file, no brand doc existed
    before) with the ticket's data-visualisation colour rule verbatim,
    plus the concrete pattern used here (single hue family, vary
    lightness not saturated-purple-everywhere, keep other chart layers
    neutral, annotations stay neutral/white, never colour-only meaning).
  - Only hex values changed; `rateColorStepIndex`/`rateRatio`/array
    *lengths* untouched, so existing tests (which assert against
    `RATE_COLOR_STEPS_LIGHT.length`, never literal hex) needed no changes.
- **OA-114 (graph before explanatory copy)**: reordered each stage to
  "meaning → evidence → explanation" in `LandingTimeProfile.tsx`:
  - Above the chart now: only the question heading, supporting line, the
    dominant result, and (Optimise) its compact daily/monthly detail line
    and "Optimise all"/"Reset" controls — all numbers/interaction, no
    explanatory prose.
  - The chart itself (legend + track) follows immediately.
  - Everything explanatory moved into a new `.landing-time-profile__below-chart`
    block *after* the chart: the cost-basis footnote (`costNote`, always),
    Compare's representative-comparison `caveat`, and Optimise's collapsed
    "How we calculated this" `explanation` disclosure (still collapsed by
    default, per OA-112).
  - Controls deliberately stayed exactly where OA-112 already put them
    (immediately above the chart) — the ticket explicitly carves out
    controls as not being "explanatory copy", so no change was needed
    there beyond what OA-112 already built.
  - Measured live: card height 490px (Baseline) vs. 594px (Optimise,
    taller only by the controls row, same as OA-112's measurement) — no
    layout jump from this reordering itself.
  - No `LandingDemo.tsx` changes needed — it already handed
    `questionHeading`/`supportingCopy`/`result`/`payoff`/`controls`/
    `explanation`/`costNote`/`caveat` as separate props; OA-114 only
    changed where `LandingTimeProfile` renders each one.
- **OA-115 (event chips, labels, secondary chart hue)**: four changes in
  `LandingTimeProfile.tsx`/`.css` and `heatMapMath.ts`:
  1. *No more full-height event rectangle.* Replaced both event-overlay
     variants (`__event-annotation`, `__flexible-event`) with one unified
     `.landing-time-profile__event-chip`, a **fixed-height row** (26px,
     `EVENT_CHIP_HEIGHT_PX`) anchored near the top of the track
     (`EVENT_CHIP_TOP_OFFSET_PX`), stacked per lane — never stretching the
     chart's full height, so an event reads as an object sitting on the
     chart, not a new coloured band cutting through the price/usage
     layers underneath it.
  2. *No more hard truncation* ("Wa...", "Tumb...", "Dehu..."). The chip's
     name (`.event-chip-name`) is `white-space: nowrap` with no
     ellipsis/clipping — the chip container is `overflow: visible`, so a
     short-duration event's label can extend past its own coloured
     indicator rather than being cut off. The secondary time-range line
     still drops first under `COMPACT_LABEL_MAX_SLOT_COUNT` (unchanged
     rule from OA-107), but the name itself is never shortened.
     `computeEventLanes` now reserves extra lane width for this overflow
     (`ESTIMATED_CHARS_PER_LABEL_SLOT`, a rough chars-per-slot estimate,
     not real text measurement) so two back-to-back-in-time-but-not-
     overlapping events with long names get pushed into separate lanes
     instead of their overflowing labels visually colliding — verified
     live (EV charging / Washing machine cycle / Tumble dryer cycle /
     Dehumidifier all render full names, no collisions).
  3. *Visual states.* Fixed events: quiet dashed outline (`[data-fixed]`).
     Movable events: solid but subtle outline, plus a small grip-mark
     drag affordance (`.event-chip-handle`), movable only. Active/
     selected/dragging (reuses OA-108's existing `activeEventId`
     focus/hover/drag tracking): `--accent`'s outline/fill, scoped to that
     one chip only — never a full-chart selection band. Verified live:
     focusing "Washing machine cycle" shows the brand-purple outline
     local to its own chip, popover still anchored just below it.
  4. *Secondary chart hue.* `RATE_COLOR_STEPS_LIGHT`/`_DARK` shifted from
     OA-113's magenta-violet (same hue family as `--accent`, ~272°) to a
     cooler slate-indigo (~230°, more blue-leaning, lower saturation) —
     "the current indigo is too close to the main brand purple". Updated
     `docs/BRAND_GUIDELINES.md` with the hue distinction and the
     fixed/movable/active visual-state rule, per the ticket's "update the
     reusable data-visualisation palette/token" instruction.
  - Updated test selectors in `LandingTimeProfile.test.tsx`/
    `LandingDemo.test.tsx` from the old `.event-annotation`/
    `.flexible-event` classes to `.event-chip[data-fixed]`/
    `.event-chip:not([data-fixed])`. No calculation/event-model changes.
- **OA-116 (shrink chips, drop "cycle", preserve graph hierarchy)**:
  - Shortened `LANDING_DEMO_EVENTS` labels in `landingDemoFixture.ts`:
    "Washing machine cycle" → "Washing machine", "Tumble dryer cycle" →
    "Tumble dryer", "Dishwasher cycle" → "Dishwasher", "Oven (cooking)" →
    "Oven" (EV charging/Dehumidifier unchanged — already matched the
    ticket's target list). Updated `LandingDemo.test.tsx`'s regexes
    accordingly (`/dishwasher cycle/i` → `/dishwasher/i`, etc; one
    assertion regex `/cycle|charging|dehumidifier|oven/i` broadened to
    `/machine|dryer|dishwasher|charging|dehumidifier|oven/i` so it still
    actually catches the renamed events, not just a stale "cycle"
    substring that no longer appears anywhere).
  - Shrunk the OA-115 chip ~25-30% (`EVENT_CHIP_HEIGHT_PX` 26→19,
    `EVENT_CHIP_GAP_PX` 6→4, `EVENT_CHIP_TOP_OFFSET_PX` 20→16 in
    `LandingTimeProfile.tsx`; padding 6px→2px/4px, name 11px→10px, time
    9px→8px, drag-handle 6×12px→5×9px in `LandingTimeProfile.css`) — name
    stayed the least-shrunk element (primary scan target), time shrank
    more (secondary).
  - Top-left anchoring: chip and label both switched from
    `align-items: center`/`justify-content: center` to `flex-start`, so
    content anchors to a fixed corner rather than being vertically
    centred — stays visually stable as an event moves, not "arbitrary
    vertical placement".
  - Fixed/movable/active-selected/dragging visual states were already
    built in OA-115 and needed no change here (dragging reuses the same
    `activeEventId` "active" state as focus/hover, so it's already
    covered).
  - Did not change `computeEventLanes`'s OA-115 label-overflow-reservation
    logic (`ESTIMATED_CHARS_PER_LABEL_SLOT`) — still correct with shorter
    labels (shorter names need *less* reserved width, so if anything
    collision margins are more generous now); verified live with no
    label collisions across all six events.
- **OA-117 (auto-optimise on arrival)**: the single biggest behavioural
  change this session, in `LandingDemo.tsx`:
  - New `computeAutoOptimisedStartSlots()` (module-level, pure) -- the
    exact same dependency-ordered, `cheapestStartSlotForEvent`-based
    algorithm the old `optimiseAll()` click handler used, just extracted
    and run as the state's *initial* value: `useState(computeAutoOptimisedStartSlots)`.
    No other architecture changed -- `eventOverlays`' existing OA-109
    lerp-toward-`projected.currentStartSlot` blending and
    `interpolateDay`'s existing compare/optimise usage blend already do
    the right thing once the target they blend toward is the optimised
    schedule by default instead of "nothing moved yet": dragging the
    scrubber from Compare to Optimise now visibly moves each eligible
    event from its original slot to its optimised one as `optFrac` goes
    0→1, and the saving figures (`lerp(0, fixture.projection.X, optFrac)`)
    rise from £0 to the real total the same way -- continuously, with no
    button press, and reversibly (scrubbing back to Compare returns
    everything to the original schedule, since `optFrac` returns to 0).
  - Removed the "Optimise all" button/handler entirely (redundant now) --
    `controls` only renders Reset.
  - `resetSchedule()` unchanged (`setOptimiseEventStartSlots({})` already
    meant "every event falls back to its actual slot" via
    `buildLandingDemoFixture`'s own `?? event.actualStartSlot` fallback --
    this was already correct for "return to original", regardless of
    whether the state started empty or auto-optimised).
  - `hasMovedFromOriginalSchedule` changed from "the override map is
    non-empty" (meaningless now the map is always populated) to "any
    movable event's current position differs from its actual one" --
    Reset now starts *enabled* at Optimise (there's immediately something
    to reset), not disabled.
  - Removed now-orphaned `.landing-time-profile__controls-button--secondary`
    CSS (only ever applied to the old Reset-next-to-Optimise-all pairing).
  - Rewrote the large majority of `LandingDemo.test.tsx`'s Optimise-stage
    tests, which all previously assumed "nothing has moved until a button
    is clicked": added `expectedAutoOptimisedStartSlots()` (same algorithm,
    called from the test file against the real exported fixture functions
    -- not hard-coded slot numbers, so these can't silently drift from
    what the component actually does) and used it throughout instead of
    literal numbers computed by hand. Verified the actual computed
    schedule once via a throwaway debug script before writing assertions
    (washing_machine→27, dishwasher→45, tumble_dryer→29, ev_charging→5,
    dehumidifier→5) so drag-distance tests stay within each event's valid
    window instead of silently clamping.
  - Confirmed live: jumping straight to Optimise shows "Save around
    £44.78/year" immediately (no click), Reset enabled by default;
    scrubbing back to Compare shows every event at its original slot
    (dishwasher 18:00, washing machine/tumble dryer/dehumidifier at their
    documented actual times) with only the tariff/cost difference
    remaining. Reduced-motion snap behaviour unchanged (already correct
    from OA-109, not touched by this ticket).

- **OA-124 (logo power-on cue)**: `src/components/Logo.tsx`'s `LogoMark`
  now tags its centre bar (the mark's "cheap price window", already the
  one full-opacity bar) `logo-mark__bar--center` and its two immediate
  neighbours `logo-mark__bar--neighbor`; `src/App.css` adds a one-shot
  `logo-power-on` keyframe animation (1.3s, runs on mount) that scales/
  glows (`drop-shadow` in `var(--accent)`) the centre bar up then settles,
  while the neighbours get a much smaller, slightly-offset opacity lift
  (`logo-power-on-neighbor`) so the mark reads as waking up from the
  middle outward rather than flashing all at once. `@media
  (prefers-reduced-motion: reduce)` disables both animations entirely
  (falls back to the static mark, which already renders in its settled
  state). No changes to the SVG geometry, `BrandMark`, or any other
  consumer of `LogoMark`. Verified: animation names/durations present via
  computed styles in the browser, `npm test` (153/153), `npm run lint`
  (clean, same pre-existing unrelated warnings), `npm run build` (clean).
- **Landing time-profile polish (ad hoc, no ticket, this session)** — four
  small visual/interaction requests against `LandingTimeProfile.tsx`/
  `.css` and `LandingDemo.tsx`/`.test.tsx`:
  1. Removed each event chip's dashed/solid bordered box (background +
     border) — the label/time/handle now sit directly on the chart as
     plain text, no boxed background. Kept the `--accent` outline on
     focus/active for a11y, just without its own fill.
  2. Added a vertical "drop-line" per event, from its chip down to the
     chart's bottom edge — 3px (vs. the existing 1px white hour/slot
     guides), amber (`rgba(245,166,35,…)`, complementary to the
     purple/indigo chart), dashed for fixed events and solid for movable
     ones (brighter when active) — new `.landing-time-profile__event-line`
     elements, one per overlay, positioned at the event's horizontal
     midpoint.
  3. Event label text-shadow changed from black to dark purple
     (`rgba(44,11,79,0.9)`).
  4. Dropped the "Cheaper ← price → More expensive / Usage" legend row
     entirely (`PRICE_LEGEND_GRADIENT` and the `__legend`/`__legend-item`/
     `__legend-gradient`/`__legend-bar` CSS removed as dead code); removed
     its three now-obsolete tests in `LandingTimeProfile.test.tsx`.
  5. Re-added an **"Optimise"** button next to **"Reset"** on the Optimise
     stage (`LandingDemo.tsx`'s `optimiseAll()`, re-applying
     `computeAutoOptimisedStartSlots()`) — disabled by default (the
     schedule already arrives auto-optimised, per OA-117) and only enables
     once Reset (or a manual drag) has returned every event to its
     original slot; mirrors Reset's own enabled condition inverted, so
     exactly one of the pair is ever enabled at a time. New tests in
     `LandingDemo.test.tsx` cover the disabled-on-arrival state, enabling
     after Reset, and clicking it restoring the exact auto-optimised
     schedule.
  6. Added a shared `left` transition (`0.4s cubic-bezier(0.22, 1, 0.36,
     1)`, under `prefers-reduced-motion: no-preference`) to both the event
     chip and its new drop-line, so Reset/Optimise (and live
     dragging/scrubbing, which already updates `left` in small steps)
     animate events to their new position rather than jumping — confirmed
     visually (Reset → original positions, Optimise → back to the
     £44.78/year auto-optimised schedule) and via computed
     `getComputedStyle(...).transition` in the browser.
  - Verified: `npm test` (188/188), `npm run lint` (clean, same
    pre-existing warnings), `npm run build` (clean). No Jira ticket for
    this — Steve requested these directly in conversation; flagged here
    so a future session doesn't mistake them for an untracked regression.
- **OA-126 (clarify Typical household usage cost vs. standing charge)**,
  plus three more ad hoc polish requests in the same session, all in
  `LandingTimeProfile.tsx`/`.css` and `LandingDemo.tsx`/`.test.tsx`:
  - **OA-126 itself**: Baseline no longer shows one ambiguous combined
    "6.8 kWh · £1.80" line. New `resultLabel` prop (rendered as a quiet
    line above the bold `result`) + restructured `result` text give:
    "Typical day · 6.8 kWh" / "**£1.80** energy cost" / "+ £0.55/day
    standing charge" (new `standingChargeNote` prop, shown right next to
    the result it's excluded from, not just in the pre-existing
    below-chart `costNote` footnote, which is unchanged). Compare uses the
    same convention: "Same usage · 6.8 kWh" / "**£1.61** energy cost on
    Agile · £0.19 less". Optimise: "Timing saving only" / "Save around
    £44.78/year" / "Standing charge unaffected — never part of this
    saving" (worded as a saving, not a daily cost, since Optimise's result
    is an annual saving, not a bill amount — ticket's explicit "do not
    present the standing charge as part of the shiftable/optimisable
    amount"). All three stages' standing-charge wording and the
    `resultLabel`/`result` split now follow one shared convention, per the
    ticket's "cross-stage consistency" requirement.
  - **Moved "Reset"/"Optimise" to the top-right corner of the card** (ad
    hoc, Steve's request while reviewing OA-126 live) — new
    `.landing-time-profile__heading-row` wraps the question/supporting
    column and `controls` in one flex row (`justify-content:
    space-between`), instead of `controls` being its own full-width block
    between the narrative and the chart.
  - **Removed the native `title` tooltip** on every event chip (ad hoc,
    "remove the boxes that appear on hover") — the chip's own label is
    never truncated (OA-115), so the browser's default title tooltip was
    pure duplicate clutter. Three `LandingTimeProfile.test.tsx` assertions
    that checked `title` were dropped (coverage of the underlying compact-
    label behaviour itself is unaffected).
  - **Removed the on-click chart-column selection box** (ad hoc, "no bar
    should appear on click") — dropped the column `onClick` handler and
    narrowed `.landing-time-profile__column`'s outline-on-select CSS from
    `[data-selected], :focus-visible` to `:focus-visible` only, since
    `:focus-visible` doesn't match a mouse click. Keyboard arrow-key
    navigation (and its outline) is unaffected; the sr-only per-slot
    description panel below the chart still updates on focus, just
    without the always-on click/hover box.
  - Verified: `npm test` (141/141 across the touched component/fixture
    test files; the two `savingsModel` test files fail independently of
    this work — see note below), `npm run lint` (clean, same pre-existing
    warnings), confirmed live in the browser (Baseline/Compare/Optimise
    copy, controls position, no title tooltip, no click-select box).
  - **Note for whoever picks this up next (resolved)**: the concurrent
    OA-118-123 session's `src/domain/savingsModel/evidenceReport.ts` did
    briefly leave `npm run build` failing (missing
    `canonicalLandingPageFigures`) and 6 failing tests mid-edit — both are
    now fixed (see "Current task" above); `npm test`/`npm run lint`/`npm
    run build` are all clean again as of this update. Not caused by, or
    fixed as part of, OA-126/this polish pass either way.

## State

Done and verified: `npm test` (153/153), `npm run lint` (clean, same
pre-existing unrelated warnings elsewhere), `npm run build` (clean,
includes `tsc -b`), and confirmed live in the browser at every stage/page
(hero headline, Baseline/Compare/Optimise screenshots all match each
ticket's copy and layout exactly, including the purple/indigo chart
palette, the collapsed-by-default disclosure, and the chart now appearing
immediately above only numbers/controls with explanation below it).
Working tree has an unrelated untracked `local.py` at repo root (predates
this session, leave it alone), this session's own uncommitted changes
(OA-108 through OA-117), and a new untracked `prod.py` (a deploy helper,
see below — not a ticket deliverable).

## Next step

Nothing else planned for OA-108 through OA-117 — all ten tickets'
acceptance criteria are implemented and verified above. Still outstanding
from before: none of OA-103 through OA-117 are pushed, no PR, not
deployed, none transitioned in Jira (all presumably still "To Do"). Ask
Steve whether to push `main`/open a PR covering this whole run together,
then deploy and transition the tickets once there's a stable beta deploy
(`prod.py` can do the push-to-deploy step once Steve is ready — see
below).

Possible follow-up (not actioned, flagged only): OA-113/OA-115's
purple/indigo (then slate-indigo) palette was applied to
`heatMapMath.ts`'s shared constants (used by the landing page) but
deliberately not to `HeatMap.css`'s separate duplicated hex values (used
by the authenticated app's Actual/Compare/Optimised pages) — out of
either ticket's literal scope, but worth a dedicated ticket if the same
rebrand should extend there.

## Key references

- New files (OA-109): `src/components/LandingStoryScrubber.tsx` (+ `.css`,
  `.test.tsx`).
- New file (OA-113): `docs/BRAND_GUIDELINES.md` (extended by OA-115).
- Touched this session: `src/components/LandingDemo.tsx` (+ `.test.tsx`),
  `src/components/LandingTimeProfile.tsx` (+ `.test.tsx`, `.css`) for
  OA-110/OA-112/OA-114/OA-115; `src/pages/LandingPage.tsx` + `.css` for
  OA-111; `src/components/heatMapMath.ts` for OA-113/OA-115;
  `src/components/LandingDemo.css` for OA-112 (dead-CSS cleanup).
- Untouched, per every ticket's explicit scope: `src/domain/landingDemoFixture.ts`
  (+ `.test.ts`) — same fixture, cost/projection math, and
  dependency/constraint logic throughout. Also untouched:
  `src/components/HeatMap.tsx`/`.css` (see follow-up above).
- Jira: OA-108 through OA-117, cloudId `82bc0aac-6540-45cd-af3b-bbe8ab843532`,
  all under parent epic OA-33 ("MVP — Landing Page & Signup"). None
  transitioned this session (left as "To Do").
- Commands (repo root, web app): `npm test`, `npm run lint`, `npm run
  build`, `npm run check-bundle`. Dev server runs on :5173 (this session
  restarted it twice via the browser tool's `preview_start` after it had
  stopped on its own — same `.claude/launch.json` config as before, no
  changes made there).

- **`prod.py`** (new, untracked, mirrors `local.py`'s pattern, added this
  session at Steve's request): a deploy-through-CI helper for Steve's own
  terminal use, not something I run myself. Refuses on the wrong branch or
  local `main` behind `origin/main`; if the tree is dirty, stages
  modified/deleted tracked files automatically but asks about each
  *untracked* file individually (default: skip) and requires a non-empty
  commit message before committing; then runs the same lint/build/
  check-bundle/test (web) and test (server) steps `.github/workflows/ci.yml`
  runs; shows exactly which commits are about to go live and requires
  typing `yes`; then pushes `main`, which is what actually triggers
  `.github/workflows/deploy-beta.yml`'s Firebase Hosting deploy to
  https://shiftandsaveapp.web.app/. It never calls `firebase deploy`
  directly and never force-pushes — all deploy gatekeeping stays in CI.
  Verified `python3 prod.py --check-only` and confirmed the syntax is
  valid; the full interactive commit/push flow has not been run for real
  (would have committed/pushed this session's work, which Steve hasn't
  confirmed yet).

## Decisions made

(Judgment calls not fully spelled out in ticket acceptance criteria.)

- **Discrete narrative, continuous numbers** (OA-109): which narrative
  block renders is a discrete snap at `Math.round(progress)`; the numbers
  inside interpolate continuously. Fully continuous prose cross-fading
  would be substantial extra complexity for no clear benefit the tickets
  ask for.
- **Event overlay position rounds to the nearest half-hour slot** during
  the 2→3 transition (OA-109) — the fixture has no finer resolution than
  a slot, so this is the only resolvable position; still reads as smooth
  movement at normal drag speed.
- **OA-110's Compare result line omits the reference-tariff name**
  (`£0.19 less`, not `£0.19 less than Standard Variable`) to stay compact,
  per the ticket's explicit example copy — the full attribution still
  lives in the supporting line ("Same usage. Same timings. Different
  prices.") and, for Compare, in the existing representative-comparison
  caveat below the chart.
- **Optimise's "What we've done" section keeps its heading/sentence/detail
  line but drops the duplicate annual-saving headline** — OA-110's
  acceptance criteria explicitly call out "no duplicated explanatory copy
  above the chart", and the new dominant `result` line already carries
  that figure.
