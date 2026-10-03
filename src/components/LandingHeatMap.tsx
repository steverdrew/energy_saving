import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import {
  describeSlot,
  findPeakWindow,
  formatSlotTime,
  maxUsage,
  rateCategoryIndex,
  rateRange,
  RATE_CATEGORY_LABELS,
  type HeatMapDay,
} from './heatMapMath'
import './LandingHeatMap.css'

export interface LandingHeatMapProps {
  days: HeatMapDay[]
  title: string
  subtitle: string
}

const X_AXIS_SLOT_INDICES = [0, 12, 24, 36, 47]

/**
 * OA-87 (third pass): a dedicated landing-page comparison visual, built
 * directly from the approved mockup's own structure (`shift_save_landing
 * _page.html`'s `#heatmap-container`/`.heatmap-grid`/`.heatmap-cell`,
 * `#peak-highlight`) rather than reusing HeatMap.tsx's authenticated-app
 * presentation with a second "variant" bolted on. Steve's own read of
 * why OA-85/86/87's CSS passes kept missing the mark: HeatMap.tsx is an
 * analytics widget (table toggle, "select a period" prompt, bordered
 * diagnostic card, fixed-width sizing assumptions) and no amount of
 * per-variant CSS override turns that into the mockup's bespoke
 * marketing visual -- the two need genuinely different presentation
 * components. Reused here: only the pure data/colour-maths
 * (heatMapMath.ts's rateCategoryIndex/findPeakWindow/describeSlot) and
 * the HeatMapDay/HeatMapSlot shapes themselves -- never HeatMap.tsx.
 *
 * Mechanism, ported from the mockup:
 * - One flat CSS Grid, `grid-template-columns: repeat(48, 1fr)`, no
 *   explicit rows -- all four days' slots appended as plain siblings, so
 *   the grid auto-wraps into one row per day exactly like the mockup's
 *   own `rows * cols` flat cell list (no per-row label column eating
 *   width, no visible day-to-day gap, a single unified grid block).
 * - Colour = tariff price band (cheap/standard/peak), opacity = usage,
 *   `aspect-ratio: 1` cells (LandingHeatMap.css) so width alone (driven
 *   by the card filling its actual column -- see LandingDemo.css) decides
 *   how large the grid reads, not a fixed row-height override.
 * - `applyState`'s mechanism (mutate persistent nodes, let CSS transition
 *   interpolate) only works if this component stays mounted across step
 *   changes -- LandingDemo.tsx's `key={step}` is scoped to the story
 *   panel alone for exactly this reason; each day/slot shares the same
 *   `date`/`startsAt` across Baseline/Compare/Optimise, which are this
 *   component's own React keys, so switching steps updates these same
 *   cell nodes in place.
 * - Peak-window overlay: derived from this step's own fixture data
 *   (`findPeakWindow`), not the mockup's hard-coded 16:00-19:00 band --
 *   absent entirely for a flat tariff (Baseline).
 * - No "Show as table" toggle, no default "Select a period for details"
 *   prompt text, no visible day labels, no annotations list -- none of
 *   these exist in the mockup, and OA-86 explicitly asks for "selected-
 *   cell details only after interaction", not a permanent prompt. A
 *   visually-hidden table (always in the DOM, sr-only) replaces the
 *   visible toggle so screen-reader/automation access survives per
 *   OA-82/84's "accessibility/table views may remain secondary".
 */
