import { Router } from 'express'
import { buildActualPeriod, tariffSegmentsForPeriod } from '../actualPeriod.js'
import { averageRate, findCheapestWindow } from '../cheapestWindow.js'
import { decrypt, encrypt } from '../crypto.js'
import { detectFlexibleLoadEvents } from '../flexibleLoadEvents.js'
import {
  OctopusAuthError,
  OctopusRequestError,
  meterAgreementsFromAccount,
  regionLetterFromTariffCode,
  summarizeOctopusAccount,
} from '../octopusClient.js'
import { compareCurrentTariffToAgile } from '../savingsComparison.js'
import {
  applyMovesToSeries,
  maxHalfHourlyKwh,
  scheduleFlexibleLoadEvents,
  summarizeSeries,
} from '../shiftingOptimiser.js'
import { classifyTariff, TARIFF_FAMILY } from '../tariffClassification.js'
import { eligibilityForFamily } from '../tariffEligibility.js'
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

// OA-66: a tariff whose every rate in the lookahead window is identical
// has no "cheapest time" to find -- treating one arbitrary slot as the
// winner would fabricate a timing benefit that doesn't exist.
function isFlatRate(rates) {
  // A single remaining slot (e.g. very late at night, before tomorrow's
  // prices are out) isn't evidence of a flat tariff -- there's nothing
  // to compare it against.
  if (!Array.isArray(rates) || rates.length < 2) return false
  const first = rates[0].unitRateIncVatPence
  return rates.every((r) => r.unitRateIncVatPence === first)
}

// OA-67: never recommend a window whose actionable start has already
// passed. Rates already carry their own validTo, so "has this slot
// fully elapsed" doesn't need any separate half-hour-rounding logic --
// a slot still counts while `now` falls anywhere inside it.
function excludeElapsedSlots(rates, now) {
  return rates.filter((r) => new Date(r.validTo).getTime() > now.getTime())
}

