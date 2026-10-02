import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildActualPeriod, tariffSegmentsForPeriod } from '../src/actualPeriod.js'

test('tariffSegmentsForPeriod falls back to one full-window segment when there is no agreement history', () => {
  const segments = tariffSegmentsForPeriod([], {
    periodFrom: '2026-09-01T00:00:00Z',
    periodTo: '2026-09-02T00:00:00Z',
    fallbackTariffCode: 'E-1R-GO-18-06-12-C',
  })

  assert.deepEqual(segments, [
    { tariffCode: 'E-1R-GO-18-06-12-C', validFrom: '2026-09-01T00:00:00Z', validTo: '2026-09-02T00:00:00Z' },
  ])
})

test('tariffSegmentsForPeriod clips a single current agreement to the window', () => {
  const segments = tariffSegmentsForPeriod(
    [{ tariffCode: 'E-1R-FLEX-OCT-22-A', validFrom: '2026-01-01T00:00:00Z', validTo: null }],
    { periodFrom: '2026-09-01T00:00:00Z', periodTo: '2026-09-02T00:00:00Z', fallbackTariffCode: null },
  )

  assert.deepEqual(segments, [
    { tariffCode: 'E-1R-FLEX-OCT-22-A', validFrom: '2026-09-01T00:00:00.000Z', validTo: '2026-09-02T00:00:00.000Z' },
  ])
})

test('tariffSegmentsForPeriod splits a mid-period switch into two clipped, ordered segments', () => {
  const segments = tariffSegmentsForPeriod(
    [
      { tariffCode: 'E-1R-VAR-22-11-01-C', validFrom: '2025-01-01T00:00:00Z', validTo: '2026-09-01T12:00:00Z' },
      { tariffCode: 'E-1R-AGILE-24-10-01-C', validFrom: '2026-09-01T12:00:00Z', validTo: null },
    ],
    { periodFrom: '2026-09-01T00:00:00Z', periodTo: '2026-09-02T00:00:00Z', fallbackTariffCode: null },
  )

  assert.deepEqual(segments, [
    { tariffCode: 'E-1R-VAR-22-11-01-C', validFrom: '2026-09-01T00:00:00.000Z', validTo: '2026-09-01T12:00:00.000Z' },
    { tariffCode: 'E-1R-AGILE-24-10-01-C', validFrom: '2026-09-01T12:00:00.000Z', validTo: '2026-09-02T00:00:00.000Z' },
  ])
})

test('tariffSegmentsForPeriod drops agreements that never overlap the window', () => {
  const segments = tariffSegmentsForPeriod(
    [{ tariffCode: 'E-1R-OLD-20-01-01-C', validFrom: '2020-01-01T00:00:00Z', validTo: '2021-01-01T00:00:00Z' }],
    { periodFrom: '2026-09-01T00:00:00Z', periodTo: '2026-09-02T00:00:00Z', fallbackTariffCode: null },
  )

  assert.deepEqual(segments, [])
})

test('buildActualPeriod reprices consumption against a single tariff segment', () => {
  const consumption = [
    { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
    { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 2 },
  ]
  const ratesBySegment = [
    {
      tariffCode: 'E-1R-GO-18-06-12-C',
      rates: [
        { validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 },
        { validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 10 },
      ],
    },
  ]

  const result = buildActualPeriod({
    consumption,
    ratesBySegment,
    periodFrom: '2026-09-01T00:00:00Z',
    periodTo: '2026-09-01T01:00:00Z',
  })

  // 1*30 + 2*10 = 50p
  assert.equal(result.totalCostPence, 50)
  assert.equal(result.totalKwh, 3)
  assert.equal(result.matchedSlots, 2)
  assert.equal(result.expectedSlots, 2)
  assert.equal(result.complete, true)
  assert.equal(result.points[0].tariffCode, 'E-1R-GO-18-06-12-C')
})

test('buildActualPeriod prices each half of a mid-period switch on its own tariff', () => {
  const consumption = [
    { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
    { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 1 },
  ]
  const ratesBySegment = [
    {
      tariffCode: 'E-1R-VAR-22-11-01-C',
      rates: [{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 }],
    },
    {
      tariffCode: 'E-1R-AGILE-24-10-01-C',
      rates: [{ validFrom: '2026-09-01T00:30:00Z', unitRateIncVatPence: 5 }],
    },
  ]

  const result = buildActualPeriod({
    consumption,
    ratesBySegment,
    periodFrom: '2026-09-01T00:00:00Z',
    periodTo: '2026-09-01T01:00:00Z',
  })

  assert.equal(result.points[0].tariffCode, 'E-1R-VAR-22-11-01-C')
  assert.equal(result.points[0].costPence, 30)
  assert.equal(result.points[1].tariffCode, 'E-1R-AGILE-24-10-01-C')
  assert.equal(result.points[1].costPence, 5)
  assert.equal(result.totalCostPence, 35)
})

test('buildActualPeriod reports incompleteness honestly when a slot has no matching rate', () => {
  const consumption = [
    { intervalStart: '2026-09-01T00:00:00Z', consumptionKwh: 1 },
    { intervalStart: '2026-09-01T00:30:00Z', consumptionKwh: 1 },
  ]
  const ratesBySegment = [
    { tariffCode: 'E-1R-GO-18-06-12-C', rates: [{ validFrom: '2026-09-01T00:00:00Z', unitRateIncVatPence: 30 }] },
  ]

  const result = buildActualPeriod({
    consumption,
    ratesBySegment,
    periodFrom: '2026-09-01T00:00:00Z',
    periodTo: '2026-09-01T01:00:00Z',
  })

  assert.equal(result.matchedSlots, 1)
  assert.equal(result.expectedSlots, 2)
  assert.equal(result.complete, false)
  assert.equal(result.points[1].costPence, null)
  assert.equal(result.points[1].unitRateIncVatPence, null)
})
