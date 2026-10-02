// The only module in the web app allowed to call the server. No provider
// credentials or secrets belong here — see the bundle check script.
//
// Sign-in is handled by Firebase Auth (see src/auth/AuthContext.tsx), not
// this client — the server's own auth routes (server/src/auth.js) are
// unused by the web app as of OA-50. Requests to protected endpoints carry
// the current Firebase user's ID token as a bearer token instead; the
// server verifies it itself (server/src/firebaseAuth.js).
import { auth } from '../firebase'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'Not signed in')
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

// OA-56: the compatibility-request form is usable by a signed-out landing
// page visitor as well as a signed-in app user -- unlike authHeaders(),
// this never throws; it just omits the header when nobody is signed in.
async function optionalAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const headers = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  })

  if (res.status === 204) return null

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? 'Something went wrong')
  }
  return body as T
}

export interface OctopusMeterContext {
  mpan: string | null
  tariffCode: string | null
}

export interface OctopusConnection {
  connected: boolean
  accountNumberRedacted?: string
  meterContext?: OctopusMeterContext | null
  connectedAt?: string
}

// OA-63: zero readings and zero rates is never "success" -- status makes
// the real outcome explicit instead of inferring it from counts in the
// UI. 'not_imported': no import has run yet. 'success': usable data for
// both. 'no_data': Octopus returned nothing usable for either (no
// "covering X to Y" claim in that case -- periodFrom/periodTo are
// omitted). 'partial': one of readings/rates came back, the other didn't.
export type OctopusImportResultStatus = 'not_imported' | 'success' | 'no_data' | 'partial'

export interface OctopusImportStatus {
  imported: boolean
  status: OctopusImportResultStatus
  periodFrom?: string
  periodTo?: string
  consumptionPoints?: number
  ratePoints?: number
  importedAt?: string
}

// OA-45/OA-25: where the customer is starting from, and how confidently
// the comparison can represent it. 'intelligent_go' is the only family
// whose comparisonMethod is 'bounded_estimate' today -- its dynamically
// assigned bonus smart-charge windows can't be reconstructed from public
// rates, so a comparison only covers the guaranteed published windows.
// 'unknown' never falls back to 'flexible'/'fixed' by guessing -- see
// server/src/tariffClassification.js (OA-68/OA-69), the one canonical
// place a raw tariff code becomes this shape.
export interface TariffState {
  family: 'agile' | 'go' | 'intelligent_go' | 'outgoing' | 'dual_rate' | 'flexible' | 'fixed' | 'unknown'
  rateShape: 'flat' | 'time_of_use' | 'dynamic_half_hourly' | 'smart_personalised' | 'dual_rate' | 'export' | 'unknown'
  displayName: string | null
  comparisonMethod: 'exact' | 'bounded_estimate' | 'unavailable'
  raw: string | null
  recentlySwitched: boolean
  daysSinceSwitch: number | null
}

// OA-24: eligibility for the tariff being shown as the comparison --
// never inferred from price alone. 'eligible' is the only status Agile
// can produce; the others exist for tariffs this app doesn't compare
// against yet.
export interface TariffEligibility {
  status: 'eligible' | 'scenario_only' | 'cannot_determine'
  requirement: string | null
}

// OA-23/OA-7: the second, separate layer from tariff-fit -- what moving
// one appliance cycle to the cheapest slot within the imported historical
// period would have cost, vs. that period's average rate on the tariff
// the saving is quoted against. Always projected/estimated, never summed
// into estimatedSavingPence.
export interface ShiftingOpportunity {
  energyKwh: number
  averageCurrentTariffRateIncVatPence: number
  costAtCheapestPence: number
  costAtAverageRatePence: number
  savingPence: number
  unitRateOnly: true
}

