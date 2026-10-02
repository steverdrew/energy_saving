/**
 * OA-71: "Actual" -- the customer's real tariff, real half-hourly usage and
 * real cost for an already-imported historical window. No counterfactual
 * modelling belongs here (that's OA-72's job); this module only reconstructs
 * what genuinely happened.
 */

const HALF_HOUR_MS = 30 * 60 * 1000

/**
 * Clips an agreement's [validFrom, validTo) to the import window, and
 * drops it entirely if it doesn't overlap. `validTo: null` means "still
 * current", so it's clipped to the window's own end.
 */
function clipSegment(agreement, periodFrom, periodTo) {
  const periodFromMs = new Date(periodFrom).getTime()
  const periodToMs = new Date(periodTo).getTime()
  const agreementFromMs = new Date(agreement.validFrom).getTime()
  const agreementToMs = agreement.validTo ? new Date(agreement.validTo).getTime() : periodToMs

  const start = Math.max(periodFromMs, agreementFromMs)
  const end = Math.min(periodToMs, agreementToMs)
  if (!(start < end)) return null

  return { tariffCode: agreement.tariffCode, validFrom: new Date(start).toISOString(), validTo: new Date(end).toISOString() }
}

/**
 * Which of the account's agreements actually applied at some point during
 * [periodFrom, periodTo), clipped to that window and sorted oldest first.
 * An account with no agreement history at all (e.g. a fake/test account)
 * falls back to a single segment covering the whole window under
 * `fallbackTariffCode` -- the tariff code the import itself was run
 * against -- rather than reporting zero segments.
 */
export function tariffSegmentsForPeriod(agreements, { periodFrom, periodTo, fallbackTariffCode }) {
  const segments = (agreements ?? [])
    .map((a) => clipSegment(a, periodFrom, periodTo))
    .filter((s) => s !== null)
    .sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())

  if (segments.length > 0) return segments
  if (!fallbackTariffCode) return []
  return [{ tariffCode: fallbackTariffCode, validFrom: periodFrom, validTo: periodTo }]
}

/**
 * Builds a per-interval rate lookup from one or more tariff segments' own
 * rate series, each tagged with the tariff code it belongs to -- so a
 * half-hour slot that falls under a later segment after a mid-period
 * switch is priced on the tariff that actually applied then, not
 * whichever tariff's rates happen to be passed in.
 */
function buildTaggedRateIndex(ratesBySegment) {
  const index = new Map()
  for (const { tariffCode, rates } of ratesBySegment) {
    for (const rate of rates ?? []) {
      index.set(rate.validFrom, { unitRateIncVatPence: rate.unitRateIncVatPence, tariffCode })
    }
  }
  return index
}

function round2(pence) {
  return Math.round(pence * 100) / 100
}

/**
 * Reconstructs actual cost for an already-imported consumption series
 * against the tariff(s) that genuinely applied across the period --
 * never today's rates substituted for history, and never one tariff
 * assumed to cover a period that actually straddled a switch.
 *
 * @param {{intervalStart: string, consumptionKwh: number}[]} consumption
 * @param {{tariffCode: string, rates: {validFrom: string, unitRateIncVatPence: number}[]}[]} ratesBySegment
 * @param {string} periodFrom
 * @param {string} periodTo
 */
export function buildActualPeriod({ consumption, ratesBySegment, periodFrom, periodTo }) {
  const rateIndex = buildTaggedRateIndex(ratesBySegment)

  const points = consumption.map((c) => {
    const matched = rateIndex.get(c.intervalStart)
    const kwh = typeof c.consumptionKwh === 'number' ? c.consumptionKwh : null
    const unitRateIncVatPence = matched?.unitRateIncVatPence ?? null
    const costPence = kwh !== null && unitRateIncVatPence !== null ? round2(kwh * unitRateIncVatPence) : null
    return {
      startsAt: c.intervalStart,
      kwh,
      unitRateIncVatPence,
      costPence,
      tariffCode: matched?.tariffCode ?? null,
    }
  })

  const matchedPoints = points.filter((p) => p.kwh !== null && p.unitRateIncVatPence !== null)
  const totalKwh = round2(matchedPoints.reduce((sum, p) => sum + p.kwh, 0))
  const totalCostPence = round2(matchedPoints.reduce((sum, p) => sum + p.costPence, 0))

  // The number of half-hour slots the window should contain if every one
  // had both a reading and a rate -- the honesty check for "incomplete".
  const expectedSlots = Math.round((new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / HALF_HOUR_MS)

  return {
    points,
    totalKwh,
    totalCostPence,
    matchedSlots: matchedPoints.length,
    expectedSlots,
    complete: expectedSlots > 0 && matchedPoints.length === expectedSlots,
  }
}
