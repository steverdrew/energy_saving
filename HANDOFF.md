# HANDOFF

_Last updated: 2026-10-02 06:10 UTC_

## Current task

OA-47 — make the existing app cloud-ready: CI, server tests, repo docs,
env config, Octopus API boundary stubs, typed API client, bundle check.

## State

Done, verified locally, not yet committed/pushed/PR'd:

- Docs: `README.md` rewritten, `CLAUDE.md` added, this file added.
- Env config: `.env.example` (root) + `server/.env.example`;
  `server/src/config.js` makes the server throw on startup if
  `CLIENT_ORIGIN` or `DATABASE_PATH` is missing; `server/.gitignore` now
  also excludes `.env`.
- CI: `.github/workflows/ci.yml` — web job (lint, build, `check-bundle`,
  test) and server job (test, start + `/api/health` curl check).
- Server tests: `server/test/*.test.js` using Node's built-in
  `node --test` + `supertest` — health, signup/login/me (incl. wrong
  password, missing consent), and the three Octopus stub routes.
- Octopus stubs: `server/src/routes/octopus.js` —
  `POST /connect`, `GET /import-status`, `GET /savings-result`, all
  behind `requireAuth`, all `501 { "error": "Not implemented" }`.
- Typed API client: `src/api/client.ts` is now the only module that calls
  the server from the web app; `src/auth/AuthContext.tsx` refactored to
  use it.
- Bundle check: `scripts/check-bundle.mjs` (`npm run check-bundle`) scans
  `dist/` for server env variable names; wired into CI after the build.
- `server/src/index.js` exports `createApp()` for tests and only calls
  `app.listen` outside `NODE_ENV=test`.

Verified locally: `npm run lint`, `npm run build`, `npm run check-bundle`,
`npm test` (web, 6 tests) from repo root; `npm test` (13 tests) from
`server/`; manual server start + `/api/health` curl from a clean checkout.

## Next step

Commit all pending changes (see `git status`), push branch
`claude/friendly-franklin-f3he6k`, and open one pull request against
`main`. Confirm GitHub Actions CI is green on the PR (not run in this
sandbox).

## Open items

None blocking. PR not yet opened.

## Key references

- Ticket: OA-47 (Jira, Octopus Agile project).
- `server/src/config.js` — required env vars.
- `src/api/client.ts` — web↔server boundary.
- `.github/workflows/ci.yml` — CI jobs.
- `scripts/check-bundle.mjs` — secret-leak guard.

## Decisions

- **Test runner (server):** Node 22's built-in `node --test` +
  `supertest` (new devDependency) instead of adding Jest/Vitest —
  smallest addition.
- **Env loading:** no `dotenv` dependency; Node 22's `--env-file` covers
  local `.env` loading if wanted. Server just reads `process.env` and
  fails fast via `config.js`.
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
