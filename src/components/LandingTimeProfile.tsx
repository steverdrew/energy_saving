import type { ReactNode } from 'react'
import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import {
  buildSmoothUsageAreaPath,
  describeSlot,
  formatSlotTime,
  maxUsage,
  presentRateCategories,
  rateCategoryIndex,
  rateRange,
  RATE_CATEGORY_LABELS,
  type HeatMapDay,
} from './heatMapMath'
import './LandingTimeProfile.css'

export interface LandingTimeProfileProps {
  day: HeatMapDay
  /** OA-100: not rendered visibly (the tabs are the state selector, and "Typical household" is the section's one heading -- see LandingDemo.tsx) -- used only as the accessible name for the chart's group aria-label and sr-table caption. */
  heading: string
  /** Tariff name plus the headline kWh/£ figures, e.g. "Standard Variable · 9.7 kWh · £2.58". */
  summary: ReactNode
  /** One concise supporting sentence. */
  explanation: string
  /** OA-99: shown identically on every tab -- whether the headline £ figure is usage cost only or usage + standing charge. */
  costNote: string
  /** An optional secondary disclaimer line (Compare/Optimise's "illustrative example" caveats). */
  caveat?: string
  /** Remounts just the narrative block (not the chart) to replay its OA-80 fade/slide on step change -- see the component doc comment for why the chart itself must stay mounted. */
  stepKey: string
}

// Every hour of the 24-hour day -- one axis label underneath each, not
// just a handful of anchor points. Thinned down to alternate hours on
// narrow viewports via CSS (see LandingTimeProfile.css) to avoid overlap,
// while the underlying model stays the full 48 half-hour slots.
const AXIS_HOURS = Array.from({ length: 24 }, (_, hour) => hour)

// OA-97: restrained vertical time guidance across the 24-hour track --
// stronger guides at the 6-hour marks (matching the axis labels below),
// lighter guides at the 3-hour marks between them. Deliberately not one
// *label* per half-hour slot, which the ticket explicitly calls clutter --
// the half-hour divisions themselves are still shown (SLOT_DIVIDER_HOURS
// below), just unlabelled.
const HOUR_GUIDES: Array<{ hour: number; strength: 'major' | 'minor' }> = [
  { hour: 0, strength: 'major' },
  { hour: 3, strength: 'minor' },
  { hour: 6, strength: 'major' },
  { hour: 9, strength: 'minor' },
  { hour: 12, strength: 'major' },
  { hour: 15, strength: 'minor' },
  { hour: 18, strength: 'major' },
  { hour: 21, strength: 'minor' },
]

// Every half-hour boundary across the 24-hour day (0.5, 1, 1.5, ... 23.5)
// -- a faint divider so the track visibly reads as 48 half-hour slots
// rather than one continuous gradient, without the clutter of 48 axis
// labels. Excludes 0 and 24 (the track's own left/right edges already
// mark those).
const SLOT_DIVIDER_HOURS: number[] = Array.from({ length: 47 }, (_, i) => (i + 1) * 0.5)

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
 *
 * OA-98: this card is now the *whole* comparison unit, not a chart paired
 * with a separate narrative column -- LandingDemo.tsx no longer renders
 * its own story panel. The card reads top-to-bottom as one object
 * changing state: heading -> tariff/usage/cost summary -> explanation
 * (+ optional caveat) -> active-state legend -> chart. Only the narrative
 * block remounts (via `stepKey`) to replay its fade/slide on step change;
 * the chart itself stays mounted throughout, same as before, so its own
 * transitions keep interpolating.
 */
