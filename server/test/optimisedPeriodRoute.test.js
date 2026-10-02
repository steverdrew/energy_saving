// OA-76: route-level test -- with no flexible-load events available yet
// (detectFlexibleLoadEvents always returns [] until household appliance
// data exists, see flexibleLoadEvents.js), Optimised must degrade cleanly
// to Like-for-like's own figures: £0 timing opportunity, not an error, not
// a guessed saving.
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

function buildApp({ agreements, fetchElectricityConsumption, fetchTariffUnitRates, fetchProductDetails }) {
  const app = express()
  app.use(express.json())
  app.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount: fakeFetchOctopusAccount(agreements),
      fetchElectricityConsumption,
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

async function connectAndImport(app, token) {
  await request(app)
    .post('/api/octopus/connect')
    .set('Authorization', `Bearer ${token}`)
    .send({ accountNumber: 'A-12345678', apiKey: 'good-key' })
  await request(app).post('/api/octopus/import').set('Authorization', `Bearer ${token}`)
}

test('GET /optimised-period degrades cleanly to Like-for-like figures when no flexible events exist yet', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () =>
      Promise.resolve([
        { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
        { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 2 },
      ]),
    fetchTariffUnitRates: (tariffCode) => {
      if (tariffCode === 'E-1R-AGILE-24-10-01-C') {
        return Promise.resolve([
          { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
          { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 10 },
        ])
      }
      return Promise.resolve([
        { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 15 },
        { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 15 },
      ])
    },
    fetchProductDetails: () => Promise.resolve({ is_variable: true }),
  })

  await connectAndImport(app, 'user-optimised')
  const res = await request(app)
    .get('/api/octopus/optimised-period')
    .query({ comparisonFamily: 'agile' })
    .set('Authorization', 'Bearer user-optimised')

  assert.equal(res.status, 200)
  assert.equal(res.body.comparisonAvailable, true)
  assert.equal(res.body.optimised.totalCostPence, res.body.comparison.totalCostPence)
  assert.equal(res.body.optimised.totalKwh, res.body.comparison.totalKwh)
  assert.equal(res.body.optimised.moves.length, 0)
  assert.equal(res.body.optimised.eventsConsidered, 0)
  assert.deepEqual(res.body.optimised.confidenceTiers, [])
  assert.equal(res.body.timingOpportunityPence, 0)
  assert.equal(res.body.tariffChoiceOpportunityPence, res.body.actual.totalCostPence - res.body.comparison.totalCostPence)
})

test('GET /optimised-period requires an import to have run first', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([]),
    fetchTariffUnitRates: () => Promise.resolve([]),
  })

  const res = await request(app).get('/api/octopus/optimised-period').set('Authorization', 'Bearer user-no-import')
  assert.equal(res.status, 400)
})
