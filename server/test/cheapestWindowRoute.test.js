// OA-66/OA-67: /cheapest-window must be tariff-aware (use the customer's
// own current tariff, not a silent Agile default) and future-only (never
// recommend a window that's already elapsed). Both depend on real wall-
// clock time, so this file's fixtures anchor to the actual moment the
// test runs rather than fixed historical date strings -- unlike
// octopus.test.js's fakeFetchTariffUnitRates, which intentionally stays
// fixed for its own (backward-looking) purposes.
import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const express = (await import('express')).default
const request = (await import('supertest')).default
const { createRequireFirebaseAuth } = await import('../src/firebaseAuth.js')
const { createOctopusRouter } = await import('../src/routes/octopus.js')
const { createInMemoryOctopusImportStore } = await import('./helpers/fakeOctopusImportStore.js')
const { createInMemoryOctopusStore } = await import('./helpers/fakeOctopusStore.js')
const { createInMemorySavingsLedgerStore } = await import('./helpers/fakeSavingsLedgerStore.js')

const requireFirebaseAuth = createRequireFirebaseAuth(async (token) => ({ uid: token, email: `${token}@example.com` }))

function addMinutes(isoString, minutes) {
  return new Date(new Date(isoString).getTime() + minutes * 60 * 1000).toISOString().replace('.000Z', 'Z')
}

function roundDownToHalfHour(date) {
  const rounded = new Date(date)
  rounded.setUTCSeconds(0, 0)
  rounded.setUTCMinutes(rounded.getUTCMinutes() - (rounded.getUTCMinutes() % 30))
  return rounded
}

// Builds a connected account whose current tariff code is `tariffCode`,
// via a fake fetchOctopusAccount scoped to this one test file.
function fakeFetchOctopusAccount(tariffCode) {
  return () =>
    Promise.resolve({
      properties: [
        {
          electricity_meter_points: [
            {
              mpan: '1200000345678',
              meters: [{ serial_number: '21E1234567' }],
              agreements: [{ tariff_code: tariffCode, valid_from: '2024-01-01', valid_to: null }],
            },
          ],
        },
      ],
    })
}

function buildApp({ fetchTariffUnitRates, fetchProductDetails, tariffCode }) {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount(tariffCode),
      fetchElectricityConsumption: () => Promise.resolve([]),
      fetchTariffUnitRates,
      fetchActiveAgileTariffCode: () => Promise.resolve('E-1R-AGILE-24-10-01-A'),
      fetchProductDetails,
      store: createInMemoryOctopusStore(),
      importStore: createInMemoryOctopusImportStore(),
      ledgerStore: createInMemorySavingsLedgerStore(),
    }),
  )
  return app
}

test('GET /cheapest-window uses the customer\'s own current tariff, not Agile, and flags start-now', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()

  // A Go-family tariff: current (first) slot is expensive, next slot is
  // cheap -- so the cheapest 30-minute window is the *second* slot, not
  // "start now".
  const app = buildApp({
    tariffCode: 'E-1R-GO-18-06-12-C',
    fetchTariffUnitRates: (tariffCode) => {
      assert.equal(tariffCode, 'E-1R-GO-18-06-12-C') // never substitutes Agile
      return Promise.resolve([
        { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 35 },
        { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 7 },
      ])
    },
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-go')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30')
    .set('Authorization', 'Bearer user-go')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, true)
  assert.equal(res.body.tariffState.family, 'go')
  assert.equal(res.body.averageUnitRateIncVatPence, 7)
  assert.equal(res.body.startsAt, addMinutes(periodFrom, 30))
  assert.equal(res.body.canStartNow, false)
})

test('GET /cheapest-window sets canStartNow when the cheapest window begins immediately', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()

  const app = buildApp({
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    fetchTariffUnitRates: () =>
      Promise.resolve([
        { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 7 },
        { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 35 },
      ]),
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-startnow')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30')
    .set('Authorization', 'Bearer user-startnow')

  assert.equal(res.status, 200)
  assert.equal(res.body.canStartNow, true)
  assert.equal(res.body.startsAt, periodFrom)
})

