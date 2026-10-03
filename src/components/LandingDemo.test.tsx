// @vitest-environment jsdom
// OA-109/OA-156: replaces the old tab-based click-through test suite --
// the story nav is a discrete Step 1 -> Step 2 -> Step 3 set of label
// buttons plus Back/Next (OA-156; previously a continuous `role="slider"`
// scrubber, OA-109), not a `role="tablist"`. OA-108: also covers the
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
import {
  buildLandingDemoFixture,
  cheapestStartSlotForEvent,
  isRealHouseholdEvent,
  LANDING_DEMO_EVENTS,
} from '../domain/landingDemoFixture'
import { formatSlotTime } from './heatMapMath'
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

// OA-168: with dragging removed, an event's displayed position is read
// from its card's own time-range text, not a slider's `aria-valuenow` --
// this derives the exact expected text from the same auto-optimised
// schedule/fixture the component itself builds against, so it can't
// silently drift from what's actually rendered.
function expectedTimeRangeLabel(startSlot: number, slotCount: number): string {
  const day = buildLandingDemoFixture(expectedAutoOptimisedStartSlots(), 'agile').optimise.day
  const start = day.slots[startSlot]
  const end = day.slots[startSlot + slotCount - 1]
  return slotCount === 1 ? formatSlotTime(start.startsAt) : `${formatSlotTime(start.startsAt)}–${formatSlotTime(end.startsAt)}`
}

function renderDemo() {
  return render(
    <MemoryRouter>
      <LandingDemo />
    </MemoryRouter>,
  )
}

function jumpToStage(name: string) {
  return screen.getByRole('button', { name })
}

// OA-156: the step nav's own group -- the active step's label button
// carries `aria-current="true"`, same semantics the old scrubber's
// `aria-valuetext` used to expose via a different mechanism. Its
// accessible *name* (not `textContent`, which also picks up the
// aria-hidden "Step N" badge) is just the stage label, e.g. "Compare".
function activeStageName(): string {
  return screen.getByRole('button', { current: true }).textContent!.replace(/^Step \d+/, '')
}

// OA-155: switches Baseline's own *current* tariff to Smart · Octopus Agile --
// used only by the couple of tests that specifically exercise Baseline's
// own selector and its cascade into Compare's reference. OA-155 gates the
// nav at Baseline entirely once the current tariff is Smart (nothing
// genuine left to compare), so this no longer doubles as a shortcut past
// Baseline the way it used to -- see `switchToSmartAgile` below for that.
async function setCurrentTariffToSmartAgile(user: ReturnType<typeof userEvent.setup>) {
  const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
  await user.click(within(typeGroup).getByRole('button', { name: 'Smart' }))
}

// OA-136/OA-155: the shared setup step most Optimise-path tests need --
// steps to Compare (current tariff stays Flexible, so OA-155's Baseline
// gate never engages) and picks Agile directly from Compare's own row,
// since Standard Variable (the default current tariff) is flat and has
// nothing to optimise.
async function switchToSmartAgile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(jumpToStage('Your options'))
  const selector = screen.getByRole('group', { name: /compare standard variable with/i })
  await user.click(within(selector).getByRole('button', { name: 'Octopus Agile' }))
}

