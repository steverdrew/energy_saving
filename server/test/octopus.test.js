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
const { createInMemorySavingsLedgerStore } = await import('./helpers/fakeSavingsLedgerStore.js')

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

// The main fixture's current tariff ('E-1R-VAR-22-11-01-A') doesn't match
// any confident family prefix, so classification falls through to
// Octopus's own product data -- this fake stands in for that lookup,
// same as a real standard variable ("Flexible") product would report.
function fakeFetchProductDetails() {
  return Promise.resolve({ isVariable: true, displayName: null, fullName: null })
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
    fetchProductDetails: fakeFetchProductDetails,
    store: createInMemoryOctopusStore(),
    importStore: createInMemoryOctopusImportStore(),
    ledgerStore: createInMemorySavingsLedgerStore(),
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
  assert.equal(res.body.status, 'not_imported')
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
  assert.equal(res.body.status, 'success')
  assert.equal(res.body.consumptionPoints, 2)
  assert.equal(res.body.ratePoints, 2)
  assert.equal(res.body.periodFrom !== undefined, true)

  const status = await request(app)
    .get('/api/octopus/import-status')
    .set('Authorization', 'Bearer user-i')
  assert.equal(status.body.imported, true)
  assert.equal(status.body.status, 'success')
  assert.equal(status.body.consumptionPoints, 2)
  assert.equal(status.body.ratePoints, 2)
})

test('POST /import reports status: no_data, with no covering-dates claim, when Octopus returns nothing usable', async () => {
  const emptyApp = express()
  emptyApp.use(express.json())
  emptyApp.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount,
      fetchElectricityConsumption: () => Promise.resolve([]),
      fetchTariffUnitRates: () => Promise.resolve([]),
      fetchActiveAgileTariffCode: fakeFetchActiveAgileTariffCode,
    fetchProductDetails: fakeFetchProductDetails,
      store: createInMemoryOctopusStore(),
      importStore: createInMemoryOctopusImportStore(),
    }),
  )
  await request(emptyApp)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-empty')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(emptyApp).post('/api/octopus/import').set('Authorization', 'Bearer user-empty')
  assert.equal(res.status, 200)
  assert.equal(res.body.imported, true)
  assert.equal(res.body.status, 'no_data')
  assert.equal(res.body.consumptionPoints, 0)
  assert.equal(res.body.ratePoints, 0)
  assert.equal(res.body.periodFrom, undefined)
  assert.equal(res.body.periodTo, undefined)

  const status = await request(emptyApp)
    .get('/api/octopus/import-status')
    .set('Authorization', 'Bearer user-empty')
  assert.equal(status.body.status, 'no_data')
  assert.equal(status.body.periodFrom, undefined)
})

test('POST /import reports status: partial when only one of readings/rates comes back', async () => {
  const partialApp = express()
  partialApp.use(express.json())
  partialApp.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount,
      fetchElectricityConsumption: fakeFetchElectricityConsumption,
      fetchTariffUnitRates: () => Promise.resolve([]),
      fetchActiveAgileTariffCode: fakeFetchActiveAgileTariffCode,
    fetchProductDetails: fakeFetchProductDetails,
      store: createInMemoryOctopusStore(),
      importStore: createInMemoryOctopusImportStore(),
    }),
  )
  await request(partialApp)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-partial')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(partialApp).post('/api/octopus/import').set('Authorization', 'Bearer user-partial')
  assert.equal(res.status, 200)
  assert.equal(res.body.status, 'partial')
  assert.equal(res.body.consumptionPoints, 2)
  assert.equal(res.body.ratePoints, 0)
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

test('GET /cheapest-window requires a positive durationMinutes', async () => {
  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=0')
    .set('Authorization', 'Bearer user-o')
  assert.equal(res.status, 400)
})

test('GET /cheapest-window requires a connected account', async () => {
  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=60')
    .set('Authorization', 'Bearer user-p')
  assert.equal(res.status, 400)
})

test('GET /cheapest-window rejects a non-positive energyKwh', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-r')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30&energyKwh=0')
    .set('Authorization', 'Bearer user-r')
  assert.equal(res.status, 400)
})

