import { classifyTariff } from './tariffClassification.js'

const RECENTLY_SWITCHED_DAYS = 30

/**
 * OA-45/OA-25/OA-68/OA-69: where the customer is starting from. Tariff
 * family/rate-shape/comparison-method all come from the one canonical
 * classifier (tariffClassification.js) -- this module only adds the
 * "how long have they been on it" dimension, which classification
 * itself has no opinion on.
 *
 * tariffValidFrom is the current agreement's start date (see
 * summarizeOctopusAccount in octopusClient.js). now is injectable for
 * tests.
 */
export async function determineTariffState({ tariffCode, tariffValidFrom, fetchProductDetails, now = new Date() }) {
  const classification = await classifyTariff(tariffCode, { fetchProductDetails })

  let daysSinceSwitch = null
  if (tariffValidFrom) {
    daysSinceSwitch = Math.floor((now.getTime() - new Date(tariffValidFrom).getTime()) / 86400000)
  }
  const recentlySwitched = daysSinceSwitch !== null && daysSinceSwitch >= 0 && daysSinceSwitch < RECENTLY_SWITCHED_DAYS

  return {
    ...classification,
    recentlySwitched,
    daysSinceSwitch,
  }
}
