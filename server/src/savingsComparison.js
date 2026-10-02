/**
 * OA-22 MVP: compares what a user's actual historical consumption would
 * have cost on their current tariff vs. on Octopus Agile, using the same
 * half-hourly consumption for both. Deliberately scoped to current-tariff-
 * vs-Agile only, not every Octopus tariff.
 *
 * Not wired into any user-facing endpoint yet -- no £ savings figure may
 * be shown until OA-21's methodology/trust copy is signed off (see
 * HANDOFF.md). This module is the tested calculation OA-8's result
 * screen will call once that gate clears.
 */

/** Builds a lookup from a rate series's `validFrom` to its pence-per-kWh rate. */
function buildRateIndex(rates) {
  const index = new Map()
  for (const rate of rates) {
    index.set(rate.validFrom, rate.unitRateIncVatPence)
  }
  return index
}

/**
 * Sums consumption × matching rate across a rate series. A consumption
 * interval only counts if a rate exists for that exact `intervalStart` --
 * both series come from Octopus as half-hourly, UTC-aligned slots, so an
 * exact match is expected for any interval covered by the rate series.
 */
function costForSeries(consumption, rates) {
  const index = buildRateIndex(rates)
  let totalPence = 0
  let matchedIntervals = 0

  for (const point of consumption) {
    const unitRateIncVatPence = index.get(point.intervalStart)
    if (unitRateIncVatPence == null) continue
    totalPence += point.consumptionKwh * unitRateIncVatPence
    matchedIntervals += 1
  }

  return { totalPence, matchedIntervals }
}

function round2(pence) {
  return Math.round(pence * 100) / 100
}

/**
 * @param {{intervalStart: string, consumptionKwh: number}[]} consumption
 * @param {{validFrom: string, unitRateIncVatPence: number}[]} currentTariffRates
 * @param {{validFrom: string, unitRateIncVatPence: number}[]} agileRates
 */
export function compareCurrentTariffToAgile({ consumption, currentTariffRates, agileRates }) {
  const current = costForSeries(consumption, currentTariffRates)
  const agile = costForSeries(consumption, agileRates)

  return {
    currentTariffCostPence: round2(current.totalPence),
    agileCostPence: round2(agile.totalPence),
    estimatedSavingPence: round2(current.totalPence - agile.totalPence),
    currentTariffMatchedIntervals: current.matchedIntervals,
    agileMatchedIntervals: agile.matchedIntervals,
    totalIntervals: consumption.length,
  }
}
