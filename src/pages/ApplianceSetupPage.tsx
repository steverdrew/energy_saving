import { useEffect, useState } from 'react'
import {
  ApiError,
  api,
  type HouseholdApplianceRecord,
  type HouseholdApplianceType,
} from '../api/client'
import './ApplianceSetupPage.css'

type Phase = 'loading' | 'result' | 'error'

// OA-81: the same four categories OA-76's first implementation models --
// a category not here is fixed load until a future ticket explicitly
// adds it, never silently treated as flexible (docs/SHIFTING_METHODOLOGY.md).
const SUPPORTED_APPLIANCES: { type: HouseholdApplianceType; label: string }[] = [
  { type: 'dishwasher', label: 'Dishwasher' },
  { type: 'washing_machine', label: 'Washing machine' },
  { type: 'tumble_dryer', label: 'Tumble dryer' },
  { type: 'dehumidifier', label: 'Dehumidifier' },
]

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return 'Something went wrong saving your appliances. Please try again.'
}

function sourceBadge(source: HouseholdApplianceRecord['durationMinutes']['source']): string {
  if (source === 'user_confirmed') return 'You told us this'
  if (source === 'device_reported' || source === 'manufacturer_profile') return 'Measured / connected'
  return "We'll estimate this"
}

interface DraftValues {
  durationMinutes: string
  energyKwh: string
}

// OA-81: lets a household declare the flexible appliances they use, and
// optionally confirm real runtime/energy -- OA-30 remains the one
// canonical appliance-profile model; this page only ever reads/writes
// the household's own record of it, never a parallel appliance model.
// Per the ticket, this never identifies a historical event or creates a
// Step 3 saving by itself -- it only improves the evidence OA-76 could
// use once event confirmation exists.
function ApplianceSetupPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [appliances, setAppliances] = useState<Record<string, HouseholdApplianceRecord>>({})
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({})
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  function loadAppliances() {
    setPhase('loading')
    api.householdAppliances
      .list()
      .then((res) => {
        if (!res) return
        const byType: Record<string, HouseholdApplianceRecord> = {}
        for (const appliance of res.appliances) byType[appliance.applianceType] = appliance
        setAppliances(byType)
        setDrafts((prev) => {
          const next = { ...prev }
          for (const appliance of res.appliances) {
            if (!next[appliance.applianceType]) {
              next[appliance.applianceType] = {
                durationMinutes: String(appliance.durationMinutes.value),
                energyKwh: String(appliance.energyKwh.value),
              }
            }
          }
          return next
        })
        setPhase('result')
      })
      .catch((err) => {
        setError(describeError(err))
        setPhase('error')
      })
  }

  useEffect(() => {
    loadAppliances()
  }, [])

  function toggleAppliance(type: HouseholdApplianceType, checked: boolean) {
    setError(null)
    const action = checked ? api.householdAppliances.add(type) : api.householdAppliances.remove(type)
    action
      .then(() => loadAppliances())
      .catch((err) => setError(describeError(err)))
  }

  function saveConfirmedValues(type: HouseholdApplianceType) {
    const draft = drafts[type]
    if (!draft) return
    const durationMinutes = Number(draft.durationMinutes)
    const energyKwh = Number(draft.energyKwh)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(energyKwh) || energyKwh <= 0) {
      setError('Runtime and energy must both be positive numbers.')
      return
    }
    setError(null)
    api.householdAppliances
      .update(type, { durationMinutes, energyKwh })
      .then(() => {
        setSavedFlash(type)
        setTimeout(() => setSavedFlash(null), 2000)
        loadAppliances()
      })
      .catch((err) => setError(describeError(err)))
  }

  return (
    <section className="appliance-setup-page">
      <h1>Your appliances</h1>
      <p className="appliance-setup-page__intro">
        Which flexible appliances do you actually use? We'll assume a typical duration and energy use for each — you can
        tell us the real figures if you know them, but you don't need to. You can finish this without knowing brand,
        model, runtime or kWh.
      </p>

      {phase === 'error' && <p className="appliance-setup-page__error">{error}</p>}

      <div className="appliance-setup-page__list">
        {SUPPORTED_APPLIANCES.map(({ type, label }) => {
          const appliance = appliances[type]
          const checked = Boolean(appliance)
          const draft = drafts[type]
          return (
            <div className="appliance-setup-page__row" key={type}>
              <label className="appliance-setup-page__checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={phase === 'loading'}
                  onChange={(e) => toggleAppliance(type, e.target.checked)}
                />
                {label}
              </label>

              {appliance && draft && (
                <div className="appliance-setup-page__details">
                  <div className="appliance-setup-page__field">
                    <label htmlFor={`${type}-duration`}>Typical runtime (minutes)</label>
                    <input
                      id={`${type}-duration`}
                      type="number"
                      min={1}
                      value={draft.durationMinutes}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], durationMinutes: e.target.value } }))
                      }
                    />
                    <span className="appliance-setup-page__badge" data-source={appliance.durationMinutes.source}>
                      {sourceBadge(appliance.durationMinutes.source)}
                    </span>
                  </div>

                  <div className="appliance-setup-page__field">
                    <label htmlFor={`${type}-energy`}>Typical energy per cycle (kWh)</label>
                    <input
                      id={`${type}-energy`}
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={draft.energyKwh}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], energyKwh: e.target.value } }))}
                    />
                    <span className="appliance-setup-page__badge" data-source={appliance.energyKwh.source}>
                      {sourceBadge(appliance.energyKwh.source)}
                    </span>
                  </div>

                  {appliance.requiresAwakeHome.value && (
                    <p className="appliance-setup-page__saved">
                      We'll only ever suggest moving this while your household is plausibly awake (07:00–23:00).
                    </p>
                  )}

                  <button type="button" className="appliance-setup-page__save" onClick={() => saveConfirmedValues(type)}>
                    Save my own figures
                  </button>
                  {savedFlash === type && <span className="appliance-setup-page__saved">Saved.</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default ApplianceSetupPage
