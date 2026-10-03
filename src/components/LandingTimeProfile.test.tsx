// @vitest-environment jsdom
// OA-89: unit coverage for the replacement visual itself -- separate
// from LandingDemo.test.tsx's end-to-end step-switching coverage.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLandingDemoFixture } from '../domain/landingDemoFixture'
import LandingTimeProfile, { type LandingTimeProfileEventOverlay } from './LandingTimeProfile'

afterEach(cleanup)

const fixture = buildLandingDemoFixture()

function renderProfile(overrides: Partial<React.ComponentProps<typeof LandingTimeProfile>> = {}) {
  return render(
    <LandingTimeProfile
      day={fixture.baseline.day}
      heading="Baseline"
      summary="Standard Variable · 6.8 kWh · £1.80"
      explanation="Example day"
      costNote="Figures show usage cost only."
      stepKey="baseline"
      showStructuralPeakAnnotation={false}
      {...overrides}
    />,
  )
}

describe('LandingTimeProfile', () => {
  it('renders one column per half-hour slot, each a real button with an accessible description', () => {
    renderProfile()
    const columns = screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ })
    expect(columns).toHaveLength(48)
  })

  it('shows no detail line until a column is selected, then reveals it live', async () => {
    const user = userEvent.setup()
    renderProfile()

    expect(screen.queryByText(/kWh.*p\/kWh.*£/)).not.toBeInTheDocument()

    const firstColumn = screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ })[0]
    await user.click(firstColumn)

    const detail = screen.getByText(/kWh.*p\/kWh.*£/)
    expect(detail.closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('is operable by keyboard alone via roving tabindex and arrow keys', async () => {
    const user = userEvent.setup()
    renderProfile()

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
    renderProfile()
    expect(screen.getByRole('table', { name: /baseline/i })).toBeInTheDocument()
  })

  // OA-97: the usage profile is one smooth SVG path across all 48 slots,
  // not 48 independent bars.
  it('renders the usage profile as a single smooth path spanning all 48 slots', () => {
    const { container } = renderProfile()
    const svg = container.querySelector('.landing-time-profile__usage-path')
    expect(svg).toHaveAttribute('viewBox', '0 0 48 1')
    const path = svg?.querySelector('path')
    expect(path).toBeTruthy()
    expect(path?.getAttribute('d')).toMatch(/^M /)
    expect(container.querySelectorAll('.landing-time-profile__usage-bar')).toHaveLength(0)
  })

  // OA-101: Agile has 48 distinct half-hourly prices, not three fixed
  // tariff bands -- the legend reads as a continuous cheaper/more
  // expensive scale on every tab, not a Cheap/Standard/Peak label set.
  describe('legend', () => {
    it('shows the continuous cheaper/more-expensive price legend, not Cheap/Standard/Peak labels', () => {
      renderProfile()
      expect(screen.getByText(/Cheaper/)).toBeInTheDocument()
      expect(screen.getByText(/More expensive/)).toBeInTheDocument()
      expect(screen.queryByText('Cheap')).not.toBeInTheDocument()
      expect(screen.queryByText('Standard')).not.toBeInTheDocument()
      expect(screen.queryByText('Peak')).not.toBeInTheDocument()
    })

    it('shows the same continuous legend for a flat-rate day as for a day with real price variation', () => {
      renderProfile({ day: fixture.compare.day, heading: 'Compare' })
      expect(screen.getByText(/Cheaper/)).toBeInTheDocument()
      expect(screen.getByText(/More expensive/)).toBeInTheDocument()
    })

    it('always shows the Usage legend item alongside the price legend', () => {
      renderProfile()
      expect(screen.getAllByText('Usage').length).toBeGreaterThan(0)
    })
  })

  // OA-99/OA-101: Agile's documented 16:00-19:00 structural peak window
  // is annotated, but every half-hour still keeps its own distinct
  // background colour -- this is not a fixed "Peak rate" band.
  describe('structural peak annotation', () => {
    it('annotates the 16:00-19:00 window without collapsing it into one fixed-rate band', () => {
      const { container } = renderProfile({
        day: fixture.compare.day,
        heading: 'Compare',
        showStructuralPeakAnnotation: true,
      })
      expect(screen.getByText('4–7pm peak period')).toBeInTheDocument()

      const columns = container.querySelectorAll('.landing-time-profile__column')
      const colorsInWindow = new Set(
        Array.from(columns)
          .slice(32, 38)
          .map((el) => (el as HTMLElement).style.backgroundColor),
      )
      // Every half-hour within the structural window still has its own
      // price, so the window is not rendered as one uniform colour.
      expect(colorsInWindow.size).toBeGreaterThan(1)
    })

    // OA-99: the structural peak is a documented feature of Agile's own
    // pricing formula -- not shown on a flat Standard Variable day, which
    // has no such structural feature.
    it('is not shown when showStructuralPeakAnnotation is false, even across the same clock window', () => {
      renderProfile({ day: fixture.compare.day, heading: 'Compare', showStructuralPeakAnnotation: false })
      expect(screen.queryByText('4–7pm peak period')).not.toBeInTheDocument()
    })
  })

  // OA-98/OA-100: the narrative (summary/explanation/caveat) lives inside
  // this same card, above the chart, instead of a separate column -- and,
  // as of OA-100, with no visible per-state heading (the section's one
  // heading, "Typical household", lives in LandingDemo.tsx; `heading` here
  // is only the chart's accessible name).
  describe('narrative', () => {
    it('renders the summary and explanation, in that order, above the legend, with no visible heading', () => {
      renderProfile({
        heading: 'Baseline chart',
        summary: 'Standard Variable · 6.8 kWh · £1.80',
        explanation: 'This is the baseline.',
      })

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(screen.queryByText('Baseline chart')).not.toBeInTheDocument()
      expect(screen.getByText('Standard Variable · 6.8 kWh · £1.80')).toBeInTheDocument()
      expect(screen.getByText('This is the baseline.')).toBeInTheDocument()
    })

    it('still uses `heading` as the chart group and sr-table\'s accessible name', () => {
      renderProfile({ heading: 'Baseline chart' })
      expect(screen.getByRole('group', { name: 'Baseline chart' })).toBeInTheDocument()
      expect(screen.getByRole('table', { name: /baseline chart/i })).toBeInTheDocument()
    })

    // OA-99: shown identically on every tab -- the headline £ figure is
    // usage cost only, never silently mixed with the standing charge.
    it('renders the cost-basis note', () => {
      renderProfile({ costNote: 'Figures show usage cost only — excludes the standing charge.' })
      expect(screen.getByText('Figures show usage cost only — excludes the standing charge.')).toBeInTheDocument()
    })

    it('omits the caveat line when none is given', () => {
      const { container } = renderProfile()
      expect(container.querySelector('.landing-time-profile__caveat')).not.toBeInTheDocument()
    })

    it('renders an optional caveat line when given', () => {
      renderProfile({ caveat: 'Illustrative example only.' })
      expect(screen.getByText('Illustrative example only.')).toBeInTheDocument()
    })
  })

  // OA-105: every household event overlays the track on every tab -- fixed
  // annotations when not movable, a draggable slider (Optimise only) when
  // movable.
  describe('event overlays', () => {
    function movableEvent(
      overrides: Partial<Extract<LandingTimeProfileEventOverlay, { movable: true }>> = {},
    ): LandingTimeProfileEventOverlay {
      return {
        id: 'dishwasher',
        label: 'Dishwasher cycle',
        startSlot: 4,
        slotCount: 2,
        movable: true,
        minStartSlot: 0,
        maxStartSlot: 46,
        onMove: () => {},
        ...overrides,
      }
    }

    it('renders no overlay when no events are given', () => {
      renderProfile()
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      expect(screen.queryByText(/dishwasher cycle/i)).not.toBeInTheDocument()
    })

    it('renders a fixed, non-interactive annotation for a non-movable event', () => {
      const { container } = renderProfile({
        day: fixture.baseline.day,
        heading: 'Baseline',
        events: [{ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 4, slotCount: 2, movable: false }],
      })
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      expect(container.querySelector('.landing-time-profile__event-annotation')).toBeInTheDocument()
      expect(screen.getByText(/dishwasher cycle/i)).toBeInTheDocument()
    })

    it('renders a slider positioned and labelled at its current slot for a movable event', () => {
      renderProfile({ day: fixture.optimise.day, heading: 'Optimise', events: [movableEvent()] })
      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      expect(slider).toHaveAttribute('aria-valuenow', '4')
      expect(slider).toHaveAttribute('aria-valuemin', '0')
      expect(slider).toHaveAttribute('aria-valuemax', '46')
      expect(screen.getByText(/dishwasher cycle/i)).toBeInTheDocument()
    })

    it('renders several events at once, each independently', () => {
      renderProfile({
        day: fixture.optimise.day,
        heading: 'Optimise',
        events: [
          movableEvent(),
          movableEvent({ id: 'washing_machine', label: 'Washing machine cycle', startSlot: 14, minStartSlot: 14, maxStartSlot: 44 }),
        ],
      })
      expect(screen.getByRole('slider', { name: /dishwasher cycle/i })).toBeInTheDocument()
      expect(screen.getByRole('slider', { name: /washing machine cycle/i })).toBeInTheDocument()
    })

    it('moves one slot per arrow key press, clamped to that event\'s own valid window', async () => {
      const user = userEvent.setup()
      const onMove = vi.fn()
      renderProfile({ day: fixture.optimise.day, heading: 'Optimise', events: [movableEvent({ onMove })] })

      const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
      slider.focus()

      await user.keyboard('{ArrowRight}')
      expect(onMove).toHaveBeenLastCalledWith(5)

      await user.keyboard('{ArrowLeft}')
      expect(onMove).toHaveBeenLastCalledWith(3)
    })

    it('does not move past the minimum start slot', async () => {
      const user = userEvent.setup()
      const onMove = vi.fn()
      renderProfile({
        day: fixture.optimise.day,
        heading: 'Optimise',
        events: [movableEvent({ startSlot: 0, onMove })],
      })

      screen.getByRole('slider', { name: /dishwasher cycle/i }).focus()
      await user.keyboard('{ArrowLeft}')
      expect(onMove).toHaveBeenLastCalledWith(0)
    })

    it('does not move past the maximum start slot', async () => {
      const user = userEvent.setup()
      const onMove = vi.fn()
      renderProfile({
        day: fixture.optimise.day,
        heading: 'Optimise',
        events: [movableEvent({ startSlot: 46, onMove })],
      })

      screen.getByRole('slider', { name: /dishwasher cycle/i }).focus()
      await user.keyboard('{ArrowRight}')
      expect(onMove).toHaveBeenLastCalledWith(46)
    })

    // OA-106: an overlay must never render unless it has a real id/label,
    // positive duration and a start slot that actually resolves to slots
    // in this day -- the chart's own defence against an empty/orphan
    // outlined block, independent of whatever LandingDemo.tsx passes in.
    describe('empty/orphan overlay guard (OA-106)', () => {
      it('does not render a fixed annotation with a blank label', () => {
        const { container } = renderProfile({
          day: fixture.baseline.day,
          heading: 'Baseline',
          events: [{ id: 'ghost', label: '   ', startSlot: 4, slotCount: 2, movable: false }],
        })
        expect(container.querySelector('.landing-time-profile__event-annotation')).not.toBeInTheDocument()
      })

      it('does not render an overlay with zero or negative slot count', () => {
        const { container } = renderProfile({
          day: fixture.baseline.day,
          heading: 'Baseline',
          events: [{ id: 'empty', label: 'Empty load', startSlot: 4, slotCount: 0, movable: false }],
        })
        expect(container.querySelector('.landing-time-profile__event-annotation')).not.toBeInTheDocument()
        expect(screen.queryByText(/empty load/i)).not.toBeInTheDocument()
      })

      it('does not render a movable overlay whose slots fall outside the day', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent({ startSlot: 47, slotCount: 2 })],
        })
        expect(screen.queryByRole('slider')).not.toBeInTheDocument()
      })

      it('renders only one overlay when the events array repeats the same id', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent(), movableEvent()],
        })
        expect(screen.getAllByRole('slider', { name: /dishwasher cycle/i })).toHaveLength(1)
      })

      it('still renders every valid overlay alongside a filtered-out invalid one', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [
            movableEvent(),
            { id: 'ghost', label: '', startSlot: 10, slotCount: 2, movable: false },
          ],
        })
        expect(screen.getByRole('slider', { name: /dishwasher cycle/i })).toBeInTheDocument()
        expect(screen.queryByText(/ghost/i)).not.toBeInTheDocument()
      })
    })
  })
})
