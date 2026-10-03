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
  type HeatMapSlot,
} from './heatMapMath'
import './LandingTimeProfile.css'

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

// OA-131: how this tariff's price should be segmented in the dedicated
// price strip above the chart -- deliberately not the fixture's own
// `TariffId` (standard-variable/economy-7/agile), so this chart component
// stays presentation-only and doesn't need to import the domain module.
// 'flat': one tone, no implied variation (Standard Variable). 'two-rate':
// a day/night block pair, never rendered as 48 independent Agile-style
// segments (Economy 7). 'dynamic': every half-hour keeps its own price
// segment (Agile).
export type PriceStripShape = 'flat' | 'two-rate' | 'dynamic'

interface PriceStripSegment {
  startSlot: number
  slotCount: number
  rate: number | null
}

/**
 * OA-131: groups the day's 48 half-hourly rates into the strip's visual
 * segments. 'dynamic' keeps every slot distinct (Agile's 48 genuinely
 * different prices must never be merged, even if two happen to match).
 * 'flat'/'two-rate' merge each run of *consecutive equal* rates into one
 * segment -- this is derived from the real rate values already in `slots`,
 * not from a hardcoded clock window, so it stays correct if the tariff
 * model's off-peak hours ever change. A flat tariff naturally collapses to
 * one segment; a day/night tariff naturally collapses to the (two or
 * three, if the night window wraps around midnight) runs its own rates
 * actually form.
 */
function buildPriceStripSegments(slots: readonly HeatMapSlot[], shape: PriceStripShape): PriceStripSegment[] {
  if (shape === 'dynamic') {
    return slots.map((slot, i) => ({ startSlot: i, slotCount: 1, rate: slot.unitRateIncVatPence }))
  }
  const segments: PriceStripSegment[] = []
  slots.forEach((slot, i) => {
    const last = segments[segments.length - 1]
    if (last && last.rate === slot.unitRateIncVatPence) {
      last.slotCount += 1
    } else {
      segments.push({ startSlot: i, slotCount: 1, rate: slot.unitRateIncVatPence })
    }
  })
  return segments
}

// OA-133: "Economy 7 should not use a continuous cheaper -> more-expensive
// legend" -- Flexible/Fixed and Agile keep their own static copy, but
// two-rate's legend names its two explicit states (day rate / off-peak)
// with the *actual* off-peak time range (`offPeakTimeRange`, resolved by
// the caller from this day's own segments), never a hand-written clock
// window that could drift from the real data.
function priceStripLegendText(shape: PriceStripShape, offPeakTimeRange: string | null): string {
  if (shape === 'flat') return 'Flat rate — the same price all day'
  if (shape === 'dynamic') return 'Cheaper ← price → More expensive'
  return offPeakTimeRange ? `Day rate · Off-peak ${offPeakTimeRange}` : 'Day rate · Off-peak'
}

// OA-107: "event labels must never render on top of one another ... if
// multiple events overlap in time, place them in separate visual lanes/
// rows". A simple greedy interval-partitioning pass -- sort by start slot,
// then assign each overlay to the first lane whose last-placed event has
// already finished by this overlay's start slot, opening a new lane
// otherwise. Two events placed deliberately at the same time (e.g. EV
// charging and the dishwasher) are a valid, realistic simultaneous load
// (the ticket is explicit that this must be allowed) -- lanes solve the
// *label* collision that would otherwise cause, without implying the
// loads themselves conflict.
// OA-115: a label is now allowed to overflow its own (duration-sized)
// chip rather than being hard-truncated, so two events placed back to
// back in time -- no actual time overlap, just adjacent -- can still get
// their *labels* visually colliding once those labels are wider than the
// slots they cover. This rough character-per-slot estimate (not a real
// text measurement, which would need a DOM ref/ResizeObserver this
// component doesn't otherwise need) reserves extra lane width for a
// short-duration event with a long name, so it's pushed to its own lane
// instead of visually colliding with its neighbour's label.
const ESTIMATED_CHARS_PER_LABEL_SLOT = 2.2