// OA-22/OA-21: unit rates only, no standing charge -- see
// docs/SAVINGS_METHODOLOGY.md. `unitRateOnly` is always true today but is
// sent explicitly so a future standing-charge addition is a new, distinct
// shape rather than a silent change of what this result means.
export interface SavingsResult {
  periodFrom: string
  periodTo: string
  windowDays: number
  currentTariffCostPence: number
  agileCostPence: number
  estimatedSavingPence: number
  annualizedSavingPence: number
  unitRateOnly: true
  agileTariffCode: string
  tariffState: TariffState
  eligibility: TariffEligibility
  shiftingOpportunity: ShiftingOpportunity | null
}

// OA-40: only present when energyKwh was passed to cheapestWindow() and
// the account has imported usage history -- quantifies the £ saving of
// running the appliance in the cheapest window vs. the current tariff's
// average rate, for one cycle. unitRateOnly mirrors SavingsResult's flag.
export interface CheapestWindowRecommendation {
  energyKwh: number
  averageCurrentTariffRateIncVatPence: number
  costAtCheapestPence: number
  costAtCurrentTariffPence: number
  savingPence: number
  unitRateOnly: true
}

// OA-66/OA-67: why no window was found -- never silently nothing.
// 'unsupported_tariff': the current tariff couldn't be classified, so no
// timing claim is made. 'flat_rate': every rate in the lookahead window
// is identical, so there's no "cheapest" slot to find. 'no_window_available':
// nothing long/contiguous enough remains today. 'tomorrow_not_published':
// today's remaining slots aren't enough and tomorrow's rates aren't out yet.
export type CheapestWindowUnavailableReason =
  | 'unsupported_tariff'
  | 'flat_rate'
  | 'no_window_available'
  | 'tomorrow_not_published'

// OA-9/OA-66/OA-67: a forward-looking cheapest contiguous window on the
// customer's own current tariff (never a silent Agile substitute) for a
// given appliance cycle duration, filtered to windows that haven't
// already elapsed -- distinct from SavingsResult, which looks backward
// at already-imported history. `canStartNow` is true when the window
// begins with the current half-hour, i.e. there's nothing to wait for.
export type CheapestWindowResult =
  | { found: false; reason: CheapestWindowUnavailableReason; tariffState: TariffState }
  | {
      found: true
      tariffState: TariffState
      canStartNow: boolean
      startsAt: string
      endsAt: string
      averageUnitRateIncVatPence: number
      slotsUsed: number
      recommendation: CheapestWindowRecommendation | null
    }

// OA-41: showing a recommendation isn't the same as saving money, so the
// running total only credits a recommendation the user explicitly confirmed
// they acted on. Declining or not answering still records the event (£0
// credited) rather than being silently dropped.
export interface RecommendationConfirmationInput {
  windowStartsAt: string
  windowEndsAt: string
  applianceType: string
  savingPence: number
  confirmed: boolean
  energyKwh?: number
}

// OA-32: best-effort, whole-house corroboration -- never device-level
// proof, and never changes creditedPence. 'unknown' when there's no
// connection, no energyKwh was given, or Octopus has no reading yet for
// the window (consumption data commonly lags by about a day).
export type MeterConsistency = 'consistent' | 'inconsistent' | 'unknown'

export interface RecommendationConfirmationResult {
  confirmed: boolean
  creditedPence: number
  meterConsistency: MeterConsistency
}

export interface SavingsTotal {
  savedSoFarPence: number
  eventCount: number
  consistentCount: number
}

// OA-56: suggested categories from the ticket -- the UI shows these plus
// 'other', brand/model/platform fields left optional throughout.
export type CompatibilityDeviceType =
  | 'washing_machine'
  | 'dishwasher'
  | 'tumble_dryer'
  | 'dehumidifier'
  | 'smart_plug'
  | 'ev_charger'
  | 'battery'
  | 'heating_heat_pump'
  | 'other'

export interface CompatibilityRequestInput {
  deviceType: CompatibilityDeviceType
  brand?: string
  model?: string
  smartPlugBrandModel?: string
  connectedPlatform?: string
  note?: string
}

