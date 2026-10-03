/**
 * OA-122 (follow-up): real historical Octopus Agile half-hourly price
 * curves, fetched from the public Octopus Energy API
 * (api.octopus.energy, product AGILE-24-10-01, tariff
 * E-1R-AGILE-24-10-01-C, region C/London) this session, not invented or
 * caller-supplied placeholders -- `sensitivity.ts`'s `SensitivityScenario`
 * abstraction stayed deliberately source-agnostic, but OA-122 explicitly
 * asked for actual historical periods run through it, so this module is
 * the real data to pass in.
 *
 * Each curve's 48 values are the real published `value_inc_vat` rates for
 * that calendar date in Europe/London local time (fetched with a UTC
 * period_from/period_to window adjusted for BST where the date falls in
 * British Summer Time), sorted ascending by `valid_from` -- index 0 is
 * 00:00 London, index 47 is 23:30 London. Frozen here as a snapshot, same
 * convention as landingDemoFixture.ts's own frozen representative-day
 * array, rather than re-fetched on every run.
 */

import { LANDING_DEMO_DATA_SOURCES } from '../landingDemoFixture'
import { SLOTS_PER_DAY } from './archetypes'
import type { TariffPriceCurve } from './simulator'

const STANDING_CHARGE_PENCE_PER_DAY = 54.83 // same Ofgem price-cap standing charge as assumptions.ts's ofgem-price-cap-standing-charge

export interface HistoricalPriceScenario {
  id: string
  label: string
  /** What this day/period was chosen to represent -- not a cherry-picked "best case". */
  characterisation: string
  tariff: TariffPriceCurve
  sourceDate: string
  sourceUrl: string
}

function buildTariff(id: string, label: string, ratePence: readonly number[]): TariffPriceCurve {
  if (ratePence.length !== SLOTS_PER_DAY) {
    throw new Error(`Historical price fixture "${id}" must provide exactly ${SLOTS_PER_DAY} half-hour rates, got ${ratePence.length}.`)
  }
  return { id, label, ratePence, standingChargePencePerDay: STANDING_CHARGE_PENCE_PER_DAY }
}

// Fetched 2026-10-03 via:
// https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-01-18T00:00:00Z&period_to=2026-01-19T00:00:00Z
// (18 Jan 2026 is GMT, so the UTC window already equals the London local day.)
const WINTER_HIGH_COST_RATE_PENCE: readonly number[] = [
  20.622, 21.84, 20.895, 20.832, 20.076, 19.32, 19.2675, 19.11, 19.32, 19.32, 19.0785, 18.69, 19.32, 19.425, 21.147,
  20.475, 20.16, 19.95, 19.5195, 20.79, 20.58, 21.3255, 21.693, 21.903, 21.525, 22.113, 21.483, 20.8215, 20.79,
  20.664, 20.79, 22.239, 37.758, 39.018, 39.648, 38.934, 39.0075, 38.031, 24.0765, 21.8085, 22.722, 20.4855, 21.147,
  19.2885, 19.362, 18.396, 19.593, 19.383,
]

// Fetched 2026-10-03 via:
// https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-04-04T23:00:00Z&period_to=2026-04-05T23:00:00Z
// (5 Apr 2026 is BST; window shifted one hour to align with the London
// local day.) This is the same date OA-99's observed-range provenance
// cites (min -11.277p/kWh) -- confirmed by this independent fetch.
const NEGATIVE_PRICE_NIGHT_RATE_PENCE: readonly number[] = [
  -3.927, -4.032, -3.696, -2.457, -2.562, -3.696, -3.927, -3.927, -4.0635, -3.507, -3.2655, -3.276, -3.507, -3.507,
  -3.717, -2.457, -4.305, -4.746, -5.46, -4.368, -6.027, -7.728, -7.728, -9.807, -9.345, -11.277, -8.946, -10.3635,
  -10.731, -10.269, -10.6785, -8.1375, 4.893, 9.66, 9.933, 17.409, 17.6925, 23.1315, 15.393, 15.393, 15.393, 15.4035,
  17.052, 15.0255, 15.393, 13.3875, 23.1945, 17.493,
]

