# HANDOFF

_Last updated: 2026-10-02 (OA-50: Firebase Auth login for beta)_

## Current task

OA-50: replace the web app's auth with Firebase Authentication
(email + password) for the beta environment, with a working login screen,
session persistence, sign out, and protected routes. Implementation done
locally; not yet committed/pushed/PR'd.

## State

- OA-47, OA-49, and two post-merge hotfixes (hero `<h1>` line-height,
  signup/login page centering) are merged to `main` and live on beta.
- OA-50 code is complete and validated locally (lint, build,
  check-bundle, web tests, server tests all pass) but sits uncommitted
  on top of `main` — not yet on a branch, no PR yet.

## Next step

Commit this work on a new branch off `main` (e.g.
`oa-50-firebase-auth`), push, open a PR, watch CI, merge once green, then
confirm on the deployed beta URL using the "Beta verification" steps in
`README.md`'s Authentication section.

## Key references

- Ticket: OA-50, Jira Octopus Agile project.
- `src/firebase.ts` — Firebase app/Auth init (public web config, see
  Decisions).
- `src/auth/AuthContext.tsx` — Firebase Auth-backed `useAuth()`.
- `src/auth/ProtectedRoute.tsx` — redirects signed-out users to `/login`.
- `src/auth/firebaseErrors.ts` — Firebase error code → user-facing copy.
- `src/pages/LoginPage.tsx` (was `SignupPage.tsx`) — `/login`, email +
  password only.
- `scripts/check-bundle.mjs` — fixed to word-boundary match (was
  false-positiving on `PORT` inside Firebase SDK's `HAS_NATIVE_SUPPORT`).
- README.md "Authentication (beta)" section — beta verification steps.

## Decisions

- **Firebase Auth replaces the web app's Express/SQLite auth entirely**
  (confirmed with Steve) rather than running both. OA-49 already deploys
  Hosting-only to beta, so the Express auth routes couldn't work there
  anyway. `server/src/auth.js` and `/api/auth/*` stay in `server/`
  untouched but are unused by the web app.
- Firebase web SDK config is hardcoded in `src/firebase.ts`, not an env
  var — it's public client config (protected by Firebase Security Rules,
  not secrecy), same as Firebase's own docs recommend committing it.
- No public self-service signup: `/signup` was renamed to `/login`,
  login-only, no mode toggle — matches ticket's explicit out-of-scope
  list. Account deletion (previously Express-backed) was removed with it;
  not in OA-50's MVP scope and had no Firebase equivalent requested.
- Session persistence relies on Firebase Auth's default browser
  persistence (IndexedDB/localStorage) — no custom cookie/session code
  needed.
- Error messages are mapped from Firebase Auth error codes to
  consumer-friendly copy in `src/auth/firebaseErrors.ts` rather than
  surfacing raw Firebase errors.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo (Firebase web
  config is the documented exception — see Decisions).
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- Keep production deployment and production auth separate, manual, and
  gated — this is beta only.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- `scripts/check-bundle.mjs` used a plain substring match, which
  false-positived on `PORT` appearing inside Firebase SDK's
  `HAS_NATIVE_SUPPORT` constant once the Firebase dependency was added.
  Now uses a word-boundary regex.
- `npm install firebase` reports 4 high-severity advisories, all in
  `@firebase/firestore`'s Node gRPC transport (`@grpc/grpc-js`) — we only
  import `firebase/app` and `firebase/auth` (tree-shaken modular SDK), so
  that code never reaches the browser bundle. Not fixed/forced since
  doing so would downgrade to firebase@9 (breaking).
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction from OA-49 applies here too; the web SDK
  config uses `projectId: 'shiftandsaveapp'`.
- Don't commit the beta test account's password anywhere — it lives only
  in Firebase Console → Authentication → Users.
