import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'

const { createApp } = await import('../src/index.js')
const request = (await import('supertest')).default

const app = createApp()

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

test('signup creates an account and sets a session cookie', async () => {
  const email = uniqueEmail()
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    acceptedTerms: true,
    acceptedPrivacy: true,
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.user.email, email)
  assert.ok(res.headers['set-cookie']?.some((c) => c.startsWith('sid=')))
})

test('signup rejects missing consent', async () => {
  const res = await request(app).post('/api/auth/signup').send({
    email: uniqueEmail(),
    password: 'password123',
    acceptedTerms: false,
    acceptedPrivacy: true,
  })

  assert.equal(res.status, 400)
})

test('login succeeds with correct credentials', async () => {
  const email = uniqueEmail()
  await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    acceptedTerms: true,
    acceptedPrivacy: true,
  })

  const res = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123',
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.user.email, email)
})

test('login fails with wrong password', async () => {
  const email = uniqueEmail()
  await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    acceptedTerms: true,
    acceptedPrivacy: true,
  })

  const res = await request(app).post('/api/auth/login').send({
    email,
    password: 'wrong-password',
  })

  assert.equal(res.status, 401)
})

test('session cookie grants access to /api/auth/me', async () => {
  const email = uniqueEmail()
  const signupRes = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    acceptedTerms: true,
    acceptedPrivacy: true,
  })
  const cookie = signupRes.headers['set-cookie']

  const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie)
  assert.equal(meRes.status, 200)
  assert.equal(meRes.body.user.email, email)
})

test('/api/auth/me without a session is unauthorized', async () => {
  const res = await request(app).get('/api/auth/me')
  assert.equal(res.status, 401)
})
