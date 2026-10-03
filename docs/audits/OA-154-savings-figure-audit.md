# OA-154: Audit of canonical savings model vs. current demo figures

## 1. Current canonical scenario

Produced by `buildEvidenceReport()` in [`src/domain/savingsModel/evidenceReport.ts`](../../src/domain/savingsModel/evidenceReport.ts), executed directly against the current code to confirm the figures below are the live output, not stale text:

- Archetype: `family-typical` ([`archetypes.ts:98-146`](../../src/domain/savingsModel/archetypes.ts)) — `annualKwh` = Ofgem medium TDCV (2,500 kWh/yr), with its own event list (washing machine, tumble dryer, dishwasher, oven cooking).
- Current tariff: `flatStandardVariableTariff()` ([`sensitivity.ts:19-27`](../../src/domain/savingsModel/sensitivity.ts)) — Ofgem price-cap average unit rate 26.32p/kWh (flat across all 48 slots) and standing charge 54.83p/day ([`assumptions.ts:53-72`](../../src/domain/savingsModel/assumptions.ts)).
- Alternative tariff: Agile, via the `representative-median-year` scenario ([`historicalPriceFixtures.ts:77-88`](../../src/domain/savingsModel/historicalPriceFixtures.ts)) — built from `LANDING_DEMO_DATA_SOURCES.representativeRates48`, the **same 48-value Agile rate array** the demo fixture uses.
- Compliance: `manual-70` → 0.7 fraction ([`simulator.ts:223`](../../src/domain/savingsModel/simulator.ts)).
- Waste reduction: `waste-reduction-70` (produces a separate £52.50/yr waste-saving figure, not part of the £92.39 total below).
- Annualisation: a single representative day's saving × 7 × 52 = 364 days/year, flat multiplication ([`simulator.ts:188-189,207-208`](../../src/domain/savingsModel/simulator.ts)); realised timing saving = fully-optimised ceiling × 0.7 compliance fraction ([`simulator.ts:264`](../../src/domain/savingsModel/simulator.ts)).

Executed output:

| Figure | Value |
| --- | --- |
| Annual tariff saving | £36.08 |
| Annual fully-optimised timing saving (ceiling, pre-compliance) | £80.44 |
| Annual realised timing saving (× 0.7 compliance) | £56.31 |
| Tariff + realised timing | £92.39 |
| Annual waste saving (separate, not summed above) | £52.50 |

## 2. Current demo scenario

Produced by `buildLandingDemoFixture()` in [`src/domain/landingDemoFixture.ts`](../../src/domain/landingDemoFixture.ts), consumed by [`src/components/LandingDemo.tsx`](../../src/components/LandingDemo.tsx).

- Household/events: `LANDING_DEMO_EVENTS` ([`landingDemoFixture.ts:96-167`](../../src/domain/landingDemoFixture.ts)) — multi-stage `kwhShape` arrays per event (washing machine, tumble dryer, dishwasher, oven, **and a dehumidifier not present in the canonical archetype**), each with its own `occurrencesPerWeek`.
- Current tariff: Standard Variable, same Ofgem constants as canonical (`OFGEM_PRICE_CAP_AVERAGE_UNIT_RATE_PENCE = 26.32`, `OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY = 54.83`, [`landingDemoFixture.ts:207,214`](../../src/domain/landingDemoFixture.ts)).
- Alternative tariff: Agile, `AGILE_REPRESENTATIVE_RATE_PENCE` ([`landingDemoFixture.ts:320-325`](../../src/domain/landingDemoFixture.ts)) — numerically the same 48-slot array as canonical's representative-median-year scenario.
- Tariff-switch annualisation: daily difference rounded to the nearest penny **before** multiplying by 365 (`Math.round(differencePenceVsCurrentTariffPence) * 365`, [`landingDemoFixture.ts:788`](../../src/domain/landingDemoFixture.ts)) — a deliberate OA-146 fix, documented in-line, to keep displayed daily × 365 consistent with the displayed annual figure after rounding.
- Timing-saving annualisation: per-event, `savingPerOccurrencePence × event.occurrencesPerWeek × 52`, summed across events ([`landingDemoFixture.ts:479,761-771`](../../src/domain/landingDemoFixture.ts)) — an OA-104 requirement ("do not simply calculate today's saving × 365"). **No compliance discount is applied.**

