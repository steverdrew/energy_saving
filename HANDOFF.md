# HANDOFF

_Last updated: 2026-10-02 (OA-5/OA-20: Cloud Run + Firestore wiring)_

## Current task

Following Steve's confirmed decision (Cloud Run for the server, Firestore
for `octopus_connections`), wire up the actual deployment: migrate the
Octopus connection store off SQLite onto Firestore, and scaffold a Cloud
Run deploy workflow + Firebase Hosting rewrite so `/api/**` reaches it.
Code complete and tested locally; branched cleanly on top of OA-54
(Shift & Save landing rebrand, merged separately in parallel — unrelated
to this work).

## State

- OA-47 through OA-54 (plus hotfixes) and the OA-5/OA-20 engineering
  slice (PR #9) are merged to `main`. The Connect Octopus UI is live on
  beta, but submitting the form does nothing useful yet — no backend is
  reachable until this deploy wiring lands **and** the GCP setup below
  is done.
- OA-54 rebranded the app from "Octopus Agent" to "Shift & Save"
  (header, landing copy) — unrelated to this slice, already merged.
- This change: Firestore-backed `octopus_connections` store
  (`server/src/octopusStore.js`), SQLite table removed, router takes an
  injected `store` (tests use an in-memory fake — 21 server tests pass).
  `deploy-server.yml` (Cloud Run, test-gated, triggers on `server/**`
  changes) and a Firebase Hosting rewrite (`/api/**` → the Cloud Run
  service) are scaffolded but **unverified** — no GCP credentials exist
  in this environment to test an actual deploy.
- Web app unchanged by this slice — `api/client.ts`'s relative
  `/api/...` calls work either way, by design (same-origin via the
  Hosting rewrite once deployed).

## Next step

1. Commit this on a new branch off `main` (e.g.
   `oa-5-cloud-run-firestore`, already checked out), push, open a PR,
   get it through CI (lint/build/test only — nothing here can be
   deploy-verified by CI), merge.
2. Steve does the one-time GCP setup in README.md's "Server deployment
   (Cloud Run)" section — none of it is something this session can do
   (no GCP console/CLI access, no credentials). That section has the
   full checklist.
3. After that setup, the next push to `main` touching `server/**`
   actually deploys. Confirm via the OA-5 beta verification steps.

## Key references

- `server/src/octopusStore.js` — `createFirestoreOctopusStore()`,
  `{ upsert, get, remove }` keyed by Firebase UID.
- `server/test/helpers/fakeOctopusStore.js` — in-memory equivalent used
  by `server/test/octopus.test.js`.
- `server/src/firebaseApp.js` — shared Firebase Admin app singleton,
  pulled out of `firebaseAuth.js` so `octopusStore.js` can reuse it
  without a circular import.
- `.github/workflows/deploy-server.yml` — Cloud Run deploy, gated on
  `npm test` in `server/`, triggered on `server/**` changes to `main`.
- `firebase.json` — `/api/**` rewrite to the `energy-saving-server`
  Cloud Run service (`europe-west2`), ahead of the catch-all SPA
  rewrite (order matters — first match wins).
- README.md "Server deployment (Cloud Run)" — the full one-time GCP
  setup checklist.

## Decisions

- Firestore chosen (over e.g. Cloud SQL) because it's already inside
  the `shiftandsaveapp` Firebase project — no new vendor, no new
  connection-string secret, and `firebase-admin` is already a server
  dependency (added for ID token verification in OA-5).
- The web app needs **no changes** for this: `api/client.ts` already
  calls relative `/api/...` paths, and Firebase Hosting's `run` rewrite
  makes Cloud Run appear same-origin to the browser — no CORS dance,
  no new base-URL config to thread through the build.
- `europe-west2` (London) chosen as the Cloud Run region, matching the
  product's UK audience — easy to change in both
  `deploy-server.yml` and `firebase.json` together if Steve prefers
  otherwise.
- Old SQLite `users`/`sessions`/`consents` tables and `server/src/db.js`
  itself are left in place untouched — they're already dead code since
  OA-50 (Firebase Auth replaced them), removing them is a separate,
  unrelated cleanup not in scope here.
- Deploy auth uses a GCP service account JSON key as a GitHub secret
  (`GCP_SERVER_DEPLOY_SA_KEY`), matching the existing
  `FIREBASE_SERVICE_ACCOUNT_BETA` pattern from OA-49, rather than
  introducing Workload Identity Federation — more setup steps for a
  security benefit not obviously needed yet at this project's size.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` for production lives in Secret Manager, not a GitHub
  Actions secret or plain Cloud Run env var — it's mounted at deploy
  time via `--set-secrets`.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- **Bootstrapping order**: the Cloud Run service must exist before
  Firebase Hosting's rewrite can reference it by name. First deploy:
  let `deploy-server.yml` run once, then re-run (or let the next push
  trigger) `deploy-beta.yml` so Hosting picks up the rewrite.
- `server/src/firebaseAuth.js`'s no-service-account token verification
  is still unverified against real traffic (noted in the prior OA-5
  HANDOFF entry) — once Cloud Run is live this becomes testable.
- Nothing about the Cloud Run deploy itself (service creation, IAM,
  Secret Manager) has been run or verified — this environment has no
  GCP credentials. Treat `deploy-server.yml` as scaffolded-but-unproven
  until Steve's GCP setup is done and a real deploy succeeds.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction from OA-49 still applies.
- Don't commit the beta test account's password, any Octopus API key,
  or the production `ENCRYPTION_KEY` anywhere in this repo.
