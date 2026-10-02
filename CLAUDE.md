# CLAUDE.md

Conventions and constraints for working on this repo.

## Structure

- `src/` — Vite + React 19 + TypeScript PWA (web app).
- `server/` — Express 5 backend, plain JavaScript (ESM), better-sqlite3, cookie session auth.
- `src/api/client.ts` — the **only** module the web app may use to call the server. Never call `fetch('/api/...')` directly from a page or component.

## Commands

Web app (repo root): `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run check-bundle`.

Server (`server/`): `npm run dev`, `npm start`, `npm test`.

## Hard constraints

- No secrets or credentials in browser code, the built bundle, or the repo. The `check-bundle` script enforces this for server env variable names; it is run in CI after `npm run build`.
- Never log credentials or full account numbers.
- Currency is GBP. Times are stored/handled in UTC and displayed in Europe/London.
- SQLite database files stay out of git (`server/.gitignore` covers `data/*.db*` and `.env`).
- The server must fail fast (throw on startup, not silently fall back) if a required environment variable is missing. See `server/src/config.js`.

## Working conventions

- The server stays plain JavaScript (ESM) — do not convert it to TypeScript as part of an unrelated change.
- Don't swap libraries (e.g. better-sqlite3, bcryptjs, Express) without a dedicated ticket.
- New server routes that need a signed-in user must use the `requireAuth` middleware (`server/src/auth.js`).
- Keep agent sessions short: if context grows large mid-task, update `HANDOFF.md` with current state and next step, and continue in a fresh session rather than guessing from a compacted context.
- If a decision isn't covered by ticket scope or these conventions, pick the simplest option, record it in `HANDOFF.md` under Decisions, and carry on — don't stop to ask.
- Stop and report only if the task needs a real credential, a paid service, or a change of scope.