function computeEventLanes(overlays: readonly LandingTimeProfileEventOverlay[]): Map<string, number> {
  const laneEndSlots: number[] = []
  const laneByEventId = new Map<string, number>()
  const sorted = [...overlays].sort((a, b) => a.startSlot - b.startSlot)
  for (const overlay of sorted) {
    const labelSlotSpan = Math.ceil(overlay.label.length / ESTIMATED_CHARS_PER_LABEL_SLOT)
    const end = overlay.startSlot + Math.max(overlay.slotCount, labelSlotSpan)
    let lane = laneEndSlots.findIndex((laneEnd) => laneEnd <= overlay.startSlot)
    if (lane === -1) {
      lane = laneEndSlots.length
      laneEndSlots.push(end)
    } else {
      laneEndSlots[lane] = end
    }
    laneByEventId.set(overlay.id, lane)
  }
  return laneByEventId
}

// OA-107/OA-115: "prefer a compact label ... when space is constrained,
// show the event name only" -- below this width (in half-hour slots), the
// secondary time-range line is dropped first, keeping just the event
// name (OA-115: never hard-truncated -- see the chip label CSS, which
// lets the name overflow its own coloured indicator rather than clipping
// it). The full time range stays available via the native title tooltip
// (fixed annotations) or the slider's aria-valuetext (movable events)
// either way.
const COMPACT_LABEL_MAX_SLOT_COUNT = 2

// OA-115: event chips are now a fixed-height row anchored near the top of
// the track, not a box stretching the full chart height -- "selecting an
// event should emphasise the event block itself, not read like a new
// data band/time-slice selection". `EVENT_CHIP_TOP_OFFSET_PX` clears the
// structural-peak annotation's own label (OA-99/OA-101), which sits at
// the very top of the track. OA-116: shrunk roughly 25-30% from OA-115's
// first pass -- "the graph should remain the primary visual", not the
// chips describing it. OA-129: grown back up again to fit the larger
// `--chart-event-label-size`/`--chart-event-secondary-size` type scale
// (16px/14px) -- the chart height itself (`.landing-time-profile__track`,
// in LandingTimeProfile.css) already scales with `--event-lanes`, so this
// doesn't crowd the chart, it just gives each lane a bit more room.
const EVENT_CHIP_HEIGHT_PX = 28
const EVENT_CHIP_GAP_PX = 6
const EVENT_CHIP_TOP_OFFSET_PX = 20

