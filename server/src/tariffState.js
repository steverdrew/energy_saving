/**
 * OA-45/OA-25: classifies the customer's current tariff and how it relates
 * to the comparison we're about to show, so the result screen can say
 * something true about where they're starting from rather than silently
 * running the same maths for every tariff type.
 *
 * Product-code prefixes are Octopus's own naming convention (confirmed
 * against the real API for Agile -- see fetchActiveAgileTariffCode). The
 * Go/Intelligent Go prefixes below are a best-effort pattern match, not yet
 * confirmed against a real account on either tariff; flagged in
 * HANDOFF.md.
 */
export function classifyTariffKind(tariffCode) {
  if (typeof tariffCode !== 'string') return 'unknown'
  if (tariffCode.includes('AGILE')) return 'agile'
  if (tariffCode.includes('INTELLI')) return 'intelligent_go'
  if (tariffCode.includes('GO-')) return 'go'
  return 'standard'
}

const RECENTLY_SWITCHED_DAYS = 30

/**
 * How confidently our comparison can represent this tariff kind, given
 * what we can fetch from Octopus's public rates endpoint (see OA-25):
 *
 * - 'exact': every rate the customer was actually charged (or would be
 *   charged on Agile) is public, published data -- Agile, Go and standard
 *   tariffs all qualify.
 * - 'bounded_estimate': Intelligent Go's dynamically-assigned bonus
 *   smart-charge windows are personalised and can't be reconstructed
 *   retrospectively from public data, so a comparison only covers the
 *   guaranteed published rate windows and understates the real tariff's
 *   benefit.
 */
export function comparisonMethodForTariffKind(kind) {
  return kind === 'intelligent_go' ? 'bounded_estimate' : 'exact'
}

/**
 * tariffValidFrom is the current agreement's start date (see
 * summarizeOctopusAccount in octopusClient.js). now is injectable for
 * tests.
 */
export function determineTariffState({ tariffCode, tariffValidFrom, now = new Date() }) {
  const kind = classifyTariffKind(tariffCode)
  let daysSinceSwitch = null
  if (tariffValidFrom) {
    daysSinceSwitch = Math.floor((now.getTime() - new Date(tariffValidFrom).getTime()) / 86400000)
  }
  const recentlySwitched = daysSinceSwitch !== null && daysSinceSwitch >= 0 && daysSinceSwitch < RECENTLY_SWITCHED_DAYS

  return {
    kind,
    comparisonMethod: comparisonMethodForTariffKind(kind),
    recentlySwitched,
    daysSinceSwitch,
  }
}
