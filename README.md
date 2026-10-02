# Shift & Save (energy_saving)

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

## Beta deployment

The web app (`dist/`, from `npm run build`) deploys automatically to
Firebase Hosting on every push to `main`, via
`.github/workflows/deploy-beta.yml`. The build must pass lint, typecheck
and tests first — a failing build/test stops the job before Hosting is
touched, so a broken push never replaces the last working beta deploy.

- **Firebase project:** `shiftandsaveapp` (alias `beta` in `.firebaserc`).
- **Beta URL:** `https://shiftandsaveapp.web.app` (Firebase Hosting's
  default URL for this project's default site).
- **Build identification:** every deployed build embeds the commit SHA
  and build timestamp it was built from (via `vite.config.ts`'s `define`,
  reading `GITHUB_SHA` in CI). Visit `/debug` on the deployed app to see
  which commit and build time are currently live.
- **Production:** not set up by this change. Production deployment stays
  separate, manual, and gated until explicitly enabled.
- **Scope:** Hosting only — this deploys the static web build. The
  Express server (`server/`) is not deployed to beta; `/api/*` calls
  against the beta URL will not reach a real backend yet.

### Required repo secret

CI needs a Firebase service account key as the `FIREBASE_SERVICE_ACCOUNT_BETA`
GitHub Actions secret (Settings → Secrets and variables → Actions) to
authenticate the deploy step. Without it, the deploy step fails (the
build/test steps still run and report pass/fail independently).

### Reproducing a deploy locally

```bash
npm ci
npm run build
npx firebase-tools deploy --only hosting --project shiftandsaveapp
```

(Requires `firebase login` or `GOOGLE_APPLICATION_CREDENTIALS` pointing
at a service account key with Firebase Hosting deploy permissions.)

## Authentication (beta)

The web app signs in with **Firebase Authentication** (email + password),
scoped to the `shiftandsaveapp` Firebase project — the same project used
for Beta Hosting. `/login` is the sign-in screen; `/account` and other
protected routes redirect there when signed out. Session state persists
across refresh (Firebase's default browser persistence) and `useAuth()` /
`<ProtectedRoute>` (`src/auth/`) are how pages read and gate on it.

- The server's own auth routes (`server/src/auth.js`,
  `/api/auth/*`) are **not** used by the web app anymore — Firebase Auth
  replaced them for the web app as of OA-50. They remain in `server/` but
  are unreferenced by the client.
- Firebase's web SDK config (`src/firebase.ts`) is public client
  configuration, not a secret — it's protected by Firebase's own Security
  Rules, not by hiding it. Safe to read in the repo or the built bundle.
- Public self-service signup, password reset, social login and MFA are
  out of scope for this beta (see OA-50).

### Beta verification (OA-50)

Steve has a dedicated test account in **Firebase Console → Authentication
→ Users** for the `shiftandsaveapp` project (the password is not stored
anywhere in this repo, Jira, or CI). To verify on the deployed beta:

1. Visit `https://shiftandsaveapp.web.app/account` while signed out —
   confirm it redirects to `/login` (protected route check).
2. Sign in with the Firebase test account's email/password.
3. Confirm it lands on `/account` and shows the signed-in email.
4. Refresh the page — confirm you're still signed in (session persistence).
5. Click "Sign out" — confirm it returns you to a signed-out state and
   `/account` redirects to `/login` again.
6. Try an incorrect password — confirm a clear, non-technical error
   message appears (not a raw Firebase error code).

### Beta verification (OA-51: login → account → refresh → logout)

With the same Firebase test account:

1. Visit `https://shiftandsaveapp.web.app/login` while signed out, sign
   in — confirm you land on `/account` (not a dead end), showing your
   email, a "Find my saving" card, and a "Your savings" placeholder card.
2. Refresh `/account` — confirm you stay signed in and on `/account`
   (no bounce to `/login`, no flash of the login page first).
3. Visit `/login` directly while already signed in — confirm it
   redirects you straight to `/account` rather than showing the form.
4. Sign out from `/account` — confirm you return to a signed-out state.
5. Visit `/account` directly while signed out — confirm you're sent to
   `/login`, and that signing in from there lands you back on `/account`
   (not just the default landing page).

### Beta verification (OA-52: Sign in on the landing page)

1. Visit `https://shiftandsaveapp.web.app/` while signed out — confirm a
   "Sign in" link is visible in the header next to "Find my saving",
   and that "Find my saving" remains the visually dominant button.
2. Click "Sign in" — confirm it goes to `/login`.
3. Narrow the browser to a phone width (or use mobile) — confirm the
   header nav wraps instead of overflowing, and "Sign in" stays
   reachable and tappable.
4. Tab through the header with the keyboard only — confirm "Sign in" is
   reachable and activates with Enter.
5. Sign in with the Firebase test account, then revisit `/` — confirm
   the header now shows "Account" (routing straight to `/account`)
   instead of "Sign in".

### Beta verification (OA-53: My Savings is gated)

1. Visit `https://shiftandsaveapp.web.app/savings` directly while signed
   out — confirm it redirects to `/login` rather than showing the page.
2. Confirm the signed-out header nav does **not** show "My Savings"
   (only Home / Sign in).
3. Sign in from that redirect — confirm you land back on `/savings`
   (not `/account` or the homepage).
4. Confirm the signed-in header nav now shows "My Savings".
5. Refresh `/savings` while signed in — confirm you stay on the page,
   not bounced to `/login`.
6. Sign out — confirm `/savings` is no longer reachable and the nav
   item disappears again.

### Beta verification (OA-54: Shift & Save landing page)

1. Visit `https://shiftandsaveapp.web.app/` — confirm the header brand
   reads "Shift & Save" (not "Octopus Agent"), the hero reads "Take
   control of when you use energy — and what it costs you.", and the
   main CTA reads "See what I could save".
2. Confirm the 3-step flow reads "1. Connect", "2. See your saving",
   "3. Make it easy", and that no step implies the app will
   automatically switch tariff or control any device — the copy should
   read as "we show you", not "we do it for you".
3. Confirm the trust section includes "Your usage stays private. We
   never sell your data."
4. Confirm the footer link reads "What is Octopus Agile?" and goes to
   `/how-smart-tariffs-work`.
5. Click "See what I could save" — confirm it goes to `/login`, same as
   before.

## Connect Octopus (OA-5 / OA-20)

Authenticated users can connect their Octopus Energy account from
`/connect-octopus`, using the MVP account-number + API-key method (this
will be replaced by OAuth later).

- **Server-side only.** The web app never talks to Octopus directly —
  `server/src/octopusClient.js` makes the real call, authenticated with
  your Firebase ID token (`server/src/firebaseAuth.js` verifies it; no
  separate server-side session).
- **Encrypted at rest.** Both the account number and API key are
  encrypted (AES-256-GCM, `server/src/crypto.js`) before being stored in
  `octopus_connections`, keyed by Firebase UID. The API key is never
  returned to the browser after submission, in logs, or anywhere else —
  only a redacted form (`A-****1234`) and non-secret meter context
  (MPAN, tariff code) come back.
- **Ownership boundary.** Every row is keyed by Firebase UID; one user's
  connection is never readable by another (see
  `server/test/octopus.test.js`).
- **Disconnect** (`DELETE /api/octopus/connection`) removes the stored
  row entirely — no manual database step needed.

## Server deployment (Cloud Run)

`server/` deploys to **Cloud Run** on every push to `main` that touches
`server/**`, via `.github/workflows/deploy-server.yml` — same
test-before-deploy gate as `deploy-beta.yml`. Firebase Hosting proxies
`/api/**` to it (see `firebase.json`'s `run` rewrite), so the web app's
existing relative `fetch('/api/...')` calls keep working unchanged, same
origin, no CORS needed in practice.

Octopus connections (OA-5/OA-20) are stored in **Firestore**
(`server/src/octopusStore.js`), not SQLite — Cloud Run's filesystem
doesn't persist across container restarts or scale-to-zero, so SQLite's
file can't be the durable store for anything that needs to survive a
redeploy. The old `users`/`sessions`/`consents` SQLite tables are
unused dead code (Firebase Auth replaced them in OA-50) and are left
alone.

### One-time GCP setup (Steve — none of this can be done from this repo)

1. **Enable billing and APIs** on the `shiftandsaveapp` GCP project:
   Cloud Run, Cloud Build, Artifact Registry, Firestore.
2. **Create a Firestore database** (Firebase Console → Build →
   Firestore Database → Create, Native mode) if one doesn't exist yet —
   pick a region (e.g. `europe-west2`, matching the Cloud Run region
   below).
3. **Create a deploy service account** (e.g.
   `github-deploy@shiftandsaveapp.iam.gserviceaccount.com`) with roles:
   Cloud Run Admin, Cloud Build Editor, Artifact Registry Writer,
   Service Account User, Secret Manager Secret Accessor. Download its
   JSON key and add it as the GitHub Actions repo secret
   `GCP_SERVER_DEPLOY_SA_KEY` (Settings → Secrets and variables →
   Actions) — never paste the key itself anywhere else.
4. **Create a Secret Manager secret** named `ENCRYPTION_KEY` with a real
   generated value (`openssl rand -base64 32` — a *different* value from
   any used for local dev or CI). The deploy workflow mounts it into
   Cloud Run as an env var via `--set-secrets`; it's never stored in
   GitHub Actions itself.
5. **Grant the Cloud Run service's runtime service account** (the
   default compute service account, unless you configure a dedicated
   one) the `Cloud Datastore User` role, so it can read/write Firestore,
   and `Secret Manager Secret Accessor` on the `ENCRYPTION_KEY` secret.
6. **First deploy only**: the Cloud Run service must exist before
   Firebase Hosting's rewrite can reference it. Push to `main` once to
   let `deploy-server.yml` create the `energy-saving-server` Cloud Run
   service, *then* let `deploy-beta.yml`'s next run (or a manual
   `firebase deploy --only hosting`) pick up the rewrite.

None of this is verified end-to-end yet — there's no GCP access from
this environment to test an actual deploy. Once set up, the beta
verification steps above (OA-5's Connect Octopus flow) become testable
for real.

### Testing locally (either before, or regardless of, a live deploy)

```bash
cd server && npm install && cp .env.example .env   # fill in CLIENT_ORIGIN, DATABASE_PATH, ENCRYPTION_KEY
npm run dev

# separate terminal, repo root
npm install && npm run dev
```

Sign in at `http://localhost:5173/login` (needs a Firebase user — use
your own test account), then visit `/connect-octopus` and enter your own
Octopus account number and API key directly into the page. Nothing
about this requires pasting credentials anywhere outside that form.

## Conventions and constraints

See `CLAUDE.md`. Current project state, decisions and next steps are in
`HANDOFF.md`.
