// @vitest-environment jsdom
// OA-89: unit coverage for the replacement visual itself -- separate
// from LandingDemo.test.tsx's end-to-end step-switching coverage.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
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

      // OA-131: price is now encoded on the dedicated rate bar's own
      // segments, not on `.landing-time-profile__column` (the usage track
      // below it is deliberately a flat, uncoloured background).
      const segments = container.querySelectorAll('.landing-time-profile__rate-bar-segment')
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

  // OA-131/OA-168: the dedicated rate bar above the chart -- shaped per
  // tariff rather than always showing 48 independent segments, and (since
  // the redesign) a plain track that only highlights the genuinely
  // distinct 'two-rate' off-peak segment, rather than colouring every
  // segment.
  describe('rate bar (OA-131/OA-168)', () => {
    it('renders a flat tariff as a single strip segment, not 48', () => {
      const { container } = renderProfile({ priceStripShape: 'flat' })
      const segments = container.querySelectorAll('.landing-time-profile__rate-bar-segment')
      expect(segments).toHaveLength(1)
    })

    it('renders a two-rate tariff (Economy 7) as its real day/night runs, with only the off-peak run highlighted', () => {
      const economy7Fixture = buildLandingDemoFixture(undefined, 'economy-7')
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const segments = container.querySelectorAll('.landing-time-profile__rate-bar-segment')
      // Economy 7 has exactly two distinct rates (day/night) -- the off-
      // peak window sits inside the day, so it renders as day-night-day
      // (3 runs), never one run per half-hour slot.
      expect(segments.length).toBeGreaterThan(1)
      expect(segments.length).toBeLessThan(economy7Fixture.compare.day.slots.length)
      const offPeakSegments = container.querySelectorAll('.landing-time-profile__rate-bar-segment[data-offpeak]')
      expect(offPeakSegments).toHaveLength(1)
    })

    it('renders a dynamic tariff (Agile) as 48 distinct segments', () => {
      const { container } = renderProfile({ day: fixture.compare.day, priceStripShape: 'dynamic' })
      expect(container.querySelectorAll('.landing-time-profile__rate-bar-segment')).toHaveLength(48)
    })

    it('shows a legend describing the bar itself, not the whole chart background', () => {
      renderProfile({ priceStripShape: 'flat' })
      expect(screen.getByText(/flat rate/i)).toBeInTheDocument()
    })

    it('exposes the exact rate for a bar segment via its accessible name, reachable without hover', () => {
      const { container } = renderProfile({ day: fixture.compare.day, priceStripShape: 'dynamic' })
      const firstSegment = container.querySelector('.landing-time-profile__rate-bar-segment') as HTMLElement
      expect(firstSegment.tagName.toLowerCase()).toBe('button')
      expect(firstSegment.getAttribute('aria-label')).toMatch(/p\/kWh/)
    })
  })

  // OA-133/OA-168: Economy 7 must read as two explicit states, never a
  // continuous cheaper -> more-expensive gradient, and the off-peak
  // window shown (both the legend and the chart's own background tint)
  // must be the real 7-hour one from the data.
  describe('Economy 7 off-peak highlight (OA-133/OA-168)', () => {
    const economy7Fixture = buildLandingDemoFixture(undefined, 'economy-7')

    it('shows the legend as explicit day-rate/off-peak states with the real off-peak time range, not a gradient', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const legend = container.querySelector('.landing-time-profile__price-legend')!
      expect(legend.textContent).toMatch(/day rate/i)
      expect(legend.textContent).toMatch(/off-peak/i)
      expect(legend.textContent).toMatch(/1:30–8:30/)
      expect(legend.textContent).not.toMatch(/cheaper.*more expensive/i)
    })

    it('covers the full 7-hour off-peak period, not a shorter convenient block', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const rates = economy7Fixture.compare.day.slots.map((s) => s.unitRateIncVatPence)
      const offPeakRate = Math.min(...rates.filter((r): r is number => r !== null))
      const offPeakSlotCount = rates.filter((r) => r === offPeakRate).length
      expect(offPeakSlotCount).toBe(14) // 14 half-hour slots = 7 hours
      // Day (0-2) -> off-peak (3-16) -> day (17-47): three runs, not one
      // segment per slot and not a shorter hard-coded block.
      const segments = container.querySelectorAll('.landing-time-profile__rate-bar-segment')
      expect(segments.length).toBe(3)
    })

    it('highlights exactly the middle (off-peak) run, not the day-rate runs either side of it', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      const segments = Array.from(container.querySelectorAll('.landing-time-profile__rate-bar-segment'))
      expect(segments.map((el) => el.hasAttribute('data-offpeak'))).toEqual([false, true, false])
    })

    it('shades the chart background across the same off-peak window the legend/bar highlight', () => {
      const { container } = renderProfile({ day: economy7Fixture.compare.day, priceStripShape: 'two-rate' })
      expect(container.querySelector('.landing-time-profile__offpeak-band')).toBeInTheDocument()
    })

    it('shows no off-peak background band for a flat or dynamic tariff', () => {
      const { container: flatContainer } = renderProfile({ priceStripShape: 'flat' })
      expect(flatContainer.querySelector('.landing-time-profile__offpeak-band')).not.toBeInTheDocument()

      const { container: dynamicContainer } = renderProfile({ day: fixture.compare.day, priceStripShape: 'dynamic' })
      expect(dynamicContainer.querySelector('.landing-time-profile__offpeak-band')).not.toBeInTheDocument()
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

  // OA-105/OA-168: every household event overlays the track on every tab,
  // as a plain, non-interactive annotation card -- overlapping/adjacent
  // events merge into one grouped card (see `groupOverlappingEvents` in
  // the component) rather than needing separate lanes, now that nothing
  // here is draggable.
  describe('event overlays', () => {
    function plainEvent(overrides: Partial<LandingTimeProfileEventOverlay> = {}): LandingTimeProfileEventOverlay {
      return {
        id: 'dishwasher',
        label: 'Dishwasher cycle',
        startSlot: 4,
        slotCount: 2,
        ...overrides,
      }
    }

    it('renders no card when no events are given', () => {
      const { container } = renderProfile()
      expect(container.querySelector('.landing-time-profile__event-card')).not.toBeInTheDocument()
      expect(screen.queryByText(/dishwasher cycle/i)).not.toBeInTheDocument()
    })

    it('renders a single event as its own card, naming it and its time range', () => {
      renderProfile({ events: [plainEvent()] })
      expect(screen.getByText('Dishwasher cycle')).toBeInTheDocument()
      // An en dash only appears in a time range.
      const card = screen.getByText('Dishwasher cycle').closest('.landing-time-profile__event-card')!
      expect(card.textContent).toMatch(/–/)
    })

    it('renders two non-overlapping events as two separate cards', () => {
      const { container } = renderProfile({
        events: [
          plainEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 4, slotCount: 2 }),
          plainEvent({ id: 'washing_machine', label: 'Washing machine cycle', startSlot: 20, slotCount: 2 }),
        ],
      })
      expect(screen.getByText('Dishwasher cycle')).toBeInTheDocument()
      expect(screen.getByText('Washing machine cycle')).toBeInTheDocument()
      expect(container.querySelectorAll('.landing-time-profile__event-card')).toHaveLength(2)
    })

    // OA-168: replaces the old per-event lane system -- two events whose
    // time spans overlap (or sit close enough to be adjacent) now merge
    // into one card with a bullet list, rather than each getting its own
    // lane.
    describe('grouping overlapping/adjacent events (OA-168)', () => {
      it('merges two time-overlapping events into a single card listing both names', () => {
        const { container } = renderProfile({
          events: [
            plainEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 10, slotCount: 4 }),
            plainEvent({ id: 'ev_charging', label: 'EV charging', startSlot: 12, slotCount: 4 }),
          ],
        })
        const cards = container.querySelectorAll('.landing-time-profile__event-card')
        expect(cards).toHaveLength(1)
        expect(cards[0].textContent).toMatch(/dishwasher cycle/i)
        expect(cards[0].textContent).toMatch(/ev charging/i)
        expect(cards[0].querySelector('.landing-time-profile__event-card-list')).toBeInTheDocument()
      })

      it('keeps two non-overlapping events as two separate single-name cards', () => {
        const { container } = renderProfile({
          events: [
            plainEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 10, slotCount: 2 }),
            plainEvent({ id: 'washing_machine', label: 'Washing machine cycle', startSlot: 20, slotCount: 2 }),
          ],
        })
        const cards = container.querySelectorAll('.landing-time-profile__event-card')
        expect(cards).toHaveLength(2)
        for (const card of Array.from(cards)) {
          expect(card.querySelector('.landing-time-profile__event-card-list')).not.toBeInTheDocument()
        }
      })

      it('merges three simultaneously time-overlapping events into one card', () => {
        const { container } = renderProfile({
          events: [
            plainEvent({ id: 'a', label: 'Event A', startSlot: 10, slotCount: 6 }),
            plainEvent({ id: 'b', label: 'Event B', startSlot: 10, slotCount: 6 }),
            plainEvent({ id: 'c', label: 'Event C', startSlot: 10, slotCount: 6 }),
          ],
        })
        const cards = container.querySelectorAll('.landing-time-profile__event-card')
        expect(cards).toHaveLength(1)
        expect(cards[0].textContent).toMatch(/event a/i)
        expect(cards[0].textContent).toMatch(/event b/i)
        expect(cards[0].textContent).toMatch(/event c/i)
      })

      it('shows a small clock mark only on a grouped (multi-event) card, not a single-event one', () => {
        const { container } = renderProfile({
          events: [
            plainEvent({ id: 'dishwasher', label: 'Dishwasher cycle', startSlot: 10, slotCount: 4 }),
            plainEvent({ id: 'ev_charging', label: 'EV charging', startSlot: 12, slotCount: 4 }),
            plainEvent({ id: 'oven_cooking', label: 'Oven', startSlot: 35, slotCount: 2 }),
          ],
        })
        const cards = Array.from(container.querySelectorAll('.landing-time-profile__event-card'))
        const groupedCard = cards.find((c) => /dishwasher cycle/i.test(c.textContent ?? ''))!
        const singleCard = cards.find((c) => /oven/i.test(c.textContent ?? ''))!
        expect(groupedCard.querySelector('.landing-time-profile__event-card-clock')).toBeInTheDocument()
        expect(singleCard.querySelector('.landing-time-profile__event-card-clock')).not.toBeInTheDocument()
      })
    })

    // OA-165: a safety-constrained event (e.g. the tumble dryer, kept out
    // of an overnight window on purpose) gets an info icon explaining why,
    // distinguishing it from an event whose window is merely narrow
    // because nothing cheaper was available -- works on hover, focus, and
    // tap alike, not just a native (hover-only, touch-absent) title.
    describe('safety constraint info icon (OA-165/OA-167)', () => {
      it('renders no info icon when an event has no safety constraint note', () => {
        renderProfile({ events: [plainEvent()] })
        expect(screen.queryByRole('button', { name: /why is/i })).not.toBeInTheDocument()
      })

      it('shows the safety-constraint explanation on hover, hides it on unhover', async () => {
        const user = userEvent.setup()
        renderProfile({
          events: [
            plainEvent({
              id: 'tumble_dryer',
              label: 'Tumble dryer',
              startSlot: 17,
              slotCount: 3,
              safetyConstraintNote: 'Kept in a daytime window for safety.',
            }),
          ],
        })
        const trigger = screen.getByRole('button', { name: /why is tumble dryer kept in this window/i })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

        await user.hover(trigger)
        expect(screen.getByRole('tooltip')).toHaveTextContent('Kept in a daytime window for safety.')

        await user.unhover(trigger)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })

      it('shows the safety-constraint explanation on tap/click, closing again on a tap elsewhere', () => {
        renderProfile({
          events: [
            plainEvent({
              id: 'tumble_dryer',
              label: 'Tumble dryer',
              startSlot: 17,
              slotCount: 3,
              safetyConstraintNote: 'Kept in a daytime window for safety.',
            }),
          ],
        })
        const trigger = screen.getByRole('button', { name: /why is tumble dryer kept in this window/i })

        fireEvent.click(trigger)
        expect(screen.getByRole('tooltip')).toHaveTextContent('Kept in a daytime window for safety.')

        fireEvent.pointerDown(document.body)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })

      it('shows the safety-constraint explanation on keyboard focus', () => {
        renderProfile({
          events: [
            plainEvent({
              id: 'tumble_dryer',
              label: 'Tumble dryer',
              startSlot: 17,
              slotCount: 3,
              safetyConstraintNote: 'Kept in a daytime window for safety.',
            }),
          ],
        })
        const trigger = screen.getByRole('button', { name: /why is tumble dryer kept in this window/i })
        fireEvent.focus(trigger)
        expect(screen.getByRole('tooltip')).toHaveTextContent('Kept in a daytime window for safety.')

        fireEvent.blur(trigger)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })

      it('gives each constrained appliance in a grouped card its own info icon', () => {
        renderProfile({
          events: [
            plainEvent({
              id: 'tumble_dryer',
              label: 'Tumble dryer',
              startSlot: 10,
              slotCount: 4,
              safetyConstraintNote: 'Kept in a daytime window for safety.',
            }),
            plainEvent({ id: 'ev_charging', label: 'EV charging', startSlot: 12, slotCount: 4 }),
          ],
        })
        expect(screen.getByRole('button', { name: /why is tumble dryer kept in this window/i })).toBeInTheDocument()
      })
    })

    // OA-108: a short, quiet per-event saving note -- shown directly in a
    // single-event card (a grouped card stays a plain bullet list).
    describe('per-event saving note (OA-108)', () => {
      it('shows the saving note in a single-event card when given', () => {
        renderProfile({ events: [plainEvent({ savingText: 'Saves £0.21 this cycle' })] })
        expect(screen.getByText('Saves £0.21 this cycle')).toBeInTheDocument()
      })

      it('omits the saving note entirely when none is given', () => {
        const { container } = renderProfile({ events: [plainEvent()] })
        expect(container.querySelector('.landing-time-profile__event-card-saving')).not.toBeInTheDocument()
      })
    })

    // OA-106: an overlay must never render unless it has a real id/label,
    // positive duration and a start slot that actually resolves to slots
    // in this day -- the chart's own defence against an empty/orphan
    // outlined block, independent of whatever LandingDemo.tsx passes in.
    describe('empty/orphan overlay guard (OA-106)', () => {
      it('does not render a card with a blank label', () => {
        const { container } = renderProfile({ events: [plainEvent({ id: 'ghost', label: '   ' })] })
        expect(container.querySelector('.landing-time-profile__event-card')).not.toBeInTheDocument()
      })

      it('does not render an overlay with zero or negative slot count', () => {
        const { container } = renderProfile({ events: [plainEvent({ id: 'empty', label: 'Empty load', slotCount: 0 })] })
        expect(container.querySelector('.landing-time-profile__event-card')).not.toBeInTheDocument()
        expect(screen.queryByText(/empty load/i)).not.toBeInTheDocument()
      })

      it('does not render an overlay whose slots fall outside the day', () => {
        renderProfile({ events: [plainEvent({ startSlot: 47, slotCount: 2 })] })
        expect(screen.queryByText('Dishwasher cycle')).not.toBeInTheDocument()
      })

      it('renders only one card when the events array repeats the same id', () => {
        renderProfile({ events: [plainEvent(), plainEvent()] })
        expect(screen.getAllByText('Dishwasher cycle')).toHaveLength(1)
      })

      it('still renders every valid overlay alongside a filtered-out invalid one', () => {
        renderProfile({
          events: [plainEvent(), plainEvent({ id: 'ghost', label: '', startSlot: 10, slotCount: 2 })],
        })
        expect(screen.getByText('Dishwasher cycle')).toBeInTheDocument()
        expect(screen.queryByText(/ghost/i)).not.toBeInTheDocument()
      })
    })
  })
})
