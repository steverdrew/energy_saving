// @vitest-environment jsdom
// OA-169: the "Why Octopus?" origin-story page -- personal, not an
// affiliate pitch, with an explicit non-affiliation statement.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import WhyOctopusPage from './WhyOctopusPage'

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter>
      <WhyOctopusPage />
    </MemoryRouter>,
  )
}

describe('WhyOctopusPage (OA-169)', () => {
  it('explains Octopus and that we use it ourselves', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { name: 'What is Octopus Energy — and why did we start there?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/we.re octopus customers ourselves/i)).toBeInTheDocument()
  })

  it('credits the open customer-data/developer-tooling approach, and hopes it continues', () => {
    renderPage()
    expect(screen.getByText(/developer tools/i)).toBeInTheDocument()
    expect(screen.getByText('Long may that continue.')).toBeInTheDocument()
  })

  it('states the product is independent and not an Octopus companion app', () => {
    renderPage()
    expect(screen.getByText(/we are not building an octopus companion app/i)).toBeInTheDocument()
  })

  it('includes a clear non-affiliation / non-endorsement statement', () => {
    renderPage()
    expect(
      screen.getByText(/is an independent tool and is not affiliated with or endorsed by octopus energy/i),
    ).toBeInTheDocument()
  })

  it('never reads like a supplier-switching pitch', () => {
    renderPage()
    expect(screen.queryByText(/you should switch to octopus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/octopus is the best supplier/i)).not.toBeInTheDocument()
  })
})
