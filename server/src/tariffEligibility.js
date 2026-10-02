/**
 * OA-24: eligibility metadata for tariffs this app can show as a
 * comparison. Kept sourceable/configurable here rather than scattered
 * through routes/UI, per the ticket's own requirement -- even though
 * today there's only one entry, because the alternative (eligibility
 * logic inlined where the comparison happens) is exactly what the ticket
 * says not to do.
 *
 * Today we only ever compare the customer's current tariff against
 * Agile (OA-22's explicit scope), and Agile has no eligibility
 * requirement beyond being an Octopus domestic electricity customer --
 * so eligibility is trivially "eligible" for every user this app
 * handles. This exists so a future tariff with a real requirement (EV,
 * compatible charger, battery) has somewhere to declare it rather than
 * silently being treated as eligible by omission.
 */
const ELIGIBILITY_BY_PRODUCT_PREFIX = [
  { prefix: 'AGILE', status: 'eligible', requirement: null },
  { prefix: 'INTELLI', status: 'scenario_only', requirement: 'Requires a compatible EV or charger.' },
  { prefix: 'GO', status: 'scenario_only', requirement: 'Requires an EV.' },
]

export function eligibilityForTariffCode(tariffCode) {
  if (typeof tariffCode !== 'string') {
    return { status: 'cannot_determine', requirement: null }
  }
  const match = ELIGIBILITY_BY_PRODUCT_PREFIX.find((entry) => tariffCode.includes(entry.prefix))
  if (!match) {
    return { status: 'cannot_determine', requirement: null }
  }
  return { status: match.status, requirement: match.requirement }
}
