import { describe, expect, it } from 'vitest'
import { assumptionsByConfidence, getAssumption, requireVerifiedOrPlausible, SAVINGS_MODEL_ASSUMPTIONS } from './assumptions'

describe('SAVINGS_MODEL_ASSUMPTIONS', () => {
  it('gives every assumption a non-empty source, sourceDate, confidence and modelVersion', () => {
    for (const assumption of SAVINGS_MODEL_ASSUMPTIONS) {
      expect(assumption.source.trim().length).toBeGreaterThan(0)
      expect(assumption.sourceDate.trim().length).toBeGreaterThan(0)
      expect(['verified', 'plausible', 'illustrative', 'rejected']).toContain(assumption.confidence)
      expect(assumption.modelVersion.trim().length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate assumption ids', () => {
    const ids = SAVINGS_MODEL_ASSUMPTIONS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getAssumption', () => {
  it('finds a known assumption by id', () => {
    expect(getAssumption('ofgem-tdcv-electricity-medium').value).toBe(2500)
  })

  it('throws for an unknown id', () => {
    expect(() => getAssumption('not-a-real-id')).toThrow('Unknown savings-model assumption id')
  })
})

describe('requireVerifiedOrPlausible', () => {
  it('returns a verified assumption', () => {
    expect(requireVerifiedOrPlausible('ofgem-tdcv-electricity-medium').confidence).toBe('verified')
  })

  it('returns a plausible assumption', () => {
    expect(requireVerifiedOrPlausible('est-standby-annual-cost-range').confidence).toBe('plausible')
  })

  it('throws if there is ever an illustrative or rejected assumption used as a constant', () => {
    // Guards the invariant itself, not a specific id -- if OA-119 ever adds
    // an illustrative/rejected entry, this proves the guard still rejects it.
    const illustrative = SAVINGS_MODEL_ASSUMPTIONS.find((a) => a.confidence === 'illustrative' || a.confidence === 'rejected')
    if (illustrative) {
      expect(() => requireVerifiedOrPlausible(illustrative.id)).toThrow(/cannot back a model-critical/)
    } else {
      expect(illustrative).toBeUndefined()
    }
  })
})

describe('assumptionsByConfidence', () => {
  it('filters to only the requested confidence level', () => {
    const plausible = assumptionsByConfidence('plausible')
    expect(plausible.length).toBeGreaterThan(0)
    expect(plausible.every((a) => a.confidence === 'plausible')).toBe(true)
  })
})
