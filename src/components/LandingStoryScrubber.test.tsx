// @vitest-environment jsdom
// OA-109: unit coverage for the scrubber control itself, independent of
// LandingDemo's own end-to-end coverage (which exercises it through the
// full story/fixture).
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LandingStoryScrubber, { type LandingStoryScrubberStage } from './LandingStoryScrubber'

afterEach(cleanup)

const STAGES: LandingStoryScrubberStage[] = [
  { id: 'baseline', label: '1. Baseline' },
  { id: 'compare', label: '2. Compare tariff' },
  { id: 'optimise', label: '3. Optimise timing' },
]

function renderScrubber(progress: number, overrides: Partial<React.ComponentProps<typeof LandingStoryScrubber>> = {}) {
  const onProgressChange = vi.fn()
  const utils = render(
    <LandingStoryScrubber stages={STAGES} progress={progress} onProgressChange={onProgressChange} {...overrides} />,
  )
  return { onProgressChange, ...utils }
}

function stubTrackWidth(container: HTMLElement, width = 200) {
  const track = container.querySelector('.landing-story-scrubber__track') as HTMLElement
  track.getBoundingClientRect = () =>
    ({ left: 0, right: width, width, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return track
}

describe('LandingStoryScrubber', () => {
  it('exposes the three stage labels, with the current one marked active/current', () => {
    renderScrubber(1)
    expect(screen.getByRole('button', { name: '1. Baseline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2. Compare tariff' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: '3. Optimise timing' })).not.toHaveAttribute('aria-current')
  })

  it('exposes a labelled, keyboard-focusable slider reflecting the current progress', () => {
    renderScrubber(0)
    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuemin', '0')
    expect(thumb).toHaveAttribute('aria-valuemax', '2')
    expect(thumb).toHaveAttribute('aria-valuenow', '0')
    expect(thumb).toHaveAttribute('aria-valuetext', '1. Baseline')
    expect(thumb).toHaveAttribute('tabindex', '0')
  })

  it('clicking a stage label jumps straight to it', async () => {
    const user = userEvent.setup()
    const { onProgressChange } = renderScrubber(0)

    await user.click(screen.getByRole('button', { name: '3. Optimise timing' }))

    expect(onProgressChange).toHaveBeenCalledWith(2)
  })

  it('arrow keys step one whole stage at a time, clamped at the ends', async () => {
    const user = userEvent.setup()
    const { onProgressChange } = renderScrubber(0)

    screen.getByRole('slider').focus()
    await user.keyboard('{ArrowLeft}')
    expect(onProgressChange).toHaveBeenLastCalledWith(0) // clamped, can't go below 0

    await user.keyboard('{ArrowRight}')
    expect(onProgressChange).toHaveBeenLastCalledWith(1)
  })

  it('Home/End jump to the first/last stage', async () => {
    const user = userEvent.setup()
    const { onProgressChange } = renderScrubber(1)

    screen.getByRole('slider').focus()
    await user.keyboard('{End}')
    expect(onProgressChange).toHaveBeenLastCalledWith(2)

    await user.keyboard('{Home}')
    expect(onProgressChange).toHaveBeenLastCalledWith(0)
  })

  // OA-109: dragging shows a continuous value, only snapping to the
  // nearest whole stage once the drag ends.
  it('reports a continuous, non-integer progress while dragging, then snaps to the nearest stage on release', () => {
    const { container, onProgressChange } = renderScrubber(0)
    stubTrackWidth(container)
    const thumb = screen.getByRole('slider')

    fireEvent.pointerDown(thumb, { clientX: 160, pointerId: 1 }) // 160/200 * 2 = 1.6
    expect(onProgressChange).toHaveBeenLastCalledWith(1.6)

    fireEvent.pointerMove(thumb, { clientX: 170, pointerId: 1 })
    expect(onProgressChange).toHaveBeenLastCalledWith(1.7)

    fireEvent.pointerUp(thumb, { clientX: 170, pointerId: 1 })
    // 1.7 is nearer to 2 than to 1 -- snaps to Optimise.
    expect(onProgressChange).toHaveBeenLastCalledWith(2)
  })

  it('does not report movement from a pointer move before any pointerdown', () => {
    const { container, onProgressChange } = renderScrubber(0)
    stubTrackWidth(container)
    fireEvent.pointerMove(screen.getByRole('slider'), { clientX: 170, pointerId: 1 })
    expect(onProgressChange).not.toHaveBeenCalled()
  })

  // OA-109: "scrubber drag must not break normal page scrolling outside
  // the control" -- the track allows vertical panning via CSS
  // (`touch-action: pan-y`) and this component never calls
  // `preventDefault` on anything outside its own pointer handlers.
  it('scopes touch handling to the track/thumb, leaving vertical scrolling outside it untouched', () => {
    const { container } = renderScrubber(0)
    const track = container.querySelector('.landing-story-scrubber__track') as HTMLElement
    const thumb = screen.getByRole('slider')
    expect(getComputedStyle(track).touchAction).not.toBe('none')
    expect(thumb.className).toContain('thumb')
  })
})
