import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type OctopusImportStatus } from '../api/client'
import { useOctopusConnection } from '../octopus/OctopusConnectionContext'
import './ConnectOctopusPage.css'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

// OA-60: "where do I find this?" help for each credential field --
// collapsed by default so it doesn't crowd the form, expandable without
// losing anything already typed (it's just local UI state, not a
// navigation). No screenshot is embedded here yet -- doing that honestly
// needs a real, authenticated Octopus dashboard to photograph, which only
// Steve has access to; see HANDOFF.md.
function CredentialHelp({ steps, linkHref, linkLabel }: { steps: string[]; linkHref: string; linkLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="connect-octopus-page__field-help">
      <button
        type="button"
        className="connect-octopus-page__field-help-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Where do I find this?
      </button>
      {open && (
        <div className="connect-octopus-page__field-help-panel">
          <ol>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <a href={linkHref} target="_blank" rel="noopener noreferrer">
            {linkLabel} →
          </a>
        </div>
      )}
    </div>
  )
}

function FieldWithHelp({ children, help }: { children: ReactNode; help: ReactNode }) {
  return (
    <div className="connect-octopus-page__field">
      {children}
      {help}
    </div>
  )
}

function describeConnectError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return err.message || "That account number or API key wasn't accepted. Double-check both and try again."
    }
    if (err.status === 400) {
      return err.message
    }
    if (err.status === 502) {
      return "We couldn't reach Octopus right now. Please try again in a moment."
    }
  }
  return 'Something went wrong connecting your account. Please try again.'
}

function describeImportError(err: unknown): string {
  if (err instanceof ApiError && (err.status === 400 || err.status === 401)) {
    return err.message
  }
  return "We couldn't import your usage history right now. Please try again."
}

// OA-63: the six states the ticket asks for -- each with copy that's
// visibly different from the others, including from itself across a
// re-run, so clicking the button is never ambiguous about what happened.
function ImportStatusMessage({
  importing,
  importError,
  importStatus,
}: {
  importing: boolean
  importError: string | null
  importStatus: OctopusImportStatus | null
}) {
  if (importing) return <p>Importing…</p>
  if (importError) return <p className="connect-octopus-page__error">{importError}</p>
  if (!importStatus || importStatus.status === 'not_imported') {
    return <p>Import your recent half-hourly usage and tariff rate history to see your savings.</p>
  }
  if (importStatus.status === 'success') {
    return (
      <p>
        Imported {importStatus.consumptionPoints} usage readings and {importStatus.ratePoints} tariff
        rates, covering {importStatus.periodFrom?.slice(0, 10)} to {importStatus.periodTo?.slice(0, 10)}.
      </p>
    )
  }
  if (importStatus.status === 'partial') {
    const missingConsumption = !importStatus.consumptionPoints
    return (
      <p>
        We could only import part of your usage history: {missingConsumption ? 'no usage readings' : 'no tariff rates'}{' '}
        came back from Octopus, though {missingConsumption ? 'tariff rates did' : 'usage readings did'}. This can
        happen if your account or meter is still being set up.
      </p>
    )
  }
  return (
    <p>
      We couldn't import your usage history yet. Octopus returned no usage or tariff data for this
      period — this can happen if your account or meter is still being set up, or you've only just
      switched tariffs.
    </p>
  )
}

function ConnectOctopusPage() {
  const { connection, loading: loadingStatus, setConnection } = useOctopusConnection()

  const [accountNumber, setAccountNumber] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const [importStatus, setImportStatus] = useState<OctopusImportStatus | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    if (!connection?.connected) return
    let cancelled = false
    api.octopus
      .importStatus()
      .then((result) => {
        if (!cancelled) setImportStatus(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connection?.connected])

  async function handleImport() {
    setImporting(true)
    setImportError(null)
    try {
      const result = await api.octopus.import()
      if (result) setImportStatus(result)
    } catch (err) {
      setImportError(describeImportError(err))
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setSubmitError(null)

    const normalized = accountNumber.trim().toUpperCase()
    if (!ACCOUNT_NUMBER_RE.test(normalized)) {
      setFieldError('Account number should look like A-XXXXXXXX.')
      return
    }
    if (!apiKey.trim()) {
      setFieldError('Enter your Octopus API key.')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.octopus.connect({ accountNumber: normalized, apiKey: apiKey.trim() })
      if (result) setConnection(result)
      setAccountNumber('')
      setApiKey('')
    } catch (err) {
      setSubmitError(describeConnectError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await api.octopus.disconnect()
      setConnection({ connected: false })
    } finally {
      setDisconnecting(false)
    }
  }

  if (loadingStatus) return null

  if (connection?.connected) {
    return (
      <section className="connect-octopus-page">
        <h1>Octopus account</h1>
        <div className="connect-octopus-page__status">
          <p>
            Connected: <strong>{connection.accountNumberRedacted}</strong>
          </p>
          {connection.meterContext?.tariffCode && (
            <p className="connect-octopus-page__meta">Tariff: {connection.meterContext.tariffCode}</p>
          )}
          <button type="button" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>

        <div className="connect-octopus-page__import">
          <h2>Usage history</h2>
          <ImportStatusMessage importing={importing} importError={importError} importStatus={importStatus} />
          {importStatus?.importedAt && !importing && (
            <p className="connect-octopus-page__meta">
              Last checked: {new Date(importStatus.importedAt).toLocaleString('en-GB')}
            </p>
          )}
          <button type="button" onClick={handleImport} disabled={importing}>
            {importing
              ? 'Importing…'
              : importStatus?.imported
                ? importStatus.status === 'success'
                  ? 'Re-import'
                  : 'Try import again'
                : 'Import my usage history'}
          </button>
        </div>

        <p className="connect-octopus-page__next">
          <Link to="/savings">See my savings</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="connect-octopus-page">
      <h1>Connect Octopus</h1>
      <p className="connect-octopus-page__intro">
        Enter your Octopus Energy account number and API key. This is a temporary MVP
        connection method — it'll be replaced by a proper Octopus sign-in later.
      </p>
      <form className="connect-octopus-page__form" onSubmit={handleSubmit}>
        <FieldWithHelp
          help={
            <CredentialHelp
              steps={[
                'Open your Octopus dashboard.',
                'Find your account number in your account details/dashboard.',
                'Copy the value beginning with A- and paste it here.',
              ]}
              linkHref="https://octopus.energy/dashboard/"
              linkLabel="Open Octopus dashboard"
            />
          }
        >
          <label>
            Octopus account number
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="A-12345678"
              autoComplete="off"
            />
            <span className="connect-octopus-page__field-helper-text">
              Your account number starts with <strong>A-</strong>.
            </span>
          </label>
        </FieldWithHelp>

        <FieldWithHelp
          help={
            <CredentialHelp
              steps={[
                'Open Octopus API access while signed in.',
                'Copy your API key.',
                'Return to Shift & Save and paste it here.',
              ]}
              linkHref="https://octopus.energy/dashboard/new/accounts/personal-details/api-access/"
              linkLabel="Open Octopus API access"
            />
          }
        >
          <label>
            Octopus API key
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <span className="connect-octopus-page__field-helper-text">
              This is a private key from your Octopus account. We use it only to read the energy
              data needed for your analysis.
            </span>
          </label>
        </FieldWithHelp>

        {fieldError && <p className="connect-octopus-page__error">{fieldError}</p>}
        {submitError && <p className="connect-octopus-page__error">{submitError}</p>}

        <button type="submit" className="connect-octopus-page__submit" disabled={submitting}>
          {submitting ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </section>
  )
}

export default ConnectOctopusPage
