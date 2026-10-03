// @vitest-environment jsdom
// OA-89: unit coverage for the replacement visual itself -- separate
// from LandingDemo.test.tsx's end-to-end step-switching coverage.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLandingDemoFixture } from '../domain/landingDemoFixture'
import LandingTimeProfile from './LandingTimeProfile'

afterEach(cleanup)

const fixture = buildLandingDemoFixture()

describe('LandingTimeProfile', () => {
  it('renders one column per half-hour slot, each a real button with an accessible description', () => {
    render(<LandingTimeProfile day={fixture.baseline.day} title="Baseline" subtitle="Example day" />)
    const columns = screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ })
    expect(columns).toHaveLength(48)
  })

  it('shows no detail line until a column is selected, then reveals it live', async () => {
    const user = userEvent.setup()
    render(<LandingTimeProfile day={fixture.baseline.day} title="Baseline" subtitle="Example day" />)

    expect(screen.queryByText(/kWh.*p\/kWh.*£/)).not.toBeInTheDocument()

    const firstColumn = screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ })[0]
    await user.click(firstColumn)

    const detail = screen.getByText(/kWh.*p\/kWh.*£/)
    expect(detail.closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('is operable by keyboard alone via roving tabindex and arrow keys', async () => {
    const user = userEvent.setup()
    render(<LandingTimeProfile day={fixture.baseline.day} title="Baseline" subtitle="Example day" />)

    const columns = screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ })
    expect(columns[0]).toHaveAttribute('tabindex', '0')
    expect(columns[1]).toHaveAttribute('tabindex', '-1')

    columns[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(columns[1]).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(columns[0]).toHaveFocus()
  })

  it('always exposes a visually-hidden exact-values table, independent of selection state', () => {
    render(<LandingTimeProfile day={fixture.baseline.day} title="Baseline" subtitle="Example day" />)
    expect(screen.getByRole('table', { name: /baseline/i })).toBeInTheDocument()
  })
})
