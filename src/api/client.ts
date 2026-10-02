// The only module in the web app allowed to call the server. No provider
// credentials or secrets belong here — see the bundle check script.
export interface AuthUser {
  id: string
  email: string
}

export interface SignupInput {
  email: string
  password: string
  acceptedTerms: boolean
  acceptedPrivacy: boolean
}

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
  auth: {
    me: () => request<{ user: AuthUser }>('/api/auth/me').catch(() => null),
    signup: (input: SignupInput) =>
      request<{ user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    login: (email: string, password: string) =>
      request<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<null>('/api/auth/logout', { method: 'POST' }),
    deleteAccount: () => request<null>('/api/auth/account', { method: 'DELETE' }),
  },
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
