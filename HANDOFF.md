# HANDOFF

_Last updated: 2026-10-03 (OA-86, second pass: Steve supplied the actual
reference mockup after the first "no code change needed" audit --
found and fixed two real gaps that audit missed; see "Current task"
below. Previous entries:)_

_2026-10-03, first pass (superseded below): OA-86 audited and closed as
already-satisfied by OA-85 -- no code change needed._

_2026-10-02 (core loop via PR #14; backlog audit +
polish tier via PR #15; deeper feature tier via PR #16/#17; beta
mop-up cluster OA-63/64/68/69/66/67 merged via PR #18; revised build
order OA-70/71/72/74 merged via PR #19/#20/#21/#22, all Done in Jira;
OA-75 and OA-76 built, gap-closed against their actual Jira acceptance
criteria, and transitioned to Done; OA-81 (household appliance setup)
created by Steve directly in Jira and built this session; all three
merged to `main` via PR #26 and deployed to prod (Deploy server +
Deploy beta both green); OA-82 (public landing page prerendering, also
expanded mid-session into automation-friendliness -- see below), OA-83
(recomposed landing-page comparison, in two passes -- see below) and
OA-85 (restored the original graph mechanism on top of OA-83's tighter
layout -- see below) all built this session and merged/deployed to
prod; OA-84 (verify/harden for external browser automation) created by
Steve but not yet started -- largely expected to already be satisfied
by OA-82's work, pending its own audit pass; OA-65 not started)_

## Current task (latest)

