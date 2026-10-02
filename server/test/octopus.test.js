import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const express = (await import('express')).default
const request = (await import('supertest')).default
const { createRequireFirebaseAuth } = await import('../src/firebaseAuth.js')
const { OctopusAuthError, OctopusRequestError } = await import('../src/octopusClient.js')
const { createOctopusRouter } = await import('../src/routes/octopus.js')
const { createInMemoryOctopusStore } = await import('./helpers/fakeOctopusStore.js')

// The fake verifier treats the bearer token itself as the uid, so tests can
// address "different users" just by using different token strings -- no
// real Firebase network call involved.
const requireFirebaseAuth = createRequireFirebaseAuth(async (token) => {
  if (token === 'invalid-token') throw new Error('invalid')
  return { uid: token, email: `${token}@example.com` }
})

function fakeFetchOctopusAccount(accountNumber, apiKey) {
  if (accountNumber === 'A-NETFAIL1') {
    throw new OctopusRequestError('Could not reach Octopus.')
  }
  if (apiKey !== 'good-key') {
    throw new OctopusAuthError('That API key was not accepted.')
  }
  return Promise.resolve({
    properties: [
      {
        electricity_meter_points: [
          {
            mpan: '1200000345678',
            agreements: [
              { tariff_code: 'E-1R-AGILE-24-04-03-A', valid_from: '2024-01-01', valid_to: null },
            ],
          },
        ],
      },
    ],
  })
}

const app = express()
app.use(express.json())
app.use(
  '/api/octopus',
  createOctopusRouter({
    requireFirebaseAuth,
    fetchOctopusAccount: fakeFetchOctopusAccount,
    store: createInMemoryOctopusStore(),
  }),
)

test('POST /connect requires authentication', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  assert.equal(res.status, 401)
})

test('POST /connect rejects a malformed account number', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-a')
    .send({ accountNumber: 'not-an-account', apiKey: 'good-key' })
  assert.equal(res.status, 400)
})

test('POST /connect rejects missing fields', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-a')
    .send({ accountNumber: 'A-12345678' })
  assert.equal(res.status, 400)
})

test('POST /connect rejects a bad API key without leaking it', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-a')
    .send({ accountNumber: 'A-12345678', apiKey: 'wrong-key' })
  assert.equal(res.status, 401)
  assert.equal(JSON.stringify(res.body).includes('wrong-key'), false)
})

test('POST /connect surfaces an Octopus network failure as 502', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-a')
    .send({ accountNumber: 'A-NETFAIL1', apiKey: 'good-key' })
  assert.equal(res.status, 502)
})

test('POST /connect succeeds, redacts the account number, and never returns the API key', async () => {
  const res = await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-b')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  assert.equal(res.status, 200)
  assert.equal(res.body.connected, true)
  assert.equal(res.body.accountNumberRedacted, 'A-****5678')
  assert.equal(res.body.meterContext.mpan, '1200000345678')
  assert.equal(res.body.meterContext.tariffCode, 'E-1R-AGILE-24-04-03-A')
  assert.equal(JSON.stringify(res.body).includes('good-key'), false)
  assert.equal(JSON.stringify(res.body).includes('A-12345678'), false)
})

test('GET /connection reflects the stored connection for that user only', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-c')
    .send({ accountNumber: 'A-99998888', apiKey: 'good-key' })

  const mine = await request(app).get('/api/octopus/connection').set('Authorization', 'Bearer user-c')
  assert.equal(mine.status, 200)
  assert.equal(mine.body.connected, true)
  assert.equal(mine.body.accountNumberRedacted, 'A-****8888')

  const someoneElse = await request(app)
    .get('/api/octopus/connection')
    .set('Authorization', 'Bearer user-d')
  assert.equal(someoneElse.status, 200)
  assert.equal(someoneElse.body.connected, false)
})

test('DELETE /connection removes only the requesting user\'s connection', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-e')
    .send({ accountNumber: 'A-11112222', apiKey: 'good-key' })
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-f')
    .send({ accountNumber: 'A-33334444', apiKey: 'good-key' })

  const del = await request(app).delete('/api/octopus/connection').set('Authorization', 'Bearer user-e')
  assert.equal(del.status, 204)

  const afterE = await request(app).get('/api/octopus/connection').set('Authorization', 'Bearer user-e')
  assert.equal(afterE.body.connected, false)

  const afterF = await request(app).get('/api/octopus/connection').set('Authorization', 'Bearer user-f')
  assert.equal(afterF.body.connected, true)
})

for (const [method, path] of [
  ['get', '/api/octopus/import-status'],
  ['get', '/api/octopus/savings-result'],
]) {
  test(`${method.toUpperCase()} ${path} returns 501 with a JSON error when authenticated`, async () => {
    const res = await request(app)[method](path).set('Authorization', 'Bearer user-a')
    assert.equal(res.status, 501)
    assert.equal(typeof res.body.error, 'string')
  })
}
