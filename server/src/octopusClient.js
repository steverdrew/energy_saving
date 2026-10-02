const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1'

export class OctopusAuthError extends Error {}
export class OctopusRequestError extends Error {}

/**
 * Validates an Octopus account number + API key by fetching the account
 * from Octopus's own API, and returns the raw account payload. Throws
 * OctopusAuthError for bad credentials/unknown account, OctopusRequestError
 * for anything else (network failure, unexpected status, malformed body).
 *
 * Octopus authenticates with HTTP Basic auth: the API key as the username,
 * no password. See https://developer.octopus.energy/rest/guides/authentication.
 */
export async function fetchOctopusAccount(accountNumber, apiKey) {
  const credentials = Buffer.from(`${apiKey}:`).toString('base64')

  let res
  try {
    res = await fetch(`${OCTOPUS_API_BASE}/accounts/${encodeURIComponent(accountNumber)}/`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
  } catch {
    throw new OctopusRequestError('Could not reach Octopus.')
  }

  if (res.status === 401 || res.status === 403) {
    throw new OctopusAuthError('That API key was not accepted.')
  }
  if (res.status === 404) {
    throw new OctopusAuthError('No Octopus account found for that account number.')
  }
  if (!res.ok) {
    throw new OctopusRequestError(`Octopus returned an unexpected error (${res.status}).`)
  }

  try {
    return await res.json()
  } catch {
    throw new OctopusRequestError('Octopus returned an unexpected response.')
  }
}

/**
 * Pulls out the minimal, non-secret account context this product needs
 * (OA-5) -- not the full raw payload, and never consumption readings
 * (that's OA-6's job).
 */
export function summarizeOctopusAccount(account) {
  const property = account?.properties?.[0]
  const meterPoint = property?.electricity_meter_points?.[0]
  const agreements = meterPoint?.agreements ?? []
  const now = Date.now()
  const currentAgreement =
    agreements.find((a) => !a.valid_to || new Date(a.valid_to).getTime() > now) ?? agreements.at(-1)

  return {
    mpan: meterPoint?.mpan ?? null,
    tariffCode: currentAgreement?.tariff_code ?? null,
  }
}