No import from `savingsModel/` exists anywhere in `landingDemoFixture.ts` (its only import is `heatMapMath`). The two code paths are fully independent.

## 3. Difference table

| Input / assumption | Canonical (earlier) | Demo (current) | Why changed | Intended? |
| --- | --- | --- | --- | --- |
| Standard Variable rate | 26.32p/kWh, 54.83p/day standing charge | Same values | Shared Ofgem constant, coincidental alignment | Valid fixture reuse |
| Agile rate curve | `representativeRates48` (48-slot array) | Same array (`AGILE_REPRESENTATIVE_RATE_PENCE`) | Shared source array | Valid fixture reuse |
| Household/appliance events | `family-typical` archetype's own event list (washing machine, tumble dryer, dishwasher, oven; single-value `kwhPerSlot` per event) | `LANDING_DEMO_EVENTS` (multi-stage `kwhShape` arrays, different per-event totals, plus a dehumidifier with no canonical counterpart) | Two fixtures authored independently, never reconciled (OA-99 household predates the OA-118 canonical model and was explicitly *not* replaced by it — see `landingPageClaims.ts` header) | Implementation drift — unresolved |
| Tariff-switch annualisation | 7 × 52 = 364 days, flat multiply | 365 days, round-then-multiply (OA-146) | Demo path fixed a display-consistency bug (OA-146) the canonical model never had this exact failure mode for | Valid fixture/display change, but the 364 vs 365 day-count mismatch itself is unresolved |
| Timing-saving annualisation | Fully-optimised ceiling × 7 × 52, then × 0.7 compliance fraction (single global scale-down) | Per-event `occurrencesPerWeek × 52`, summed; **no compliance discount** | Two structurally different models: canonical linearly discounts a single ceiling; demo sums independently-recurring per-event savings at full (100%) compliance | Implementation drift — unresolved |
| Compliance assumption | 70% (`manual-70`) | None applied | Canonical model deliberately models imperfect household follow-through; demo assumes every suggested move happens | Implementation drift — unresolved |
| Waste-reduction saving | £52.50/yr, computed but kept separate from the £92.39 total | Not present in the demo at all | Different scope — canonical model has a feature (waste saving) the demo UI doesn't surface | Not comparable; out of scope for this drift |

## 4. Calculation trace

**Canonical (executed against current code):**
- Tariff saving: `(cost on Standard Variable) − (cost on Agile)` for the representative day, annualised × 364 days → **£36.08**.
- Timing saving ceiling: `(cost on Agile, unmoved) − (cost on Agile, fully re-optimised)` for the representative day, annualised × 364 days → **£80.44**.
- Realised timing saving: `£80.44 × 0.7` → **£56.31**.
- Cumulative: `£36.08 + £56.31` → **£92.39**.

**Demo (read from source, OA-146 logic):**
- Tariff saving: daily difference rounded to the nearest penny, then `× 365` → **≈ £51.10** (the in-line comment at `landingDemoFixture.ts:656-666` names this exact figure as the expected output of a 14p/day daily saving: `14 × 365 = 5110p = £51.10`).
- Timing saving: `Σ (per-event saving-per-occurrence × occurrencesPerWeek × 52)` across washing machine, tumble dryer, dishwasher, dehumidifier, oven → **≈ £41.86**.
- Cumulative: `£51.10 + £41.86` → **≈ £92.96**.

## 5. Verdict

