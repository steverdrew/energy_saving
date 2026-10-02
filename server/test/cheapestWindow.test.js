import assert from 'node:assert/strict'
import { test } from 'node:test'
import { averageRate, findCheapestWindow } from '../src/cheapestWindow.js'

function slot(validFrom, unitRateIncVatPence) {
  return { validFrom, unitRateIncVatPence }
}

test('finds the single cheapest slot when the duration fits in one slot', () => {
  const rates = [
    slot('2026-10-02T00:00:00Z', 30),
    slot('2026-10-02T00:30:00Z', 10),
    slot('2026-10-02T01:00:00Z', 20),
  ]

  const result = findCheapestWindow(rates, 30)

  assert.deepEqual(result, {
    startsAt: '2026-10-02T00:30:00Z',
    endsAt: '2026-10-02T01:00:00Z',
    averageUnitRateIncVatPence: 10,
    slotsUsed: 1,
  })
})

test('finds the cheapest contiguous multi-slot window, not just the cheapest individual slot', () => {
  const rates = [
    slot('2026-10-02T00:00:00Z', 5), // cheapest single slot, but isolated
    slot('2026-10-02T00:30:00Z', 50),
    slot('2026-10-02T01:00:00Z', 20),
    slot('2026-10-02T01:30:00Z', 18),
    slot('2026-10-02T02:00:00Z', 50),
  ]

  // 2 slots (60 min): best contiguous pair is 01:00+01:30 averaging 19p,
  // beating any pair that includes the isolated 5p slot.
  const result = findCheapestWindow(rates, 60)

  assert.equal(result.startsAt, '2026-10-02T01:00:00Z')
  assert.equal(result.endsAt, '2026-10-02T02:00:00Z')
  assert.equal(result.averageUnitRateIncVatPence, 19)
  assert.equal(result.slotsUsed, 2)
})

test('rounds a duration up to the next whole slot', () => {
  const rates = [slot('2026-10-02T00:00:00Z', 10), slot('2026-10-02T00:30:00Z', 20)]

  // 31 minutes needs 2 slots, not 1.
  const result = findCheapestWindow(rates, 31)

  assert.equal(result.slotsUsed, 2)
})

test('skips a window with a gap in the rate series', () => {
  const rates = [
    slot('2026-10-02T00:00:00Z', 10),
    // 00:30 missing -- no valid 2-slot window starting at 00:00
    slot('2026-10-02T01:00:00Z', 10),
    slot('2026-10-02T01:30:00Z', 10),
  ]

  const result = findCheapestWindow(rates, 60)

  assert.equal(result.startsAt, '2026-10-02T01:00:00Z')
})

test('returns null when no window is long enough', () => {
  const rates = [slot('2026-10-02T00:00:00Z', 10)]
  assert.equal(findCheapestWindow(rates, 60), null)
})

test('returns null for empty rates or non-positive duration', () => {
  assert.equal(findCheapestWindow([], 60), null)
  assert.equal(findCheapestWindow([slot('2026-10-02T00:00:00Z', 10)], 0), null)
})

test('averageRate returns the simple mean unit rate', () => {
  const rates = [slot('2026-10-02T00:00:00Z', 10), slot('2026-10-02T00:30:00Z', 20)]
  assert.equal(averageRate(rates), 15)
})

test('averageRate returns null for an empty series', () => {
  assert.equal(averageRate([]), null)
})
