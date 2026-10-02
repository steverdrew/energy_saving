import { Router } from 'express'
import { db } from '../db.js'
import { encrypt } from '../crypto.js'
import { OctopusAuthError, OctopusRequestError, summarizeOctopusAccount } from '../octopusClient.js'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

export function redactAccountNumber(accountNumber) {
  return `A-****${accountNumber.slice(-4)}`
}

/**
 * Builds the Octopus router. requireFirebaseAuth and fetchOctopusAccount are
 * injected so tests can run without hitting Firebase's or Octopus's real
 * networks -- see server/src/index.js for the production wiring.
 */
export function createOctopusRouter({ requireFirebaseAuth, fetchOctopusAccount }) {
  const router = Router()

  router.post('/connect', requireFirebaseAuth, async (req, res) => {
    const { accountNumber, apiKey } = req.body ?? {}

    if (
      typeof accountNumber !== 'string' ||
      typeof apiKey !== 'string' ||
      !accountNumber.trim() ||
      !apiKey.trim()
    ) {
      return res.status(400).json({ error: 'Account number and API key are both required.' })
    }

    const normalizedAccountNumber = accountNumber.trim().toUpperCase()
    const normalizedApiKey = apiKey.trim()

    if (!ACCOUNT_NUMBER_RE.test(normalizedAccountNumber)) {
      return res.status(400).json({ error: 'Account number should look like A-XXXXXXXX.' })
    }

    let account
    try {
      account = await fetchOctopusAccount(normalizedAccountNumber, normalizedApiKey)
    } catch (err) {
      if (err instanceof OctopusAuthError) {
        return res.status(401).json({ error: err.message })
      }
      if (err instanceof OctopusRequestError) {
        return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
      }
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    const meterContext = summarizeOctopusAccount(account)
    const now = new Date().toISOString()
    const redacted = redactAccountNumber(normalizedAccountNumber)

    db.prepare(
      `INSERT INTO octopus_connections
         (firebase_uid, account_number_redacted, encrypted_account_number, encrypted_api_key, meter_context, connected_at, updated_at)
       VALUES (@uid, @redacted, @encAccount, @encKey, @meterContext, @now, @now)
       ON CONFLICT(firebase_uid) DO UPDATE SET
         account_number_redacted = excluded.account_number_redacted,
         encrypted_account_number = excluded.encrypted_account_number,
         encrypted_api_key = excluded.encrypted_api_key,
         meter_context = excluded.meter_context,
         updated_at = excluded.updated_at`,
    ).run({
      uid: req.firebaseUid,
      redacted,
      encAccount: encrypt(normalizedAccountNumber),
      encKey: encrypt(normalizedApiKey),
      meterContext: JSON.stringify(meterContext),
      now,
    })

    res.json({ connected: true, accountNumberRedacted: redacted, meterContext, connectedAt: now })
  })

  router.get('/connection', requireFirebaseAuth, (req, res) => {
    const row = db
      .prepare(
        'SELECT account_number_redacted, meter_context, connected_at FROM octopus_connections WHERE firebase_uid = ?',
      )
      .get(req.firebaseUid)

    if (!row) {
      return res.json({ connected: false })
    }

    res.json({
      connected: true,
      accountNumberRedacted: row.account_number_redacted,
      meterContext: row.meter_context ? JSON.parse(row.meter_context) : null,
      connectedAt: row.connected_at,
    })
  })

  router.delete('/connection', requireFirebaseAuth, (req, res) => {
    db.prepare('DELETE FROM octopus_connections WHERE firebase_uid = ?').run(req.firebaseUid)
    res.status(204).end()
  })

  router.get('/import-status', requireFirebaseAuth, (_req, res) => {
    res.status(501).json({ error: 'Not implemented' })
  })
  router.get('/savings-result', requireFirebaseAuth, (_req, res) => {
    res.status(501).json({ error: 'Not implemented' })
  })

  return router
}
