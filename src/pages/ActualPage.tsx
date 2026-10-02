import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type ActualPeriodResult } from '../api/client'
import HeatMap from '../components/HeatMap'
import { groupSlotsByLondonDay } from '../components/heatMapMath'
import { formatGbp } from '../format'
import './ActualPage.css'

type Phase = 'loading' | 'result' | 'not-imported' | 'error'

const rangeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 502) {
    return "We couldn't reach Octopus right now. Please try again in a moment."
  }
  return 'Something went wrong loading your actual usage and cost. Please try again.'
}

function ActualPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<ActualPeriodResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    api.octopus
      .actualPeriod()
      .then((res) => {
        if (cancelled || !res) return
        setResult(res)
        setPhase('result')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 400) {
          setPhase('not-imported')
          return
        }
        setError(describeError(err))
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="actual-page">
      <h1>Your actual usage and cost</h1>
      <p className="actual-page__intro">
        What you actually used and actually paid over the last 30 days — no "what if", just what happened.
      </p>

      {phase === 'loading' && <p>Loading…</p>}
      {phase === 'error' && <p className="actual-page__error">{error}</p>}
      {phase === 'not-imported' && (
        <p>
          <Link to="/connect-octopus">Import your usage history</Link> to see your actual usage and cost.
        </p>
      )}

      {phase === 'result' && result && result.importStatus === 'no_data' && (
        <p>We don't have any usage or rate data for this period yet. Try importing again shortly.</p>
      )}

      {phase === 'result' && result && result.importStatus !== 'no_data' && (
        <div className="actual-page__result">
          {result.periodFrom && result.periodTo && (
            <p className="actual-page__period">
              {rangeFormatter.format(new Date(result.periodFrom))} – {rangeFormatter.format(new Date(result.periodTo))}
            </p>
          )}

          {result.tariffSegments && result.tariffSegments.length > 0 && (
            <div className="actual-page__tariffs">
              {result.tariffSwitched ? (
                <>
                  <p className="actual-page__tariff-switch-note">
                    Your tariff changed during this period, so costs below reflect each tariff that actually
                    applied, not just the one you're on today.
                  </p>
                  <ul>
                    {result.tariffSegments.map((seg) => (
                      <li key={`${seg.tariffCode}-${seg.validFrom}`}>
                        {seg.displayName ?? seg.tariffCode}: {rangeFormatter.format(new Date(seg.validFrom))} –{' '}
                        {rangeFormatter.format(new Date(seg.validTo))}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Tariff: {result.tariffSegments[0].displayName ?? result.tariffSegments[0].tariffCode}</p>
              )}
            </div>
          )}

          <div className="actual-page__totals">
            <p>
              <strong>{result.totalKwh?.toFixed(1) ?? '—'} kWh</strong> used,{' '}
              <strong>{result.totalCostPence !== undefined ? formatGbp(result.totalCostPence) : '—'}</strong> spent.
            </p>
            <p className="actual-page__caveat">
              Unit rates only — doesn't include your standing charge.
              {!result.complete &&
                ` Some half-hours in this period are missing a reading or a rate, so this total may be an undercount (${result.matchedSlots ?? 0} of ${result.expectedSlots ?? 0} half-hours covered).`}
            </p>
          </div>

          {result.points && result.points.length > 0 && (
            <HeatMap days={groupSlotsByLondonDay(result.points)} title="Daily usage and cost" />
          )}
        </div>
      )}
    </section>
  )
}

export default ActualPage