function LandingHeatMap({ days, title, subtitle }: LandingHeatMapProps) {
  const [selected, setSelected] = useState<{ dayIndex: number; slotIndex: number } | null>(null)
  const panelId = useId()
  const cellRefs = useRef<Array<Array<HTMLButtonElement | null>>>([])

  const { min, max } = useMemo(() => rateRange(days), [days])
  const peakUsage = useMemo(() => maxUsage(days), [days])
  const peakWindow = useMemo(() => findPeakWindow(days[0], min, max), [days, min, max])

  function focusCell(dayIndex: number, slotIndex: number) {
    const day = days[dayIndex]
    if (!day) return
    const clampedSlot = Math.max(0, Math.min(day.slots.length - 1, slotIndex))
    cellRefs.current[dayIndex]?.[clampedSlot]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, dayIndex: number, slotIndex: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusCell(dayIndex, slotIndex + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusCell(dayIndex, slotIndex - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        focusCell(dayIndex + 1, slotIndex)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusCell(dayIndex - 1, slotIndex)
        break
    }
  }

  const selectedSlot = selected !== null ? days[selected.dayIndex]?.slots[selected.slotIndex] ?? null : null

  return (
    <div className="landing-heat-map">
      <div className="landing-heat-map__header">
        <div>
          <h3 className="landing-heat-map__title">{title}</h3>
          <p className="landing-heat-map__subtitle">{subtitle}</p>
        </div>
        <div className="landing-heat-map__legend">
          {RATE_CATEGORY_LABELS.map((label, i) => (
            <span className="landing-heat-map__legend-item" key={label}>
              <span className="landing-heat-map__legend-swatch" aria-hidden="true" data-category={i} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="landing-heat-map__body">
        <div
          className="landing-heat-map__grid"
          role="group"
          aria-label={title}
          aria-describedby={selectedSlot ? panelId : undefined}
        >
          {days.map((day, dayIndex) =>
            day.slots.map((slot, slotIndex) => {
              const category = rateCategoryIndex(slot.unitRateIncVatPence, min, max)
              const usageRatio = slot.kwh !== null && peakUsage > 0 ? Math.min(1, slot.kwh / peakUsage) : 0
              const isSelected = selected?.dayIndex === dayIndex && selected?.slotIndex === slotIndex
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  ref={(el) => {
                    const row = cellRefs.current[dayIndex] ?? (cellRefs.current[dayIndex] = [])
                    row[slotIndex] = el
                  }}
                  className="landing-heat-map__cell"
                  data-category={category ?? 'unknown'}
                  data-selected={isSelected || undefined}
                  style={{ '--usage-ratio': usageRatio } as React.CSSProperties}
                  aria-label={describeSlot(slot)}
                  tabIndex={dayIndex === 0 && slotIndex === 0 ? 0 : -1}
                  onFocus={() => setSelected({ dayIndex, slotIndex })}
                  onClick={() => setSelected({ dayIndex, slotIndex })}
                  onKeyDown={(e) => handleKeyDown(e, dayIndex, slotIndex)}
                />
              )
            }),
          )}

          {peakWindow && (
            <span
              className="landing-heat-map__peak-overlay"
              aria-hidden="true"
              style={{ gridColumn: `${peakWindow.startSlot + 1} / ${peakWindow.endSlot + 2}` }}
            />
          )}
        </div>

        <div className="landing-heat-map__axis" aria-hidden="true">
          {X_AXIS_SLOT_INDICES.map((slotIndex) => {
            const slot = days[0]?.slots[slotIndex]
            return <span key={slotIndex}>{slot ? formatSlotTime(slot.startsAt) : ''}</span>
          })}
        </div>
      </div>

      {/* OA-86: "selected-cell details only after interaction" -- no
          permanent "Select a period for details" prompt; this only
          renders once a cell has actually been focused/clicked. */}
      {selectedSlot && (
        <p id={panelId} className="landing-heat-map__detail" aria-live="polite">
          {describeSlot(selectedSlot)}
        </p>
      )}

      {/* Visually-hidden text equivalent -- OA-82/84's "accessibility/
          table views may remain secondary" is satisfied by keeping this
          in the DOM for screen readers/automation, without the mockup-
          breaking visible "Show as table" toggle and bordered table. */}
      <table className="landing-heat-map__sr-table">
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
          {days.flatMap((day) =>
            day.slots.map((slot) => (
              <tr key={slot.startsAt}>
                <td>{formatSlotTime(slot.startsAt)}</td>
                <td>{slot.kwh !== null ? `${slot.kwh.toFixed(2)} kWh` : '—'}</td>
                <td>{slot.unitRateIncVatPence !== null ? `${slot.unitRateIncVatPence.toFixed(1)}p/kWh` : '—'}</td>
                <td>{slot.costPence !== null ? formatGbp(slot.costPence) : '—'}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}

export default LandingHeatMap
