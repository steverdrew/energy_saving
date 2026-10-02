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
    importStatus: async () =>
      request<never>('/api/octopus/import-status', { headers: await authHeaders() }),
    savingsResult: async () =>
      request<never>('/api/octopus/savings-result', { headers: await authHeaders() }),
  },
}
