import { describe, expect, it } from 'vitest'
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
  clampEventStartSlot,
  ECONOMY_7_OFF_PEAK_SLOT_RANGE,
  isRealHouseholdEvent,
  LANDING_DEMO_DATA_SOURCES,
  LANDING_DEMO_EVENTS,
  OFGEM_PRICE_CAP_STANDING_CHARGE_PENCE_PER_DAY,
  TARIFF_IDS,
  totalEventKwh,
} from './landingDemoFixture'

const DISHWASHER_ID = 'dishwasher'
const WASHING_MACHINE_ID = 'washing_machine'
const TUMBLE_DRYER_ID = 'tumble_dryer'
const DEHUMIDIFIER_ID = 'dehumidifier' // OA-107: broadest window (0-44) -- used below for "any slot" examples.
const OVEN_ID = 'oven_cooking' // OA-107: identified but fixed -- never movable.
const dishwasherDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === DISHWASHER_ID)!
const washingMachineDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === WASHING_MACHINE_ID)!
const tumbleDryerDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === TUMBLE_DRYER_ID)!
const dehumidifierDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === DEHUMIDIFIER_ID)!
const ovenDefinition = LANDING_DEMO_EVENTS.find((e) => e.id === OVEN_ID)!

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
    const fixture = buildLandingDemoFixture({ [DEHUMIDIFIER_ID]: 10 })
    expect(fixture.optimise.totalKwh).toBeCloseTo(fixture.compare.totalKwh, 6)

    const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
    const optimiseKwh = fixture.optimise.day.slots.map((s) => s.kwh)
    const changedIndices = compareKwh.reduce<number[]>((acc, v, i) => {
      if (Math.abs((v ?? 0) - (optimiseKwh[i] ?? 0)) > 1e-9) acc.push(i)
      return acc
    }, [])
    // The dehumidifier leaves its actual slots (20/21/22) and arrives at
    // the requested ones (10/11/12); every other event, untouched, doesn't
    // appear.
    expect(changedIndices.sort((a, b) => a - b)).toEqual([10, 11, 12, 20, 21, 22])
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
    it('moves only the requested event, leaving the other events and baseline/compare untouched', () => {
      const fixture = buildLandingDemoFixture({ [DEHUMIDIFIER_ID]: 10 })
      const compareKwh = fixture.compare.day.slots.map((s) => s.kwh)
      const optimiseKwh = fixture.optimise.day.slots.map((s) => s.kwh)
      const changedIndices = compareKwh.reduce<number[]>((acc, v, i) => {
        if (Math.abs((v ?? 0) - (optimiseKwh[i] ?? 0)) > 1e-9) acc.push(i)
        return acc
      }, [])
      expect(changedIndices.sort((a, b) => a - b)).toEqual([10, 11, 12, 20, 21, 22])
      expect(fixture.baseline.day.slots.map((s) => s.kwh)).toEqual(
        buildLandingDemoFixture().baseline.day.slots.map((s) => s.kwh),
      )
    })

    it('moves events independently when several are requested', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 40, [WASHING_MACHINE_ID]: 30 })
      const dishwasher = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      const washingMachine = fixture.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      expect(dishwasher.currentStartSlot).toBe(40)
      expect(washingMachine.currentStartSlot).toBe(30)
    })

    it('preserves total energy and recomputes the timing saving live as an event moves', () => {
      const moved = buildLandingDemoFixture({ [DEHUMIDIFIER_ID]: 10 })
      expect(moved.optimise.totalKwh).toBeCloseTo(moved.compare.totalKwh, 6)
      expect(moved.timingSavingPence).toBeCloseTo(moved.compare.totalCostPence - moved.optimise.totalCostPence, 6)
      // A different position should generally produce a different (not
      // identical) saving figure, proving the move actually recomputes it.
      expect(moved.timingSavingPence).not.toBeCloseTo(buildLandingDemoFixture().timingSavingPence, 6)
    })

    it('clamps an out-of-range requested start slot to that event\'s own valid same-day window', () => {
      expect(clampEventStartSlot(DEHUMIDIFIER_ID, -5)).toBe(dehumidifierDefinition.validStartSlotRange.min)
      expect(clampEventStartSlot(DEHUMIDIFIER_ID, 1000)).toBe(dehumidifierDefinition.validStartSlotRange.max)
      expect(clampEventStartSlot(DEHUMIDIFIER_ID, 12.4)).toBe(12)
      // The washing machine's own window ends earlier in the day than the
      // dehumidifier's -- clamping is per-event, not a single shared range.
      expect(clampEventStartSlot(WASHING_MACHINE_ID, 1000)).toBe(washingMachineDefinition.validStartSlotRange.max)
      expect(washingMachineDefinition.validStartSlotRange.max).toBeLessThan(dehumidifierDefinition.validStartSlotRange.max)

      const fixtureAtMax = buildLandingDemoFixture({ [DEHUMIDIFIER_ID]: 1000 })
      expect(fixtureAtMax.optimise.day.slots).toHaveLength(48)
    })

    // OA-107: "tumble dryer cannot start before the washing machine
    // finishes" -- a dependent event's effective window tracks the
    // dependency's *current* position, not just its own static window.
    it("narrows the tumble dryer's effective minimum to the washing machine's current end slot", () => {
      expect(clampEventStartSlot(TUMBLE_DRYER_ID, 0)).toBe(
        washingMachineDefinition.actualStartSlot + washingMachineDefinition.slotCount,
      )

      // Move the washing machine later; the dryer, even requested earlier
      // than that, can't start before it now finishes.
      const movedWashingMachineStart = 30
      const currentPositions = { [WASHING_MACHINE_ID]: movedWashingMachineStart }
      expect(clampEventStartSlot(TUMBLE_DRYER_ID, 10, currentPositions)).toBe(
        movedWashingMachineStart + washingMachineDefinition.slotCount,
      )

      const fixture = buildLandingDemoFixture({
        [WASHING_MACHINE_ID]: movedWashingMachineStart,
        [TUMBLE_DRYER_ID]: 10,
      })
      const dryer = fixture.projection.events.find((e) => e.id === TUMBLE_DRYER_ID)!
      expect(dryer.currentStartSlot).toBe(movedWashingMachineStart + washingMachineDefinition.slotCount)
    })

    // OA-107: an identified-but-fixed event (the oven) is still part of the
    // shared event model/projection, but its window is a single slot --
    // its own actual position -- so it never actually moves.
    it('keeps a fixed, non-movable event pinned to its own actual slot', () => {
      expect(ovenDefinition.movable).toBe(false)
      expect(ovenDefinition.validStartSlotRange).toEqual({ min: ovenDefinition.actualStartSlot, max: ovenDefinition.actualStartSlot })
      const fixture = buildLandingDemoFixture({ [OVEN_ID]: 0 })
      const oven = fixture.projection.events.find((e) => e.id === OVEN_ID)!
      expect(oven.currentStartSlot).toBe(ovenDefinition.actualStartSlot)
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
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 40 })
      const event = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      expect(event.occurrencesPerWeek).toBe(dishwasherDefinition.occurrencesPerWeek)
      expect(event.projectedAnnualSavingPence).toBeCloseTo(event.savingPerOccurrencePence * event.occurrencesPerWeek * 52, 6)
      // A naive today x 365 would produce a materially larger figure than
      // the recurrence-based one (365 "cycles" a year vs. 4/week x 52).
      expect(event.projectedAnnualSavingPence).not.toBeCloseTo(event.savingPerOccurrencePence * 365, 0)
    })

    it('derives monthly as annual / 12 for each event, so monthly x 12 always equals the annual figure exactly', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 40 })
      for (const event of fixture.projection.events) {
        expect(event.projectedMonthlySavingPence * 12).toBeCloseTo(event.projectedAnnualSavingPence, 9)
      }
    })

    it('sums the household projection across every household event', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 40, [WASHING_MACHINE_ID]: 20 })
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
      const moved = buildLandingDemoFixture({ [DISHWASHER_ID]: 40 })
      const movedDishwasher = moved.projection.events.find((e) => e.id === DISHWASHER_ID)!
      const movedWashingMachine = moved.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      const defaultWashingMachine = defaultFixture.projection.events.find((e) => e.id === WASHING_MACHINE_ID)!
      expect(movedDishwasher.currentStartSlot).toBe(40)
      expect(moved.projection.projectedAnnualSavingPence).not.toBeCloseTo(defaultFixture.projection.projectedAnnualSavingPence, 0)
      expect(movedWashingMachine.projectedAnnualSavingPence).toBeCloseTo(defaultWashingMachine.projectedAnnualSavingPence, 6)
    })

    it('exposes inspectable per-event detail: id, name, duration, kWh, current/valid window', () => {
      const fixture = buildLandingDemoFixture({ [DISHWASHER_ID]: 40 })
      const event = fixture.projection.events.find((e) => e.id === DISHWASHER_ID)!
      expect(event.label).toBeTruthy()
      expect(event.durationMinutes).toBe(dishwasherDefinition.slotCount * 30)
      expect(event.kwh).toBeGreaterThan(0)
      expect(event.currentStartSlot).toBe(40)
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
        expect(projected.kwh).toBeCloseTo(totalEventKwh(event), 9)
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

    it('rejects an event with any zero or negative kWh shape stage', () => {
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhShape: [0.6, 0, 0.45] })).toBe(false)
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhShape: [0.6, -0.1, 0.45] })).toBe(false)
    })

    it('rejects an event whose shape length does not match its slot count', () => {
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhShape: [0.6, 0.2] })).toBe(false)
      expect(isRealHouseholdEvent({ ...dishwasherDefinition, kwhShape: [0.6, 0.2, 0.45, 0.1] })).toBe(false)
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

  // OA-127: Compare/Optimise can be built against any of the three
  // tariffs, with Baseline always staying on Standard Variable (the
  // reference the tariff-switch saving is measured against).
  describe('tariff selection (OA-127)', () => {
    it('defaults compare/optimise to Agile, unchanged from before this ticket', () => {
      const fixture = buildLandingDemoFixture()
      expect(fixture.compare.tariffName).toBe('Octopus Agile')
      expect(fixture.optimise.tariffName).toBe('Octopus Agile')
    })

    it('keeps baseline on Standard Variable regardless of the selected tariff', () => {
      for (const tariffId of TARIFF_IDS) {
        const fixture = buildLandingDemoFixture({}, tariffId)
        expect(fixture.baseline.tariffName).toBe('Standard Variable')
      }
    })

    it('builds compare/optimise against the selected tariff’s own rates and name', () => {
      const economy7 = buildLandingDemoFixture({}, 'economy-7')
      expect(economy7.compare.tariffName).toBe('Octopus Economy 7')
      expect(economy7.optimise.tariffName).toBe('Octopus Economy 7')

      const standardVariable = buildLandingDemoFixture({}, 'standard-variable')
      expect(standardVariable.compare.tariffName).toBe('Standard Variable')
      // Standard Variable is flat, same rate baseline uses -- so, with
      // identical usage (no event moved), compare/baseline costs match
      // exactly and there is no tariff-switch saving.
      expect(standardVariable.compare.totalCostPence).toBeCloseTo(standardVariable.baseline.totalCostPence, 6)
      expect(standardVariable.tariffSwitchSavingPence).toBeCloseTo(0, 6)
    })

    it('still keeps optimise on the exact same tariff/rates as compare, for every tariff', () => {
      for (const tariffId of TARIFF_IDS) {
        const fixture = buildLandingDemoFixture({}, tariffId)
        expect(fixture.optimise.tariffName).toBe(fixture.compare.tariffName)
        expect(fixture.optimise.day.slots.map((s) => s.unitRateIncVatPence)).toEqual(
          fixture.compare.day.slots.map((s) => s.unitRateIncVatPence),
        )
      }
    })

    it('represents Economy 7 as exactly two distinct rates -- one day price, one night price -- never a 48-rate Agile-style tariff', () => {
      const fixture = buildLandingDemoFixture({}, 'economy-7')
      const rates = fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
      const distinctRates = new Set(rates)
      expect(distinctRates.size).toBe(2)
    })

    it('prices every Economy 7 off-peak slot (and only those) at the cheaper night rate', () => {
      const fixture = buildLandingDemoFixture({}, 'economy-7')
      const rates = fixture.compare.day.slots.map((s) => s.unitRateIncVatPence ?? 0)
      const nightRate = Math.min(...rates)
      const dayRate = Math.max(...rates)
      expect(nightRate).toBeLessThan(dayRate)
      rates.forEach((rate, slot) => {
        const isOffPeak = slot >= ECONOMY_7_OFF_PEAK_SLOT_RANGE.min && slot <= ECONOMY_7_OFF_PEAK_SLOT_RANGE.max
        expect(rate).toBe(isOffPeak ? nightRate : dayRate)
      })
      // "the fixed off-peak period is 00:30-07:30 UTC, which becomes
      // 01:30-08:30 during BST" -- a 7-hour window, i.e. 14 half-hour slots.
      expect(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max - ECONOMY_7_OFF_PEAK_SLOT_RANGE.min + 1).toBe(14)
    })

    it('optimises a broadly-flexible event (dehumidifier) into the Economy 7 off-peak window', () => {
      const best = cheapestStartSlotForEvent('dehumidifier', {}, 'economy-7')
      const dehumidifierSlotCount = dehumidifierDefinition.slotCount
      expect(best).toBeGreaterThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.min)
      expect(best + dehumidifierSlotCount - 1).toBeLessThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max)
    })

    it('defaults cheapestStartSlotForEvent to Agile when no tariff is given, unchanged from before this ticket', () => {
      expect(cheapestStartSlotForEvent('dehumidifier')).toBe(cheapestStartSlotForEvent('dehumidifier', {}, 'agile'))
    })

    // OA-165: the washing machine and dishwasher previously had
    // daytime-only/evening-only windows authored before Economy 7 existed,
    // so "Optimise" could never move them into its overnight off-peak
    // window even though doing so is genuinely cheaper -- this is the bug
    // the ticket fixes.
    it('optimises the washing machine into the Economy 7 off-peak window', () => {
      const best = cheapestStartSlotForEvent(WASHING_MACHINE_ID, {}, 'economy-7')
      expect(best).toBeGreaterThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.min)
      expect(best + washingMachineDefinition.slotCount - 1).toBeLessThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max)
    })

    it('optimises the dishwasher into the Economy 7 off-peak window', () => {
      const best = cheapestStartSlotForEvent(DISHWASHER_ID, {}, 'economy-7')
      expect(best).toBeGreaterThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.min)
      expect(best + dishwasherDefinition.slotCount - 1).toBeLessThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max)
    })

    // OA-165: the tumble dryer must never be scheduled to run unattended
    // overnight (fire-risk guidance) -- its own static window floor
    // (08:30) enforces this regardless of tariff or of the washing
    // machine moving earlier under Economy 7.
    it('never optimises the tumble dryer into the Economy 7 off-peak window, even once the washing machine moves earlier', () => {
      const washingMachineBest = cheapestStartSlotForEvent(WASHING_MACHINE_ID, {}, 'economy-7')
      expect(washingMachineBest).toBeLessThanOrEqual(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max) // sanity check: it did move overnight

      const dryerBest = cheapestStartSlotForEvent(
        TUMBLE_DRYER_ID,
        { [WASHING_MACHINE_ID]: washingMachineBest },
        'economy-7',
      )
      expect(dryerBest).toBe(tumbleDryerDefinition.validStartSlotRange.min)
      expect(dryerBest).toBeGreaterThan(ECONOMY_7_OFF_PEAK_SLOT_RANGE.max)
    })
  })
})

