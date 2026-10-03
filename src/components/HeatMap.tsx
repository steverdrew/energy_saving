import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import {
  findAnnotations,
  findPeakWindow,
  formatSlotTime,
  maxUsage,
  rateCategoryIndex,
  rateColorStepIndex,
  rateRange,
  RATE_CATEGORY_LABELS,
  RATE_COLOR_STEPS_LIGHT,
  type HeatMapDay,
  type HeatMapSlot,
} from './heatMapMath'
import './HeatMap.css'

const dayLabelFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatDayLabel(date: string): string {
  // `date` is a plain YYYY-MM-DD -- parse at noon to stay clear of any
  // DST-boundary date-shifting from parsing midnight in a non-UTC zone.
  return dayLabelFormatter.format(new Date(`${date}T12:00:00Z`))
}

function describeSlot(slot: HeatMapSlot): string {
  const time = formatSlotTime(slot.startsAt)
  const rate = slot.unitRateIncVatPence !== null ? `${slot.unitRateIncVatPence.toFixed(1)}p/kWh` : 'rate unknown'
  const usage = slot.kwh !== null ? `${slot.kwh.toFixed(2)} kWh` : 'usage unknown'
  const cost = slot.costPence !== null ? formatGbp(slot.costPence) : 'cost unknown'
  return `${time} — ${usage}, ${rate}, ${cost}`
}

export interface HeatMapProps {
  days: HeatMapDay[]
  /** Accessible label for the chart as a whole, e.g. "Actual usage and cost". */
  title: string
  /**
   * OA-85: 'sequential' (default) is the authenticated-page chart --
   * one-hue rate ramp, usage as bar height. 'tariff' is the landing-page
   * demo's own mechanism -- rate as a 3-band cheap/standard/peak colour
   * (green/purple/red), usage as cell opacity/intensity instead of a bar.
   * Scoped to this prop (not a global style change) so Actual/Compare/
   * Optimised keep their existing chart untouched.
   */
  variant?: 'sequential' | 'tariff'
}

/**
 * OA-70: the shared 30-day heat map -- tariff-agnostic (it only consumes
 * HeatMapDay[], never infers tariff family), reused by Actual, Like-for-like
 * and later Shifted. Background colour = rate (one sequential hue, per the
 * dataviz skill); foreground bar height = usage, so the two magnitudes never
 * share a channel. The 'tariff' variant (OA-85) is the one exception to
 * that convention, deliberately scoped to the landing-page demo only.
 */
