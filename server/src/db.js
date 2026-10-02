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

  -- One Octopus connection per Firebase user (OA-5/OA-20). The account
  -- number and API key are both encrypted at rest (see src/crypto.js) and
  -- never returned to the browser; account_number_redacted is the only
  -- display-safe form. firebase_uid is the sole ownership boundary -- no
  -- row is ever readable across users.
  CREATE TABLE IF NOT EXISTS octopus_connections (
    firebase_uid TEXT PRIMARY KEY,
    account_number_redacted TEXT NOT NULL,
    encrypted_account_number TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    meter_context TEXT,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)
