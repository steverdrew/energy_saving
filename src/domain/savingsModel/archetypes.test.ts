import { describe, expect, it } from 'vitest'
import { getArchetype, HOUSEHOLD_ARCHETYPES, isRealApplianceEvent } from './archetypes'
import { totalEventKwh } from '../applianceEvents'

describe('HOUSEHOLD_ARCHETYPES', () => {
  it('has no duplicate archetype ids', () => {
    const ids = HOUSEHOLD_ARCHETYPES.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every archetype a positive annual kWh total', () => {
    for (const archetype of HOUSEHOLD_ARCHETYPES) {
      expect(archetype.annualKwh).toBeGreaterThan(0)
    }
  })

  it('keeps every event kWh below its archetype\'s daily total, leaving room for base load', () => {
    for (const archetype of HOUSEHOLD_ARCHETYPES) {
      const eventKwh = archetype.events.reduce((sum, e) => sum + totalEventKwh(e), 0)
      expect(eventKwh).toBeLessThan(archetype.annualKwh / 365)
    }
  })

  it('includes at least one EV-owning and one non-EV archetype', () => {
    expect(HOUSEHOLD_ARCHETYPES.some((a) => a.hasEv)).toBe(true)
    expect(HOUSEHOLD_ARCHETYPES.some((a) => !a.hasEv)).toBe(true)
  })

  it('has exactly the five OA-120 archetypes, including the high-use non-EV household', () => {
    const ids = HOUSEHOLD_ARCHETYPES.map((a) => a.id)
    expect(ids).toEqual(['single-occupant-flat', 'family-typical', 'family-large', 'ev-owning-family', 'high-use-non-ev'])
  })

  it('only marks an event movable=false when it has a single-slot (fixed) valid window', () => {
    for (const archetype of HOUSEHOLD_ARCHETYPES) {
      for (const event of archetype.events) {
        if (!event.movable) {
          expect(event.validStartSlotRange.min).toBe(event.validStartSlotRange.max)
        }
      }
    }
  })
})

describe('getArchetype', () => {
  it('finds a known archetype', () => {
    expect(getArchetype('family-typical').label).toBe('Family household (typical)')
  })

  it('throws for an unknown id', () => {
    expect(() => getArchetype('not-a-real-archetype')).toThrow('Unknown household archetype id')
  })
})

describe('isRealApplianceEvent', () => {
  it('accepts a well-formed event', () => {
    const event = getArchetype('family-typical').events[0]
    expect(isRealApplianceEvent(event)).toBe(true)
  })

  it('rejects a zero-energy event', () => {
    const base = getArchetype('family-typical').events[0]
    const event = { ...base, kwhShape: base.kwhShape.map(() => 0) }
    expect(isRealApplianceEvent(event)).toBe(false)
  })
})
