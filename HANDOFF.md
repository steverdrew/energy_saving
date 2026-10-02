# HANDOFF

_Last updated: 2026-10-02 (OA-5/OA-20: Cloud Run deploy blocked on Cloud Build logging IAM)_

## Current task

Get the `energy-saving-server` Cloud Run deploy to actually succeed, so
the already-merged OA-5/OA-20 Connect Octopus flow becomes reachable on
beta. All application code is done and tested; this is now purely a GCP
IAM blocker.

## State

- OA-5/OA-20 application code (Firestore store, encrypted credentials,
  Connect Octopus UI, server routes) is merged and tested — 21 server
  tests pass. Not yet reachable on beta: the backend has never
  successfully deployed.
- `deploy-server.yml` has failed 6 times in a row (run 36983420655
  attempts 1-5, then run 36991131641 after the Dockerfile switch), each
  time with `ERROR: (gcloud.run.deploy) Build failed; check build logs
  for details` and no further detail.
- Attempts 1-5 fixed real, visible IAM gaps one at a time (Artifact
  Registry, Storage bucket, Storage object, missing logging role on the
  **default Compute Engine service account**) — all fixed, but the
  generic "Build failed" error persisted.
- Switched the deploy from Buildpacks to an explicit `server/Dockerfile`
  (PR #13, merged), on the hypothesis that `better-sqlite3` (native
  module) was failing to compile under Buildpacks. **This hypothesis is
  now ruled out**: the Dockerfile deploy failed identically (confirmed
  via job logs: `Building using Dockerfile and deploying container...`
  then the same opaque failure, zero build output — just progress dots).
- **New diagnosis**: the complete absence of any build log output (not
  even Docker layer lines) means Cloud Build's own logs aren't being
  written/surfaced at all — a logging-permission problem, not a build
  problem. `gcloud run deploy --source` builds via Cloud Build, which
  runs as its own dedicated service account,
  `761386319734@cloudbuild.gserviceaccount.com` (the **Cloud Build**
  default SA) — a different identity from the default **Compute
  Engine** SA that was granted Logs Writer in an earlier attempt. That
  grant likely went to the wrong identity.

## Next step

Steve: in GCP Console → IAM (tick "Include Google-provided role grants"
if `761386319734@cloudbuild.gserviceaccount.com` isn't listed), grant
that service account:
- **Logs Writer** (`roles/logging.logWriter`)
- **Cloud Build Service Account** (`roles/cloudbuild.builds.builder`) if
  not already present

Then re-run `deploy-server.yml` (Actions tab → "Deploy server" → Re-run
failed jobs) or push any change to `server/**`. If it still fails, the
Dockerfile-based build should now (with working Cloud Build logs) finally
surface the real error — fetch it with `mcp__github__get_job_logs` on the
new run.

Once the server deploy succeeds: re-run/trigger `deploy-beta.yml` so
Firebase Hosting's `/api/**` rewrite can resolve the now-existing Cloud
Run service (see Gotchas — bootstrapping order).

## Key references

- `server/src/octopusStore.js` — `createFirestoreOctopusStore()`,
  `{ upsert, get, remove }` keyed by Firebase UID.
- `server/test/helpers/fakeOctopusStore.js` — in-memory equivalent used
  by `server/test/octopus.test.js`.
- `server/Dockerfile` / `server/.dockerignore` — explicit Docker build
  (PR #13), installs python3/make/g++ for `npm ci` then purges them.
  Confirmed picked up correctly by `gcloud run deploy --source`
  ("Building using Dockerfile..." in the job log) — did not fix the
  deploy; see diagnosis above.
- `.github/workflows/deploy-server.yml` — Cloud Run deploy, gated on
  `npm test` in `server/`, triggered on `server/**` changes to `main`.
- `firebase.json` — `/api/**` rewrite to the `energy-saving-server`
  Cloud Run service (`europe-west2`), ahead of the catch-all SPA
  rewrite (order matters — first match wins).
- README.md "Server deployment (Cloud Run)" — the one-time GCP setup
  checklist; **stale** re: IAM roles (several were added reactively
  this session and aren't reflected back into it yet — see Gotchas).
- Failed run IDs for reference: 36983420655 (Buildpacks, 5 attempts),
  36991131641 (Dockerfile, same opaque failure).

## Decisions

- Firestore chosen (over e.g. Cloud SQL) because it's already inside
  the `shiftandsaveapp` Firebase project.
- `europe-west2` (London) chosen as the Cloud Run region.
- Switched Buildpacks → explicit Dockerfile to rule out a native-module
  compile failure as the cause of the opaque build error. Confirmed this
  was not the cause; kept the Dockerfile anyway since it's a strict
  improvement (explicit, inspectable build) regardless of the real fix.
- Old SQLite `users`/`sessions`/`consents` tables and `server/src/db.js`
  itself are left in place untouched — dead code since OA-50, unrelated
  cleanup not in scope here.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` for production lives in Secret Manager, mounted at
  deploy time via `--set-secrets` — never a plain env var or GitHub
  Actions secret in transit.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes.
- This session has no GCP console or CLI credentials (`gcloud auth
  list` → no credentialed accounts) — every IAM grant needs Steve.

## Gotchas

- **Bootstrapping order**: the Cloud Run service must exist before
  Firebase Hosting's rewrite can reference it by name. First successful
  deploy: let `deploy-server.yml` run once, then re-run (or let the next
  push trigger) `deploy-beta.yml` so Hosting picks up the rewrite.
- **IAM roles granted reactively this session** (not yet reflected in
  README.md's checklist):
  - `github-deploy@shiftandsaveapp.iam.gserviceaccount.com`: Artifact
    Registry Administrator, Cloud Build Editor, Cloud Run Admin,
    Service Account User, Storage Admin.
  - `firebase-adminsdk-fbsvc@shiftandsaveapp.iam.gserviceaccount.com`:
    Cloud Run Viewer (added because Hosting deploys fail otherwise once
    `firebase.json` references a Cloud Run service by name).
  - `energy-saving-server-runtime@shiftandsaveapp.iam.gserviceaccount.com`
    (dedicated runtime SA, not the default compute SA): Cloud Datastore
    User, Secret Manager Secret Accessor.
  - Default Compute Engine SA (`761386319734-compute@developer.gserviceaccount.com`):
    Storage Object Viewer, Logs Writer, Secret Manager Secret Accessor,
    Cloud Datastore User — **this turned out to be the wrong identity
    for the "Build failed" symptom**; see Next step.
  - **Still needed**: Logs Writer (+ possibly Cloud Build Service
    Account role) on `761386319734@cloudbuild.gserviceaccount.com`, the
    Cloud Build default SA — not yet granted.
- `server/src/firebaseAuth.js`'s no-service-account token verification
  is still unverified against real traffic — only testable once Cloud
  Run is actually live.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction still applies — don't confuse the two
  service-account-style identities that both use the project number
  (compute default SA vs. Cloud Build default SA).
- Don't commit the beta test account's password, any Octopus API key,
  or the production `ENCRYPTION_KEY` anywhere in this repo.
