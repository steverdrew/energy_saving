import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const { createApp } = await import('../src/index.js')
const request = (await import('supertest')).default

const app = createApp()

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
})
