/**
 * OA-9: finds the cheapest contiguous run of half-hourly Agile slots long
 * enough for an appliance cycle of a given duration. Forward-looking --
 * takes whatever Agile rates have been published (today, and tomorrow's
 * from ~4pm UK time), unlike OA-22's backward-looking comparison.
 */

const SLOT_MINUTES = 30

/**
 * Adds minutes to an ISO timestamp. Strips the `.000` milliseconds
 * `Date#toISOString` always adds, so the result matches Octopus's own
 * whole-second timestamp format (needed for the exact-string comparison
 * in isContiguous).
 */
function addMinutes(isoString, minutes) {
  const iso = new Date(new Date(isoString).getTime() + minutes * 60 * 1000).toISOString()
  return iso.replace('.000Z', 'Z')
}

/** True if every rate in the window starts exactly one slot after the previous one. */
function isContiguous(window) {
  for (let i = 1; i < window.length; i++) {
    const expected = addMinutes(window[i - 1].validFrom, SLOT_MINUTES)
    if (window[i].validFrom !== expected) return false
  }
  return true
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * @param {{validFrom: string, unitRateIncVatPence: number}[]} rates
 * @param {number} durationMinutes
 * @returns {{startsAt: string, endsAt: string, averageUnitRateIncVatPence: number, slotsUsed: number} | null}
 */
export function findCheapestWindow(rates, durationMinutes) {
  if (!Array.isArray(rates) || rates.length === 0 || !durationMinutes || durationMinutes <= 0) {
    return null
  }

  const slotsNeeded = Math.ceil(durationMinutes / SLOT_MINUTES)
  if (slotsNeeded > rates.length) return null

  const sorted = [...rates].sort((a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())

  let best = null
  for (let i = 0; i + slotsNeeded <= sorted.length; i++) {
    const window = sorted.slice(i, i + slotsNeeded)
    if (!isContiguous(window)) continue

    const totalPence = window.reduce((sum, r) => sum + r.unitRateIncVatPence, 0)
    const averageUnitRateIncVatPence = round2(totalPence / slotsNeeded)

    if (!best || averageUnitRateIncVatPence < best.averageUnitRateIncVatPence) {
      best = {
        startsAt: window[0].validFrom,
        endsAt: addMinutes(window[window.length - 1].validFrom, SLOT_MINUTES),
        averageUnitRateIncVatPence,
        slotsUsed: slotsNeeded,
      }
    }
  }

  return best
}
