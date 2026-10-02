# HANDOFF

_Last updated: 2026-10-02 (core loop via PR #14; backlog audit +
polish tier via PR #15; deeper feature tier via PR #16/#17; beta
mop-up cluster OA-63/64/68/69/66/67 merged via PR #18; revised build
order OA-70/71/72/74 merged via PR #19/#20/#21/#22, all Done in Jira;
OA-73 delivered as docs/SHIFTING_METHODOLOGY.md, awaiting Steve's
sign-off; OA-65 not started)_

## Current task

Steve revised the build order after the mop-up cluster: **OA-69 (done)
→ OA-70 → OA-71 → OA-72 → OA-74 → OA-73 → [new implementation ticket]
→ appliances/household setup → OA-65**, replacing the old "My Savings
+ Cheapest Times" product surface with Actual → Compare → (eventually)
Optimised → Plan. OA-70 through OA-74 are all merged and Done:

- **OA-70**: shared 30-day heat map component (`src/components/HeatMap.tsx`
  + `heatMapMath.ts`), tariff-agnostic, dataviz-skill-validated sequential
  blue ramp for rate, bar-height for usage. PR #19.
- **OA-71**: `/api/octopus/actual-period` + `/actual` page — real tariff(s)/
  usage/cost for the imported window, correctly split across a mid-period
  tariff switch (`server/src/actualPeriod.js`). PR #20.
- **OA-72**: `/api/octopus/like-for-like` + `/compare` page — generic
  "I'm on X, what would this have cost on Y?", not Agile-only. PR #21.
- **OA-74**: retired the standalone Cheapest Times page and My Savings'
  generic appliance "shifting opportunity" selector; My Savings now
  embeds `ActualPage`/`ComparePage` directly; `/cheapest-window` redirects
  to `/savings` rather than 404ing; backend capability (the route itself,
  `findCheapestWindow`/`averageRate`, `/savings-result`) untouched. PR #22.
- **OA-73**: delivered as `docs/SHIFTING_METHODOLOGY.md` — the shifting
  model, constraints, evidence hierarchy and fixtures, explicitly no
  code. Per the ticket, needs Steve's sign-off before any implementation
  ticket is opened against it (same pattern as `SAVINGS_METHODOLOGY.md`).

Not yet started: a new implementation ticket for Optimised (to be
created once OA-73 is signed off), appliances/household setup, and
OA-65 (Today/Tomorrow schedule + heat map, now explicitly last in the
sequence).

