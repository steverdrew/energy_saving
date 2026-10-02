/** Formats a pence amount as a GBP string, e.g. 1234 -> "£12.34". Always positive -- sign is the caller's to express in copy. */
export function formatGbp(pence: number): string {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`
}
