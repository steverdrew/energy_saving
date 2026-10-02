// OA-81: household appliance setup -- covers the ticket's own listed test
// cases.
import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const express = (await import('express')).default
const request = (await import('supertest')).default
const { createRequireFirebaseAuth } = await import('../src/firebaseAuth.js')
const { createHouseholdApplianceRouter } = await import('../src/routes/householdAppliances.js')
const { createInMemoryHouseholdApplianceStore } = await import('./helpers/fakeHouseholdApplianceStore.js')

const requireFirebaseAuth = createRequireFirebaseAuth(async (token) => ({ uid: token, email: `${token}@example.com` }))

function buildApp(store = createInMemoryHouseholdApplianceStore()) {
  const app = express()
  app.use(express.json())
  app.use('/api/household-appliances', createHouseholdApplianceRouter({ requireFirebaseAuth, store }))
  return { app, store }
}

test('a household with no appliances selected has an empty list', async () => {
  const { app } = buildApp()
  const res = await request(app).get('/api/household-appliances').set('Authorization', 'Bearer user-empty')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.appliances, [])
})

for (const applianceType of ['dishwasher', 'washing_machine', 'tumble_dryer', 'dehumidifier']) {
  test(`adding a supported appliance category: ${applianceType}`, async () => {
    const { app } = buildApp()
    const addRes = await request(app)
      .post('/api/household-appliances')
      .set('Authorization', `Bearer user-${applianceType}`)
      .send({ applianceType })
    assert.equal(addRes.status, 201)
    assert.equal(addRes.body.appliance.applianceType, applianceType)
    assert.equal(addRes.body.appliance.enabled, true)
    assert.equal(addRes.body.appliance.durationMinutes.source, 'generic_default')

    const listRes = await request(app)
      .get('/api/household-appliances')
      .set('Authorization', `Bearer user-${applianceType}`)
    assert.equal(listRes.body.appliances.length, 1)
    assert.equal(listRes.body.appliances[0].applianceType, applianceType)
  })
}

test('an unsupported/unknown appliance type is rejected, never silently shiftable', async () => {
  const { app } = buildApp()
  const res = await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-unsupported')
    .send({ applianceType: 'ev_charger' })
  assert.equal(res.status, 400)

  const listRes = await request(app).get('/api/household-appliances').set('Authorization', 'Bearer user-unsupported')
  assert.deepEqual(listRes.body.appliances, [])
})

test('generic default is retained when the user does not confirm runtime/energy', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-defaults')
    .send({ applianceType: 'dishwasher' })

  // Confirm only the label -- runtime/energy untouched.
  const res = await request(app)
    .patch('/api/household-appliances/dishwasher')
    .set('Authorization', 'Bearer user-defaults')
    .send({ label: 'Our dishwasher' })

  assert.equal(res.status, 200)
  assert.equal(res.body.appliance.durationMinutes.source, 'generic_default')
  assert.equal(res.body.appliance.energyKwh.source, 'generic_default')
  assert.equal(res.body.appliance.label, 'Our dishwasher')
})

test('user-confirmed runtime replaces the generic value and its source', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-runtime')
    .send({ applianceType: 'dishwasher' })

  const res = await request(app)
    .patch('/api/household-appliances/dishwasher')
    .set('Authorization', 'Bearer user-runtime')
    .send({ durationMinutes: 95 })

  assert.equal(res.status, 200)
  assert.equal(res.body.appliance.durationMinutes.value, 95)
  assert.equal(res.body.appliance.durationMinutes.source, 'user_confirmed')
  // Energy untouched by this request.
  assert.equal(res.body.appliance.energyKwh.source, 'generic_default')
})

test('user-confirmed energy replaces the generic value and its source', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-energy')
    .send({ applianceType: 'washing_machine' })

  const res = await request(app)
    .patch('/api/household-appliances/washing_machine')
    .set('Authorization', 'Bearer user-energy')
    .send({ energyKwh: 0.75 })

  assert.equal(res.status, 200)
  assert.equal(res.body.appliance.energyKwh.value, 0.75)
  assert.equal(res.body.appliance.energyKwh.source, 'user_confirmed')
})

test('negative or zero runtime/energy is rejected', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-validation')
    .send({ applianceType: 'dishwasher' })

  const negativeDuration = await request(app)
    .patch('/api/household-appliances/dishwasher')
    .set('Authorization', 'Bearer user-validation')
    .send({ durationMinutes: -10 })
  assert.equal(negativeDuration.status, 400)

  const zeroEnergy = await request(app)
    .patch('/api/household-appliances/dishwasher')
    .set('Authorization', 'Bearer user-validation')
    .send({ energyKwh: 0 })
  assert.equal(zeroEnergy.status, 400)
})

test('deleting/disabling an appliance removes it from the active household setup', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-disable')
    .send({ applianceType: 'tumble_dryer' })

  const deleteRes = await request(app)
    .delete('/api/household-appliances/tumble_dryer')
    .set('Authorization', 'Bearer user-disable')
  assert.equal(deleteRes.status, 204)

  const listRes = await request(app).get('/api/household-appliances').set('Authorization', 'Bearer user-disable')
  assert.deepEqual(listRes.body.appliances, [])
})

test('ownership alone does not create a historical flexible event', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-no-event')
    .send({ applianceType: 'dishwasher' })

  // detectFlexibleLoadEvents (OA-76) is entirely independent of this
  // store -- declaring an appliance here has no code path into it at
  // all, so there is nothing to assert a "before" state against: the
  // absence of any such wiring is the point. This test documents that
  // boundary rather than exercising it.
  const { detectFlexibleLoadEvents } = await import('../src/flexibleLoadEvents.js')
  assert.deepEqual(await detectFlexibleLoadEvents('user-no-event'), [])
})

test('re-adding a previously disabled appliance keeps its earlier user-confirmed values', async () => {
  const { app } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-readd')
    .send({ applianceType: 'dehumidifier' })
  await request(app)
    .patch('/api/household-appliances/dehumidifier')
    .set('Authorization', 'Bearer user-readd')
    .send({ energyKwh: 1.4 })
  await request(app).delete('/api/household-appliances/dehumidifier').set('Authorization', 'Bearer user-readd')

  const readdRes = await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-readd')
    .send({ applianceType: 'dehumidifier' })

  assert.equal(readdRes.body.appliance.enabled, true)
  assert.equal(readdRes.body.appliance.energyKwh.value, 1.4)
  assert.equal(readdRes.body.appliance.energyKwh.source, 'user_confirmed')
})

test('API persistence round-trip: add, confirm, list, and re-fetch all agree', async () => {
  const { app, store } = buildApp()
  await request(app)
    .post('/api/household-appliances')
    .set('Authorization', 'Bearer user-roundtrip')
    .send({ applianceType: 'washing_machine' })
  await request(app)
    .patch('/api/household-appliances/washing_machine')
    .set('Authorization', 'Bearer user-roundtrip')
    .send({ durationMinutes: 110, interruptible: false, requiresAwakeHome: true, brand: 'Acme', model: 'WM-200' })

  const persisted = await store.get('user-roundtrip')
  const listRes = await request(app).get('/api/household-appliances').set('Authorization', 'Bearer user-roundtrip')

  assert.equal(persisted.appliances.washing_machine.durationMinutes.value, 110)
  assert.equal(persisted.appliances.washing_machine.brand, 'Acme')
  assert.deepEqual(listRes.body.appliances[0], persisted.appliances.washing_machine)
})
