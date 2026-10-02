/**
 * Generic appliance profile model.
 *
 * Consumed by manual scheduling guidance today, and by the automated
 * optimiser later (OA-14) — this module has no vendor-specific logic, so
 * any appliance (device-integrated or not) can be represented the same way.
 */

export type ApplianceType =
  | 'dishwasher'
  | 'washing_machine'
  | 'tumble_dryer'
  | 'dehumidifier'

/**
 * Where a field's value came from, ordered most to least trustworthy.
 * Lower-confidence sources (manufacturer_profile, generic_default) must be
 * surfaced to the user as estimates, never presented as measured fact.
 */
export type DataSource =
  | 'device_reported'
  | 'manufacturer_profile'
  | 'user_confirmed'
  | 'generic_default'

export interface SourcedValue<T> {
  value: T
  source: DataSource
}

export function isEstimate<T>(sourced: SourcedValue<T>): boolean {
  return sourced.source === 'generic_default' || sourced.source === 'manufacturer_profile'
}

export type TimerType = 'none' | 'delay_start' | 'countdown' | 'exact_start' | 'finish_by'

export interface TimerSupport {
  type: TimerType
  /** Smallest schedulable increment, e.g. 30 for half-hour slots. */
  incrementMinutes: number
  supportsExactStart: boolean
  supportsFinishBy: boolean
}

export interface SafetyConstraints {
  /** True if the appliance should not be scheduled to run while the home is unattended/asleep. */
  requiresAwakeHome: boolean
  notes?: string
}

/**
 * Fields reserved for when device integration lands (OA-12/OA-15) — present
 * in the shape now so the optimiser's interface doesn't change later.
 */
export interface FutureCapabilities {
  supportsRemoteStartStop: boolean
  supportsTelemetry: boolean
  resumesAfterPowerLoss: boolean
  plugSuitable: boolean
}

export interface ApplianceProfile {
  id: string
  applianceType: ApplianceType
  label: string
  typicalProgrammeDurationMinutes: SourcedValue<number>
  typicalEnergyPerCycleKwh: SourcedValue<number>
  timer: TimerSupport
  interruptible: SourcedValue<boolean>
  safety: SafetyConstraints
  future: FutureCapabilities
}

const DEFAULT_FUTURE_CAPABILITIES: FutureCapabilities = {
  supportsRemoteStartStop: false,
  supportsTelemetry: false,
  resumesAfterPowerLoss: false,
  plugSuitable: false,
}

/**
 * Generic, non-device-specific defaults (confidence: generic_default).
 * Durations and energy figures are rough UK household averages — replace
 * per-user via manufacturer profile or user confirmation when available.
 */
export const DEFAULT_APPLIANCE_PROFILES: Record<ApplianceType, ApplianceProfile> = {
  dishwasher: {
    id: 'dishwasher',
    applianceType: 'dishwasher',
    label: 'Dishwasher',
    typicalProgrammeDurationMinutes: { value: 150, source: 'generic_default' },
    typicalEnergyPerCycleKwh: { value: 1.1, source: 'generic_default' },
    timer: {
      type: 'delay_start',
      incrementMinutes: 30,
      supportsExactStart: false,
      supportsFinishBy: true,
    },
    interruptible: { value: false, source: 'generic_default' },
    safety: { requiresAwakeHome: false },
    future: DEFAULT_FUTURE_CAPABILITIES,
  },
  washing_machine: {
    id: 'washing_machine',
    applianceType: 'washing_machine',
    label: 'Washing machine',
    typicalProgrammeDurationMinutes: { value: 120, source: 'generic_default' },
    typicalEnergyPerCycleKwh: { value: 0.9, source: 'generic_default' },
    timer: {
      type: 'delay_start',
      incrementMinutes: 30,
      supportsExactStart: false,
      supportsFinishBy: true,
    },
    interruptible: { value: false, source: 'generic_default' },
    safety: {
      requiresAwakeHome: true,
      notes: 'Manufacturers generally advise against unattended washing cycles.',
    },
    future: DEFAULT_FUTURE_CAPABILITIES,
  },
  tumble_dryer: {
    id: 'tumble_dryer',
    applianceType: 'tumble_dryer',
    label: 'Tumble dryer',
    typicalProgrammeDurationMinutes: { value: 90, source: 'generic_default' },
    typicalEnergyPerCycleKwh: { value: 2.5, source: 'generic_default' },
    timer: {
      type: 'delay_start',
      incrementMinutes: 30,
      supportsExactStart: false,
      supportsFinishBy: true,
    },
    interruptible: { value: false, source: 'generic_default' },
    safety: {
      requiresAwakeHome: true,
      notes: 'Fire-risk guidance generally advises against unattended tumble drying.',
    },
    future: DEFAULT_FUTURE_CAPABILITIES,
  },
  dehumidifier: {
    id: 'dehumidifier',
    applianceType: 'dehumidifier',
    label: 'Dehumidifier',
    typicalProgrammeDurationMinutes: { value: 240, source: 'generic_default' },
    typicalEnergyPerCycleKwh: { value: 1.0, source: 'generic_default' },
    timer: {
      type: 'exact_start',
      incrementMinutes: 30,
      supportsExactStart: true,
      supportsFinishBy: false,
    },
    interruptible: { value: true, source: 'generic_default' },
    safety: { requiresAwakeHome: false },
    future: DEFAULT_FUTURE_CAPABILITIES,
  },
}

/**
 * Applies partial, higher-confidence overrides (e.g. user-confirmed values)
 * on top of a base profile. Each overridden field carries its own source,
 * so a profile can end up with a mix of confidence levels per field.
 */
export function mergeApplianceProfile(
  base: ApplianceProfile,
  overrides: Partial<ApplianceProfile>,
): ApplianceProfile {
  return {
    ...base,
    ...overrides,
    timer: { ...base.timer, ...overrides.timer },
    safety: { ...base.safety, ...overrides.safety },
    future: { ...base.future, ...overrides.future },
  }
}

export function getDefaultProfile(applianceType: ApplianceType): ApplianceProfile {
  return DEFAULT_APPLIANCE_PROFILES[applianceType]
}
