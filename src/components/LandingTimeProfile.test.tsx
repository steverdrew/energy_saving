// @vitest-environment jsdom
// OA-89: unit coverage for the replacement visual itself -- separate
// from LandingDemo.test.tsx's end-to-end step-switching coverage.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
      questionHeading="When do you use energy?"
      supportingCopy="Your typical day, half hour by half hour."
      result="6.8 kWh · £1.80"
      explanation="Example day"
      costNote="Figures show usage cost only."
      stepKey="baseline"
      showStructuralPeakAnnotation={false}
      priceStripShape="dynamic"
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

      // OA-131: price is now encoded on the dedicated price strip's own
      // segments, not on `.landing-time-profile__column` (the usage track
      // below it is deliberately a flat, uncoloured background).
      const segments = container.querySelectorAll('.landing-time-profile__price-segment')
      const colorsInWindow = new Set(
        Array.from(segments)
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

  // OA-131: the dedicated price strip above the chart -- shaped per
  // tariff rather than always showing 48 independent segments.
  describe('price strip (OA-131)', () => {
    it('renders a flat tariff as a single strip segment, not 48', () => {
      const { container } = renderProfile({ priceStripShape: 'flat' })
      const segments = container.querySelectorAll('.landing-time-profile__price-segment')
      expect(segments).toHaveLength(1)
    })

    it('renders a two-rate tariff (Economy 7) as its real day/night runs, never 48 independent segments', () => {
      const economy7Fixture = buildLandingDemoFixture(undefined, 'economy-7')
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const segments = container.querySelectorAll('.landing-time-profile__price-segment')
      // Economy 7 has exactly two distinct rates (day/night) -- the off-
      // peak window sits inside the day, so it renders as day-night-day
      // (3 runs), never one run per half-hour slot.
      expect(segments.length).toBeGreaterThan(1)
      expect(segments.length).toBeLessThan(economy7Fixture.compare.day.slots.length)
      const distinctColors = new Set(Array.from(segments, (el) => (el as HTMLElement).style.backgroundColor))
      expect(distinctColors.size).toBe(2)
    })

    it('renders a dynamic tariff (Agile) as 48 distinct segments', () => {
      const { container } = renderProfile({ day: fixture.compare.day, priceStripShape: 'dynamic' })
      expect(container.querySelectorAll('.landing-time-profile__price-segment')).toHaveLength(48)
    })

    it('shows a legend describing the strip itself, not the whole chart background', () => {
      renderProfile({ priceStripShape: 'flat' })
      expect(screen.getByText(/flat rate/i)).toBeInTheDocument()
    })

    it('exposes the exact rate for a strip segment via its accessible name, reachable without hover', () => {
      const { container } = renderProfile({ day: fixture.compare.day, priceStripShape: 'dynamic' })
      const firstSegment = container.querySelector('.landing-time-profile__price-segment') as HTMLElement
      expect(firstSegment.tagName.toLowerCase()).toBe('button')
      expect(firstSegment.getAttribute('aria-label')).toMatch(/p\/kWh/)
    })
  })

  // OA-133: Economy 7 must read as two explicit states, never a
  // continuous cheaper -> more-expensive gradient, and the off-peak
  // window shown must be the real 7-hour one from the data.
  describe('Economy 7 binary visual (OA-133)', () => {
    const economy7Fixture = buildLandingDemoFixture(undefined, 'economy-7')

    it('shows the legend as explicit day-rate/off-peak states with the real off-peak time range, not a gradient', () => {
      renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      expect(screen.getByText(/day rate/i)).toBeInTheDocument()
      expect(screen.getByText(/off-peak 1:30–8:30/i)).toBeInTheDocument()
      expect(screen.queryByText(/cheaper.*more expensive/i)).not.toBeInTheDocument()
    })

    it('covers the full 7-hour off-peak period, not a shorter convenient block', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const rates = economy7Fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
      const offPeakRate = Math.min(...rates.filter((r): r is number => r !== null))
      const offPeakSlotCount = rates.filter((r) => r === offPeakRate).length
      expect(offPeakSlotCount).toBe(14) // 14 half-hour slots = 7 hours
      // Day (0-2) -> off-peak (3-16) -> day (17-47): three runs, not one
      // segment per slot and not a shorter hard-coded block.
      const segments = container.querySelectorAll('.landing-time-profile__price-segment')
      expect(segments.length).toBe(3)
    })

    it('renders exactly two distinct tones, not a sample from the continuous ramp', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const segments = Array.from(container.querySelectorAll('.landing-time-profile__price-segment')) as HTMLElement[]
      const colors = segments.map((el) => el.style.backgroundColor)
      // Day-rate segments (first and last) share one tone; the off-peak
      // segment (middle) has the other.
      expect(colors[0]).toBe(colors[2])
      expect(colors[0]).not.toBe(colors[1])
    })
  })

  // OA-98/OA-100/OA-110: the narrative (question heading/supporting copy/
  // result/explanation/caveat) lives inside this same card, above the
  // chart, instead of a separate column. `heading` itself (distinct from
  // OA-110's visible `questionHeading`) still isn't rendered -- the
  // section's one real top-level heading, "Typical household", lives in
  // LandingDemo.tsx; `heading` here is only the chart's accessible name.
  describe('narrative', () => {
    it('renders the question heading, supporting copy, result and explanation, in that order, above the chart', () => {
      renderProfile({
        heading: 'Baseline chart',
        questionHeading: 'When do you use energy?',
        supportingCopy: 'Your typical day, half hour by half hour.',
        result: '6.8 kWh · £1.80',
        explanation: 'This is the baseline.',
      })

      expect(screen.getByRole('heading', { name: 'When do you use energy?' })).toBeInTheDocument()
      expect(screen.queryByText('Baseline chart')).not.toBeInTheDocument()
      expect(screen.getByText('Your typical day, half hour by half hour.')).toBeInTheDocument()
      expect(screen.getByText('6.8 kWh · £1.80')).toBeInTheDocument()
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

    // OA-108: `explanation`/`caveat` accept any ReactNode (not just a
    // plain string) so a caller can hand this component a structured
    // block -- e.g. a heading plus a "View assumptions" disclosure --
    // without this component knowing anything about that structure.
    it('renders a structured ReactNode explanation/caveat, not just plain text', () => {
      renderProfile({
        explanation: (
          <>
            <h3>How we calculated it</h3>
            <p>Short method sentence.</p>
          </>
        ),
        caveat: (
          <details>
            <summary>View assumptions</summary>
            <p>Some assumption.</p>
          </details>
        ),
      })
      expect(screen.getByRole('heading', { name: 'How we calculated it' })).toBeInTheDocument()
      expect(screen.getByText('View assumptions').tagName.toLowerCase()).toBe('summary')
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
      expect(container.querySelector('.landing-time-profile__event-chip[data-fixed]')).toBeInTheDocument()
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

    // OA-107: "if multiple events overlap in time, place them in separate
    // visual lanes/rows so both remain legible" -- two overlays that
    // share a half-hour get different `top` offsets, rather than both
    // sitting at the same position (which is what made labels collide).
    describe('collision-safe lanes (OA-107)', () => {
      it('places two time-overlapping events in different lanes (different top offsets)', () => {
        const { container } = renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [
            movableEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 10, slotCount: 4 }),
            movableEvent({ id: 'ev_charging', label: 'EV charging', startSlot: 12, slotCount: 4 }),
          ],
        })
        const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
        const ev = screen.getByRole('slider', { name: /ev charging/i })
        expect(dishwasher.getAttribute('style')).not.toEqual(null)
        expect((dishwasher as HTMLElement).style.top).not.toBe((ev as HTMLElement).style.top)
        // Both still render -- lanes solve the label collision without
        // hiding either overlapping, individually-valid event.
        expect(container.querySelectorAll('.landing-time-profile__event-chip:not([data-fixed])')).toHaveLength(2)
      })

      it('keeps two non-overlapping events in the same lane (same top offset)', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [
            movableEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 10, slotCount: 2 }),
            movableEvent({ id: 'washing_machine', label: 'Washing machine cycle', startSlot: 20, slotCount: 2 }),
          ],
        })
        const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
        const washingMachine = screen.getByRole('slider', { name: /washing machine cycle/i })
        expect((dishwasher as HTMLElement).style.top).toBe((washingMachine as HTMLElement).style.top)
      })

      it('gives a third, simultaneously time-overlapping event its own third lane', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [
            movableEvent({ id: 'a', label: 'Event A', startSlot: 10, slotCount: 6 }),
            movableEvent({ id: 'b', label: 'Event B', startSlot: 10, slotCount: 6 }),
            movableEvent({ id: 'c', label: 'Event C', startSlot: 10, slotCount: 6 }),
          ],
        })
        const tops = new Set(
          ['Event A', 'Event B', 'Event C'].map(
            (name) => (screen.getByRole('slider', { name: new RegExp(name, 'i') }) as HTMLElement).style.top,
          ),
        )
        expect(tops.size).toBe(3)
      })
    })

    // OA-107: "when space is constrained, show the event name only" --
    // below the compact-label threshold, only the bare label is shown
    // (the full name/time text is still available via a movable event's
    // own aria-valuetext; no native title tooltip -- removed as UI clutter
    // since the chip's own label is never truncated).
    describe('compact labels for narrow events (OA-107)', () => {
      it('shows the full "name · time" label for a wide-enough event', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent({ startSlot: 10, slotCount: 4 })],
        })
        const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
        expect(slider).toHaveTextContent('–') // an en dash only appears in a time range
      })

      it('shows only the event name for a narrow event, keeping the full detail available via aria', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent({ startSlot: 10, slotCount: 2 })],
        })
        const slider = screen.getByRole('slider', { name: /dishwasher cycle/i })
        expect(slider.textContent?.trim()).toBe('Dishwasher cycle')
        expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('Dishwasher cycle'))
      })

      it('applies the same compact-label rule to a fixed annotation', () => {
        const { container } = renderProfile({
          day: fixture.baseline.day,
          heading: 'Baseline',
          events: [{ id: 'oven_cooking', label: 'Oven (cooking)', startSlot: 35, slotCount: 2, movable: false }],
        })
        const annotation = container.querySelector('.landing-time-profile__event-chip[data-fixed]')!
        expect(annotation.textContent?.trim()).toBe('Oven (cooking)')
      })
    })

    // OA-108: "per-event feedback should appear contextually... in/near
    // the event block itself when it's selected, focused, or being
    // dragged" -- replaces the old permanent per-appliance list.
    describe('contextual saving popover (OA-108)', () => {
      it('shows the popover only while its own event is focused, and not for a different event', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [
            movableEvent(),
            movableEvent({ id: 'washing_machine', label: 'Washing machine cycle', startSlot: 14, minStartSlot: 14, maxStartSlot: 44 }),
          ],
          eventSavingText: (id) => (id === 'dishwasher' ? 'Saves £0.21 this cycle' : undefined),
        })

        expect(screen.queryByRole('status')).not.toBeInTheDocument()

        const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
        fireEvent.focus(dishwasher)
        expect(screen.getByRole('status')).toHaveTextContent('Saves £0.21 this cycle')

        fireEvent.blur(dishwasher)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()

        // A different event with no saving text never shows a popover,
        // even while focused.
        const washingMachine = screen.getByRole('slider', { name: /washing machine cycle/i })
        fireEvent.focus(washingMachine)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      it('also shows the popover on pointer hover/drag, not only keyboard focus', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent()],
          eventSavingText: () => 'Saves £0.21 this cycle',
        })

        const dishwasher = screen.getByRole('slider', { name: /dishwasher cycle/i })
        fireEvent.pointerEnter(dishwasher)
        expect(screen.getByRole('status')).toBeInTheDocument()

        fireEvent.pointerLeave(dishwasher)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      it('includes the saving text in aria-valuetext for screen readers, even without hover/focus state', () => {
        renderProfile({
          day: fixture.optimise.day,
          heading: 'Optimise',
          events: [movableEvent()],
          eventSavingText: () => 'Saves £0.21 this cycle',
        })

        expect(screen.getByRole('slider', { name: /dishwasher cycle/i })).toHaveAttribute(
          'aria-valuetext',
          expect.stringContaining('Saves £0.21 this cycle'),
        )
      })
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
        expect(container.querySelector('.landing-time-profile__event-chip[data-fixed]')).not.toBeInTheDocument()
      })

      it('does not render an overlay with zero or negative slot count', () => {
        const { container } = renderProfile({
          day: fixture.baseline.day,
          heading: 'Baseline',
          events: [{ id: 'empty', label: 'Empty load', startSlot: 4, slotCount: 0, movable: false }],
        })
        expect(container.querySelector('.landing-time-profile__event-chip[data-fixed]')).not.toBeInTheDocument()
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
