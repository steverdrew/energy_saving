const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1'

export class OctopusAuthError extends Error {}
export class OctopusRequestError extends Error {}

function authHeader(apiKey) {
  return { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` }
}

/**
 * Follows Octopus's `next` cursor until exhausted, returning every `results`
 * entry across all pages. Octopus pages contain full absolute URLs in
 * `next`, so no query-building is needed after the first request.
 */
async function fetchAllPages(firstUrl, headers) {
  const results = []
  let url = firstUrl

  while (url) {
    let res
    try {
      res = await fetch(url, { headers })
    } catch {
      throw new OctopusRequestError('Could not reach Octopus.')
    }

    if (res.status === 401 || res.status === 403) {
      throw new OctopusAuthError('That API key was not accepted.')
    }
    if (!res.ok) {
      throw new OctopusRequestError(`Octopus returned an unexpected error (${res.status}).`)
    }

    let body
    try {
      body = await res.json()
    } catch {
      throw new OctopusRequestError('Octopus returned an unexpected response.')
    }

    results.push(...(body.results ?? []))
    url = body.next ?? null
  }

  return results
}

/**
 * A tariff code looks like `E-1R-AGILE-24-10-01-C`: fuel, rate-type, the
 * product code (which may itself contain hyphens), then a single-letter
 * region. The product code is what the tariff-rates endpoint needs.
 */
export function productCodeFromTariffCode(tariffCode) {
  return tariffCode.split('-').slice(2, -1).join('-')
}

/** The single-letter GSP region code is always the last segment. */
export function regionLetterFromTariffCode(tariffCode) {
  return tariffCode.split('-').at(-1)
}

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
 * (OA-5), plus the meter serial number OA-6's consumption import needs --
 * not the full raw payload, and never consumption readings themselves.
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
    serialNumber: meterPoint?.meters?.[0]?.serial_number ?? null,
  }
}

/**
 * Fetches every half-hourly consumption reading (in kWh) for a meter over
 * [periodFrom, periodTo), oldest first. Requires the account's own API key
 * -- consumption data is private.
 */
export async function fetchElectricityConsumption(mpan, serialNumber, apiKey, { periodFrom, periodTo }) {
  const url =
    `${OCTOPUS_API_BASE}/electricity-meter-points/${encodeURIComponent(mpan)}` +
    `/meters/${encodeURIComponent(serialNumber)}/consumption/` +
    `?period_from=${encodeURIComponent(periodFrom)}&period_to=${encodeURIComponent(periodTo)}` +
    `&page_size=25000&order_by=period`

  const results = await fetchAllPages(url, authHeader(apiKey))
  return results.map((r) => ({
    intervalStart: r.interval_start,
    intervalEnd: r.interval_end,
    consumptionKwh: r.consumption,
  }))
}

/**
 * Fetches every half-hourly unit rate (pence inc. VAT) for a tariff over
 * [periodFrom, periodTo), oldest first. Tariff rates are public product
 * data -- no API key needed.
 */
export async function fetchTariffUnitRates(tariffCode, { periodFrom, periodTo }) {
  const productCode = productCodeFromTariffCode(tariffCode)
  const url =
    `${OCTOPUS_API_BASE}/products/${encodeURIComponent(productCode)}` +
    `/electricity-tariffs/${encodeURIComponent(tariffCode)}/standard-unit-rates/` +
    `?period_from=${encodeURIComponent(periodFrom)}&period_to=${encodeURIComponent(periodTo)}`

  const results = await fetchAllPages(url, {})
  return results.map((r) => ({
    validFrom: r.valid_from,
    validTo: r.valid_to,
    unitRateIncVatPence: r.value_inc_vat,
  }))
}

/**
 * OA-22 MVP: finds the Octopus Agile product currently on sale and builds
 * its tariff code for the given GSP region letter. Octopus retires and
 * replaces Agile's underlying product every few months (e.g.
 * `AGILE-24-10-01`), so the code can't be hardcoded or derived from the
 * user's own (non-Agile) tariff code -- it has to be looked up each time.
 * Tariff rates are public product data -- no API key needed.
 */
export async function fetchActiveAgileTariffCode(regionLetter) {
  const now = Date.now()
  const products = await fetchAllPages(`${OCTOPUS_API_BASE}/products/?page_size=100`, {})

  const activeAgileProducts = products.filter((p) => {
    if (typeof p.code !== 'string' || !p.code.startsWith('AGILE-')) return false
    if (p.available_from && new Date(p.available_from).getTime() > now) return false
    if (p.available_to && new Date(p.available_to).getTime() <= now) return false
    return true
  })

  if (activeAgileProducts.length === 0) {
    throw new OctopusRequestError('No active Octopus Agile product found.')
  }

  activeAgileProducts.sort(
    (a, b) => new Date(b.available_from ?? 0).getTime() - new Date(a.available_from ?? 0).getTime(),
  )

  return `E-1R-${activeAgileProducts[0].code}-${regionLetter}`
}
