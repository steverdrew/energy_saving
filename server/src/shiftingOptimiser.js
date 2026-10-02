/**
 * OA-76: "Optimised" -- shifts identified flexible-load events into
 * cheaper half-hours within their own valid window, per
 * docs/SHIFTING_METHODOLOGY.md (OA-73/OA-75). Pure functions only; no
 * network/Firestore access here -- the route (server/src/routes/octopus.js)
 * supplies the already-repriced comparison series and the flexible-load
 * events (currently always [] -- see flexibleLoadEvents.js -- until
 * household appliance data exists).
 *
 * Every rule below maps directly to a section of that doc:
 * - "Runtime constraints": atomic (interruptible: false) loads move as one
 *   contiguous block of their fixed duration; splittable loads may spread
 *   across several individual half-hours.
 * - "Valid time windows": same London calendar day as the load actually
 *   ran, narrowed to 07:00-23:00 when requiresAwakeHome. Evaluated per
 *   half-hour slot via Intl's Europe/London zone, not fixed-offset
 *   arithmetic, so a clock-change day's 23/25-slot grid is handled the
 *   same way heatMapMath.ts's groupSlotsByLondonDay already is.
 * - "Overlap / concurrency constraints": events are placed in evidence-tier
 *   order (most trusted first); a later event can't push a slot's total
 *   load over the household's own highest observed half-hourly kWh.
 * - "No-cheaper-slot handling": a candidate must be strictly cheaper than
 *   the event's actual slots, or it doesn't move.
 * - "Preserving total energy while moving timing": applyMovesToSeries
 *   never changes a series' total kWh, and throws rather than return a
 *   silently wrong total if that ever stops being true.
 */

const SLOT_MINUTES = 30

function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString().replace('.000Z', 'Z')
}

function round2(n) {
  return Math.round(n * 100) / 100
}

const londonDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const londonHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function londonDateKey(iso) {
  return londonDateFormatter.format(new Date(iso))
}

export function londonHour(iso) {
  return Number(londonHourFormatter.format(new Date(iso)))
}

function isContiguous(points) {
  for (let i = 1; i < points.length; i++) {
    if (points[i].startsAt !== addMinutes(points[i - 1].startsAt, SLOT_MINUTES)) return false
  }
  return true
}

function averageRate(points) {
  const rated = points.filter((p) => p.unitRateIncVatPence !== null)
  if (rated.length === 0) return null
  return rated.reduce((sum, p) => sum + p.unitRateIncVatPence, 0) / rated.length
}

/**
 * "Default window is the same calendar day the load actually ran... A load
 * with requiresAwakeHome may only move within hours the household is
 * plausibly awake... default assumption is 07:00-23:00 local time."
 */
function validWindowPoints(sortedPoints, event) {
  const eventDateKey = londonDateKey(event.actualStartsAt)
  return sortedPoints.filter((p) => {
    if (londonDateKey(p.startsAt) !== eventDateKey) return false
    if (event.requiresAwakeHome) {
      const hour = londonHour(p.startsAt)
      if (hour < 7 || hour >= 23) return false
    }
    return true
  })
}

function originPoints(sortedPoints, event) {
  const startMs = new Date(event.actualStartsAt).getTime()
  const endMs = new Date(event.actualEndsAt).getTime()
  return sortedPoints.filter((p) => {
    const t = new Date(p.startsAt).getTime()
    return t >= startMs && t < endMs
  })
}

function contiguousWindowCandidates(windowPoints, slotsNeeded) {
  const candidates = []
  for (let i = 0; i + slotsNeeded <= windowPoints.length; i++) {
    const candidate = windowPoints.slice(i, i + slotsNeeded)
    if (candidate.some((p) => p.unitRateIncVatPence === null)) continue
    if (!isContiguous(candidate)) continue
    candidates.push({ points: candidate, avg: averageRate(candidate) })
  }
  candidates.sort((a, b) => a.avg - b.avg)
  return candidates
}

