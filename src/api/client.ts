// The only module in the web app allowed to call the server. No provider
// credentials or secrets belong here — see the bundle check script.
//
// Authentication is handled by Firebase Auth (see src/auth/AuthContext.tsx),
// not this client — the server's own auth routes (server/src/auth.js) are
// unused by the web app as of OA-50.
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })

  if (res.status === 204) return null

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? 'Something went wrong')
  }
  return body as T
}

export const api = {
  octopus: {
    connect: (input: { apiKey: string; accountNumber: string }) =>
      request<never>('/api/octopus/connect', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    importStatus: () => request<never>('/api/octopus/import-status'),
    savingsResult: () => request<never>('/api/octopus/savings-result'),
  },
}
