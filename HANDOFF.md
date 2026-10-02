# HANDOFF

_Last updated: 2026-10-02 (OA-54: Shift & Save landing page, merged with OA-5/OA-20)_

## Current task

OA-54: update the public landing page to the Shift & Save
dynamic-tariff proposition (new hero, CTA, 3-step flow, stronger
privacy copy, link to the Agile explainer) and rebrand the app from
"Octopus Agent" to "Shift & Save" everywhere a user sees it.

This branch was rebased on top of `main` after OA-5/OA-20 (secure
Octopus account connection) merged ahead of it — see that section
below for the state of that slice, which is unrelated to OA-54 but
landed on `main` in between.

## State

- OA-47 through OA-53 (plus hotfixes) and OA-5/OA-20 are merged to
  `main` and live on beta (OA-5/OA-20's server-side piece is not
  reachable from beta yet — see "Connect Octopus" below).
- **OA-54** (this change): code complete and validated locally (lint,
  build, check-bundle, web tests all pass; manually screenshotted the
  rendered landing page at http://localhost:5173/). Merged with
  `main` locally to pick up OA-5/OA-20; only `HANDOFF.md` and
  `README.md` conflicted (both had independent new sections) and have
  been resolved keeping both. Pushed to `claude/busy-gates-4i4s7h`,
  PR #10 open against `main`.
- Deployment to beta happens automatically on merge to `main` via
  `.github/workflows/deploy-beta.yml`; it has not run for OA-54 yet,
  since PR #10 isn't merged. The ticket's "deploy to beta before
  completion" criterion will be satisfied once this PR is merged and
  the workflow runs (watch it with the beta-verification checklist
  below).

## Next step

Watch CI on PR #10, merge once green, then run "Beta verification
(OA-54)" in `README.md` against `https://shiftandsaveapp.web.app`.

## Key references

- Ticket: OA-54, Jira Octopus Agile project.
- `src/pages/LandingPage.tsx` / `.css` — new hero copy and CTA, revised
  3-step flow (Connect / See your saving / Make it easy), stronger
  privacy trust point, "What is Octopus Agile?" link to the existing
  `/how-smart-tariffs-work` explainer (OA-42).
- `src/App.tsx`, `index.html`, `vite.config.ts` (PWA manifest),
  `README.md` — rebranded "Octopus Agent" → "Shift & Save" in every
  user-visible spot (header, tab title, meta description, installed
  PWA name).
- README.md "Beta verification (OA-54)" section.

## Decisions

- Rebranded the PWA manifest name/short_name/description and the
  `<title>`/meta description in `index.html`, plus the README title —
  not explicitly called out in the ticket, but the ticket is about the
  Shift & Save proposition and HANDOFF already flagged the stale
  "Octopus Agent" branding as debt; fixing it here is the simplest
  option and avoids an inconsistent brand across tab title / installed
  app name / landing page in the same release.
  `ExplainerPage.tsx`'s own "Find my saving" CTA was left as-is — out of
  this ticket's scope (landing page only); worth a follow-up ticket if
  the mismatch with the new "See what I could save" CTA matters.
- Kept the link to the explainer page pointing at the existing
  `/how-smart-tariffs-work` route (built under OA-42) rather than
  renaming the route, since the ticket only asks for new link text
  ("What is Octopus Agile?"), not a URL change.
- "Make it easy" step copy explicitly says "the move is always yours to
  make" to satisfy the ticket's guard against implying automatic
  switching or device control in the MVP.
- Merge conflicts in `HANDOFF.md`/`README.md` against OA-5/OA-20 were
  resolved by keeping both sections (they document unrelated slices of
  work) rather than picking one side.

## Connect Octopus (OA-5 / OA-20) — merged ahead of this branch, not this ticket's work

OA-5 + OA-20 as one slice: let an authenticated beta user connect their
Octopus Energy account (account number + API key), validated and stored
server-side, encrypted at rest, never exposed back to the browser.
**Not complete** — engineering is done, tested, and merged to `main`;
the live/beta part of the Definition of Done is blocked on a hosting
decision only Steve can make.

- **Nothing in this slice is deployed or reachable from
  `shiftandsaveapp.web.app`.** OA-49 deploys Hosting only; the Express
  server has never had a deployment target.

### Blocked — needs Steve

OA-5's Definition of Done requires the flow to be "visible and testable
on the stable beta URL." That needs:

1. **Where the Express server runs.** No target exists yet (Cloud Run
   or Cloud Functions is the likely candidate — same GCP project as
   Firebase — but this is a real infrastructure/billing choice).
2. **What persists `octopus_connections` once off a single disk.**
   `better-sqlite3`'s file won't survive a serverless container
   restarting. Either host somewhere with a persistent disk, or move
   this store to Firestore.
3. Once (1) is decided, confirm whether the chosen host's identity can
   verify Firebase ID tokens via `initializeApp({ projectId })` alone
   (no service account) — `server/src/firebaseAuth.js` assumes this
   works for signature-only verification (no revocation check),
   unverified against a real deployment so far.

OA-26 (commercial/API/legal viability gate) is still open and was not
treated as passed for this slice.

### Key references

- `server/src/octopusClient.js` — real Octopus API call + account
  summarization (MPAN, tariff code only — no consumption data, that's
  OA-6).
- `server/src/crypto.js` — AES-256-GCM encrypt/decrypt, `ENCRYPTION_KEY`
  required (added to `server/src/config.js`'s fail-fast list).
- `server/src/firebaseAuth.js` — verifies a Firebase ID token
  (`Authorization: Bearer <token>`) server-side; `createRequireFirebaseAuth`
  takes the verify function as a parameter so tests inject a fake one
  instead of hitting Google's network.
- `server/src/routes/octopus.js` — `createOctopusRouter({
  requireFirebaseAuth, fetchOctopusAccount })`, same DI pattern, for the
  same testability reason.
- `src/pages/ConnectOctopusPage.tsx` — the `/connect-octopus` protected
  route (connect form / connected state / disconnect).
- `src/api/client.ts` — `api.octopus.*` now attaches the current
  Firebase user's ID token as a bearer token to every call.
- README.md "Connect Octopus (OA-5 / OA-20)" section.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo (Firebase web
  config is the documented exception).
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- Keep production deployment and production auth separate, manual, and
  gated — this is beta only.
- No £ savings claims until OA-21 passes.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- Don't commit the beta test account's password, or any Octopus API
  key, anywhere — Octopus credentials are meant to be entered directly
  into the deployed (or local) app by Steve, never pasted into chat,
  Jira, source, config, logs, or fixtures.
- `server/src/firebaseAuth.js`'s no-service-account token verification
  is unverified against a real deployment — works in theory per
  Firebase's docs, untested here since there's no live Firebase traffic
  to this server at all yet.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction from OA-49 applies here too.
