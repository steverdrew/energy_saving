import type { ReactNode } from 'react'
import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import {
  buildSmoothUsageAreaPath,
  describeSlot,
  formatSlotTime,
  isStructuralPeakSlot,
  maxUsage,
  rateColorStepIndex,
  rateRange,
  RATE_COLOR_STEPS_DARK,
  type HeatMapDay,
} from './heatMapMath'
import './LandingTimeProfile.css'

// OA-101: "Cheaper <- price -> More expensive" continuous legend gradient,
// built from the same validated 9-step ramp (dark-theme variant, since
// the landing page is always dark) used to colour each column below --
// one source of truth for the ramp's actual colours, rather than a second
// hard-coded copy of the hex values in CSS.
const PRICE_LEGEND_GRADIENT = `linear-gradient(to right, ${RATE_COLOR_STEPS_DARK.join(', ')})`

/** OA-105: one household event overlaid on the track -- a fixed, non-interactive annotation on Baseline/Compare, or (when `movable`) a draggable overlay on Optimise. Shared shape across all three tabs so "no event appears for the first time on Tab 3" is structural, not just a convention. */
export type LandingTimeProfileEventOverlay =
  | {
      id: string
      label: string
      /** Slot index (0-47) the event currently starts at. */
      startSlot: number
      /** How many contiguous half-hour slots the event occupies. */
      slotCount: number
      movable: false
    }
  | {
      id: string
      label: string
      startSlot: number
      slotCount: number
      movable: true
      minStartSlot: number
      maxStartSlot: number
      /** Called with a new (already-clamped-by-caller-expected) start slot as the event is dragged or moved by keyboard. */
      onMove: (startSlot: number) => void
    }

