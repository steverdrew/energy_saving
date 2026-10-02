// OA-76: pure engine tests, one per deterministic fixture in
// docs/SHIFTING_METHODOLOGY.md ("Deterministic test fixtures"), plus the
// energy-preservation invariant the doc requires.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyMovesToSeries,
  londonDateKey,
  maxHalfHourlyKwh,
  METHODOLOGY_VERSION,
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

test('OA-75: every move and non-move carries the methodology version used', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: (i) => (i >= 26 && i < 31 ? 9 : 20),
    kwhForSlot: () => 0.3,
  })
  const event = {
    id: 'dw-version',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150,
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt,
  }
  const [move] = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(move.moved, true)
  assert.equal(move.methodologyVersion, METHODOLOGY_VERSION)
  assert.equal(typeof move.savingPence, 'number')
  assert.ok(move.savingPence > 0)
})

test('partial-slot runtime: a 70-minute cycle rounds up to 3 half-hours, never down, and still preserves energy', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: (i) => (i >= 26 && i < 29 ? 5 : 20),
    kwhForSlot: () => 0.2,
  })
  const event = {
    id: 'dh-partial',
    applianceType: 'dehumidifier',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 70, // not a multiple of 30 -- must round up to 3 slots, not 2
    energyKwh: 0.6,
    actualStartsAt: points[36].startsAt,
  }
  const [move] = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(move.moved, true)
  assert.equal(move.destinationSlots.length, 3)
  assert.equal(move.originSlots.length, 3)

  const after = applyMovesToSeries(points, [move])
  assert.equal(summarizeSeries(points).totalKwh, summarizeSeries(after).totalKwh)
})

test('explicit wider valid window lets a load move earlier than the awake-home default would allow', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    // Cheapest window is 04:00-06:00 (slots 8-11), entirely before the
    // 07:00 awake-home default -- only reachable via an explicit window.
    rateForSlot: (i) => (i >= 8 && i < 12 ? 5 : 20),
    kwhForSlot: () => 0.2,
  })
  const withoutOverride = {
    id: 'wm-default-window',
    applianceType: 'washing_machine',
    evidenceTier: 2,
    interruptible: false,
    requiresAwakeHome: true,
    durationMinutes: 100,
    energyKwh: 0.95,
    actualStartsAt: points[40].startsAt, // 20:00 London
  }
  const [defaultMove] = scheduleFlexibleLoadEvents({
    points,
    events: [withoutOverride],
    observedMaxHalfHourlyKwh: null,
  })
  // Without an override, the cheap 05:00 window is out of reach -- stays
  // within the day's expensive 20p band, so no move beats the actual rate.
  assert.equal(defaultMove.moved, false)

  const withOverride = {
    ...withoutOverride,
    id: 'wm-explicit-window',
    // An explicit, user-supplied valid window permits the earlier move --
    // "a load may not move earlier unless an explicit valid window
    // permits it" (OA-75).
    validWindowStartsAt: points[0].startsAt,
    validWindowEndsAt: iso(new Date(points[points.length - 1].startsAt).getTime() + SLOT_MS),
  }
  const [overrideMove] = scheduleFlexibleLoadEvents({
    points,
    events: [withOverride],
    observedMaxHalfHourlyKwh: null,
  })
  assert.equal(overrideMove.moved, true)
  assert.deepEqual(overrideMove.destinationSlots, points.slice(8, 12).map((p) => p.startsAt))
})

test('below-threshold: a custom minSavingPence rejects a move that would still have been strictly cheaper', () => {
  const points = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    // Only a 1p/kWh improvement available -- a real but tiny saving.
    rateForSlot: (i) => (i >= 26 && i < 31 ? 19 : 20),
    kwhForSlot: () => 0.3,
  })
  const event = {
    id: 'dw-tiny-saving',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150,
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt,
  }

  const [defaultMove] = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(defaultMove.moved, true) // v1's default threshold is 0 -- any genuine saving moves

  const [thresholdMove] = scheduleFlexibleLoadEvents({
    points,
    events: [event],
    observedMaxHalfHourlyKwh: null,
    minSavingPence: 5, // a future methodology version's higher bar, passed explicitly
  })
  assert.equal(thresholdMove.moved, false)
  assert.equal(thresholdMove.reason, 'below_saving_threshold')
})

