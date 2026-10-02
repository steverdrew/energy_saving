import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'householdAppliances'

/**
 * OA-81: Firestore-backed storage for a household's declared appliances,
 * one doc per Firebase UID (bounded at 4 supported appliance types today
 * -- well under Firestore's 1MiB document limit, so no need for the
 * subcollection-per-event pattern savingsLedgerStore.js uses).
 *
 * Doc shape: { appliances: { [applianceType]: ApplianceRecord }, updatedAt }
 */
export function createFirestoreHouseholdApplianceStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async get(uid) {
      const snap = await db.collection(COLLECTION).doc(uid).get()
      return snap.exists ? snap.data() : null
    },
    async set(uid, appliances) {
      const record = { appliances, updatedAt: new Date().toISOString() }
      await db.collection(COLLECTION).doc(uid).set(record)
      return record
    },
  }
}