// Deeper /cheapest-window behaviour (tariff-aware OA-66, future-only
// OA-67, flat-rate and unsupported-tariff handling) lives in
// cheapestWindowRoute.test.js, with its own dynamically-anchored rate
// fixtures -- this file's fakeFetchTariffUnitRates returns fixed
// historical dates that OA-67's "exclude elapsed slots" filtering would
// always treat as already passed, which would make those assertions
// about actual production time, not about the route's logic.

test('POST /recommendation-confirm requires authentication', async () => {
  const res = await request(app).post('/api/octopus/recommendation-confirm').send({
    windowStartsAt: '2026-09-01T00:00:00Z',
    windowEndsAt: '2026-09-01T00:30:00Z',
    applianceType: 'dishwasher',
    savingPence: 12,
    confirmed: true,
  })
  assert.equal(res.status, 401)
})

test('POST /recommendation-confirm rejects a missing confirmed field', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-u')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T00:30:00Z',
      applianceType: 'dishwasher',
      savingPence: 12,
    })
  assert.equal(res.status, 400)
})

test('POST /recommendation-confirm rejects a negative savingPence', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-u')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T00:30:00Z',
      applianceType: 'dishwasher',
      savingPence: -1,
      confirmed: true,
    })
  assert.equal(res.status, 400)
})

test('POST /recommendation-confirm with confirmed:true credits the saving to the running total', async () => {
  const confirmRes = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-v')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T00:30:00Z',
      applianceType: 'dishwasher',
      savingPence: 11.95,
      confirmed: true,
    })
  assert.equal(confirmRes.status, 200)
  assert.equal(confirmRes.body.confirmed, true)
  assert.equal(confirmRes.body.creditedPence, 11.95)

  const totalRes = await request(app)
    .get('/api/octopus/savings-total')
    .set('Authorization', 'Bearer user-v')
  assert.equal(totalRes.status, 200)
  assert.equal(totalRes.body.savedSoFarPence, 11.95)
  assert.equal(totalRes.body.eventCount, 1)
})

test('POST /recommendation-confirm with confirmed:false credits nothing, but is still recorded', async () => {
  const confirmRes = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-w')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T00:30:00Z',
      applianceType: 'dishwasher',
      savingPence: 11.95,
      confirmed: false,
    })
  assert.equal(confirmRes.status, 200)
  assert.equal(confirmRes.body.confirmed, false)
  assert.equal(confirmRes.body.creditedPence, 0)

  const totalRes = await request(app)
    .get('/api/octopus/savings-total')
    .set('Authorization', 'Bearer user-w')
  assert.equal(totalRes.status, 200)
  assert.equal(totalRes.body.savedSoFarPence, 0)
  assert.equal(totalRes.body.eventCount, 1)
})

test('GET /savings-result includes tariff state, eligibility and a null shiftingOpportunity by default', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-y')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-y')

  const res = await request(app).get('/api/octopus/savings-result').set('Authorization', 'Bearer user-y')

  assert.equal(res.status, 200)
  // fixture tariff code doesn't match a confident prefix, so classification
  // falls through to the fake fetchProductDetails (isVariable: true).
  assert.deepEqual(res.body.tariffState, {
    family: 'flexible',
    rateShape: 'flat',
    displayName: 'a standard variable tariff',
    comparisonMethod: 'exact',
    raw: 'E-1R-VAR-22-11-01-A',
    recentlySwitched: false,
    daysSinceSwitch: res.body.tariffState.daysSinceSwitch,
  })
  assert.equal(res.body.eligibility.status, 'eligible')
  assert.equal(res.body.shiftingOpportunity, null)
})

test('GET /savings-result rejects durationMinutes without energyKwh', async () => {
  const res = await request(app)
    .get('/api/octopus/savings-result?durationMinutes=30')
    .set('Authorization', 'Bearer user-y')
  assert.equal(res.status, 400)
})

