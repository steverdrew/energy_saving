# HANDOFF

_Last updated: 2026-10-02 (OA-59, OA-58, OA-6 implemented this session)_

## Current task

None in progress. OA-59 (stale connection state), OA-58 (authenticated
home state) and OA-6 (import tariff + consumption history) are
implemented, tested, and pushed to `claude/dazzling-ritchie-nofudq`.
Not yet deployed/verified live on beta by Steve. Next work per Steve's
stated roadmap order is OA-21 (savings methodology/trust copy) and
OA-22 (compare current tariff vs Agile using the now-imported history).

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
- **OA-59**: Account, Connect Octopus and future authenticated pages now
  share one `OctopusConnectionProvider`
  (`src/octopus/OctopusConnectionContext.tsx`) instead of each fetching
  `/api/octopus/connection` independently — fixes Account always
  showing "connect your account" even when already connected. Also
  removed the duplicate Sign out button on the Account page (header nav
  already has one).
- **OA-58**: `/` now redirects a signed-in visitor to `/account`
  (`HomeRoute` in `src/App.tsx`) instead of always showing the
  signed-out marketing landing page with a "sign in" CTA.
- **OA-6**: real tariff + half-hourly consumption import is live.
  - `POST /api/octopus/import` fetches the last 30 days of half-hourly
    consumption (`fetchElectricityConsumption`, requires the user's own
    API key) and standard unit rates (`fetchTariffUnitRates`, public
    product data) for the connected meter/tariff, and stores both in a
    new Firestore collection `octopusImports`
    (`server/src/octopusImportStore.js`), keyed by Firebase UID.
  - `GET /api/octopus/import-status` returns a summary (point counts,
    period, `importedAt`) instead of the old `501` stub.
  - Connect Octopus page has an "Import my usage history" button once
    connected, showing the point counts/date range back.
  - 30-day window is deliberately small for this MVP — see Decisions.
  - `summarizeOctopusAccount` now also captures the meter
    `serialNumber` (needed for the consumption endpoint), stored
    alongside the existing `mpan`/`tariffCode` in each connection's
    `meterContext`.

## Next step

1. Steve to review real imported data (point counts, actual rate/usage
   shape) on beta before OA-22's comparison maths gets built against
   it — this was the explicit gate before building the comparison.
2. OA-21 (savings methodology/trust copy) and OA-22 (current tariff vs
   Agile comparison) are next per Steve's stated order; OA-22 can now
   read real history from the `octopusImports` Firestore doc instead of
   needing fixtures.
3. Manually spot-check OA-59/OA-58/OA-6 live on beta once deployed:
   Account page reflects real connection state after a refresh; `/`
   redirects when signed in; Import button works with a real account
   and real Octopus history comes back sane.
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
- OA-6: import window fixed at 30 days (`IMPORT_WINDOW_DAYS` in
  `server/src/routes/octopus.js`), not full history. Keeps each import
  request fast and each `octopusImports` Firestore doc well under the
  1MiB document limit (30 days half-hourly ≈ 1,440 points per series).
  Revisit once Steve has reviewed real imported data — a longer window
  may need chunked/paginated storage rather than one doc per user.
- OA-6: the Cloud Run runtime service account already has "Cloud
  Datastore User", which covers the new `octopusImports` collection too
  — no IAM change needed for this feature.

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
