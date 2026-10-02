import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const express = (await import('express')).default
const request = (await import('supertest')).default
const { createRequireFirebaseAuth } = await import('../src/firebaseAuth.js')
const { createGuidanceFeedbackRouter } = await import('../src/routes/guidanceFeedback.js')

const requireFirebaseAuth = createRequireFirebaseAuth(async (token) => {
  if (token === 'invalid-token') throw new Error('invalid')
  return { uid: token, email: `${token}@example.com` }
})

function createFakeStore() {
  const events = []
  return {
    events,
    async addEvent(uid, event) {
      events.push({ uid, ...event })
    },
  }
}

function buildApp(store) {
  const app = express()
  app.use(express.json())
  app.use('/api/feedback', createGuidanceFeedbackRouter({ requireFirebaseAuth, store }))
  return app
}

test('POST /api/feedback requires authentication', async () => {
  const app = buildApp(createFakeStore())
  const res = await request(app).post('/api/feedback').send({ relatedId: 'window-1', response: 'yes' })
  assert.equal(res.status, 401)
})

test('POST /api/feedback records a positive response with no comment', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app)
    .post('/api/feedback')
    .set('Authorization', 'Bearer user-a')
    .send({ relatedId: 'window-1', response: 'yes' })

  assert.equal(res.status, 201)
  assert.equal(store.events[0].uid, 'user-a')
  assert.equal(store.events[0].response, 'yes')
  assert.equal(store.events[0].comment, null)
  assert.equal(store.events[0].type, 'guidance')
})

test('POST /api/feedback records a negative response with an optional comment', async () => {
  const store = createFakeStore()
  const app = buildApp(store)

  const res = await request(app)
    .post('/api/feedback')
    .set('Authorization', 'Bearer user-b')
    .send({ relatedId: 'window-1', response: 'could_not', comment: 'Dishwasher has no delay timer.' })

  assert.equal(res.status, 201)
  assert.equal(store.events[0].response, 'could_not')
  assert.equal(store.events[0].comment, 'Dishwasher has no delay timer.')
})

test('POST /api/feedback rejects an unknown response value', async () => {
  const app = buildApp(createFakeStore())
  const res = await request(app)
    .post('/api/feedback')
    .set('Authorization', 'Bearer user-c')
    .send({ relatedId: 'window-1', response: 'maybe' })
  assert.equal(res.status, 400)
})

test('POST /api/feedback rejects a missing relatedId', async () => {
  const app = buildApp(createFakeStore())
  const res = await request(app)
    .post('/api/feedback')
    .set('Authorization', 'Bearer user-d')
    .send({ response: 'yes' })
  assert.equal(res.status, 400)
})