/**
 * "The modelled load in any single half-hour, across all moved appliances
 * combined, never exceeds the household's own highest actually-observed
 * half-hourly kWh elsewhere in the imported window." Checked against the
 * slot's own whole-house kWh (base load, which never moves) plus whatever
 * other flexible energy has already been committed there this pass --
 * never against flexible load alone, which would under-count the real
 * physical draw in that half-hour.
 */
function hasCapacity(points, perSlotKwh, committed, cap) {
  if (cap == null) return true
  return points.every((p) => {
    const existing = (p.kwh ?? 0) + (committed.get(p.startsAt) ?? 0)
    return existing + perSlotKwh <= cap + 1e-9
  })
}

function chooseContiguousWindow(event, windowPoints, committed, cap) {
  const slotsNeeded = Math.ceil(event.durationMinutes / SLOT_MINUTES)
  const perSlotKwh = event.energyKwh / slotsNeeded
  for (const candidate of contiguousWindowCandidates(windowPoints, slotsNeeded)) {
    if (hasCapacity(candidate.points, perSlotKwh, committed, cap)) return candidate
  }
  return null
}

function chooseSplittableSlots(event, windowPoints, committed, cap) {
  const slotsNeeded = Math.ceil(event.durationMinutes / SLOT_MINUTES)
  const perSlotKwh = event.energyKwh / slotsNeeded
  const cheapestFirst = windowPoints
    .filter((p) => p.unitRateIncVatPence !== null)
    .sort((a, b) => a.unitRateIncVatPence - b.unitRateIncVatPence)

  const chosen = []
  for (const p of cheapestFirst) {
    if (chosen.length === slotsNeeded) break
    if (hasCapacity([p], perSlotKwh, committed, cap)) chosen.push(p)
  }
  if (chosen.length < slotsNeeded) return null
  return { points: chosen, avg: averageRate(chosen) }
}

/**
 * Schedules each flexible-load event against `points` (an already-repriced
 * comparison series -- see "Output and attribution": Optimised shifts load
 * on top of the same tariff Like-for-like already repriced to, not the
 * customer's actual tariff).
 *
 * @param {object} args
 * @param {{startsAt: string, kwh: number|null, unitRateIncVatPence: number|null, costPence: number|null}[]} args.points
 * @param {FlexibleLoadEvent[]} args.events
 * @param {number|null} args.observedMaxHalfHourlyKwh
 * @returns {MoveResult[]}
 */
export function scheduleFlexibleLoadEvents({ points, events, observedMaxHalfHourlyKwh = null }) {
  const sortedPoints = [...points].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const committed = new Map()
  // "Loads are moved in evidence-tier order (higher tier first)" -- lower
  // tier number means more trusted per the doc's numbering (1 = connected
  // device, ... 5 = inferred from shape).
  const orderedEvents = [...events].sort((a, b) => a.evidenceTier - b.evidenceTier)
  const moves = []

  for (const event of orderedEvents) {
    const slotsNeeded = Math.ceil(event.durationMinutes / SLOT_MINUTES)
    const origin = originPoints(sortedPoints, event)

    if (origin.length !== slotsNeeded || origin.some((p) => p.unitRateIncVatPence === null || p.kwh === null)) {
      moves.push({ event, moved: false, reason: 'missing_rate_data' })
      continue
    }

    const actualAvgRate = averageRate(origin)
    const windowPoints = validWindowPoints(sortedPoints, event)
    const chosen = event.interruptible
      ? chooseSplittableSlots(event, windowPoints, committed, observedMaxHalfHourlyKwh)
      : chooseContiguousWindow(event, windowPoints, committed, observedMaxHalfHourlyKwh)

    // "A move only happens when it produces a genuine saving" -- strictly
    // cheaper, never a tie, never "for form's sake".
    if (!chosen || !(chosen.avg < actualAvgRate)) {
      moves.push({ event, moved: false, reason: chosen ? 'no_cheaper_slot' : 'no_capacity' })
      continue
    }

    const perSlotKwh = event.energyKwh / chosen.points.length
    for (const p of chosen.points) {
      committed.set(p.startsAt, (committed.get(p.startsAt) ?? 0) + perSlotKwh)
    }

    moves.push({
      event,
      moved: true,
      originSlots: origin.map((p) => p.startsAt),
      destinationSlots: chosen.points.map((p) => p.startsAt),
      perSlotKwh,
      beforeCostPence: round2(event.energyKwh * actualAvgRate),
      afterCostPence: round2(event.energyKwh * chosen.avg),
    })
  }

  return moves
}

