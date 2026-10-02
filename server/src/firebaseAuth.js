import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// Public project id -- matches src/firebase.ts in the web app, same as a
// Firebase web config value. Not a secret.
const FIREBASE_PROJECT_ID = 'shiftandsaveapp'

let app
function getFirebaseApp() {
  if (!app) {
    const existing = getApps()
    app = existing[0] ?? initializeApp({ projectId: FIREBASE_PROJECT_ID })
  }
  return app
}

// Verifies a Firebase ID token's signature and claims locally against
// Google's public certs -- no service account credential needed for this,
// only for revocation checks (which we don't do here; see HANDOFF.md).
export function verifyFirebaseIdToken(idToken) {
  return getAuth(getFirebaseApp()).verifyIdToken(idToken)
}

/**
 * Builds Express middleware that authenticates a request via a Firebase ID
 * token (`Authorization: Bearer <token>`), attaching `req.firebaseUid` and
 * `req.firebaseEmail`. Takes the verify function as a parameter so tests can
 * inject a fake one instead of hitting Google's network.
 */
export function createRequireFirebaseAuth(verifyIdToken) {
  return async function requireFirebaseAuth(req, res, next) {
    const header = req.headers.authorization ?? ''
    const match = /^Bearer (.+)$/.exec(header)
    if (!match) {
      return res.status(401).json({ error: 'Not signed in' })
    }
    try {
      const decoded = await verifyIdToken(match[1])
      req.firebaseUid = decoded.uid
      req.firebaseEmail = decoded.email ?? null
      next()
    } catch {
      res.status(401).json({ error: 'Not signed in' })
    }
  }
}

export const requireFirebaseAuth = createRequireFirebaseAuth(verifyFirebaseIdToken)
