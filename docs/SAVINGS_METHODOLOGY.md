# Savings methodology (OA-21)

Draft for Steve's sign-off. Nothing in this document is live in the
product yet — no £ savings claim is shown to a user until this is
agreed and OA-22/OA-8 are built against it. See `HANDOFF.md` for the
engineering status this gates.

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

## Trust copy (draft, for wherever a result is shown)

Short form, for use near any £ figure:

> Based on your own actual usage over the last 30 days, compared
> against real Octopus Agile prices for the same period. Unit rates
> only — doesn't include the standing charge. Past usage, not a
> promise about the future.

Longer form, for an explainer/FAQ-style page:

> We take your real half-hourly usage from your connected account and
> ask what it would have cost on Octopus Agile instead of your current
> tariff, using Agile's actual published prices for the same days. We
> only compare unit rates, not the standing charge, and we only look
> at the period we've imported so far — so this is a look back at what
> already happened, not a forecast. If your current tariff would have
> been cheaper, we'll say so.

This keeps the tone already set on the Landing and Explainer pages
("we won't tell you to switch if switching wouldn't actually help").

## Open questions for Steve

1. Is unit-rate-only (no standing charge) acceptable for the first
   result screen, with the caveat shown, or does OA-8 need standing
   charges included before anyone sees a number?
2. Is a 30-day window enough to show a first result, or should OA-8
   wait until a longer import window is implemented?
3. Any wording changes to the trust copy above before it's wired into
   the UI?
