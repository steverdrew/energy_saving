// @vitest-environment jsdom
// OA-109: replaces the old tab-based click-through test suite -- the
// scrubber is a continuous `role="slider"` plus three jump-to-stage
// label buttons, not a `role="tablist"`. OA-108: also covers the
// restructured Optimise-stage narrative (What we've done / How we
// calculated it / Try it yourself) and the removal of the permanent
// per-appliance list.
// OA-135/OA-136/OA-137: Baseline now owns the tariff selector ("the
// tariff I am on now"), defaulting to Standard Variable -- flat, so by
// default there is nothing to optimise, and Optimise's default state is
// therefore the "no genuine opportunity" one. Tests that exercise the
// optimised-schedule / real-saving path now explicitly switch to a Smart
// tariff (Agile) first, via Baseline's own selector.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { cheapestStartSlotForEvent, isRealHouseholdEvent, LANDING_DEMO_EVENTS } from '../domain/landingDemoFixture'
import LandingDemo from './LandingDemo'

afterEach(cleanup)

// OA-107: the representative set of household loads -- kept as a single
// reference so this test file doesn't hard-code "6" and drift silently if
// the fixture's event count ever changes again.
const LANDING_DEMO_EVENT_COUNT = LANDING_DEMO_EVENTS.length

// OA-117: the exact same auto-optimised schedule `LandingDemo.tsx`'s
// `computeAutoOptimisedStartSlots` computes -- reusing the same exported
// building blocks (not a hard-coded guess at slot numbers) so these
// expectations can't silently drift from what the component actually
// does, and stay correct if the fixture's rates/windows ever change.
function expectedAutoOptimisedStartSlots(): Record<string, number> {
  const next: Record<string, number> = {}
  const dependencyOrderedMovableEvents = LANDING_DEMO_EVENTS.filter(isRealHouseholdEvent)
    .filter((event) => event.movable)
    .sort((a, b) => (a.dependsOnEventId ? 1 : 0) - (b.dependsOnEventId ? 1 : 0))
  for (const event of dependencyOrderedMovableEvents) {
    next[event.id] = cheapestStartSlotForEvent(event.id, next, 'agile')
  }
  return next
}

function renderDemo() {
  return render(
    <MemoryRouter>
      <LandingDemo />
    </MemoryRouter>,
  )
}

function scrubber() {
  return screen.getByRole('slider', { name: /demo story stage/i })
}

function jumpToStage(name: string) {
  return screen.getByRole('button', { name })
}

// OA-135: switches Baseline's current tariff to Smart · Agile -- the one
// shared setup step most Optimise-path tests need, since Standard
// Variable (the default) is flat and has nothing to optimise.
async function switchToSmartAgile(user: ReturnType<typeof userEvent.setup>) {
  const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
  await user.click(within(typeGroup).getByRole('button', { name: 'Smart' }))
}

