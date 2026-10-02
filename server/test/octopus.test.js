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
const { createInMemoryOctopusImportStore } = await import('./helpers/fakeOctopusImportStore.js')
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
            meters: [{ serial_number: '21E1234567' }],
            agreements: [
              { tariff_code: 'E-1R-VAR-22-11-01-A', valid_from: '2024-01-01', valid_to: null },
            ],
          },
        ],
      },
    ],
  })
}

function fakeFetchElectricityConsumption(mpan, serialNumber, apiKey) {
  if (apiKey !== 'good-key') {
    throw new OctopusAuthError('That API key was not accepted.')
  }
  return Promise.resolve([
    { intervalStart: '2026-09-01T00:00:00Z', intervalEnd: '2026-09-01T00:30:00Z', consumptionKwh: 0.21 },
    { intervalStart: '2026-09-01T00:30:00Z', intervalEnd: '2026-09-01T01:00:00Z', consumptionKwh: 0.18 },
  ])
}

function fakeFetchTariffUnitRates(tariffCode) {
  if (tariffCode.startsWith('E-1R-AGILE-FAIL')) {
    throw new OctopusRequestError('Could not reach Octopus.')
  }
  if (tariffCode.includes('AGILE')) {
    return Promise.resolve([
      { validFrom: '2026-09-01T00:00:00Z', validTo: '2026-09-01T00:30:00Z', unitRateIncVatPence: 10 },
      { validFrom: '2026-09-01T00:30:00Z', validTo: '2026-09-01T01:00:00Z', unitRateIncVatPence: 40 },
    ])
  }
  return Promise.resolve([
    { validFrom: '2026-09-01T00:00:00Z', validTo: '2026-09-01T00:30:00Z', unitRateIncVatPence: 24.1 },
    { validFrom: '2026-09-01T00:30:00Z', validTo: '2026-09-01T01:00:00Z', unitRateIncVatPence: 19.8 },
  ])
}

function fakeFetchActiveAgileTariffCode(regionLetter) {
  return Promise.resolve(`E-1R-AGILE-24-10-01-${regionLetter}`)
}

const app = express()
app.use(express.json())
app.use(
  '/api/octopus',
  createOctopusRouter({
    requireFirebaseAuth,
    fetchOctopusAccount: fakeFetchOctopusAccount,
    fetchElectricityConsumption: fakeFetchElectricityConsumption,
    fetchTariffUnitRates: fakeFetchTariffUnitRates,
    fetchActiveAgileTariffCode: fakeFetchActiveAgileTariffCode,
    store: createInMemoryOctopusStore(),
    importStore: createInMemoryOctopusImportStore(),
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
  assert.equal(res.body.meterContext.tariffCode, 'E-1R-VAR-22-11-01-A')
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

test('GET /import-status reports not imported before any import has run', async () => {
  const res = await request(app).get('/api/octopus/import-status').set('Authorization', 'Bearer user-g')
  assert.equal(res.status, 200)
  assert.equal(res.body.imported, false)
})

test('POST /import requires a connected account first', async () => {
  const res = await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-h')
  assert.equal(res.status, 400)
})

test('POST /import fetches and stores consumption and tariff rate history', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-i')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-i')
  assert.equal(res.status, 200)
  assert.equal(res.body.imported, true)
  assert.equal(res.body.consumptionPoints, 2)
  assert.equal(res.body.ratePoints, 2)

  const status = await request(app)
    .get('/api/octopus/import-status')
    .set('Authorization', 'Bearer user-i')
  assert.equal(status.body.imported, true)
  assert.equal(status.body.consumptionPoints, 2)
  assert.equal(status.body.ratePoints, 2)
})

test('POST /import never leaks the decrypted API key back to the client', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-j')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-j')
  assert.equal(JSON.stringify(res.body).includes('good-key'), false)
})

test('GET /savings-result requires an import first', async () => {
  const res = await request(app).get('/api/octopus/savings-result').set('Authorization', 'Bearer user-k')
  assert.equal(res.status, 400)
})

test('GET /savings-result compares the current tariff against Agile and flags unit-rate-only', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-l')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-l')

  const res = await request(app).get('/api/octopus/savings-result').set('Authorization', 'Bearer user-l')
  assert.equal(res.status, 200)
  assert.equal(res.body.unitRateOnly, true)
  assert.equal(res.body.agileTariffCode, 'E-1R-AGILE-24-10-01-A')
  // current: 0.21*24.1 + 0.18*19.8 = 8.625p. agile: 0.21*10 + 0.18*40 = 9.3p.
  assert.equal(res.body.currentTariffCostPence, 8.63)
  assert.equal(res.body.agileCostPence, 9.3)
  assert.equal(res.body.estimatedSavingPence, -0.67)
  assert.equal(typeof res.body.annualizedSavingPence, 'number')
})

test('GET /savings-result surfaces an Octopus failure fetching Agile rates as 502', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-m')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-m')

  // Force the Agile tariff lookup to resolve to one fakeFetchTariffUnitRates
  // treats as unreachable, without needing a separate router instance.
  const failingApp = express()
  failingApp.use(express.json())
  failingApp.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount,
      fetchElectricityConsumption: fakeFetchElectricityConsumption,
      fetchTariffUnitRates: fakeFetchTariffUnitRates,
      fetchActiveAgileTariffCode: () => Promise.resolve('E-1R-AGILE-FAIL-A'),
      store: createInMemoryOctopusStore(),
      importStore: createInMemoryOctopusImportStore(),
    }),
  )
  await request(failingApp)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-n')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(failingApp).post('/api/octopus/import').set('Authorization', 'Bearer user-n')

  const res = await request(failingApp).get('/api/octopus/savings-result').set('Authorization', 'Bearer user-n')
  assert.equal(res.status, 502)
})
