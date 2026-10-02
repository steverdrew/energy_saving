# HANDOFF

_Last updated: 2026-10-02 (OA-59, OA-58, OA-6, OA-21, OA-22, OA-8 implemented this session)_

## Current task

None in progress. OA-21's methodology was reviewed and **signed off by
Steve** (2026-10-02, see `docs/SAVINGS_METHODOLOGY.md` Decisions). With
that gate cleared, OA-22's comparison maths is now wired into a real
`GET /api/octopus/savings-result` endpoint, and OA-8's result screen
(`src/pages/SavingsPage.tsx`) is built and shows a real £ estimate.
OA-59, OA-58, OA-6, OA-21, OA-22, OA-8 are all implemented, tested, and
pushed to `claude/dazzling-ritchie-nofudq`. Nothing is
deployed/verified live on beta yet.

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
- **OA-21/OA-22/OA-8**: "See my savings" now returns a real result
  instead of the old `501` stub. `GET /api/octopus/savings-result`
  reads the imported consumption + current-tariff rates
  (`octopusImports`), looks up the currently-on-sale Agile product for
  the user's region (`fetchActiveAgileTariffCode`), fetches Agile's
  rates for the same period, and runs
  `compareCurrentTariffToAgile` (`server/src/savingsComparison.js`).
  Response is explicitly flagged `unitRateOnly: true`. `SavingsPage`
  shows the headline (Agile cheaper / current tariff cheaper / about
  the same), the mandatory "unit rates only, no standing charge"
  caveat at equal visual weight, and an annualised projection only
  when there's an actual saving to project — wording follows
  `docs/SAVINGS_METHODOLOGY.md`'s final trust copy exactly, per
  Steve's sign-off.
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

1. **fetchActiveAgileTariffCode (`server/src/octopusClient.js`) has
   never been run against the real Octopus API** — this sandbox has no
   network access to `api.octopus.energy` (outbound is proxied and
   that host isn't allow-listed). It's built from the documented
   `/v1/products/` shape and unit-tested with a mocked `fetch`, but
   Steve should sanity-check it against a real response (e.g. hit
   `https://api.octopus.energy/v1/products/?page_size=100` directly)
   before relying on it. This is the single highest-risk unverified
   assumption in OA-8's result — if the real product list shape
   differs, `/savings-result` will 502 rather than show a wrong number
   (fails closed), but worth confirming before wider beta use.
2. Manually spot-check the full chain live on beta once deployed:
   connect → import → "See my savings" shows a real, sane £ figure
   with the caveat visible; Account page reflects real connection
   state after a refresh; `/` redirects when signed in.
3. Pick up the next roadmap items: OA-9/OA-30/OA-31 (cheapest windows,
   appliance profiles, manual guidance), OA-40/OA-43 (recommend an
   action with £ value), OA-41 (running saved-so-far total) — all
   build on OA-8 now existing.
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
- OA-22: scoped to current-tariff-vs-Agile only (Steve's explicit
  instruction — not every Octopus tariff). Unit rates only, no standing
  charge, over whatever window OA-6 imported — see
  `docs/SAVINGS_METHODOLOGY.md` for the full scope statement and why.
- OA-21: drafted the methodology/trust copy myself rather than waiting,
  since it's cheap to draft and expensive to block on. Steve then
  answered all three open questions (unit-rate-only OK, 30 days OK,
  trust copy needed more explicit in-line caveats) — recorded as
  Decisions in `docs/SAVINGS_METHODOLOGY.md`, which now carries his
  sign-off date. The result shape is deliberately labelled
  `unitRateOnly: true` so adding standing charges later is an upgrade
  to this same shape, not a silent meaning change (Steve's instruction).
- OA-8: annualised saving is only shown when Agile would have been
  cheaper (`estimatedSavingPence > 0`) — projecting an annualised
  *negative* saving read oddly, so when the current tariff is already
  cheaper, the headline alone carries the message, no annualised line.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` lives in Secret Manager only, mounted at deploy time
  via `--set-secrets` — generated and entered by Steve directly into
  Secret Manager, never shared in chat.
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes — **cleared 2026-10-02**; any
  £ figure shown must still carry the unit-rate-only caveat at equal
  visual weight (Steve's explicit instruction, not just a docs note).
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
