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
    expect(screen.getByText('9.7 kWh')).toBeInTheDocument()
    expect(screen.getByText(/£2\.58/)).toBeInTheDocument()
  })

  it('selects Compare tariff on click, exposing the new state via aria-selected/panel id and updating the figures', async () => {
    const user = userEvent.setup()
    renderDemo()

    await user.click(screen.getByRole('tab', { name: '2. Compare tariff' }))

    expect(screen.getByRole('tab', { name: '2. Compare tariff' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '1. Baseline' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'landing-demo-panel-compare')
    expect(screen.getByText(/£2\.82/)).toBeInTheDocument()
    expect(screen.getByText(/£0\.25 more/)).toBeInTheDocument()
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

  it('gives the heat map a text/DOM equivalent of its visual data, not canvas-only state', () => {
    renderDemo()
    // Every half-hour cell is a real <button> with a descriptive aria-label
    // (time, usage, rate, cost) -- see HeatMap.tsx -- so the grid's meaning
    // is readable without interpreting pixels.
    expect(screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ }).length).toBe(48)
  })

  it('exposes the CTA as a real link, not a click-only element', () => {
    renderDemo()
    expect(screen.getByRole('link', { name: /see my last 30 days/i })).toHaveAttribute('href', '/login')
  })
})
