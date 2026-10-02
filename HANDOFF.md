# HANDOFF

_Last updated: 2026-10-02 (OA-51: wire login into the account page)_

## Current task

OA-51: make a successful Firebase login lead to a real, minimal
authenticated account page (not a dead end), with auth-redirect loops
handled cleanly in both directions and no flash of the wrong page while
Firebase reports its auth state. Implementation done locally; not yet
committed/pushed/PR'd.

## State

- OA-47, OA-49, OA-50, and two post-merge hotfixes are merged to `main`
  and live on beta.
- OA-51 code is complete and validated locally (lint, build,
  check-bundle, web tests, server tests all pass) but sits uncommitted
  on top of `main` — not yet on a branch, no PR yet.

## Next step

Commit this work on a new branch off `main` (e.g.
`oa-51-account-page`), push, open a PR, watch CI, merge once green, then
run the "Beta verification (OA-51)" steps in `README.md` against the
deployed beta URL.

## Key references

- Ticket: OA-51, Jira Octopus Agile project.
- `src/pages/LoginPage.tsx` — now gates on `loading` before rendering
  (no flash), redirects already-authenticated visitors, reads the
  post-login destination from `?from=`.
- `src/auth/ProtectedRoute.tsx` — redirects to `/login?from=<path>`
  (query param, not router state, so it survives a real page refresh).
- `src/pages/AccountPage.tsx` / `.css` — minimal authenticated shell:
  email, sign out, a "Find my saving" entry point (links to the existing
  `/savings` route) and a static "Your savings" placeholder card.
- `src/App.tsx` — nav also gates on `loading` to avoid flashing "Sign
  in" before flipping to "Account".
- README.md "Beta verification (OA-51)" section.

## Decisions

- Post-login/redirect destination travels as a `?from=` query param, not
  React Router location state — state doesn't survive an actual browser
  refresh while sitting on `/login`, a query param does.
- `destinationFrom()` in `LoginPage.tsx` only accepts paths starting with
  a single `/` (rejects `//evil.com`-style values) — `?from=` is
  attacker-controllable input, so it's treated as untrusted and never
  used for an off-app redirect.
- "Find my saving" on the account page links to the existing `/savings`
  route rather than inventing a new one — OA-51 explicitly scopes this
  as a shell/entry point, with the real Octopus connection flow and
  savings results out of scope (future tickets).
- No new auth/session state: the account page and nav both read
  `useAuth()` directly; Firebase remains the sole source of truth.

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

- Both `LoginPage` and the `App.tsx` header nav must check
  `loading` from `useAuth()`, not just `user` — otherwise there's a
  one-frame flash of the signed-out UI for an already-authenticated
  visitor before Firebase's `onAuthStateChanged` callback fires.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction from OA-49 still applies to
  `src/firebase.ts`'s config.
- Don't commit the beta test account's password anywhere — it lives only
  in Firebase Console → Authentication → Users.