// OA-63: zero data is a problem to explain, not a successful result to
// summarise -- `imported: true` alone used to mean "a request completed",
// even when Octopus returned nothing usable. `status` makes the real
// outcome explicit so the UI can never show zero readings/rates as if
// history exists for that period.
function importStatusFromCounts(consumptionPoints, ratePoints) {
  if (consumptionPoints > 0 && ratePoints > 0) return 'success'
  if (consumptionPoints === 0 && ratePoints === 0) return 'no_data'
  return 'partial'
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
  fetchProductDetails,
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

    const status = importStatusFromCounts(consumption.length, rates.length)
    res.json({
      imported: true,
      status,
      // A "covering X to Y" claim only makes sense once there's at least
      // some data in that period -- never for a flat no_data result.
      periodFrom: status === 'no_data' ? undefined : periodFromIso,
      periodTo: status === 'no_data' ? undefined : periodToIso,
      consumptionPoints: consumption.length,
      ratePoints: rates.length,
      importedAt,
    })
  })

  router.get('/import-status', requireFirebaseAuth, async (req, res) => {
    const record = await importStore.get(req.firebaseUid)
    if (!record) {
      return res.json({ imported: false, status: 'not_imported' })
    }
    const consumptionPoints = record.consumption?.length ?? 0
    const ratePoints = record.rates?.length ?? 0
    const status = importStatusFromCounts(consumptionPoints, ratePoints)
    res.json({
      imported: true,
      status,
      periodFrom: status === 'no_data' ? undefined : record.periodFrom,
      periodTo: status === 'no_data' ? undefined : record.periodTo,
      consumptionPoints,
      ratePoints,
      importedAt: record.importedAt,
    })
  })

  // OA-71/OA-72: the shared "what actually happened" reconstruction --
  // real tariff(s), real half-hourly usage, real cost for the already-
  // imported window, correctly split across any mid-period tariff switch
  // rather than pretending one tariff covered the whole window. Used by
  // /actual-period directly, and as the fixed baseline half of
  // /like-for-like's comparison, so both show exactly the same Actual
  // numbers.
  async function loadActualReconstruction(uid) {
    const record = await importStore.get(uid)
    if (!record) {
      return { error: { status: 400, body: { error: 'Import your usage history first.' } } }
    }

    const importStatus = importStatusFromCounts(record.consumption?.length ?? 0, record.rates?.length ?? 0)
    if (importStatus === 'no_data') {
      // Nothing to reconstruct -- an honest empty state rather than a
      // precise-looking £0 total, and no point spending an extra Octopus
      // round trip to check for a tariff switch within a period that has
      // no usage data anyway.
      return { record, importStatus, actual: null, tariffSwitched: false, tariffSegments: [] }
    }

    const connection = await store.get(uid)
    if (!connection) {
      return { error: { status: 400, body: { error: 'Connect your Octopus account first.' } } }
    }

    let account
    try {
      const accountNumber = decrypt(connection.encryptedAccountNumber)
      const apiKey = decrypt(connection.encryptedApiKey)
      account = await fetchOctopusAccount(accountNumber, apiKey)
    } catch (err) {
      if (err instanceof OctopusAuthError) {
        return { error: { status: 401, body: { error: err.message } } }
      }
      return { error: { status: 502, body: { error: 'Could not reach Octopus right now. Please try again.' } } }
    }

    const agreements = meterAgreementsFromAccount(account)
    const segments = tariffSegmentsForPeriod(agreements, {
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      fallbackTariffCode: record.tariffCode,
    })
    const distinctTariffCodes = [...new Set(segments.map((s) => s.tariffCode))]
    const tariffSwitched = distinctTariffCodes.length > 1

    let ratesBySegment
    try {
      if (!tariffSwitched && distinctTariffCodes[0] === record.tariffCode) {
        // The common case: one tariff for the whole window, already
        // fetched at import time -- reuse it rather than re-fetching
        // public rate data we already have.
        ratesBySegment = [{ tariffCode: record.tariffCode, rates: record.rates }]
      } else {
        ratesBySegment = await Promise.all(
          segments.map(async (segment) => ({
            tariffCode: segment.tariffCode,
            rates: await fetchTariffUnitRates(segment.tariffCode, {
              periodFrom: segment.validFrom,
              periodTo: segment.validTo,
            }),
          })),
        )
      }
    } catch {
      return { error: { status: 502, body: { error: 'Could not reach Octopus right now. Please try again.' } } }
    }

    const actual = buildActualPeriod({
      consumption: record.consumption,
      ratesBySegment,
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
    })

    const tariffSegments = await Promise.all(
      segments.map(async (segment) => {
        const classification = await classifyTariff(segment.tariffCode, { fetchProductDetails })
        return {
          tariffCode: segment.tariffCode,
          displayName: classification.displayName,
          validFrom: segment.validFrom,
          validTo: segment.validTo,
        }
      }),
    )

    return { record, importStatus, actual, tariffSwitched, tariffSegments }
  }

  // OA-71: "Actual" -- the customer's real tariff(s), real half-hourly
  // usage and real cost for the already-imported window. No counterfactual
  // modelling (that's OA-72); this just reconstructs what happened.
  router.get('/actual-period', requireFirebaseAuth, async (req, res) => {
    const result = await loadActualReconstruction(req.firebaseUid)
    if (result.error) {
      return res.status(result.error.status).json(result.error.body)
    }
    const { record, importStatus, actual, tariffSwitched, tariffSegments } = result

    if (importStatus === 'no_data') {
      return res.json({ periodFrom: undefined, periodTo: undefined, importStatus, complete: false })
    }

    // OA-21-style flag: unit rates only, no standing charge -- stated
    // explicitly rather than left for the UI to assume.
    res.json({
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      importStatus,
      unitRateOnly: true,
      tariffSwitched,
      tariffSegments,
      totalKwh: actual.totalKwh,
      totalCostPence: actual.totalCostPence,
      complete: actual.complete,
      matchedSlots: actual.matchedSlots,
      expectedSlots: actual.expectedSlots,
      points: actual.points,
    })
  })

  // OA-72: "Like-for-like" -- same half-hourly consumption as Actual, never
  // moved, repriced against a different tariff's own historical rates for
  // these same dates ("I'm on X -- what would these exact 30 days have
  // cost on Y?"). 'agile' is the one comparison family this app can
  // safely auto-resolve to the customer's own region (via the same
  // lookup OA-22 already uses and tests); any other comparison tariff
  // must be given as an explicit, already region-qualified Octopus
  // tariff code -- this app doesn't guess other families' product-code
  // conventions (see tariffClassification.js).
  router.get('/like-for-like', requireFirebaseAuth, async (req, res) => {
    const result = await loadActualReconstruction(req.firebaseUid)
    if (result.error) {
      return res.status(result.error.status).json(result.error.body)
    }
    const { record, importStatus, actual, tariffSwitched, tariffSegments } = result

    if (importStatus === 'no_data') {
      return res.json({ periodFrom: undefined, periodTo: undefined, importStatus, comparisonAvailable: false })
    }

    const { comparisonTariffCode: rawComparisonTariffCode, comparisonFamily } = req.query
    let comparisonTariffCode = typeof rawComparisonTariffCode === 'string' ? rawComparisonTariffCode.trim() : ''

    if (comparisonFamily === 'agile') {
      try {
        comparisonTariffCode = await fetchActiveAgileTariffCode(regionLetterFromTariffCode(record.tariffCode))
      } catch {
        return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
      }
    }

    if (!comparisonTariffCode) {
      return res.status(400).json({ error: 'comparisonTariffCode or comparisonFamily=agile is required.' })
    }

    const comparisonClassification = await classifyTariff(comparisonTariffCode, { fetchProductDetails })
    if (comparisonClassification.comparisonMethod !== 'exact') {
      // OA-25: never fabricate exactness for a tariff whose historical
      // rates can't be fully reconstructed from public data (e.g.
      // Intelligent Go's personalised smart-charge windows), or one this
      // app doesn't recognise at all.
      return res.json({
        periodFrom: record.periodFrom,
        periodTo: record.periodTo,
        importStatus,
        comparisonAvailable: false,
        comparisonMethod: comparisonClassification.comparisonMethod,
        comparisonTariffCode,
        comparisonDisplayName: comparisonClassification.displayName,
      })
    }

    let comparisonRates
    try {
      // Historical rates for the *actual* imported window's dates --
      // never today's rates substituted for a historical comparison.
      comparisonRates = await fetchTariffUnitRates(comparisonTariffCode, {
        periodFrom: record.periodFrom,
        periodTo: record.periodTo,
      })
    } catch {
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    // The exact same consumption series as Actual, only repriced -- never
    // moved to a different time.
    const comparison = buildActualPeriod({
      consumption: record.consumption,
      ratesBySegment: [{ tariffCode: comparisonTariffCode, rates: comparisonRates }],
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
    })

    res.json({
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      importStatus,
      unitRateOnly: true,
      comparisonAvailable: true,
      comparisonMethod: comparisonClassification.comparisonMethod,
      actual: {
        tariffSwitched,
        tariffSegments,
        totalKwh: actual.totalKwh,
        totalCostPence: actual.totalCostPence,
        complete: actual.complete,
        points: actual.points,
      },
      comparison: {
        tariffCode: comparisonTariffCode,
        displayName: comparisonClassification.displayName,
        totalKwh: comparison.totalKwh,
        totalCostPence: comparison.totalCostPence,
        complete: comparison.complete,
        points: comparison.points,
      },
      differencePence: round2(actual.totalCostPence - comparison.totalCostPence),
    })
  })

  // OA-76: "Optimised" -- the same comparison tariff Like-for-like already
  // repriced the imported window to, with any identified flexible-load
  // events shifted into cheaper windows (server/src/shiftingOptimiser.js),
  // per docs/SHIFTING_METHODOLOGY.md (OA-73/OA-75). Mirrors /like-for-like's
  // own request/response shape rather than refactoring it, so the already-
  // tested route is never put at risk by a shared-helper change.
  router.get('/optimised-period', requireFirebaseAuth, async (req, res) => {
    const result = await loadActualReconstruction(req.firebaseUid)
    if (result.error) {
      return res.status(result.error.status).json(result.error.body)
    }
    const { record, importStatus, actual } = result

    if (importStatus === 'no_data') {
      return res.json({ periodFrom: undefined, periodTo: undefined, importStatus, comparisonAvailable: false })
    }

    const { comparisonTariffCode: rawComparisonTariffCode, comparisonFamily } = req.query
    let comparisonTariffCode = typeof rawComparisonTariffCode === 'string' ? rawComparisonTariffCode.trim() : ''

    if (comparisonFamily === 'agile') {
      try {
        comparisonTariffCode = await fetchActiveAgileTariffCode(regionLetterFromTariffCode(record.tariffCode))
      } catch {
        return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
      }
    }

    if (!comparisonTariffCode) {
      return res.status(400).json({ error: 'comparisonTariffCode or comparisonFamily=agile is required.' })
    }

    const comparisonClassification = await classifyTariff(comparisonTariffCode, { fetchProductDetails })
    if (comparisonClassification.comparisonMethod !== 'exact') {
      return res.json({
        periodFrom: record.periodFrom,
        periodTo: record.periodTo,
        importStatus,
        comparisonAvailable: false,
        comparisonMethod: comparisonClassification.comparisonMethod,
        comparisonTariffCode,
        comparisonDisplayName: comparisonClassification.displayName,
      })
    }

    let comparisonRates
    try {
      comparisonRates = await fetchTariffUnitRates(comparisonTariffCode, {
        periodFrom: record.periodFrom,
        periodTo: record.periodTo,
      })
    } catch {
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    const comparison = buildActualPeriod({
      consumption: record.consumption,
      ratesBySegment: [{ tariffCode: comparisonTariffCode, rates: comparisonRates }],
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
    })

    // Optimised shifts load on top of the SAME tariff Like-for-like already
    // repriced to -- "same tariff, shifting flexible load" (Y -> Z), never
    // the customer's actual tariff -- see "Output and attribution".
    const events = await detectFlexibleLoadEvents(req.firebaseUid)
    const observedMaxHalfHourlyKwh = maxHalfHourlyKwh(comparison.points)
    const moves = scheduleFlexibleLoadEvents({ points: comparison.points, events, observedMaxHalfHourlyKwh })

    let optimisedPoints
    try {
      optimisedPoints = applyMovesToSeries(comparison.points, moves)
    } catch {
      // "If the totals don't match... the result must not be shown" -- a
      // 500 here means a real bug in the optimiser, never a fabricated
      // figure shown to the customer.
      return res.status(500).json({ error: 'Could not build a reliable Optimised result for this period.' })
    }
    const optimisedSummary = summarizeSeries(optimisedPoints)
    const movedEvents = moves.filter((m) => m.moved)

    res.json({
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      importStatus,
      unitRateOnly: true,
      comparisonAvailable: true,
      comparisonMethod: comparisonClassification.comparisonMethod,
      actual: {
        totalKwh: actual.totalKwh,
        totalCostPence: actual.totalCostPence,
        complete: actual.complete,
      },
      comparison: {
        tariffCode: comparisonTariffCode,
        displayName: comparisonClassification.displayName,
        totalKwh: comparison.totalKwh,
        totalCostPence: comparison.totalCostPence,
        complete: comparison.complete,
        points: comparison.points,
      },
      optimised: {
        totalKwh: optimisedSummary.totalKwh,
        totalCostPence: optimisedSummary.totalCostPence,
        points: optimisedPoints,
        moves: movedEvents.map((m) => ({
          applianceType: m.event.applianceType,
          evidenceTier: m.event.evidenceTier,
          originSlots: m.originSlots,
          destinationSlots: m.destinationSlots,
          beforeCostPence: m.beforeCostPence,
          afterCostPence: m.afterCostPence,
        })),
        eventsConsidered: events.length,
        // "Every Optimised figure must carry the confidence tier(s)
        // actually used to produce it" -- [] when nothing moved, never a
        // fabricated tier for a £0 result.
        confidenceTiers: [...new Set(movedEvents.map((m) => m.event.evidenceTier))].sort(),
      },
      tariffChoiceOpportunityPence: round2(actual.totalCostPence - comparison.totalCostPence),
      timingOpportunityPence: round2(comparison.totalCostPence - optimisedSummary.totalCostPence),
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

    const tariffState = await determineTariffState({
      tariffCode: record.tariffCode,
      tariffValidFrom: connection?.meterContext?.tariffValidFrom ?? null,
      fetchProductDetails,
    })
    // The comparison tariff here is always Agile (OA-22's explicit
    // scope) -- no need to reclassify a code we already know the family
    // of.
    const eligibility = eligibilityForFamily(TARIFF_FAMILY.AGILE)

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

    const tariffCode = connection.meterContext?.tariffCode ?? null
    if (!tariffCode) {
      return res
        .status(400)
        .json({ error: "We don't have enough meter information yet. Reconnect your account." })
    }

    // OA-66: "cheapest time" means cheapest for the tariff the customer is
    // actually on -- this used to always fetch the generically active
    // Agile product's rates regardless of the connected tariff. Now it
    // fetches the customer's own tariff code's published rates, whatever
    // family it is; there is no silent fallback to Agile.
    const tariffState = await determineTariffState({ tariffCode, fetchProductDetails })

    if (tariffState.family === TARIFF_FAMILY.UNKNOWN) {
      return res.json({ found: false, reason: 'unsupported_tariff', tariffState })
    }

    const now = new Date()
    const periodFrom = roundDownToHalfHour(now)
    const periodTo = new Date(periodFrom.getTime() + CHEAPEST_WINDOW_LOOKAHEAD_HOURS * 60 * 60 * 1000)

    let rates
    try {
      rates = await fetchTariffUnitRates(tariffCode, {
        periodFrom: periodFrom.toISOString(),
        periodTo: periodTo.toISOString(),
      })
    } catch {
      return res.status(502).json({ error: 'Could not reach Octopus right now. Please try again.' })
    }

    if (isFlatRate(rates)) {
      return res.json({ found: false, reason: 'flat_rate', tariffState })
    }

    // OA-67: never recommend a window that's already elapsed, even if it
    // was technically still inside the originally fetched range.
    const futureRates = excludeElapsedSlots(rates, now)

    const window = findCheapestWindow(futureRates, durationMinutes)
    if (!window) {
      // Enough future slots existed but none were long/contiguous enough
      // vs. the full lookahead actually having been published yet.
      const latestRateEnd = rates.reduce(
        (latest, r) => Math.max(latest, new Date(r.validTo).getTime()),
        0,
      )
      const reason = latestRateEnd < periodTo.getTime() - 60 * 60 * 1000 ? 'tomorrow_not_published' : 'no_window_available'
      return res.json({ found: false, reason, tariffState })
    }

    // OA-67: explicit "start now" when the current moment falls inside
    // the chosen window's first slot, rather than leaving the user to
    // work out whether an imminent-looking window is still actionable.
    const canStartNow = new Date(window.startsAt).getTime() <= now.getTime()

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

    res.json({ found: true, tariffState, canStartNow, ...window, recommendation })
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
