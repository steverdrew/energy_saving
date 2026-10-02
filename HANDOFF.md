# HANDOFF

_Last updated: 2026-10-02 06:40 UTC_

## Current task

OA-47 — make the existing app cloud-ready: CI, server tests, repo docs,
env config, Octopus API boundary stubs, typed API client, bundle check.

## State

Done, committed, pushed, PR open:

- PR: https://github.com/steverdrew/energy_saving/pull/1 (branch
  `claude/friendly-franklin-f3he6k` → `main`).
- Docs: `README.md` rewritten, `CLAUDE.md` added, this file.
- Env config: `.env.example` (root) + `server/.env.example`;
  `server/src/config.js` makes the server throw on startup if
  `CLIENT_ORIGIN` or `DATABASE_PATH` is missing. `server/package.json`
  `dev`/`start` use `node --env-file-if-exists=.env` so following the
  README from a fresh clone actually picks up `server/.env` (this was
  missing and broken until fixed — see Gotchas).
- CI: `.github/workflows/ci.yml` — web job (lint, build, `check-bundle`,
  test) and server job (test, start + `/api/health` curl check).
- Server tests: `server/test/*.test.js` using Node's built-in
  `node --test` + `supertest` — health, signup/login/me (incl. wrong
  password, missing consent), and the three Octopus stub routes.
- Octopus stubs: `server/src/routes/octopus.js` —
  `POST /connect`, `GET /import-status`, `GET /savings-result`, all
  behind `requireAuth`, all `501 { "error": "Not implemented" }`.
- Typed API client: `src/api/client.ts` is the only module that calls the
  server from the web app; `src/auth/AuthContext.tsx` uses it.
- Bundle check: `scripts/check-bundle.mjs` (`npm run check-bundle`) scans
  `dist/` for server env variable names; wired into CI after the build.
- `vite.config.ts` has a `test` field (Vitest config) which needs
  `/// <reference types="vitest/config" />` to typecheck — added.

Verified by following README exactly from a **fresh clone**: server
`npm run dev`/`npm start` now load `server/.env` and pass the health
check; web `npm run dev` proxies `/api/health` through to it; `npm run
lint`, `npm run build`, `npm run check-bundle`, `npm test` (web, 6 tests)
and `server/`'s `npm test` (13 tests) all pass.

## Next step

Watch PR #1 for CI results and review comments; this branch's work is
otherwise complete. (Separately, OA-49 beta-deploy work is in progress on
branch `claude/oa-49-beta-deploy`, stashed mid-task — not part of this
branch.)

## Open items

None blocking on this ticket. PR #1 awaiting CI/review.

## Key references

- Ticket: OA-47 (Jira, Octopus Agile project). PR: steverdrew/energy_saving#1.
- `server/src/config.js` — required env vars.
- `src/api/client.ts` — web↔server boundary.
- `.github/workflows/ci.yml` — CI jobs.
- `scripts/check-bundle.mjs` — secret-leak guard.

## Decisions

- **Test runner (server):** Node 22's built-in `node --test` +
  `supertest` (new devDependency) instead of adding Jest/Vitest —
  smallest addition.
- **Env loading:** no `dotenv` dependency; `server/package.json` scripts
  use Node 22's `--env-file-if-exists=.env` so a local `server/.env` is
  picked up automatically without failing when it's absent (e.g. in CI,
  where real env vars are set directly).
- **DATABASE_PATH:** required, not defaulted, so missing config fails
  loudly. Tests use `:memory:`; `server/src/db.js` special-cases that
  value and creates the parent directory for real file paths (needed on
  a fresh clone where `server/data/` doesn't exist).
- **COOKIE_SECRET:** not added — session IDs are already 256-bit random
  tokens looked up server-side; cookie-parser is used unsigned, so a
  signing secret isn't needed.
- **Bundle check scope:** matches server env variable *names*
  (`CLIENT_ORIGIN`, `DATABASE_PATH`, `PORT`) in built `dist/` files.
  Covers the ticket's failure mode; not a general secret scanner.
- **No TypeScript conversion for the server, no library swaps** — out of
  scope per the ticket, not attempted.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo.
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- SQLite db files stay out of git.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session rather than guessing from compacted
  context.

## Gotchas

- `DATABASE_PATH=:memory:` must never be path-joined (it's a SQLite
  special value, not a real path) — see the special-case in
  `server/src/db.js`.
- WAL journal mode is skipped for `:memory:` — it isn't supported for
  in-memory SQLite and caused `SQLITE_BUSY` under the test runner.
- Root `vite.config.ts` test `include` is scoped to `src/**/*.test.{ts,tsx}`
  so Vitest doesn't also try (and fail) to run the server's
  `node:test`-style files.
- `server/package.json`'s `dev`/`start` must use
  `--env-file-if-exists=.env` (not plain `node ...`), or `server/.env`
  is silently ignored and the server throws "Missing required
  environment variable(s)" even after following the README exactly.
