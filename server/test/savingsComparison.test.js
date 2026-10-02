import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareCurrentTariffToAgile } from '../src/savingsComparison.js'

const consumption = [
  { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
  { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 2 },
]

test('compares cost of the same consumption under two rate series', () => {
  const currentTariffRates = [
    { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
    { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 30 },
  ]
  const agileRates = [
    { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 10 },
    { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 40 },
  ]

  const result = compareCurrentTariffToAgile({ consumption, currentTariffRates, agileRates })

  // current: 1*30 + 2*30 = 90p. agile: 1*10 + 2*40 = 90p.
  assert.equal(result.currentTariffCostPence, 90)
  assert.equal(result.agileCostPence, 90)
  assert.equal(result.estimatedSavingPence, 0)
  assert.equal(result.currentTariffMatchedIntervals, 2)
  assert.equal(result.agileMatchedIntervals, 2)
  assert.equal(result.totalIntervals, 2)
})

test('a positive estimated saving means Agile would have been cheaper', () => {
  const currentTariffRates = [
    { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
    { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 30 },
  ]
  const agileRates = [
    { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 5 },
    { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 5 },
  ]

  const result = compareCurrentTariffToAgile({ consumption, currentTariffRates, agileRates })

  // current: 90p. agile: 1*5 + 2*5 = 15p. saving = 75p.
  assert.equal(result.currentTariffCostPence, 90)
  assert.equal(result.agileCostPence, 15)
  assert.equal(result.estimatedSavingPence, 75)
})

test('intervals with no matching rate are excluded from the total but counted as unmatched', () => {
  const currentTariffRates = [{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 }]
  const agileRates = [{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 10 }]

  const result = compareCurrentTariffToAgile({ consumption, currentTariffRates, agileRates })

  assert.equal(result.currentTariffCostPence, 30)
  assert.equal(result.agileCostPence, 10)
  assert.equal(result.currentTariffMatchedIntervals, 1)
  assert.equal(result.agileMatchedIntervals, 1)
  assert.equal(result.totalIntervals, 2)
})

test('empty consumption produces a zeroed, fully-matched comparison', () => {
  const result = compareCurrentTariffToAgile({
    consumption: [],
    currentTariffRates: [],
    agileRates: [],
  })

  assert.equal(result.currentTariffCostPence, 0)
  assert.equal(result.agileCostPence, 0)
  assert.equal(result.estimatedSavingPence, 0)
  assert.equal(result.totalIntervals, 0)
})
