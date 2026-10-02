# HANDOFF

_Last updated: 2026-10-02 (OA-52: Sign in link on the landing page)_

## Current task

OA-52: give the public landing page a visible, secondary "Sign in" entry
point back into the account flow, usable on mobile and by keyboard, that
resolves straight to the account page for already-authenticated
visitors. Implementation done locally; not yet committed/pushed/PR'd.

## State

- OA-47, OA-49, OA-50, OA-51, and two hotfixes are merged to `main` and
  live on beta.
- OA-52 turned out to be mostly already satisfied by OA-50/51's global
  app header (`src/App.tsx`), which is shared by every page including
  the landing page: it already shows "Sign in" → `/login` when
  signed out, or "Account" → `/account` when signed in. The remaining
  gap was mobile: the header had no wrap behavior and could overflow on
  narrow viewports. Fixed with a `flex-wrap` + responsive gap change in
  `src/App.css` — no new nav logic needed.
- Validated locally (lint, build, check-bundle, web tests, server
  tests all pass) but sits uncommitted on top of `main` — not yet on a
  branch, no PR yet.

## Next step

Commit this work on a new branch off `main` (e.g. `oa-52-landing-signin`),
push, open a PR, watch CI, merge once green, then run the "Beta
verification (OA-52)" steps in `README.md` against the deployed beta URL.

## Key references

- Ticket: OA-52, Jira Octopus Agile project.
- `src/App.css` — `.app-header` / `.app-header__nav` now wrap on narrow
  viewports instead of overflowing.
- `src/App.tsx` — pre-existing (OA-50/51) conditional nav: "Sign in" vs.
  "Account" + "Sign out", shared across all pages.
- README.md "Beta verification (OA-52)" section.

## Decisions

- No new Sign in link/component was added — the existing global header
  nav already covers every acceptance criterion (one-click reach to
  `/login`, resolves to `/account` when authenticated, keyboard
  accessible via native `<a>`/`<button>`, "Find my saving" stays the
  visually dominant CTA). Scope was narrowed to the one real gap:
  mobile wrapping.
- Did not rename the "Octopus Agent" header brand text to "Shift & Save"
  — tickets reference Shift & Save as the consumer brand, but no ticket
  so far has asked for a rebrand, and OA-52's scope is the Sign in link,
  not visual rebranding. Flagging as a likely future ticket.

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

- The header's brand text still reads "Octopus Agent" even though
  tickets since OA-49 call the consumer brand "Shift & Save" — not
  addressed yet, no ticket has asked for it.
- Don't commit the beta test account's password anywhere — it lives only
  in Firebase Console → Authentication → Users.
