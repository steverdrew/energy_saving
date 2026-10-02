import { productCodeFromTariffCode } from './octopusClient.js'

/**
 * OA-69: the one canonical place a raw Octopus tariff code is turned into
 * a product family -- every consumer (My Savings, OA-22 comparison,
 * OA-66 cheapest-window, OA-65's heat map, eligibility) reads this same
 * classification instead of independently parsing tariff codes. Replaces
 * OA-68's narrower fix, which this supersedes.
 */
export const TARIFF_FAMILY = {
  AGILE: 'agile',
  GO: 'go',
  INTELLIGENT_GO: 'intelligent_go',
  OUTGOING: 'outgoing', // export-only
  DUAL_RATE: 'dual_rate', // e.g. Economy 7 -- two registers, from the tariff code's own rate-type segment
  FLEXIBLE: 'flexible', // standard variable
  FIXED: 'fixed',
  UNKNOWN: 'unknown',
}

export const RATE_SHAPE = {
  FLAT: 'flat',
  TIME_OF_USE: 'time_of_use',
  DYNAMIC_HALF_HOURLY: 'dynamic_half_hourly',
  SMART_PERSONALISED: 'smart_personalised',
  DUAL_RATE: 'dual_rate',
  EXPORT: 'export',
  UNKNOWN: 'unknown',
}

const FAMILY_RATE_SHAPE = {
  [TARIFF_FAMILY.AGILE]: RATE_SHAPE.DYNAMIC_HALF_HOURLY,
  [TARIFF_FAMILY.GO]: RATE_SHAPE.TIME_OF_USE,
  [TARIFF_FAMILY.INTELLIGENT_GO]: RATE_SHAPE.SMART_PERSONALISED,
  [TARIFF_FAMILY.OUTGOING]: RATE_SHAPE.EXPORT,
  [TARIFF_FAMILY.DUAL_RATE]: RATE_SHAPE.DUAL_RATE,
  [TARIFF_FAMILY.FLEXIBLE]: RATE_SHAPE.FLAT,
  [TARIFF_FAMILY.FIXED]: RATE_SHAPE.FLAT,
  [TARIFF_FAMILY.UNKNOWN]: RATE_SHAPE.UNKNOWN,
}

const FAMILY_DISPLAY_NAME = {
  [TARIFF_FAMILY.AGILE]: 'Octopus Agile',
  [TARIFF_FAMILY.GO]: 'Octopus Go',
  [TARIFF_FAMILY.INTELLIGENT_GO]: 'Intelligent Octopus Go',
  [TARIFF_FAMILY.OUTGOING]: 'an Octopus export tariff',
  [TARIFF_FAMILY.DUAL_RATE]: 'a dual-rate (Economy 7-style) tariff',
  [TARIFF_FAMILY.FLEXIBLE]: 'a standard variable tariff',
  [TARIFF_FAMILY.FIXED]: 'a fixed tariff',
  [TARIFF_FAMILY.UNKNOWN]: null,
}

/**
 * Only `comparisonMethod: 'bounded_estimate'` for Intelligent Go (OA-25)
 * -- its personalised smart-charge bonus windows can't be reconstructed
 * from public rates. 'unavailable' for anything we don't understand at
 * all, rather than quietly claiming exactness we don't have.
 */
function comparisonMethodForFamily(family) {
  if (family === TARIFF_FAMILY.INTELLIGENT_GO) return 'bounded_estimate'
  if (family === TARIFF_FAMILY.UNKNOWN) return 'unavailable'
  return 'exact'
}

/**
 * Confident, narrow prefix matches -- checked in this order because a
 * code could plausibly contain more than one substring (e.g. an
 * Intelligent Go code containing "GO"). Each one is a real Octopus
 * product-code convention; AGILE is confirmed against the live API
 * (see HANDOFF.md), GO/INTELLI/OUTGOING are a best-effort match not yet
 * confirmed against a real account on those tariffs.
 */
