/** Formats a pence amount as a GBP string, e.g. 1234 -> "£12.34". Always positive -- sign is the caller's to express in copy. */
export function formatGbp(pence: number): string {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`
}

// OA-46: a single, clearly-labelled illustrative unit -- never a
// user-selectable reward category. The £ amount stays the dominant
// figure; this is a lightweight, approximate add-on underneath it.
const ILLUSTRATIVE_UNIT_PRICE_PENCE = 350
const ILLUSTRATIVE_UNIT_SINGULAR = 'coffee'
const ILLUSTRATIVE_UNIT_PLURAL = 'coffees'

/**
 * Translates a £ amount into "about N coffees", or null when the amount
 * is too small to produce a sensible equivalent (zero, or under one
 * unit) -- showing "about 0 coffees" would just look like a bug.
 */
export function formatSavingsEquivalent(pence: number): string | null {
  if (!Number.isFinite(pence) || pence < ILLUSTRATIVE_UNIT_PRICE_PENCE) return null
  const count = Math.round(pence / ILLUSTRATIVE_UNIT_PRICE_PENCE)
  const unit = count === 1 ? ILLUSTRATIVE_UNIT_SINGULAR : ILLUSTRATIVE_UNIT_PLURAL
  return `about ${count} ${unit}`
}
