// @vitest-environment jsdom
// OA-168: replaces OA-111's "Hunt the energy vampires in your home" hook
// with the broader-proposition headline/subhead, plus a new quieter
// secondary CTA alongside the existing primary one.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import LandingPage from './LandingPage'

afterEach(cleanup)

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage hero (OA-168/OA-171)', () => {
  it('reads the literal, persona-led headline and subhead, not the old brand-led or energy-vampires hooks', () => {
    renderLandingPage()
    expect(screen.getByRole('heading', { name: 'See where you could save on your electricity bill.' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'We use your actual electricity use to compare tariffs, find things you could run at cheaper times, and show how much those changes could save you.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/hunt the energy vampires/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Small changes. Bigger consequences.')).not.toBeInTheDocument()
  })

  it('shows "See how it works" as the hero\'s one CTA, jumping to the comparison demo', () => {
    renderLandingPage()
    const primary = screen.getByRole('link', { name: 'See how it works' })
    expect(primary).toHaveAttribute('href', '#comparison-demo')
    expect(primary).toHaveClass('landing-hero__cta')
    expect(screen.queryByText('Try a typical household')).not.toBeInTheDocument()
  })

  it('shows the Octopus account requirement under the CTA, linking to the Octopus explainer', () => {
    const { container } = renderLandingPage()
    const hero = container.querySelector('#hero')!
    expect(within(hero as HTMLElement).getByText(/Requires an Octopus Energy account/)).toBeInTheDocument()
    const learnMore = within(hero as HTMLElement).getByRole('link', { name: 'Why Octopus?' })
    expect(learnMore).toHaveAttribute('href', '/why-octopus')
  })
})
