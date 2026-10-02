import { useState } from 'react'
import { ApiError, api, type OptimisedPeriodResult } from '../api/client'
import HeatMap from '../components/HeatMap'
import { groupSlotsByLondonDay } from '../components/heatMapMath'
import { formatGbp } from '../format'
import './OptimisedPage.css'

type Phase = 'idle' | 'loading' | 'result' | 'not-imported' | 'error'

const rangeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Mirrors applianceProfile.ts's label-per-type -- this page never invents
// its own appliance catalog, it only displays what the engine reports.
const APPLIANCE_LABELS: Record<string, string> = {
  dishwasher: 'Dishwasher',
  washing_machine: 'Washing machine',
  tumble_dryer: 'Tumble dryer',
  dehumidifier: 'Dehumidifier',
}

// OA-73's evidence hierarchy -- plain-English per tier, shown next to any
// moved event so a tier-4 (generic default) saving never reads the same as
// a tier-2 (user-supplied) one.
const CONFIDENCE_TIER_LABELS: Record<number, string> = {
  2: 'based on your own appliance details',
  3: 'based on your confirmation this cycle could have run differently',
  4: 'based on a generic typical appliance estimate',
}

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 502) {
    return "We couldn't reach Octopus right now. Please try again in a moment."
  }
  if (err instanceof ApiError && err.status === 400) {
    return err.message
  }
  if (err instanceof ApiError && err.status === 500) {
    return "We couldn't build a reliable Optimised result for this period. Please try again."
  }
  return 'Something went wrong building that result. Please try again.'
}

function describeUnavailable(method?: string): string {
  if (method === 'bounded_estimate') {
    return "This tariff includes personalised smart-charging periods we can't reconstruct from public data, so we can't show an exact Optimised figure for it."
  }
  return "We don't recognise that tariff code well enough to reconstruct its historical rates, so we won't guess a figure for it."
}

// OA-76: "Optimised" -- the same tariff Compare already repriced to, with
// any identified flexible load shifted into cheaper windows. No household
// appliance data exists yet (that's a later ticket), so eventsConsidered
// is always 0 today -- this page shows that honestly rather than hiding
// the £0 timing opportunity.
function OptimisedPage() {
  const [comparisonTariffCode, setComparisonTariffCode] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<OptimisedPeriodResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function runOptimisation(input: { comparisonFamily?: 'agile'; comparisonTariffCode?: string }) {
    setPhase('loading')
    api.octopus
      .optimisedPeriod(input)
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
    <section className="optimised-page">
      <h1>Optimised: same tariff, realistically shifted</h1>
      <p className="optimised-page__intro">
        Your same household energy requirement, on a chosen tariff, with only the specific flexible appliance cycles we
        can actually identify moved into cheaper half-hours that same day — never a theoretical maximum.
      </p>

      <div className="optimised-page__controls">
        <button type="button" onClick={() => runOptimisation({ comparisonFamily: 'agile' })} disabled={phase === 'loading'}>
          Optimise against Octopus Agile
        </button>
        <form
          className="optimised-page__custom"
          onSubmit={(e) => {
            e.preventDefault()
            if (comparisonTariffCode.trim()) runOptimisation({ comparisonTariffCode: comparisonTariffCode.trim() })
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
            Optimise
          </button>
        </form>
      </div>

      {phase === 'loading' && <p>Building Optimised result…</p>}
      {phase === 'error' && <p className="optimised-page__error">{error}</p>}
      {phase === 'not-imported' && <p>Import your usage history first, then try again.</p>}

      {phase === 'result' && result && result.importStatus === 'no_data' && (
        <p>We don't have any usage or rate data for this period yet. Try importing again shortly.</p>
      )}

      {phase === 'result' && result && result.importStatus !== 'no_data' && !result.comparisonAvailable && (
        <p className="optimised-page__caveat">{describeUnavailable(result.comparisonMethod)}</p>
      )}

      {phase === 'result' && result && result.comparisonAvailable && result.actual && result.comparison && result.optimised && (
        <div className="optimised-page__result">
          {result.periodFrom && result.periodTo && (
            <p className="optimised-page__period">
              {rangeFormatter.format(new Date(result.periodFrom))} – {rangeFormatter.format(new Date(result.periodTo))}
            </p>
          )}

          <p className="optimised-page__caveat">Unit rates only — doesn't include either tariff's standing charge.</p>
          <p className="optimised-page__caveat">Shifting model version: {result.optimised.methodologyVersion}</p>

          <div className="optimised-page__opportunities">
            <div className="optimised-page__opportunity">
              <h3>Tariff-choice opportunity</h3>
              <p>
                <strong>{formatGbp(Math.abs(result.tariffChoiceOpportunityPence ?? 0))}</strong>{' '}
                {(result.tariffChoiceOpportunityPence ?? 0) >= 0 ? 'cheaper' : 'more expensive'} on{' '}
                {result.comparison.displayName ?? result.comparison.tariffCode} — switching tariff, same behaviour.
              </p>
            </div>
            <div className="optimised-page__opportunity">
              <h3>Timing opportunity</h3>
              <p>
                <strong>{formatGbp(Math.abs(result.timingOpportunityPence ?? 0))}</strong>{' '}
                {(result.timingOpportunityPence ?? 0) > 0 ? 'saved' : 'available'} by shifting flexible load — same tariff,
                different timing.
              </p>
            </div>
          </div>

          {result.optimised.eventsConsidered === 0 && (
            <p className="optimised-page__caveat">
              No specific flexible appliance cycle has been identified yet for this period, so nothing has been moved —
              this is a genuine £0 timing opportunity, not an error. Once your appliances are set up, any realistically
              shiftable cycles will show here.
            </p>
          )}

          {result.optimised.moves.length > 0 && (
            <div className="optimised-page__moves">
              <strong>What moved:</strong>
              <ul>
                {result.optimised.moves.map((move, i) => (
                  <li key={i}>
                    {APPLIANCE_LABELS[move.applianceType] ?? move.applianceType}:{' '}
                    {formatGbp(move.beforeCostPence)} → {formatGbp(move.afterCostPence)} (saved {formatGbp(move.savingPence)},{' '}
                    {CONFIDENCE_TIER_LABELS[move.evidenceTier] ?? 'estimated'})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="optimised-page__sides">
            <div className="optimised-page__side">
              <h2>Actual</h2>
              <p>
                <strong>{formatGbp(result.actual.totalCostPence)}</strong> for{' '}
                <strong>{result.actual.totalKwh.toFixed(1)} kWh</strong>
              </p>
            </div>
            <div className="optimised-page__side">
              <h2>Same usage on {result.comparison.displayName ?? result.comparison.tariffCode}</h2>
              <p>
                <strong>{formatGbp(result.comparison.totalCostPence)}</strong> for{' '}
                <strong>{result.comparison.totalKwh.toFixed(1)} kWh</strong>
              </p>
              <HeatMap days={groupSlotsByLondonDay(result.comparison.points)} title="Like-for-like" />
            </div>
            <div className="optimised-page__side">
              <h2>Optimised</h2>
              <p>
                <strong>{formatGbp(result.optimised.totalCostPence)}</strong> for{' '}
                <strong>{result.optimised.totalKwh.toFixed(1)} kWh</strong>
              </p>
              <HeatMap days={groupSlotsByLondonDay(result.optimised.points)} title="Optimised" />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default OptimisedPage
