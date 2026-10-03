# HANDOFF

_Last updated: 2026-10-03 11:20 BST_

_Note: this file previously grew into a full changelog (1700+ lines) across
many sessions, against the handoff convention of staying under one page.
Rewritten clean earlier today — detailed history for anything before
2026-10-03 lives in `git log` and the Jira tickets themselves (project
`OA`, `altitudeconsulting.atlassian.net`), not here._

## Current task

**OA-106** (built and committed, `5472772` on `main`, not pushed/deployed)
— added the two controls Tab 3 ("Optimise timing") was missing, plus a
defensive guard against a described "empty event overlay" bug.

- **Optimise all**: new button, moves every real household event to its
  own cheapest valid slot (`cheapestStartSlotForEvent` in
  [src/domain/landingDemoFixture.ts](src/domain/landingDemoFixture.ts) —
  brute-force search over that event's own `validStartSlotRange` against
  the Agile rates, same window/rates a manual drag already uses).
  Duration/kWh unchanged; fixed/background usage untouched.
- **Reset**: new button, clears all overrides so every event falls back
  to its `actualStartSlot` — the exact Tab 1/2 position, not an undo of
  the last move. Disabled when nothing has moved.
- **Empty/orphan overlay guard**: `isRealHouseholdEvent` (fixture) filters
  which events ever become overlays; `isRenderableEventOverlay` (inside
  [LandingTimeProfile.tsx](src/components/LandingTimeProfile.tsx)) is a
  second, independent guard at render time (id/label non-blank, positive
  slotCount, start/end slots inside the day) plus a same-id dedupe. Two
  layers because the ticket explicitly asked the chart itself to never
  draw an orphan block even if a future caller forgets to filter.

## State

Done and verified: `npm test` (136/136, 19 new), `npm run lint` (clean,
same pre-existing unrelated warnings), `npx tsc --noEmit -p
tsconfig.app.json` (clean), `npm run build` + `npm run check-bundle`
(clean), and confirmed live in the browser (Optimise all moves both
sliders and updates cost/saving live, Reset restores the exact original
£0-saving state and re-disables itself, no console errors on repeated
fresh reloads — one `isRenderableEventOverlay is not defined` console
entry during testing was confirmed stale/leftover from an earlier Vite
HMR cycle, not a live error, by reloading fresh and re-checking).

Working tree is clean except an unrelated untracked `local.py` at repo
root (predates this session, leave it alone).

## Next step

Not pushed, no PR, not deployed. Same as OA-103/104/105 before it: ask
Steve whether to push `main` and open a PR (or push directly), then
deploy and transition OA-106 to Done in Jira once a stable beta deploy
exists.

## Open items

- OA-103/104/105 are still "To Do" in Jira as of this session's start —
  carried forward, not newly introduced by OA-106. Confirm with Steve
  whether/when to transition tickets once something is actually deployed.
- Next ticket after OA-106 not yet checked — look at Jira before starting
  new work.
- When both events happen to share the same cheapest slot (true today:
  dishwasher and washing machine both land on 13:30 after "Optimise
  all"), their two overlay boxes render exactly on top of each other —
  correct cost-wise (the model has no overlap constraint; two appliances
  running the same half-hour is physically plausible) but the labels
  become visually unreadable where they coincide. Not in OA-106's
  acceptance criteria (which only disallows overlaps "where the event
  model disallows them" — it doesn't), so left as-is; flag to Steve if it
  reads as a bug rather than a quirk of this still-small two-event demo.

## Key references

- Files touched this session: `src/domain/landingDemoFixture.ts` (+
  `.test.ts`), `src/components/LandingDemo.tsx` (+ `.test.tsx`),
  `src/components/LandingTimeProfile.tsx` (+ `.test.tsx`, `.css`) — the
  same three-file cluster OA-103/104/105 touched.
- Jira: OA-106 (cloudId `82bc0aac-6540-45cd-af3b-bbe8ab843532`). Parent
  epic OA-33 ("MVP — Landing Page & Signup"). Builds on OA-103/OA-105.
- Commands (repo root, web app): `npm test`, `npm run lint`, `npx tsc
  --noEmit -p tsconfig.app.json`, `npm run build`, `npm run check-bundle`.
  Dev server already running on :5173 outside this session — reuse via
  the browser tool's `navigate`, don't start a second one.

## Decisions made

- "Optimise all"/"Reset" live as a `controls` prop passed from
  LandingDemo.tsx into LandingTimeProfile.tsx (rendered just above the
  legend/chart), rather than LandingTimeProfile.tsx owning its own
  optimise/reset logic — state (`optimiseEventStartSlots`) is already
  lifted to LandingDemo.tsx for the same reason OA-103 lifted it (persist
  across tab switches), so the handlers belong there too; the chart stays
  a presentational component.
- `cheapestStartSlotForEvent` does a brute-force scan of every slot in
  the event's own `validStartSlotRange` (at most 48 iterations) rather
  than anything smarter — the search space is tiny and this guarantees
  "same validity rules as manual dragging" by construction, since it's
  the exact same `eventCostPence`/`AGILE_REPRESENTATIVE_RATE_PENCE`
  manual dragging's cost display already uses.
- Two independent empty-overlay guards (fixture-level
  `isRealHouseholdEvent`, component-level `isRenderableEventOverlay`)
  instead of one — the ticket's "event overlays should never appear
  unless they correspond to a real modelled load" reads as a requirement
  on the chart itself, not just its caller, so LandingTimeProfile.tsx
  needed its own guard even though LANDING_DEMO_EVENTS's two real events
  would already pass it today.
- Left overlapping-event-labels-when-same-slot as a known quirk rather
  than solving it (see Open items) — out of this ticket's acceptance
  criteria, and speculative layout work (stacking/offsetting coincident
  overlays) felt like scope creep for a two-event demo fixture.

## Constraints and preferences

See project `CLAUDE.md` for the standing rules (server stays plain JS,
`src/api/client.ts` is the only fetch boundary, GBP/Europe-London
display, etc.) — unaffected by this session's work (landing page only, no
server changes).

## Gotchas

- `npx tsc --noEmit` alone (no `-p`) resolves the root `tsconfig.json`'s
  empty `files: []` and silently reports zero errors even with real type
  errors present — always pass `-p tsconfig.app.json`.
- The three landing-demo files (`landingDemoFixture.ts`,
  `LandingDemo.tsx`, `LandingTimeProfile.tsx`) are tightly coupled by a
  shared event-id contract (`LANDING_DEMO_EVENTS[].id` ↔
  `LandingTimeProfileEventOverlay.id` ↔ `optimiseEventStartSlots` keys)
  — changing an event's `id` string must be updated in all three plus
  both test files.
- The built-in browser's `read_console_messages` can keep returning a
  stale error from an earlier Vite HMR recompile even after a genuine
  full page reload (same timestamped module URL in the stack trace
  persists) — if a console error looks inconsistent with what the page
  is visibly doing, reload once more and compare, don't trust the log in
  isolation.
- Octopus Go/Intelligent Go tariff-classification prefix matches
  (`tariffClassification.js`) are still unverified against a real
  account — long-standing risk from before this session, unrelated to
  the landing-page work above but still open.
