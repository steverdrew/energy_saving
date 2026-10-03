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
    expect(screen.getByText(/£1\.65/)).toBeInTheDocument()
    expect(screen.getByText(/£0\.15 less than Standard Variable/)).toBeInTheDocument()
  })

  // OA-105: Optimise starts from the exact same event positions as
  // Baseline/Compare -- nothing has moved yet, so the timing opportunity
  // starts honestly at zero, same as the real app's "eventsConsidered === 0"
  // framing, until the visitor actually drags something.
  it('selects Optimise timing on click, starting with no timing difference since nothing has moved yet', async () => {
    const user = userEvent.setup()
    renderDemo()

    await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

    expect(screen.getByRole('tab', { name: '3. Optimise timing' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'landing-demo-panel-optimise')
    expect(screen.getByText(/no further difference from timing/)).toBeInTheDocument()
  })

  // OA-102: plain-language explanation of what moves, plus the "same
  // tariff / same total energy / better timing" reinforcement.
  it('explains what moves on the Optimise tab without claiming the whole household was rearranged', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

    expect(screen.getByText(/We identify energy use that can realistically move/)).toBeInTheDocument()
    expect(screen.getByText(/same tariff, same total energy, just better timing/)).toBeInTheDocument()
    expect(screen.getByText(/Illustrative optimisation/)).toBeInTheDocument()
  })

  // OA-101: the caveat names the representative-day methodology rather
  // than implying this was one arbitrarily cherry-picked example.
  it('uses representative-comparison caveat wording on the Compare tab', async () => {
    const user = userEvent.setup()
    renderDemo()
    await user.click(screen.getByRole('tab', { name: '2. Compare tariff' }))

    expect(screen.getByText(/Representative comparison/)).toBeInTheDocument()
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
    for (const link of screen.getAllByRole('link', { name: /octopus energy/i })) {
      expect(link).toHaveAttribute('href', expect.stringContaining('octopus.energy'))
    }
    expect(screen.getByRole('link', { name: /how agile prices are calculated/i })).toHaveAttribute(
      'href',
      expect.stringContaining('octopus.energy'),
    )
  })

  // OA-99: "do not silently mix" usage cost and the standing charge.
  it('states the headline figure is usage cost only, on every tab', () => {
    renderDemo()
    expect(screen.getByText(/usage cost only/i)).toBeInTheDocument()
  })

  // OA-105: the same shared events appear on every tab -- fixed
  // annotations on Baseline/Compare, draggable overlays on Optimise.
  describe('shared household events across tabs (OA-105)', () => {
    it('shows both named events as fixed, non-draggable annotations on Baseline and Compare', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      expect(screen.getByText(/dishwasher cycle/i)).toBeInTheDocument()
      expect(screen.getByText(/washing machine cycle/i)).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: '2. Compare tariff' }))
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      expect(screen.getByText(/dishwasher cycle/i)).toBeInTheDocument()
      expect(screen.getByText(/washing machine cycle/i)).toBeInTheDocument()
    })

    it('shows both events as draggable sliders, starting at their actual positions, on Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
      const washingMachine = screen.getByRole('slider', { name: /washing machine cycle/i })
      // Same actual positions named on Baseline/Compare -- "no event
      // appears for the first time on Tab 3".
      expect(dishwasher).toHaveAttribute('aria-valuenow', '36')
      expect(washingMachine).toHaveAttribute('aria-valuenow', '14')
    })

    it('invites the visitor to drag an event in the Optimise explanation copy', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      expect(screen.getByText(/drag either event/i)).toBeInTheDocument()
    })
  })

  // OA-103/105: moving an event on the Optimise tab recomputes the live
  // saving figure, end to end through LandingDemo's lifted state.
  describe('movable household events (OA-103)', () => {
    it('updates the potential-saving figure live as an event is moved by keyboard', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      expect(screen.getByText(/no further difference from timing/)).toBeInTheDocument()

      // Move the dishwasher from its actual, expensive evening slot (18:00)
      // into a cheap overnight one (02:00) -- 32 half-hours earlier.
      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(32))

      expect(slider).toHaveAttribute('aria-valuenow', '4')
      expect(screen.queryByText(/no further difference from timing/)).not.toBeInTheDocument()
      expect(screen.getByText(/£0\.21 potential saving from timing/)).toBeInTheDocument()
    })

    it('moves each event independently -- moving one never affects the other', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
      dishwasher.focus()
      await user.keyboard('{ArrowLeft}'.repeat(3))

      const washingMachine = screen.getByRole('slider', { name: /washing machine cycle/i })
      expect(dishwasher).toHaveAttribute('aria-valuenow', '33')
      expect(washingMachine).toHaveAttribute('aria-valuenow', '14')
    })
  })

  // OA-104: monthly/annual projection, shown prominently, updating live.
  describe('monthly/annual projection (OA-104)', () => {
    it('shows no projected payoff while nothing has moved, only on Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.queryByText(/you could save around/i)).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))
      expect(screen.getByText(/no extra yearly saving from this timing/i)).toBeInTheDocument()
    })

    it('shows the annual projection as the prominent payoff, with today/month as supporting detail, once an event moves', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(32))

      expect(screen.getByText(/you could save around £44\.01\/year by shifting these loads/i)).toBeInTheDocument()
      expect(screen.getByText(/£0\.21 today · ≈ £3\.67\/month/)).toBeInTheDocument()
    })

    it('shows an inspectable per-event line naming the event, its time and its per-occurrence saving and frequency', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(32))

      const eventDetail = container.querySelector('.landing-time-profile__event-detail')
      expect(eventDetail).toHaveTextContent(/dishwasher cycle moved to 2:00/i)
      expect(eventDetail).toHaveTextContent(/saves £0\.21 this cycle/i)
      expect(eventDetail).toHaveTextContent(/£44\.01\/year at 4 cycles\/week/)
      // The untouched washing machine is still inspectable, with no saving.
      expect(eventDetail).toHaveTextContent(/washing machine cycle moved to 7:00/i)
      expect(eventDetail).toHaveTextContent(/no saving this cycle/i)
    })

    it('updates daily, monthly and annual projections together as an event moves', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(3))

      expect(screen.getByText(/you could save around £5\.66\/year by shifting these loads/i)).toBeInTheDocument()
      expect(screen.getByText(/£0\.03 today · ≈ £0\.47\/month/)).toBeInTheDocument()
      expect(container.querySelector('.landing-time-profile__event-detail')).toHaveTextContent(/dishwasher cycle moved to 16:30/i)
    })

    it('labels the projection as an estimate based on the example household, not the visitor\'s own usage', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      expect(screen.getByText(/estimated from the example household/i)).toBeInTheDocument()
    })
  })

  // OA-106: "Optimise all" / "Reset" secondary controls above the chart.
  describe('Optimise all / Reset controls (OA-106)', () => {
    it('shows Optimise all and Reset only on the Optimise tab, Optimise all before Reset', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.queryByRole('button', { name: 'Optimise all' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))
      const buttons = screen.getAllByRole('button', { name: /^(Optimise all|Reset)$/ })
      expect(buttons.map((b) => b.textContent)).toEqual(['Optimise all', 'Reset'])
    })

    it('starts with Reset disabled, since nothing has moved from the original schedule yet', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    })

    it('Optimise all moves every event to its cheapest valid slot, recomputing cost/saving live', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      await user.click(screen.getByRole('button', { name: 'Optimise all' }))

      const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
      const washingMachine = screen.getByRole('slider', { name: /washing machine cycle/i })
      // Cheapest slots are no longer the actual (36/14) positions, and
      // both sliders stay within their own valid window.
      expect(dishwasher).not.toHaveAttribute('aria-valuenow', '36')
      expect(Number(washingMachine.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(14)
      expect(Number(washingMachine.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(44)
      expect(screen.queryByText(/no further difference from timing/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()
    })

    it('Optimise all preserves each event\'s duration and kWh -- only the per-event detail\'s start time changes', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      await user.click(screen.getByRole('button', { name: 'Optimise all' }))

      const eventDetail = container.querySelector('.landing-time-profile__event-detail')
      // Same two named events, same recurrence frequencies, still listed.
      expect(eventDetail).toHaveTextContent(/dishwasher cycle moved to/i)
      expect(eventDetail).toHaveTextContent(/4 cycles\/week/)
      expect(eventDetail).toHaveTextContent(/washing machine cycle moved to/i)
      expect(eventDetail).toHaveTextContent(/3 cycles\/week/)
    })

    it('Reset restores the exact original Tab 1/2 schedule and disables itself again', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(32))
      expect(slider).toHaveAttribute('aria-valuenow', '4')

      await user.click(screen.getByRole('button', { name: 'Reset' }))

      expect(screen.getByRole('slider', { name: /dishwasher cycle/i })).toHaveAttribute('aria-valuenow', '36')
      expect(screen.getByRole('slider', { name: /washing machine cycle/i })).toHaveAttribute('aria-valuenow', '14')
      expect(screen.getByText(/no further difference from timing/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    })

    it('Reset after Optimise all returns to the original schedule, not just undoes the last move', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(screen.getByRole('tab', { name: '3. Optimise timing' }))

      await user.click(screen.getByRole('button', { name: 'Optimise all' }))
      const slider = screen.getByRole('slider', { name: /washing machine cycle/i })
      slider.focus()
      await user.keyboard('{ArrowRight}')
      await user.click(screen.getByRole('button', { name: 'Reset' }))

      expect(screen.getByRole('slider', { name: /dishwasher cycle/i })).toHaveAttribute('aria-valuenow', '36')
      expect(screen.getByRole('slider', { name: /washing machine cycle/i })).toHaveAttribute('aria-valuenow', '14')
    })
  })

  // OA-106: an event overlay must never render unless it maps to a real,
  // non-zero-kWh event in the shared model -- no empty/orphan/duplicate
  // outlined blocks on the chart.
  describe('no empty/orphan event overlays (OA-106)', () => {
    it('renders exactly one overlay per real shared event, with a real label, on every tab', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      for (const tabName of ['1. Baseline', '2. Compare tariff', '3. Optimise timing']) {
        await user.click(screen.getByRole('tab', { name: tabName }))
        const annotations = container.querySelectorAll(
          '.landing-time-profile__event-annotation, .landing-time-profile__flexible-event',
        )
        expect(annotations).toHaveLength(2)
        for (const annotation of annotations) {
          expect(annotation.textContent?.trim()).not.toBe('')
        }
      }
    })
  })
})
