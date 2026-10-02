import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPLIANCE_PROFILES,
  getDefaultProfile,
  isEstimate,
  mergeApplianceProfile,
} from './applianceProfile'

describe('DEFAULT_APPLIANCE_PROFILES', () => {
  it('marks every default value as an estimate', () => {
    for (const profile of Object.values(DEFAULT_APPLIANCE_PROFILES)) {
      expect(isEstimate(profile.typicalProgrammeDurationMinutes)).toBe(true)
      expect(isEstimate(profile.typicalEnergyPerCycleKwh)).toBe(true)
      expect(isEstimate(profile.interruptible)).toBe(true)
    }
  })

  it('flags appliances that should not run unattended', () => {
    expect(getDefaultProfile('washing_machine').safety.requiresAwakeHome).toBe(true)
    expect(getDefaultProfile('tumble_dryer').safety.requiresAwakeHome).toBe(true)
    expect(getDefaultProfile('dishwasher').safety.requiresAwakeHome).toBe(false)
  })
})

describe('isEstimate', () => {
  it('treats device-reported and user-confirmed values as non-estimates', () => {
    expect(isEstimate({ value: 1, source: 'device_reported' })).toBe(false)
    expect(isEstimate({ value: 1, source: 'user_confirmed' })).toBe(false)
  })

  it('treats manufacturer and generic defaults as estimates', () => {
    expect(isEstimate({ value: 1, source: 'manufacturer_profile' })).toBe(true)
    expect(isEstimate({ value: 1, source: 'generic_default' })).toBe(true)
  })
})

describe('mergeApplianceProfile', () => {
  it('overrides only the fields provided, preserving the rest', () => {
    const base = getDefaultProfile('dishwasher')
    const merged = mergeApplianceProfile(base, {
      typicalProgrammeDurationMinutes: { value: 135, source: 'user_confirmed' },
    })

    expect(merged.typicalProgrammeDurationMinutes).toEqual({
      value: 135,
      source: 'user_confirmed',
    })
    expect(merged.typicalEnergyPerCycleKwh).toEqual(base.typicalEnergyPerCycleKwh)
    expect(merged.timer).toEqual(base.timer)
  })

  it('shallow-merges nested timer/safety/future objects', () => {
    const base = getDefaultProfile('dehumidifier')
    const merged = mergeApplianceProfile(base, {
      timer: { ...base.timer, incrementMinutes: 15 },
    })

    expect(merged.timer.incrementMinutes).toBe(15)
    expect(merged.timer.type).toBe(base.timer.type)
  })
})
