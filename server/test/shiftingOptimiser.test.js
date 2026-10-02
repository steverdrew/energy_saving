// OA-76: pure engine tests, one per deterministic fixture in
// docs/SHIFTING_METHODOLOGY.md ("Deterministic test fixtures"), plus the
// energy-preservation invariant the doc requires.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyMovesToSeries,
  maxHalfHourlyKwh,
  scheduleFlexibleLoadEvents,
  summarizeSeries,
} from '../src/shiftingOptimiser.js'

const SLOT_MS = 30 * 60 * 1000

function iso(t) {
  return new Date(t).toISOString().replace('.000Z', 'Z')
}

// Builds one London calendar day (a day with no DST transition, 2024-06-10,
// so 00:00-23:30 London is a clean 48 half-hours) of flat 10kWh... actually
// usage-less points, with a given per-slot rate for a cheap window and a
// higher rate everywhere else -- enough to drive the fixtures below.
function buildDayPoints({ dayStartUtc, rateForSlot, kwhForSlot }) {
  const points = []
  for (let i = 0; i < 48; i++) {
    const startsAt = iso(dayStartUtc + i * SLOT_MS)
    const unitRateIncVatPence = rateForSlot(i)
    const kwh = kwhForSlot(i)
    points.push({
      startsAt,
      kwh,
      unitRateIncVatPence,
      costPence: kwh !== null && unitRateIncVatPence !== null ? Math.round(kwh * unitRateIncVatPence * 100) / 100 : null,
      tariffCode: 'E-1R-TEST-24-01-01-C',
    })
  }
  return points
}

// 2024-06-10T00:00:00Z == 01:00 London (BST) -- slot index 0 is 01:00
// London, so slot index i is London hour floor((i+2)/2) ... simplest to
// just pick a day start that lines up on a London midnight. Use a date
// after the BST transition where UTC+1 applies throughout, and start at
// London midnight (23:00 UTC the previous day).
const DAY_START_UTC = new Date('2024-06-09T23:00:00Z').getTime() // 2024-06-10T00:00 London

test('fixture 1: a dishwasher cycle moves to a cheaper window, same day', () => {
  // 18:00-20:30 London = slot 36-40 (18:00 is (18-0)*2=36). Rates: 28p
  // there, 9p during 13:00-15:30 London (slot 26-30), 20p everywhere else.
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: (i) => (i >= 36 && i < 41 ? 28 : i >= 26 && i < 31 ? 9 : 20),
    kwhForSlot: () => 0.3,
  })

  const event = {
    id: 'dw-1',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150,
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt,
    actualEndsAt: points[41].startsAt,
  }

  const moves = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(moves.length, 1)
  const [move] = moves
  assert.equal(move.moved, true)
  assert.equal(move.beforeCostPence, 30.8)
  assert.equal(move.afterCostPence, 9.9)
  assert.deepEqual(move.destinationSlots, points.slice(26, 31).map((p) => p.startsAt))

  const after = applyMovesToSeries(points, moves)
  const beforeTotal = summarizeSeries(points).totalKwh
  const afterTotal = summarizeSeries(after).totalKwh
  assert.equal(beforeTotal, afterTotal) // energy preservation
})

test('fixture 2: no cheaper slot exists (flat tariff that day) -- does not move', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: () => 20, // flat all day
    kwhForSlot: () => 0.3,
  })

  const event = {
    id: 'dw-2',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150,
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt,
    actualEndsAt: points[41].startsAt,
  }

  const moves = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(moves[0].moved, false)
  assert.equal(moves[0].reason, 'no_cheaper_slot')

  const after = applyMovesToSeries(points, moves)
  assert.deepEqual(after, points) // genuinely unchanged, not just equal totals
})