test('GET /savings-result includes a shiftingOpportunity figure, separate from tariff-fit, when given a duration and energy', async () => {
  const res = await request(app)
    .get('/api/octopus/savings-result?durationMinutes=30&energyKwh=1')
    .set('Authorization', 'Bearer user-y')

  assert.equal(res.status, 200)
  // current-tariff fixture rates: 24.1p at 00:00, 19.8p at 00:30 -- cheapest 30-minute slot is 00:30.
  assert.equal(res.body.shiftingOpportunity.averageCurrentTariffRateIncVatPence, 21.95)
  assert.equal(res.body.shiftingOpportunity.costAtCheapestPence, 19.8)
  assert.equal(res.body.shiftingOpportunity.costAtAverageRatePence, 21.95)
  assert.equal(res.body.shiftingOpportunity.savingPence, 2.15)
  assert.equal(res.body.shiftingOpportunity.unitRateOnly, true)
  // separate from the tariff-fit number, never summed into it
  assert.notEqual(res.body.shiftingOpportunity.savingPence, res.body.estimatedSavingPence)
})

test('POST /recommendation-confirm reports meterConsistency: unknown when confirmed but no energyKwh given', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-z')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: true,
    })
  assert.equal(res.status, 200)
  assert.equal(res.body.meterConsistency, 'unknown')
})

test('POST /recommendation-confirm reports meterConsistency: unknown when not confirmed, even with energyKwh', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-z')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: false,
      energyKwh: 0.3,
    })
  assert.equal(res.status, 200)
  assert.equal(res.body.meterConsistency, 'unknown')
})

test('POST /recommendation-confirm reports meterConsistency: unknown for a user with no Octopus connection', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-never-connected')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: true,
      energyKwh: 0.3,
    })
  assert.equal(res.status, 200)
  assert.equal(res.body.meterConsistency, 'unknown')
})

test('POST /recommendation-confirm reports meterConsistency: consistent when actual usage covers the expected energy', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-aa')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  // fixture consumption for this window sums to 0.39 kWh; 0.3 * 0.6 = 0.18 <= 0.39.
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-aa')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: true,
      energyKwh: 0.3,
    })
  assert.equal(res.status, 200)
  assert.equal(res.body.meterConsistency, 'consistent')
})

test('POST /recommendation-confirm reports meterConsistency: inconsistent when actual usage falls well short of expected energy', async () => {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-bb')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  // fixture consumption for this window sums to 0.39 kWh; 2 * 0.6 = 1.2 > 0.39.
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-bb')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: true,
      energyKwh: 2,
    })
  assert.equal(res.status, 200)
  assert.equal(res.body.meterConsistency, 'inconsistent')
})

test('POST /recommendation-confirm rejects a non-positive energyKwh', async () => {
  const res = await request(app)
    .post('/api/octopus/recommendation-confirm')
    .set('Authorization', 'Bearer user-cc')
    .send({
      windowStartsAt: '2026-09-01T00:00:00Z',
      windowEndsAt: '2026-09-01T01:00:00Z',
      applianceType: 'dishwasher',
      savingPence: 5,
      confirmed: true,
      energyKwh: 0,
    })
  assert.equal(res.status, 400)
})

test('GET /savings-total reports consistentCount alongside savedSoFarPence', async () => {
  const totalRes = await request(app)
    .get('/api/octopus/savings-total')
    .set('Authorization', 'Bearer user-aa')
  assert.equal(totalRes.status, 200)
  assert.equal(totalRes.body.eventCount, 1)
  assert.equal(totalRes.body.consistentCount, 1)
})

test('GET /savings-total sums multiple confirmed events and requires authentication', async () => {
  const unauth = await request(app).get('/api/octopus/savings-total')
  assert.equal(unauth.status, 401)

  for (const savingPence of [5, 7.5]) {
    await request(app)
      .post('/api/octopus/recommendation-confirm')
      .set('Authorization', 'Bearer user-x')
      .send({
        windowStartsAt: '2026-09-01T00:00:00Z',
        windowEndsAt: '2026-09-01T00:30:00Z',
        applianceType: 'dishwasher',
        savingPence,
        confirmed: true,
      })
  }

  const totalRes = await request(app)
    .get('/api/octopus/savings-total')
    .set('Authorization', 'Bearer user-x')
  assert.equal(totalRes.status, 200)
  assert.equal(totalRes.body.savedSoFarPence, 12.5)
  assert.equal(totalRes.body.eventCount, 2)
})
