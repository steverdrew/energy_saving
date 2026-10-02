// In-memory stand-in for the Firestore-backed import store
// (server/src/octopusImportStore.js), implementing the same { upsert, get }
// interface so route tests never need a real Firestore.
export function createInMemoryOctopusImportStore() {
  const data = new Map()
  return {
    async upsert(uid, record) {
      data.set(uid, record)
    },
    async get(uid) {
      return data.get(uid) ?? null
    },
  }
}
