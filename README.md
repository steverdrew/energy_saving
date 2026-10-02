# Octopus Agent (energy_saving)

A PWA that helps Octopus Energy customers find savings on their tariff.

- **Web app** (`/`): Vite + React 19 + TypeScript, react-router, vitest, oxlint.
- **Server** (`server/`): Express 5, plain JavaScript (ESM), better-sqlite3, cookie-based session auth.

Real Octopus Energy integration is not implemented yet — see "Octopus API
stubs" below.

## Prerequisites

- Node.js 22+ (for the `node --env-file` flag and the server's built-in test runner).

## Running locally

### 1. Server

```bash
cd server
npm install
cp .env.example .env   # fill in CLIENT_ORIGIN and DATABASE_PATH
npm run dev
```

The server fails fast on startup if a required environment variable is
missing — see `server/.env.example` for the full list and defaults.

By default it listens on `http://localhost:4000`.

### 2. Web app

In a separate terminal, from the repo root:

```bash
npm install
cp .env.example .env   # currently no variables are required; see the file
npm run dev
```

The web app runs on `http://localhost:5173` (Vite's default) and proxies
`/api/*` requests to the server at `http://localhost:4000` (configured in
`vite.config.ts`).

## Scripts

### Web app (repo root)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build for production (`dist/`) |
| `npm run lint` | Run oxlint |
| `npm test` | Run vitest |
| `npm run check-bundle` | Fail if any server env variable name appears in `dist/` (run after `build`) |
| `npm run preview` | Preview the production build |

### Server (`server/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the server with `node --watch` |
| `npm start` | Start the server |
| `npm test` | Run the server's tests (Node's built-in test runner) |

## Environment variables

See `.env.example` (web) and `server/.env.example` (server) for the full,
documented list. The server throws on startup if any required variable is
missing.

## Octopus API stubs

`POST /api/octopus/connect`, `GET /api/octopus/import-status` and
`GET /api/octopus/savings-result` exist as authenticated boundary stubs.
They currently return `501 { "error": "Not implemented" }`. Real Octopus
Energy integration is out of scope for this change (tracked in OA-5, OA-6;
blocked on OA-26, OA-20).

## Conventions and constraints

See `CLAUDE.md`. Current project state, decisions and next steps are in
`HANDOFF.md`.