type MovableEventOverlay = Extract<LandingTimeProfileEventOverlay, { movable: true }>

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
  /** OA-104: an optional prominent payoff line shown above `summary`, carrying more visual weight than the daily figure -- e.g. "You could save around £73/year...". Only the Optimise step passes this. */
  payoff?: ReactNode
  /** OA-104: an optional secondary, per-event line (e.g. "Dishwasher moved to 02:00 -- saves 18p this cycle, ~£73/year at 4 cycles/week") shown below the cost note -- inspectable detail, kept subordinate to the household-level `payoff` above. */
  eventDetail?: ReactNode
  /** OA-106: optional secondary controls ("Optimise all" / "Reset"), shown above the chart -- only the Optimise step passes this. */
  controls?: ReactNode
  /** Remounts just the narrative block (not the chart) to replay its OA-80 fade/slide on step change -- see the component doc comment for why the chart itself must stay mounted. */
  stepKey: string
  /** OA-99/OA-101: the 16:00-19:00 structural-peak annotation is a documented feature of *Agile's* pricing formula specifically -- showing it on a flat Standard Variable day would wrongly imply that flat tariff has the same structural peak. Baseline passes `false`; Compare/Optimise (both on Agile) pass `true`. */
  showStructuralPeakAnnotation: boolean
  /** OA-105: every household event, shown as an overlay on the track -- fixed annotations on Baseline/Compare, draggable overlays (the `movable: true` variant) on Optimise. Shared across all three tabs so events are never invented fresh on one tab. */
  events?: LandingTimeProfileEventOverlay[]
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
 * - background: a continuous price "time landscape" -- touching, with no
 *   gaps, each column coloured along a cheaper -> more expensive 9-step
 *   ramp (OA-101: replaces the earlier 3-band cheap/standard/peak
 *   categorical model, which misrepresented Agile as having fixed tariff
 *   bands when every half-hour actually carries its own distinct price).
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
function LandingTimeProfile({
  day,
  heading,
  summary,
  explanation,
  costNote,
  caveat,
  payoff,
  eventDetail,
  controls,
  stepKey,
  showStructuralPeakAnnotation,
  events,
}: LandingTimeProfileProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const panelId = useId()
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])
  const trackRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => [day], [day])
  const { min, max } = useMemo(() => rateRange(days), [days])
  const peakUsage = useMemo(() => maxUsage(days), [days])

  // OA-99/OA-101: the 16:00-19:00 structural peak window, as an optional
  // subtle annotation -- a fixed clock window, not derived from this
  // day's own price ranking, so it's computed from each slot's real
  // local time rather than from rateColorStepIndex. Only rendered when
  // at least one slot actually falls in it (defensive -- every demo day
  // does, but this stays correct for any future day shape too).
  const structuralPeakSlotIndices = useMemo(
    () => day.slots.reduce<number[]>((acc, slot, i) => (isStructuralPeakSlot(slot.startsAt) ? [...acc, i] : acc), []),
    [day],
  )
  const structuralPeakWindow =
    showStructuralPeakAnnotation && structuralPeakSlotIndices.length > 0
      ? { start: structuralPeakSlotIndices[0], end: structuralPeakSlotIndices[structuralPeakSlotIndices.length - 1] }
      : null

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

  // OA-103/105: pointer position -> slot index, centring the drag point
  // under the cursor rather than snapping the event's left edge to it,
  // then clamping to this event's own valid same-day window (handed in by
  // the caller -- LandingDemo.tsx clamps again before committing state,
  // this is only so the dragged position never visually escapes the
  // window). Each event carries its own min/max, so two events with
  // different constraints (e.g. a washing machine's requiresAwakeHome vs.
  // a dishwasher's unconstrained window) are each held to their own.
  function slotFromPointerX(clientX: number, overlay: MovableEventOverlay): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return overlay.startSlot
    const ratio = (clientX - rect.left) / rect.width
    const rawSlot = Math.round(ratio * day.slots.length - overlay.slotCount / 2)
    return Math.max(overlay.minStartSlot, Math.min(overlay.maxStartSlot, rawSlot))
  }

  function handleEventPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function handleEventPointerMove(e: React.PointerEvent<HTMLDivElement>, overlay: MovableEventOverlay) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const nextSlot = slotFromPointerX(e.clientX, overlay)
    if (nextSlot !== overlay.startSlot) overlay.onMove(nextSlot)
  }

  function handleEventKeyDown(e: React.KeyboardEvent<HTMLDivElement>, overlay: MovableEventOverlay) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      overlay.onMove(Math.min(overlay.maxStartSlot, overlay.startSlot + 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      overlay.onMove(Math.max(overlay.minStartSlot, overlay.startSlot - 1))
    }
  }

  function eventTimeRange(overlay: LandingTimeProfileEventOverlay): string {
    const slots = Array.from({ length: overlay.slotCount }, (_, i) => day.slots[overlay.startSlot + i]).filter(
      (s): s is HeatMapDay['slots'][number] => s !== undefined,
    )
    if (slots.length === 0) return ''
    if (slots.length === 1) return formatSlotTime(slots[0].startsAt)
    return `${formatSlotTime(slots[0].startsAt)}–${formatSlotTime(slots[slots.length - 1].startsAt)}`
  }

  // OA-106: defence-in-depth against the "empty outlined block" bug -- an
  // overlay only renders when it has a real id/label, a positive
  // duration, a start slot inside this day, and a resolvable time range
  // (i.e. every slot it claims to occupy actually exists). The caller
  // (LandingDemo.tsx) already filters its source events with
  // `isRealHouseholdEvent`; this is the chart's own guarantee that it
  // never draws an orphan/empty shell even if a future caller forgets to.
  function isRenderableEventOverlay(overlay: LandingTimeProfileEventOverlay): boolean {
    return (
      overlay.id.trim().length > 0 &&
      overlay.label.trim().length > 0 &&
      overlay.slotCount > 0 &&
      overlay.startSlot >= 0 &&
      overlay.startSlot + overlay.slotCount <= day.slots.length &&
      eventTimeRange(overlay) !== ''
    )
  }

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
        {/* OA-104: the longer-term projection, shown with more visual
            weight than the daily figure below it -- "a few pence today
            only matters if we show what that behaviour could add up to
            over time". Only the Optimise step passes this. */}
        {payoff && <div className="landing-time-profile__payoff">{payoff}</div>}
        <p className="landing-time-profile__summary">{summary}</p>
        <p className="landing-time-profile__explanation">{explanation}</p>
        <p className="landing-time-profile__cost-note">{costNote}</p>
        {/* OA-104: per-event detail ("Dishwasher moved to...") -- secondary
            to the household-level payoff above, but inspectable. */}
        {eventDetail && <p className="landing-time-profile__event-detail">{eventDetail}</p>}
        {caveat && <p className="landing-time-profile__caveat">{caveat}</p>}
      </div>

      {/* OA-106: "Optimise all" / "Reset", placed above the chart as clear
          secondary controls -- only the Optimise step passes these. */}
      {controls}

      {/* OA-101: a continuous cheaper -> more-expensive gradient, replacing
          the earlier "Cheap · Standard · Peak" 3-band legend -- Agile has
          48 distinct half-hour prices, not fixed tariff bands. */}
      <div className="landing-time-profile__legend">
        <span className="landing-time-profile__legend-item landing-time-profile__legend-item--price">
          <span className="landing-time-profile__legend-gradient" aria-hidden="true" style={{ background: PRICE_LEGEND_GRADIENT }} />
          Cheaper <span aria-hidden="true">←</span> price <span aria-hidden="true">→</span> More expensive
        </span>
        <span className="landing-time-profile__legend-item">
          <span className="landing-time-profile__legend-bar" aria-hidden="true" />
          Usage
        </span>
      </div>

      <div className="landing-time-profile__body">
        <div
          ref={trackRef}
          className="landing-time-profile__track"
          role="group"
          aria-label={heading}
          aria-describedby={selectedSlot ? panelId : undefined}
        >
          {day.slots.map((slot, slotIndex) => {
            // OA-101: continuous cheaper -> more-expensive background,
            // one of the validated 9-step ramp's colours per slot
            // (rateColorStepIndex), not a 3-band category -- every
            // half-hour keeps its own distinct price.
            const step = rateColorStepIndex(slot.unitRateIncVatPence, min, max)
            const isSelected = selected === slotIndex
            return (
              <button
                key={slot.startsAt}
                type="button"
                ref={(el) => {
                  cellRefs.current[slotIndex] = el
                }}
                className="landing-time-profile__column"
                style={step !== null ? { backgroundColor: RATE_COLOR_STEPS_DARK[step] } : undefined}
                data-unknown={step === null || undefined}
                data-selected={isSelected || undefined}
                aria-label={describeSlot(slot)}
                tabIndex={slotIndex === 0 ? 0 : -1}
                onFocus={() => setSelected(slotIndex)}
                onClick={() => setSelected(slotIndex)}
                onKeyDown={(e) => handleKeyDown(e, slotIndex)}
              />
            )
          })}

          {/* OA-99/OA-101: an optional subtle annotation for Agile's
              documented 16:00-19:00 structural peak window -- a label and
              a thin top bracket across those columns, not a coloured band
              (each column's own background above already carries its
              real, distinct price). Purely decorative/duplicative of the
              per-slot aria-label and sr-table below, so aria-hidden. */}
          {structuralPeakWindow && (
            <div
              className="landing-time-profile__structural-peak"
              aria-hidden="true"
              style={{
                left: `${(structuralPeakWindow.start / day.slots.length) * 100}%`,
                width: `${((structuralPeakWindow.end - structuralPeakWindow.start + 1) / day.slots.length) * 100}%`,
              }}
            >
              <span className="landing-time-profile__structural-peak-label">4–7pm peak period</span>
            </div>
          )}

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

          {/* OA-105: every shared household event, overlaid in the same
              position on every tab -- a fixed, non-interactive annotation
              here, or (Optimise only) a draggable overlay, clamped by the
              caller to that event's own valid same-day window. Positioned
              as a percentage of the track, same basis as the
              structural-peak annotation above, so it always lines up with
              the columns it covers regardless of rendered width. */}
          {events
            ?.filter(isRenderableEventOverlay)
            // OA-106: "no duplicate event containers" -- keep only the
            // first overlay for a given id, in the unexpected case the
            // caller's `events` array repeats one.
            .filter((overlay, index, all) => all.findIndex((o) => o.id === overlay.id) === index)
            .map((overlay) => {
              const left = `${(overlay.startSlot / day.slots.length) * 100}%`
              const width = `${(overlay.slotCount / day.slots.length) * 100}%`
              const timeRange = eventTimeRange(overlay)

              if (!overlay.movable) {
                return (
                  <div
                    key={overlay.id}
                    className="landing-time-profile__event-annotation"
                    style={{ left, width }}
                  >
                    <span className="landing-time-profile__event-annotation-label">
                      {overlay.label} · {timeRange}
                    </span>
                  </div>
                )
              }

              return (
                <div
                  key={overlay.id}
                  className="landing-time-profile__flexible-event"
                  role="slider"
                  tabIndex={0}
                  aria-label={`Move ${overlay.label.toLowerCase()}`}
                  aria-valuemin={overlay.minStartSlot}
                  aria-valuemax={overlay.maxStartSlot}
                  aria-valuenow={overlay.startSlot}
                  aria-valuetext={`${overlay.label}, ${timeRange}`}
                  style={{ left, width }}
                  onPointerDown={handleEventPointerDown}
                  onPointerMove={(e) => handleEventPointerMove(e, overlay)}
                  onKeyDown={(e) => handleEventKeyDown(e, overlay)}
                >
                  <span className="landing-time-profile__flexible-event-label">
                    {overlay.label} · {timeRange}
                  </span>
                </div>
              )
            })}
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
