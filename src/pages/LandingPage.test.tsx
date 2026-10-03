// @vitest-environment jsdom
// OA-168: replaces OA-111's "Hunt the energy vampires in your home" hook
// with the broader-proposition headline/subhead, plus a new quieter
// secondary CTA alongside the existing primary one.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

describe('LandingPage hero (OA-168)', () => {
  it('reads the new broader-proposition headline and subhead, not the old energy-vampires hook', () => {
    renderLandingPage()
    expect(screen.getByRole('heading', { name: 'Small changes. Bigger consequences.' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'See what your electricity is costing you, whether another tariff would suit you better, and what — if anything — is actually worth changing.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/hunt the energy vampires/i)).not.toBeInTheDocument()
  })

  it('shows "See how it works" as the hero\'s one CTA, jumping to the comparison demo', () => {
    renderLandingPage()
    const primary = screen.getByRole('link', { name: 'See how it works' })
    expect(primary).toHaveAttribute('href', '#comparison-demo')
    expect(primary).toHaveClass('landing-hero__cta')
    expect(screen.queryByText('Try a typical household')).not.toBeInTheDocument()
  })

  it('introduces no new savings or £ claims in the hero', () => {
    const { container } = renderLandingPage()
    const hero = container.querySelector('#hero')!
    // OA-171: the hero now legitimately names "Octopus Energy" once, in
    // the account-requirement note below the CTA (a prerequisite
    // disclosure, not a savings/behavioural claim) -- this no longer
    // blanket-forbids the word "octopus", only an actual money claim.
    expect(hero.textContent).not.toMatch(/£|save/i)
  })
})