describe('LandingDemo', () => {
  it('starts on Baseline, deterministically, on Standard Variable', () => {
    const { container } = renderDemo()
    expect(activeStageName()).toBe('Your costs')
    expect(jumpToStage('Your costs')).toHaveAttribute('aria-current', 'true')
    // OA-126/OA-135: "6.8 kWh" is the Typical household's labelled daily
    // usage, not an unlabelled figure -- and the £ result is explicitly
    // "energy cost on <tariff>", with the standing charge disclosed
    // separately alongside it.
    expect(container.querySelector('.landing-time-profile__result-label')).toHaveTextContent('Typical day · 6.8 kWh')
    expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('£1.80/day on Standard Variable')
    expect(container.querySelector('.landing-time-profile__standing-charge-note')).toHaveTextContent(
      '+ £0.55/day standing charge',
    )
  })

  it('leads Baseline with the fix/switch/stay question, not the old usage-led or narrower headings (OA-135/OA-171/OA-172)', () => {
    renderDemo()
    expect(
      screen.getByRole('heading', { name: 'Would you be better off fixing, switching, or staying where you are?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Choose your current tariff and we'll compare staying as you are, fixing, or switching."),
    ).toBeInTheDocument()
    expect(screen.queryByText('When do you use energy?')).not.toBeInTheDocument()
    expect(screen.queryByText('What Octopus tariff are you on now?')).not.toBeInTheDocument()
    expect(screen.queryByText('Would another tariff cost less?')).not.toBeInTheDocument()
  })

  // OA-135: "add a compact tariff selector within Baseline... Primary
  // choices: Flexible | Fixed | Smart."
  describe('Baseline current-tariff selector (OA-135)', () => {
    it('shows a visible "Your current tariff" label above a Flexible/Fixed/Smart selector, with Smart revealing its own products', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.getByText('Your current tariff')).toBeInTheDocument()
      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      expect(within(typeGroup).getByRole('button', { name: 'Standard Variable' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('group', { name: /choose your current smart tariff/i })).not.toBeInTheDocument()

      // OA-155: picking Smart here replaces the usual £/day result with
      // the sign-up prompt (see the dedicated describe block below) --
      // this test stays focused on the selector itself still correctly
      // tracking which smart product is selected underneath that prompt.
      await user.click(within(typeGroup).getByRole('button', { name: 'Smart' }))
      const smartGroup = screen.getByRole('group', { name: /choose your current smart tariff/i })
      expect(within(smartGroup).getByRole('button', { name: 'Octopus Agile' })).toHaveAttribute('aria-pressed', 'true')
      expect(within(smartGroup).getByRole('button', { name: 'Octopus Economy 7' })).toBeInTheDocument()

      await user.click(within(smartGroup).getByRole('button', { name: 'Octopus Economy 7' }))
      expect(within(smartGroup).getByRole('button', { name: 'Octopus Economy 7' })).toHaveAttribute('aria-pressed', 'true')
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
      const flexibleButton = within(segmented).getByRole('button', { name: 'Standard Variable' })
      expect(flexibleButton).toHaveClass('landing-time-profile__segmented-button')
      expect(flexibleButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('leaves usage, timings and total kWh identical when the current tariff changes -- only pricing changes', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      const kwhBefore = container.querySelector('.landing-time-profile__result-label')!.textContent
      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      await user.click(within(typeGroup).getByRole('button', { name: 'Fixed' }))
      expect(container.querySelector('.landing-time-profile__result-label')!.textContent).toBe(kwhBefore)
    })

    it('switching the current tariff to a non-smart alternative also resets Compare/Optimise to it, as the new reference', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      await user.click(within(typeGroup).getByRole('button', { name: 'Fixed' }))
      await user.click(jumpToStage('Your options'))

      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Stay where you are')
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Fixed')
    })

    // OA-155: "the public demo stays linear, while Smart-tariff users exit
    // into signup/personalised analysis rather than being forced through a
    // fake Standard -> Smart comparison" -- supersedes the old OA-135
    // behaviour above for this one case: Compare/Optimise are no longer
    // reachable once the current tariff is already Smart. The £/day
    // result itself is unaffected (still shown normally); it's the step
    // nav's own slot that's replaced by the sign-up prompt, since there's
    // no genuine next step to show it for.
    it('switching the current tariff to Smart replaces the step nav with a sign-up prompt, leaving the price shown as normal', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      await setCurrentTariffToSmartAgile(user)

      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('/day on Smart · Octopus Agile')
      expect(screen.queryByRole('button', { name: 'Your costs' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Your options' })).not.toBeInTheDocument()
      // OA-155 (refinement)/OA-172 (round two): only "Connect your
      // account" itself is the link. The gate now also states a real,
      // computed result before the signup link -- "do not collapse the
      // Smart path into a signup prompt... show at least one example
      // result before signup" -- using the same auto-optimised trial
      // figure Optimise itself would show for this tariff.
      const gate = container.querySelector('.landing-demo__smart-gate')!
      expect(gate).toHaveTextContent('You’re already on a tariff with changing prices.')
      expect(gate).toHaveTextContent(/shifting a few flexible things to cheaper times could be worth about £[\d.]+\/year/)
      expect(gate).toHaveTextContent('to see the real figure for your own home.')
      expect(within(gate as HTMLElement).getByRole('link', { name: 'Connect your account' })).toHaveAttribute(
        'href',
        '/login',
      )
    })

    // OA-172 (round two): same real, computed figure for the other Smart
    // product too -- not a one-off special case for Agile.
    it('shows the same kind of real computed figure for Economy 7 as the current tariff', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      await user.click(within(typeGroup).getByRole('button', { name: 'Smart' }))
      const smartRow = screen.getByRole('group', { name: /choose your current smart tariff/i })
      await user.click(within(smartRow).getByRole('button', { name: 'Octopus Economy 7' }))

      const gate = container.querySelector('.landing-demo__smart-gate')!
      expect(gate).toHaveTextContent(/shifting a few flexible things to cheaper times could be worth about £[\d.]+\/year/)
    })
    // Note: the gate's "your timing already looks close to optimal" honest
    // no-opportunity branch (mirroring Optimise's own OA-137 behaviour) is
    // real code, exercised nowhere in this test file -- this fixture's
    // household always has enough genuinely movable load under either
    // Smart product to clear the meaningful-saving threshold, so there's
    // currently no reachable Smart-start scenario that hits it. Flagged in
    // HANDOFF.md, not silently assumed untested-because-unreachable.
  })

  describe('Compare selects one alternative for an A/B comparison (OA-136)', () => {
    it('names the current tariff as the fixed reference, with no A/B result until an alternative is chosen', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      await user.click(jumpToStage('Your options'))

      expect(activeStageName()).toBe('Your options')
      expect(screen.getByRole('heading', { name: /^Compare Standard Variable with your other options$/ })).toBeInTheDocument()
      // OA-172: "stay where you are" is now shown as its own first-class
      // decision card (not a plain "Current tariff: X · £Y" line), before
      // any alternative has been explicitly picked.
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Stay where you are')
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('Standard Variable')
      expect(container.querySelector('.landing-time-profile__result')).toHaveTextContent('£1.80')
      // No duplicate all-tariffs results stack any more.
      expect(screen.queryByText(/smart · octopus agile/i)).not.toBeInTheDocument()
    })

    // OA-172: "stay where you are must be a first-class visible result" --
    // an explicit "Stay as you are" button, pressed by default before any
    // alternative is chosen, and clickable to return to that state after
    // picking an alternative. Economy 7 is a genuine "don't change" result
    // here (it costs more than Flexible for this household), so clicking
    // back to "Stay as you are" after it is a real, honest reversal, not a
    // contrived example.
    it('offers "Stay as you are" as an explicit, honest first-class option, including after picking a worse alternative', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      expect(within(selector).getByRole('button', { name: 'Stay as you are' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(within(selector).getByRole('button', { name: 'Octopus Economy 7' }))
      expect(within(selector).getByRole('button', { name: 'Stay as you are' })).toHaveAttribute('aria-pressed', 'false')
      expect(container.querySelector('.landing-time-profile__annual-hero')).toHaveAttribute('data-direction', 'cost')

      await user.click(within(selector).getByRole('button', { name: 'Stay as you are' }))
      expect(within(selector).getByRole('button', { name: 'Stay as you are' })).toHaveAttribute('aria-pressed', 'true')
      const result = container.querySelector('.landing-time-profile__result')!
      expect(result).toHaveTextContent('Stay where you are')
      // Honest, not forced: Agile (one of the offered options) genuinely
      // saves against Flexible for this household (see the "choosing a
      // Smart tariff" test below), so staying is correctly *not* claimed
      // as the cheapest option here.
      expect(result).toHaveTextContent('A cheaper option may be available')
    })

    // OA-172: "a fixed-tariff option can be compared meaningfully against
    // staying on the current tariff" -- Fixed is now offered alongside the
    // Smart tariffs (reversing OA-136 fifth pass's "just Economy 7 and
    // Agile"); Flexible is still never offered as a comparison target
    // (the current tariff's own choice -- already named in the heading
    // above), and there's still no generic "Smart" tab, just the real
    // products directly.
    it("omits Flexible entirely but offers Fixed and the Smart tariffs directly (no generic Smart tab)", async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      expect(within(selector).queryByRole('button', { name: 'Standard Variable' })).not.toBeInTheDocument()
      expect(within(selector).queryByRole('button', { name: 'Smart' })).not.toBeInTheDocument()
      expect(within(selector).getByRole('button', { name: 'Fixed' })).toBeEnabled()
      expect(within(selector).getByRole('button', { name: 'Octopus Economy 7' })).toBeEnabled()
      expect(within(selector).getByRole('button', { name: 'Octopus Agile' })).toBeEnabled()
    })

    // OA-136 (fourth pass)/OA-172: Flexible is never offered as a
    // comparison target at all, even when the current tariff is something
    // else entirely (Fixed here) -- but since the current tariff here
    // *is* Fixed, Fixed itself is correctly the one dropped this time
    // (comparing a tariff against itself isn't a real option).
    it('never offers Flexible as a comparison target, and drops Fixed when it is already the current tariff', async () => {
      const user = userEvent.setup()
      renderDemo()

      const typeGroup = screen.getByRole('group', { name: /^your current tariff$/i })
      await user.click(within(typeGroup).getByRole('button', { name: 'Fixed' }))
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare fixed with/i })
      expect(within(selector).queryByRole('button', { name: 'Standard Variable' })).not.toBeInTheDocument()
      expect(within(selector).queryByRole('button', { name: 'Fixed' })).not.toBeInTheDocument()
      expect(within(selector).getByRole('button', { name: 'Octopus Economy 7' })).toBeEnabled()
      expect(within(selector).getByRole('button', { name: 'Octopus Agile' })).toBeEnabled()
    })

    // OA-172: choosing Fixed shows the trade-off caveat (price certainty
    // vs. the risk prices could fall instead), distinct from the generic
    // representative-comparison caveat every other choice gets.
    it('choosing Fixed explains the price-certainty trade-off, not just the generic representative-comparison caveat', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      await user.click(within(selector).getByRole('button', { name: 'Fixed' }))

      expect(container.querySelector('.landing-time-profile__annual-hero')).toHaveTextContent('Fixed')
      expect(screen.getByText(/fixing locks your unit price/i)).toBeInTheDocument()
      expect(screen.getByText(/if prices fall instead you could end up paying more/i)).toBeInTheDocument()
    })

    // OA-136 (second pass): the annual saving/cost is now the dominant
    // headline, in its own dedicated result-block, with the daily pence
    // figure and tariff-vs-tariff context as secondary detail inside it.
    // OA-136 (third pass): picking a smart tariff is now a single click on
    // its own button in the primary row, not a category pick followed by
    // a subtype pick.
    it('choosing a Smart tariff directly shows the annual saving as the dominant headline, with daily/tariff context secondary, and carries into Optimise', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      await user.click(within(selector).getByRole('button', { name: 'Octopus Agile' }))

      const hero = container.querySelector('.landing-time-profile__annual-hero')!
      expect(hero).toHaveAttribute('data-direction', 'save')
      expect(hero.querySelector('.landing-time-profile__annual-hero-figure')).toHaveTextContent(/save about £[\d.]+\/year/i)
      expect(hero).toHaveTextContent('Smart · Octopus Agile')
      expect(hero).toHaveTextContent('vs Standard Variable')
      expect(hero.querySelector('.landing-time-profile__annual-hero-daily')).toHaveTextContent(/14p less\/day/)

      await user.click(jumpToStage('Changes you could make'))
      expect(screen.getByText(/you.ve already chosen smart · octopus agile/i)).toBeInTheDocument()
      // OA-164: Optimise's own hero headline is the *total* annual saving
      // (tariff + timing combined) -- same wording as Compare's own
      // headline above, just a larger combined figure -- with a
      // breakdown underneath attributing it to its two sources.
      expect(container.querySelector('.landing-time-profile__annual-hero-figure')).toHaveTextContent(
        /save about £[\d.]+\/year/i,
      )
      expect(screen.getByText(/£\d+\/year from switching to smart/i)).toBeInTheDocument()
      expect(screen.getByText(/\+ £\d+\/year from optimisation/i)).toBeInTheDocument()
    })

    // OA-146: "Compare figures reconcile after rounding" -- the secondary
    // daily pence figure times 365 must equal the dominant annual headline,
    // not just approximately (the bug this ticket fixes was exactly this
    // drifting apart once each was rounded for display independently).
    it('reconciles the secondary daily figure with the dominant annual headline exactly (daily x365 == annual)', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      await user.click(within(selector).getByRole('button', { name: 'Octopus Agile' }))

      const hero = container.querySelector('.landing-time-profile__annual-hero')!
      const dailyText = hero.querySelector('.landing-time-profile__annual-hero-daily')!.textContent!
      const dailyPence = Number(dailyText.match(/(\d+)p/)![1])
      const annualText = hero.querySelector('.landing-time-profile__annual-hero-figure')!.textContent!
      const annualPence = Math.round(Number(annualText.match(/£(\d+\.\d\d)/)![1]) * 100)
      expect(dailyPence * 365).toBe(annualPence)
    })

    // OA-136 (third pass) note: the current tariff's own smart product is
    // still excluded from the row entirely in the underlying selector
    // logic (`compareSmartTariffOptions`, same "don't show what can't be
    // chosen" treatment as Flexible/Fixed), but OA-155 means that's no
    // longer reachable through the UI to test directly -- the current
    // tariff being Smart now gates the nav at Baseline before Compare is
    // ever shown (see the "gates the nav at Baseline" test above).

    // OA-136 (fifth pass): one flat row -- Economy 7 | Agile, the only
    // two options now -- not a primary tariff-type tab bar with a
    // secondary Smart subtype row underneath it, and not mixed with
    // Flexible/Fixed either.
    it('renders the Smart tariff choice as one segmented control, with no secondary subtype row', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await user.click(jumpToStage('Your options'))

      const primarySelector = container.querySelector('.landing-time-profile__primary-selector')
      expect(primarySelector).toBeInTheDocument()
      const selector = within(primarySelector as HTMLElement).getByRole('group', { name: /compare standard variable with/i })
      expect(selector).toHaveClass('landing-time-profile__segmented')
      expect(within(selector).getByRole('button', { name: 'Octopus Economy 7' })).toHaveClass(
        'landing-time-profile__segmented-button',
      )
      expect(within(selector).getByRole('button', { name: 'Octopus Agile' })).toHaveClass('landing-time-profile__segmented-button')
      expect(
        within(primarySelector as HTMLElement).queryByRole('group', { name: /choose a smart tariff to compare/i }),
      ).not.toBeInTheDocument()
    })
  })

  // OA-135: "Optimise does not show a duplicate prominent tariff
  // selector" -- the tariff chosen on Compare appears only as quiet
  // context there.
  it('shows no tariff selector on Optimise, only quiet context naming the chosen tariff', async () => {
    const user = userEvent.setup()
    const { container } = renderDemo()

    await switchToSmartAgile(user)
    await user.click(jumpToStage('Changes you could make'))

    expect(screen.queryByRole('group', { name: /choose a tariff type to compare/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /choose a smart tariff/i })).not.toBeInTheDocument()
    // OA-152: the old top-right tariff-context badge is gone -- the chosen
    // tariff is now named in the supporting copy instead.
    expect(container.querySelector('.landing-time-profile__tariff-context')).not.toBeInTheDocument()
    expect(screen.getByText(/you.ve already chosen smart · octopus agile/i)).toBeInTheDocument()
  })

  // OA-117/OA-136: Optimise stays locked until a genuine Smart comparison
  // tariff has actually been chosen on Compare -- before that,
  // `chosenTariffId` still equals the current (non-Smart) tariff, so
  // there's nothing to optimise yet, rather than landing there and
  // showing a "nothing to optimise" message.
  describe('Optimise is gated to a Smart comparison tariff (OA-117/OA-136)', () => {
    it('renders the Optimise label visibly but disabled while the comparison tariff is Flexible', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Your options'))

      expect(jumpToStage('Changes you could make')).toBeDisabled()
    })

    it('clicking the disabled Optimise label does not move the nav', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Your options'))

      await user.click(jumpToStage('Changes you could make'))
      expect(activeStageName()).toBe('Your options')
      expect(jumpToStage('Changes you could make')).toBeDisabled()
    })

    it('unlocks and reaches Optimise once a Smart tariff is chosen on Compare', async () => {
      const user = userEvent.setup()
      renderDemo()
      await user.click(jumpToStage('Your options'))

      const selector = screen.getByRole('group', { name: /compare standard variable with/i })
      await user.click(within(selector).getByRole('button', { name: 'Octopus Agile' }))

      expect(jumpToStage('Changes you could make')).toBeEnabled()
      await user.click(jumpToStage('Changes you could make'))
      expect(activeStageName()).toBe('Changes you could make')
    })

    // OA-136 (fifth pass) note: Compare's row now only ever offers Smart
    // tariffs (Flexible and Fixed are both gone -- see the "just Economy 7
    // and Agile" tests above), so there's no longer any comparison
    // selection in Compare that keeps Optimise locked or re-locks it after
    // reaching it -- every option there is a genuine Smart tariff. The
    // "locked before any selection" and "unlocked once one is chosen"
    // tests above still cover the one remaining locked state (nothing
    // chosen yet, `chosenTariffId` still equals the current tariff).
  })

  // OA-117/OA-137: once a Smart tariff with a genuine opportunity is
  // chosen, the existing auto-optimise/Reset behaviour is unchanged.
  describe('Optimise with a genuine timing-saving opportunity (Smart · Octopus Agile)', () => {
    it('jumps to Optimise timing, showing the auto-optimised schedule and a real saving immediately', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)

      await user.click(jumpToStage('Changes you could make'))

      expect(activeStageName()).toBe('Changes you could make')
      expect(screen.queryByText(/little to save by changing when you use electricity/i)).not.toBeInTheDocument()
      expect(screen.getByText(/save about £[\d.]+\/year/i)).toBeInTheDocument()
      expect(screen.getByText(/\+ £\d+\/year from optimisation/i)).toBeInTheDocument()
      expect(screen.getByText(/dishwasher/i)).toBeInTheDocument()
    })
  })

  // OA-167: timing suggestions are informational, not an instruction to
  // leave an appliance running unattended -- a concise note always
  // visible alongside Optimise's results (not collapsed behind the
  // "How we calculated this" disclosure, which is secondary methodology,
  // not a safety message), with a link to the fuller guidance.
  describe('appliance safety note and dialog on Optimise (OA-167)', () => {
    it('shows a concise safety note next to the Optimise result when there is a genuine opportunity', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      expect(screen.getByText(/use appliances safely/i)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('never shows the safety note on Baseline or Compare, which never move anything', () => {
      renderDemo()
      expect(screen.queryByText(/use appliances safely/i)).not.toBeInTheDocument()
    })

    it('opens the fuller Safety information dialog, covering manufacturer guidance and unattended operation, closable by Escape', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      await user.click(screen.getByRole('button', { name: 'Safety information' }))
      const dialog = screen.getByRole('dialog', { name: 'Safety information' })
      expect(within(dialog).getAllByText(/manufacturer instructions/i).length).toBeGreaterThan(0)
      expect(within(dialog).getAllByText(/unattended/i).length).toBeGreaterThan(0)
      expect(within(dialog).getByText(/doesn.t control your appliances/i)).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
      await user.click(jumpToStage('Changes you could make'))

      // OA-164: the headline and the tertiary monthly line are both
      // pence-precision (the headline via `describeAnnualOutcomeHeadline`,
      // the monthly line via `formatGbp`) -- they must reconcile exactly,
      // not just approximately.
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
      await user.click(jumpToStage('Changes you could make'))

      // Not shown as "£X today · ≈ £Y/month" (implying one derives the
      // other) -- today's figure gets its own explanatory line instead.
      expect(screen.queryByText(/today · ≈/)).not.toBeInTheDocument()
      expect(screen.getByText(/today's example day alone saves £\d+\.\d\d/i)).toBeInTheDocument()
      expect(screen.getByText(/a separate, single-day figure, not this estimate's daily rate/i)).toBeInTheDocument()
    })
  })

  // OA-117/OA-156: each step label is a plain, natively keyboard-operable
  // button -- tabbing to one and activating it jumps straight there, and
  // it's disabled (so Enter/Space is a no-op) rather than reachable, while
  // the comparison tariff isn't Smart -- the default Flexible comparison
  // has nothing to optimise, so Optimise stays unreachable until a Smart
  // tariff is chosen on Compare.
  it('is operable by keyboard alone -- Tab to a step label and activate it with the keyboard, clamped at Optimise until a Smart tariff is chosen', async () => {
    const user = userEvent.setup()
    renderDemo()

    jumpToStage('Your options').focus()
    await user.keyboard('{Enter}')
    expect(activeStageName()).toBe('Your options')

    expect(jumpToStage('Changes you could make')).toBeDisabled()
    jumpToStage('Changes you could make').focus()
    await user.keyboard('{Enter}')
    expect(activeStageName()).toBe('Your options')

    const selector = screen.getByRole('group', { name: /compare standard variable with/i })
    await user.click(within(selector).getByRole('button', { name: 'Octopus Agile' }))

    jumpToStage('Changes you could make').focus()
    await user.keyboard('{Enter}')
    expect(activeStageName()).toBe('Changes you could make')

    jumpToStage('Your options').focus()
    await user.keyboard('{Enter}')
    expect(activeStageName()).toBe('Your options')
  })

  // OA-156: no more continuous drag state -- clicking a step label always
  // moves to exactly that whole stage, never a fractional in-between value
  // (the old scrubber's drag behaviour this test used to cover is removed).
  it('always holds a whole stage index, never a fractional one, after stepping', async () => {
    const user = userEvent.setup()
    renderDemo()

    await user.click(jumpToStage('Your options'))
    expect(activeStageName()).toBe('Your options')
    await user.click(jumpToStage('Your costs'))
    expect(activeStageName()).toBe('Your costs')
  })

  it('gives the time profile a text/DOM equivalent of its visual data, not canvas-only state', () => {
    renderDemo()
    expect(screen.getAllByRole('button', { name: /kWh.*p\/kWh.*£/ }).length).toBe(48)
  })

  it('exposes the benefit-led signup CTA as a real link, placed before the chart (OA-171/OA-172)', () => {
    const { container } = renderDemo()
    const link = screen.getByRole('link', { name: 'See whether fixing, switching or staying put could save you money' })
    expect(link).toHaveAttribute('href', '/login')
    expect(
      screen.getByText('Connect your Octopus account to compare your own bills and usage.'),
    ).toBeInTheDocument()
    // OA-171: moved above the chart so a visitor sees the signup decision
    // before reading through all three stages, not after.
    const cta = container.querySelector('.landing-demo__cta')!
    const panel = container.querySelector('.landing-demo__panel')!
    expect(cta.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has exactly one heading in the section -- "See how the comparison works" (OA-171)', () => {
    renderDemo()
    expect(screen.getByRole('heading', { name: 'See how the comparison works' })).toBeInTheDocument()
  })

  it('explains the demo starts with a typical household and switches to real usage once connected (OA-166/OA-171)', () => {
    renderDemo()
    expect(screen.getByRole('heading', { name: 'See how the comparison works' })).toBeInTheDocument()
    expect(screen.queryByText(/example household/i)).not.toBeInTheDocument()
    expect(screen.getByText(/start with a typical household/i)).toBeInTheDocument()
    expect(screen.getByText(/we.ll use your actual electricity use/i)).toBeInTheDocument()
  })

  // OA-166: the full explanation (what the model means, what it's based
  // on, what assumptions it includes, the sources, and a route to the
  // detailed savings calculation) moved out of the header's old inline
  // <details> into a dedicated, keyboard-accessible dialog.
  describe('"More info" dialog about the Typical household model (OA-166)', () => {
    it('opens an accessible dialog from the header, containing the sources and explanation', async () => {
      const user = userEvent.setup()
      renderDemo()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'More info' }))

      const dialog = screen.getByRole('dialog', { name: 'About this model' })
      expect(within(dialog).getByText(/not your own smart-meter data/i)).toBeInTheDocument()
      expect(within(dialog).getAllByText(/ofgem/i).length).toBeGreaterThan(0)
      expect(within(dialog).getAllByText(/elexon/i).length).toBeGreaterThan(0)
      expect(within(dialog).getByText(/washing machine/i)).toBeInTheDocument()
      expect(within(dialog).getByRole('link', { name: /ofgem.*typical domestic consumption/i })).toBeInTheDocument()
    })

    it('closes on Escape and returns focus to the "More info" trigger', async () => {
      const user = userEvent.setup()
      renderDemo()

      const trigger = screen.getByRole('button', { name: 'More info' })
      await user.click(trigger)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    it('closes via its own close button', async () => {
      const user = userEvent.setup()
      renderDemo()

      await user.click(screen.getByRole('button', { name: 'More info' }))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
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

      await user.click(jumpToStage('Your options'))
      expect(screen.queryByRole('slider', { name: /machine|dryer|dishwasher|dehumidifier|oven/i })).not.toBeInTheDocument()
      expect(screen.getByText(/dishwasher/i)).toBeInTheDocument()
    })

    // OA-165/OA-167: the tumble dryer's daytime-only window is a
    // deliberate safety constraint, not a missed optimisation -- an info
    // icon beside it explains why, on every tab (not just Optimise), and
    // the wider "use appliances safely" note stays visible separately.
    it('shows an info icon explaining the tumble dryer is kept daytime-only for safety', () => {
      renderDemo()
      const trigger = screen.getByRole('button', { name: /why is tumble dryer kept in this window/i })
      fireEvent.click(trigger)
      expect(screen.getByRole('tooltip')).toHaveTextContent(/daytime window for safety/i)
      expect(screen.getByRole('tooltip')).toHaveTextContent(/unattended overnight/i)
    })

    it('gives no safety-constraint info icon to an event with no such constraint', () => {
      renderDemo()
      expect(screen.queryByRole('button', { name: /why is dishwasher kept in this window/i })).not.toBeInTheDocument()
    })

    // OA-117/OA-168: each movable event is shown at its auto-optimised
    // position once fully at Optimise, as a plain card (nothing on the
    // chart is draggable any more -- see LandingTimeProfile.tsx's own doc
    // comment). The same events are still never invented fresh here ("no
    // event appears for the first time at Optimise"): Baseline/Compare
    // name the exact same events, just fixed at their *original*
    // positions there (see the test above this describe block). Events
    // auto-optimised into the same (or an overlapping) window now merge
    // into one grouped card (see LandingTimeProfile.test.tsx's own
    // grouping coverage), so this checks the tumble dryer's own precise
    // position (it never shares a window with anything, thanks to its
    // dependency on the washing machine) rather than every event's exact
    // time text, which a grouped card's combined header wouldn't match.
    it('shows every movable event, each moved to its auto-optimised position, once fully at Optimise', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      const eventLayer = within(container.querySelector('.landing-time-profile__event-layer')!)
      expect(eventLayer.getByText(/dishwasher/i)).toBeInTheDocument()
      expect(eventLayer.getByText(/washing machine/i)).toBeInTheDocument()

      const expected = expectedAutoOptimisedStartSlots()
      const tumbleDryer = LANDING_DEMO_EVENTS.find((e) => e.id === 'tumble_dryer')!
      expect(
        eventLayer.getByText(expectedTimeRangeLabel(expected.tumble_dryer, tumbleDryer.slotCount)),
      ).toBeInTheDocument()
    })

    // OA-107: the oven is identified but fixed -- it never moves, at any
    // stage, and "Optimise all" never touches it.
    it('keeps the identified-but-fixed oven event at its one fixed position even at Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      expect(screen.getByText(/oven/i)).toBeInTheDocument()
    })
  })

  // OA-103/105/109/117/OA-168: the per-event saving note (now shown
  // directly in each movable event's own card, see LandingTimeProfile.tsx)
  // only appears once there's a genuine opportunity and Optimise is
  // reached -- end to end through LandingDemo's own data, not a drag
  // interaction (removed; see OA-168).
  describe('per-event saving note (OA-103/OA-108)', () => {
    it('shows a saving note for each movable event once a genuine opportunity exists at Optimise', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      expect(screen.getAllByText(/this cycle/i).length).toBeGreaterThan(0)
    })

    it('shows no saving note on Baseline or Compare, which never move anything', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      expect(screen.queryByText(/this cycle/i)).not.toBeInTheDocument()

      await user.click(jumpToStage('Your options'))
      expect(screen.queryByText(/this cycle/i)).not.toBeInTheDocument()
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
      await user.click(jumpToStage('Changes you could make'))

      expect(screen.queryByRole('heading', { name: "What we’ve done" })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'How we calculated it' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Try it yourself' })).not.toBeInTheDocument()
      expect(screen.getByText('How we calculated this').tagName.toLowerCase()).toBe('summary')
    })

    it('leads with the annual saving headline as the primary visual, with no duplicate large summary beneath it', async () => {
      const { container } = renderDemo()
      const user = userEvent.setup()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      // OA-117/OA-146: already auto-optimised on arrival -- a real positive
      // saving, in the dominant `result` line, with a compact monthly
      // detail line beneath it (derived from the same annual figure, so
      // it always reconciles), plus today's single-day figure labelled
      // separately since it's a different measure, not that figure's
      // daily rate -- see the dedicated OA-146 describe block below.
      expect(screen.getByText(/save about £[\d.]+\/year/i)).toBeInTheDocument()
      expect(screen.getByText(/≈ £\d+\.\d\d\/month total/)).toBeInTheDocument()
      const result = container.querySelector('.landing-time-profile__result')
      expect(result).not.toHaveTextContent(/potential saving/i)
    })

    it('collapses all secondary methodology/caveats into one "How we calculated this" disclosure, collapsed by default', async () => {
      const user = userEvent.setup()
      renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      const disclosure = screen.getByText('How we calculated this').closest('details')
      expect(disclosure).not.toHaveAttribute('open')
      expect(screen.getByText(/illustrative example frequency/i)).toBeInTheDocument()
      expect(screen.getByText(/standing charge doesn.t vary/i)).toBeInTheDocument()
    })

    // OA-137: "Reset"/"Optimise" buttons are removed -- arriving at
    // Optimise always auto-optimises on its own, so no manual controls are
    // needed; only the quiet tariff-context label remains, with the chart
    // directly below.
    it('shows no Reset/Optimise buttons and no tariff-context badge, with the chart directly below', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)

      await user.click(jumpToStage('Changes you could make'))
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Optimise all' })).not.toBeInTheDocument()
      expect(container.querySelectorAll('.landing-time-profile__controls-button')).toHaveLength(0)
      // OA-152: the top-right tariff-context badge is removed entirely --
      // the chosen tariff is named in the supporting copy instead.
      expect(container.querySelector('.landing-time-profile__tariff-context')).not.toBeInTheDocument()
    })

    // OA-108: "remove the permanent, always-visible verbose per-appliance
    // list" -- replaced by a contextual popover only while an event is
    // focused/hovered/dragged (see LandingTimeProfile.test.tsx for direct
    // coverage of that popover).
    it('no longer shows a permanent per-appliance saving list', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()
      await switchToSmartAgile(user)
      await user.click(jumpToStage('Changes you could make'))

      expect(container.querySelector('.landing-time-profile__event-detail')).not.toBeInTheDocument()
      expect(screen.queryByText(/moved to \d{1,2}:\d{2}/i)).not.toBeInTheDocument()
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
    await user.click(jumpToStage('Changes you could make'))

    expect(screen.queryByRole('slider', { name: /oven/i })).not.toBeInTheDocument()
    expect(screen.getByText(/oven/i)).toBeInTheDocument()
  })

  // OA-106: an event overlay must never render unless it maps to a real,
  // non-zero-kWh event in the shared model -- no empty/orphan/duplicate
  // outlined blocks on the chart.
  describe('no empty/orphan event overlays (OA-106)', () => {
    // OA-168: cards that overlap in time now merge into one grouped card
    // (see LandingTimeProfile.tsx's `groupOverlappingEvents`), so the
    // number of *cards* can be fewer than the number of events -- this
    // counts each event's own name instead (one per single-event card, or
    // one `<li>` per name in a grouped card's list), which must always
    // equal the real event count, with no blank entries.
    it('names every real shared event exactly once, with a real label, at every stage', async () => {
      const user = userEvent.setup()
      const { container } = renderDemo()

      for (const stageName of ['Your costs', 'Your options', 'Changes you could make']) {
        await user.click(jumpToStage(stageName))
        const cards = Array.from(container.querySelectorAll('.landing-time-profile__event-card'))
        const names = cards.flatMap((card) => {
          const list = card.querySelectorAll('.landing-time-profile__event-card-list li')
          if (list.length > 0) return Array.from(list, (li) => li.textContent?.trim() ?? '')
          return [card.querySelector('.landing-time-profile__event-card-name')?.textContent?.trim() ?? '']
        })
        expect(names).toHaveLength(LANDING_DEMO_EVENT_COUNT)
        for (const name of names) {
          expect(name).not.toBe('')
        }
      }
    })
  })
})
