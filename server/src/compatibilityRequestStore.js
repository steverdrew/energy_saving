import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'compatibilityRequests'

/**
 * Firestore-backed storage for OA-56's compatibility requests -- what
 * devices/appliances real households already have, so future integrations
 * are driven by actual demand rather than a speculative roadmap. One doc
 * per submission; Steve inspects/exports via the Firestore console
 * directly (no admin UI exists in this app yet, and this is simplest for
 * now -- see HANDOFF.md Decisions).
 */
export function createFirestoreCompatibilityRequestStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async addRequest(record) {
      await db.collection(COLLECTION).add(record)
    },
  }
}