/**
 * Applies scheduled moves to a copy of `points` -- an event's kWh
 * disappears from its origin half-hour(s) and reappears at its
 * destination half-hour(s), each slot's own cost recomputed from its own
 * rate. Throws if total kWh changed, per "Preventing double counting": "if
 * the totals don't match, kWh has been duplicated or dropped somewhere and
 * the result must not be shown."
 */
export function applyMovesToSeries(points, moves) {
  const byStart = new Map(points.map((p) => [p.startsAt, { ...p }]))

  for (const move of moves) {
    if (!move.moved) continue
    for (const startsAt of move.originSlots) {
      const p = byStart.get(startsAt)
      p.kwh = round2((p.kwh ?? 0) - move.perSlotKwh)
      p.costPence = p.unitRateIncVatPence !== null ? round2(p.kwh * p.unitRateIncVatPence) : null
    }
    for (const startsAt of move.destinationSlots) {
      const p = byStart.get(startsAt)
      p.kwh = round2((p.kwh ?? 0) + move.perSlotKwh)
      p.costPence = p.unitRateIncVatPence !== null ? round2(p.kwh * p.unitRateIncVatPence) : null
    }
  }

  const result = [...byStart.values()].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  const beforeTotal = round2(points.reduce((sum, p) => sum + (p.kwh ?? 0), 0))
  const afterTotal = round2(result.reduce((sum, p) => sum + (p.kwh ?? 0), 0))
  if (Math.abs(beforeTotal - afterTotal) > 0.01) {
    throw new Error('Energy preservation check failed: total kWh changed while modelling shifted load.')
  }

  return result
}

export function summarizeSeries(points) {
  const matched = points.filter((p) => p.kwh !== null && p.costPence !== null)
  return {
    totalKwh: round2(matched.reduce((sum, p) => sum + p.kwh, 0)),
    totalCostPence: round2(matched.reduce((sum, p) => sum + p.costPence, 0)),
  }
}

/** The concurrency cap's baseline -- the household's own highest observed half-hourly kWh. */
export function maxHalfHourlyKwh(points) {
  return points.reduce((max, p) => (p.kwh !== null && p.kwh > max ? p.kwh : max), 0)
}

/**
 * @typedef {object} FlexibleLoadEvent
 * @property {string} id
 * @property {'dishwasher'|'washing_machine'|'tumble_dryer'|'dehumidifier'} applianceType
 * @property {2|3|4} evidenceTier - per docs/SHIFTING_METHODOLOGY.md's evidence hierarchy (1 and 5 not used yet)
 * @property {boolean} interruptible - false = atomic contiguous block; true = splittable
 * @property {boolean} requiresAwakeHome
 * @property {number} durationMinutes
 * @property {number} energyKwh
 * @property {string} actualStartsAt - ISO
 * @property {string} actualEndsAt - ISO
 *
 * @typedef {object} MoveResult
 * @property {FlexibleLoadEvent} event
 * @property {boolean} moved
 * @property {string} [reason]
 * @property {string[]} [originSlots]
 * @property {string[]} [destinationSlots]
 * @property {number} [perSlotKwh]
 * @property {number} [beforeCostPence]
 * @property {number} [afterCostPence]
 */
