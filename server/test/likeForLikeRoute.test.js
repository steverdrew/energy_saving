// OA-72: /like-for-like must never move consumption -- same half-hourly
// kWh as Actual, only repriced against the comparison tariff's own
// historical rates for the same dates -- and must refuse to fabricate
// exactness for a tariff it can't fully reconstruct (OA-25).
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

function fakeFetchOctopusAccount(agreements) {
  return () =>
    Promise.resolve({
      properties: [
        {
          electricity_meter_points: [
            {
              mpan: '1200000345678',
              meters: [{ serial_number: '21E1234567' }],
              agreements,
            },
          ],
        },
      ],
    })
}

function buildApp({ agreements, fetchElectricityConsumption, fetchTariffUnitRates, fetchActiveAgileTariffCode }) {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount(agreements),
      fetchElectricityConsumption,
      fetchTariffUnitRates,
      fetchActiveAgileTariffCode: fetchActiveAgileTariffCode ?? (() => Promise.resolve('E-1R-AGILE-24-10-01-A')),
      fetchProductDetails: undefined,
      store: createInMemoryOctopusStore(),
      importStore: createInMemoryOctopusImportStore(),
      ledgerStore: createInMemorySavingsLedgerStore(),
    }),
  )
  return app
}

async function connectAndImport(app, token) {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', `Bearer ${token}`)
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', `Bearer ${token}`)
}

test('GET /like-for-like reprices the same consumption against an explicit comparison tariff code', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-GO-18-06-12-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () =>
      Promise.resolve([
        { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
        { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 2 },
      ]),
    fetchTariffUnitRates: (tariffCode) => {
      if (tariffCode === 'E-1R-GO-18-06-12-C') {
        return Promise.resolve([
          { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
          { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 30 },
        ])
      }
      if (tariffCode === 'E-1R-AGILE-24-10-01-C') {
        return Promise.resolve([
          { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 10 },
          { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 5 },
        ])
      }
      return Promise.resolve([])
    },
  })

  await connectAndImport(app, 'user-lfl')
  const res = await request(app)
    .get('/api/octopus/like-for-like?comparisonTariffCode=E-1R-AGILE-24-10-01-C')
    .set('Authorization', 'Bearer user-lfl')

  assert.equal(res.status, 200)
  assert.equal(res.body.comparisonAvailable, true)
  // actual (Go, flat 30p): 1*30 + 2*30 = 90p
  assert.equal(res.body.actual.totalCostPence, 90)
  // comparison (Agile): 1*10 + 2*5 = 20p
  assert.equal(res.body.comparison.totalCostPence, 20)
  assert.equal(res.body.comparison.tariffCode, 'E-1R-AGILE-24-10-01-C')
  // same usage, never moved
  assert.equal(res.body.actual.totalKwh, res.body.comparison.totalKwh)
  assert.equal(res.body.differencePence, 70)
})

test('GET /like-for-like resolves comparisonFamily=agile to the customer\'s own region', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-GO-18-06-12-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([{ intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 }]),
    fetchTariffUnitRates: (tariffCode) => {
      // Called once during import (for the customer's own GO tariff) and
      // again during the comparison (for the resolved Agile code, region
      // letter 'C' carried over from the customer's own tariff).
      if (tariffCode === 'E-1R-AGILE-24-10-01-C') {
        return Promise.resolve([{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 8 }])
      }
      return Promise.resolve([{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 20 }])
    },
    fetchActiveAgileTariffCode: (regionLetter) => {
      assert.equal(regionLetter, 'C')
      return Promise.resolve('E-1R-AGILE-24-10-01-C')
    },
  })

  await connectAndImport(app, 'user-family')
  const res = await request(app)
    .get('/api/octopus/like-for-like?comparisonFamily=agile')
    .set('Authorization', 'Bearer user-family')

  assert.equal(res.status, 200)
  assert.equal(res.body.comparisonAvailable, true)
  assert.equal(res.body.comparison.tariffCode, 'E-1R-AGILE-24-10-01-C')
})

test('GET /like-for-like reports a bounded/unavailable state instead of fabricating exactness for Intelligent Go', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([{ intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 }]),
    fetchTariffUnitRates: () => Promise.resolve([{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 10 }]),
  })

  await connectAndImport(app, 'user-bounded')
  const res = await request(app)
    .get('/api/octopus/like-for-like?comparisonTariffCode=E-1R-INTELLI-VAR-22-10-14-C')
    .set('Authorization', 'Bearer user-bounded')

  assert.equal(res.status, 200)
  assert.equal(res.body.comparisonAvailable, false)
  assert.equal(res.body.comparisonMethod, 'bounded_estimate')
})

test('GET /like-for-like requires a comparison tariff to be specified', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([{ intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 }]),
    fetchTariffUnitRates: () => Promise.resolve([{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 10 }]),
  })

  await connectAndImport(app, 'user-missing-param')
  const res = await request(app).get('/api/octopus/like-for-like').set('Authorization', 'Bearer user-missing-param')

  assert.equal(res.status, 400)
})

test('GET /like-for-like requires an import to have run first', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([]),
    fetchTariffUnitRates: () => Promise.resolve([]),
  })

  const res = await request(app)
    .get('/api/octopus/like-for-like?comparisonTariffCode=E-1R-GO-18-06-12-C')
    .set('Authorization', 'Bearer user-no-import')

  assert.equal(res.status, 400)
})
