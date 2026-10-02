import { useState } from 'react'
import { ApiError, api, type LikeForLikeResult } from '../api/client'
import HeatMap from '../components/HeatMap'
import { groupSlotsByLondonDay } from '../components/heatMapMath'
import { formatGbp } from '../format'
import './ComparePage.css'

type Phase = 'idle' | 'loading' | 'result' | 'not-imported' | 'error'

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
  if (err instanceof ApiError && err.status === 400) {
    return err.message
  }
  return 'Something went wrong running that comparison. Please try again.'
}

function describeUnavailable(method?: string): string {
  if (method === 'bounded_estimate') {
    return "This tariff includes personalised smart-charging periods we can't reconstruct from public data, so we can't show an exact like-for-like figure for it."
  }
  return "We don't recognise that tariff code well enough to reconstruct its historical rates, so we won't guess a figure for it."
}

// OA-72: "I'm on X -- what would these exact 30 days have cost on Y?".
// Octopus Agile is the one comparison family this app can safely
// auto-resolve to the customer's own region; any other tariff must be
// entered as an explicit Octopus tariff code (see routes/octopus.js).
function ComparePage() {
  const [comparisonTariffCode, setComparisonTariffCode] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<LikeForLikeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function runComparison(input: { comparisonFamily?: 'agile'; comparisonTariffCode?: string }) {
    setPhase('loading')
    api.octopus
      .likeForLike(input)
      .then((res) => {
        if (!res) return
        setResult(res)
        setPhase('result')
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 400 && /import/i.test(err.message)) {
          setPhase('not-imported')
          return
        }
        setError(describeError(err))
        setPhase('error')
      })
  }

  return (
    <section className="compare-page">
      <h1>Compare: same usage, different tariff</h1>
      <p className="compare-page__intro">
        "I'm on this tariff — what would these exact same 30 days have cost on a different one?" Your usage never
        changes, only the tariff does.
      </p>

      <div className="compare-page__controls">
        <button type="button" onClick={() => runComparison({ comparisonFamily: 'agile' })} disabled={phase === 'loading'}>
          Compare against Octopus Agile
        </button>
        <form
          className="compare-page__custom"
          onSubmit={(e) => {
            e.preventDefault()
            if (comparisonTariffCode.trim()) runComparison({ comparisonTariffCode: comparisonTariffCode.trim() })
          }}
        >
          <label>
            Or enter a specific Octopus tariff code
            <input
              type="text"
              value={comparisonTariffCode}
              onChange={(e) => setComparisonTariffCode(e.target.value)}
              placeholder="E-1R-VAR-22-11-01-C"
            />
          </label>
          <button type="submit" disabled={phase === 'loading' || !comparisonTariffCode.trim()}>
            Compare
          </button>
        </form>
      </div>

      {phase === 'loading' && <p>Running comparison…</p>}
      {phase === 'error' && <p className="compare-page__error">{error}</p>}
      {phase === 'not-imported' && <p>Import your usage history first, then try comparing again.</p>}

      {phase === 'result' && result && result.importStatus === 'no_data' && (
        <p>We don't have any usage or rate data for this period yet. Try importing again shortly.</p>
      )}

      {phase === 'result' && result && result.importStatus !== 'no_data' && !result.comparisonAvailable && (
        <p className="compare-page__caveat">{describeUnavailable(result.comparisonMethod)}</p>
      )}

      {phase === 'result' && result && result.comparisonAvailable && result.actual && result.comparison && (
        <div className="compare-page__result">
          {result.periodFrom && result.periodTo && (
            <p className="compare-page__period">
              {rangeFormatter.format(new Date(result.periodFrom))} – {rangeFormatter.format(new Date(result.periodTo))}
            </p>
          )}

          <p className="compare-page__difference">
            {result.differencePence !== undefined && result.differencePence > 0 && (
              <>
                You would have paid <strong>{formatGbp(result.differencePence)} less</strong> on{' '}
                {result.comparison.displayName ?? result.comparison.tariffCode} for this exact usage.
              </>
            )}
            {result.differencePence !== undefined && result.differencePence < 0 && (
              <>
                You would have paid <strong>{formatGbp(-result.differencePence)} more</strong> on{' '}
                {result.comparison.displayName ?? result.comparison.tariffCode} for this exact usage.
              </>
            )}
            {result.differencePence === 0 && <>Both tariffs would have cost the same for this exact usage.</>}
          </p>
          <p className="compare-page__caveat">Unit rates only — doesn't include either tariff's standing charge.</p>

          <div className="compare-page__sides">
            <div className="compare-page__side">
              <h2>Actual</h2>
              <p>
                <strong>{formatGbp(result.actual.totalCostPence)}</strong> for <strong>{result.actual.totalKwh.toFixed(1)} kWh</strong>
              </p>
              <HeatMap days={groupSlotsByLondonDay(result.actual.points)} title="Actual" />
            </div>
            <div className="compare-page__side">
              <h2>Same usage on {result.comparison.displayName ?? result.comparison.tariffCode}</h2>
              <p>
                <strong>{formatGbp(result.comparison.totalCostPence)}</strong> for{' '}
                <strong>{result.comparison.totalKwh.toFixed(1)} kWh</strong>
              </p>
              <HeatMap days={groupSlotsByLondonDay(result.comparison.points)} title="Like-for-like" />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ComparePage