export interface LandingTimeProfileProps {
  day: HeatMapDay
  /** OA-100: not rendered visibly (the tabs are the state selector, and "Typical household" is the section's one heading -- see LandingDemo.tsx) -- used only as the accessible name for the chart's group aria-label and sr-table caption. */
  heading: string
  /** OA-110: the stage's one question-style heading, e.g. "What would that day cost on Agile?" -- rendered visibly above the chart, answering one simple question per stage so the narrative reads continuously left to right. */
  questionHeading: ReactNode
  /** OA-110: a short supporting line under the question heading (e.g. "Same usage. Same timings. Different prices.") -- never a long explanatory paragraph; the slider transition itself communicates the detailed relationship. */
  supportingCopy: ReactNode
  /** OA-126: a short, quieter label shown directly above `result`, e.g. "Typical day · 6.8 kWh" -- names what the figure below it actually is (a modelled daily usage amount, not an average household's total spend) before the bold £ figure itself. */
  resultLabel?: ReactNode
  /** OA-110: the compact, visually dominant primary result for this stage, e.g. "£1.80 energy cost" or "Save around £73/year". Exactly one bold figure per stage -- no second block duplicates it. */
  result: ReactNode
  /** OA-108: further supporting detail shown below the primary result -- a heading + sentence once the Optimise content hierarchy applies, or omitted on Baseline/Compare now that OA-110's supporting copy covers the top-of-chart narrative. `ReactNode` (not `string`) so LandingDemo.tsx can own that structure without this component knowing about it. */
  explanation?: ReactNode
  /** OA-99: shown identically on every tab -- whether the headline £ figure is usage cost only or usage + standing charge. */
  costNote: string
  /** An optional secondary disclaimer block (Compare/Optimise's "illustrative example" caveats, or OA-108's "View assumptions" disclosure). */
  caveat?: ReactNode
  /** OA-104: an optional prominent payoff line shown above `summary`, carrying more visual weight than the daily figure -- e.g. "You could save around £73/year...". Only the Optimise step passes this. */
  payoff?: ReactNode
  /** OA-126: the standing charge, disclosed quietly right next to the result it's deliberately excluded from (e.g. "+ 55p/day standing charge") -- shown on every stage, consistently, so the headline £ figure is never mistaken for a visitor's full daily bill. */
  standingChargeNote?: ReactNode
  /** OA-106: optional secondary controls ("Optimise all" / "Reset"), shown above the chart -- only the Optimise step passes this. */
  controls?: ReactNode
  /** OA-141: Baseline's current-tariff selector, promoted to its own full-width, visually prominent block -- "the key decision on Tab 1... should have stronger hierarchy than secondary controls." Rendered between the supporting copy and the result (never squeezed into the `controls` slot beside the heading, which stays small/secondary for Compare/Optimise). Only the Baseline step passes this. */
  primarySelector?: ReactNode
  /** Remounts just the narrative block (not the chart) to replay its OA-80 fade/slide on step change -- see the component doc comment for why the chart itself must stay mounted. */
  stepKey: string
  /** OA-99/OA-101: the 16:00-19:00 structural-peak annotation is a documented feature of *Agile's* pricing formula specifically -- showing it on a flat Standard Variable day would wrongly imply that flat tariff has the same structural peak. Baseline passes `false`; Compare/Optimise (both on Agile) pass `true`. */
  showStructuralPeakAnnotation: boolean
  /** OA-131: how the active tariff's price should be segmented in the dedicated price strip above the chart -- `'flat'` for Standard Variable, `'two-rate'` for Economy 7, `'dynamic'` for Agile's 48 genuinely distinct half-hourly prices. The caller already knows which tariff is active (`TariffId`); this keeps that domain concept out of this presentation-only component. */
  priceStripShape: PriceStripShape
  /** OA-105: every household event, shown as an overlay on the track -- fixed annotations on Baseline/Compare, draggable overlays (the `movable: true` variant) on Optimise. Shared across all three tabs so events are never invented fresh on one tab. */
  events?: LandingTimeProfileEventOverlay[]
  /** OA-108: "per-event feedback should appear contextually ... in/near the event block itself when it's selected, focused, or being dragged" -- replaces the old permanent per-appliance list. Given a movable overlay's id, returns the compact saving text to show in a popover near it while focused/hovered/dragged, or `undefined` for no popover (e.g. nothing has moved from its original slot yet). */
  eventSavingText?: (eventId: string) => string | undefined
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
  questionHeading,
  supportingCopy,
  resultLabel,
  result,
  explanation,
  costNote,
  caveat,
  payoff,
  standingChargeNote,
  controls,
  primarySelector,
  stepKey,
  showStructuralPeakAnnotation,
  priceStripShape,
  events,
  eventSavingText,
}: LandingTimeProfileProps) {
  const [selected, setSelected] = useState<number | null>(null)
  // OA-108: which movable event's contextual saving popover is showing --
  // set on focus/hover/drag of that event's overlay, cleared on blur/
  // pointer-leave. Replaces the old permanent per-appliance list.
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
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

  // OA-131: the dedicated price strip's own segments -- separate from the
  // (now price-neutral) usage columns below. See `buildPriceStripSegments`
  // for why 'flat'/'two-rate' merge equal-rate runs while 'dynamic' never
  // does.
  const priceStripSegments = useMemo(
    () => buildPriceStripSegments(day.slots, priceStripShape),
    [day, priceStripShape],
  )

  // OA-133: the real off-peak time range for a 'two-rate' tariff (e.g.
  // "01:30–08:30"), resolved from this day's own segments -- never a
  // hand-written clock window that could drift from the actual rate data.
  // The off-peak segment is whichever one carries the lower of the two
  // rates present.
  const offPeakTimeRange = useMemo(() => {
    if (priceStripShape !== 'two-rate') return null
    const rates = priceStripSegments.map((s) => s.rate).filter((r): r is number => r !== null)
    if (rates.length === 0) return null
    const offPeakRate = Math.min(...rates)
    const offPeakSegment = priceStripSegments.find((s) => s.rate === offPeakRate)
    const firstSlot = offPeakSegment && day.slots[offPeakSegment.startSlot]
    const lastSlot = offPeakSegment && day.slots[offPeakSegment.startSlot + offPeakSegment.slotCount - 1]
    if (!firstSlot || !lastSlot) return null
    const lastSlotEnd = new Date(new Date(lastSlot.startsAt).getTime() + 30 * 60 * 1000).toISOString()
    return `${formatSlotTime(firstSlot.startsAt)}–${formatSlotTime(lastSlotEnd)}`
  }, [priceStripShape, priceStripSegments, day])

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

  // OA-107: computed once per render, used both for the track's own
  // `--event-lanes` sizing and for each overlay's lane placement below.
  const renderableEventOverlays = useMemo(
    () =>
      (events ?? [])
        .filter(isRenderableEventOverlay)
        // OA-106: "no duplicate event containers" -- keep only the first
        // overlay for a given id, in the unexpected case the caller's
        // `events` array repeats one.
        .filter((overlay, index, all) => all.findIndex((o) => o.id === overlay.id) === index),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRenderableEventOverlay closes over `day` only; `events` already covers every input this memo actually varies on.
    [events],
  )
  const eventLanes = useMemo(() => computeEventLanes(renderableEventOverlays), [renderableEventOverlays])
  const eventLaneCount = Math.max(1, ...Array.from(eventLanes.values(), (lane) => lane + 1))

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

  // OA-131: the price strip's own accessible label -- a time range plus
  // the rate that applies across it (one rate for a merged 'flat'/
  // 'two-rate' block, that half-hour's own rate for a 'dynamic' segment).
  function describePriceStripSegment(segment: PriceStripSegment): string {
    const slots = Array.from(
      { length: segment.slotCount },
      (_, i) => day.slots[segment.startSlot + i],
    ).filter((s): s is HeatMapSlot => s !== undefined)
    if (slots.length === 0) return ''
    const time =
      slots.length === 1
        ? formatSlotTime(slots[0].startsAt)
        : `${formatSlotTime(slots[0].startsAt)}–${formatSlotTime(slots[slots.length - 1].startsAt)}`
    const rate = segment.rate !== null ? `${segment.rate.toFixed(1)}p/kWh` : 'rate unknown'
    return `${time} — ${rate}`
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
      {/* OA-98/OA-100/OA-114: meaning -> evidence -> explanation -- only
          the stage question/supporting line/key result sit above the
          chart now, so the chart (the actual proof/evidence) appears
          immediately after them; anything explanatory (methodology,
          caveats, the cost-basis footnote) moved below the chart (see
          `__below-chart` further down), so it never pushes the chart down
          or delays the transition a visitor is watching. No visible
          top-level heading here: "Typical household" (LandingDemo.tsx) is
          the section's one heading, and the question heading already
          names the state, so a further heading here would duplicate both.
          `heading` itself isn't lost -- it's still the accessible name
          for the chart below (group aria-label, sr-table caption). Keyed
          by `stepKey` so this block alone replays the OA-80 fade/slide on
          step change (see the component doc comment for why the chart
          below must not remount the same way). */}
      <div className="landing-time-profile__narrative" key={stepKey}>
        {/* OA-110/OA-126: the question heading/supporting line sit in a
            row alongside "Reset"/"Optimise" -- top-right of the card, next
            to the heading they relate to, rather than stacked as their own
            full-width row between the narrative and the chart. Only the
            Optimise step passes `controls`. */}
        <div className="landing-time-profile__heading-row">
          <div className="landing-time-profile__heading-col">
            {/* OA-110: one question-style heading plus a short supporting
                line per stage -- answers "when do you use energy -> what
                that costs on Agile -> what you could save" at a glance, so
                the narrative reads continuously rather than as three
                separate screens. */}
            <h3 className="landing-time-profile__question">{questionHeading}</h3>
            <p className="landing-time-profile__supporting">{supportingCopy}</p>
          </div>
          {controls}
        </div>
        {/* OA-141: "the selector should not feel visually lost between the
            intro copy and the graph" -- its own full-width block, between
            the supporting copy and the result, with stronger hierarchy
            than the small `controls` slot above (which stays as-is for
            Compare/Optimise). Only Baseline passes this. */}
        {primarySelector && <div className="landing-time-profile__primary-selector">{primarySelector}</div>}
        {/* OA-126: names what the result figure actually is (a modelled
            daily usage amount, not a total household spend) directly
            above it, rather than relying on the result line itself to
            imply that distinction. */}
        {resultLabel && <p className="landing-time-profile__result-label">{resultLabel}</p>}
        {/* OA-104/OA-110: the stage's one compact, visually dominant
            result -- "a few pence today only matters if we show what
            that behaviour could add up to over time", and it should read
            as a single bold figure, not buried in a longer sentence. */}
        <p className="landing-time-profile__result">{result}</p>
        {payoff && <div className="landing-time-profile__payoff">{payoff}</div>}
        {/* OA-126: the standing charge is disclosed right next to the
            figure it's excluded from, not just in the below-chart
            footnote -- quiet enough to not compete with `result`, but
            immediately visible without having to read the methodology
            disclosure. */}
        {standingChargeNote && <p className="landing-time-profile__standing-charge-note">{standingChargeNote}</p>}
      </div>

      <div className="landing-time-profile__body">
        {/* OA-131: the dedicated, aligned price strip -- now the *only*
            price encoding; the usage track below is deliberately calmer
            (a flat neutral background) so price and usage never compete
            for the same visual channel. Uses the same 48-half-hour flex
            basis as the track below (`flexGrow` per slot occupied), so a
            segment always lines up exactly with the usage columns it
            covers, regardless of rendered width. */}
        <div
          className="landing-time-profile__price-strip"
          role="group"
          aria-label={`${heading} — price strip`}
          style={{ '--event-lanes': eventLaneCount } as React.CSSProperties}
        >
          {priceStripSegments.map((segment) => {
            // OA-133: "Economy 7 should not use a continuous cheaper ->
            // more-expensive gradient" -- 'two-rate' gets two fixed,
            // maximally-distinct tones from the ramp (its two ends)
            // rather than a value sampled from the generic continuous
            // normalisation, so it reads as two explicit states, not a
            // position on a scale. 'dynamic' (Agile) keeps the real
            // continuous normalisation against this day's own min/max.
            const step =
              segment.rate === null
                ? null
                : priceStripShape === 'two-rate'
                  ? segment.rate === Math.min(...priceStripSegments.map((s) => s.rate ?? Infinity))
                    ? 0
                    : 8
                  : rateColorStepIndex(segment.rate, min, max)
            return (
              // A real button (not just a decorative div): "exact rate
              // details available via hover/tap" and "touch interaction
              // must work without hover" both need a genuine tap target,
              // not a native `title` tooltip (hover-only, and absent on
              // touch). Clicking/tapping reuses the same selection + live
              // region the usage columns below already expose.
              <button
                key={segment.startSlot}
                type="button"
                className="landing-time-profile__price-segment"
                style={{
                  flexGrow: segment.slotCount,
                  backgroundColor: step !== null ? RATE_COLOR_STEPS_DARK[step] : undefined,
                }}
                data-unknown={step === null || undefined}
                aria-label={describePriceStripSegment(segment)}
                onClick={() => setSelected(segment.startSlot)}
              />
            )
          })}

          {/* OA-99/OA-101/OA-131: Agile's documented 16:00-19:00
              structural peak window -- a label and thin bracket over the
              strip (the strip's own segments already carry each
              half-hour's real, distinct price; this only calls the
              window out as a structural pricing feature). Purely
              decorative/duplicative of each segment's own aria-label, so
              aria-hidden. */}
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
        </div>

        {/* OA-131: names what the strip's colours mean -- "the price
            strip", never the whole chart background, which no longer
            carries any price encoding. Wording matches how that tariff's
            strip actually renders (flat/two-rate/dynamic). */}
        <p className="landing-time-profile__price-legend">{priceStripLegendText(priceStripShape, offPeakTimeRange)}</p>

        <div
          ref={trackRef}
          className="landing-time-profile__track"
          role="group"
          aria-label={heading}
          aria-describedby={selectedSlot ? panelId : undefined}
          style={{ '--event-lanes': eventLaneCount } as React.CSSProperties}
        >
          {day.slots.map((slot, slotIndex) => {
            const isSelected = selected === slotIndex
            return (
              <button
                key={slot.startsAt}
                type="button"
                ref={(el) => {
                  cellRefs.current[slotIndex] = el
                }}
                className="landing-time-profile__column"
                data-selected={isSelected || undefined}
                aria-label={describeSlot(slot)}
                tabIndex={slotIndex === 0 ? 0 : -1}
                onFocus={() => setSelected(slotIndex)}
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

          {/* OA-105/OA-115: every shared household event, overlaid in the
              same position on every tab -- a fixed, non-interactive chip
              here, or (Optimise only) a draggable chip, clamped by the
              caller to that event's own valid same-day window. OA-115:
              each chip is a fixed-height row anchored near the top of the
              track (not a box stretching the chart's full height, which
              read as a new data band rather than an object), positioned
              horizontally as a percentage of the track (same basis as the
              structural-peak annotation above) so it lines up with the
              columns it covers regardless of rendered width -- but its
              *label* is allowed to overflow that coloured indicator
              (`overflow: visible` in CSS) rather than hard-truncating, so
              short events like "Washing machine" never render as "Wa...". */}
          {renderableEventOverlays.map((overlay) => {
            const left = `${(overlay.startSlot / day.slots.length) * 100}%`
            const width = `${(overlay.slotCount / day.slots.length) * 100}%`
            const timeRange = eventTimeRange(overlay)
            // OA-107/OA-115: collision-safe lanes -- each event occupies
            // its own fixed-height row, stacked downward from
            // `EVENT_CHIP_TOP_OFFSET_PX`, instead of dividing the full
            // track height between however many lanes are in play.
            const lane = eventLanes.get(overlay.id) ?? 0
            const laneStyle = {
              top: `${EVENT_CHIP_TOP_OFFSET_PX + lane * (EVENT_CHIP_HEIGHT_PX + EVENT_CHIP_GAP_PX)}px`,
              height: `${EVENT_CHIP_HEIGHT_PX}px`,
              bottom: 'auto' as const,
            }
            const showTimeInLabel = overlay.slotCount > COMPACT_LABEL_MAX_SLOT_COUNT
            // OA-115: "selection should feel like this event is active, not
            // this entire time slice is selected" -- reuses the same
            // focused/hovered/dragging state OA-108's popover already
            // tracks, as the one local "active" emphasis for the chip
            // itself (stronger brand-accent outline/fill), never a
            // full-chart selection band.
            const isActive = activeEventId === overlay.id
            // Centred on the event's own span, same horizontal basis as the
            // chip -- thicker and in the brand's complementary amber (vs.
            // the neutral white hour/slot guides) so an event's drop-line is
            // never mistaken for the track's own time guidance.
            const lineLeft = `${((overlay.startSlot + overlay.slotCount / 2) / day.slots.length) * 100}%`
            const lineStyle = { left: lineLeft, top: laneStyle.top }

            if (!overlay.movable) {
              return (
                <div key={overlay.id}>
                  <span
                    className="landing-time-profile__event-line"
                    data-fixed=""
                    style={lineStyle}
                    aria-hidden="true"
                  />
                  <div
                    className="landing-time-profile__event-chip"
                    data-fixed=""
                    style={{ left, width, ...laneStyle }}
                  >
                    <span className="landing-time-profile__event-chip-label">
                      <span className="landing-time-profile__event-chip-name">{overlay.label}</span>
                      {showTimeInLabel && (
                        <span className="landing-time-profile__event-chip-time">{timeRange}</span>
                      )}
                    </span>
                  </div>
                </div>
              )
            }

            // OA-108: the contextual saving popover -- only while this
            // specific overlay is focused/hovered/being dragged, and only
            // when the caller has something to say about it (e.g. nothing
            // to show until the event has actually moved).
            const savingText = eventSavingText?.(overlay.id)
            const showPopover = isActive && Boolean(savingText)

            return (
              <div key={overlay.id}>
                <span
                  className="landing-time-profile__event-line"
                  data-active={isActive || undefined}
                  style={lineStyle}
                  aria-hidden="true"
                />
                <div
                  className="landing-time-profile__event-chip"
                  data-active={isActive || undefined}
                  role="slider"
                  tabIndex={0}
                  aria-label={`Move ${overlay.label.toLowerCase()}`}
                  aria-valuemin={overlay.minStartSlot}
                  aria-valuemax={overlay.maxStartSlot}
                  aria-valuenow={overlay.startSlot}
                  aria-valuetext={`${overlay.label}, ${timeRange}${savingText ? ` -- ${savingText}` : ''}`}
                  style={{ left, width, ...laneStyle }}
                  onPointerDown={(e) => {
                    setActiveEventId(overlay.id)
                    handleEventPointerDown(e)
                  }}
                  onPointerMove={(e) => handleEventPointerMove(e, overlay)}
                  onPointerEnter={() => setActiveEventId(overlay.id)}
                  onPointerLeave={() => setActiveEventId((current) => (current === overlay.id ? null : current))}
                  onFocus={() => setActiveEventId(overlay.id)}
                  onBlur={() => setActiveEventId((current) => (current === overlay.id ? null : current))}
                  onKeyDown={(e) => handleEventKeyDown(e, overlay)}
                >
                  {/* OA-115: "optional small drag handle/affordance" -- a
                      quiet grip mark, movable events only, so a fixed
                      annotation is never mistaken for something draggable. */}
                  <span className="landing-time-profile__event-chip-handle" aria-hidden="true" />
                  <span className="landing-time-profile__event-chip-label">
                    <span className="landing-time-profile__event-chip-name">{overlay.label}</span>
                    {showTimeInLabel && (
                      <span className="landing-time-profile__event-chip-time">{timeRange}</span>
                    )}
                  </span>
                  {showPopover && (
                    <span className="landing-time-profile__event-popover" role="status">
                      {savingText}
                    </span>
                  )}
                </div>
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

      {/* OA-114: "meaning -> evidence -> explanation" -- everything
          explanatory (the cost-basis footnote, stage-specific caveats,
          Optimise's collapsed methodology disclosure) lives below the
          chart now, not between the result and the chart, so scrubbing
          between stages keeps the chart as the immediate, visually
          prominent thing a visitor's eye lands on. */}
      <div className="landing-time-profile__below-chart">
        <p className="landing-time-profile__cost-note">{costNote}</p>
        {caveat && <div className="landing-time-profile__caveat">{caveat}</div>}
        {explanation && <div className="landing-time-profile__explanation">{explanation}</div>}
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