// Fetched 2026-10-03 via:
// https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-06-19T23:00:00Z&period_to=2026-06-20T23:00:00Z
// (20 Jun 2026 is BST; window shifted one hour.)
const CALM_SUMMER_DAY_RATE_PENCE: readonly number[] = [
  19.173, 18.6375, 18.06, 17.556, 16.695, 15.435, 17.85, 17.4195, 17.514, 17.6085, 17.22, 16.695, 15.771, 16.905,
  15.897, 16.863, 14.154, 14.973, 15.1935, 13.881, 14.721, 14.049, 12.3795, 12.642, 13.293, 12.978, 12.873, 12.873,
  13.104, 12.873, 12.873, 13.6815, 27.8355, 26.523, 30.093, 29.673, 33.6945, 35.2275, 26.313, 25.725, 25.9245, 26.292,
  25.641, 26.187, 23.1, 22.428, 22.302, 21.609,
]

export const HISTORICAL_PRICE_SCENARIOS: readonly HistoricalPriceScenario[] = [
  {
    id: 'representative-median-year',
    label: 'Representative median year (OA-99 methodology)',
    characterisation:
      "OA-99's own representative day -- the median of each of the 48 daily clock slots' real Agile rates over 2025-10-01 to 2026-09-30 (365 observations per slot). The right scenario for a headline/typical claim: smooths day-to-day extremes out, same as the landing-page fixture already shows.",
    tariff: buildTariff(
      'agile-representative-median-year',
      'Agile -- representative median year',
      LANDING_DEMO_DATA_SOURCES.representativeRates48,
    ),
    sourceDate: '2025-10-01 to 2026-09-30',
    sourceUrl: 'https://developer.octopus.energy/guides/rest/api-endpoints/',
  },
  {
    id: 'winter-high-cost-2026-01-18',
    label: 'Winter high-cost day (18 Jan 2026)',
    characterisation: 'A genuinely high-cost winter day (18.4-39.6p/kWh, pronounced 16:00-19:00 peak) -- the upper end of realistic day-to-day variation, not a cherry-picked worst case.',
    tariff: buildTariff('agile-winter-high-cost', 'Agile -- 18 Jan 2026', WINTER_HIGH_COST_RATE_PENCE),
    sourceDate: '2026-01-18',
    sourceUrl:
      'https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-01-18T00:00:00Z&period_to=2026-01-19T00:00:00Z',
  },
  {
    id: 'negative-price-night-2026-04-05',
    label: 'Negative-price night (5 Apr 2026)',
    characterisation: 'A real negative-price overnight window (down to -11.277p/kWh) followed by a moderate daytime/evening rise -- the scenario that shows timing opportunity can occasionally be much larger than the median-year headline, for a household able to shift load into the negative window.',
    tariff: buildTariff('agile-negative-price-night', 'Agile -- 5 Apr 2026', NEGATIVE_PRICE_NIGHT_RATE_PENCE),
    sourceDate: '2026-04-05',
    sourceUrl:
      'https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-04-04T23:00:00Z&period_to=2026-04-05T23:00:00Z',
  },
  {
    id: 'calm-summer-day-2026-06-20',
    label: 'Calm summer day (20 Jun 2026)',
    characterisation: 'A lower-volatility summer day (12.4-35.2p/kWh) -- the lower end of realistic day-to-day variation, used to guard against overstating timing opportunity from only the two more extreme scenarios above.',
    tariff: buildTariff('agile-calm-summer-day', 'Agile -- 20 Jun 2026', CALM_SUMMER_DAY_RATE_PENCE),
    sourceDate: '2026-06-20',
    sourceUrl:
      'https://api.octopus.energy/v1/products/AGILE-24-10-01/electricity-tariffs/E-1R-AGILE-24-10-01-C/standard-unit-rates/?period_from=2026-06-19T23:00:00Z&period_to=2026-06-20T23:00:00Z',
  },
] as const
