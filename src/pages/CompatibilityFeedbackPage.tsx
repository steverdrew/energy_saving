import { useState, type FormEvent } from 'react'
import { ApiError, api, type CompatibilityDeviceType } from '../api/client'
import './CompatibilityFeedbackPage.css'

const DEVICE_TYPES: { value: CompatibilityDeviceType; label: string }[] = [
  { value: 'washing_machine', label: 'Washing machine' },
  { value: 'dishwasher', label: 'Dishwasher' },
  { value: 'tumble_dryer', label: 'Tumble dryer' },
  { value: 'dehumidifier', label: 'Dehumidifier' },
  { value: 'smart_plug', label: 'Smart plug' },
  { value: 'ev_charger', label: 'EV charger' },
  { value: 'battery', label: 'Battery' },
  { value: 'heating_heat_pump', label: 'Heating / heat pump' },
  { value: 'other', label: 'Other' },
]

type Phase = 'form' | 'submitting' | 'done' | 'error'

function CompatibilityFeedbackPage() {
  const [deviceType, setDeviceType] = useState<CompatibilityDeviceType>('washing_machine')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [smartPlugBrandModel, setSmartPlugBrandModel] = useState('')
  const [connectedPlatform, setConnectedPlatform] = useState('')
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>('form')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPhase('submitting')
    api.compatibility
      .submitRequest({
        deviceType,
        brand: brand || undefined,
        model: model || undefined,
        smartPlugBrandModel: smartPlugBrandModel || undefined,
        connectedPlatform: connectedPlatform || undefined,
        note: note || undefined,
      })
      .then(() => setPhase('done'))
      .catch((err: unknown) => {
        console.error(err instanceof ApiError ? err.message : err)
        setPhase('error')
      })
  }

  if (phase === 'done') {
    return (
      <section className="compat-feedback-page">
        <h1>Thanks — got it.</h1>
        <p>
          This helps us decide what Shift &amp; Save supports next. It's not a promise that we'll
          support this yet, but real requests like yours are what drive what we build.
        </p>
      </section>
    )
  }

  return (
    <section className="compat-feedback-page">
      <h1>Tell us what you have</h1>
      <p className="compat-feedback-page__intro">
        Can't connect your appliance or device? Tell us the brand and model (if you know it) — this
        helps us decide what to build next. It doesn't promise an integration.
      </p>

      <form onSubmit={handleSubmit} className="compat-feedback-page__form">
        <label>
          Appliance / device type
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as CompatibilityDeviceType)}
          >
            {DEVICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Brand (optional)
          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>

        <label>
          Model (optional)
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} />
        </label>

        <label>
          Smart plug brand/model, if relevant (optional)
          <input
            type="text"
            value={smartPlugBrandModel}
            onChange={(e) => setSmartPlugBrandModel(e.target.value)}
          />
        </label>

        <label>
          Connected app/platform, if you know it (optional)
          <input
            type="text"
            value={connectedPlatform}
            onChange={(e) => setConnectedPlatform(e.target.value)}
          />
        </label>

        <label>
          Anything else? (optional)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>

        {phase === 'error' && (
          <p className="compat-feedback-page__error">Something went wrong sending that. Please try again.</p>
        )}

        <button type="submit" disabled={phase === 'submitting'}>
          {phase === 'submitting' ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  )
}

export default CompatibilityFeedbackPage
