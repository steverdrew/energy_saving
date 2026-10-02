// In-memory stand-in for the Firestore-backed store (server/src/octopusStore.js),
// implementing the same { upsert, get, remove } interface so route tests
// never need a real Firestore.
export function createInMemoryOctopusStore() {
  const data = new Map()
  return {
    async upsert(uid, record) {
      data.set(uid, record)
    },
    async get(uid) {
      return data.get(uid) ?? null
    },
    async remove(uid) {
      data.delete(uid)
    },
  }
}
