import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'octopusImports'

/**
 * Firestore-backed storage for a user's imported tariff/consumption
 * history (OA-6), keyed by Firebase UID. Same persistence rationale as
 * octopusStore.js: Cloud Run has no durable local disk.
 */
export function createFirestoreOctopusImportStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async upsert(uid, record) {
      await db.collection(COLLECTION).doc(uid).set(record)
    },
    async get(uid) {
      const snap = await db.collection(COLLECTION).doc(uid).get()
      return snap.exists ? snap.data() : null
    },
  }
}