| Difference | Classification |
| --- | --- |
| Tariff saving +£15/yr (£36.08 → £51.10) | **Implementation drift** — driven by different per-event household usage data between the two independently-authored fixtures (canonical `family-typical` archetype vs. demo `LANDING_DEMO_EVENTS`), compounded by a minor, legitimate 364- vs 365-day annualisation difference (<1% of the delta). Rates themselves are identical between the two paths. |
| Timing saving −£14/yr (£56.31 → £41.86) | **Implementation drift** — two structurally different models: canonical applies a 70% compliance discount to a single fully-optimised ceiling; the demo sums per-event savings at full (undiscounted) compliance. This alone would push the demo figure *above* canonical's discounted figure, not below it, so the net −£14 is the combined, non-isolable result of (a) no compliance discount (pushes demo up) and (b) different/lower-saving-potential event data between the two fixtures (pushes demo down by more than (a) pushes it up). I could not isolate the two contributions without re-running the canonical model against the demo's own event set — flagged as **unresolved** pending that follow-up work (out of scope for this audit, which is investigation-only). |
| Cumulative £92.39 vs £92.96 | **Not a valid agreement** — the two deltas above happen to roughly cancel (+£15 and −£14). This is coincidental, not evidence the models are reconciled. The two totals are each internally consistent with their own fixture but are not comparable to each other as "the same number computed two ways." |
| UI-local calculation / canonical model separation | **Confirmed, and explicitly documented as intentional** — `landingPageClaims.ts:1-9`'s own header states the canonical model is "read by a human... deciding whether the landing page's existing numbers are still defensible, not wired into `LandingDemo.tsx` directly." `landingDemoFixture.ts` has zero imports from `savingsModel/`. No hard-coded total savings figures were found (both `£36.08`/`£56.31` and `£51.10`/`£41.86` are computed, not literal), but the two computations are run from independently-maintained fixtures, not one canonical model response. |

## 6. Recommended canonical figures

**Per the ticket's STOP rule: this audit cannot reconcile the two figures deterministically, because they come from two independently-authored, never-reconciled household/event fixtures and two structurally different timing-saving models (compliance-discounted ceiling vs. undiscounted per-event sum).** Neither figure should be treated as superseding the other without a decision on which model and which household data the public demo is meant to represent.

- **Tab 2 (tariff saving):** unresolved as a *reconciled* figure. The demo's own £51.10 is correctly computed from its own fixture and its OA-146 rounding fix is sound in isolation, but it has not been checked against the canonical `family-typical` archetype's usage data. Recommend: either (a) explicitly scope the demo household as a distinct, documented archetype separate from canonical's `family-typical`, in which case £51.10 stands on its own terms, or (b) align the demo's event data to the canonical archetype, which would be expected to move the demo figure toward ≈£36.08.
- **Tab 3 (timing saving):** unresolved. The demo's £41.86 has no compliance discount; the canonical model's £56.31 does (70%). These are not the same claim ("if every suggested move is made" vs. "allowing for 70% real-world follow-through") and should not be presented as interchangeable. Recommend a product decision: either the public demo adopts an explicit compliance assumption consistent with the canonical model's evidence base, or the canonical model's landing-page claims module is updated to model "best case, full compliance" as its own explicit, separately-labelled figure.
- **Cumulative (£92.39 / £92.96):** **do not publish either as the reconciled canonical total.** Their near-equality is coincidental, not validated.
- This audit is investigation-only; no code was changed. Fixing the drift (aligning fixtures, deciding on a compliance stance) is a separate, scoped follow-up.

## 7. Evidence classification per acceptance criteria

- Earlier and current figures reproduced from code: **yes**, canonical figures reproduced by executing `buildEvidenceReport()`; demo figures traced to their exact formulas and the in-line comment naming £51.10.
- Every material difference traced to a specific assumption/input/code path: **yes for tariff saving and the compliance-discount half of timing saving; partially for the remainder of the timing-saving delta** (see Section 5, flagged unresolved).
- Tab 2 tariff saving reconciled: **no** — root cause identified (fixture drift), not reconciled.
- Tab 3 timing saving reconciled: **no** — root causes identified (structural model difference + fixture drift), not reconciled.
- Cumulative saving checked for overlap/double counting: **yes** — no double counting found; the two savings are measured against independent baselines (tariff-switch vs. same-tariff timing) and are additive by construction in both models, but the totals still shouldn't be compared to each other across models.
- UI-local calculations/hard-coded figures identified: **yes** — none are hard-coded; both are computed, but from two independent fixtures rather than one canonical source.
- Daily/monthly/annual conversions comply with OA-146: **yes** for the tariff-comparison path (round-then-multiply, as OA-146 specifies); the timing-saving path uses OA-104's per-event recurrence method, which is a different (also intentional) rule, not a comparison point for OA-146.
- Any unresolved contradiction triggers STOP: **yes — this report invokes the STOP rule for the tariff-saving and timing-saving reconciliation; see Section 6.**
