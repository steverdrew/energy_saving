import { Router } from 'express'
import { averageRate, findCheapestWindow } from '../cheapestWindow.js'
import { decrypt, encrypt } from '../crypto.js'
import {
  OctopusAuthError,
  OctopusRequestError,
  regionLetterFromTariffCode,
  summarizeOctopusAccount,
} from '../octopusClient.js'
import { compareCurrentTariffToAgile } from '../savingsComparison.js'
import { eligibilityForTariffCode } from '../tariffEligibility.js'
import { determineTariffState } from '../tariffState.js'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

// OA-6 MVP: import a recent, bounded window rather than full history --
// keeps each request fast and each Firestore doc well under its 1MiB
// limit. Revisit the window once real imported data has been reviewed.
const IMPORT_WINDOW_DAYS = 30

// OA-9: how far ahead to look for a cheap Agile window. Agile publishes
// today's prices, plus tomorrow's from ~4pm UK time -- 48h covers both
// without over-fetching.
const CHEAPEST_WINDOW_LOOKAHEAD_HOURS = 48

function round2(n) {
  return Math.round(n * 100) / 100
}

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
  ledgerStore,
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

    // OA-23: optional, like /cheapest-window's energyKwh -- when given,
    // also reports the modelled shifting-opportunity saving for one cycle
    // of this appliance, as a second, clearly separate number from the
    // tariff-fit comparison below (OA-7).
    let durationMinutes = null
    let energyKwh = null
    if (req.query.durationMinutes !== undefined || req.query.energyKwh !== undefined) {
      durationMinutes = Number(req.query.durationMinutes)
      energyKwh = Number(req.query.energyKwh)
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(energyKwh) || energyKwh <= 0) {
        return res
          .status(400)
          .json({ error: 'durationMinutes and energyKwh must both be positive numbers when either is given.' })
      }
    }

    const connection = await store.get(req.firebaseUid)
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

    const tariffState = determineTariffState({
      tariffCode: record.tariffCode,
      tariffValidFrom: connection?.meterContext?.tariffValidFrom ?? null,
    })
    const eligibility = eligibilityForTariffCode(agileTariffCode)

    // OA-23/OA-7: the "shifting opportunity" layer -- what moving this one
    // appliance's cycle to the cheapest slot within the *already-imported*
    // historical period would have cost, vs. the period's average rate on
    // the tariff the saving is quoted against (the customer's current
    // tariff -- see OA-45's double-counting rule). This is strictly
    // separate from the tariff-fit comparison above: tariff-fit reprices
    // the same usage at the same times; this models moving the usage
    // itself, and is always labelled projected/estimated, never summed
    // into estimatedSavingPence.
    let shiftingOpportunity = null
    if (durationMinutes !== null) {
      const window = findCheapestWindow(record.rates, durationMinutes)
      if (window) {
        const averageCurrentTariffRateIncVatPence = averageRate(record.rates)
        const costAtCheapestPence = round2(energyKwh * window.averageUnitRateIncVatPence)
        const costAtAverageRatePence = round2(energyKwh * averageCurrentTariffRateIncVatPence)
        shiftingOpportunity = {
          energyKwh,
          averageCurrentTariffRateIncVatPence,
          costAtCheapestPence,
          costAtAverageRatePence,
          savingPence: round2(costAtAverageRatePence - costAtCheapestPence),
          unitRateOnly: true,
        }
      }
    }

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
      tariffState,
      eligibility,
      shiftingOpportunity,
    })
  })

  router.get('/cheapest-window', requireFirebaseAuth, async (req, res) => {
    const durationMinutes = Number(req.query.durationMinutes)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ error: 'durationMinutes must be a positive number.' })
    }

    // OA-40: optional -- when given, and the account has imported usage
    // history, the response also quantifies the saving vs. the current
    // tariff for one cycle of this appliance. Omit it (or import nothing
    // yet) and the endpoint still just answers "when is it cheapest".
    let energyKwh = null
    if (req.query.energyKwh !== undefined) {
      energyKwh = Number(req.query.energyKwh)
      if (!Number.isFinite(energyKwh) || energyKwh <= 0) {
        return res.status(400).json({ error: 'energyKwh must be a positive number.' })
      }
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

    let recommendation = null
    if (energyKwh !== null) {
      const importRecord = await importStore.get(req.firebaseUid)
      const averageCurrentTariffRateIncVatPence = averageRate(importRecord?.rates)
      if (averageCurrentTariffRateIncVatPence != null) {
        const costAtCheapestPence = round2(energyKwh * window.averageUnitRateIncVatPence)
        const costAtCurrentTariffPence = round2(energyKwh * averageCurrentTariffRateIncVatPence)
        recommendation = {
          energyKwh,
          averageCurrentTariffRateIncVatPence,
          costAtCheapestPence,
          costAtCurrentTariffPence,
          savingPence: round2(costAtCurrentTariffPence - costAtCheapestPence),
          unitRateOnly: true,
        }
      }
    }

    res.json({ found: true, agileTariffCode, ...window, recommendation })
  })

  // OA-32: best-effort, on-demand check of whether whole-house consumption
  // during the recommended window is consistent with the appliance having
  // actually run -- never proof (it's whole-house, not device-level), and
  // never used to change creditedPence, only to attach a confidence label
  // self-report remains the only thing that credits a saving (OA-41).
  // Octopus's half-hourly consumption data commonly lags by about a day,
  // so 'unknown' (not 'inconsistent') is the honest answer whenever no
  // reading covers the window yet.
  async function checkMeterConsistency({ uid, windowStartsAt, windowEndsAt, expectedEnergyKwh }) {
    const connection = await store.get(uid)
    const { mpan, serialNumber } = connection?.meterContext ?? {}
    if (!connection || !mpan || !serialNumber) return 'unknown'

    let consumption
    try {
      const apiKey = decrypt(connection.encryptedApiKey)
      consumption = await fetchElectricityConsumption(mpan, serialNumber, apiKey, {
        periodFrom: windowStartsAt,
        periodTo: windowEndsAt,
      })
    } catch {
      return 'unknown'
    }

    if (!Array.isArray(consumption) || consumption.length === 0) return 'unknown'

    const actualKwh = consumption.reduce((sum, c) => sum + (c.consumptionKwh ?? 0), 0)
    // Whole-house usage during the window should be at least roughly in
    // line with the appliance's own energy use if it ran -- a tolerance
    // below the full expected amount, since actual draw varies by cycle
    // and this is never meant to be a precise device-level check.
    return actualKwh >= expectedEnergyKwh * 0.6 ? 'consistent' : 'inconsistent'
  }

  // OA-41: "did you run it at the recommended time?" -- showing a
  // recommendation is not the same as saving money, so the running total
  // (`GET /savings-total`) only credits an event the user explicitly
  // confirmed. A declined or unanswered recommendation is still recorded
  // (for a later projected-vs-actual comparison) but credits £0.
  router.post('/recommendation-confirm', requireFirebaseAuth, async (req, res) => {
    const { windowStartsAt, windowEndsAt, applianceType, savingPence, confirmed, energyKwh } = req.body ?? {}

    if (typeof windowStartsAt !== 'string' || typeof windowEndsAt !== 'string' || !windowStartsAt || !windowEndsAt) {
      return res.status(400).json({ error: 'windowStartsAt and windowEndsAt are both required.' })
    }
    if (typeof applianceType !== 'string' || !applianceType) {
      return res.status(400).json({ error: 'applianceType is required.' })
    }
    if (typeof savingPence !== 'number' || !Number.isFinite(savingPence) || savingPence < 0) {
      return res.status(400).json({ error: 'savingPence must be a non-negative number.' })
    }
    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'confirmed must be true or false.' })
    }
    if (energyKwh !== undefined && (typeof energyKwh !== 'number' || !Number.isFinite(energyKwh) || energyKwh <= 0)) {
      return res.status(400).json({ error: 'energyKwh must be a positive number when given.' })
    }

    const creditedPence = confirmed ? savingPence : 0

    // OA-32: self-report (confirmed) is the only thing recorded
    // immediately and the only thing that credits a saving. The
    // meter-consistency check is best-effort and attached as a separate
    // field -- it never overrides or delays the self-report.
    let meterConsistency = 'unknown'
    if (confirmed && energyKwh !== undefined) {
      meterConsistency = await checkMeterConsistency({
        uid: req.firebaseUid,
        windowStartsAt,
        windowEndsAt,
        expectedEnergyKwh: energyKwh,
      })
    }

    await ledgerStore.addEvent(req.firebaseUid, {
      source: 'manual',
      windowStartsAt,
      windowEndsAt,
      applianceType,
      savingPence,
      confirmed,
      creditedPence,
      meterConsistency,
      confirmedAt: new Date().toISOString(),
    })

    res.json({ confirmed, creditedPence, meterConsistency })
  })

  router.get('/savings-total', requireFirebaseAuth, async (req, res) => {
    const events = await ledgerStore.listEvents(req.firebaseUid)
    const savedSoFarPence = round2(events.reduce((sum, event) => sum + (event.creditedPence ?? 0), 0))
    // OA-32: a count, not a recalculation of the total -- meter data can
    // never change what's credited, only describe how much of it the
    // meter happens to corroborate.
    const consistentCount = events.filter((e) => e.meterConsistency === 'consistent').length
    res.json({ savedSoFarPence, eventCount: events.length, consistentCount })
  })

  return router
}
