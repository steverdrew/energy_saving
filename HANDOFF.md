# HANDOFF

_Last updated: 2026-10-02 (merge of OA-47 + OA-49)_

## Current task

Merging OA-47 (cloud-ready repo: CI, server tests, docs, env config,
Octopus stubs, typed API client, bundle check) and OA-49 (continuous beta
deployment to Firebase Hosting) into `main`.

## State

- **OA-47**: merged to `main` (PR steverdrew/energy_saving#1). CI
  (`.github/workflows/ci.yml`) green on both jobs before merge.
- **OA-49**: this branch (`claude/oa-49-beta-deploy`, PR
  steverdrew/energy_saving#2) is being merged into `main` after OA-47.
  Merging OA-47 first created a real conflict (both touched
  `README.md`/`HANDOFF.md`) — resolved by hand in this merge commit:
  kept OA-47's README structure and appended OA-49's "Beta deployment"
  section; this HANDOFF.md replaces both branches' versions.

Once this merge lands on `main`, `.github/workflows/deploy-beta.yml`
fires for real — that's OA-49's required first deployment.

## Next step

After this merge commit is pushed: watch the `deploy-beta` GitHub Actions
run on `main`. Confirm `https://shiftandsaveapp.web.app` is live and
`/debug` shows this merge commit's SHA. If it fails, check the
`FIREBASE_SERVICE_ACCOUNT_BETA` secret is present and the Hosting site
resolves as expected (see OA-49 Gotchas below).

## Open items

- `deploy-beta.yml` doesn't run `npm run check-bundle` even though that
  script now exists on `main` (from OA-47). Worth adding back as a
  pre-deploy gate in a follow-up — not done in this merge to keep the
  conflict resolution minimal.
- Firebase Hosting's default site URL (`https://shiftandsaveapp.web.app`)
  is assumed, not yet confirmed against a real deploy.

## Key references

- Tickets: OA-47, OA-3 (epic) / OA-49, Jira Octopus Agile project.
- PRs: steverdrew/energy_saving#1 (merged), #2 (OA-49).
- `server/src/config.js` — required server env vars.
- `src/api/client.ts` — web↔server boundary.
- `.github/workflows/ci.yml` — lint/build/test CI.
- `.github/workflows/deploy-beta.yml` — beta deploy on push to `main`.
- `scripts/check-bundle.mjs` — secret-leak guard (not yet wired into
  deploy-beta.yml, see Open items).
- `firebase.json`, `.firebaserc` — Hosting config (project
  `shiftandsaveapp`).
- `src/pages/DebugPage.tsx` (`/debug`) — build/commit identification.

## Decisions

From OA-47:
- Node 22's built-in `node --test` + `supertest` for server tests, not a
  new framework.
- No `dotenv`; server scripts use `--env-file-if-exists=.env`.
- `DATABASE_PATH` required, not defaulted; `:memory:` special-cased in
  `server/src/db.js` (must not be path-joined); parent dir created on
  demand for real paths.
- No `COOKIE_SECRET` — session IDs are already random tokens looked up
  server-side.
- Bundle check matches server env var *names* in built `dist/` files;
  not a general secret scanner.
- No server TypeScript conversion, no library swaps — out of scope.

From OA-49:
- **Scope: Hosting only.** The app's auth/data layer (Express +
  better-sqlite3) is not Firebase; this deploys the static build only.
  `/api/*` against the beta URL won't reach a real backend until a
  separate ticket addresses that.
- Firebase project ID is `shiftandsaveapp` (confirmed by Steve; note the
  project *number*, `761386319734`, is a different identifier and not
  usable here).
- Deploys straight to Hosting's live channel on push to `main` (not a PR
  preview channel) — matches "a merged ticket automatically produces a
  fresh beta deployment."
- Build-time version injection via Vite `define`, not a runtime fetch —
  no backend is deployed to beta to serve that from.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- SQLite db files stay out of git.
- Keep production deployment separate, manual, and gated.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- `DATABASE_PATH=:memory:` must never be path-joined — see the
  special-case in `server/src/db.js`.
- WAL journal mode is skipped for `:memory:` (unsupported, caused
  `SQLITE_BUSY` under the test runner).
- Root `vite.config.ts` test `include` is scoped to
  `src/**/*.test.{ts,tsx}` so Vitest doesn't also try to run the
  server's `node:test`-style files.
- `server/package.json`'s `dev`/`start` need
  `--env-file-if-exists=.env`, or `server/.env` is silently ignored.
- `vite.config.ts`'s Vitest `test` field needs
  `/// <reference types="vitest/config" />` to typecheck with `tsc -b`.
- Firebase project **number** vs project **ID** are different
  identifiers — tooling here needs the ID (`shiftandsaveapp`).
- Firebase Hosting's SPA rewrite (`**` → `/index.html`) means any
  `/api/*` path against the beta Hosting URL returns `index.html`, not a
  real API response — expected, no backend is deployed to beta.