test('fixture 3: two loads compete for the same cheap window -- higher tier wins, lower tier displaced', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    // Cheapest window 13:00-15:30 London (slot 26-30) at 5p; everywhere
    // else (including both actual slots) at 25p. Capacity cap is tight
    // enough that both events can't land fully in the same slots.
    rateForSlot: (i) => (i >= 26 && i < 31 ? 5 : 25),
    kwhForSlot: () => 0.2,
  })
  const cap = maxHalfHourlyKwh(points) + 0.4 // just enough room for one event's share, not both fully overlapping

  const washingMachine = {
    id: 'wm-1',
    applianceType: 'washing_machine',
    evidenceTier: 2, // user-supplied -- higher trust than the dishwasher's generic default
    interruptible: false,
    requiresAwakeHome: true,
    durationMinutes: 100, // 4 slots, within 07:00-23:00
    energyKwh: 0.95,
    actualStartsAt: points[40].startsAt, // 20:00 London
    actualEndsAt: points[44].startsAt,
  }
  const dishwasher = {
    id: 'dw-3',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150, // 5 slots
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt, // 18:00 London
    actualEndsAt: points[41].startsAt,
  }

  const moves = scheduleFlexibleLoadEvents({
    points,
    events: [dishwasher, washingMachine], // deliberately unsorted -- engine sorts by tier itself
    observedMaxHalfHourlyKwh: cap,
  })

  const wmMove = moves.find((m) => m.event.id === 'wm-1')
  const dwMove = moves.find((m) => m.event.id === 'dw-3')

  assert.equal(wmMove.moved, true)
  // Washing machine (higher tier) claims its first choice: the cheapest
  // 4-slot window within the cheap band.
  assert.deepEqual(wmMove.destinationSlots, points.slice(26, 30).map((p) => p.startsAt))

  // Dishwasher still finds the move worthwhile, but can't fully overlap
  // the washing machine's slots once the cap is respected, so it either
  // lands elsewhere or doesn't move -- either way it must never silently
  // overlap past the cap.
  if (dwMove.moved) {
    const overlap = dwMove.destinationSlots.filter((s) => wmMove.destinationSlots.includes(s))
    for (const startsAt of overlap) {
      const slot = points.find((p) => p.startsAt === startsAt)
      const committedHere =
        (wmMove.destinationSlots.includes(startsAt) ? wmMove.perSlotKwh : 0) +
        (dwMove.destinationSlots.includes(startsAt) ? dwMove.perSlotKwh : 0)
      assert.ok(slot.kwh + committedHere <= cap + 1e-6)
    }
  }

  const after = applyMovesToSeries(points, moves)
  assert.equal(summarizeSeries(points).totalKwh, summarizeSeries(after).totalKwh)
})

test('fixture 4: no events supplied (e.g. EV with no charger data) -- nothing moves, no error', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: (i) => (i >= 26 && i < 31 ? 5 : 25),
    kwhForSlot: () => 0.2,
  })

  const moves = scheduleFlexibleLoadEvents({ points, events: [], observedMaxHalfHourlyKwh: null })
  assert.deepEqual(moves, [])

  const after = applyMovesToSeries(points, moves)
  assert.deepEqual(after, points)
  assert.equal(summarizeSeries(after).totalCostPence, summarizeSeries(points).totalCostPence)
})

test('dehumidifier (splittable) spreads across the cheapest individual half-hours, not necessarily contiguous', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    // Two cheap slots far apart, everything else expensive.
    rateForSlot: (i) => (i === 10 || i === 30 ? 5 : 25),
    kwhForSlot: () => 0.1,
  })

  const event = {
    id: 'dh-1',
    applianceType: 'dehumidifier',
    evidenceTier: 4,
    interruptible: true,
    requiresAwakeHome: false,
    durationMinutes: 60, // 2 slots
    energyKwh: 0.4,
    actualStartsAt: points[2].startsAt,
    actualEndsAt: points[4].startsAt,
  }

  const moves = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(moves[0].moved, true)
  assert.deepEqual(
    [...moves[0].destinationSlots].sort(),
    [points[10].startsAt, points[30].startsAt].sort(),
  )
})

test('energy preservation check throws rather than return a silently wrong total', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: () => 10,
    kwhForSlot: () => 0.2,
  })
  const corruptMoves = [
    {
      // Two origin slots debited but only one destination slot credited at
      // the same per-slot amount -- a net loss of kWh, simulating the
      // "dropped somewhere" case the doc's double-counting check guards
      // against (a net *gain* from extra destination slots would trip the
      // same check the other way).
      moved: true,
      originSlots: [points[0].startsAt, points[2].startsAt],
      destinationSlots: [points[1].startsAt],
      perSlotKwh: 0.2,
    },
  ]
  assert.throws(() => applyMovesToSeries(points, corruptMoves))
})
