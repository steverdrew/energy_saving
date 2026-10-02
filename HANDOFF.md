# HANDOFF

_Last updated: 2026-10-02 (OA-5 + OA-20: secure Octopus connection)_

## Current task

OA-5 + OA-20 as one slice: let an authenticated beta user connect their
Octopus Energy account (account number + API key), validated and stored
server-side, encrypted at rest, never exposed back to the browser.
**Not complete** — see "Blocked" below. Engineering is done, tested,
and pushed; the live/beta part of the Definition of Done is blocked on
a hosting decision only Steve can make.

## State

- OA-47 through OA-53 (plus hotfixes) are merged to `main` and live on
  beta.
- This slice's code is complete and fully tested locally (server: 20
  tests incl. crypto round-trip, auth rejection, cross-user isolation,
  bad-credential/network-failure handling; web: lint/build/check-bundle/
  tests all pass). Not yet committed to a branch/PR at the time of this
  note — see Next step.
- **Nothing in this slice is deployed or reachable from
  `shiftandsaveapp.web.app`.** OA-49 deploys Hosting only; the Express
  server has never had a deployment target. This PR can still merge
  safely (it doesn't touch `deploy-beta.yml` or anything beta currently
  serves), but merging it does **not** make Connect Octopus usable on
  beta.

## Blocked — needs Steve

OA-5's Definition of Done requires the flow to be "visible and testable
on the stable beta URL." That needs:

1. **Where the Express server runs.** No target exists yet. My
   instinct is Cloud Run or Cloud Functions (same GCP project as
   Firebase, so Firebase Admin auth verification and IAM are simplest),
   but this is a real infrastructure choice, likely with a billing
   account implication — I won't provision anything myself.
2. **What persists `octopus_connections` once off a single disk.**
   `better-sqlite3`'s file won't survive a serverless container
   restarting. Either (a) host somewhere with a persistent disk, or (b)
   move this one store to Firestore (same Firebase project, no new
   vendor, but is a datastore decision worth confirming rather than me
   silently picking).
3. Once (1) is decided, confirm whether the chosen host's identity can
   verify Firebase ID tokens via `initializeApp({ projectId })` alone
   (no service account) — `server/src/firebaseAuth.js` assumes this
   works for signature-only verification (no revocation check); flagged
   as unverified in Gotchas below since nothing here could test it
   against real Firebase.

I did **not** treat OA-26 (commercial/API/legal viability gate) as
passed — it's still open. I proceeded with building (not deploying)
this slice because you directed it explicitly; I'm not asking for or
handling any real Octopus credential myself, and nothing ships to real
customers without that gate and OA-21 (savings methodology) separately
clearing.

## Next step

Commit this slice on a new branch off `main` (e.g.
`oa-5-oa-20-connect-octopus`), push, open a PR, get it through CI and
merged (safe — inert until deployed). Then bring the three points under
"Blocked" back to Steve before anything here can go live.

## Key references

- Tickets: OA-5, OA-20 (this slice); OA-26, OA-21 (gates, not cleared,
  not blocking this slice's code).
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

## Decisions

- Firebase ID token verification uses the SDK's local signature check
  (`initializeApp({ projectId })`, no service account) rather than a
  full credentialed Admin SDK init — no revocation check, but no new
  secret to provision either. Flagged for confirmation once a real
  deploy target exists.
- Both the account number and API key are encrypted — not just the API
  key — since OA-5 says to treat the account number as personal data,
  and it also needs to be recoverable server-side for a future import
  job (OA-6), so plaintext-with-redaction-only wasn't enough.
- `requireFirebaseAuth` and `fetchOctopusAccount` are injected into
  `createOctopusRouter`/`createRequireFirebaseAuth` rather than imported
  directly, purely so tests never need real network access to Firebase
  or Octopus. Production wiring is a few lines in `server/src/index.js`.
- "Find my saving" on the account page (OA-51) now links to
  `/connect-octopus` instead of the `/savings` placeholder — it's the
  real entry point OA-51 reserved that slot for.
- Did not implement OA-6 (tariff/consumption import) or any savings
  figure — both explicitly out of scope here, and OA-21 hasn't cleared
  for the latter anyway.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission, never hard-coded as a test fixture.
- Account number: treated as personal data — redacted in all UI/API
  responses after the initial submission.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- No £ savings claims until OA-21 passes.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- `server/src/firebaseAuth.js`'s no-service-account token verification
  is unverified against a real deployment — works in theory per
  Firebase's docs, untested here since there's no live Firebase traffic
  to this server at all yet.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction from OA-49 applies here too.
- Don't commit the beta test account's password, or any Octopus API
  key, anywhere — Octopus credentials are meant to be entered directly
  into the deployed (or local) app by Steve, never pasted into chat,
  Jira, source, config, logs, or fixtures.