function LandingTimeProfile({ day, heading, summary, explanation, costNote, caveat, stepKey }: LandingTimeProfileProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const panelId = useId()
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])

  const days = useMemo(() => [day], [day])
  const { min, max } = useMemo(() => rateRange(days), [days])
  const peakUsage = useMemo(() => maxUsage(days), [days])
  // OA-95: the legend reflects only the price categories actually present
  // in this tab's data -- a flat tariff shows "Standard" only, not a fixed
  // "Cheap · Standard · Peak" shared by every tab regardless of its data.
  const presentCategories = useMemo(() => presentRateCategories(days, min, max), [days, min, max])

  // OA-97: the usage silhouette moves from "one bar per slot" to one
  // smooth path across all 48 -- same underlying ratios as before (clamped
  // to the day's peak), just rendered as a single interpolated curve
  // instead of 48 independent rectangles.
  const usageRatios = useMemo(
    () => day.slots.map((slot) => (slot.kwh !== null && peakUsage > 0 ? Math.min(1, slot.kwh / peakUsage) : 0)),
    [day, peakUsage],
  )
  const usagePath = useMemo(() => buildSmoothUsageAreaPath(usageRatios), [usageRatios])

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
      {/* OA-98/OA-100: summary -> explanation (+ optional caveat) -- the
          narrative lives inside this same card, above the chart it
          describes, instead of a separate column beside it. No visible
          heading here: "Typical household" (LandingDemo.tsx) is the
          section's one heading, and the selected tab already names the
          state, so a per-state heading here would duplicate both. `heading`
          itself isn't lost -- it's still the accessible name for the chart
          below (group aria-label, sr-table caption). Keyed by `stepKey` so
          this block alone replays the OA-80 fade/slide on step change (see
          the component doc comment for why the chart below must not
          remount the same way). */}
      <div className="landing-time-profile__narrative" key={stepKey}>
        <p className="landing-time-profile__summary">{summary}</p>
        <p className="landing-time-profile__explanation">{explanation}</p>
        <p className="landing-time-profile__cost-note">{costNote}</p>
        {caveat && <p className="landing-time-profile__caveat">{caveat}</p>}
      </div>

      <div className="landing-time-profile__legend">
        {RATE_CATEGORY_LABELS.map((label, i) =>
          presentCategories.includes(i) ? (
            <span className="landing-time-profile__legend-item" key={label}>
              <span className="landing-time-profile__legend-swatch" aria-hidden="true" data-category={i} />
              {label}
            </span>
          ) : null,
        )}
        <span className="landing-time-profile__legend-item">
          <span className="landing-time-profile__legend-bar" aria-hidden="true" />
          Usage
        </span>
      </div>

      <div className="landing-time-profile__body">
        <div
          className="landing-time-profile__track"
          role="group"
          aria-label={heading}
          aria-describedby={selectedSlot ? panelId : undefined}
        >
          {day.slots.map((slot, slotIndex) => {
            const category = rateCategoryIndex(slot.unitRateIncVatPence, min, max)
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
              />
            )
          })}

          {/* OA-97: restrained vertical time guidance, stronger at the
              6-hour marks (matching the axis labels below) than the
              3-hour marks between them -- not one guide per half-hour
              slot, which the ticket explicitly calls clutter. */}
          <div className="landing-time-profile__guides" aria-hidden="true">
            {SLOT_DIVIDER_HOURS.map((hour) => (
              <span
                key={`slot-${hour}`}
                className="landing-time-profile__guide"
                data-strength="slot"
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}
            {HOUR_GUIDES.map(({ hour, strength }) => (
              <span
                key={hour}
                className="landing-time-profile__guide"
                data-strength={strength}
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}
          </div>

          {/* OA-97: one smooth path through all 48 half-hourly usage
              ratios, replacing the previous 48 independent bars -- the
              price-landscape columns above remain the exact, unsmoothed
              per-slot source of truth (and of the accessible label/table
              below); this is purely the foreground silhouette drawn over
              them. viewBox is in slot-index units (0..48 x, 0..1 y) so the
              path data depends only on the data, not the rendered size --
              preserveAspectRatio="none" stretches it to fill the track. */}
          <svg
            className="landing-time-profile__usage-path"
            viewBox={`0 0 ${day.slots.length} 1`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={usagePath} />
          </svg>
        </div>

        {/* Short tick marks bridging the gap between the track's hour
            guides and their labels below, so each guide line visibly
            continues down to the time it marks instead of stopping dead
            at the track's bottom edge. */}
        <div className="landing-time-profile__axis-ticks" aria-hidden="true">
          {AXIS_HOURS.map((hour) => (
            <span
              key={hour}
              className="landing-time-profile__axis-tick"
              style={{ left: `${(hour / 24) * 100}%` }}
            />
          ))}
        </div>

        <div className="landing-time-profile__axis" aria-hidden="true">
          {AXIS_HOURS.map((hour) => (
            <span
              key={hour}
              className="landing-time-profile__axis-label"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
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
        <caption>{heading} — exact values</caption>
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
