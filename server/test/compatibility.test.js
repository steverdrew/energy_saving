import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const express = (await import('express')).default
const request = (await import('supertest')).default
const { createOptionalFirebaseAuth } = await import('../src/firebaseAuth.js')
const { createCompatibilityRequestRouter } = await import('../src/routes/compatibility.js')

const optionalFirebaseAuth = createOptionalFirebaseAuth(async (token) => {
  if (token === 'invalid-token') throw new Error('invalid')
  return { uid: token, email: `${token}@example.com` }
})

function createFakeStore() {
  const requests = []
  return {
    requests,
    async addRequest(record) {
      requests.push(record)
    },
  }
}

function buildApp(store) {
  const app = express()
  app.use(express.json())
  app.use('/api/compatibility-requests', createCompatibilityRequestRouter({ optionalFirebaseAuth, store }))
  return app
}

test('POST /api/compatibility-requests works for a signed-out visitor', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app).post('/api/compatibility-requests').send({ deviceType: 'smart_plug' })

  assert.equal(res.status, 201)
  assert.equal(res.body.ok, true)
  assert.equal(store.requests.length, 1)
  assert.equal(store.requests[0].deviceType, 'smart_plug')
  assert.equal(store.requests[0].firebaseUid, null)
  assert.equal(store.requests[0].brand, null)
})

test('POST /api/compatibility-requests associates the uid for a signed-in user', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app)
    .post('/api/compatibility-requests')
    .set('Authorization', 'Bearer user-a')
    .send({ deviceType: 'washing_machine', brand: 'Bosch', model: 'Series 6', note: 'App is Home Connect.' })

  assert.equal(res.status, 201)
  assert.equal(store.requests[0].firebaseUid, 'user-a')
  assert.equal(store.requests[0].brand, 'Bosch')
  assert.equal(store.requests[0].model, 'Series 6')
  assert.equal(store.requests[0].note, 'App is Home Connect.')
})

test('POST /api/compatibility-requests rejects an unknown deviceType', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app).post('/api/compatibility-requests').send({ deviceType: 'spaceship' })
  assert.equal(res.status, 400)
})

test('POST /api/compatibility-requests rejects a missing deviceType', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app).post('/api/compatibility-requests').send({ brand: 'Bosch' })
  assert.equal(res.status, 400)
})

test('POST /api/compatibility-requests treats an invalid/expired token as anonymous, not an error', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app)
    .post('/api/compatibility-requests')
    .set('Authorization', 'Bearer invalid-token')
    .send({ deviceType: 'other' })

  assert.equal(res.status, 201)
  assert.equal(store.requests[0].firebaseUid, null)
})

test('POST /api/compatibility-requests trims and caps free-text fields', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app)
    .post('/api/compatibility-requests')
    .send({ deviceType: 'other', note: `  ${'x'.repeat(600)}  ` })

  assert.equal(res.status, 201)
  assert.equal(store.requests[0].note.length, 500)
})
