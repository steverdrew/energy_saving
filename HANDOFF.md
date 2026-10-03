# HANDOFF

_Last updated: 2026-10-03 18:55 BST_

_Note: this file previously grew into a full changelog (1700+ lines) across
many sessions, against the handoff convention of staying under one page.
Rewritten clean at this entry — detailed history for anything before
2026-10-03 lives in `git log` and the Jira tickets themselves (project
`OA`, `altitudeconsulting.atlassian.net`), not here._

## Current task

**OA-103 / OA-104 / OA-105** (all built and committed, `f20c8e3` on
`main`, not pushed/deployed) — made the public landing page's "Typical
household" demo (Tab 3 "Optimise timing") interactive, with shared
household events across all three tabs.

- **OA-103**: a household event on the Optimise tab is a draggable
  overlay (pointer + keyboard, `role="slider"`) over the usage chart;
  dragging it recomputes cost/saving live.
- **OA-104**: extended with monthly/annual projections, derived from an
  explicit per-event recurrence assumption (`occurrencesPerWeek` on each
  event, not `today × 365`). Shown as a prominent annual payoff headline
  with daily/monthly supporting detail, plus a secondary per-event
  inspectable line.
- **OA-105**: replaced the single hardcoded dishwasher with a shared,
  named event model (`LANDING_DEMO_EVENTS` in
  [src/domain/landingDemoFixture.ts](src/domain/landingDemoFixture.ts)):
  a dishwasher (no time-of-day constraint) and a washing machine
  (07:00–23:00 window). The same events, same positions, appear on all
  three tabs — fixed dashed annotations on Baseline/Compare, draggable
  overlays on Optimise, starting from the same actual position (nothing
  pre-shifted).

## State

Done and verified: `npm test` (117/117), `npm run lint` (clean, same
pre-existing unrelated warnings), `npx tsc --noEmit -p tsconfig.app.json`
(clean), and confirmed live in the browser (both events render/drag
independently on Optimise, annotations show correctly on Baseline/
Compare, daily/monthly/annual figures update together, no console errors
on a fresh page load).

Committed as one combined commit (`f20c8e3`), not three — OA-105 rewrites
OA-103/104's single-event model in the same files, so three commits would
mean reconstructing throwaway intermediate states rather than what
actually shipped; recorded as a Decision below. Working tree is clean
except an unrelated untracked `local.py` at repo root (predates this
session, leave it alone).

## Next step

Not pushed, no PR, not deployed. Ask Steve whether to push `main` and
open a PR (or push directly, per however this repo normally ships), then
deploy and transition OA-103/104/105 to Done in Jira once a stable beta
deploy exists (OA-104's own acceptance criterion).

## Open items

- OA-104's acceptance criteria include "Stable beta deploy verified
  before Done" — not done this session (nothing deployed).
- Jira tickets OA-103/104/105 are still "To Do" — transition to Done
  after commit/deploy, not before.
- Next ticket after OA-105 not yet checked — look at Jira before
  starting new work.

## Key references

- Files touched this session: `src/domain/landingDemoFixture.ts` (+
  `.test.ts`), `src/components/LandingDemo.tsx` (+ `.test.tsx`),
  `src/components/LandingTimeProfile.tsx` (+ `.test.tsx`, `.css`).
- Jira: OA-103, OA-104, OA-105 (cloudId
  `82bc0aac-6540-45cd-af3b-bbe8ab843532`). Parent epic OA-33 ("MVP —
  Landing Page & Signup").
- Commands (repo root, web app): `npm test`, `npm run lint`, `npx tsc
  --noEmit -p tsconfig.app.json`. Dev server already running on :5173
  outside this session — reuse via the browser tool's `navigate`, don't
  start a second one.
- `docs/SHIFTING_METHODOLOGY.md` — the authenticated app's real shifting
  rules (OA-73/76). The landing demo's event model mirrors its
  conventions (valid windows, atomic loads) but is a separate, simpler
  fixture, not wired to it.

## Decisions made

- OA-105 is a breaking rewrite of OA-103/104's single-event API, not an
  additive layer — removed the `FLEXIBLE_LOAD_*`/`clampFlexibleStartSlot`
  single-event exports entirely in favour of `LANDING_DEMO_EVENTS` +
  `clampEventStartSlot(id, slot)`.
- Optimise's default state changed: before OA-105 it opened pre-shifted
  (dishwasher already at a cheap slot, non-zero saving immediately); now
  it opens identical to Compare (£0 timing saving) since OA-105 requires
  "no event appears for the first time on Tab 3" / same actual positions
  across tabs. Intentional product behaviour change driven by the
  ticket, not a regression.
- Picked plain Pointer Events for drag (no new dependency) — repo had no
  drag-and-drop library and the interaction is a single-axis drag of a
  small number of blocks; `@dnd-kit`/`react-dnd` would be
  disproportionate.
- Washing machine's `validStartSlotRange` is `{min: 14, max: 44}` (07:00
  start, last start that still ends by 23:00) — a demo simplification of
  OA-73's `requiresAwakeHome` concept, not wired to the real
  `applianceProfile.ts` model.
- Committed OA-103/104/105 as a single commit rather than three — the
  working tree only ever reflected OA-105's final state (the code was
  written in one continuous pass across the session), so splitting it
  into three would require artificially reconstructing intermediate
  diffs that never existed as real, independently-tested states.

## Constraints and preferences

See project `CLAUDE.md` for the standing rules (server stays plain JS,
`src/api/client.ts` is the only fetch boundary, GBP/Europe-London
display, transition a ticket to Done in Jira once implemented/tested/
pushed, etc.) — unaffected by this session's work (landing page only, no
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
- Octopus Go/Intelligent Go tariff-classification prefix matches
  (`tariffClassification.js`) are still unverified against a real
  account — long-standing risk from before this session, unrelated to
  the landing-page work above but still open.
