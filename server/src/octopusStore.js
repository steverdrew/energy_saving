import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'octopusConnections'

/**
 * Firestore-backed Octopus connection storage, keyed by Firebase UID --
 * chosen over SQLite because the server runs on Cloud Run, whose
 * filesystem doesn't persist across container restarts/instances. Needs
 * the Cloud Run service's own runtime identity to have Firestore access
 * (see README.md "Server deployment").
 */
export function createFirestoreOctopusStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async upsert(uid, record) {
      await db
        .collection(COLLECTION)
        .doc(uid)
        .set(record)
    },
    async get(uid) {
      const snap = await db.collection(COLLECTION).doc(uid).get()
      return snap.exists ? snap.data() : null
    },
    async remove(uid) {
      await db.collection(COLLECTION).doc(uid).delete()
    },
  }
}
