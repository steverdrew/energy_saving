import { describe, expect, it } from 'vitest'
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
  clampEventStartSlot,
  isRealHouseholdEvent,
  LANDING_DEMO_DATA_SOURCES,
  LANDING_DEMO_EVENTS,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
} from './landingDemoFixture'

const DISHWASHER_ID = 'dishwasher'
const WASHING_MACHINE_ID = 'washing_machine'
const dishwasherDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === DISHWASHER_ID)!
const washingMachineDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === WASHING_MACHINE_ID)!

describe('buildLandingDemoFixture', () => {
  it('produces 48 half-hourly slots for every step', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.baseline.day.slots).toHaveLength(48)
    expect(fixture.compare.day.slots).toHaveLength(48)
    expect(fixture.optimise.day.slots).toHaveLength(48)
  })

  it('keeps usage identical between baseline and compare -- only the tariff changes', () => {
    const fixture = buildLandingDemoFixture()
    const baselineKwh = fixture.baseline.day.slots.map((s) => s.kwh)
    const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
    expect(compareKwh).toEqual(baselineKwh)
    expect(fixture.baseline.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)
  })

  // OA-105: "no event appears for the first time on Tab 3" -- with no
  // event moved, Optimise starts identical to Compare (both show every
  // event at its actual position).
  it('starts optimise identical to compare when no event has been moved', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.optimise.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)
    expect(fixture.optimise.day.slots.map((s) => s.kwh)).toEqual(fixture.compare.day.slots.map((s) => s.kwh))
    expect(fixture.timingSavingPence).toBeCloseTo(0, 6)
  })

  it('preserves total energy between compare and optimise, only moving the requested event', () => {
    const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 10 })
    expect(fixture.optimise.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)

    const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
    const optimiseKwh = fixture.optimise.day.slots.map((s) => s.kwh)
    const changedIndices = compareKwh.reduce<number[]>((acc, v, i) => {
      if (Math.abs((v ?? 0) - (optimiseKwh[i] ?? 0)) > 1e-9) acc.push(i)
      return acc
    }, [])
    // Dishwasher leaves its actual slots (36/37) and arrives at the
    // requested ones (10/11); the washing machine, untouched, doesn't appear.
    expect(changedIndices.sort((a, b) => a - b)).toEqual([10, 11, 36, 37])
  })

  it('keeps optimise on the same tariff (rates) as compare', () => {
    const fixture = buildLandingDemoFixture()
    const compareRates = fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
    const optimiseRates = fixture.optimise.day.slots.map((s) => s.unitRateIncVatPence)
    expect(optimiseRates).toEqual(compareRates)
    expect(fixture.optimise.tariffName).toBe(fixture.compare.tariffName)
  })

  it('computes each step total cost as the sum of kwh times rate', () => {
    const fixture = buildLandingDemoFixture()
    for (const step of [fixture.baseline, fixture.compare, fixture.optimise]) {
      const expected = step.day.slots.reduce((sum, s) => sum + (s.kwh ?? 0) * (s.unitRateIncVatPence ?? 0), 0)
      expect(step.totalCostPence).toBeCloseTo(expected, 6)
    }
  })

  it('derives the tariff-switch and timing savings from the step costs', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.tariffSwitchSavingPence).toBeCloseTo(fixture.baseline.totalCostPence - fixture.compare.totalCostPence, 6)
    expect(fixture.timingSavingPence).toBeCloseTo(fixture.compare.totalCostPence - fixture.optimise.totalCostPence, 6)
  })

  it('builds a multi-day landscape (OA-85) ending on the same day as the headline `day`', () => {
    const fixture = buildLandingDemoFixture()
    for (const step of [fixture.baseline, fixture.compare, fixture.optimise]) {
      expect(step.days).toHaveLength(4)
      expect(step.days.every((d) => d.slots.length === 48)).toBe(true)
      expect(step.days[step.days.length - 1]).toEqual(step.day)
      // Dates are distinct and in order.
      expect(step.days.map((d) => d.date)).toEqual([...step.days.map((d) => d.date)].sort())
      expect(new Set(step.days.map((d) => d.date)).size).toBe(4)
    }
  })

  // OA-99: grounded in published Ofgem/Elexon/Octopus data rather than
  // invented numbers.
  it('scales baseline usage to the Ofgem medium TDCV annual-average day (2,500 kWh/year)', () => {
    const fixture = buildLandingDemoFixture()
    expect(fixture.baseline.totalKwh).toBeCloseTo(2500 / 365, 2)
  })

  it('uses the Ofgem price-cap average Direct Debit unit rate as a flat Standard Variable rate', () => {
    const fixture = buildLandingDemoFixture()
    const rates = fixture.baseline.day.slots.map((s) => s.unitRateIncVatPence)
    expect(new Set(rates)).toEqual(new Set([26.32]))
  })

  it('exposes the standing charge as a separate, documented figure never folded into usage cost', () => {
    expect(OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY).toBe(54.83)
  })

  it('keeps provenance metadata alongside the fixture, testable and inspectable', () => {
    expect(LANDING_DEMO_DATA_SOURCES.annualKwhSource).toMatch(/2,500 kWh\/year/)
    expect(LANDING_DEMO_DATA_SOURCES.tariffRegion).toBe('C (London)')
    expect(LANDING_DEMO_DATA_SOURCES.tariffDateRange).toMatch(/2025-10-01.*2026-09-30/)
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemTdcv).toContain('ofgem.gov.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.ofgemPriceCap).toContain('ofgem.gov.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.elexonProfiling).toContain('elexon.co.uk')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.octopusAgileApi).toContain('octopus.energy')
    expect(LANDING_DEMO_DATA_SOURCES.sourceUrls.octopusAgilePricing).toContain('octopus.energy')
    expect(LANDING_DEMO_DATA_SOURCES.fixtureVersion).toBeTruthy()
    expect(LANDING_DEMO_DATA_SOURCES.fixtureBuiltAt).toBeTruthy()
  })

  // OA-99 (second pass): a representative Agile day derived from real
  // published rates by median-per-slot aggregation, not a single
  // cherry-picked historical date.
  it('builds the representative Agile day from 48 distinct median rates, not a 3-band tariff', () => {
    expect(LANDING_DEMO_DATA_SOURCES.representativeRates48).toHaveLength(48)
    expect(new Set(LANDING_DEMO_DATA_SOURCES.representativeRates48).size).toBeGreaterThan(40)
    expect(LANDING_DEMO_DATA_SOURCES.aggregationMethod).toMatch(/median/i)
  })

  it('documents the real observed rate range (including negatives) even though the representative medians have none', () => {
    expect(LANDING_DEMO_DATA_SOURCES.observedRateRangePence.min).toBeLessThan(0)
    expect(LANDING_DEMO_DATA_SOURCES.observedRateRangePence.max).toBeLessThan(100) // within the £1/kWh cap
    expect(LANDING_DEMO_DATA_SOURCES.negativeRateObservationCount).toBeGreaterThan(0)
    expect(LANDING_DEMO_DATA_SOURCES.representativeRates48.every((rate) => rate >= 0)).toBe(true)
  })

  it("keeps the Compare tariff's rates identical to the fixture's published representativeRates48", () => {
    const fixture = buildLandingDemoFixture()
    const compareRates = fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
    expect(compareRates).toEqual(LANDING_DEMO_DATA_SOURCES.representativeRates48)
  })

  // OA-103/105: each household event is independently movable on the
  // Optimise step -- the caller picks the slot it starts at per event id,
  // and only that event's own slots change.
  describe('movable household events (OA-103/105)', () => {
    it('moves only the requested event, leaving the other event and baseline/compare untouched', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 20 })
      const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
      const optimiseKwh = fixture.optimise.day.slots.map((s) => s.kwh)
      const changedIndices = compareKwh.reduce<number[]>((acc, v, i) => {
        if (Math.abs((v ?? 0) - (optimiseKwh[i] ?? 0)) > 1e-9) acc.push(i)
        return acc
      }, [])
      expect(changedIndices.sort((a, b) => a - b)).toEqual([20, 21, 36, 37])
      expect(fixture.baseline.day.slots.map((s) => s.kwh)).toEqual(
        buildLandingDemoFixture().baseline.day.slots.map((s) => s.kwh),
      )
    })

    it('moves both events independently when both are requested', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 20, [WASHING_MACHINE_ID]: 30 })
      const dishwasher = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      const washingMachine = fixture.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      expect(dishwasher.currentStartSlot).toBe(20)
      expect(washingMachine.currentStartSlot).toBe(30)
    })

    it('preserves total energy and recomputes the timing saving live as an event moves', () => {
      const moved = buildLandingDemoFixture({ [DISHWASHER_ID]: 20 })
      expect(moved.optimise.totalKwh).toBeCloseTo(moved.compare.totalKwh, 6)
      expect(moved.timingSavingPence).toBeCloseTo(moved.compare.totalCostPence - moved.optimise.totalCostPence, 6)
      // A different position should generally produce a different (not
      // identical) saving figure, proving the move actually recomputes it.
      expect(moved.timingSavingPence).not.toBeCloseTo(buildLandingDemoFixture().timingSavingPence, 6)
    })

    it('clamps an out-of-range requested start slot to that event\'s own valid same-day window', () => {
      expect(clampEventStartSlot(DISHWASHER_ID, -5)).toBe(dishwasherDefinition.validStartSlotRange.min)
      expect(clampEventStartSlot(DISHWASHER_ID, 1000)).toBe(dishwasherDefinition.validStartSlotRange.max)
      expect(clampEventStartSlot(DISHWASHER_ID, 12.4)).toBe(12)
      // The washing machine's requiresAwakeHome window is narrower --
      // clamping is per-event, not a single shared range.
      expect(clampEventStartSlot(WASHING_MACHINE_ID, 0)).toBe(washingMachineDefinition.validStartSlotRange.min)
      expect(washingMachineDefinition.validStartSlotRange.min).toBeGreaterThan(dishwasherDefinition.validStartSlotRange.min)

      const fixtureAtMax = buildLandingDemoFixture({ [DISHWASHER_ID]: 1000 })
      expect(fixtureAtMax.optimise.day.slots).toHaveLength(48)
    })

    it('defaults every event to its own actual start slot when nothing is requested', () => {
      const defaulted = buildLandingDemoFixture()
      for (const event of LANDING_DEMO_EVENTS) {
        const projected = defaulted.projection.events.find((e) => e.id === event.id)!
        expect(projected.currentStartSlot).toBe(event.actualStartSlot)
      }
    })

    it('keeps every event\'s valid window wide enough for it to always fit in the 48-slot day', () => {
      for (const event of LANDING_DEMO_EVENTS) {
        expect(event.validStartSlotRange.max + event.slotCount).toBeLessThanOrEqual(48)
        expect(event.validStartSlotRange.min).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // OA-104/105: monthly/annual projections, derived from each event's own
  // explicit, documented recurrence assumption -- never today's saving x 365.
  describe('monthly/annual projection (OA-104/105)', () => {
    it('derives each event\'s annual projection from its own saving per occurrence and documented weekly frequency, not from today x 365', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 10 })
      const event = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      expect(event.occurrencesPerWeek).toBe(dishwasherDefinition.occurrencesPerWeek)
      expect(event.projectedAnnualSavingPence).toBeCloseTo(event.savingPerOccurrencePence * event.occurrencesPerWeek * 52, 6)
      // A naive today x 365 would produce a materially larger figure than
      // the recurrence-based one (365 "cycles" a year vs. 4/week x 52).
      expect(event.projectedAnnualSavingPence).not.toBeCloseTo(event.savingPerOccurrencePence * 365, 0)
    })

    it('derives monthly as annual / 12 for each event, so monthly x 12 always equals the annual figure exactly', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 10 })
      for (const event of fixture.projection.events) {
        expect(event.projectedMonthlySavingPence * 12).toBeCloseTo(event.projectedAnnualSavingPence, 9)
      }
    })

    it('sums the household projection across every household event', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 10, [WASHING_MACHINE_ID]: 20 })
      expect(fixture.projection.events).toHaveLength(LANDING_DEMO_EVENTS.length)
      expect(fixture.projection.dailyPotentialSavingPence).toBeCloseTo(fixture.timingSavingPence, 6)
      expect(fixture.projection.dailyPotentialSavingPence).toBeCloseTo(
        fixture.projection.events.reduce((sum, e) => sum + e.savingPerOccurrencePence, 0),
        6,
      )
      expect(fixture.projection.projectedAnnualSavingPence).toBeCloseTo(
        fixture.projection.events.reduce((sum, e) => sum + e.projectedAnnualSavingPence, 0),
        6,
      )
      expect(fixture.projection.projectedMonthlySavingPence).toBeCloseTo(
        fixture.projection.events.reduce((sum, e) => sum + e.projectedMonthlySavingPence, 0),
        6,
      )
    })

    it('recomputes one event\'s projection live as it moves, without disturbing the other event\'s projection', () => {
      const defaultFixture = buildLandingDemoFixture()
      const moved = buildLandingDemoFixture({ [DISHWASHER_ID]: 33 })
      const movedDishwasher = moved.projection.events.find((e) => e.id === DISHWASHER_ID)!
      const movedWashingMachine = moved.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      const defaultWashingMachine = defaultFixture.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      expect(movedDishwasher.currentStartSlot).toBe(33)
      expect(moved.projection.projectedAnnualSavingPence).not.toBeCloseTo(defaultFixture.projection.projectedAnnualSavingPence, 0)
      expect(movedWashingMachine.projectedAnnualSavingPence).toBeCloseTo(defaultWashingMachine.projectedAnnualSavingPence, 6)
    })

    it('exposes inspectable per-event detail: id, name, duration, kWh, current/valid window', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 10 })
      const event = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      expect(event.label).toBeTruthy()
      expect(event.durationMinutes).toBe(dishwasherDefinition.slotCount * 30)
      expect(event.kwh).toBeGreaterThan(0)
      expect(event.currentStartSlot).toBe(10)
      expect(event.validStartSlotRange).toEqual(dishwasherDefinition.validStartSlotRange)
    })
  })

  // OA-106: "Optimise all" needs each event's own cheapest valid slot,
  // under the same rates/window a manual drag uses.
  describe('cheapestStartSlotForEvent (OA-106)', () => {
    it("returns a slot within the event's own valid window", () => {
      for (const event of LANDING_DEMO_EVENTS) {
        const slot = cheapestStartSlotForEvent(event.id)
        expect(slot).toBeGreaterThanOrEqual(event.validStartSlotRange.min)
        expect(slot).toBeLessThanOrEqual(event.validStartSlotRange.max)
      }
    })

    it('is actually the cheapest -- no other valid slot costs less', () => {
      for (const event of LANDING_DEMO_EVENTS) {
        const best = cheapestStartSlotForEvent(event.id)
        const bestFixture = buildLandingDemoFixture({ [event.id]: best })
        const bestEvent = bestFixture.projection.events.find((e) => e.id === event.id)!
        for (let slot = event.validStartSlotRange.min; slot <= event.validStartSlotRange.max; slot++) {
          const candidateFixture = buildLandingDemoFixture({ [event.id]: slot })
          const candidateEvent = candidateFixture.projection.events.find((e) => e.id === event.id)!
          // "Saving" is cost avoided vs. the actual slot -- the cheapest
          // slot must have a saving at least as large as every other slot.
          expect(bestEvent.savingPerOccurrencePence).toBeGreaterThanOrEqual(
            candidateEvent.savingPerOccurrencePence - 1e-9,
          )
        }
      }
    })

    it('moving every event to its cheapest slot preserves each event\'s duration and total kWh', () => {
      for (const event of LANDING_DEMO_EVENTS) {
        const slot = cheapestStartSlotForEvent(event.id)
        const fixture = buildLandingDemoFixture({ [event.id]: slot })
        const projected = fixture.projection.events.find((e) => e.id === event.id)!
        expect(projected.kwh).toBeCloseTo(event.kwhPerSlot * event.slotCount, 9)
        expect(projected.durationMinutes).toBe(event.slotCount * 30)
      }
    })
  })

  // OA-106: "an event overlay must never appear unless it corresponds to a
  // real modelled load" -- the guard shared by LandingDemo.tsx/
  // LandingTimeProfile.tsx.
  describe('isRealHouseholdEvent (OA-106)', () => {
    it('accepts every real shared household event', () => {
      for (const event of LANDING_DEMO_EVENTS) {
        expect(isRealHouseholdEvent(event)).toBe(true)
      }
    })

    it('rejects an event with zero or negative kWh per slot', () => {
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhPerSlot: 0 })).toBe(false)
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhPerSlot: -0.1 })).toBe(false)
    })

    it('rejects an event with zero or negative slot count', () => {
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, slotCount: 0 })).toBe(false)
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, slotCount: -1 })).toBe(false)
    })

    it('rejects an event with a blank id or label', () => {
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, id: '' })).toBe(false)
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, label: '   ' })).toBe(false)
    })
  })

  it('places the representative day’s structural 16:00-19:00 peak window above its surrounding rates', () => {
    const peakSlots = LANDING_DEMO_DATA_SOURCES.representativeRates48.slice(32, 38) // 16:00-19:00
    const offPeakSlots = [
      ...LANDING_DEMO_DATA_SOURCES.representativeRates48.slice(0, 32),
      ...LANDING_DEMO_DATA_SOURCES.representativeRates48.slice(38),
    ]
    const minPeak = Math.min(...peakSlots)
    const maxOffPeak = Math.max(...offPeakSlots)
    expect(minPeak).toBeGreaterThan(maxOffPeak)
  })
})
