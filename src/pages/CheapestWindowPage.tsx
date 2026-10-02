import { useEffect, useState } from 'react'
import { ApiError, api, type CheapestWindowResult } from '../api/client'
import {
  DEFAULT_APPLIANCE_PROFILES,
  isEstimate,
  type ApplianceType,
} from '../domain/applianceProfile'
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

function CheapestWindowPage() {
  const [applianceType, setApplianceType] = useState<ApplianceType>(APPLIANCE_TYPES[0])
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<CheapestWindowResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const profile = DEFAULT_APPLIANCE_PROFILES[applianceType]

  useEffect(() => {
    let cancelled = false
    setPhase('loading')

    api.octopus
      .cheapestWindow(profile.typicalProgrammeDurationMinutes.value)
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
        </div>
      )}
    </section>
  )
}

export default CheapestWindowPage
