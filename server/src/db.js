import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { loadConfig } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { databasePath } = loadConfig()
const dbPath =
  databasePath === ':memory:' || path.isAbsolute(databasePath)
    ? databasePath
    : path.join(__dirname, '..', databasePath)

if (dbPath !== ':memory:') {
  mkdirSync(path.dirname(dbPath), { recursive: true })
}

export const db = new Database(dbPath)
// WAL needs a real file; an in-memory database (used by tests) stays in the default journal mode.
if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL')
}
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy TEXT NOT NULL,
    version TEXT NOT NULL,
    granted_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
`)

// Octopus connections (OA-5/OA-20) live in Firestore, not here -- see
// src/octopusStore.js. The server runs on Cloud Run, whose filesystem
// doesn't persist across container restarts/instances, so SQLite can't be
// the durable store for anything that needs to survive a redeploy.
