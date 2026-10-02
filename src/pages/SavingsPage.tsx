import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatGbp, formatSavingsEquivalent } from '../format'
import ActualPage from './ActualPage'
import ComparePage from './ComparePage'
import './SavingsPage.css'

// OA-41: the running total is its own, independent state -- it reflects
// confirmed cheapest-window actions, not whether today's Actual/Compare
// load succeeded, so it's fetched and shown regardless.
function SavedSoFar() {
  const [savedSoFarPence, setSavedSoFarPence] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.octopus
      .savingsTotal()
      .then((res) => {
        if (!cancelled && res) setSavedSoFarPence(res.savedSoFarPence)
      })
      .catch(() => {
        /* Non-essential — the rest of the page still works without it. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (savedSoFarPence === null) return null

  const equivalent = formatSavingsEquivalent(savedSoFarPence)

  return (
    <p className="savings-page__saved-so-far">
      Estimated saved so far: <strong>{formatGbp(savedSoFarPence)}</strong>
      {equivalent && <span className="savings-page__equivalent"> — {equivalent}</span>}
    </p>
  )
}

// OA-74: My Savings now leads with the same Actual -> Like-for-like
// journey as the standalone /actual and /compare pages (OA-71/OA-72),
// replacing the old Agile-only summary and its generic appliance
// "shifting opportunity" selector. That selector made a Step 3
// (shifting) claim from a generic appliance assumption; OA-73 hasn't
// defined a defensible shifting model yet, so no shifting claim belongs
// here until it has (see HANDOFF.md). The underlying cheapest-window
// backend capability is untouched -- only this page's use of it is retired.
function SavingsPage() {
  return (
    <section className="savings-page">
      <h1>My Savings</h1>
      <SavedSoFar />
      <ActualPage />
      <ComparePage />
    </section>
  )
}

export default SavingsPage
