// OA-71: /actual-period must reconstruct real cost honestly -- including
// correctly splitting a mid-period tariff switch across the two tariffs
// that actually applied, rather than pricing the whole window on
// whichever tariff happens to be current today.
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

function buildApp({ agreements, fetchElectricityConsumption, fetchTariffUnitRates }) {
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

test('GET /actual-period reprices the whole window on the single current tariff', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () =>
      Promise.resolve([
        { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
        { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 2 },
      ]),
    fetchTariffUnitRates: () =>
      Promise.resolve([
        { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
        { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 10 },
      ]),
  })

  await connectAndImport(app, 'user-single')
  const res = await request(app).get('/api/octopus/actual-period').set('Authorization', 'Bearer user-single')

  assert.equal(res.status, 200)
  assert.equal(res.body.tariffSwitched, false)
  assert.equal(res.body.tariffSegments.length, 1)
  assert.equal(res.body.tariffSegments[0].tariffCode, 'E-1R-AGILE-24-10-01-C')
  // 1*30 + 2*10 = 50p
  assert.equal(res.body.totalCostPence, 50)
  assert.equal(res.body.totalKwh, 3)
  assert.equal(res.body.unitRateOnly, true)
})

test('GET /actual-period prices each side of a mid-period switch on its own tariff', async () => {
  const now = new Date()
  const switchAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
  const oldPoint = new Date(switchAt.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const newPoint = new Date(switchAt.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const app = buildApp({
    agreements: [
      { tariff_code: 'E-1R-GO-18-06-12-C', valid_from: '2020-01-01', valid_to: switchAt.toISOString() },
      { tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: switchAt.toISOString(), valid_to: null },
    ],
    fetchElectricityConsumption: () =>
      Promise.resolve([
        { intervalStart: oldPoint, consumptionKwh: 1 },
        { intervalStart: newPoint, consumptionKwh: 2 },
      ]),
    fetchTariffUnitRates: (tariffCode) => {
      if (tariffCode === 'E-1R-GO-18-06-12-C') return Promise.resolve([{ validFrom: oldPoint, unitRateIncVatPence: 30 }])
      if (tariffCode === 'E-1R-AGILE-24-10-01-C') return Promise.resolve([{ validFrom: newPoint, unitRateIncVatPence: 5 }])
      return Promise.resolve([])
    },
  })

  await connectAndImport(app, 'user-switch')
  const res = await request(app).get('/api/octopus/actual-period').set('Authorization', 'Bearer user-switch')

  assert.equal(res.status, 200)
  assert.equal(res.body.tariffSwitched, true)
  assert.equal(res.body.tariffSegments.length, 2)
  assert.equal(res.body.tariffSegments[0].tariffCode, 'E-1R-GO-18-06-12-C')
  assert.equal(res.body.tariffSegments[1].tariffCode, 'E-1R-AGILE-24-10-01-C')
  // 1*30 (old tariff) + 2*5 (new tariff) = 40p -- never priced as if one
  // tariff covered both points.
  assert.equal(res.body.totalCostPence, 40)
  assert.equal(res.body.points.find((p) => p.startsAt === oldPoint).tariffCode, 'E-1R-GO-18-06-12-C')
  assert.equal(res.body.points.find((p) => p.startsAt === newPoint).tariffCode, 'E-1R-AGILE-24-10-01-C')
})

test('GET /actual-period reports an honest no_data state instead of a fabricated total', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([]),
    fetchTariffUnitRates: () => Promise.resolve([]),
  })

  await connectAndImport(app, 'user-empty')
  const res = await request(app).get('/api/octopus/actual-period').set('Authorization', 'Bearer user-empty')

  assert.equal(res.status, 200)
  assert.equal(res.body.importStatus, 'no_data')
  assert.equal(res.body.complete, false)
  assert.equal(res.body.totalCostPence, undefined)
})

test('GET /actual-period requires an import to have run first', async () => {
  const app = buildApp({
    agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-C', valid_from: '2024-01-01', valid_to: null }],
    fetchElectricityConsumption: () => Promise.resolve([]),
    fetchTariffUnitRates: () => Promise.resolve([]),
  })

  const res = await request(app).get('/api/octopus/actual-period').set('Authorization', 'Bearer user-no-import')

  assert.equal(res.status, 400)
})