**OA-86** ("Restore original multi-day heat map inside the tighter
comparison layout") -- first pass (see superseded entry above) audited
the ticket's written acceptance criteria against the existing OA-85 code
and found them already satisfied, so no code changed. Steve then
expanded the ticket with an explicit reference implementation
(`shift_save_landing_page(1).html`, a Tailwind/vanilla-JS mockup) and
asked specifically whether the *live component preserves the reference's
exact visual-state mechanism*, not just whether the written bullets
pass -- a materially different, stricter question. Jira's media-upload
endpoint wasn't reachable from the ticket-filer's own sandbox, so the
reference arrived as literal code fragments in a Jira comment first,
then as the actual `.html` file pasted directly into this session.

Diffing the real file against `HeatMap.tsx`/`heatMapMath.ts`/
`LandingDemo.tsx` line-by-line (not the bullet bullets this time) found
two real gaps the first pass's acceptance-criteria-only audit missed:

1. **The CSS transition was dead code for step-to-step changes.**
   `LandingDemo.tsx`'s `.landing-demo__grid` had `key={step}`, which
   remounts that entire subtree -- heat map included -- on every step
   switch. React mounts fresh DOM nodes with their final style already
   applied; there is no previous value for `transition:
   background-color/opacity` to interpolate from, so despite the CSS
   existing and being unit-tested for presence, switching steps in a
   real browser would just snap instantly rather than cross-fade. This
   is exactly what the reference's `applyState()` avoids: it builds the
   336 cells *once* and only ever mutates their `style.backgroundColor`/
   `style.opacity` afterwards, so the browser has something to animate
   between. Earlier sessions' "transition exists and is guarded by
   prefers-reduced-motion" verification (OA-85 HANDOFF entry below) was
   true of the CSS but never checked that it would actually fire --
   jsdom tests don't render paint/transitions, and the one real-browser
   verification attempt was abandoned as infeasible in this sandbox (see
   OA-82 update below), so this slipped through twice.
   - Fix: moved `key={step}` off `.landing-demo__grid` and onto
     `.landing-demo__story` alone (LandingDemo.tsx/.css) -- the text
     panel still remounts and replays its own OA-80 fade/slide on every
     step, but `<HeatMap>` now stays mounted across all three steps.
     Each day/slot shares the same `date`/`startsAt` across
     Baseline/Compare/Optimise (only colour/opacity differ --
     landingDemoFixture.ts), and those are HeatMap's own React keys, so
     React updates the *same* cell DOM nodes in place instead of
     replacing them -- which is what lets the existing CSS transition
     finally do real work.
2. **No peak-window overlay.** The reference highlights the actual
   expensive time band with a translucent, non-interactive band (hidden
   on Baseline, shown on Compare/Optimise) -- present in the ticket's
   own "Peak overlay" section, though not literally one of the bulleted
   acceptance criteria, which is likely why the first pass didn't flag
   its absence. The reference hard-codes its band position (16:00-19:00)
   to its own one example Agile shape; the ticket explicitly says not to
   port that literally and to derive it from the current demo data
   instead.
   - Fix: added `findPeakWindow` (`heatMapMath.ts`) -- the longest run
     of consecutive peak-band (`rateCategoryIndex === 2`) slots in a
     representative day, returning `null` for a flat tariff (so it's
     naturally absent on Baseline with zero per-step special-casing,
     not a toggle). `HeatMap.tsx` renders it as a grid-placed, `aria-
     hidden`, `pointer-events: none` overlay spanning those columns in
     each day row (`HeatMap.css`'s `.heat-map__peak-overlay`, tariff-
     variant only), plus a compact "Peak HH:MM-HH:MM" suffix on the
     existing (already-demoted) legend note -- no new prominent UI.
   - New unit tests for `findPeakWindow` in `heatMapMath.test.ts`
     (longest-run selection, flat-tariff null case, undefined-day case).

Everything else audited in the first pass (layout, state-conservation
rules, demoted table/detail chrome, 48×4 grid, deterministic fixture,
no hard-coded Agile band in the *colour* logic -- that part was already
data-derived) still holds; this pass only added the overlay and fixed
the transition's actual mechanism.

Verified: `npm test` (51/51, up from 48), `npm run lint` (clean, same
pre-existing unrelated warnings), `npm run build`/`check-bundle` (pass),
confirmed via `dist/index.html` that the prerendered Baseline state
still has 192 (`4x48`) cells and -- correctly -- zero peak-overlay
elements (flat tariff, no peak band), and an ad hoc spot-check against
the real `buildLandingDemoFixture()` output confirming `findPeakWindow`
returns `null` for Baseline and a real window for Compare/Optimise.
Pushed to `claude/zen-archimedes-26lz8o`. Commented on OA-86 in Jira
with this diff and left it Done (code now matches the stricter
reference-fidelity question, not just the bulleted criteria); flagged
in the comment that genuine cross-step visual smoothness still hasn't
been confirmed in a real browser (same sandbox limitation as OA-82/85)
and remains the one unverified acceptance item ("Stable beta deploy
verified").

## Previous task

**OA-85** ("Keep tighter comparison layout but restore original
heat-map mechanism") -- Steve's follow-up to OA-83: keep the second
pass's tighter composition (narrative-left/visual-right, no pill
chrome, compact control) but restore the *original mockup's* graph
mechanism, which OA-83's compression pass had drifted away from:

- **Colour = tariff price band, opacity = usage** (not OA-70's single-
  hue sequential ramp + bar-height, which is the right default for the
  authenticated Actual/Compare/Optimised charts but was never the
  landing page's own visual language). Added a `variant?: 'sequential'
  | 'tariff'` prop to the shared `HeatMap` component (default
  `'sequential'`, unchanged) rather than changing its default rendering
  -- Actual/Compare/Optimised keep today's chart exactly as-is; only
  `LandingDemo` opts into `variant="tariff"`. New `rateCategoryIndex`
  helper in `heatMapMath.ts` buckets a rate into cheap/standard/peak
  (tertile split of the data's own min/max, same normalisation
  approach as the existing `rateColorStepIndex`) instead of a 9-step
  ramp; CSS maps those three buckets to green/purple/standard-purple/
  red (`--heat-map-cat-0/1/2`, light + dark). Usage drives cell
  `opacity` (`0.3 + usageRatio*0.7`) instead of the bar-height overlay,
  which is hidden entirely in this variant.
- **Multi-day time landscape**: `landingDemoFixture.ts` now builds a
  `days: HeatMapDay[]` (4 consecutive illustrative days, deliberately
  identical in shape -- still example data, not a real meter, so a
  repeated pattern is the honest way to show "this happens every day"
  without implying day-to-day variance there's no data for) alongside
  the existing single `day` (kept as the last entry, so the headline
  kWh/£ stat is unchanged). `LandingDemo` passes `fixture[step].days`
  to `HeatMap` instead of a single-day array.
- Removed OA-83's 12-column single-row-wrap CSS hack in
  `LandingDemo.css` (it existed specifically to compress one wide
  48-cell row into a block) now that there's a genuine multi-row grid;
  replaced with compact row-height/label sizing for the 4-row card.
- **State behaviour** (Baseline usage === Compare usage exactly;
  Compare tariff colours === Optimise tariff colours, only flexible-use
  opacity moves) falls out of the existing fixture invariants (already
  covered by `landingDemoFixture.test.ts`) -- no new logic needed, just
  the new rendering mechanism consuming the same data.
- **Animation**: `transition: background-color .8s, opacity .8s` on
  `.heat-map--tariff .heat-map__cell`, scoped to the tariff variant only
  (not the shared default) and guarded by `prefers-reduced-motion`, per
  "restrained ~0.8s feel... DOM/CSS Grid, not canvas."
- **Demoted analytical/debug chrome**: "Show as table" toggle and the
  "select a period for details" detail line are visually shrunk/muted
  under `.heat-map--tariff` (smaller font, reduced opacity, link-style
  toggle) rather than removed -- they stay reachable/accessible per
  OA-84's upcoming requirements, just no longer competing with the
  story visually.
- Verified: `npm run build`/`lint`/`test` (48 tests, up from 41, incl.
  new `rateCategoryIndex` unit tests and a fixture test asserting the
  4-day landscape)/`check-bundle` all pass; confirmed via the built
  `dist/index.html` that the prerendered baseline state renders
  `heat-map--tariff` with 192 (`4 x 48`) cells. Live-browser visual
  verification was attempted (headless Chromium against `vite
  preview`'s static output) but produced an unreadable blank capture
  even for a plain `https://example.com` control screenshot in this
  sandbox -- a tooling/network issue in this container, not evidence of
  a rendering bug in the app (the served HTML/CSS was confirmed correct
  by direct inspection). Consistent with OA-82 update's documented
  finding that real browser automation/visual capture is not reliably
  available from this sandbox.

## Previous task

**OA-82, update** ("Make public landing page externally readable and
automation-friendly") -- Steve expanded this ticket after the first
pass merged: title/description rewritten to add automation-friendly
interaction, stable identifiers/state, and heat-map inspectability
requirements, on top of the original prerendering work.

Audited the existing implementation against every new acceptance
bullet first, since most were already satisfied by prior work (the
tablist/button semantics from OA-80, the deterministic
`buildLandingDemoFixture`, OA-82's own prerendered no-JS HTML) rather
than needing new code:
- Already true, no change needed: real `<button role="tab">` controls
  with `aria-selected`/`aria-controls`/roving `tabIndex`, keyboard
  arrow-key navigation, a real `<a>`/`Link` CTA, heat-map cells as
  real `<button>`s with descriptive `aria-label`s, an accessible-table
  fallback view, deterministic (no `Math.random`) fixture data, a
  synchronous (not effect-driven) initial Baseline state.
- Added (genuinely missing against "give major landing sections
  stable IDs" / "expose the currently selected comparison state
  deterministically"): `id`s on `LandingPage`'s sections (`hero`,
  `comparison-demo`, `about`, `compatibility`, `who-we-are`, `footer`)
  and a `data-active-step={step}` attribute on `LandingDemo`'s
  `<section>`, readable by automation/QA tooling without parsing ARIA.
- Added **component-level interaction tests**
  (`src/components/LandingDemo.test.tsx`, new devDependencies
  `@testing-library/react`/`@testing-library/jest-dom`/
  `@testing-library/user-event`/`jsdom`, scoped to that one file via
  the `// @vitest-environment jsdom` pragma rather than changing the
  project's default `node` test environment) to satisfy "an automated
  browser can select all three comparison states... assertion that
  state and figures update correctly... keyboard-only operation...
  DOM/text equivalents for the heat map" durably in CI, rather than as
  a one-off manual check. This was a deliberate substitution: **a real
  browser automation run against the live app was attempted and ruled
  out as infeasible from this sandbox**, not skipped by choice --
  `onAuthStateChanged` in `AuthContext` never resolves in this
  container even though Firebase's own endpoints
  (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`) are
  reachable through the sandbox's egress proxy (confirmed via `curl`);
  headless Chromium doesn't pick up the proxy from environment
  variables the way `curl`/Node do, and passing `--proxy-server`
  explicitly, `--ignore-certificate-errors`, and a generous
  `--virtual-time-budget` still left the client app stuck in `loading`
  indefinitely. Since `LandingDemo` itself has no Firebase dependency,
  testing it directly in jsdom sidesteps that blocker entirely and is
  arguably the more durable fix anyway (a permanent CI regression
  check beats a one-time manual click-through).
- Verified: `npm run build`/`lint`/`test` (41 tests, up from 35) /
  `check-bundle` all pass; confirmed the new `id`/`data-active-step`
  attributes appear in the prerendered no-JS `dist/index.html` too.

## Previous task

**OA-83, second pass** ("Evolve landing-page interactive comparison
beyond the initial mockup") -- Steve rewrote the ticket after the
first pass merged (title, description and acceptance criteria all
replaced), explicitly reframing it as "deliberately improve the
mockup, not reproduce it literally" and calling out specific things
from the first pass to change. Reopened (Done -> In Progress) and
addressed the concrete, scoped items:

- Removed the visible `<h2>` section heading added in the first pass
  -- the new ticket calls it out by name as "functional but generic"
  and explicitly offers "no standalone title" as an option. The
  section's existing `aria-label` and the eyebrow line keep it named
  for assistive tech.
- Removed the bordered "pill" around each step's tariff-context line
  and the bordered "callout" box around the Optimise step's figures --
  the new ticket's "remove generic SaaS cues... another pill, another
  glass card" item. Replaced with plain text at reduced opacity; all
  three steps (Baseline/Compare/Optimise) now use the same unboxed
  layout for visual continuity between states (previously Optimise was
  the only step with a box, which was itself an inconsistency).
  Strengthened each step's caption to reference the previous step
  explicitly ("usage is identical to Baseline", "Same tariff as
  Compare") per "strong visual continuity across all three states."
- Compressed the heat map from the shared `HeatMap` component's default
  one-row-of-48-cells layout into a 12-column wrapped grid, scoped to
  `.landing-demo__heatmap-card` via CSS only (`grid-template-columns:
  repeat(12, ...)`, letting it auto-wrap into rows) -- addresses
  "reduce heat-map dominance... row count/density... if a compressed
  multi-day representation communicates the story better, prefer that
  over a giant grid." No change to `HeatMap.tsx` or its data/ARIA
  labels, so Actual/Compare/Optimised are unaffected; taller cells from
  the new shape also give the usage-ratio bar more room to read
  clearly, plus a crisper top edge on the bar itself, for "make price
  vs usage immediately legible."
- Tightened spacing further throughout (section margin/padding, tabs
  gap, grid gap, stat margins) and narrowed the heat-map card's
  max-width (460px -> 340px) now that it's a compact block rather than
  a wide bar, so the whole comparison reads as more contained.
- Fixed two layout regressions surfaced while verifying the above: the
  baseline stat's "kWh · £" line could wrap mid-separator at the
  narrower story-column width (fixed by keeping each figure's own span
  on one line via `white-space: nowrap` and folding the separator into
  the second span rather than its own flex item); and the heat map's
  legend ("Cheapest...Most expensive" / "Bar height = usage") wrapped
  mid-phrase at the card's new narrower width (fixed by explicitly
  wrapping the "Bar height = usage" note onto its own full-width line
  rather than letting flex wrap break it arbitrarily).
- **Not done this pass** (judged out of a reasonable scope/effort
  tradeoff for one session; flagged in the Jira comment): the ticket's
  item 5, making the Baseline->Compare and Compare->Optimise
  transformations themselves "the main visual event" via some kind of
  per-cell diffed/highlighted motion (e.g. visually spotlighting the
  specific flexible-load slots that move between Compare and Optimise,
  not just the whole panel fading in). The existing full-panel
  fade/slide on step change is unchanged. This would need either a new
  optional `HeatMap` prop (additive, but still a shared-component
  change) or bespoke landing-page-only motion logic -- real
  engineering, not a CSS tweak -- so it's left as a follow-up rather
  than attempted partially.
- Verified the same way as the first pass: `npm run
  build`/`lint`/`test`/`check-bundle` all pass; visually re-verified
  (desktop 1280px, mobile 390px) via `vite preview` + local headless
  Chromium, static/no-JS render of the default Baseline step only
  (same Firebase/auth sandbox limitation as before -- Compare/Optimise
  reviewed by reading the JSX, not screenshotted).

## Previous task

**OA-83, first pass** ("Recompose landing-page interactive comparison
to match the design mockup") — composition/spacing/hierarchy rework of
`LandingDemo` (the Baseline/Compare/Optimise tabbed comparison on the
logged-out landing page), scoped strictly to the ticket's written
requirements plus a design-mockup video Steve shared mid-session
(`src/entry-server.tsx`/screenshots aside, no file from it is in the
repo — it was reviewed via extracted frames and a verbal description,
not committed):

- `src/components/LandingDemo.tsx`: added a visible section heading
  ("Interactive tariff comparison" — previously only an aria-label, no
  visible title); restructured each step's story panel from a
  headline-led paragraph to a stat-first hierarchy -- a small context
  pill (tariff name), a short label, the dominant kWh/£ figure, then a
  brief caption -- per the ticket's "kWh and cost should be the
  dominant figures; explanatory copy should support rather than
  compete with them". Added `describeTimingPotential` for the
  Optimise step's "+ £X.XX potential" framing (distinct from
  `describeDifference`'s "more/less" wording used for the tariff-choice
  step). No copy claims changed, no fixture/data changes -- same
  `buildLandingDemoFixture` figures, just reordered/restyled.
- `src/components/LandingDemo.css`: tightened the gap between the
  segmented control and the content; capped `.landing-demo__grid` and
  `.landing-demo__heatmap-card` width so the pair reads as one
  contained object instead of the heat map's 48-cell row stretching
  into a short, very wide bar on large screens; de-emphasised the
  heat map's legend/title text size and hid its text annotations list
  within the landing-demo scope only (the flagged-cell ring markers on
  the grid itself still show cheapest/most-expensive/highest-usage, so
  no information is lost, just not duplicated as a text block); new
  `__pill`/`__label`/`__stat`/`__stat-value`/`__stat-diff`/`__question`/
  `__callout`/`__caption` classes for the restructured story panel.
  Mobile already stacked narrative-before-heat-map (pre-existing DOM
  order), so no reordering was needed there.
- **Decisions** (ticket scope wasn't fully covered by the written spec
  alone, filled in per CLAUDE.md's "pick the simplest option, record
  it" convention):
  - Did **not** change the heat map's colour system to the mockup's
    categorical green/purple/red (cheap/standard/peak) scheme. The
    shared `HeatMap` component (also used by Actual/Compare/Optimised)
    deliberately uses a single-hue sequential ramp per the dataviz
    skill, with usage encoded separately via bar height rather than a
    second hue -- recolouring it is a cross-page design-system change
    the ticket's own acceptance criteria don't ask for. Flagged to
    Steve as a possible separate ticket if wanted.
  - Did not literally replicate the mockup's dense "14-day sample"
    grid shape -- our fixture is one illustrative day (48 half-hour
    slots), and the real `HeatMap` component's per-day-row,
    annotated, table-togglable rendering (used identically on
    authenticated pages) was kept as-is; only its landing-page-scoped
    sizing/legend weight changed, per "reduce the displayed sample
    length or compress the visual treatment rather than simply scaling
    the grid larger" and "implementation remains consistent with
    OA-77/78/79/80".
  - Picked `#4ade80` (a green not previously used anywhere else in the
    app) for the Compare/Optimise savings-difference figure -- no
    existing "savings green" token existed to reuse.
- Verified: `npm run build`/`lint`/`test`/`check-bundle` all pass.
  Visually verified via `vite preview` + a locally-available headless
  Chromium binary (`/opt/pw-browsers`, no `playwright` npm package in
  this repo) at desktop (1280px) and mobile (390px) widths, with the
  page's CSS fade-in animations temporarily neutralised for the
  screenshot only (a static single-frame capture otherwise catches the
  animation's `opacity:0` starting keyframe, which looks like missing
  content but isn't -- confirmed by comparing against the real build
  with animations intact; this is a headless-screenshot artifact, not
  a shipped bug, and pre-dates this session) and reverted immediately
  after. Did not verify interactively clicking through the three tabs
  in a real browser this session -- Firebase's `onAuthStateChanged`
  never resolves in this sandbox (blocked egress), so the client app
  never leaves `loading`; static/no-JS rendering of the (default)
  Baseline step was verified instead, and the Compare/Optimise JSX
  branches were reviewed by reading rather than screenshotted.

## Previous task

**OA-82** ("Make public landing page externally readable without app
execution") — build-time prerendering of the root URL so external
tools (crawlers, link previews, review agents, `curl`) see real
content without running the React app:

- `src/entry-server.tsx`: a build-time-only entry point (never shipped
  to the browser — it's not imported from `main.tsx`/`App.tsx`) that
  renders the real `LandingPage`/`LandingDemo`/`HeatMap` components
  (wrapped in a `MemoryRouter` and a minimal signed-out header, since
  `AuthContext` initialises Firebase and isn't needed — the route this
  stands in for is only ever shown signed-out, per `App.tsx`'s
  `HomeRoute`) to a static HTML string via `renderToStaticMarkup`. This
  reuses the actual landing components/copy rather than hand-maintaining
  a separate marketing page, per the ticket's explicit constraint.
- `scripts/prerender.mjs`: runs after `vite build` (wired into
  `npm run build`). Uses Vite's programmatic `build()` API to compile
  `entry-server.tsx` to a throwaway Node SSR bundle (`.prerender-ssr/`,
  gitignored, deleted after use), imports it, calls `renderLandingPage()`,
  and bakes the resulting HTML into `dist/index.html`'s `<div id="root">`
  — plus adds canonical URL, Open Graph and Twitter-card meta tags.
  `createRoot().render()` in `main.tsx` is unchanged and still fully
  replaces this content on hydration, so the interactive app is
  untouched when JS does run.
- No change to other routes — only the root/landing document gets
  prerendered, per the ticket's scope (public marketing surface, not
  authenticated app routes).
- Verified: `npm run build` produces `dist/index.html` containing the
  real heading/copy/CTA text and metadata (checked by reading the
  built file directly, and via `vite preview` + `curl`, i.e. no JS
  execution); build/lint/test/check-bundle all pass. Did **not** verify
  in an actual browser (no Playwright browser available in this
  session for the installed `@playwright/test` version) — the
  mount-and-replace behaviour is standard `createRoot` semantics, not
  new logic, so this is a low-risk gap rather than an open question.

### Decisions

- Prerendered only the root/landing document, not a general SSG/SSR
  setup for the whole app — nothing else in the ticket's acceptance
  criteria needed it, and the rest of the app is authenticated.
- Used `renderToStaticMarkup` (not `hydrateRoot` on the client) because
  `main.tsx` already does a plain `createRoot().render()` replace; this
  keeps the client code and bundle untouched and avoids SSR/CSR markup-
  mismatch warnings, at the cost of a (currently invisible, sub-paint)
  content replace rather than true hydration.
- Built the SSR entry via Vite's programmatic API with `configFile:
  false` inside `scripts/prerender.mjs`, rather than a separate
  `vite.config.ssr.ts` or a second CLI invocation — keeps it to one
  file, and esbuild picks up the `jsx: "react-jsx"` setting from
  `tsconfig.app.json` directly so `@vitejs/plugin-react` isn't needed
  for this build.

## Previous task

**OA-81** ("Build household appliance setup for flexible-load modelling")
built this session, between OA-76 and OA-65 in the build order:

- `server/src/applianceProfiles.js`: server-side mirror of OA-30's
  canonical appliance model (`src/domain/applianceProfile.ts`) — the
  server stays plain JS so this duplicates its shape/defaults by hand
  rather than importing the TS file; kept deliberately in sync.
- `server/src/householdApplianceStore.js`: Firestore, one doc per UID
  (collection `householdAppliances`), bounded at 4 supported appliance
  types so no subcollection needed.
- `server/src/routes/householdAppliances.js` +
  `GET/POST /api/household-appliances`,
  `PATCH/DELETE /api/household-appliances/:applianceType`: list/add/
  confirm-values/disable. Validates positive-only runtime/energy,
  rejects unsupported appliance types, disables rather than deletes
  (so re-adding keeps earlier confirmed values), and only an explicitly
  confirmed field's source flips to `user_confirmed` — everything else
  stays `generic_default`.
- `src/pages/ApplianceSetupPage.tsx` (new `/appliances` route/nav item):
  a checklist of the 4 supported types; each checked one expands to
  show/edit typical runtime and energy, each tagged "We'll estimate
  this" / "You told us this".
- Per the ticket's own "Relationship to OA-76": this ticket does **not**
  wire anything into `flexibleLoadEvents.js` — declaring an appliance
  here never identifies a historical event or creates a Step 3 saving
  by itself. `detectFlexibleLoadEvents` stays untouched and still
  returns `[]`; Optimised remains honestly at £0 timing opportunity
  until a future event-confirmation ticket exists.
- 14 new server tests covering the ticket's own listed cases (no
  appliances selected, each category added, generic default retained,
  user-confirmed runtime/energy, unsupported type rejected, disable
  removes from active setup, ownership-doesn't-create-an-event, re-add
  keeps confirmed values, persistence round-trip). 152 server tests
  pass total, 29 web tests pass, build/lint/bundle-check clean.

## Previous task

Steve revised the build order after the mop-up cluster, then again
after OA-73: **OA-69 (done) → OA-70 → OA-71 → OA-72 → OA-74 → OA-73 →
OA-75 → OA-76 → appliances/household setup → OA-65**, replacing the
old "My Savings + Cheapest Times" product surface with Actual →
Compare → Optimised → Plan. OA-70 through OA-76 are all merged and
Done:

- **OA-75**: `docs/SHIFTING_METHODOLOGY.md` is now an explicitly
  versioned working model (a "Version history" section, dated entries)
  rather than a one-time Steve-sign-off gate — removes the blocker
  OA-73 had left in place. No code change; doc-only.
- **OA-76**: "Optimised" built per the methodology doc's model exactly:
  `server/src/shiftingOptimiser.js` (pure scheduling engine — atomic
  contiguous moves for dishwasher/washing machine/tumble dryer,
  splittable cheapest-slots moves for the dehumidifier, evidence-tier
  ordered placement, a household-max-half-hourly-kWh concurrency cap,
  energy-preservation assertion that throws rather than show a wrong
  total), `server/src/flexibleLoadEvents.js` (the event source —
  deliberately always `[]` today, see Decisions),
  `GET /api/octopus/optimised-period` (new route in
  `server/src/routes/octopus.js`, mirrors `/like-for-like`'s
  request/response shape rather than refactoring it), and
  `src/pages/OptimisedPage.tsx` (new `/optimised` route/nav item,
  third `HeatMap` series via `groupSlotsByLondonDay`, both the
  tariff-choice and timing opportunity figures shown together per
  "Output and attribution"). All four of the doc's deterministic
  fixtures are implemented as tests
  (`server/test/shiftingOptimiser.test.js`), plus a route test
  confirming Optimised degrades cleanly to Like-for-like's own figures
  (£0 timing opportunity) with no events supplied
  (`server/test/optimisedPeriodRoute.test.js`). 130 server tests pass,
  29 web tests pass, build/lint/bundle-check all clean.
  - **Follow-up pass (same day)**: compared the actual OA-76/OA-75 Jira
    tickets (found in Jira, not Linear — see Decisions) against what was
    built, and closed every gap in their written acceptance criteria:
    added `server/src/shiftingMethodologyDefaults.js` (centralised,
    explicitly tunable `METHODOLOGY_VERSION`/awake-home hours/minimum-
    saving threshold — OA-75's "centralised defaults" and "methodology
    version on every result" requirements), an explicit per-event
    `validWindowStartsAt`/`validWindowEndsAt` override (OA-75's "may not
    move earlier unless an explicit valid window permits it"), and
    reworked origin-slot derivation to come from `durationMinutes` alone
    (handles a "partial-slot runtime" like a 70-minute cycle correctly,
    rather than needing a separately-supplied end timestamp). Added the
    fixtures Jira explicitly listed that weren't yet covered: methodology-
    version provenance, partial-slot runtime, an explicit-wider-window
    case, a below-threshold case (custom `minSavingPence`), a tariff-
    agnostic test across two structurally different rate shapes (flat vs.
    dual-rate), and real UK DST fixtures for both the 46-slot
    (2025-03-30, spring forward) and 50-slot (2025-10-26, autumn
    fallback) London calendar days. 137 server tests pass, 29 web tests
    pass, build/lint/bundle-check all clean. OA-76 transitioned to Done
    in Jira.

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
  model, constraints, evidence hierarchy and fixtures. Originally gated
  on a one-time Steve sign-off before any implementation ticket could be
  opened; OA-75 removed that gate (see above), and OA-76 is now built
  directly against it.

Not yet started: appliances/household setup (needed before Optimised's
`eventsConsidered` becomes non-zero for a real user) and OA-65
(Today/Tomorrow schedule + heat map, now explicitly last in the
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

0. **OA-76 and OA-81 merged to `main` (PR #26) and deployed to prod** —
   `Deploy server` and `Deploy beta` both completed successfully
   (2026-10-02). Their "stable beta deployment required before Done"
   criterion is now actually satisfied, not just assumed. Still worth a
   real manual check once convenient: `/optimised` and `/appliances`
   both load and work against a live account; confirming/disabling an
   appliance on `/appliances` persists across a refresh; `/optimised`
   still shows a genuine £0 timing opportunity for a real account
   (expected, since no event-confirmation ticket exists yet).
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

- OA-86: closed with no code change, since the existing OA-85 work
  (already merged/deployed) was re-verified to satisfy every acceptance
  criterion in OA-86's description line-by-line (not just assumed from
  OA-85's commit message). Decision: treat "ticket description restates
  a already-Done ticket's own commit message" as a signal to audit
  against the real code before writing anything, same as the OA-84/OA-82
  pattern noted above -- not an automatic ask-Steve case, since
  CLAUDE.md's "pick the simplest option and carry on" covers it. Added a
  Jira comment on OA-86 with the verification evidence and transitioned
  it to Done per the standing rule below.
- Tickets referenced in this file (OA-xx) live in **Jira**
  (`altitudeconsulting.atlassian.net`, project key `OA`), not Linear —
  the connected Linear workspace in this environment is an unrelated
  app's backlog (`ALT-*`, a task planner, nothing to do with energy
  saving). Worth remembering next session rather than re-discovering.
- OA-81 ("Build household appliance setup for flexible-load modelling")
  created by Steve directly in Jira, sitting between OA-76 and OA-65 in
  the build order — not yet started as of this entry.
- OA-76: `detectFlexibleLoadEvents` (`server/src/flexibleLoadEvents.js`)
  always returns `[]` — there's no appliance/household declaration store
  in this app yet (that's its own, later ticket), and tier 5 (inferring a
  flexible-shaped bump from consumption alone, no appliance declared) is
  explicitly ruled out for the first implementation by the methodology
  doc itself. This means Optimised is fully built and tested but always
  equals Like-for-like (£0 timing opportunity) for a real user today —
  the honest outcome the doc calls for, not a bug. Swapping in a real
  lookup once household data exists needs no change to the scheduling
  engine or route.
- OA-76: Optimised reprices against the same comparison tariff
  Like-for-like already resolved (`comparisonFamily=agile` or an
  explicit tariff code), never the customer's actual tariff — "Output
  and attribution" in the methodology doc is explicit that the timing
  opportunity (Y→Z) is "same tariff, shifting flexible load", distinct
  from the tariff-choice opportunity (X→Y).
- OA-76: `/optimised-period` duplicates `/like-for-like`'s
  request/response-building logic (comparison tariff resolution,
  `comparisonMethod !== 'exact'` handling, rate fetch) rather than
  extracting a shared helper — `/like-for-like` already has a passing
  test suite pinned to its exact response shape, and refactoring it
  purely to share code with a new route risked that for no real benefit
  at this app's size. Revisit if a third consumer of the same logic
  shows up.
- OA-76: the concurrency cap (`maxHalfHourlyKwh`) is checked against each
  destination slot's actual whole-house kWh plus already-committed
  flexible load, not flexible load alone — a stricter reading than the
  doc's literal wording ("across all moved appliances combined") but
  never a worse one: it can only prevent a move the looser reading would
  have allowed, never approve one the doc wouldn't. Chosen because the
  looser reading could let modelled flexible load overlap base load
  (lighting, fridge, etc.) past what the household has ever actually
  drawn in a half-hour, which is the exact implausibility the cap exists
  to rule out.
- OA-76: for the splittable dehumidifier, "a maximum power/rate
  constraint" (the doc's phrase, written with EV/battery charging in
  mind) is enforced via the same household concurrency cap rather than a
  separate per-appliance power rating — no generic default power rating
  exists for a dehumidifier in `applianceProfile.ts`, and inventing one
  would be exactly the kind of unvalidated default the doc's evidence
  hierarchy warns against. Revisit if a real dehumidifier power rating
  becomes available as tier 2/4 evidence.
- OA-75: no formal "signed off by Steve, <date>" line was added to
  `SHIFTING_METHODOLOGY.md` (unlike `SAVINGS_METHODOLOGY.md`'s pattern)
  — the ticket's own point is to replace that one-time gate with a
  "Version history" section recording dated changes instead, so adding
  a sign-off line would reintroduce the pattern being removed.
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
