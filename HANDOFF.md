# HANDOFF

_Last updated: 2026-10-02 (OA-53: gate My Savings behind auth)_

## Current task

OA-53: `/savings` was publicly reachable and listed in the nav even
when signed out, exposing an authenticated product surface before
login. Gate it behind the same Firebase auth guard as `/account`.
Implementation done locally; not yet committed/pushed/PR'd. (OA-52 is
also mid-flight — see below.)

## State

- OA-47, OA-49, OA-50, OA-51, OA-52, and two hotfixes are merged to
  `main` and live on beta.
- **OA-53** (this change): code complete and validated locally (lint,
  build, check-bundle, web tests, server tests all pass), branched
  cleanly off the post-OA-52 `main`; not yet committed/pushed/PR'd.

## Next step

Commit this work on branch `oa-53-gate-savings` (already checked out),
push, open a PR, watch CI, merge once green, then run the "Beta
verification (OA-53)" steps in `README.md` against the deployed beta
URL.

## Key references

- Ticket: OA-53, Jira Octopus Agile project.
- `src/App.tsx` — `/savings` now wrapped in `<ProtectedRoute>`; nav only
  renders "My Savings" (and "Account"/"Sign out") when `user` is set and
  `loading` is false — identical pattern to `/account`'s existing gate.
- `src/auth/ProtectedRoute.tsx` — unchanged, reused as-is (per ticket:
  "do not introduce separate local auth state").
- README.md "Beta verification (OA-53)" section.

## Decisions

- Reused `ProtectedRoute` and the existing `?from=` redirect mechanism
  from OA-51 verbatim rather than writing savings-specific auth logic —
  ticket explicitly asks for the same guard/session authority as
  OA-50/OA-51.
- Nav visibility change (hide "My Savings" when signed out) lives in
  the same conditional block that already handled "Account"/"Sign out"
  vs. "Sign in" — no new branching, just moved the `<NavLink
  to="/savings">` inside the authenticated branch.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo (Firebase web
  config is the documented exception).
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- Keep production deployment and production auth separate, manual, and
  gated — this is beta only.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- The header's brand text still reads "Octopus Agent" vs. tickets'
  "Shift & Save" consumer brand — not addressed by any ticket yet.
- Don't commit the beta test account's password anywhere — it lives only
  in Firebase Console → Authentication → Users.
