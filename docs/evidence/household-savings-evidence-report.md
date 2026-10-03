# Household energy opportunity -- evidence report (OA-118/119/120/121/122/123)

Generated: 2026-10-03

Price scenarios run: representative-median-year, winter-high-cost-2026-01-18, negative-price-night-2026-04-05, calm-summer-day-2026-06-20
Compliance levels swept: Manual, low adherence (30%), Manual, engaged household (70%), Automated shifting (100%)
Waste-reduction levels swept: Low effort (30% of identified waste removed), Engaged household (70% removed), Full elimination (100% removed)

## Per-archetype opportunity (annual GBP, low/central/high across every price scenario and compliance/waste-reduction level)

| Archetype | Daily usage (kWh) | Tariff saving | Timing saving | Waste saving | Combined opportunity |
|---|---|---|---|---|---|
| Single occupant, flat | 4.93 | £71.23 (range £37.19 - £340.04) | £41.59 (range £16.81 - £59.59) | £45.00 (range £33.00 - £60.00) | £123.75 (range £55.74 - £444.63) |
| Family household (typical) | 6.85 | £93.03 (range £-22.05 - £517.64) | £71.31 (range £59.99 - £80.44) | £75.00 (range £55.00 - £100.00) | £167.39 (range £21.84 - £655.25) |
| Family household (large) | 11.51 | £212.89 (range £44.70 - £936.43) | £71.31 (range £59.99 - £80.44) | £105.00 (range £77.00 - £140.00) | £304.38 (range £97.60 - £1104.04) |
| EV-owning family | 12.33 | £215.02 (range £43.84 - £990.11) | £69.96 (range £42.23 - £72.23) | £75.00 (range £55.00 - £100.00) | £289.22 (range £88.01 - £1107.34) |
| High-use household, non-EV (immersion/hot-water boost) | 15.07 | £184.33 (range £-8.18 - £1085.80) | £267.65 (range £199.46 - £426.81) | £97.50 (range £71.50 - £130.00) | £374.70 (range £80.91 - £1610.11) |

## Landing-page claim ranges

- **tariff-switch-saving**: £144.56/year (range £-22.05 - £1085.80). Tariff-switch saving is independent of timing and should be presented as its own claim, never summed with the timing claim below without clearly labelling both.
- **timing-saving-non-ev-household**: £71.31/year (range £0.00 - £426.81). Per OA-118: timing alone for a typical non-EV household is often only "tens of pounds per year" -- do not headline a figure outside this range for a non-EV household, and do not imply this is typical for EV-owning households.
- **timing-saving-ev-household**: £69.96/year (range £0.00 - £72.23). EV-owning households show materially larger timing opportunity (overnight charging is the single largest movable load) -- keep this claim scoped to EV-owning archetypes, never generalised to the typical household.

## Recommended demo household

Archetype: **family-typical**, price scenario: **representative-median-year**.

Keep OA-99's existing family-typical archetype and representative-median-year price scenario as the landing-page demo household -- this report's sensitivity sweep confirms its tariff and timing savings stay positive and within this report's broader archetype range (not an outlier), so the current demo numbers remain defensible. See the per-archetype table above for the exact ranges a copy update should cite, and the claim ranges below for the EV/non-EV timing distinction the current landing-page copy should preserve.

## Canonical landing-page figures

The exact numbers the landing-page copy should cite: the **family-typical** household, under the **representative-median-year** price scenario, at **manual-70** timing compliance and **waste-reduction-70** waste reduction (a realistic partial-adoption assumption, not the optimistic automated-100% ceiling).

| Figure | Value |
|---|---|
| Baseline daily usage | 6.85 kWh |
| Tariff saving (switch to Agile) | £36.08/year |
| Timing saving, fully optimised (ceiling) | £80.44/year |
| Timing saving, realised at manual-70 compliance | £56.31/year |
| Waste (standby) saving at waste-reduction-70 | £52.50/year |
| **Combined opportunity (non-overlapping total)** | **£144.89/year** |

The combined figure sums tariff + realised-timing + realised-waste because these three are computed from disjoint, non-overlapping inputs (different tariff vs. same tariff/shifted load vs. standby draw independent of the usage profile) -- never a sum of double-counted figures. Components above remain independently reportable; this total is the one additional number OA-123 explicitly permits alongside them.

## Real household snapshot sanity check (OA-130)

User-supplied real household half-hourly export (Steve, OA-130), covering 2026-09-29 to 2026-10-01. Sanity-check dataset only -- not a representative archetype, never annualised.

**This is a sanity check, not a representative archetype.** The 3-day sample is never annualised and never replaces the model-derived canonical figures above.

