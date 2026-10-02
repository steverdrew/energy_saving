import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type OctopusImportStatus } from '../api/client'
import { useOctopusConnection } from '../octopus/OctopusConnectionContext'
import './ConnectOctopusPage.css'

const ACCOUNT_NUMBER_RE = /^A-[A-Za-z0-9]{8}$/

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
          {importStatus?.imported ? (
            <p>
              Imported {importStatus.consumptionPoints} usage readings and {importStatus.ratePoints} tariff
              rates, covering {importStatus.periodFrom?.slice(0, 10)} to {importStatus.periodTo?.slice(0, 10)}.
            </p>
          ) : (
            <p>Import your recent half-hourly usage and tariff rate history to see your savings.</p>
          )}
          {importError && <p className="connect-octopus-page__error">{importError}</p>}
          <button type="button" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : importStatus?.imported ? 'Re-import' : 'Import my usage history'}
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
      <ul className="connect-octopus-page__help">
        <li>Your account number looks like <strong>A-12345678</strong> — find it on a bill or your Octopus online account.</li>
        <li>Your API key is in your Octopus online account's developer settings.</li>
      </ul>

      <form className="connect-octopus-page__form" onSubmit={handleSubmit}>
        <label>
          Account number
          <input
            type="text"
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="A-12345678"
            autoComplete="off"
          />
        </label>
        <label>
          API key
          <input
            type="password"
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </label>

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
