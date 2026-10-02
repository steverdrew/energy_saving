import { Router } from 'express'
import { encrypt } from '../crypto.js'
import { OctopusAuthError, OctopusRequestError, summarizeOctopusAccount } from '../octopusClient.js'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

export function redactAccountNumber(accountNumber) {
  return `A-****${accountNumber.slice(-4)}`
}

/**
 * Builds the Octopus router. requireFirebaseAuth, fetchOctopusAccount and
 * store are all injected so tests can run without hitting Firebase's or
 * Octopus's real networks, or a real Firestore -- see server/src/index.js
 * for the production wiring (Firestore-backed store; Cloud Run has no
 * persistent local disk for SQLite).
 */
export function createOctopusRouter({ requireFirebaseAuth, fetchOctopusAccount, store }) {
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

    await store.upsert(req.firebaseUid, {
      accountNumberRedacted: redacted,
      encryptedAccountNumber: encrypt(normalizedAccountNumber),
      encryptedApiKey: encrypt(normalizedApiKey),
      meterContext,
      connectedAt: now,
      updatedAt: now,
    })

    res.json({ connected: true, accountNumberRedacted: redacted, meterContext, connectedAt: now })
  })

  router.get('/connection', requireFirebaseAuth, async (req, res) => {
    const record = await store.get(req.firebaseUid)

    if (!record) {
      return res.json({ connected: false })
    }

    res.json({
      connected: true,
      accountNumberRedacted: record.accountNumberRedacted,
      meterContext: record.meterContext ?? null,
      connectedAt: record.connectedAt,
    })
  })

  router.delete('/connection', requireFirebaseAuth, async (req, res) => {
    await store.remove(req.firebaseUid)
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
