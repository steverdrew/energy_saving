import { describe, expect, it } from 'vitest'
import { formatGbp, formatSavingsEquivalent } from './format'

describe('formatGbp', () => {
  it('formats pence as a GBP string', () => {
    expect(formatGbp(1234)).toBe('£12.34')
  })

  it('always formats positively regardless of sign', () => {
    expect(formatGbp(-500)).toBe('£5.00')
  })
})

describe('formatSavingsEquivalent', () => {
  it('returns a plural equivalent for a typical amount', () => {
    expect(formatSavingsEquivalent(6340)).toBe('about 18 coffees')
  })

  it('returns a singular equivalent for exactly one unit', () => {
    expect(formatSavingsEquivalent(350)).toBe('about 1 coffee')
  })

  it('returns null for zero', () => {
    expect(formatSavingsEquivalent(0)).toBe(null)
  })

  it('returns null for an amount under one unit', () => {
    expect(formatSavingsEquivalent(100)).toBe(null)
  })
})
