import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseApp } from './firebaseApp.js'

const COLLECTION = 'savingsLedgerEvents'

/**
 * Firestore-backed ledger of savings events (OA-41), keyed by Firebase UID,
 * one subcollection of events per user. Showing a recommendation is not the
 * same as acting on it, so only a confirmed event credits the running
 * total -- an unconfirmed or declined one is still recorded (for later
 * "projected vs actual" comparison) but credits £0. `source` is always
 * 'manual' today; it exists so OA-12/OA-15 device control can later write
 * 'automated' events (e.g. a smart plug confirming an actual run) through
 * this same ledger without a shape change.
 */
export function createFirestoreSavingsLedgerStore() {
  const db = getFirestore(getFirebaseApp())

  return {
    async addEvent(uid, event) {
      await db.collection(COLLECTION).doc(uid).collection('events').add(event)
    },
    async listEvents(uid) {
      const snap = await db.collection(COLLECTION).doc(uid).collection('events').get()
      return snap.docs.map((doc) => doc.data())
    },
  }
}
