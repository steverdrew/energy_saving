import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'

const { createApp } = await import('../src/index.js')
const request = (await import('supertest')).default

const app = createApp()

async function signUpAndGetCookie() {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    acceptedTerms: true,
    acceptedPrivacy: true,
  })
  return res.headers['set-cookie']
}

for (const [method, path] of [
  ['post', '/api/octopus/connect'],
  ['get', '/api/octopus/import-status'],
  ['get', '/api/octopus/savings-result'],
]) {
  test(`${method.toUpperCase()} ${path} requires authentication`, async () => {
    const res = await request(app)[method](path)
    assert.equal(res.status, 401)
  })

  test(`${method.toUpperCase()} ${path} returns 501 with a JSON error when authenticated`, async () => {
    const cookie = await signUpAndGetCookie()
    const res = await request(app)[method](path).set('Cookie', cookie)
    assert.equal(res.status, 501)
    assert.equal(typeof res.body.error, 'string')
  })
}
