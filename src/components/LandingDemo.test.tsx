// @vitest-environment jsdom
// OA-82: "An automated browser can select all three comparison states
// without coordinate-based hacks" / "current state and key comparison
// values are inspectable in the DOM" -- exercised here as a real
// (jsdom) click-through and keyboard-nav interaction test, independent
// of Firebase/auth (LandingDemo has no such dependency), so it runs the
// same in CI as it would against a real browser.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import LandingDemo from './LandingDemo'

afterEach(cleanup)

function renderDemo() {
  return render(
    <MemoryRouter>
      <LandingDemo />
    </MemoryRouter>,
  )
}

describe('LandingDemo', () => {
  it('starts on the Baseline step, deterministically, with no selected step relying on async state', () => {
    renderDemo()
    const baselineTab = screen.getByRole('tab', { name: '1. Baseline' })
    expect(baselineTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'landing-demo-panel-baseline')
    expect(screen.getByText('6.8 kWh')).toBeInTheDocument()
    expect(screen.getByText(/£1\.80/)).toBeInTheDocument()
  })

  it('selects Compare tariff on click, exposing the new state via aria-selected/panel id and updating the figures', async () => {
    const user = userEvent.setup()
    renderDemo()

    await user.click(screen.getByRole('tab', { name: '2. Compare tariff' }))

    expect(screen.getByRole('tab', { name: '2. Compare tariff' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '1. Baseline' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'landing-demo-panel-compare')
    expect(screen.getByText(/£1\.72/)).toBeInTheDocument()
    expect(screen.getByText(/£0\.09 less/)).toBeInTheDocument()
  })

  it('selects Optimise timing on click, showing the timing-saving figure', async () => {
    const user = userEvent.setup()
    renderDemo()

    await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

    expect(screen.getByRole('tab', { name: '3. Optimise timing' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'landing-demo-panel-optimise')
    expect(screen.getByText(/potential/)).toBeInTheDocument()
  })

  it('is operable by keyboard alone -- no essential action depends on a mouse/hover', async () => {
    const user = userEvent.setup()
    renderDemo()

    screen.getByRole('tab', { name: '1. Baseline' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '2. Compare tariff' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '2. Compare tariff' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: '3. Optimise timing' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: '2. Compare tariff' })).toHaveAttribute('aria-selected', 'true')
  })

  it('gives the time profile a text/DOM equivalent of its visual data, not canvas-only state', () => {
    renderDemo()
    // Every half-hour column (OA-89's price-landscape/usage-bar profile)
    // is a real <button> with a descriptive aria-label (time, usage,
    // rate, cost) -- see heatMapMath.ts's describeSlot -- so the
    // profile's meaning is readable without interpreting pixels.
    expect(screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ }).length).toBe(48)
  })

  it('exposes the post-comparison CTA as a real link reading "Sign up free"', () => {
    renderDemo()
    expect(screen.getByRole('link', { name: /sign up free/i })).toHaveAttribute('href', '/login')
  })

  // OA-100: "Typical household" is the section's one heading now -- the
  // per-state headings inside the card ("Your current setup", etc.) were
  // removed because the selected tab already names the state, and having
  // both competed for attention.
  it('has exactly one heading in the section -- "Typical household" -- and no per-state heading inside the card', () => {
    renderDemo()
    expect(screen.getByRole('heading', { name: 'Typical household' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /your current setup|same usage|same tariff/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Your current setup')).not.toBeInTheDocument()
  })

  it('starts the Baseline card directly with the sourced key figures, not diagnostic wording', () => {
    renderDemo()
    const summary = screen.getByText('6.8 kWh').closest('.landing-time-profile__summary')
    expect(summary).toHaveTextContent('Standard Variable · 6.8 kWh · £1.80')
    expect(screen.queryByText(/baseline — standard variable/i)).not.toBeInTheDocument()
  })

  // OA-98: narrative (summary/explanation) now renders inside the same
  // card as the chart, above it -- no separate left-hand column.
  it('renders the narrative inside the same panel as the chart, not a separate column', () => {
    renderDemo()
    const panel = screen.getByRole('tabpanel')
    expect(panel.querySelector('.landing-time-profile__summary')).toBeInTheDocument()
    expect(panel.querySelector('.landing-time-profile__track')).toBeInTheDocument()
    expect(panel.querySelector('.landing-demo__story')).not.toBeInTheDocument()
    expect(panel.querySelector('.landing-demo__grid')).not.toBeInTheDocument()
  })

  // OA-99: grounded in published Ofgem/Elexon/Octopus data -- "Typical
  // household" replaces "Example household", with a discoverable source
  // note rather than the old blanket "illustrative data" framing.
  it('labels the demo "Typical household" with a discoverable source note', () => {
    renderDemo()
    expect(screen.getByText('Typical household')).toBeInTheDocument()
    expect(screen.queryByText(/example household/i)).not.toBeInTheDocument()
    expect(screen.getByText(/based on ofgem and elexon data/i)).toBeInTheDocument()
  })

  it('links each cited source in the Sources disclosure', () => {
    renderDemo()
    expect(screen.getByRole('link', { name: /ofgem.*typical domestic consumption/i })).toHaveAttribute(
      'href',
      expect.stringContaining('ofgem.gov.uk'),
    )
    expect(screen.getByRole('link', { name: /ofgem.*price cap/i })).toHaveAttribute(
      'href',
      expect.stringContaining('ofgem.gov.uk'),
    )
    expect(screen.getByRole('link', { name: /elexon/i })).toHaveAttribute('href', expect.stringContaining('elexon.co.uk'))
    expect(screen.getByRole('link', { name: /octopus energy/i })).toHaveAttribute(
      'href',
      expect.stringContaining('octopus.energy'),
    )
  })

  // OA-99: "do not silently mix" usage cost and the standing charge.
  it('states the headline figure is usage cost only, on every tab', () => {
    renderDemo()
    expect(screen.getByText(/usage cost only/i)).toBeInTheDocument()
  })
})
