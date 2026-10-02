import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type SavingsResult } from '../api/client'
import { formatGbp } from '../format'
import { useOctopusConnection } from '../octopus/OctopusConnectionContext'
import './SavingsPage.css'

type Phase = 'loading' | 'not-connected' | 'not-imported' | 'result' | 'error'

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
        <p className="savings-page__error">{error}</p>
      </section>
    )
  }

  if (!result) return null

  const saving = result.estimatedSavingPence
  const cheaperTariff = saving > 0 ? 'agile' : saving < 0 ? 'current' : 'same'

  return (
    <section className="savings-page">
      <h1>My Savings</h1>

      {cheaperTariff === 'agile' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, you would have
          spent <strong>{formatGbp(saving)}</strong> less on Agile at the unit rates available during
          that period.
        </p>
      )}
      {cheaperTariff === 'current' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          tariff was already cheaper than Agile by <strong>{formatGbp(saving)}</strong> at the unit
          rates available during that period.
        </p>
      )}
      {cheaperTariff === 'same' && (
        <p className="savings-page__headline">
          Based on your actual electricity use over the last {result.windowDays} days, your current
          tariff and Agile would have cost about the same, at the unit rates available during that
          period.
        </p>
      )}

      <p className="savings-page__caveat">
        This is an estimate based on unit rates only. Standing charges aren't included yet.
      </p>

      {cheaperTariff === 'agile' && (
        <p className="savings-page__annualized">
          At the same usage pattern, that's roughly <strong>{formatGbp(result.annualizedSavingPence)}</strong>{' '}
          a year. Your actual annual saving will vary with your usage and electricity prices.
        </p>
      )}
    </section>
  )
}

export default SavingsPage
