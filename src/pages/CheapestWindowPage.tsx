import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type CheapestWindowResult } from '../api/client'
import {
  DEFAULT_APPLIANCE_PROFILES,
  isEstimate,
  type ApplianceType,
} from '../domain/applianceProfile'
import { formatGbp } from '../format'
import './CheapestWindowPage.css'

type Phase = 'loading' | 'result' | 'not-found' | 'error'

const APPLIANCE_TYPES = Object.keys(DEFAULT_APPLIANCE_PROFILES) as ApplianceType[]

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

function formatLondonTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

function describeWindowError(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    return err.message
  }
  if (err instanceof ApiError && err.status === 502) {
    return "We couldn't reach Octopus right now. Please try again in a moment."
  }
  return 'Something went wrong finding a cheap time slot. Please try again.'
}

type ConfirmState = 'unanswered' | 'submitting' | 'answered' | 'error'

function CheapestWindowPage() {
  const [applianceType, setApplianceType] = useState<ApplianceType>(APPLIANCE_TYPES[0])
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<CheapestWindowResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>('unanswered')
  const [confirmedYes, setConfirmedYes] = useState(false)

  const profile = DEFAULT_APPLIANCE_PROFILES[applianceType]

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setConfirmState('unanswered')

    api.octopus
      .cheapestWindow(profile.typicalProgrammeDurationMinutes.value, profile.typicalEnergyPerCycleKwh.value)
      .then((res) => {
        if (cancelled || !res) return
        setResult(res)
        setPhase(res.found ? 'result' : 'not-found')
      })
      .catch((err) => {
        if (cancelled) return
        setError(describeWindowError(err))
        setPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  function confirmRan(confirmed: boolean) {
    if (!result?.found || !result.recommendation) return
    setConfirmState('submitting')
    api.octopus
      .confirmRecommendation({
        windowStartsAt: result.startsAt,
        windowEndsAt: result.endsAt,
        applianceType,
        savingPence: result.recommendation.savingPence,
        confirmed,
      })
      .then(() => {
        setConfirmedYes(confirmed)
        setConfirmState('answered')
      })
      .catch(() => setConfirmState('error'))
  }

  return (
    <section className="cheapest-window-page">
      <h1>Cheapest time to run it</h1>
      <p className="cheapest-window-page__intro">
        Based on published Octopus Agile prices for today (and tomorrow, once published).
      </p>

      <label className="cheapest-window-page__picker">
        Appliance
        <select value={applianceType} onChange={(e) => setApplianceType(e.target.value as ApplianceType)}>
          {APPLIANCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {DEFAULT_APPLIANCE_PROFILES[type].label}
            </option>
          ))}
        </select>
      </label>

      {phase === 'loading' && <p>Looking up prices…</p>}

      {phase === 'error' && <p className="cheapest-window-page__error">{error}</p>}

      {phase === 'not-found' && (
        <p>
          We couldn't find a clear cheapest window yet — prices for later today or tomorrow may not be
          published. Try again closer to the time you want to run it.
        </p>
      )}

      {phase === 'result' && result?.found && (
        <div className="cheapest-window-page__result">
          <p className="cheapest-window-page__headline">
            Run your {profile.label.toLowerCase()} between{' '}
            <strong>{formatLondonTime(result.startsAt)}</strong> and{' '}
            <strong>{formatLondonTime(result.endsAt)}</strong> — the cheapest window today, averaging{' '}
            <strong>{result.averageUnitRateIncVatPence.toFixed(1)}p/kWh</strong>.
          </p>
          {isEstimate(profile.typicalProgrammeDurationMinutes) && (
            <p className="cheapest-window-page__caveat">
              Based on a typical {profile.typicalProgrammeDurationMinutes.value}-minute cycle for this
              appliance type — not your specific model.
            </p>
          )}
          {profile.safety.notes && (
            <p className="cheapest-window-page__caution">{profile.safety.notes}</p>
          )}

          {result.recommendation && result.recommendation.savingPence > 0 && (
            <div className="cheapest-window-page__saving">
              <p>
                Running then instead of on your current tariff's average rate would cost about{' '}
                <strong>{formatGbp(result.recommendation.costAtCheapestPence)}</strong> instead of{' '}
                <strong>{formatGbp(result.recommendation.costAtCurrentTariffPence)}</strong> — a saving
                of about <strong>{formatGbp(result.recommendation.savingPence)}</strong> this cycle.
              </p>
              <p className="cheapest-window-page__caveat">
                Estimate based on unit rates only, for one cycle — not a per-year figure, and doesn't
                include the standing charge.
              </p>

              {confirmState === 'unanswered' && (
                <div className="cheapest-window-page__confirm">
                  <p>Did you run it at the recommended time?</p>
                  <div className="cheapest-window-page__confirm-buttons">
                    <button type="button" onClick={() => confirmRan(true)}>
                      Yes
                    </button>
                    <button type="button" onClick={() => confirmRan(false)}>
                      No
                    </button>
                  </div>
                </div>
              )}
              {confirmState === 'submitting' && <p className="cheapest-window-page__caveat">Saving…</p>}
              {confirmState === 'answered' && confirmedYes && (
                <p className="cheapest-window-page__confirm-feedback">
                  Nice — added to your saved-so-far total.
                </p>
              )}
              {confirmState === 'answered' && !confirmedYes && (
                <p className="cheapest-window-page__caveat">No worries — we'll suggest this again next time.</p>
              )}
              {confirmState === 'error' && (
                <p className="cheapest-window-page__error">
                  Couldn't save your answer. Please try again.
                </p>
              )}
            </div>
          )}
          {result.recommendation && result.recommendation.savingPence <= 0 && (
            <p className="cheapest-window-page__caveat">
              Based on your current tariff's average rate, this particular window wouldn't actually
              cost less than what you're already paying.
            </p>
          )}
          {!result.recommendation && (
            <p className="cheapest-window-page__caveat">
              <Link to="/connect-octopus">Import your usage history</Link> to see how much running it
              then could save you.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default CheapestWindowPage