function HeatMap({ days, title, variant = 'sequential' }: HeatMapProps) {
  const [selected, setSelected] = useState<{ dayIndex: number; slotIndex: number } | null>(null)
  const [showTable, setShowTable] = useState(false)
  const panelId = useId()
  const cellRefs = useRef<Array<Array<HTMLButtonElement | null>>>([])

  const { min, max } = useMemo(() => rateRange(days), [days])
  const peakUsage = useMemo(() => maxUsage(days), [days])
  const annotations = useMemo(() => findAnnotations(days), [days])
  const isTariff = variant === 'tariff'
  // OA-86: derived from this step's own fixture data (the longest run of
  // peak-band slots in a representative day), never a hard-coded time
  // band -- a flat tariff (e.g. Baseline) has no peak run, so this is
  // null and no overlay renders, exactly mirroring the reference
  // mockup's "peak overlay hidden on Baseline" behaviour without needing
  // a per-step special case.
  const peakWindow = useMemo(() => (isTariff ? findPeakWindow(days[0], min, max) : null), [isTariff, days, min, max])
  const peakWindowLabel = useMemo(() => {
    if (!peakWindow) return null
    const startSlot = days[0]?.slots[peakWindow.startSlot]
    const endSlot = days[0]?.slots[peakWindow.endSlot]
    if (!startSlot || !endSlot) return null
    const endsAt = new Date(new Date(endSlot.startsAt).getTime() + 30 * 60_000).toISOString()
    return `${formatSlotTime(startSlot.startsAt)}–${formatSlotTime(endsAt)}`
  }, [peakWindow, days])

  const annotationFor = (dayIndex: number, slotIndex: number) =>
    annotations.find((a) => a.dayIndex === dayIndex && a.slotIndex === slotIndex)

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

  const selectedSlot =
    selected !== null ? days[selected.dayIndex]?.slots[selected.slotIndex] ?? null : null
  const selectedDay = selected !== null ? days[selected.dayIndex] : null

  return (
    <div className={isTariff ? 'heat-map heat-map--tariff' : 'heat-map'}>
      <div className="heat-map__header">
        <h2 className="heat-map__title">{title}</h2>
        <button type="button" className="heat-map__table-toggle" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Show heat map' : 'Show as table'}
        </button>
      </div>

      <p id={panelId} className="heat-map__detail" aria-live="polite">
        {selectedSlot && selectedDay
          ? `${formatDayLabel(selectedDay.date)}, ${describeSlot(selectedSlot)}`
          : 'Select a period for details.'}
      </p>

      {!showTable && (
        <>
          <div className="heat-map__legend">
            {isTariff ? (
              <>
                {RATE_CATEGORY_LABELS.map((label, i) => (
                  <span className="heat-map__legend-item" key={label}>
                    <span className="heat-map__legend-swatch" aria-hidden="true" data-category={i} />
                    <span className="heat-map__legend-label">{label}</span>
                  </span>
                ))}
                <span className="heat-map__legend-note">
                  Shade shows usage{peakWindowLabel ? ` · Peak ${peakWindowLabel}` : ''}
                </span>
              </>
            ) : (
              <>
                <span className="heat-map__legend-label">Cheapest</span>
                <span className="heat-map__legend-ramp" aria-hidden="true">
                  {RATE_COLOR_STEPS_LIGHT.map((_, i) => (
                    <span key={i} className="heat-map__legend-step" data-step={i} />
                  ))}
                </span>
                <span className="heat-map__legend-label">Most expensive</span>
                <span className="heat-map__legend-note">Bar height = usage</span>
              </>
            )}
          </div>

          <div className="heat-map__grid" role="group" aria-label={title} aria-describedby={panelId}>
            {days.map((day, dayIndex) => {
              return (
                <div className="heat-map__row" key={day.date}>
                  <span className="heat-map__row-label">{formatDayLabel(day.date)}</span>
                  <div className="heat-map__row-cells">
                    {day.slots.map((slot, slotIndex) => {
                      const stepIndex = isTariff
                        ? rateCategoryIndex(slot.unitRateIncVatPence, min, max)
                        : rateColorStepIndex(slot.unitRateIncVatPence, min, max)
                      const usageRatio = slot.kwh !== null && peakUsage > 0 ? slot.kwh / peakUsage : 0
                      const annotation = annotationFor(dayIndex, slotIndex)
                      const isSelected = selected?.dayIndex === dayIndex && selected?.slotIndex === slotIndex
                      return (
                        <button
                          key={slot.startsAt}
                          type="button"
                          ref={(el) => {
                            const row = cellRefs.current[dayIndex] ?? (cellRefs.current[dayIndex] = [])
                            row[slotIndex] = el
                          }}
                          className="heat-map__cell"
                          data-step={stepIndex ?? 'unknown'}
                          data-selected={isSelected || undefined}
                          data-annotated={annotation ? true : undefined}
                          style={{ '--usage-ratio': usageRatio } as React.CSSProperties}
                          aria-label={describeSlot(slot)}
                          aria-describedby={panelId}
                          tabIndex={dayIndex === 0 && slotIndex === 0 ? 0 : -1}
                          onFocus={() => setSelected({ dayIndex, slotIndex })}
                          onClick={() => setSelected({ dayIndex, slotIndex })}
                          onKeyDown={(e) => handleKeyDown(e, dayIndex, slotIndex)}
                        >
                          {!isTariff && <span className="heat-map__cell-bar" />}
                          {annotation && <span className="heat-map__cell-flag" aria-hidden="true" />}
                        </button>
                      )
                    })}
                    {peakWindow && (
                      <span
                        className="heat-map__peak-overlay"
                        aria-hidden="true"
                        style={{ gridColumn: `${peakWindow.startSlot + 1} / ${peakWindow.endSlot + 2}` }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {annotations.length > 0 && (
            <ul className="heat-map__annotations">
              {annotations.map((a) => {
                const day = days[a.dayIndex]
                const slot = day?.slots[a.slotIndex]
                if (!day || !slot) return null
                return (
                  <li key={a.label}>
                    <strong>{a.label}:</strong> {formatDayLabel(day.date)}, {formatSlotTime(slot.startsAt)}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {showTable && (
        <div className="heat-map__table-wrap">
          <table className="heat-map__table">
            <caption className="heat-map__table-caption">{title} — exact values</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
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
                    <td>{formatDayLabel(day.date)}</td>
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
      )}
    </div>
  )
}

export default HeatMap
