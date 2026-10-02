# HANDOFF

_Last updated: 2026-10-02 (OA-5/OA-20: live and verified on beta — ready for Steve's sign-off)_

## Current task

None in progress. OA-5/OA-20 is functionally complete and verified live
on beta by Steve. Next work is whatever Steve picks next (OA-6 roadmap
item mentioned earlier, or OA-21/OA-26 sign-off follow-through).

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
- "See my savings" link intentionally hits a `501` stub
  (`savings-result` endpoint) — by design, gated behind OA-21 sign-off.
  Not a bug if Steve or anyone clicks it.

## Next step

Nothing blocking. Options for Steve to pick from:
1. Manually spot-check the remaining DoD items (wrong API key → clear
   error; disconnect button; a second test account can't see the first
   user's connection) if extra confidence is wanted before calling OA-5
   fully signed off.
2. Move to OA-21 (savings methodology sign-off) or OA-26 — both are
   sign-off gates, not coding tickets; I can read them and report
   blockers/prerequisites but can't declare them passed.
3. Pick up OA-6 or another roadmap ticket.
4. Update README.md's "Server deployment (Cloud Run)" checklist to match
   the real working IAM configuration (listed below) — currently stale,
   purely a documentation cleanup, no urgency.

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

- Firestore chosen (over e.g. Cloud SQL) — already inside the
  `shiftandsaveapp` Firebase project.
- `europe-west2` (London) chosen as the Cloud Run region.
- Kept the Dockerfile switch (PR #13) even after ruling out
  native-module compilation as the actual deploy blocker.
- Old SQLite `users`/`sessions`/`consents` tables and `server/src/db.js`
  itself left in place untouched — dead code since OA-50, unrelated
  cleanup not in scope here.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` lives in Secret Manager only, mounted at deploy time
  via `--set-secrets` — generated and entered by Steve directly into
  Secret Manager, never shared in chat.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes.
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
