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

export interface OctopusImportStatus {
  imported: boolean
  periodFrom?: string
  periodTo?: string
  consumptionPoints?: number
  ratePoints?: number
  importedAt?: string
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

// OA-9: a forward-looking cheapest contiguous Agile window for a given
// appliance cycle duration -- distinct from SavingsResult, which looks
// backward at already-imported history.
export type CheapestWindowResult =
  | { found: false }
  | {
      found: true
      agileTariffCode: string
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
}

export interface RecommendationConfirmationResult {
  confirmed: boolean
  creditedPence: number
}

export interface SavingsTotal {
  savedSoFarPence: number
  eventCount: number
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
    savingsResult: async () =>
      request<SavingsResult>('/api/octopus/savings-result', { headers: await authHeaders() }),
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
  },
}
