import { useRef, useState } from 'react'
import './LandingStoryScrubber.css'

/**
 * OA-109: one labelled anchor on the story scrubber (Baseline / Compare
 * tariff / Optimise timing). `id` is only used as the React key; `index`
 * in the parent's `stages` array is what the scrubber actually treats as
 * the integer "stage" a continuous `progress` value snaps to.
 */
export interface LandingStoryScrubberStage {
  id: string
  label: string
}

export interface LandingStoryScrubberProps {
  /** Exactly the stages this scrubber has anchors for, in order -- `progress` ranges over `0..stages.length - 1`. */
  stages: readonly LandingStoryScrubberStage[]
  /** The current position -- an integer when snapped to a stage, fractional while actively being dragged. Controlled by the caller. */
  progress: number
  /** Called continuously while dragging (fractional) and immediately on a label click/keyboard step (already an integer). */
  onProgressChange: (progress: number) => void
  /** Called once a drag ends (or a label click/keyboard step completes) with the final, snapped integer stage -- the caller's cue to commit any per-event state tied to "fully at this stage" (e.g. OA-109's "event dragging only at stage 3"). */
  onCommit?: (stageIndex: number) => void
  /** OA-117: the furthest stage index the user can currently reach -- e.g. locks Optimise (index 2) until the comparison tariff selected in Compare is a Smart tariff. Defaults to the last stage (no gating). The gated stage's label is rendered visibly but disabled ("visually clear but not punitive" -- never hidden), and neither dragging, clicking its label, nor arrow/Home/End keys can move `progress` past it. */
  maxReachableIndex?: number
  'aria-label'?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * OA-109: replaces the old 3-tab segmented control (`role="tablist"`) with
 * a continuous drag scrubber over one persistent chart. A native
 * `<input type="range">` can't show a label row with independently
 * clickable anchors *and* a thumb that visually sits between them while
 * mid-drag, so this is a custom ARIA slider (one draggable thumb,
 * `role="slider"`) plus a row of plain buttons for the three stage labels
 * -- clicking a label jumps straight to that stage; dragging the thumb (or
 * the track) moves continuously; arrow keys step a whole stage at a time.
 *
 * Deliberately stateless about *what* each stage means -- LandingDemo.tsx
 * owns all of that (fixture, narrative, interpolation); this component
 * only ever reports a number back via `onProgressChange`/`onCommit`.
 */
function LandingStoryScrubber({
  stages,
  progress,
  onProgressChange,
  onCommit,
  maxReachableIndex,
  ...rest
}: LandingStoryScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const maxIndex = stages.length - 1
  // OA-117: "should not be able to drag/click into an active Optimise
  // state" -- every position-reporting path below clamps to this, not just
  // maxIndex, while the ratio from pointer position still spans the whole
  // track (so the thumb visibly can't reach the gated label's position,
  // rather than reinterpreting a smaller track width).
  const effectiveMaxIndex = clamp(maxReachableIndex ?? maxIndex, 0, maxIndex)

  function progressFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return progress
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    return Math.min(effectiveMaxIndex, ratio * maxIndex)
  }

  function commitSnap(value: number) {
    const snapped = clamp(Math.round(value), 0, effectiveMaxIndex)
    onProgressChange(snapped)
    onCommit?.(snapped)
  }

  // OA-109: "scrubber drag must not break normal page vertical scrolling
  // outside the control" -- pointer capture is only taken on the thumb/
  // track themselves (the control's own hit area), and only a horizontal
  // drag is ever translated into a progress change; no listener here ever
  // touches scroll outside this element, and CSS (`touch-action`, see the
  // stylesheet) leaves vertical panning over the track itself alone too.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // OA-109: jsdom (unit tests) has no PointerEvent capture implementation
    // -- guarded so the same handler works in a real browser and in tests
    // that fire a bare pointerdown/pointerup pair without capture.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setIsDragging(true)
    onProgressChange(progressFromClientX(e.clientX))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    if (e.currentTarget.hasPointerCapture && !e.currentTarget.hasPointerCapture(e.pointerId)) return
    onProgressChange(progressFromClientX(e.clientX))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging) return
    setIsDragging(false)
    commitSnap(progressFromClientX(e.clientX))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const current = Math.round(progress)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      commitSnap(current + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      commitSnap(current - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      commitSnap(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      commitSnap(effectiveMaxIndex)
    }
  }

  const fillPercent = (clamp(progress, 0, maxIndex) / maxIndex) * 100
  const activeStageIndex = Math.round(clamp(progress, 0, maxIndex))

  return (
    <div className="landing-story-scrubber" data-dragging={isDragging || undefined}>
      <div className="landing-story-scrubber__labels" role="group" aria-label={rest['aria-label'] ?? 'Story stage'}>
        {stages.map((stage, index) => {
          const isLocked = index > effectiveMaxIndex
          return (
            <button
              key={stage.id}
              type="button"
              className="landing-story-scrubber__label"
              data-active={activeStageIndex === index || undefined}
              data-locked={isLocked || undefined}
              aria-current={activeStageIndex === index || undefined}
              aria-disabled={isLocked || undefined}
              disabled={isLocked}
              onClick={() => commitSnap(index)}
            >
              {stage.label}
            </button>
          )
        })}
      </div>
      <div
        ref={trackRef}
        className="landing-story-scrubber__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="landing-story-scrubber__fill" aria-hidden="true" style={{ width: `${fillPercent}%` }} />
        <div
          className="landing-story-scrubber__thumb"
          role="slider"
          tabIndex={0}
          aria-label={rest['aria-label'] ?? 'Story stage'}
          aria-valuemin={0}
          aria-valuemax={effectiveMaxIndex}
          aria-valuenow={Math.round(progress * 100) / 100}
          aria-valuetext={stages[activeStageIndex]?.label}
          style={{ left: `${fillPercent}%` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}

export default LandingStoryScrubber