(Earlier: Steve identified a mop-up cluster of real beta bugs with
build order **OA-63 → OA-64 → OA-68 → OA-69 → OA-66 → OA-67** — all
merged via PR #18 and Done in Jira before the above.)

## State

- OA-5/OA-20 application code (Firestore store, encrypted credentials,
  Connect Octopus UI, server routes) is merged and tested — 21 server
  tests pass.
- `energy-saving-server` Cloud Run service is live:
  `https://energy-saving-server-zz3rxj7nfq-nw.a.run.app`, reached via
  Firebase Hosting's `/api/**` rewrite at
  `https://shiftandsaveapp.web.app`.
- **Steve verified the full flow live on beta** with his real Octopus
  credentials (entered directly into the deployed page, never shared in
  chat): connected successfully, account number shown redacted
  (`A-****3E1B`), tariff code shown, no API key ever visible client-side,
  state persisted across a page refresh (Firestore-backed).
- OA-5 Definition of Done — confirmed:
  - [x] Authenticated beta user can open Connect Octopus
  - [x] Credentials entered directly in the beta page (never via chat)
  - [x] Validated server-side (real Octopus API call)
  - [x] Connected account state persisted securely (Firestore + AES-256-GCM)
  - [x] Browser never receives the stored API key
  - [x] Refresh/relogin preserves connected state
  - [x] Account number redacted in UI
  - [x] Flow visible and testable on the stable beta URL
  - [ ] Not yet manually exercised (but covered by passing server tests):
    invalid-credentials error path, disconnect, cross-user isolation
- **OA-9/OA-30/OA-31**: forward-looking cheapest-window guidance is
  live, distinct from OA-22's backward-looking comparison.
  `GET /api/octopus/cheapest-window?durationMinutes=N` looks up the
  live Agile tariff for the user's region, fetches its published rates
  for the next 48h (today, plus tomorrow once Octopus publishes it
  around 4pm UK time), and runs `findCheapestWindow`
  (`server/src/cheapestWindow.js`) to find the cheapest contiguous
  run of half-hour slots — returns `{found: false}` if no window long
  enough exists yet (e.g. tomorrow's prices not published). OA-30's
  appliance profile model already existed as pure domain data
  (`src/domain/applianceProfile.ts`, from a prior session) but wasn't
  used anywhere; `CheapestWindowPage` (OA-31) is its first consumer —
  an appliance picker that calls the endpoint with that appliance's
  typical cycle duration and shows "run your X between A and B",
  flagging estimated durations and any safety note (e.g. "don't leave
  a tumble dryer unattended") from the profile.
- **OA-40/OA-43**: the same `/cheapest-window` endpoint takes an
  optional `energyKwh` param (the frontend's own appliance catalog
  value, same pattern as `durationMinutes` -- server stays generic).
  When given, and the account has imported usage history, the
  response's `recommendation` quantifies one cycle's £ cost at the
  cheapest window vs. the current tariff's average rate
  (`averageRate` in `server/src/cheapestWindow.js`), flagged
  `unitRateOnly: true` like `SavingsResult`. No import yet, or
  `energyKwh` omitted → `recommendation: null`, and the page falls
  back to just the window (no £ claim). `CheapestWindowPage` renders
  the OA-43 copy ("running then instead of now would cost about £C
  instead of £F — a saving of about £S this cycle") only when there's
  an actual saving, and an honest "wouldn't cost less" line when there
  isn't — never silence either way. Deliberately per-cycle, not
  annualised: this is a single-action recommendation, and there's no
  real basis yet for how often a given cycle actually runs.
- **OA-21/OA-22/OA-8**: "See my savings" now returns a real result
  instead of the old `501` stub. `GET /api/octopus/savings-result`
  reads the imported consumption + current-tariff rates
  (`octopusImports`), looks up the currently-on-sale Agile product for
  the user's region (`fetchActiveAgileTariffCode`), fetches Agile's
  rates for the same period, and runs
  `compareCurrentTariffToAgile` (`server/src/savingsComparison.js`).
  Response is explicitly flagged `unitRateOnly: true`. `SavingsPage`
  shows the headline (Agile cheaper / current tariff cheaper / about
  the same), the mandatory "unit rates only, no standing charge"
  caveat at equal visual weight, and an annualised projection only
  when there's an actual saving to project — wording follows
  `docs/SAVINGS_METHODOLOGY.md`'s final trust copy exactly, per
  Steve's sign-off.
- **OA-59**: Account, Connect Octopus and future authenticated pages now
  share one `OctopusConnectionProvider`
  (`src/octopus/OctopusConnectionContext.tsx`) instead of each fetching
  `/api/octopus/connection` independently — fixes Account always
  showing "connect your account" even when already connected. Also
  removed the duplicate Sign out button on the Account page (header nav
  already has one).
- **OA-58**: `/` now redirects a signed-in visitor to `/account`
  (`HomeRoute` in `src/App.tsx`) instead of always showing the
  signed-out marketing landing page with a "sign in" CTA.
- **OA-6**: real tariff + half-hourly consumption import is live.
  - `POST /api/octopus/import` fetches the last 30 days of half-hourly
    consumption (`fetchElectricityConsumption`, requires the user's own
    API key) and standard unit rates (`fetchTariffUnitRates`, public
    product data) for the connected meter/tariff, and stores both in a
    new Firestore collection `octopusImports`
    (`server/src/octopusImportStore.js`), keyed by Firebase UID.
  - `GET /api/octopus/import-status` returns a summary (point counts,
    period, `importedAt`) instead of the old `501` stub.
  - Connect Octopus page has an "Import my usage history" button once
    connected, showing the point counts/date range back.
  - 30-day window is deliberately small for this MVP — see Decisions.
  - `summarizeOctopusAccount` now also captures the meter
    `serialNumber` (needed for the consumption endpoint), stored
    alongside the existing `mpan`/`tariffCode` in each connection's
    `meterContext`.

- **OA-41**: running "saved so far" total, built to Steve's explicit
  model (showing a recommendation ≠ saving money):
  - `CheapestWindowPage` now asks "Did you run it at the recommended
    time? Yes / No" under any quantified recommendation
    (`result.recommendation.savingPence > 0`).
  - `POST /api/octopus/recommendation-confirm` records the event either
    way (`confirmed: true/false`) in a new Firestore-backed ledger
    (`server/src/savingsLedgerStore.js`, collection
    `savingsLedgerEvents/{uid}/events`), but only credits the saving
    (`creditedPence`) when `confirmed: true` — No or no answer credits
    £0, and is still recorded for a possible future
    projected-vs-actual view.
  - `GET /api/octopus/savings-total` sums `creditedPence` across all
    events → `{ savedSoFarPence, eventCount }`.
  - `SavingsPage` shows "Estimated saved so far: £X" independently of
    its own connect/import phase (a `SavedSoFar` component with its own
    fetch) — it reflects the ledger, not whether Octopus is currently
    connected.
  - Ledger events carry `source: 'manual'` today; the shape has room
    for a future `'automated'` source once device control (OA-12/15)
    can observe an actual run, without changing this endpoint's shape.
- **OA-55**: landing page (`src/pages/LandingPage.tsx`) now has a
  "Works with / Coming soon" section. **Works with** lists only what's
  actually been tested end-to-end in the beta today: Octopus Energy
  and manual appliance timers (presented as a real supported mode, not
  a fallback) — no smart plug or LG ThinQ listed, since no device
  integration exists yet (OA-12/15 deliberately not started). **Coming
  soon** names categories only ("Smart plugs", "More connected
  appliances"), no brand logos. A "Tell us what you have" link goes to
  OA-56's form.
- **OA-56**: new compatibility-request flow, two entry points —
  `LandingPage`'s "Tell us what you have" (signed-out) and
  `CheapestWindowPage`'s "Can't connect your appliance or device? Tell
  us the brand/model" (signed-in). Both open
  `CompatibilityFeedbackPage` (`/tell-us-what-you-have`, unprotected
  route since a signed-out visitor must reach it). `POST
  /api/compatibility-requests` is public (`optionalFirebaseAuth` —
  new middleware in `server/src/firebaseAuth.js` that attaches a uid
  if a valid token is present but never rejects an anonymous request),
  stores device type + optional brand/model/smart-plug/platform/note
  in a new Firestore collection `compatibilityRequests`
  (`server/src/compatibilityRequestStore.js`), one doc per submission.
  No admin UI for Steve to review submissions — see Decisions.
- **OA-57**: contextual "Was this recommendation useful? Yes / Not
  really / I couldn't do it" on `CheapestWindowPage`, shown under every
  cheapest-window result (not gated behind a £ recommendation, unlike
  OA-41's confirm block — this asks about the guidance itself). "Yes"
  submits immediately (one tap); a negative answer offers an optional
  short reason before sending. `POST /api/feedback` (always
  authenticated) stores events in a new Firestore collection
  `guidanceFeedback` (`server/src/guidanceFeedbackStore.js`),
  deliberately separate from OA-56's `compatibilityRequests` so
  guidance-quality feedback and compatibility/integration feedback are
  never mixed.
- **OA-62**: header brand is now a real mark, not text-only.
  `src/components/Logo.tsx` exports `LogoMark` (a simple bar-chart
  motif — a short, highlighted bar amid taller ones, i.e. a cheap
  price window amid expensive ones, the same idea `CheapestWindowPage`
  surfaces) and `BrandMark` (mark + "Shift & Save" wordmark + a small
  BETA pill), used in `App.tsx`'s header for both signed-in and
  signed-out states (one header, so "works in public and
  authenticated states" is automatic). `public/favicon.svg` replaced
  with a standalone version of the same mark on a solid accent-purple
  background. **Not done**: `public/pwa-192x192.png` and
  `pwa-512x512.png` (the PWA install icons) still show the old Vite
  default mark — regenerating proper raster icons from the new SVG
  needs an image rasterizer not set up in this repo; flagged rather
  than left silently inconsistent.
- **OA-61**: added "What is Shift & Save?" and "Who we are" sections
  to `LandingPage.tsx`, using the ticket's own suggested copy near-
  verbatim, placed per its suggested flow (How it works → What is
  Shift & Save? → Works with/Coming soon → Who we are → Trust). Trust
  section now follows Who we are rather than preceding Works with, so
  the independence statement lands twice (once in Who we are, once in
  Trust) — deliberate repetition, not a mistake, since both the
  ticket's own suggested copy and the existing trust strip state it.
- **OA-60**: `ConnectOctopusPage.tsx` now has a collapsible "Where do
  I find this?" control under each credential field (`CredentialHelp`
  component), with the exact numbered steps and links the ticket
  specifies (`octopus.energy/dashboard/` for the account number,
  `.../api-access/` for the API key), opening in a new tab so typed
  form state isn't lost. Helper copy under each field also matches the
  ticket's required wording ("Your account number starts with A-",
  etc). The ticket's screenshot/annotated-crop requirement was raised
  as a genuine gap (needs a real, logged-in Octopus dashboard to
  photograph, which only Steve has) — **Steve decided to drop it**
  ("don't worry about screenshots for now, we can live without
  them"), so OA-60 is Done on text/link guidance alone. If this comes
  up again later, the gap and what's needed are recorded in Jira
  comments on OA-60.
- **OA-45 + OA-25**: `server/src/tariffState.js` (new) classifies the
  customer's *current* tariff (`classifyTariffKind`: agile / go /
  intelligent_go / standard / unknown, from the product-code prefix)
  and whether they recently switched onto it (`determineTariffState`,
  using the agreement's `valid_from` — now captured as
  `tariffValidFrom` in `summarizeOctopusAccount`,
  `server/src/octopusClient.js`). `comparisonMethodForTariffKind`
  returns `'bounded_estimate'` only for `intelligent_go` (its
  personalised smart-charge bonus windows can't be reconstructed from
  public rates — OA-25) and `'exact'` for everything else. Both
  attached to `GET /savings-result` as `tariffState`.
  `SavingsPage.tsx` now says "You're on X" in plain English; when the
  *current* tariff is already Agile, the headline switches to "latest
  Agile pricing vs. your current Agile agreement" framing instead of
  the nonsensical "switch to Agile and save" copy; a recently-switched
  caveat appears when `recentlySwitched`; a bounded-estimate caveat
  appears when `comparisonMethod === 'bounded_estimate'`. Go/
  Intelligent Go product-code prefixes (`'GO-'`, `'INTELLI'`) are a
  best-effort pattern match, **not yet confirmed against a real
  account on either tariff** — flagged below like
  `fetchActiveAgileTariffCode` was before Steve verified it.
- **OA-24**: `server/src/tariffEligibility.js` (new) — eligibility
  metadata keyed by product-code prefix, kept in one sourceable place
  rather than scattered through routes/UI (the ticket's own
  requirement). Since OA-22 only ever compares against Agile, which
  has no eligibility requirement, `eligibilityForTariffCode` returns
  `eligible` for every real user today; `scenario_only` entries for
  Go/Intelligent Go exist so a future comparison against them has
  somewhere to declare "requires an EV" rather than being silently
  treated as eligible by omission. Attached to `/savings-result` as
  `eligibility`; `SavingsPage` shows "Available to you." beneath the
  headline.
- **OA-23 + OA-7**: `/savings-result` now accepts the same optional
  `durationMinutes`/`energyKwh` pair `/cheapest-window` already does,
  and when given, computes a `shiftingOpportunity` figure — reusing
  `findCheapestWindow`/`averageRate` (`cheapestWindow.js`, built for
  OA-9) over the *already-imported historical* current-tariff rates
  instead of a future Agile window. This is the second, clearly
  separate layer OA-7 asked for: tariff-fit (`estimatedSavingPence`)
  reprices the same usage at the same times; `shiftingOpportunity`
  models moving one appliance cycle to the historically-cheapest slot
  instead, always per-cycle and labelled `unitRateOnly: true` — never
  summed into the tariff-fit number. `SavingsPage` adds a "Shifting
  opportunity" section below the main result, with its own appliance
  picker (same `DEFAULT_APPLIANCE_PROFILES` as `CheapestWindowPage`)
  and its own fetch, so it can be modest/collapsible without blocking
  the main result's load.
- **OA-32**: `POST /recommendation-confirm` now accepts an optional
  `energyKwh` (the frontend already has it on `result.recommendation`
  from OA-40) and, only when `confirmed: true`, makes a best-effort
  check of whether whole-house consumption during the recorded window
  is at least roughly consistent with the appliance having run
  (`checkMeterConsistency` in `server/src/routes/octopus.js`: sums
  actual consumption for the window, compares against
  `energyKwh * 0.6` as a loose floor). Result is one of `'consistent'
  | 'inconsistent' | 'unknown'` — `'unknown'` whenever there's no
  connection, no `energyKwh` given, or Octopus has no reading yet for
  the window (half-hourly data commonly lags about a day). Per the
  ticket's own rule, this **never changes `creditedPence`** — self-
  report via `confirmed` remains the only thing that credits a saving;
  the meter check only attaches a confidence label, and whole-house
  data is never treated as device-level proof. `GET /savings-total`
  now also returns `consistentCount`. No UI surfaces this yet — not
  required by OA-32's acceptance criteria (it asks for the data to be
  capturable for Gate 5 metrics, not a UI), and the running total's
  copy is already dense; a judgment call to leave out until there's a
  concrete reason to show it.
- **OA-46**: `src/format.ts`'s new `formatSavingsEquivalent(pence)` —
  a single, clearly-labelled illustrative unit (a £3.50 "coffee"),
  deterministic, returning `null` (not "about 0 coffees") for zero or
  anything under one unit. `SavedSoFar` on `SavingsPage` renders it as
  a visually secondary suffix next to the £ figure — "Estimated saved
  so far: £63.40 — about 18 coffees" — never replacing or outweighing
  the £ amount. 6 new frontend unit tests
  (`src/format.test.ts`).
- **OA-63**: `/import` and `/import-status` now return an explicit
  `status: 'not_imported' | 'success' | 'no_data' | 'partial'`
  (`importStatusFromCounts` in `server/src/routes/octopus.js`), derived
  from actual persisted consumption/rate counts — never `imported:
  true` alone meaning "a request completed" regardless of whether
  Octopus returned anything usable. `periodFrom`/`periodTo` are
  omitted (no "covering X to Y" claim) whenever `status === 'no_data'`.
  `ConnectOctopusPage`'s new `ImportStatusMessage` renders genuinely
  different copy for each status, including which half is missing for
  `partial`. Root cause of *why* a real account might get zero/partial
  data wasn't fully diagnosable from this sandbox (no live Octopus
  access) — see Decisions for the one concrete related fix made
  (import/export meter-point selection) and OA-69 below for the tariff
  angle.
- **OA-64**: "Re-import appeared to do nothing" turned out to most
  likely be a side effect of OA-63 — when both counts are zero both
  before and after, the old copy was identical pre/post-click, so a
  real click looked like a no-op. Fixed by (a) always rendering `Last
  checked: <timestamp>` from `importedAt`, which changes on every
  click regardless of the data outcome, and (b) the status-specific
  copy from OA-63 itself changing wording whenever the actual outcome
  differs. Reviewed the click→request→state-update path end to end;
  found no wiring bug (handler attached, button disabled while
  `importing`, errors surfaced, state always updated from the
  response) — nothing else to fix there without a live reproduction.
- **OA-68 + OA-69**: built as one piece of work — OA-69's canonical
  model supersedes OA-68's narrower fix rather than duplicating
  classification logic twice. New `server/src/tariffClassification.js`
  is now **the one place** a raw Octopus tariff code becomes a family
  (`agile`/`go`/`intelligent_go`/`outgoing`/`dual_rate`/`flexible`/
  `fixed`/`unknown`) — `tariffState.js`, `tariffEligibility.js`, and
  both `/savings-result` and `/cheapest-window` all consume it rather
  than independently parsing a code string (OA-69's explicit
  requirement). Classification order: (1) confident prefix matches
  (`AGILE`, `INTELLI`, `OUTGOING`/`SEG`, `GO`, checked in that order so
  Intelligent Go's code never gets caught by the plainer `GO` match),
  (2) the tariff code's own rate-type segment (`E-2R-` = dual-rate,
  e.g. Economy 7-style — an authoritative signal from Octopus's own
  code structure, not a guess), (3) a fallback to Octopus's own
  product data (`fetchProductDetails`, new in `octopusClient.js`,
  reads `is_variable` to decide `flexible` vs `fixed`) — **only** this
  authoritative signal, never the product code's naming, decides
  `flexible`/`fixed`. Anything that reaches none of these becomes
  `unknown`, with the raw code preserved for diagnosis — never
  silently `standard` or `agile` (OA-69's explicit fail-safe rule,
  and the direct fix for OA-68's reported bug). Documented fixture
  matrix: `server/test/fixtures/tariffCodes.js` +
  `server/test/tariffClassification.test.js`. `displayName` now comes
  from this one module too — `SavingsPage`'s "You're on X" line reads
  it directly rather than keeping its own client-side label map.
- **OA-66 + OA-67**: `/cheapest-window` rebuilt as tariff-aware and
  future-only, in that order since they're independent fixes to the
  same handler. Tariff-aware: fetches the customer's **own** current
  tariff code's published rates (via the canonical classification
  above) instead of always calling `fetchActiveAgileTariffCode` — a
  Go or Intelligent Go customer now gets a recommendation computed on
  their own tariff's rates, never an Agile-derived one; `unknown`
  tariffs get `{found: false, reason: 'unsupported_tariff'}` rather
  than a fabricated answer; genuinely flat tariffs (`isFlatRate`, ≥2
  rates all equal — a single remaining late-night slot is never
  "flat") get `{found: false, reason: 'flat_rate'}` instead of an
  arbitrary "cheapest" half-hour. Future-only: `excludeElapsedSlots`
  filters out any rate whose `validTo` has already passed before the
  cheapest-window search runs, so a window can never be chosen whose
  start has already gone; `canStartNow: true` on the response when the
  chosen window begins with the current half-hour; `{found: false,
  reason: 'tomorrow_not_published'}` when the shortfall against the
  full 48h lookahead suggests tomorrow's rates aren't out yet, vs.
  `'no_window_available'` when they are and nothing still fits.
  `CheapestWindowPage` now shows "Start now" copy when `canStartNow`,
  a bounded-estimate caveat for Intelligent Go-style tariffs, and
  reason-specific copy for every unavailable state. Also added a
  5-minute background refetch on that page — the live-beta report
  ("recommended a window that had already passed by 23:30") most
  likely came from a stale fetch sitting in an open tab rather than a
  bad computation at request time (the route always computes "now"
  fresh per request), so this closes that gap regardless of the exact
  mechanism. New dedicated test file
  (`server/test/cheapestWindowRoute.test.js`) with wall-clock-anchored
  fixtures, since the existing `octopus.test.js` fixtures use fixed
  historical dates that `excludeElapsedSlots` would always treat as
  elapsed.

## Next step

1. ~~fetchActiveAgileTariffCode never run against the real Octopus
   API~~ — **confirmed working by Steve against the real API**
   (2026-10-02). The unverified-assumption risk flagged below is
   cleared.
2. PR #14 (OA-59 through OA-57, 9 commits) **merged to `main`**
   (`995bdea`), triggering `deploy-server.yml` and `deploy-beta.yml`.
   Manually spot-check the full chain live on beta once that deploy
   finishes: connect → import → "See my savings" shows a real, sane £
   figure with the caveat visible; Cheapest Times shows a real
   upcoming window *and* a real per-cycle £ saving for at least one
   appliance once usage is imported; confirming "Yes" on it updates
   the saved-so-far total on My Savings; the "Was this useful?" and
   "Tell us what you have" flows submit successfully; Account page
   reflects real connection state after a refresh; `/` redirects when
   signed in.
3. Everything on the original roadmap through OA-57 is now built and
   merged to `main`.
4. **Backlog audit (2026-10-02)**: many Jira tickets predating this
   session were still "To Do"/"In Progress" despite being satisfied by
   the current app. Verified each against actual code/config before
   transitioning (not just taken on trust):
   - **Moved to Done**: OA-4 (app shell), OA-37 (landing/connect
     copy), OA-47 (CI/cloud-ready — `.github/workflows/ci.yml` runs
     lint+build+bundle-check+test for web and test+health-check for
     server), OA-48 (Firebase integration), OA-53 (My Savings gated
     behind auth — `ProtectedRoute`). OA-54 (landing page
     proposition) needed one real fix first — its explainer link read
     "What is Octopus Agile?" instead of the required "How dynamic
     tariffs work" — fixed and pushed, then marked Done.
   - **Left as To Do — genuinely incomplete**, not just unverified:
     OA-10 (My Savings view has the tariff-fit/shifting split now via
     OA-23, but still lacks appliance-level breakdown across *all*
     appliances at once and the explicit "still best, no action
     needed" framing the ticket wants), OA-18 (provider-neutral auth
     abstraction — code is Octopus-specific throughout), OA-20
     (privacy baseline — encryption/no-logging done, but no account-
     deletion flow, consent recording, or documented retention rules),
     OA-39 (onboarding — no insufficient-data state, no time-to-
     first-saving instrumentation). OA-7 moved to Done later this
     session once OA-23 actually built its missing half — see below.
   - **Left alone — epics, not individually verifiable**: OA-1, OA-2,
     OA-3, OA-33, OA-34, OA-35. Epic closure is a reporting decision,
     not something to infer from code; flagged for Steve rather than
     auto-closed.
   - Did **not** audit the full remaining backlog (OA-11 through
     OA-32 and beyond) beyond the handful needed to answer "what's
     next" — only spot-checked tickets that looked plausibly stale.
     A fuller audit is possible if useful later.
5. Polish tier (OA-60/61/62) merged via PR #15 (`1b0bb2b`).
6. Deeper feature tier OA-45/25/24/23/7/32 merged via PR #16
   (`6f45343`); OA-46 merged via PR #17 (`23d40b0`). All Done in
   Jira. **OA-44 deliberately skipped** — its own ticket marks it
   post-MVP; do not start it without Steve's go-ahead.
6a. **What's genuinely left in the backlog** (from the audit, not
   yet built — see Decisions): OA-10 (My Savings needs appliance-
   level breakdown across *all* appliances at once, plus explicit
   "still best, no action needed" framing), OA-18 (provider-neutral
   auth abstraction), OA-20 (account-deletion flow, consent
   recording, documented retention rules), OA-39 (insufficient-data
   onboarding state, time-to-first-saving instrumentation). None of
   these were explicitly requested this session — worth raising with
   Steve before picking one, since they're backlog finds, not part of
   the roadmap he actually gave.
6b. Epics OA-1, OA-2, OA-3, OA-33, OA-34, OA-35 were deliberately left
   untouched during the audit (see Decisions) — still worth a nudge to
   Steve that they exist and may be ready to close given how much of
   the MVP roadmap is now done.
6c. The rest of the Jira backlog beyond what's been touched this
   session (most of OA-11 through OA-32, and anything past OA-62)
   has **not** been audited — only tickets that looked plausibly
   stale or were explicitly named were checked.
7. Before relying on OA-45's Go/Intelligent Go detection in anger:
   `classifyTariffKind` (`server/src/tariffState.js`)'s `'GO-'` and
   `'INTELLI'` prefix matches are a best-effort guess at Octopus's
   real product-code naming, **not yet confirmed against a real Go or
   Intelligent Go account** — same category of risk
   `fetchActiveAgileTariffCode` carried before Steve verified it
   against the real API. Low urgency while this app only has
   Agile/standard-tariff beta users, but flag it before leaning on it
   for a Go/Intelligent Go customer.
8. Device control (OA-12/OA-15) remains explicitly **not** to be
   started without Steve's go-ahead.
8. Update README.md's "Server deployment (Cloud Run)" checklist to match
   the real working IAM configuration (listed below) — currently stale,
   purely a documentation cleanup, no urgency.
9. **Mop-up cluster (OA-63/64/68/69/66/67) merged via PR #18
   (`1aa273e`), all Done in Jira.** Still needs a live-beta check once
   deployed: connect an account on a non-Agile tariff if possible (or
   at least re-check the existing Agile beta account), confirm "You're
   on X" is correct, confirm Cheapest Times no longer defaults to
   Agile for a non-Agile tariff, and check the import card's new
   per-status copy against a real import.
10. **OA-65 (Today/Tomorrow schedule + heat map) is a new, large
    product surface and hasn't been started.** Steve's framing: build
    it only once the tariff/import foundation (this mop-up batch) is
    trusted — check in before starting, since it's a genuinely new UI
    surface (retiring the standalone Cheapest Times page from primary
    navigation), not a bug fix.
11. **Go/Intelligent Go classification is still unverified against a
    real account** (`classifyTariffKind`'s prefix guesses in
    `tariffClassification.js`) — same category of risk
    `fetchActiveAgileTariffCode` carried before Steve verified it. If
    Steve has (or can get) a real Go/Intelligent Go account's raw
    `tariff_code`, confirming it against the fixture matrix would
    retire this risk the same way Agile's was retired.
12. OA-63's root cause (why a real account might see zero/partial
    import data) was only partially diagnosable without live Octopus
    access. One concrete, real bug was found and fixed along the way
    (import/export meter-point selection — see Decisions); if zero/
    partial imports persist on beta after this batch, the next place
    to look is whether the connected agreement's `tariff_code` itself
    only recently changed (a tariff-rate lookup for a brand-new
    agreement can legitimately return less data for the start of the
    30-day window than for a long-standing one).

## Key references

- `server/src/octopusStore.js` — `createFirestoreOctopusStore()`,
  `{ upsert, get, remove }` keyed by Firebase UID.
- `server/Dockerfile` / `server/.dockerignore` — explicit Docker build
  (PR #13), kept as a strict improvement over auto-detected Buildpacks.
- `.github/workflows/deploy-server.yml` — Cloud Run deploy, gated on
  `npm test` in `server/`, triggered on `server/**` changes to `main`.
- `.github/workflows/deploy-beta.yml` — Firebase Hosting deploy,
  triggered on every push to `main` (no path filter).
- `firebase.json` — `/api/**` rewrite to the `energy-saving-server`
  Cloud Run service (`europe-west2`).
- Beta URL: `https://shiftandsaveapp.web.app` (Connect Octopus at
  `/connect-octopus`, behind Firebase auth).
- Direct Cloud Run URL (not normally used directly):
  `https://energy-saving-server-zz3rxj7nfq-nw.a.run.app`.
- Successful deploy run: 36991131641, attempt 7 (server) /
  37005667196 (Hosting).

## Decisions

- OA-70: used the dataviz skill's pre-validated default sequential blue
  ramp for the heat map's rate colour scale, rather than deriving and
  validating a new ramp matching the app's purple `--accent` brand
  colour — the blue ramp is already proven accessible (CVD/contrast),
  and inventing+validating a custom ramp was out of scope for this
  pass. Revisit if brand consistency becomes a priority later; it's a
  palette-constant swap plus a re-run of `validate_palette.js`, not a
  structural change.
- OA-70: dual-magnitude encoding (rate = one sequential hue via cell
  background; usage = bar height, never a second hue) chosen to satisfy
  both the product requirement (background=rate, foreground=usage) and
  the dataviz skill's "never two magnitudes on one channel" rule
  simultaneously, rather than treating them as competing constraints.
- OA-71/OA-72: `/like-for-like`'s comparison tariff can only be
  auto-resolved for the Agile family (`comparisonFamily=agile`, reusing
  OA-22's region lookup) — any other comparison tariff must be supplied
  as an explicit, already region-qualified Octopus tariff code, rather
  than guessing other families' "currently on sale" product-code
  conventions, which `tariffClassification.js` itself documents as
  unconfirmed for anything but Agile. `/compare`'s UI reflects this: one
  Agile button plus a free-text tariff-code field, not a dropdown of
  every family.
- OA-74: left `/actual` and `/compare` as their own standalone nav
  items/routes alongside My Savings now embedding the same two
  components, rather than collapsing them into My Savings only — they
  remain useful as direct, shareable deep links, and the ticket only
  asked for Cheapest Times' retirement and My Savings' content, not a
  nav redesign of OA-71/72's own entries. Revisit if three nav items
  showing overlapping content starts to read as cluttered.
- OA-74: `applianceProfile.ts` (and its test) is now unused by any page
  (both its consumers — CheapestWindowPage and My Savings' shifting
  selector — were retired) but deliberately kept rather than deleted:
  it's named in Steve's roadmap as the basis for the upcoming
  "appliances/household setup" step and OA-73's evidence hierarchy
  already builds on its `DataSource` tiers.
- OA-69: resolved OA-68 by building the canonical model OA-69 asked
  for directly, rather than patching the narrower bug first and
  rebuilding it properly second — the two tickets are the same piece
  of code either way, and doing it once avoids a throwaway
  intermediate version.
- OA-68/OA-69: classification never guesses `flexible`/`fixed` from a
  product code's naming — only Octopus's own `is_variable` product
  flag decides that, via a new `fetchProductDetails` call. This is
  slower (one extra network round-trip) than string-matching, but
  string-matching *is* the bug this ticket exists to fix, so a
  marginally slower, authoritative signal was the right trade.
- OA-68/OA-69: `E-2R-` (the tariff code's own rate-type segment) is
  trusted as an authoritative dual-rate signal, ahead of the
  Octopus-product-data fallback — it's part of Octopus's documented
  tariff code structure, not a guess about product naming, so it's
  checked before paying for a network round-trip.
- OA-63: fixed `summarizeOctopusAccount` to prefer a meter point where
  `is_export` is falsy, rather than always taking
  `electricity_meter_points[0]` — a household with solar export could
  have more than one electricity meter point, and picking the wrong
  one would explain a connected account with a technically-valid but
  wrong mpan/tariff. Found while investigating OA-63/69 together;
  real but unconfirmed without a live multi-meter-point account to
  test against.
- OA-66/OA-67: no "what if I were on Agile" scenario comparison was
  built for `/cheapest-window` — the ticket allows it as a distinct,
  clearly-labelled mode, but doesn't require it, and the actual
  reported bug was Agile being used as a silent *default*, which
  removing fixes on its own. Revisit only if Steve specifically wants
  the scenario view.
- OA-67: added a 5-minute client-side refetch on `CheapestWindowPage`
  rather than only trusting the backend to always return a live
  window — the backend already computes "now" fresh per request, so
  the most likely real explanation for a visibly-elapsed recommendation
  is a stale fetch sitting in an open tab, not a computation bug. Fixed
  both ends rather than assuming which one was responsible.
- OA-23/OA-7: implemented "shifting opportunity" by reusing OA-9's
  `findCheapestWindow`/`averageRate` over historical rates instead of
  building a parallel optimiser — the maths for "cheapest slot vs.
  average rate for one cycle" is identical whether the rates are
  forward-looking (Agile, next 48h) or backward-looking (current
  tariff, already-imported period); only the data fed in differs.
  Avoids two near-duplicate implementations of the same core idea.
- OA-23: deliberately per-cycle, not an aggregate across the whole
  import period or a frequency-based annual projection — same
  rationale as OA-40's decision: no real data exists yet on how often
  a given appliance actually runs, so aggregating would mean
  inventing a frequency assumption rather than reading one.
- OA-45/OA-25: chose prefix-matching on the tariff's product code
  (`'AGILE'`, `'GO-'`, `'INTELLI'`) over a lookup table, matching the
  existing `productCodeFromTariffCode`/`regionLetterFromTariffCode`
  style already in `octopusClient.js` rather than introducing a new
  pattern. Go/Intelligent Go prefixes are unverified against a real
  account — see Next step.
- OA-32: meter-consistency check runs synchronously inside
  `POST /recommendation-confirm` (best-effort, swallows failures to
  `'unknown'`) rather than as a background job — there's no job
  infrastructure in this app, and the check is cheap (one consumption
  fetch for a half-hour-to-few-hour window). If Octopus's data lag
  means the window's reading usually isn't available yet at confirm
  time, this will mostly report `'unknown'` in practice; a delayed/
  retry check would need a scheduler this app doesn't have, and
  wasn't worth building for a label that doesn't change `creditedPence`
  anyway.
- Firestore chosen (over e.g. Cloud SQL) — already inside the
  `shiftandsaveapp` Firebase project.
- `europe-west2` (London) chosen as the Cloud Run region.
- Kept the Dockerfile switch (PR #13) even after ruling out
  native-module compilation as the actual deploy blocker.
- Old SQLite `users`/`sessions`/`consents` tables and `server/src/db.js`
  itself left in place untouched — dead code since OA-50, unrelated
  cleanup not in scope here.
- OA-6: import window fixed at 30 days (`IMPORT_WINDOW_DAYS` in
  `server/src/routes/octopus.js`), not full history. Keeps each import
  request fast and each `octopusImports` Firestore doc well under the
  1MiB document limit (30 days half-hourly ≈ 1,440 points per series).
  Revisit once Steve has reviewed real imported data — a longer window
  may need chunked/paginated storage rather than one doc per user.
- OA-6: the Cloud Run runtime service account already has "Cloud
  Datastore User", which covers the new `octopusImports` collection too
  — no IAM change needed for this feature.
- OA-22: scoped to current-tariff-vs-Agile only (Steve's explicit
  instruction — not every Octopus tariff). Unit rates only, no standing
  charge, over whatever window OA-6 imported — see
  `docs/SAVINGS_METHODOLOGY.md` for the full scope statement and why.
- OA-21: drafted the methodology/trust copy myself rather than waiting,
  since it's cheap to draft and expensive to block on. Steve then
  answered all three open questions (unit-rate-only OK, 30 days OK,
  trust copy needed more explicit in-line caveats) — recorded as
  Decisions in `docs/SAVINGS_METHODOLOGY.md`, which now carries his
  sign-off date. The result shape is deliberately labelled
  `unitRateOnly: true` so adding standing charges later is an upgrade
  to this same shape, not a silent meaning change (Steve's instruction).
- OA-8: annualised saving is only shown when Agile would have been
  cheaper (`estimatedSavingPence > 0`) — projecting an annualised
  *negative* saving read oddly, so when the current tariff is already
  cheaper, the headline alone carries the message, no annualised line.
- OA-9/OA-31: cheapest-window search takes `durationMinutes` as a
  request param from the frontend (which owns the appliance catalog)
  rather than duplicating appliance durations server-side — the server
  stays generic to "any duration", not appliance-aware. Lookahead
  fixed at 48h, matching Agile's today+tomorrow publication pattern.
  `{found: false}` (not an error) when no long-enough contiguous
  window exists yet, e.g. before tomorrow's prices are out.
- OA-30: the appliance profile domain model
  (`src/domain/applianceProfile.ts`) already existed from an earlier
  session, fully tested, but had no consumer anywhere in the app until
  `CheapestWindowPage` (OA-31) this session. Left its generic-default
  values as-is — not real research, just reasonable UK household
  averages, and the model already flags them as estimates via
  `isEstimate`/`DataSource`.
- OA-40: deliberately per-cycle, not annualised like OA-8's result —
  there's no real basis for how often a user actually runs a given
  appliance, so annualising it would be inventing a frequency
  assumption rather than reading one from data. If OA-41 or a later
  ticket wants an annual figure here, that needs its own explicit
  frequency input (e.g. "how many times a week"), not a guess.
- OA-55: deliberately listed only Octopus Energy and manual appliance
  timers under "Works with" — the ticket's own example text names a
  smart plug and LG ThinQ, but those are illustrative, not a
  requirement, and the explicit rule ("only list a brand/product after
  it's been tested end to end in the beta") rules them out since no
  device integration exists yet. "Coming soon" names categories only,
  per the ticket's own "no specific brand logos unless genuinely
  underway" rule.
- OA-56: no admin UI was built for Steve to review compatibility
  requests — there's no admin-auth concept anywhere in this app yet,
  and building one just to list form submissions would be a bigger
  change than the ticket's own scope. Steve inspects/exports via the
  Firestore console (`compatibilityRequests` collection) directly,
  same pattern as other operational tasks in this project. Revisit
  only if that becomes impractical at real beta volume.
- OA-56: added `optionalFirebaseAuth` (`server/src/firebaseAuth.js`)
  rather than reusing `requireFirebaseAuth`, since this is the first
  endpoint a signed-out visitor must be able to call — an invalid or
  expired token is treated as anonymous, not rejected, since the
  alternative (reject the whole submission over a stale token) is
  worse than just not attributing it to a user.
- OA-57: kept guidance feedback (`guidanceFeedback`) and compatibility
  requests (`compatibilityRequests`) as separate Firestore collections
  and separate endpoints, rather than one generic "feedback" shape —
  directly satisfies the ticket's own acceptance criterion that
  guidance-quality feedback must be distinguishable from
  compatibility/integration feedback, and the two have genuinely
  different fields (brand/model vs. response/comment).
- Extracted `src/format.ts` (`formatGbp`) once the exact same pence→£
  formatter appeared in both `SavingsPage` and `CheapestWindowPage` —
  real duplication, not speculative, so worth the shared module.
- OA-41: used Steve's exact model (his words, 2026-10-02): "Did you run
  it at the recommended time? Yes/No. Yes credits the per-cycle saving
  to Estimated saved so far; No or no answer credits £0. Showing
  someone an opportunity is not the same as saving them money." Ledger
  stored as a Firestore subcollection per user (`savingsLedgerEvents/
  {uid}/events`), not a single growing doc like `octopusImports` —
  events accumulate indefinitely over a user's lifetime, unlike a
  30-day import window, so a single-doc model would eventually hit
  Firestore's 1MiB document limit. `source: 'manual'` on every event
  today, specifically so OA-12/15's later device control can write
  `'automated'` events through the same ledger/endpoint shape.

## Constraints and preferences

- **Standing rule (2026-10-02): when a ticket is implemented, tested,
  and pushed, transition it to Done in Jira immediately** — don't wait
  to be asked. Caught up the backlog this session: OA-59, OA-58, OA-6,
  OA-21, OA-22, OA-8, OA-9, OA-30, OA-31 all moved To Do/In Progress →
  Done (OA-40/OA-43 were already Done, moved by Steve directly).
- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` lives in Secret Manager only, mounted at deploy time
  via `--set-secrets` — generated and entered by Steve directly into
  Secret Manager, never shared in chat.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes — **cleared 2026-10-02**; any
  £ figure shown must still carry the unit-rate-only caveat at equal
  visual weight (Steve's explicit instruction, not just a docs note).
- GCP console/CLI changes always need Steve — this session has no GCP
  credentials.

## Gotchas

- **Full IAM/config fix list from this session** (the real working
  configuration — README.md's "Server deployment (Cloud Run)" checklist
  predates this and needs updating to match, not yet done):
  - `github-deploy@shiftandsaveapp.iam.gserviceaccount.com`: Artifact
    Registry Administrator, Cloud Build Editor, Cloud Run Admin,
    Service Account User, Storage Admin.
  - `firebase-adminsdk-fbsvc@shiftandsaveapp.iam.gserviceaccount.com`:
    Cloud Run Viewer.
  - `energy-saving-server-runtime@shiftandsaveapp.iam.gserviceaccount.com`
    (Cloud Run service's runtime identity): Cloud Datastore User, Secret
    Manager Secret Accessor.
  - Default Compute Engine SA
    (`761386319734-compute@developer.gserviceaccount.com`): Storage
    Object Viewer, Logs Writer, Secret Manager Secret Accessor, Cloud
    Datastore User, Artifact Registry Writer.
  - **Root cause of the long "Build failed" opacity**: GCP Console →
    Cloud Build → Permissions page lets a project select which service
    account Cloud Build uses to execute builds. This project had it set
    to the **default Compute Engine SA**, not the conventional Cloud
    Build default SA (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`)
    — so earlier grants to the latter had no effect on the actual
    builder identity. Fixed by enabling "Artifact Registry Writer"
    directly on that Permissions page for the compute SA. If a future
    Cloud Build/Cloud Run deploy in this project mysteriously fails on
    permissions again, check that page first.
  - Secret Manager API was disabled for the project — enabled via
    console.
  - `ENCRYPTION_KEY` secret didn't exist in Secret Manager — created by
    Steve.
- `server/src/firebaseAuth.js`'s no-service-account token verification
  is now verified against real traffic (Steve's live test above).
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction still applies.
- Don't commit the beta test account's password, any Octopus API key,
  or the production `ENCRYPTION_KEY` anywhere in this repo.
