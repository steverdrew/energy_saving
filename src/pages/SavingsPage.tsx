import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type SavingsResult, type TariffState } from '../api/client'
import { DEFAULT_APPLIANCE_PROFILES, type ApplianceType } from '../domain/applianceProfile'
import { formatGbp } from '../format'
import { useOctopusConnection } from '../octopus/OctopusConnectionContext'
import './SavingsPage.css'

type Phase = 'loading' | 'not-connected' | 'not-imported' | 'result' | 'error'

const APPLIANCE_TYPES = Object.keys(DEFAULT_APPLIANCE_PROFILES) as ApplianceType[]

// OA-45: plain-English label for "You're on X" -- omitted entirely when
// the tariff kind can't be determined, rather than guessing.
const TARIFF_KIND_LABEL: Record<TariffState['kind'], string | null> = {
  agile: 'Octopus Agile',
  go: 'Octopus Go',
  intelligent_go: 'Intelligent Octopus Go',
  standard: 'a standard variable or fixed tariff',
  unknown: null,
}

// OA-41: the running total is its own, independent state -- it reflects
// confirmed actions from Cheapest Times, not whether an Octopus account is
// currently connected or imported, so it's fetched and shown regardless of
// `phase` below.
function SavedSoFar() {
  const [savedSoFarPence, setSavedSoFarPence] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.octopus
      .savingsTotal()
      .then((res) => {
        if (!cancelled && res) setSavedSoFarPence(res.savedSoFarPence)
      })
      .catch(() => {
        /* Non-essential — the rest of the page still works without it. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (savedSoFarPence === null) return null

  return (
    <p className="savings-page__saved-so-far">
      Estimated saved so far: <strong>{formatGbp(savedSoFarPence)}</strong>
    </p>
  )
}

function describeResultError(err: unknown): string {
  if (err instanceof ApiError && err.status === 502) {
    return "We couldn't reach Octopus right now. Please try again in a moment."
  }
  return 'Something went wrong working out your saving. Please try again.'
}

function SavingsPage() {
  const { connection, loading: connectionLoading } = useOctopusConnection()
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<SavingsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (connectionLoading) return

    if (!connection?.connected) {
      setPhase('not-connected')
      return
    }

    let cancelled = false
    setPhase('loading')

    async function load() {
      const status = await api.octopus.importStatus()
      if (cancelled) return
      if (!status?.imported) {
        setPhase('not-imported')
        return
      }
      const res = await api.octopus.savingsResult()
      if (cancelled || !res) return
      setResult(res)
      setPhase('result')
    }

    load().catch((err) => {
      if (cancelled) return
      setError(describeResultError(err))
      setPhase('error')
    })

    return () => {
      cancelled = true
    }
  }, [connectionLoading, connection?.connected])

  if (phase === 'loading') return null

  if (phase === 'not-connected') {
    return (
      <section className="savings-page">
        <h1>My Savings</h1>
        <SavedSoFar />
        <p>Connect your Octopus Energy account to see what you could save.</p>
        <Link to="/connect-octopus" className="savings-page__cta">
          Connect Octopus
        </Link>
      </section>
    )
  }

  if (phase === 'not-imported') {
    return (
      <section className="savings-page">
        <h1>My Savings</h1>
        <SavedSoFar />
        <p>Import your usage history to see what you could save.</p>
        <Link to="/connect-octopus" className="savings-page__cta">
          Import my usage history
        </Link>
      </section>
    )
  }

  if (phase === 'error') {
    return (
      <section className="savings-page">
        <h1>My Savings</h1>
        <SavedSoFar />
        <p className="savings-page__error">{error}</p>
      </section>
    )
  }

  if (!result) return null

  const saving = result.estimatedSavingPence
  const cheaperTariff = saving > 0 ? 'agile' : saving < 0 ? 'current' : 'same'
  const alreadyOnAgile = result.tariffState.kind === 'agile'
  const tariffLabel = TARIFF_KIND_LABEL[result.tariffState.kind]

  return (
    <section className="savings-page">
      <h1>My Savings</h1>
      <SavedSoFar />

      {tariffLabel && (
        <p className="savings-page__tariff-state">
          You're on <strong>{tariffLabel}</strong>.
        </p>
      )}

      {!alreadyOnAgile && cheaperTariff === 'agile' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, you would have
          spent <strong>{formatGbp(saving)}</strong> less on Agile at the unit rates available during
          that period.
        </p>
      )}
      {!alreadyOnAgile && cheaperTariff === 'current' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          tariff was already cheaper than Agile by <strong>{formatGbp(saving)}</strong> at the unit
          rates available during that period.
        </p>
      )}
      {!alreadyOnAgile && cheaperTariff === 'same' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          tariff and Agile would have cost about the same, at the unit rates available during that
          period.
        </p>
      )}

      {alreadyOnAgile && cheaperTariff === 'agile' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, the latest
          Agile rates would have cost <strong>{formatGbp(saving)}</strong> less than your current
          agreement's rates — it may be worth checking you're on Octopus's latest Agile pricing.
        </p>
      )}
      {alreadyOnAgile && cheaperTariff === 'current' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          Agile agreement was already cheaper than the latest Agile pricing by{' '}
          <strong>{formatGbp(saving)}</strong> over that period.
        </p>
      )}
      {alreadyOnAgile && cheaperTariff === 'same' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          Agile agreement costs about the same as the latest Agile pricing.
        </p>
      )}

      <p className="savings-page__caveat">
        This is an estimate based on unit rates only. Standing charges aren't included yet.
      </p>

      {result.tariffState.recentlySwitched && (
        <p className="savings-page__caveat">
          You switched to this tariff {result.tariffState.daysSinceSwitch} day
          {result.tariffState.daysSinceSwitch === 1 ? '' : 's'} ago — your usage may still reflect
          habits from before the switch, so this estimate is lower-confidence than it will be over
          time.
        </p>
      )}

      {result.tariffState.comparisonMethod === 'bounded_estimate' && (
        <p className="savings-page__caveat">
          Your current tariff includes personalised smart-charging discounts we can't reconstruct
          from public data, so your actual cost on it was likely lower than this estimate assumes —
          treat this comparison as a bounded estimate, not an exact figure.
        </p>
      )}

      <p className="savings-page__eligibility">
        {result.eligibility.status === 'eligible' && 'Available to you.'}
        {result.eligibility.status === 'scenario_only' &&
          `Scenario only — ${result.eligibility.requirement ?? ''} You're not currently eligible.`}
        {result.eligibility.status === 'cannot_determine' &&
          "We can't confirm your eligibility for this tariff yet."}
      </p>

      {!alreadyOnAgile && cheaperTariff === 'agile' && (
        <p className="savings-page__annualized">
          At the same usage pattern, that's roughly <strong>{formatGbp(result.annualizedSavingPence)}</strong>{' '}
          a year. Your actual annual saving will vary with your usage and electricity prices.
        </p>
      )}

      <ShiftingOpportunity />
    </section>
  )
}

// OA-23/OA-7: a second, clearly separate layer from the tariff-fit result
// above -- what moving one appliance's cycle to the cheapest slot within
// the already-imported historical period would have cost, instead of
// running it at the period's average rate on the current tariff. Fetches
// its own result (with durationMinutes/energyKwh) rather than folding into
// the main effect, since it only runs once the base result has loaded.
function ShiftingOpportunity() {
  const [applianceType, setApplianceType] = useState<ApplianceType>(APPLIANCE_TYPES[0])
  const [result, setResult] = useState<SavingsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const profile = DEFAULT_APPLIANCE_PROFILES[applianceType]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.octopus
      .savingsResult({
        durationMinutes: profile.typicalProgrammeDurationMinutes.value,
        energyKwh: profile.typicalEnergyPerCycleKwh.value,
      })
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch(() => {
        /* Non-essential add-on to the main result -- fail quietly. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  const opportunity = result?.shiftingOpportunity

  return (
    <div className="savings-page__shifting">
      <h2>Shifting opportunity</h2>
      <p className="savings-page__shifting-intro">
        A separate, projected figure: what moving one appliance cycle to the cheapest time in your
        imported history would have cost, instead of running it at your average rate.
      </p>
      <label className="savings-page__shifting-picker">
        Appliance
        <select value={applianceType} onChange={(e) => setApplianceType(e.target.value as ApplianceType)}>
          {APPLIANCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {DEFAULT_APPLIANCE_PROFILES[type].label}
            </option>
          ))}
        </select>
      </label>

      {loading && <p>Working it out…</p>}
      {!loading && opportunity && opportunity.savingPence > 0 && (
        <p>
          Running your {profile.label.toLowerCase()} at the cheapest point instead of your average
          rate would have cost about <strong>{formatGbp(opportunity.costAtCheapestPence)}</strong>{' '}
          instead of <strong>{formatGbp(opportunity.costAtAverageRatePence)}</strong> — a projected
          saving of about <strong>{formatGbp(opportunity.savingPence)}</strong> per cycle.
        </p>
      )}
      {!loading && opportunity && opportunity.savingPence <= 0 && (
        <p className="savings-page__caveat">
          For this appliance, your average rate during the imported period was already about as low
          as the cheapest slot available.
        </p>
      )}
      {!loading && !opportunity && (
        <p className="savings-page__caveat">Not enough imported history to work this out yet.</p>
      )}
    </div>
  )
}

export default SavingsPage