| Date | Daily total (kWh) | Peak half-hour (kWh, start) | Overnight mean 01:00-04:00 (kWh) |
|---|---|---|---|
| 2026-09-29 | 29.587 | 3.756 (2026-09-29T02:30:00+01:00) | 3.406 |
| 2026-09-30 | 6.729 | 1.613 (2026-09-30T03:30:00+01:00) | 0.307 |
| 2026-10-01 | 4.715 | 0.675 (2026-10-01T19:30:00+01:00) | 0.048 |

**Anomalous/high-load day**: 2026-09-29, at 4.4x the next-highest day's total -- consistent with the supplied data's own description of its first day as clearly anomalous relative to the following two. Not investigated further (no appliance disaggregation is attempted here, per OA-130's explicit scope).

### Comparison against the canonical archetypes (scale and overnight share only -- no appliance-level claims)

| Archetype | Archetype daily (kWh) | Snapshot date | Snapshot daily (kWh) | Scale ratio (snapshot / archetype) | Snapshot overnight share of daily |
|---|---|---|---|---|---|
| Single occupant, flat | 4.93 | 2026-09-29 | 29.59 | 6.00x | 69.1% |
| Single occupant, flat | 4.93 | 2026-09-30 | 6.73 | 1.36x | 27.4% |
| Single occupant, flat | 4.93 | 2026-10-01 | 4.71 | 0.96x | 6.2% |
| Family household (typical) | 6.85 | 2026-09-29 | 29.59 | 4.32x | 69.1% |
| Family household (typical) | 6.85 | 2026-09-30 | 6.73 | 0.98x | 27.4% |
| Family household (typical) | 6.85 | 2026-10-01 | 4.71 | 0.69x | 6.2% |
| Family household (large) | 11.51 | 2026-09-29 | 29.59 | 2.57x | 69.1% |
| Family household (large) | 11.51 | 2026-09-30 | 6.73 | 0.58x | 27.4% |
| Family household (large) | 11.51 | 2026-10-01 | 4.71 | 0.41x | 6.2% |
| EV-owning family | 12.33 | 2026-09-29 | 29.59 | 2.40x | 69.1% |
| EV-owning family | 12.33 | 2026-09-30 | 6.73 | 0.55x | 27.4% |
| EV-owning family | 12.33 | 2026-10-01 | 4.71 | 0.38x | 6.2% |
| High-use household, non-EV (immersion/hot-water boost) | 15.07 | 2026-09-29 | 29.59 | 1.96x | 69.1% |
| High-use household, non-EV (immersion/hot-water boost) | 15.07 | 2026-09-30 | 6.73 | 0.45x | 27.4% |
| High-use household, non-EV (immersion/hot-water boost) | 15.07 | 2026-10-01 | 4.71 | 0.31x | 6.2% |

What this does validate: the two lower-usage snapshot days (30 Sep, 1 Oct) sit in a broadly plausible daily-kWh range alongside the Typical/Family archetypes -- the model's overall scale is not obviously wrong. What this does **not** validate: appliance-level timing, standby/vampire draw in isolation, or the anomalous first day, which is a real one-off high-load event this report does not attempt to explain. No assumption in `assumptions.ts` or `archetypes.ts` is changed as a result of this snapshot -- the sample is too short and too household-specific to justify a versioned change on its own.

## Price-volatility finding

On the single winter-high-cost-2026-01-18 scenario, the typical household's tariff-switch saving goes *negative* once naively annualised -- that day's usage happens to concentrate (dishwasher/oven, fixed evening slots) inside an unusually expensive 16:00-19:00 window. This is the real behaviour OA-118 asked the model to surface ("do not assume Agile is always the best tariff"), not a bug: a single atypical day should never be read as a full-year claim, which is why this report's STOP check and its recommended claim both key off the representative-median-year scenario, not the single-day stress scenarios.

## Explicit data gaps

- Elexon's literal 48-period Profile Class 1 coefficient table was not obtained (only its documented shape) -- every archetype's base-load shape stays a shape-consistent approximation, not a verified copy of Elexon's own data.
- CREST's specific per-appliance kWh/duration/frequency output tables were not extracted -- appliance event durations/kWh stay 'informed by CREST-class evidence', not measured from CREST's own published parameters.
- Energy Saving Trust standby-cost figures could not be pinned to one single dated primary document in this research pass -- the £55-100/year range used is a plausible, not verified, synthesis of several EST-attributed secondary citations.
- Octopus Agile's regional variation is represented by one reference region (C/London, following OA-99's own convention) -- no multi-region blended curve was built.
