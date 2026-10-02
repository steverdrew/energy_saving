// In-memory stand-in for the Firestore-backed savings ledger store
// (server/src/savingsLedgerStore.js), implementing the same
// { addEvent, listEvents } interface so route tests never need a real
// Firestore.
export function createInMemorySavingsLedgerStore() {
  const data = new Map()
  return {
    async addEvent(uid, event) {
      const events = data.get(uid) ?? []
      events.push(event)
      data.set(uid, events)
    },
    async listEvents(uid) {
      return data.get(uid) ?? []
    },
  }
}
