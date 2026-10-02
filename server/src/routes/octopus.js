import { Router } from 'express'
import { decrypt, encrypt } from '../crypto.js'
import { OctopusAuthError, OctopusRequestError, summarizeOctopusAccount } from '../octopusClient.js'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

// OA-6 MVP: import a recent, bounded window rather than full history --
// keeps each request fast and each Firestore doc well under its 1MiB
// limit. Revisit the window once real imported data has been reviewed.
const IMPORT_WINDOW_DAYS = 30

export function redactAccountNumber(accountNumber) {
  return `A-****${accountNumber.slice(-4)}`
}

/**
 * Builds the Octopus router. requireFirebaseAuth, fetchOctopusAccount,
 * fetchElectricityConsumption, fetchTariffUnitRates, store and
 * importStore are all injected so tests can run without hitting
 * Firebase's or Octopus's real networks, or a real Firestore -- see
 * server/src/index.js for the production wiring (Firestore-backed
 * stores; Cloud Run has no persistent local disk for SQLite).
 */
export function createOctopusRouter({
  requireFirebaseAuth,
  fetchOctopusAccount,
  fetchElectricityConsumption,
  fetchTariffUnitRates,
  store,
  importStore,
}) {
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

  router.post('/import', requireFirebaseAuth, async (req, res) => {
    const connection = await store.get(req.firebaseUid)
    if (!connection) {
      return res.status(400).json({ error: 'Connect your Octopus account first.' })
    }

    const { mpan, serialNumber, tariffCode } = connection.meterContext ?? {}
    if (!mpan || !serialNumber || !tariffCode) {
      return res
        .status(400)
        .json({ error: "We don't have enough meter information yet. Reconnect your account." })
    }

    const periodTo = new Date()
    const periodFrom = new Date(periodTo.getTime() - IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const periodFromIso = periodFrom.toISOString()
    const periodToIso = periodTo.toISOString()

    let consumption
    let rates
    try {
      const apiKey = decrypt(connection.encryptedApiKey)
      consumption = await fetchElectricityConsumption(mpan, serialNumber, apiKey, {
        periodFrom: periodFromIso,
        periodTo: periodToIso,
      })
      rates = await fetchTariffUnitRates(tariffCode, { periodFrom: periodFromIso, periodTo: periodToIso })
    } catch (err) {
      if (err instanceof OctopusAuthError) {
        return res.status(401).json({ error: err.message })
      }
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    const importedAt = new Date().toISOString()
    await importStore.upsert(req.firebaseUid, {
      periodFrom: periodFromIso,
      periodTo: periodToIso,
      tariffCode,
      consumption,
      rates,
      importedAt,
    })

    res.json({
      imported: true,
      periodFrom: periodFromIso,
      periodTo: periodToIso,
      consumptionPoints: consumption.length,
      ratePoints: rates.length,
      importedAt,
    })
  })

  router.get('/import-status', requireFirebaseAuth, async (req, res) => {
    const record = await importStore.get(req.firebaseUid)
    if (!record) {
      return res.json({ imported: false })
    }
    res.json({
      imported: true,
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      consumptionPoints: record.consumption?.length ?? 0,
      ratePoints: record.rates?.length ?? 0,
      importedAt: record.importedAt,
    })
  })

  router.get('/savings-result', requireFirebaseAuth, (_req, res) => {
    res.status(501).json({ error: 'Not implemented' })
  })

  return router
}
