import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import {
  describeSlot,
  formatSlotTime,
  maxUsage,
  rateCategoryIndex,
  rateRange,
  RATE_CATEGORY_LABELS,
  type HeatMapDay,
} from './heatMapMath'
import './LandingTimeProfile.css'

export interface LandingTimeProfileProps {
  day: HeatMapDay
  title: string
  subtitle: string
}

const X_AXIS_SLOT_INDICES = [0, 12, 24, 36, 47]

/**
 * OA-89: replaces the square-cell heat map (LandingHeatMap.tsx, removed)
 * with a continuous price-and-usage time profile. The product problem
 * with the heat map was the visual primitive itself -- a grid of
 * identical squares encoding both price (colour) and usage (opacity) in
 * the same cells forces the reader to decode a legend before they
 * understand the story.
 *
 * This component splits price and usage into two visually distinct
 * layers over the same 48 half-hour columns, one per slot:
 * - background: a continuous price "time landscape" -- cheap/standard/
 *   peak bands, touching with no gaps, coloured by rateCategoryIndex.
 *   Usage is never encoded here (no opacity channel).
 * - foreground: a usage bar, anchored to the bottom of each column,
 *   height proportional to that slot's kWh -- a distinct shape sitting
 *   on top of the price landscape, not a shade of it.
 *
 * One representative day only (`day`, the last of the fixture's 4-day
 * `days` array) rather than the heat map's 4-day stacked grid -- OA-89
 * explicitly allows dropping the multi-day grid in favour of whichever
 * presentation reads most clearly; a single day's price/usage
 * relationship is the whole point, not the heat map's day-over-day
 * repetition.
 *
 * Each column stays a real `<button>` (OA-82/84: semantic controls,
 * accessible summary) with the same describeSlot aria-label and
 * roving-tabindex arrow-key navigation as the heat map it replaces, plus
 * the same always-in-DOM sr-only exact-values table. Columns are keyed
 * by `slot.startsAt`, which is identical across Baseline/Compare/
 * Optimise (see landingDemoFixture.ts), so LandingDemo.tsx keeping this
 * component mounted across step changes lets the background/foreground
 * CSS transitions interpolate in place: Baseline -> Compare only changes
 * background colour (usage bars don't move), Compare -> Optimise only
 * moves usage bars (background stays identical).
 */
function LandingTimeProfile({ day, title, subtitle }: LandingTimeProfileProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const panelId = useId()
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])

  const days = useMemo(() => [day], [day])
  const { min, max } = useMemo(() => rateRange(days), [days])
  const peakUsage = useMemo(() => maxUsage(days), [days])

  function focusSlot(slotIndex: number) {
    const clamped = Math.max(0, Math.min(day.slots.length - 1, slotIndex))
    cellRefs.current[clamped]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, slotIndex: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusSlot(slotIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusSlot(slotIndex - 1)
    }
  }

  const selectedSlot = selected !== null ? day.slots[selected] ?? null : null

  return (
    <div className="landing-time-profile">
      <div className="landing-time-profile__header">
        <div>
          <h3 className="landing-time-profile__title">{title}</h3>
          <p className="landing-time-profile__subtitle">{subtitle}</p>
        </div>
        <div className="landing-time-profile__legend">
          {RATE_CATEGORY_LABELS.map((label, i) => (
            <span className="landing-time-profile__legend-item" key={label}>
              <span className="landing-time-profile__legend-swatch" aria-hidden="true" data-category={i} />
              {label}
            </span>
          ))}
          <span className="landing-time-profile__legend-item">
            <span className="landing-time-profile__legend-bar" aria-hidden="true" />
            Usage
          </span>
        </div>
      </div>

      <div className="landing-time-profile__body">
        <div
          className="landing-time-profile__track"
          role="group"
          aria-label={title}
          aria-describedby={selectedSlot ? panelId : undefined}
        >
          {day.slots.map((slot, slotIndex) => {
            const category = rateCategoryIndex(slot.unitRateIncVatPence, min, max)
            const usageRatio = slot.kwh !== null && peakUsage > 0 ? Math.min(1, slot.kwh / peakUsage) : 0
            const isSelected = selected === slotIndex
            return (
              <button
                key={slot.startsAt}
                type="button"
                ref={(el) => {
                  cellRefs.current[slotIndex] = el
                }}
                className="landing-time-profile__column"
                data-category={category ?? 'unknown'}
                data-selected={isSelected || undefined}
                aria-label={describeSlot(slot)}
                tabIndex={slotIndex === 0 ? 0 : -1}
                onFocus={() => setSelected(slotIndex)}
                onClick={() => setSelected(slotIndex)}
                onKeyDown={(e) => handleKeyDown(e, slotIndex)}
              >
                <span
                  className="landing-time-profile__usage-bar"
                  aria-hidden="true"
                  style={{ '--usage-ratio': usageRatio } as React.CSSProperties}
                />
              </button>
            )
          })}
        </div>

        <div className="landing-time-profile__axis" aria-hidden="true">
          {X_AXIS_SLOT_INDICES.map((slotIndex) => {
            const slot = day.slots[slotIndex]
            return <span key={slotIndex}>{slot ? formatSlotTime(slot.startsAt) : ''}</span>
          })}
        </div>
      </div>

      {/* OA-86: "selected-cell details only after interaction" -- no
          permanent "Select a period for details" prompt; this only
          renders once a column has actually been focused/clicked. */}
      {selectedSlot && (
        <p id={panelId} className="landing-time-profile__detail" aria-live="polite">
          {describeSlot(selectedSlot)}
        </p>
      )}

      {/* Visually-hidden text equivalent -- OA-82/84's "accessibility/
          table views may remain secondary" is satisfied by keeping this
          in the DOM for screen readers/automation. */}
      <table className="landing-time-profile__sr-table">
        <caption>{title} — exact values</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Usage</th>
            <th scope="col">Unit rate</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {day.slots.map((slot) => (
            <tr key={slot.startsAt}>
              <td>{formatSlotTime(slot.startsAt)}</td>
              <td>{slot.kwh !== null ? `${slot.kwh.toFixed(2)} kWh` : '—'}</td>
              <td>{slot.unitRateIncVatPence !== null ? `${slot.unitRateIncVatPence.toFixed(1)}p/kWh` : '—'}</td>
              <td>{slot.costPence !== null ? formatGbp(slot.costPence) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default LandingTimeProfile