const FAMILY_PREFIX_MATCHERS = [
  { family: TARIFF_FAMILY.AGILE, test: (code) => code.includes('AGILE') },
  { family: TARIFF_FAMILY.INTELLIGENT_GO, test: (code) => code.includes('INTELLI') },
  { family: TARIFF_FAMILY.OUTGOING, test: (code) => code.includes('OUTGOING') || code.includes('SEG') },
  { family: TARIFF_FAMILY.GO, test: (code) => code.includes('GO') },
]

/**
 * `E-1R-...` vs `E-2R-...`: the rate-type segment of the tariff code
 * itself (not the product name) is Octopus's own signal for how many
 * registers/rates the tariff has -- "2R" is a real dual-rate tariff
 * (Economy 7-style) regardless of what the product is branded.
 */
function rateTypeSegment(tariffCode) {
  return tariffCode.split('-')[1] ?? null
}

/**
 * Classifies a raw Octopus tariff code into the canonical family/rate
 * shape every consumer should use. Never silently falls back to
 * 'flexible'/'fixed' from an unrecognised product-code prefix alone --
 * that fallback only happens once Octopus's own `is_variable` product
 * flag confirms it (via `fetchProductDetails`), and anything that can't
 * be confirmed either way comes back as `TARIFF_FAMILY.UNKNOWN`, with the
 * raw code preserved for diagnosis, per OA-69's explicit fail-safe rule.
 */
export async function classifyTariff(tariffCode, { fetchProductDetails } = {}) {
  if (typeof tariffCode !== 'string' || !tariffCode) {
    return {
      family: TARIFF_FAMILY.UNKNOWN,
      rateShape: RATE_SHAPE.UNKNOWN,
      displayName: null,
      comparisonMethod: 'unavailable',
      raw: tariffCode ?? null,
    }
  }

  const productCode = productCodeFromTariffCode(tariffCode)
  const matched = FAMILY_PREFIX_MATCHERS.find((m) => m.test(productCode))
  if (matched) {
    return {
      family: matched.family,
      rateShape: FAMILY_RATE_SHAPE[matched.family],
      displayName: FAMILY_DISPLAY_NAME[matched.family],
      comparisonMethod: comparisonMethodForFamily(matched.family),
      raw: tariffCode,
    }
  }

  if (rateTypeSegment(tariffCode) === '2R') {
    return {
      family: TARIFF_FAMILY.DUAL_RATE,
      rateShape: RATE_SHAPE.DUAL_RATE,
      displayName: FAMILY_DISPLAY_NAME[TARIFF_FAMILY.DUAL_RATE],
      comparisonMethod: comparisonMethodForFamily(TARIFF_FAMILY.DUAL_RATE),
      raw: tariffCode,
    }
  }

  // No confident prefix or rate-type signal -- ask Octopus's own product
  // data rather than guessing from the code's naming, per OA-68/OA-69.
  if (fetchProductDetails) {
    try {
      const product = await fetchProductDetails(productCode)
      if (product.isVariable === true) {
        return {
          family: TARIFF_FAMILY.FLEXIBLE,
          rateShape: RATE_SHAPE.FLAT,
          displayName: product.displayName ?? product.fullName ?? FAMILY_DISPLAY_NAME[TARIFF_FAMILY.FLEXIBLE],
          comparisonMethod: comparisonMethodForFamily(TARIFF_FAMILY.FLEXIBLE),
          raw: tariffCode,
        }
      }
      if (product.isVariable === false) {
        return {
          family: TARIFF_FAMILY.FIXED,
          rateShape: RATE_SHAPE.FLAT,
          displayName: product.displayName ?? product.fullName ?? FAMILY_DISPLAY_NAME[TARIFF_FAMILY.FIXED],
          comparisonMethod: comparisonMethodForFamily(TARIFF_FAMILY.FIXED),
          raw: tariffCode,
        }
      }
    } catch {
      // Falls through to UNKNOWN below -- an Octopus lookup failure is
      // not a reason to guess.
    }
  }

  return {
    family: TARIFF_FAMILY.UNKNOWN,
    rateShape: RATE_SHAPE.UNKNOWN,
    displayName: null,
    comparisonMethod: 'unavailable',
    raw: tariffCode,
  }
}
