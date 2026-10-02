# Savings methodology (OA-21)

**Signed off by Steve 2026-10-02.** OA-8 is built against this —
see `HANDOFF.md` for current status. Decisions below are recorded as
agreed, not draft.

## What we calculate

For a connected account, over the imported history window (currently
the last 30 days of half-hourly consumption — OA-6):

> What would this household's own actual electricity usage have cost
> on Octopus Agile, compared to what it actually cost on their current
> tariff?

Concretely, for every half-hour interval where we have both a
consumption reading and a rate on both tariffs:

```
cost(tariff) = Σ (consumption_kWh × unit_rate_inc_vat_pence_per_kWh)
estimated_saving = cost(current_tariff) − cost(agile)
```

A positive number means Agile would have been cheaper for that
household, for that period, based on what they actually did — not a
prediction of future behaviour.

## Scope (deliberately narrow for the MVP)

- **Current tariff vs. Agile only.** Not every Octopus tariff. If a
  broader comparison is wanted later, that's a new ticket, not a
  silent expansion of this one.
- **Unit rates only — no standing charge.** We don't currently fetch
  standing charges for either tariff, so the comparison is import-cost
  only, not full-bill cost. This should be stated plainly wherever the
  result is shown, not left implicit.
- **The imported window only** (30 days today). Not a full year, so it
  won't capture seasonal variation — a result shown in summer may not
  hold for winter. This is also a part of the MVP narrowing, not a
  promise for the future.
- **Both series must be half-hourly and UTC-aligned**, as Octopus
  supplies them. An interval missing a rate on either tariff is
  excluded from both totals (not assumed to be zero-cost).

## What this is not

- Not a guarantee of future savings — prices and the household's own
  usage pattern can both change.
- Not a recommendation to switch — Octopus Agile has risk (prices can
  spike as well as fall) that a flat tariff doesn't.
- Not a full bill comparison — standing charges, VAT on standing
  charges, and any account-level discounts aren't included.
- Not financial advice.

## Decisions (Steve, 2026-10-02)

1. **Unit-rate-only is fine to ship**, as long as the caveat is
   impossible to miss *in the result copy itself*, not left implicit
   or buried in a docs page. Never phrase it as "you would save £X on
   your bill" — that overclaims a full-bill comparison we're not
   making. Internally, treat this as a distinct, labelled
   `unitRateOnly: true` result shape, so that adding standing charges
   later is an upgrade to the same result type, not a meaning change
   underneath an unchanged label.
2. **30 days is enough to ship the first result.** State the window
   explicitly in the copy ("last 30 days"). If the result is
   annualised, label it clearly as a projection from that window, not
   as if it were already a seasonally-representative year. Widening
   the import window later (90 days, a year) is a quality
   improvement, not a blocker.
3. **The result copy carries its own caveats** — a user looking only
   at the £ figure and the line directly under it should already have
   the full picture, without needing to find this document.

## Trust copy (final, wired into OA-8)

Primary result line (current tariff cheaper — the honest "stay put"
outcome):

> Based on your actual electricity use over the last {N} days, your
> current tariff was already cheaper than Agile by **£X** at the unit
> rates available during that period.

Primary result line (Agile would have been cheaper):

> Based on your actual electricity use over the last {N} days, you
> would have spent **£X** less on Agile at the unit rates available
> during that period.

Caveat line, always shown directly under the headline, same weight:

> This is an estimate based on unit rates only. Standing charges
> aren't included yet.

Annualised projection, shown only alongside the above, never alone:

> At the same usage pattern, that's roughly **£Y** a year. Your
> actual annual saving will vary with your usage and electricity
> prices.

This keeps the tone already set on the Landing and Explainer pages
("we won't tell you to switch if switching wouldn't actually help").
