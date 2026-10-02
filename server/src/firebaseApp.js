import { getApps, initializeApp } from 'firebase-admin/app'

// Public project id -- matches src/firebase.ts in the web app, same as a
// Firebase web config value. Not a secret.
const FIREBASE_PROJECT_ID = 'shiftandsaveapp'

let app
export function getFirebaseApp() {
  if (!app) {
    const existing = getApps()
    app = existing[0] ?? initializeApp({ projectId: FIREBASE_PROJECT_ID })
  }
  return app
}
