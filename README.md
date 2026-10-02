# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Beta deployment

The web app (`dist/`, from `npm run build`) deploys automatically to
Firebase Hosting on every push to `main`, via
`.github/workflows/deploy-beta.yml`. The build must pass lint, typecheck,
the bundle check and tests first — a failing build/test stops the job
before Hosting is touched, so a broken push never replaces the last
working beta deploy.

- **Firebase project:** `shiftandsaveapp` (alias `beta` in `.firebaserc`).
- **Beta URL:** `https://shiftandsaveapp.web.app` (Firebase Hosting's
  default URL for this project's default site).
- **Build identification:** every deployed build embeds the commit SHA
  and build timestamp it was built from (via `vite.config.ts`'s `define`,
  reading `GITHUB_SHA` in CI). Visit `/debug` on the deployed app to see
  which commit and build time are currently live.
- **Production:** not set up by this change. Production deployment stays
  separate, manual, and gated until explicitly enabled.

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