describe('LandingDemo', () => {
  it('starts on Baseline, deterministically, with the scrubber at position 0, on Standard Variable', () => {
    const { container } = renderDemo()
    expect(scrubber()).toHaveAttribute('aria-valuenow', '0')
    expect(scrubber()).toHaveAttribute('aria-valuetext', 'Baseline')
    // OA-126/OA-135: "6.8 kWh" is the Typical household's labelled daily
    // usage, not an unlabelled figure -- and the £ result is explicitly
    // "energy cost on <tariff>", with the standing charge disclosed
    // separately alongside it.
    expect(container.querySelector('.landing-time-profile__result-label')).toHaveTextContent('Typical day · 6.8 kWh')
    expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('£1.80/day on Flexible')
    expect(container.querySelector('.landing-time-profile__standing-charge-note')).toHaveTextContent(
      '+ £0.55/day standing charge',
    )
  })

  it('leads Baseline with "What tariff are you on now?", not the old usage-led heading (OA-135)', () => {
    renderDemo()
    expect(screen.getByRole('heading', { name: 'What tariff are you on now?' })).toBeInTheDocument()
    expect(
      screen.getByText('Choose your current tariff so we can compare this same household day against the alternatives.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('When do you use energy?')).not.toBeInTheDocument()
  })

  // OA-135: "add a compact tariff selector within Baseline... Primary
  // choices: Flexible | Fixed | Smart."
  describe('Baseline current-tariff selector (OA-135)', () => {
    it('shows a visible "Your current tariff" label above a Flexible/Fixed/Smart selector, with Smart revealing its own products', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      expect(screen.getByText('Your current tariff')).toBeInTheDocument()
      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      expect(within(typeGroup).getByRole('button', { name: 'Flexible' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('group', { name: /choose your current smart tariff/i })).not.toBeInTheDocument()

      await user.click(within(typeGroup).getByRole('button', { name: 'Smart' }))
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('/day on Smart · Agile')
      const smartGroup = screen.getByRole('group', { name: /choose your current smart tariff/i })
      expect(within(smartGroup).getByRole('button', { name: 'Economy 7' })).toBeInTheDocument()

      await user.click(within(smartGroup).getByRole('button', { name: 'Economy 7' }))
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('/day on Smart · Economy 7')
    })

    // OA-141: "the current tariff selector must be immediately visible as
    // the primary interaction on Tab 1" -- its own full-width, prominent
    // block (segmented control), not the small `controls` chip group
    // Compare/Optimise use for their own secondary controls.
    it('renders as a prominent, full-width segmented control, not a small secondary control (OA-141)', () => {
      const { container } = renderDemo()

      const primarySelector = container.querySelector('.landing-time-profile__primary-selector')
      expect(primarySelector).toBeInTheDocument()
      const segmented = within(primarySelector as HTMLElement).getByRole('group', { name: /^your current tariff$/i })
      expect(segmented).toHaveClass('landing-time-profile__segmented')
      const flexibleButton = within(segmented).getByRole('button', { name: 'Flexible' })
      expect(flexibleButton).toHaveClass('landing-time-profile__segmented-button')
      expect(flexibleButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('leaves usage, timings and total kWh identical when the current tariff changes -- only pricing changes', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      const kwhBefore = container.querySelector('.landing-time-profile__result-label')!.textContent
      await switchToSmartAgile(user)
      expect(container.querySelector('.landing-time-profile__result-label')!.textContent).toBe(kwhBefore)
    })

    it('switching the current tariff also resets Compare/Optimise to it, as the new reference', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      await switchToSmartAgile(user)
      await user.click(jumpToStage('Compare'))

      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Current tariff: Smart · Agile')
    })
  })

  describe('Compare selects one alternative for an A/B comparison (OA-136)', () => {
    it('names the current tariff as the fixed reference, with no A/B result until an alternative is chosen', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      await user.click(jumpToStage('Compare'))

      expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
      expect(screen.getByRole('heading', { name: /^Compare Flexible with another tariff$/ })).toBeInTheDocument()
      expect(container.querySelector('.landing-time-profile__result-label')).toHaveTextContent('Same usage · 6.8 kWh')
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Current tariff: Flexible')
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('£1.80')
      // No duplicate all-tariffs results stack any more.
      expect(screen.queryByText(/smart · agile/i)).not.toBeInTheDocument()
    })

    // OA-136 (second pass): "do not include [the current tariff's
    // category] as a large disabled segment if removing it makes the
    // choice simpler" -- Flexible is dropped from the row entirely, not
    // shown disabled, since it's already explicit in the heading above.
    it("omits the current tariff's own category from the choice entirely, rather than showing it disabled", async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare flexible with/i })
      expect(within(selector).queryByRole('button', { name: 'Flexible' })).not.toBeInTheDocument()
      expect(within(selector).getByRole('button', { name: 'Fixed' })).toBeEnabled()
      expect(within(selector).getByRole('button', { name: 'Smart' })).toBeEnabled()
    })

    // OA-136 (second pass): the annual saving/cost is now the dominant
    // headline, in its own dedicated result-block, with the daily pence
    // figure and tariff-vs-tariff context as secondary detail inside it.
    it('choosing one alternative shows the annual saving as the dominant headline, with daily/tariff context secondary, and carries into Optimise', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare flexible with/i })
      await user.click(within(selector).getByRole('button', { name: 'Smart' }))
      const smartGroup = screen.getByRole('group', { name: /choose a smart tariff to compare/i })
      await user.click(within(smartGroup).getByRole('button', { name: 'Agile' }))

      const hero = container.querySelector('.landing-time-profile__annual-hero')!
      expect(hero).toHaveAttribute('data-direction', 'save')
      expect(hero.querySelector('.landing-time-profile__annual-hero-figure')).toHaveTextContent(/save about £[\d.]+\/year/i)
      expect(hero).toHaveTextContent('Smart · Agile')
      expect(hero).toHaveTextContent('vs Flexible')
      expect(hero.querySelector('.landing-time-profile__annual-hero-daily')).toHaveTextContent(/14p less\/day/)

      await user.click(jumpToStage('Optimise'))
      expect(container.querySelector('.landing-time-profile__tariff-context')).toHaveTextContent('Smart · Agile')
      expect(container.querySelector('.landing-time-profile__annual-hero-figure')).toHaveTextContent(/save about £[\d.]+\/year/i)
    })

    // OA-146: "Compare figures reconcile after rounding" -- the secondary
    // daily pence figure times 365 must equal the dominant annual headline,
    // not just approximately (the bug this ticket fixes was exactly this
    // drifting apart once each was rounded for display independently).
    it('reconciles the secondary daily figure with the dominant annual headline exactly (daily x365 == annual)', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare flexible with/i })
      await user.click(within(selector).getByRole('button', { name: 'Smart' }))
      const smartGroup = screen.getByRole('group', { name: /choose a smart tariff to compare/i })
      await user.click(within(smartGroup).getByRole('button', { name: 'Agile' }))

      const hero = container.querySelector('.landing-time-profile__annual-hero')!
      const dailyText = hero.querySelector('.landing-time-profile__annual-hero-daily')!.textContent!
      const dailyPence = Number(dailyText.match(/(\d+)p/)![1])
      const annualText = hero.querySelector('.landing-time-profile__annual-hero-figure')!.textContent!
      const annualPence = Math.round(Number(annualText.match(/£(\d+\.\d\d)/)![1]) * 100)
      expect(dailyPence * 365).toBe(annualPence)
    })

    // OA-136 (second pass): the current tariff's own smart product is
    // excluded from the compact subtype row entirely, same "don't show
    // what can't be chosen" treatment as the primary row above.
    it("omits the current tariff's own product from the compact Smart subtype row too", async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare smart · agile with/i })
      await user.click(within(selector).getByRole('button', { name: 'Smart' }))
      const smartGroup = screen.getByRole('group', { name: /choose a smart tariff to compare/i })
      expect(within(smartGroup).queryByRole('button', { name: 'Agile' })).not.toBeInTheDocument()
      expect(within(smartGroup).getByRole('button', { name: 'Economy 7' })).toBeEnabled()

      await user.click(within(smartGroup).getByRole('button', { name: 'Economy 7' }))
      const hero = container.querySelector('.landing-time-profile__annual-hero')!
      expect(hero).toHaveTextContent('Smart · Economy 7')
      expect(hero).toHaveTextContent('vs Smart · Agile')
    })

    // OA-136 (second pass): the primary tariff-type choice keeps the large
    // segmented treatment; the Smart subtype is now visually subordinate
    // (the same compact pill treatment Baseline's own subtype row uses),
    // not a second equally large tab bar.
    it('renders the primary choice as a large segmented control, with a compact, visually subordinate Smart subtype row', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Compare'))

      const primarySelector = container.querySelector('.landing-time-profile__primary-selector')
      expect(primarySelector).toBeInTheDocument()
      const selector = within(primarySelector as HTMLElement).getByRole('group', { name: /compare flexible with/i })
      expect(selector).toHaveClass('landing-time-profile__segmented')
      expect(within(selector).getByRole('button', { name: 'Fixed' })).toHaveClass('landing-time-profile__segmented-button')

      await user.click(within(selector).getByRole('button', { name: 'Smart' }))
      const smartGroup = within(primarySelector as HTMLElement).getByRole('group', { name: /choose a smart tariff to compare/i })
      expect(smartGroup).not.toHaveClass('landing-time-profile__segmented')
      expect(smartGroup).toHaveClass('landing-time-profile__controls--secondary')
      expect(within(smartGroup).getByRole('button', { name: 'Agile' })).toHaveClass(
        'landing-time-profile__controls-button--secondary',
      )
    })
  })

  // OA-135: "Optimise does not show a duplicate prominent tariff
  // selector" -- the tariff chosen on Compare appears only as quiet
  // context there.
  it('shows no tariff selector on Optimise, only quiet context naming the chosen tariff', async () => {
    const user = userEvent.setup()
    const { container } = renderDemo()

    await switchToSmartAgile(user)
    await user.click(jumpToStage('Optimise'))

    expect(screen.queryByRole('group', { name: /choose a tariff type to compare/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /choose a smart tariff/i })).not.toBeInTheDocument()
    expect(container.querySelector('.landing-time-profile__tariff-context')).toHaveTextContent('Smart · Agile')
  })

  // OA-117/OA-136: "Fixed/Flexible comparison selections cannot advance
  // into an active Optimise state" -- the default Flexible comparison
  // (Baseline's own default tariff) locks Optimise entirely, rather than
  // landing there and showing a "nothing to optimise" message.
  describe('Optimise is gated to a Smart comparison tariff (OA-117/OA-136)', () => {
    it('renders the Optimise label visibly but disabled while the comparison tariff is Flexible', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Compare'))

      expect(jumpToStage('Optimise')).toBeDisabled()
    })

    it('clicking the disabled Optimise label does not move the scrubber', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Compare'))

      await user.click(jumpToStage('Optimise'))
      expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
    })

    it('unlocks and reaches Optimise once a Smart tariff is chosen on Compare', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare flexible with/i })
      await user.click(within(selector).getByRole('button', { name: 'Smart' }))

      expect(jumpToStage('Optimise')).toBeEnabled()
      await user.click(jumpToStage('Optimise'))
      expect(scrubber()).toHaveAttribute('aria-valuenow', '2')
    })

    it('choosing Fixed as the comparison tariff on Compare keeps Optimise locked too', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Compare'))

      const selector = screen.getByRole('group', { name: /compare flexible with/i })
      await user.click(within(selector).getByRole('button', { name: 'Fixed' }))

      expect(jumpToStage('Optimise')).toBeDisabled()
    })

    it('re-locks Optimise after returning to Compare and switching the comparison tariff away from Smart', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))
      expect(scrubber()).toHaveAttribute('aria-valuenow', '2')

      await user.click(jumpToStage('Compare'))
      const selector = screen.getByRole('group', { name: /compare smart · agile with/i })
      await user.click(within(selector).getByRole('button', { name: 'Flexible' }))

      expect(jumpToStage('Optimise')).toBeDisabled()
      expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
    })
  })

  // OA-117/OA-137: once a Smart tariff with a genuine opportunity is
  // chosen, the existing auto-optimise/Reset behaviour is unchanged.
  describe('Optimise with a genuine timing-saving opportunity (Smart · Agile)', () => {
    it('jumps to Optimise timing, showing the auto-optimised schedule and a real saving immediately', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)

      await user.click(jumpToStage('Optimise'))

      expect(scrubber()).toHaveAttribute('aria-valuenow', '2')
      expect(screen.queryByText(/little to save by changing when you use electricity/i)).not.toBeInTheDocument()
      expect(screen.getByText(/save about £[\d.]+\/year/i)).toBeInTheDocument()
      const expected = expectedAutoOptimisedStartSlots()
      expect(screen.getByRole('slider', { name: /dishwasher/i })).toHaveAttribute(
        'aria-valuenow',
        String(expected.dishwasher),
      )
    })
  })

  // OA-146: "a value labelled today is not presented as the daily
  // equivalent of an annual projection unless it actually is... different
  // modelling bases are explicitly labelled if both must be shown." The
  // Optimise stage's annual/monthly figures come from a recurrence
  // assumption (occurrences/week), while "today" is the literal modelled
  // day's own before/after cost -- a genuinely different basis, so they
  // must not be shown grouped as if one simply annualises the other.
  describe('Optimise daily/monthly figures reconcile and are honestly labelled (OA-146)', () => {
    it('derives the monthly detail line from the same annual figure as the dominant headline', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const annualText = screen.getByText(/save about £\d+\.\d\d\/year/i).textContent!
      const annualPounds = Number(annualText.match(/£(\d+\.\d\d)/)![1])
      const monthlyText = screen.getByText(/≈ £\d+\.\d\d\/month total/).textContent!
      const monthlyPounds = Number(monthlyText.match(/£(\d+\.\d\d)/)![1])
      expect(monthlyPounds * 12).toBeCloseTo(annualPounds, 1)
    })

    it("labels today's figure as a separate, single-day measure rather than grouping it with the monthly estimate", async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      // Not shown as "£X today · ≈ £Y/month" (implying one derives the
      // other) -- today's figure gets its own explanatory line instead.
      expect(screen.queryByText(/today · ≈/)).not.toBeInTheDocument()
      expect(screen.getByText(/today's example day alone saves £\d+\.\d\d/i)).toBeInTheDocument()
      expect(screen.getByText(/a separate, single-day figure, not this estimate's daily rate/i)).toBeInTheDocument()
    })
  })

  // OA-117: arrowing past Compare while the comparison tariff isn't Smart
  // must not reach Optimise -- the default Flexible comparison has
  // nothing to optimise, so the second ArrowRight is a no-op until a
  // Smart tariff is chosen on Compare.
  it('is operable by keyboard alone -- arrow keys step through stages one at a time, clamped at Optimise until a Smart tariff is chosen', async () => {
    const user = userEvent.setup()
    renderDemo()

    scrubber().focus()
    await user.keyboard('{ArrowRight}')
    expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
    expect(scrubber()).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(scrubber()).toHaveAttribute('aria-valuenow', '1')

    const selector = screen.getByRole('group', { name: /compare flexible with/i })
    await user.click(within(selector).getByRole('button', { name: 'Smart' }))

    scrubber().focus()
    await user.keyboard('{ArrowRight}')
    expect(scrubber()).toHaveAttribute('aria-valuenow', '2')

    await user.keyboard('{ArrowLeft}')
    expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
  })

  // OA-109: dragging the scrubber shows a continuous transitional value,
  // not a hard snap to the nearest stage, until released.
  it('shows a continuous, non-integer value while actively being dragged', () => {
    renderDemo()
    const track = scrubber().parentElement!
    const rect = { left: 0, right: 200, width: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
    track.getBoundingClientRect = () => rect as DOMRect

    fireEvent.pointerDown(scrubber(), { clientX: 75, pointerId: 1 })
    expect(Number(scrubber().getAttribute('aria-valuenow'))).toBeCloseTo(0.75, 1)

    fireEvent.pointerUp(scrubber(), { clientX: 75, pointerId: 1 })
    // Released roughly 3/4 of the way to Compare -- snaps to the nearer
    // whole stage (Compare, index 1).
    expect(scrubber()).toHaveAttribute('aria-valuenow', '1')
  })

  it('gives the time profile a text/DOM equivalent of its visual data, not canvas-only state', () => {
    renderDemo()
    expect(screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ }).length).toBe(48)
  })

  it('exposes the post-comparison CTA as a real link reading "Sign up free"', () => {
    renderDemo()
    expect(screen.getByRole('link', { name: /sign up free/i })).toHaveAttribute('href', '/login')
  })

  it('has exactly one heading in the section -- "Typical household"', () => {
    renderDemo()
    expect(screen.getByRole('heading', { name: 'Typical household' })).toBeInTheDocument()
  })

  it('labels the demo "Typical household" with a discoverable source note', () => {
    renderDemo()
    expect(screen.getByText('Typical household')).toBeInTheDocument()
    expect(screen.queryByText(/example household/i)).not.toBeInTheDocument()
    expect(screen.getByText(/based on ofgem and elexon data/i)).toBeInTheDocument()
  })

  it('states the headline figure is usage cost only', () => {
    renderDemo()
    expect(screen.getByText(/usage cost only/i)).toBeInTheDocument()
  })

  // OA-105/OA-107/OA-109: the same shared events appear throughout the
  // story -- fixed annotations outside Optimise, draggable overlays
  // (for movable events) only once fully at Optimise, and only once a
  // genuine timing-saving opportunity exists (OA-137).
  describe('shared household events across the story (OA-105/OA-107/OA-109)', () => {
    it('shows every named event as a fixed, non-draggable annotation on Baseline and Compare', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.queryByRole('slider', { name: /machine|dryer|dishwasher|dehumidifier|oven/i })).not.toBeInTheDocument()
      expect(screen.getByText(/dishwasher/i)).toBeInTheDocument()
      expect(screen.getByText(/washing machine/i)).toBeInTheDocument()
      expect(screen.getByText(/tumble dryer/i)).toBeInTheDocument()
      // OA-128: "the default Typical household must not include EV
      // charging" -- EV is no longer one of the demo's named events.
      expect(screen.queryByText(/ev charging/i)).not.toBeInTheDocument()
      expect(screen.getByText(/dehumidifier/i)).toBeInTheDocument()
      expect(screen.getByText(/oven/i)).toBeInTheDocument()

      await user.click(jumpToStage('Compare'))
      expect(screen.queryByRole('slider', { name: /machine|dryer|dishwasher|dehumidifier|oven/i })).not.toBeInTheDocument()
      expect(screen.getByText(/dishwasher/i)).toBeInTheDocument()
    })

    // OA-117: each movable event now starts (is draggable from) its
    // auto-optimised position, not its original "actual" one -- the
    // scrubber has already demonstrated the optimisation by the time it
    // fully arrives. The same events are still never invented fresh here
    // ("no event appears for the first time at Optimise"): Baseline/
    // Compare name the exact same events, just fixed at their *original*
    // positions there (see the test above this describe block).
    it('shows every movable event as a draggable slider, starting at its auto-optimised position, once fully at Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const expected = expectedAutoOptimisedStartSlots()
      expect(screen.getByRole('slider', { name: /dishwasher/i })).toHaveAttribute(
        'aria-valuenow',
        String(expected.dishwasher),
      )
      expect(screen.getByRole('slider', { name: /washing machine/i })).toHaveAttribute(
        'aria-valuenow',
        String(expected.washing_machine),
      )
      expect(screen.getByRole('slider', { name: /tumble dryer/i })).toHaveAttribute(
        'aria-valuenow',
        String(expected.tumble_dryer),
      )
    })

    // OA-107: the oven is identified but fixed -- it is never a slider,
    // at any stage, and "Optimise all" never moves it.
    it('keeps the identified-but-fixed oven event as a non-draggable annotation even at Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      expect(screen.queryByRole('slider', { name: /oven/i })).not.toBeInTheDocument()
      expect(screen.getByText(/oven/i)).toBeInTheDocument()
    })

    it("narrows the tumble dryer's draggable range as the washing machine moves later", async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const expected = expectedAutoOptimisedStartSlots()
      const washingMachineSlotCount = LANDING_DEMO_EVENTS.find((e) => e.id === 'washing_machine')!.slotCount
      const tumbleDryer = screen.getByRole('slider', { name: /tumble dryer/i })
      expect(tumbleDryer).toHaveAttribute('aria-valuemin', String(expected.washing_machine + washingMachineSlotCount))

      const washingMachine = screen.getByRole('slider', { name: /washing machine/i })
      washingMachine.focus()
      // A handful of steps, not clamped by the washing machine's own
      // 07:00-19:00 window (slot 36) regardless of where auto-optimise
      // happened to place its start.
      await user.keyboard('{ArrowRight}'.repeat(3))
      expect(washingMachine).toHaveAttribute('aria-valuenow', String(expected.washing_machine + 3))

      expect(screen.getByRole('slider', { name: /tumble dryer/i })).toHaveAttribute(
        'aria-valuemin',
        String(expected.washing_machine + 3 + washingMachineSlotCount),
      )
    })

    // OA-109: "do not make event dragging active in stages 1 or 2" --
    // moving the scrubber back off Optimise removes the sliders again,
    // even though the events' own positions (set while at Optimise)
    // persist.
    it('removes event sliders again when scrubbed back off Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))
      expect(screen.getByRole('slider', { name: /dishwasher/i })).toBeInTheDocument()

      await user.click(jumpToStage('Compare'))
      expect(screen.queryByRole('slider', { name: /dishwasher/i })).not.toBeInTheDocument()
    })
  })

  // OA-103/105/109/117: moving an event at Optimise recomputes the live
  // saving figure, end to end through LandingDemo's lifted state -- on
  // top of the auto-optimised schedule OA-117 already shows by default.
  describe('movable household events (OA-103)', () => {
    it('updates the saving figure live as an event is moved by keyboard, away from the auto-optimised schedule', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const resultBefore = screen.getByText(/save about £[\d.]+\/year/i).textContent

      // Dragging the washing machine away from its own already-optimised
      // (cheapest) slot can only ever raise its cost, never lower it --
      // so the household saving figure is guaranteed to change.
      const slider = screen.getByRole('slider', { name: /washing machine/i })
      slider.focus()
      await user.keyboard('{ArrowLeft}'.repeat(3))

      const expected = expectedAutoOptimisedStartSlots()
      expect(slider).toHaveAttribute('aria-valuenow', String(Math.max(14, expected.washing_machine - 3)))
      expect(screen.getByText(/save about £[\d.]+\/year|little to save/i).textContent).not.toBe(resultBefore)
    })

    it('moves each event independently -- moving one never affects an unrelated event', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const expected = expectedAutoOptimisedStartSlots()
      const washingMachine = screen.getByRole('slider', { name: /washing machine/i })
      washingMachine.focus()
      await user.keyboard('{ArrowRight}'.repeat(3))

      const dishwasher = screen.getByRole('slider', { name: /dishwasher/i })
      expect(washingMachine).toHaveAttribute('aria-valuenow', String(expected.washing_machine + 3))
      expect(dishwasher).toHaveAttribute('aria-valuenow', String(expected.dishwasher))
    })
  })

  // OA-108/OA-112: the Optimise stage's content hierarchy -- collapsed
  // down to match Baseline/Compare's card height (no more always-visible
  // "What we've done"/"How we calculated it"/"Try it yourself" sections).
  describe('Optimise content hierarchy (OA-108/OA-112)', () => {
    it('shows no section headings at Optimise -- just the disclosure summary and the controls', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      expect(screen.queryByRole('heading', { name: "What we’ve done" })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'How we calculated it' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Try it yourself' })).not.toBeInTheDocument()
      expect(screen.getByText('How we calculated this').tagName.toLowerCase()).toBe('summary')
    })

    it('leads with the annual saving headline as the primary visual, with no duplicate large summary beneath it', async () => {
      const { container } = renderDemo()
      const user = userEvent.setup()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      // OA-117/OA-146: already auto-optimised on arrival -- a real positive
      // saving, in the dominant `result` line, with a compact monthly
      // detail line beneath it (derived from the same annual figure, so
      // it always reconciles), plus today's single-day figure labelled
      // separately since it's a different measure, not that figure's
      // daily rate -- see the dedicated OA-146 describe block below.
      expect(screen.getByText(/save about £\d+\.\d\d\/year/i)).toBeInTheDocument()
      expect(screen.getByText(/≈ £\d+\.\d\d\/month total/)).toBeInTheDocument()
      const result = container.querySelector('.landing-time-profile__result')
      expect(result).not.toHaveTextContent(/potential saving/i)
    })

    it('collapses all secondary methodology/caveats into one "How we calculated this" disclosure, collapsed by default', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const disclosure = screen.getByText('How we calculated this').closest('details')
      expect(disclosure).not.toHaveAttribute('open')
      expect(screen.getByText(/illustrative example frequency/i)).toBeInTheDocument()
      expect(screen.getByText(/standing charge doesn.t vary/i)).toBeInTheDocument()
    })

    // OA-137: "Reset"/"Optimise" buttons are removed -- arriving at
    // Optimise always auto-optimises on its own, so no manual controls are
    // needed; only the quiet tariff-context label remains, with the chart
    // directly below.
    it('shows no Reset/Optimise buttons, only the quiet tariff context, with the chart directly below', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)

      await user.click(jumpToStage('Optimise'))
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Optimise all' })).not.toBeInTheDocument()
      expect(container.querySelectorAll('.landing-time-profile__controls-button')).toHaveLength(0)
      expect(container.querySelector('.landing-time-profile__tariff-context')).toHaveTextContent('Smart · Agile')
    })

    // OA-108: "remove the permanent, always-visible verbose per-appliance
    // list" -- replaced by a contextual popover only while an event is
    // focused/hovered/dragged (see LandingTimeProfile.test.tsx for direct
    // coverage of that popover).
    it('no longer shows a permanent per-appliance saving list', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      expect(container.querySelector('.landing-time-profile__event-detail')).not.toBeInTheDocument()
      expect(screen.queryByText(/moved to \d{1,2}:\d{2}/i)).not.toBeInTheDocument()
    })

    it('shows a contextual saving popover only while an event is focused', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Optimise'))

      const dishwasher = screen.getByRole('slider', { name: /dishwasher/i })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      fireEvent.focus(dishwasher)
      expect(await screen.findByRole('status')).toBeInTheDocument()

      fireEvent.blur(dishwasher)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  // OA-117: auto-optimise on arrival -- every movable event reaches its
  // cheapest valid slot with no button press (the old "Optimise all" flow
  // this replaced). This test covers the fixed oven specifically staying
  // put even so.
  it('auto-optimises on arrival without moving the fixed oven', async () => {
    const user = userEvent.setup()
    renderDemo()
    await switchToSmartAgile(user)
    await user.click(jumpToStage('Optimise'))

    expect(screen.queryByRole('slider', { name: /oven/i })).not.toBeInTheDocument()
    expect(screen.getByText(/oven/i)).toBeInTheDocument()
  })

  // OA-106: an event overlay must never render unless it maps to a real,
  // non-zero-kWh event in the shared model -- no empty/orphan/duplicate
  // outlined blocks on the chart.
  describe('no empty/orphan event overlays (OA-106)', () => {
    it('renders exactly one overlay per real shared event, with a real label, at every stage', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      for (const stageName of ['Baseline', 'Compare', 'Optimise']) {
        await user.click(jumpToStage(stageName))
        const annotations = container.querySelectorAll('.landing-time-profile__event-chip')
        expect(annotations).toHaveLength(LANDING_DEMO_EVENT_COUNT)
        for (const annotation of annotations) {
          expect(annotation.textContent?.trim()).not.toBe('')
        }
      }
    })
  })
})
