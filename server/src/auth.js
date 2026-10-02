import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from './db.js'

export const CONSENT_VERSION = '2026-10-02'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_COOKIE = 'sid'

export function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function createSession(userId) {
  const id = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    id,
    userId,
    expiresAt,
  )
  return { id, expiresAt }
}

export function destroySession(sessionId) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function getUserForSession(sessionId) {
  if (!sessionId) return null
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId)
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(sessionId)
    return null
  }
  return db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .get(session.user_id)
}

export function requireAuth(req, res, next) {
  const user = getUserForSession(req.cookies?.[SESSION_COOKIE])
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }
  req.user = user
  next()
}

export function setSessionCookie(res, sessionId, expiresAt) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE)
}
