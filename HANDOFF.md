# HANDOFF

_Last updated: 2026-10-02 (OA-54: Shift & Save landing page)_

## Current task

OA-54: update the public landing page to the Shift & Save
dynamic-tariff proposition (new hero, CTA, 3-step flow, stronger
privacy copy, link to the Agile explainer) and rebrand the app from
"Octopus Agent" to "Shift & Save" everywhere a user sees it.

## State

- OA-47, OA-49, OA-50, OA-51, OA-52, OA-53 are merged to `main` and live
  on beta.
- **OA-54** (this change): code complete and validated locally (lint,
  build, check-bundle, web tests all pass; manually screenshotted the
  rendered landing page at http://localhost:5173/). Not yet
  committed/pushed/PR'd as of this note — see "Next step".
- Deployment to beta happens automatically on merge to `main` via
  `.github/workflows/deploy-beta.yml`; it has not run for this change
  yet, since it isn't merged. The ticket's "deploy to beta before
  completion" criterion will be satisfied once this PR is merged and
  the workflow runs (watch it with the beta-verification checklist
  below).

## Next step

Commit this work on branch `claude/busy-gates-4i4s7h`, push, open a PR,
watch CI/beta deploy, then run "Beta verification (OA-54)" in
`README.md` against `https://shiftandsaveapp.web.app`.

## Key references

- Ticket: OA-54, Jira Octopus Agile project.
- `src/pages/LandingPage.tsx` / `.css` — new hero copy and CTA, revised
  3-step flow (Connect / See your saving / Make it easy), stronger
  privacy trust point, "What is Octopus Agile?" link to the existing
  `/how-smart-tariffs-work` explainer (OA-42).
- `src/App.tsx`, `index.html`, `vite.config.ts` (PWA manifest),
  `README.md` — rebranded "Octopus Agent" → "Shift & Save" in every
  user-visible spot (header, tab title, meta description, installed
  PWA name).
- README.md "Beta verification (OA-54)" section.

## Decisions

- Rebranded the PWA manifest name/short_name/description and the
  `<title>`/meta description in `index.html`, plus the README title —
  not explicitly called out in the ticket, but the ticket is about the
  Shift & Save proposition and HANDOFF already flagged the stale
  "Octopus Agent" branding as debt; fixing it here is the simplest
  option and avoids an inconsistent brand across tab title / installed
  app name / landing page in the same release.
  `ExplainerPage.tsx`'s own "Find my saving" CTA was left as-is — out of
  this ticket's scope (landing page only); worth a follow-up ticket if
  the mismatch with the new "See what I could save" CTA matters.
- Kept the link to the explainer page pointing at the existing
  `/how-smart-tariffs-work` route (built under OA-42) rather than
  renaming the route, since the ticket only asks for new link text
  ("What is Octopus Agile?"), not a URL change.
- "Make it easy" step copy explicitly says "the move is always yours to
  make" to satisfy the ticket's guard against implying automatic
  switching or device control in the MVP.

## Constraints and preferences

- No secrets/credentials in browser code, bundle, or repo (Firebase web
  config is the documented exception).
- Never log credentials or full account numbers.
- Currency GBP; times stored/handled UTC, displayed Europe/London.
- Keep production deployment and production auth separate, manual, and
  gated — this is beta only.
- Keep sessions short; if context grows large, update this file and
  continue in a fresh session.

## Gotchas

- Don't commit the beta test account's password anywhere — it lives only
  in Firebase Console → Authentication → Users.