// OA-146: "daily, monthly and annual figures derive from a single
// canonical saving basis... figures reconcile after rounding." A tariff's
// per-day rate difference genuinely recurs every day of the year, so
// `annualDifferencePence` is modelled as a straight x365 of the daily
// figure -- but it must be x365 of the same (penny-rounded) daily figure
// the UI actually displays, not the unrounded one, or the two can
// disagree by whole pounds once each is rounded again for its own display
// (e.g. 14.22p/day rounds to "14p" on its own, but 14.22p x 365 rounds to
// "£51.90" -- not the £51.10 that "14p" x 365 actually is).
describe('tariffComparison annual/daily reconciliation (OA-146)', () => {
  it('derives every annualDifferencePence as exactly the penny-rounded daily figure x365, for every tariff and comparison basis', () => {
    for (const currentTariffId of TARIFF_IDS) {
      const fixture = buildLandingDemoFixture({}, 'agile', currentTariffId)
      for (const entry of fixture.tariffComparison) {
        const roundedDailyPence = Math.round(entry.differencePenceVsCurrentTariffPence)
        expect(entry.annualDifferencePence).toBe(roundedDailyPence * 365)
      }
    }
  })

  it('never produces an annual figure whose own /365 rounds back to a different penny figure than the displayed daily one', () => {
    const fixture = buildLandingDemoFixture({}, 'agile', 'standard-variable')
    for (const entry of fixture.tariffComparison) {
      const displayedDailyPence = Math.round(Math.abs(entry.differencePenceVsCurrentTariffPence))
      const impliedDailyFromAnnual = Math.round(Math.abs(entry.annualDifferencePence) / 365)
      expect(impliedDailyFromAnnual).toBe(displayedDailyPence)
    }
  })
})

// OA-146: the Optimise stage's monthly figure must reconcile with the
// dominant annual headline it sits beneath -- both now derive from the
// same `projectedAnnualSavingPence` (monthly = annual/12, already how
// `buildEventProjection` computes it; this just locks that in at the
// fixture's top level too).
describe('projection monthly/annual reconciliation (OA-146)', () => {
  it('derives projectedMonthlySavingPence as exactly projectedAnnualSavingPence/12', () => {
    const fixture = buildLandingDemoFixture(
      Object.fromEntries(LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent).map((e) => [e.id, e.actualStartSlot])),
      'agile',
      'standard-variable',
    )
    expect(fixture.projection.projectedMonthlySavingPence * 12).toBeCloseTo(fixture.projection.projectedAnnualSavingPence, 9)
  })
})
