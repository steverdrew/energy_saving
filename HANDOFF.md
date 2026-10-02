# HANDOFF

_Last updated: 2026-10-02 07:20 UTC_

## Current task

OA-49 — set up continuous beta deployment of the web app to Firebase
Hosting, triggered on merge to `main`, with a stable beta URL.

## State

Implemented and verified locally; not yet committed/pushed/PR'd.
**The actual first deployment has not happened yet** — that only runs
when this lands on `main` with the deploy secret in place (see Open
items), per the ticket's acceptance criteria.

Done:

- `firebase.json` — Hosting config: serves `dist/` with an SPA rewrite.
- `.firebaserc` — `beta` project alias set to `shiftandsaveapp` (the
  real Firebase project ID, confirmed by Steve).
- `vite.config.ts` — injects `__APP_COMMIT_SHA__` (from `GITHUB_SHA` in
  CI, else `'local'`) and `__APP_BUILD_TIME__` as build-time constants.
- `src/globals.d.ts` — ambient TS declarations for those two constants.
- `src/pages/DebugPage.tsx` + route `/debug` in `src/App.tsx` — not
  linked from nav, shows the running build's commit SHA and build time.
- `.github/workflows/deploy-beta.yml` — on push to `main`: install, lint,
  build, test, then deploy `dist/` to Firebase Hosting's live channel via
  `FirebaseExtended/action-hosting-deploy@v0`, using the
  `FIREBASE_SERVICE_ACCOUNT_BETA` secret. Build/test failures stop the
  job before Hosting is touched — last working beta stays live.
- `README.md` — added a "Beta deployment" section: beta URL, build
  identification via `/debug`, required secret, how to reproduce a
  deploy locally.

Verified locally: `npm run lint`, `npm run build`, `npm test` all pass;
`/debug` route resolves (200) under `npm run dev`; built bundle contains
the injected build constants.

## Next step

1. Confirm with Steve that the `FIREBASE_SERVICE_ACCOUNT_BETA` GitHub
   Actions secret has been added (he said he has the JSON key ready —
   he should add it via the repo's Settings → Secrets, never paste it
   here).
2. Commit, push this branch, open the PR against `main`.
3. Once merged, watch the `deploy-beta` Actions run — that's the ticket's
   required first real deployment. Confirm the beta URL
   (`https://shiftandsaveapp.web.app`) is live and `/debug` shows the
   merge commit's SHA.
4. Update README with the confirmed-live beta URL if it differs from the
   assumed default Hosting URL.

## Open items

- Deploy secret `FIREBASE_SERVICE_ACCOUNT_BETA` not yet confirmed as
  added to the repo (can't check from here; GitHub secrets are
  write-only). If missing, the deploy step in CI will fail clearly
  (build/lint/test still run and report independently) — not a silent
  failure, but still needs Steve to add it before merge is useful.
- Firebase Hosting's **default site ID assumption**: `firebase.json` has
  no explicit `site`, so it deploys to the project's default Hosting
  site, assumed reachable at `https://shiftandsaveapp.web.app`. Not
  verified against a real deploy yet — confirm once the first deploy
  runs.
- `deploy-beta.yml` does **not** run `npm run check-bundle` — that script
  only exists on the OA-47 branch (`claude/friendly-franklin-f3he6k`,
  PR #1), not yet on `main`. Add it back to this workflow once OA-47
  merges.

## Key references

- Ticket: OA-3 (epic) / OA-49 (story), Jira Octopus Agile project.
- `firebase.json`, `.firebaserc` — Hosting config.
- `vite.config.ts`, `src/globals.d.ts` — build-time version constants.
- `src/pages/DebugPage.tsx` — `/debug` route.
- `.github/workflows/deploy-beta.yml` — CI deploy job.
- Related: OA-47 is on a separate branch/PR
  (`claude/friendly-franklin-f3he6k`, steverdrew/energy_saving#1), not
  merged yet; this branch is independent of it (branched off `main`).

## Decisions

- **Scope: Hosting only.** Per Steve: this ticket deploys the static
  React/PWA build to Firebase Hosting. The Express + better-sqlite3
  backend is not deployed or wired into Firebase Auth/Firestore as part
  of this ticket, even though the ticket text mentions
  "Firebase Auth/Firestore/API integration works in beta." API calls
  from the beta URL will not reach a real backend — there isn't one
  deployed. Flag this if a future ticket expects `/api/*` to work
  against the beta URL.
- **Branched off `main`, not off the OA-47 branch** — OA-49 doesn't
  depend on OA-47's changes, and OA-47's PR isn't merged yet.
- **Live channel, not a preview channel.** `channelId: live` deploys
  straight to the default Hosting URL on every push to `main`, matching
  "a merged ticket automatically produces a fresh beta deployment."
  PR preview channels (a different, common use of this same GitHub
  Action) are out of scope here.
- **Build-time version injection via Vite `define`**, not a runtime
  fetch — no backend is deployed to beta to serve that from.
- **No production workflow added** — production stays manual/gated per
  the ticket; only `deploy-beta.yml` exists.

## Constraints and preferences

- No production secrets in the client or beta config.
- Keep production deployment separate, manual, and gated.
- Failed builds/tests must not replace the last working beta deploy.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- Firebase project **number** (e.g. `761386319734`) and project **ID**
  (e.g. `shiftandsaveapp`) are different identifiers — tooling here needs
  the ID. Confirmed with Steve; `shiftandsaveapp` is now in `.firebaserc`
  and the workflow's `projectId`.
- Firebase Hosting's SPA rewrite (`**` → `/index.html`) means any
  `/api/*` path requested against the beta Hosting URL just returns
  `index.html`, not a real API response — expected (see Decisions).
