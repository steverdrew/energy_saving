import { Router } from 'express'
import { findCheapestWindow } from '../cheapestWindow.js'
import { decrypt, encrypt } from '../crypto.js'
import {
  OctopusAuthError,
  OctopusRequestError,
  regionLetterFromTariffCode,
  summarizeOctopusAccount,
} from '../octopusClient.js'
import { compareCurrentTariffToAgile } from '../savingsComparison.js'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

// OA-6 MVP: import a recent, bounded window rather than full history --
// keeps each request fast and each Firestore doc well under its 1MiB
// limit. Revisit the window once real imported data has been reviewed.
const IMPORT_WINDOW_DAYS = 30

// OA-9: how far ahead to look for a cheap Agile window. Agile publishes
// today's prices, plus tomorrow's from ~4pm UK time -- 48h covers both
// without over-fetching.
const CHEAPEST_WINDOW_LOOKAHEAD_HOURS = 48

function roundDownToHalfHour(date) {
  const rounded = new Date(date)
  rounded.setUTCSeconds(0, 0)
  rounded.setUTCMinutes(rounded.getUTCMinutes() - (rounded.getUTCMinutes() % 30))
  return rounded
}

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
  fetchActiveAgileTariffCode,
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

  router.get('/savings-result', requireFirebaseAuth, async (req, res) => {
    const record = await importStore.get(req.firebaseUid)
    if (!record) {
      return res.status(400).json({ error: 'Import your usage history first.' })
    }

    const regionLetter = regionLetterFromTariffCode(record.tariffCode)

    let agileTariffCode
    let agileRates
    try {
      agileTariffCode = await fetchActiveAgileTariffCode(regionLetter)
      agileRates = await fetchTariffUnitRates(agileTariffCode, {
        periodFrom: record.periodFrom,
        periodTo: record.periodTo,
      })
    } catch {
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    const comparison = compareCurrentTariffToAgile({
      consumption: record.consumption,
      currentTariffRates: record.rates,
      agileRates,
    })

    const windowDays = Math.max(
      1,
      Math.round((new Date(record.periodTo).getTime() - new Date(record.periodFrom).getTime()) / 86400000),
    )
    const annualizedSavingPence = Math.round(comparison.estimatedSavingPence * (365 / windowDays) * 100) / 100

    // OA-21: unit rates only, no standing charge -- flagged explicitly so a
    // future standing-charge addition is an upgrade to this same result
    // shape, not a silent change of what the number means.
    res.json({
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      windowDays,
      currentTariffCostPence: comparison.currentTariffCostPence,
      agileCostPence: comparison.agileCostPence,
      estimatedSavingPence: comparison.estimatedSavingPence,
      annualizedSavingPence,
      unitRateOnly: true,
      agileTariffCode,
    })
  })

  router.get('/cheapest-window', requireFirebaseAuth, async (req, res) => {
    const durationMinutes = Number(req.query.durationMinutes)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ error: 'durationMinutes must be a positive number.' })
    }

    const connection = await store.get(req.firebaseUid)
    if (!connection) {
      return res.status(400).json({ error: 'Connect your Octopus account first.' })
    }

    const regionLetter = regionLetterFromTariffCode(connection.meterContext?.tariffCode ?? '')
    if (!regionLetter) {
      return res
        .status(400)
        .json({ error: "We don't have enough meter information yet. Reconnect your account." })
    }

    const periodFrom = roundDownToHalfHour(new Date())
    const periodTo = new Date(periodFrom.getTime() + CHEAPEST_WINDOW_LOOKAHEAD_HOURS * 60 * 60 * 1000)

    let agileTariffCode
    let rates
    try {
      agileTariffCode = await fetchActiveAgileTariffCode(regionLetter)
      rates = await fetchTariffUnitRates(agileTariffCode, {
        periodFrom: periodFrom.toISOString(),
        periodTo: periodTo.toISOString(),
      })
    } catch {
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    const window = findCheapestWindow(rates, durationMinutes)
    if (!window) {
      return res.json({ found: false })
    }

    res.json({ found: true, agileTariffCode, ...window })
  })

  return router
}
