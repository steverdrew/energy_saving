import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'

const { createApp } = await import('../src/index.js')
const request = (await import('supertest')).default

const app = createApp()

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
})