test('tariff-agnostic: the same event schedules correctly against two structurally different tariff shapes', () => {
  const event = (points) => ({
    id: 'dw-agnostic',
    applianceType: 'dishwasher',
    evidenceTier: 4,
    interruptible: false,
    requiresAwakeHome: false,
    durationMinutes: 150,
    energyKwh: 1.1,
    actualStartsAt: points[36].startsAt,
  })

  // Shape A: flat tariff all day -- no family-specific logic, just equal
  // rates, so nothing should move.
  const flatPoints = buildDayPoints({ dayStartUtc: DAY_START_UTC, rateForSlot: () => 20, kwhForSlot: () => 0.3 })
  const [flatMove] = scheduleFlexibleLoadEvents({ points: flatPoints, events: [event(flatPoints)], observedMaxHalfHourlyKwh: null })
  assert.equal(flatMove.moved, false)

  // Shape B: dual-rate (Economy-7-style) -- a single off-peak block, no
  // half-hourly granularity -- the engine treats it exactly the same way,
  // because it only ever consumes generic {startsAt, unitRateIncVatPence}
  // points, never a tariff family.
  const dualRatePoints = buildDayPoints({
    dayStartUtc: DAY_START_UTC,
    rateForSlot: (i) => (i < 14 ? 12 : 28), // off-peak 00:00-07:00, peak otherwise
    kwhForSlot: () => 0.3,
  })
  const [dualRateMove] = scheduleFlexibleLoadEvents({
    points: dualRatePoints,
    events: [event(dualRatePoints)],
    observedMaxHalfHourlyKwh: null,
  })
  assert.equal(dualRateMove.moved, true)
  assert.deepEqual(dualRateMove.destinationSlots, dualRatePoints.slice(0, 5).map((p) => p.startsAt))
})

// OA-76: UK clock-change days -- the engine never special-cases these; it
// derives everything from the real UTC timestamps the half-hourly import
// already provides, via the same Europe/London Intl formatting
// heatMapMath.ts's groupSlotsByLondonDay uses, so a short/long local day
// just means fewer/more real points for that London date, never a gap or
// a miscount.
function buildRealLondonDayPoints({ targetDateKey, rateForSlot, kwhForSlot }) {
  const points = []
  const anchorMs = new Date(`${targetDateKey}T00:00:00Z`).getTime() - 6 * 60 * 60 * 1000
  for (let i = 0; i < 4 * 48; i++) {
    const startsAt = iso(anchorMs + i * SLOT_MS)
    if (londonDateKey(startsAt) === targetDateKey) points.push(startsAt)
  }
  return points.map((startsAt, i) => {
    const unitRateIncVatPence = rateForSlot(i)
    const kwh = kwhForSlot(i)
    return {
      startsAt,
      kwh,
      unitRateIncVatPence,
      costPence: Math.round(kwh * unitRateIncVatPence * 100) / 100,
      tariffCode: 'E-1R-TEST-24-01-01-C',
    }
  })
}

test('UK DST spring-forward day (23 hours / 46 half-hour slots) schedules correctly', () => {
  const points = buildRealLondonDayPoints({
    targetDateKey: '2025-03-30', // UK clocks went forward this day
    rateForSlot: (i) => (i >= 20 && i < 24 ? 5 : 20),
    kwhForSlot: () => 0.2,
  })
  assert.equal(points.length, 46)

  const event = {
    id: 'dh-spring',
    applianceType: 'dehumidifier',
    evidenceTier: 4,
    interruptible: true,
    requiresAwakeHome: false,
    durationMinutes: 120,
    energyKwh: 0.8,
    actualStartsAt: points[36].startsAt,
  }
  const [move] = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(move.moved, true)
  const after = applyMovesToSeries(points, [move])
  assert.equal(summarizeSeries(points).totalKwh, summarizeSeries(after).totalKwh)
})

test('UK DST autumn-fallback day (25 hours / 50 half-hour slots) schedules correctly', () => {
  const points = buildRealLondonDayPoints({
    targetDateKey: '2025-10-26', // UK clocks went back this day
    rateForSlot: (i) => (i >= 20 && i < 24 ? 5 : 20),
    kwhForSlot: () => 0.2,
  })
  assert.equal(points.length, 50)

  const event = {
    id: 'dh-autumn',
    applianceType: 'dehumidifier',
    evidenceTier: 4,
    interruptible: true,
    requiresAwakeHome: false,
    durationMinutes: 120,
    energyKwh: 0.8,
    actualStartsAt: points[40].startsAt,
  }
  const [move] = scheduleFlexibleLoadEvents({ points, events: [event], observedMaxHalfHourlyKwh: null })
  assert.equal(move.moved, true)
  const after = applyMovesToSeries(points, [move])
  assert.equal(summarizeSeries(points).totalKwh, summarizeSeries(after).totalKwh)
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
