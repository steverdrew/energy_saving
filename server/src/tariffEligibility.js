import { TARIFF_FAMILY } from './tariffClassification.js'

/**
 * OA-24/OA-69: eligibility metadata for tariffs this app can show as a
 * comparison, keyed by the canonical tariff family (tariffClassification.js)
 * rather than re-parsing a raw tariff code -- OA-69's rule is that no
 * individual module independently infers tariff identity from a code
 * string; this one just maps an already-classified family to an
 * eligibility state.
 *
 * Today we only ever compare the customer's current tariff against
 * Agile (OA-22's explicit scope), and Agile has no eligibility
 * requirement beyond being an Octopus domestic electricity customer --
 * so eligibility is trivially "eligible" for every user this app
 * handles. This exists so a future tariff with a real requirement (EV,
 * compatible charger, battery) has somewhere to declare it rather than
 * silently being treated as eligible by omission.
 */
const ELIGIBILITY_BY_FAMILY = {
  [TARIFF_FAMILY.AGILE]: { status: 'eligible', requirement: null },
  [TARIFF_FAMILY.INTELLIGENT_GO]: { status: 'scenario_only', requirement: 'Requires a compatible EV or charger.' },
  [TARIFF_FAMILY.GO]: { status: 'scenario_only', requirement: 'Requires an EV.' },
}

export function eligibilityForFamily(family) {
  return ELIGIBILITY_BY_FAMILY[family] ?? { status: 'cannot_determine', requirement: null }
}
