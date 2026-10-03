/**
 * OA-119: a verified, versioned source pack for every assumption the
 * household savings model (OA-120 archetypes, OA-121 simulator, OA-122
 * sensitivity, OA-123 landing-page claims) depends on -- built from the
 * OA-118 deep-research output, not used directly as model constants until
 * each figure below is explicitly marked `verified` or `plausible`.
 *
 * This does not replace OA-21 (canonical savings methodology) or OA-99
 * (Typical household landing-page fixture provenance) -- it is the
 * underlying evidence layer those should eventually consume from, kept
 * separate so the landing page's existing deterministic fixture is never
 * silently re-derived from a half-finished model mid-epic.
 */

export type AssumptionConfidence = 'verified' | 'plausible' | 'illustrative' | 'rejected'

export interface Assumption {
  id: string
  description: string
  /** A single number, or a { low, central, high } range per OA-118's "use low/central/high assumptions where evidence is uncertain" rule. */
  value: number | { low: number; central: number; high: number }
  unit: string
  source: string
  sourceDate: string
  confidence: AssumptionConfidence
  notes: string
  /** The model/source-pack version this entry was last confirmed under -- bumped whenever its value, confidence or source changes. */
  modelVersion: string
}

const MODEL_VERSION = '2026-10-03'

/**
 * OA-118 explicitly warns against allowing illustrative figures to become
 * model constants -- every entry here is tagged, and anything not
 * `verified` or `plausible` must not be used as a customer-facing or
 * model-critical constant (enforced by `requireVerifiedOrPlausible` below).
 */
