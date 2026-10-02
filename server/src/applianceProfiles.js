/**
 * OA-81: server-side mirror of src/domain/applianceProfile.ts's canonical
 * appliance model (OA-30). The server stays plain JS (CLAUDE.md), so this
 * duplicates that module's shape and generic-default values rather than
 * importing the TypeScript file directly -- keep the two in sync by hand
 * if either changes; `server/test/householdAppliances.test.js` and
 * `src/domain/applianceProfile.test.ts` both assert against the same
 * numbers as a cross-check.
 */

export const SUPPORTED_APPLIANCE_TYPES = ['dishwasher', 'washing_machine', 'tumble_dryer', 'dehumidifier']

export const DATA_SOURCES = ['device_reported', 'manufacturer_profile', 'user_confirmed', 'generic_default']

/** Generic, non-device-specific defaults -- same numbers as applianceProfile.ts's DEFAULT_APPLIANCE_PROFILES. */
export const DEFAULT_APPLIANCE_PROFILES = {
  dishwasher: {
    label: 'Dishwasher',
    durationMinutes: 150,
    energyKwh: 1.1,
    interruptible: false,
    requiresAwakeHome: false,
  },
  washing_machine: {
    label: 'Washing machine',
    durationMinutes: 120,
    energyKwh: 0.9,
    interruptible: false,
    requiresAwakeHome: true,
  },
  tumble_dryer: {
    label: 'Tumble dryer',
    durationMinutes: 90,
    energyKwh: 2.5,
    interruptible: false,
    requiresAwakeHome: true,
  },
  dehumidifier: {
    label: 'Dehumidifier',
    durationMinutes: 240,
    energyKwh: 1.0,
    interruptible: true,
    requiresAwakeHome: false,
  },
}

/** A household appliance record with every important value at its generic default, source-tagged. */
export function buildDefaultRecord(applianceType) {
  const defaults = DEFAULT_APPLIANCE_PROFILES[applianceType]
  return {
    applianceType,
    enabled: true,
    label: defaults.label,
    brand: null,
    model: null,
    durationMinutes: { value: defaults.durationMinutes, source: 'generic_default' },
    energyKwh: { value: defaults.energyKwh, source: 'generic_default' },
    interruptible: { value: defaults.interruptible, source: 'generic_default' },
    requiresAwakeHome: { value: defaults.requiresAwakeHome, source: 'generic_default' },
  }
}
