import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'
import {
  CONSENT_VERSION,
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from '../auth.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

authRouter.post('/signup', async (req, res) => {
  const { email, password, acceptedTerms, acceptedPrivacy } = req.body ?? {}

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  }
  if (!acceptedTerms || !acceptedPrivacy) {
    return res
      .status(400)
      .json({ error: 'You must accept the terms and privacy policy to continue' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalizedEmail)
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  const insertUser = db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  )
  const insertConsent = db.prepare(
    'INSERT INTO consents (id, user_id, policy, version, granted_at) VALUES (?, ?, ?, ?, ?)',
  )

  db.transaction(() => {
    insertUser.run(userId, normalizedEmail, passwordHash, now)
    insertConsent.run(crypto.randomUUID(), userId, 'terms', CONSENT_VERSION, now)
    insertConsent.run(crypto.randomUUID(), userId, 'privacy', CONSENT_VERSION, now)
  })()

  const session = createSession(userId)
  setSessionCookie(res, session.id, session.expiresAt)
  res.status(201).json({ user: { id: userId, email: normalizedEmail } })
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter your email and password' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizedEmail)

  const valid = user ? await verifyPassword(password, user.password_hash) : false
  if (!user || !valid) {
    return res.status(401).json({ error: 'Incorrect email or password' })
  }

  const session = createSession(user.id)
  setSessionCookie(res, session.id, session.expiresAt)
  res.json({ user: { id: user.id, email: user.email } })
})

authRouter.post('/logout', (req, res) => {
  const sessionId = req.cookies?.sid
  if (sessionId) destroySession(sessionId)
  clearSessionCookie(res)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

authRouter.delete('/account', requireAuth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id)
  clearSessionCookie(res)
  res.status(204).end()
})
