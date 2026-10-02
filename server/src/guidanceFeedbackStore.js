import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'guidanceFeedback'

/**
 * Firestore-backed storage for OA-57's contextual feedback on manual
 * guidance ("Was this recommendation useful?"), keyed by Firebase UID, one
 * events subcollection per user -- same accumulate-forever shape as
 * savingsLedgerStore.js, and deliberately a separate collection from
 * OA-56's compatibilityRequests so guidance-quality feedback and
 * compatibility/integration feedback are never mixed together.
 */
export function createFirestoreGuidanceFeedbackStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async addEvent(uid, event) {
      await db.collection(COLLECTION).doc(uid).collection('events').add(event)
    },
  }
}
