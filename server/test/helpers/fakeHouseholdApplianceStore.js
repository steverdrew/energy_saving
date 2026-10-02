// In-memory stand-in for the Firestore-backed store
// (server/src/householdApplianceStore.js), implementing the same
// { get, set } interface so route tests never need a real Firestore.
export function createInMemoryHouseholdApplianceStore() {
  const data = new Map()
  return {
    async get(uid) {
      return data.get(uid) ?? null
    },
    async set(uid, appliances) {
      const record = { appliances, updatedAt: new Date().toISOString() }
      data.set(uid, record)
      return record
    },
  }
}