export const SAVINGS_MODEL_ASSUMPTIONS: readonly Assumption[] = [
  // --- Tariff effect: baseline consumption and price-cap reference -----
  {
    id: 'ofgem-tdcv-electricity-medium',
    description: "Ofgem medium Typical Domestic Consumption Value (TDCV) for electricity, Profile Class 1 / standard single-rate household.",
    value: 2500,
    unit: 'kWh/year',
    source: 'Ofgem, "Review of typical domestic consumption values: decision", effective 1 July 2026',
    sourceDate: '2026-05-27',
    confidence: 'verified',
    notes: 'Same figure already used by OA-99\'s landing-page fixture (src/domain/landingDemoFixture.ts). Annual-average day ~6.85 kWh/day.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'ofgem-price-cap-average-unit-rate',
    description: 'Ofgem price-cap average Direct Debit electricity unit rate.',
    value: 26.32,
    unit: 'pence/kWh',
    source: 'Ofgem, "Changes to energy price cap between 1 October and 31 December 2026"',
    sourceDate: '2026-10-01',
    confidence: 'verified',
    notes: 'Used as the Standard Variable reference rate, matching OA-99. Varies by price-cap period -- re-verify each quarter the model is re-run.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'ofgem-price-cap-standing-charge',
    description: 'Ofgem price-cap average electricity standing charge.',
    value: 54.83,
    unit: 'pence/day',
    source: 'Ofgem, "Changes to energy price cap between 1 October and 31 December 2026"',
    sourceDate: '2026-10-01',
    confidence: 'verified',
    notes: 'Handled explicitly and never mixed into usage-cost-only comparisons, per OA-99/OA-118\'s standing-charge rule.',
    modelVersion: MODEL_VERSION,
  },

  // --- Timing effect: load-shape and Agile pricing evidence -------------
  {
    id: 'elexon-pc1-domestic-load-shape',
    description: "Elexon domestic Profile Class 1 (Domestic Unrestricted) half-hourly load-shape methodology: diurnal pattern (overnight trough, morning rise, midday plateau, evening peak).",
    value: 0,
    unit: 'n/a (shape, not a scalar)',
    source: "Elexon, \"Profiling\" / Elexon Load Shaping Service (built from 100,000+ domestic smart-meter sites, 1 Apr 2023 - 31 Mar 2026)",
    sourceDate: '2026-04-01',
    confidence: 'plausible',
    notes: "Elexon's enumerated 48-period coefficient table lives in the Elexon Portal's Market Domain Data repository, which is not a public, scrapeable export. Only the documented general shape is verifiable without a data-sharing agreement -- any literal 48-value table used downstream (e.g. OA-99's BASE_LOAD_SHAPE) is shape-consistent, not a verified copy, and must stay flagged as such.",
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'agile-structural-peak-window',
    description: 'Octopus Agile pricing includes a 16:00-19:00 network/grid-related cost uplift, producing a structural peak window distinct from ordinary wholesale-price variation.',
    value: 0,
    unit: 'n/a (boolean structural claim)',
    source: 'Octopus Energy, "How we calculate Agile prices" (Agile formula: rate = min(D x wholesale + P, cap), P applied 16:00-19:00)',
    sourceDate: '2026-09-01',
    confidence: 'verified',
    notes: 'Confirms OA-99\'s existing 4-7pm structural-peak annotation. Each half-hour inside the window still carries its own distinct price -- never a fixed flat rate for the whole window.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'agile-price-cap',
    description: 'Octopus Agile unit-rate cap, including VAT.',
    value: 100,
    unit: 'pence/kWh',
    source: 'Octopus Energy, "How we calculate Agile prices"',
    sourceDate: '2026-09-01',
    confidence: 'verified',
    notes: 'Formula: rate = min(D x wholesale price + P, cap). Must be preserved in the simulator\'s price model even though no fixture slot happens to hit it.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'agile-negative-price-possibility',
    description: 'Octopus Agile unit rates can go negative (most common overnight, Oct-Mar, on high-wind nights, when renewable generation exceeds demand).',
    value: 0,
    unit: 'n/a (boolean possibility claim)',
    source: 'Octopus Energy, "How we calculate Agile prices"; OA-99 fixture provenance (497 of 17,520 half-hourly observations negative, min -11.277p/kWh, region C, 2025-10-01 to 2026-09-30)',
    sourceDate: '2026-09-30',
    confidence: 'verified',
    notes: 'Must be representable in the simulator\'s price model (not clamped at zero) even when a particular representative/median day does not surface a negative value.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'intelligent-octopus-go-off-peak-rate',
    description: 'Intelligent Octopus Go off-peak unit rate (23:30-05:30 cheap window), used as a comparator tariff, not assumed to be the best option.',
    value: { low: 3.49, central: 8, high: 9 },
    unit: 'pence/kWh',
    source: 'Octopus Energy published tariff rates, Apr-Oct 2026 (regional variation; EV-charger-linked tariff)',
    sourceDate: '2026-10-01',
    confidence: 'plausible',
    notes: 'Rate varies materially by region and has changed several times within 2026 (9p -> as low as 3.49-5.49p in Apr, ~8p by Oct); peak rate ~24.95-36.3p/kWh, standing charge ~45-55p/day. Not verified against a single authoritative current snapshot -- treat any comparator figure derived from this as plausible, not verified, until re-checked against Octopus\'s live published rates at model-run time. Requires an EV + compatible smart charger, so only relevant for EV-owning archetypes (OA-120).',
    modelVersion: MODEL_VERSION,
  },

  // --- Waste effect: standby / background consumption -------------------
  {
    id: 'est-standby-annual-cost-range',
    description: 'Energy Saving Trust estimate of average UK household annual cost of standby/background ("vampire") electricity consumption.',
    value: { low: 55, central: 75, high: 100 },
    unit: 'GBP/year',
    source: 'Energy Saving Trust standby-power guidance (as cited across multiple EST-sourced consumer summaries: figures reported range from £35 to £100/year depending on publication date and methodology)',
    sourceDate: '2026-01-01',
    confidence: 'plausible',
    notes: "Multiple EST-attributed figures circulate (£35, £55, £60-80, £65-100) across different years/publications without one single primary EST document consistently pinned down in this research pass. Treated as plausible, not verified, until a single dated EST primary source is located and re-checked -- the central £75/year figure is a conservative mid-point of the plausible range, not a precise measurement. Must not be presented to customers as a precise, sourced figure until upgraded to verified.",
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'est-standby-share-of-domestic-demand',
    description: "Energy Saving Trust estimate of standby/background consumption's share of total domestic electricity demand.",
    value: { low: 9, central: 12, high: 16 },
    unit: 'percent of domestic electricity demand',
    source: 'Energy Saving Trust (reported range 9-16%, vs. an older 5-10% estimate for domestic standby specifically)',
    sourceDate: '2026-01-01',
    confidence: 'plausible',
    notes: 'Same provenance caveat as est-standby-annual-cost-range -- a single primary EST document was not pinned down in this research pass. Use for order-of-magnitude sanity-checking the waste-effect model, not as a precise customer-facing claim.',
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'standby-worst-offenders',
    description: 'Device categories most commonly identified as dominant standby-power contributors in UK households.',
    value: 0,
    unit: 'n/a (categorical, not a scalar)',
    source: 'Energy Saving Trust consumer guidance; BBC Science Focus "Reality Check" standby review',
    sourceDate: '2026-01-01',
    confidence: 'plausible',
    notes: 'Televisions and satellite/TV set-top boxes most commonly cited, followed by internet routers and microwaves (clock display). Game consoles also commonly cited but with wider per-model variance. Use only as a qualitative basis for which appliance categories OA-120\'s waste-effect archetype assumptions should model -- per-device kWh/standby-watt figures still need their own dedicated verification before use as model constants.',
    modelVersion: MODEL_VERSION,
  },

  // --- Appliance event evidence (CREST) ----------------------------------
  {
    id: 'crest-domestic-demand-model-methodology',
    description: 'CREST (Loughborough University) high-resolution (1-minute) bottom-up domestic electricity demand model, simulating occupant activity and appliance-use patterns from UK time-use survey data.',
    value: 0,
    unit: 'n/a (methodology, not a scalar)',
    source: 'Richardson, Thomson, Infield et al., "Domestic electricity use: A high-resolution energy demand model" (CREST, Loughborough University); widely cited/validated, used in 1000+ studies',
    sourceDate: '2026-01-01',
    confidence: 'plausible',
    notes: "Confirms CREST is a credible, citable methodology for appliance event shapes/frequencies and is the right evidence class for OA-120's event durations/occurrence rates. This research pass did not extract CREST's specific per-appliance kWh-per-cycle/duration/frequency output tables (those live in the model's own published parameter set, not freely scrapeable) -- OA-120's appliance assumptions therefore stay labelled 'modelled assumption, informed by CREST-class evidence', not 'measured from CREST', until that extraction is done as a dedicated follow-up.",
    modelVersion: MODEL_VERSION,
  },
  {
    id: 'immersion-heater-typical-power',
    description: 'Typical UK domestic immersion-heater electrical draw.',
    value: { low: 1, central: 3, high: 3.8 },
    unit: 'kW',
    source: 'Common UK immersion-heater nameplate ratings (manufacturer spec sheets, consumer energy guides) -- not a CREST-class metered-event study.',
    sourceDate: '2026-01-01',
    confidence: 'illustrative',
    notes: "Rated power, not metered duty-cycle energy -- a part-cycle or thermostat-limited run draws less than this for its full duration. OA-120's high-use-non-ev archetype uses a 1.2 kWh/slot figure (a part-cycle approximation, not full continuous draw) derived from this range but not independently metered, so it stays illustrative: must not be presented as a verified per-cycle kWh figure until a CREST-class metered source is found.",
    modelVersion: MODEL_VERSION,
  },
] as const

export function getAssumption(id: string): Assumption {
  const found = SAVINGS_MODEL_ASSUMPTIONS.find((a) => a.id === id)
  if (!found) throw new Error(`Unknown savings-model assumption id: ${id}`)
  return found
}

/**
 * OA-118: "do not allow illustrative figures to silently become model
 * constants." Call this wherever a model-critical or customer-facing
 * constant is derived from an assumption, so a demotion to `illustrative`
 * or `rejected` fails loudly instead of quietly shipping a weaker claim.
 */
export function requireVerifiedOrPlausible(id: string): Assumption {
  const assumption = getAssumption(id)
  if (assumption.confidence !== 'verified' && assumption.confidence !== 'plausible') {
    throw new Error(
      `Assumption "${id}" is marked "${assumption.confidence}" and cannot back a model-critical or customer-facing value.`,
    )
  }
  return assumption
}

export function assumptionsByConfidence(confidence: AssumptionConfidence): readonly Assumption[] {
  return SAVINGS_MODEL_ASSUMPTIONS.filter((a) => a.confidence === confidence)
}
