# HANDOFF

_Last updated: 2026-10-02 (OA-5/OA-20: Cloud Run server deploy succeeded)_

## Current task

Server deploy is live. Confirm the OA-5 Definition of Done end-to-end on
the real beta URL: authenticated Connect Octopus flow, Steve entering his
own real Octopus credentials directly into the deployed page (never via
chat), server-side validation, persisted connection state, cross-user
isolation.

## State

- OA-5/OA-20 application code (Firestore store, encrypted credentials,
  Connect Octopus UI, server routes) is merged and tested — 21 server
  tests pass.
- **`energy-saving-server` Cloud Run deploy succeeded** (run 36991131641,
  attempt 7, 2026-10-02T12:13 UTC) — live at
  `https://energy-saving-server-zz3rxj7nfq-nw.a.run.app`.
- Getting here took 7 attempts, each blocked by a different IAM/config
  gap (see Gotchas for the full list) — the key lesson is that
  `gcloud run deploy --source` involves **three separate identities**
  (the deploying SA, the Cloud Build default SA, and whichever SA Cloud
  Build's project-level "Permissions" page has selected — which turned
  out to be the **default Compute Engine SA**, not the Cloud Build
  default SA), each needing its own grants.
- `deploy-beta.yml` (Firebase Hosting) has not yet been re-triggered
  since the Cloud Run service started existing — this HANDOFF commit
  does that (push to `main`, no path filter on that workflow).

## Next step

1. Confirm the triggered `deploy-beta.yml` run (from this commit)
   succeeds, and that `https://shiftandsaveapp.web.app/api/health`
   resolves through the Hosting rewrite (not a 404/502).
2. Steve: open `/connect-octopus` on `https://shiftandsaveapp.web.app`
   while signed in, enter your real Octopus account number + API key
   directly into the page (never paste them here), submit, and confirm
   it shows a connected state.
3. Refresh the page and confirm the connected state persists (Firestore
   read on load).
4. Report back what you see — success, or the specific error shown — and
   I'll check server-side logs for a log-safe diagnosis (no credentials,
   no full account numbers) if anything's wrong.

## Key references

- `server/src/octopusStore.js` — `createFirestoreOctopusStore()`,
  `{ upsert, get, remove }` keyed by Firebase UID.
- `server/Dockerfile` / `server/.dockerignore` — explicit Docker build
  (PR #13). Kept even though the native-module-compile hypothesis it was
  meant to test turned out not to be the actual blocker — it's a strict
  improvement (explicit, inspectable build) regardless.
- `.github/workflows/deploy-server.yml` — Cloud Run deploy, gated on
  `npm test` in `server/`, triggered on `server/**` changes to `main`.
- `.github/workflows/deploy-beta.yml` — Firebase Hosting deploy,
  triggered on every push to `main` (no path filter).
- `firebase.json` — `/api/**` rewrite to the `energy-saving-server`
  Cloud Run service (`europe-west2`).
- Deployed server URL: `https://energy-saving-server-zz3rxj7nfq-nw.a.run.app`
  (direct; normally reached via the Hosting rewrite at
  `https://shiftandsaveapp.web.app/api/**`).
- Successful run: 36991131641, attempt 7.

## Decisions

- Firestore chosen (over e.g. Cloud SQL) — already inside the
  `shiftandsaveapp` Firebase project.
- `europe-west2` (London) chosen as the Cloud Run region.
- Kept the Dockerfile switch (PR #13) even after ruling out
  native-module compilation as the actual blocker, since it's a strict
  improvement over relying on auto-detected Buildpacks.
- Old SQLite `users`/`sessions`/`consents` tables and `server/src/db.js`
  itself left in place untouched — dead code since OA-50, unrelated
  cleanup not in scope here.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- `ENCRYPTION_KEY` lives in Secret Manager only, mounted at deploy time
  via `--set-secrets` — never a plain env var or GitHub Actions secret
  in transit, never generated or pasted into chat (Steve generated it
  himself with `openssl rand -base64 32` and pasted it directly into
  Secret Manager's console).
- Octopus API key: encrypted at rest, never logged, never returned to
  the browser after submission.
- No £ savings claims until OA-21 passes.
- This session has no GCP console or CLI credentials — every IAM grant
  needs Steve to do it in the GCP Console.

## Gotchas

- **Bootstrapping order**: the Cloud Run service must exist before
  Firebase Hosting's rewrite can reference it by name. It exists now;
  this commit's push triggers `deploy-beta.yml` to pick that up.
- **Full IAM/config fix list from this session** (reflects the real
  working configuration — README.md's checklist still needs updating to
  match, not yet done):
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
    Datastore User, **Artifact Registry Writer** — this turned out to be
    the SA Cloud Build actually builds as (see below), so this last
    grant was the one that finally fixed the image push.
  - `761386319734@cloudbuild.gserviceaccount.com` (Cloud Build default
    SA) also has Artifact Registry Writer + Cloud Build Service Account
    role granted directly on the `cloud-run-source-deploy` Artifact
    Registry repo — turned out not to be the actual builder identity for
    this project, but harmless to leave in place.
  - **Root cause of the IAM confusion**: GCP Console → Cloud Build →
    Permissions page lets a project select which service account Cloud
    Build uses to execute builds. This project had it set to the
    **default Compute Engine SA**, not the conventional Cloud Build
    default SA — so grants to the latter had no effect. Fixed by
    enabling "Artifact Registry Writer" directly on that page's role
    list for the compute SA.
  - Secret Manager API was disabled for the project — enabled via
    console.
  - `ENCRYPTION_KEY` secret didn't exist in Secret Manager — created by
    Steve (value generated locally, never shared in chat).
- `server/src/firebaseAuth.js`'s no-service-account token verification
  is still unverified against real traffic — now testable since Cloud
  Run is live.
- The Firebase project **ID** (`shiftandsaveapp`) vs. **number**
  (`761386319734`) distinction still applies.
- Don't commit the beta test account's password, any Octopus API key,
  or the production `ENCRYPTION_KEY` anywhere in this repo.