// OA-57: one tap for the common case ("yes"), an optional short reason only
// offered when the answer is negative.
export type GuidanceFeedbackResponse = 'yes' | 'not_really' | 'could_not'

export interface GuidanceFeedbackInput {
  relatedId: string
  response: GuidanceFeedbackResponse
  comment?: string
}

// OA-71: one point of the "Actual" 30-day reconstruction -- null fields
// mean genuinely unknown (no reading / no matching rate for that
// half-hour), never a silently-assumed zero.
export interface ActualPeriodPoint {
  startsAt: string
  kwh: number | null
  unitRateIncVatPence: number | null
  costPence: number | null
  tariffCode: string | null
}

// OA-71: which tariff applied for which part of the period -- more than
// one entry means the customer switched tariff mid-period, and each
// entry's own displayName/validFrom/validTo should be shown rather than
// presenting the whole period as a single tariff.
export interface ActualPeriodTariffSegment {
  tariffCode: string
  displayName: string | null
  validFrom: string
  validTo: string
}

export type ActualPeriodImportStatus = OctopusImportResultStatus

export interface ActualPeriodResult {
  periodFrom?: string
  periodTo?: string
  importStatus: ActualPeriodImportStatus
  unitRateOnly?: true
  tariffSwitched?: boolean
  tariffSegments?: ActualPeriodTariffSegment[]
  totalKwh?: number
  totalCostPence?: number
  complete: boolean
  matchedSlots?: number
  expectedSlots?: number
  points?: ActualPeriodPoint[]
}

export const api = {
  octopus: {
    connect: async (input: { apiKey: string; accountNumber: string }) =>
      request<OctopusConnection>('/api/octopus/connect', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: await authHeaders(),
      }),
    connection: async () =>
      request<OctopusConnection>('/api/octopus/connection', {
        headers: await authHeaders(),
      }),
    disconnect: async () =>
      request<null>('/api/octopus/connection', {
        method: 'DELETE',
        headers: await authHeaders(),
      }),
    import: async () =>
      request<OctopusImportStatus>('/api/octopus/import', {
        method: 'POST',
        headers: await authHeaders(),
      }),
    importStatus: async () =>
      request<OctopusImportStatus>('/api/octopus/import-status', { headers: await authHeaders() }),
    savingsResult: async (shiftingOpportunityInput?: { durationMinutes: number; energyKwh: number }) => {
      const params = new URLSearchParams()
      if (shiftingOpportunityInput) {
        params.set('durationMinutes', String(shiftingOpportunityInput.durationMinutes))
        params.set('energyKwh', String(shiftingOpportunityInput.energyKwh))
      }
      const query = params.toString()
      return request<SavingsResult>(`/api/octopus/savings-result${query ? `?${query}` : ''}`, {
        headers: await authHeaders(),
      })
    },
    cheapestWindow: async (durationMinutes: number, energyKwh?: number) => {
      const params = new URLSearchParams({ durationMinutes: String(durationMinutes) })
      if (energyKwh != null) params.set('energyKwh', String(energyKwh))
      return request<CheapestWindowResult>(`/api/octopus/cheapest-window?${params}`, {
        headers: await authHeaders(),
      })
    },
    confirmRecommendation: async (input: RecommendationConfirmationInput) =>
      request<RecommendationConfirmationResult>('/api/octopus/recommendation-confirm', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: await authHeaders(),
      }),
    savingsTotal: async () =>
      request<SavingsTotal>('/api/octopus/savings-total', { headers: await authHeaders() }),
    actualPeriod: async () =>
      request<ActualPeriodResult>('/api/octopus/actual-period', { headers: await authHeaders() }),
  },
  compatibility: {
    submitRequest: async (input: CompatibilityRequestInput) =>
      request<{ ok: true }>('/api/compatibility-requests', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: await optionalAuthHeaders(),
      }),
  },
  feedback: {
    submitGuidanceFeedback: async (input: GuidanceFeedbackInput) =>
      request<{ ok: true }>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: await authHeaders(),
      }),
  },
}