test('GET /cheapest-window excludes an already-elapsed slot even if Octopus still returns it', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()
  const pastSlot = addMinutes(periodFrom, -30) // already fully elapsed

  const app = buildApp({
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    fetchTariffUnitRates: () =>
      Promise.resolve([
        // A suspiciously cheap but already-elapsed slot -- must never win.
        { validFrom: pastSlot, validTo: periodFrom, unitRateIncVatPence: 1 },
        { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 20 },
        { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 25 },
      ]),
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-elapsed')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30')
    .set('Authorization', 'Bearer user-elapsed')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, true)
  assert.equal(res.body.startsAt, periodFrom)
  assert.equal(res.body.averageUnitRateIncVatPence, 20)
})

test('GET /cheapest-window reports flat_rate without fabricating a cheapest half-hour', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()

  const app = buildApp({
    tariffCode: 'E-1R-VAR-22-11-01-C',
    fetchProductDetails: () => Promise.resolve({ isVariable: true, displayName: 'Flexible Octopus' }),
    fetchTariffUnitRates: () =>
      Promise.resolve([
        { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 24.5 },
        { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 24.5 },
      ]),
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-flat')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30')
    .set('Authorization', 'Bearer user-flat')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, false)
  assert.equal(res.body.reason, 'flat_rate')
})

test('GET /cheapest-window reports unsupported_tariff rather than guessing', async () => {
  const app = buildApp({
    tariffCode: 'E-1R-BRAND-NEW-PRODUCT-26-01-01-C',
    fetchProductDetails: () => Promise.reject(new Error('unknown product')),
    fetchTariffUnitRates: () => Promise.resolve([]),
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-unknown')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30')
    .set('Authorization', 'Bearer user-unknown')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, false)
  assert.equal(res.body.reason, 'unsupported_tariff')
  assert.equal(res.body.tariffState.family, 'unknown')
})

test('GET /cheapest-window reports tomorrow_not_published when no valid window exists yet', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()

  // Only two slots published (today's remainder), ending well short of
  // the full 48h lookahead -- not enough for a 3-hour (6-slot) appliance
  // cycle, and the shortfall against the lookahead signals tomorrow isn't
  // out yet. Two different rates, so this isn't mistaken for flat_rate.
  const app = buildApp({
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    fetchTariffUnitRates: () =>
      Promise.resolve([
        { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 20 },
        { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 25 },
      ]),
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-nottomorrow')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=180')
    .set('Authorization', 'Bearer user-nottomorrow')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, false)
  assert.equal(res.body.reason, 'tomorrow_not_published')
})

test('GET /cheapest-window includes a £ recommendation using the customer\'s own tariff average', async () => {
  const now = new Date()
  const periodFrom = roundDownToHalfHour(now).toISOString()

  const app = buildApp({
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    fetchTariffUnitRates: (tariffCode) => {
      if (tariffCode === 'E-1R-AGILE-24-10-01-C') {
        return Promise.resolve([
          { validFrom: periodFrom, validTo: addMinutes(periodFrom, 30), unitRateIncVatPence: 10 },
          { validFrom: addMinutes(periodFrom, 30), validTo: addMinutes(periodFrom, 60), unitRateIncVatPence: 40 },
        ])
      }
      return Promise.resolve([])
    },
  })

  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', 'Bearer user-rec')
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', 'Bearer user-rec')

  const res = await request(app)
    .get('/api/octopus/cheapest-window?durationMinutes=30&energyKwh=1')
    .set('Authorization', 'Bearer user-rec')

  assert.equal(res.status, 200)
  assert.equal(res.body.found, true)
  // The import step fetches the same tariff's rates for its own (30-day
  // historical) period via the same fake, so it also sees [10, 40]p ->
  // average 25p -- that average is the "current tariff" baseline here.
  assert.equal(res.body.recommendation.averageCurrentTariffRateIncVatPence, 25)
  assert.equal(res.body.recommendation.costAtCheapestPence, 10)
  assert.equal(res.body.recommendation.costAtCurrentTariffPence, 25)
  assert.equal(res.body.recommendation.savingPence, 15)
})
