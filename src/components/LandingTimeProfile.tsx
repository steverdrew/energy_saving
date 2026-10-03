import type { ReactNode } from 'react'
import { useId, useMemo, useRef, useState } from 'react'
import { formatGbp } from '../format'
import InfoTooltip from './InfoTooltip'
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

/** OA-105/OA-168: one household event overlaid on the track -- the same shape on every tab now that none of them are draggable (see the redesign's doc comment below): a plain annotation, positioned by `startSlot`/`slotCount`, with only the label and two purely-informational extras. */
export interface LandingTimeProfileEventOverlay {
  id: string
  label: string
  /** Slot index (0-47) the event currently starts at. */
  startSlot: number
  /** How many contiguous half-hour slots the event occupies. */
  slotCount: number
  /** OA-165/OA-167: set only when this event's window is a deliberate safety constraint, not a missed optimisation -- shown as an info icon beside the event, explaining why on hover/focus/tap. */
  safetyConstraintNote?: ReactNode
  /** OA-108/OA-168: a short, quiet per-event saving note (e.g. "Saves 18p this cycle") -- shown directly in the event's own card, only when it's the sole event there (a grouped card stays a plain list; see `groupOverlappingEvents`). */
  savingText?: ReactNode
}

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

// OA-105/OA-107/OA-109/OA-156: event dragging/lanes used to live here --
// removed in the OA-168 redesign (see the component doc comment below),
// which replaced per-event lanes with grouped, non-interactive annotation
// cards above the chart.
// OA-168: merges an event into the previous group not only when their
// time spans genuinely overlap, but when they're close enough that two
// separate cards would visually collide (each card is a fixed ~180px max
// width; two events barely an hour apart, e.g. a washing machine
// immediately followed by its tumble dryer, would otherwise render two
// cards fighting for the same few dozen pixels). A plain time-slot buffer
// rather than a real text-width measurement -- see the component's own
// doc comment for why a full collision-avoidance pass isn't used here.
const EVENT_GROUP_MERGE_BUFFER_SLOTS = 2

function groupOverlappingEvents(
  overlays: readonly LandingTimeProfileEventOverlay[],
): Array<{ startSlot: number; endSlot: number; events: LandingTimeProfileEventOverlay[] }> {
  const sorted = [...overlays].sort((a, b) => a.startSlot - b.startSlot)
  const groups: Array<{ startSlot: number; endSlot: number; events: LandingTimeProfileEventOverlay[] }> = []
  for (const overlay of sorted) {
    const last = groups[groups.length - 1]
    if (last && overlay.startSlot < last.endSlot + EVENT_GROUP_MERGE_BUFFER_SLOTS) {
      last.events.push(overlay)
      last.endSlot = Math.max(last.endSlot, overlay.startSlot + overlay.slotCount)
    } else {
      groups.push({ startSlot: overlay.startSlot, endSlot: overlay.startSlot + overlay.slotCount, events: [overlay] })
    }
  }
  return groups
}

// OA-168: keeps a card's centre from being positioned flush against the
// chart's own left/right edge, where it would visually overhang the card.
// A plain clamp rather than a full collision-avoidance pass (see the
// doc comment below for why that's an acceptable simplification here).
const EVENT_CARD_EDGE_CLAMP_PERCENT = 8

// OA-168: the minimum horizontal distance (as a percentage of the track's
// width) kept between two cards' centres -- cards whose own time position
// would otherwise land closer than this get pushed right, since each card
// is a fixed ~180px max width and two time positions only an hour or two
// apart (closer than `EVENT_GROUP_MERGE_BUFFER_SLOTS` would merge them,
// but not close enough to) would otherwise still visually collide.
const EVENT_CARD_MIN_GAP_PERCENT = 20

interface PositionedEventGroup {
  group: ReturnType<typeof groupOverlappingEvents>[number]
  /** The group's real time position -- what its connector curve points at. */
  naturalLeftPercent: number
  /** Where the card itself renders -- pushed right of `naturalLeftPercent` only when needed to keep `EVENT_CARD_MIN_GAP_PERCENT` from its left-hand neighbour. */
  displayLeftPercent: number
}

/**
 * OA-168: a simple greedy left-to-right label-spacing pass -- sorts groups
 * by their true time position, then pushes each one right just far enough
 * to keep `EVENT_CARD_MIN_GAP_PERCENT` from the previous (already-placed)
 * card, never left. A card that needed pushing no longer sits directly
 * above the time it describes -- `naturalLeftPercent` is kept alongside
 * `displayLeftPercent` precisely so the caller can draw a curved connector
 * from the (possibly shifted) card back down to the real position.
 */
function layoutEventCardPositions(
  groups: ReturnType<typeof groupOverlappingEvents>,
  totalSlots: number,
): PositionedEventGroup[] {
  const withNaturalPosition = groups.map((group) => {
    const midSlot = (group.startSlot + group.endSlot) / 2
    const rawPercent = (midSlot / totalSlots) * 100
    const naturalLeftPercent = Math.min(
      100 - EVENT_CARD_EDGE_CLAMP_PERCENT,
      Math.max(EVENT_CARD_EDGE_CLAMP_PERCENT, rawPercent),
    )
    return { group, naturalLeftPercent }
  })
  const orderedByPosition = [...withNaturalPosition].sort((a, b) => a.naturalLeftPercent - b.naturalLeftPercent)
  let previousDisplayPercent = -Infinity
  const positionedByPosition = orderedByPosition.map(({ group, naturalLeftPercent }) => {
    const displayLeftPercent = Math.min(
      100 - EVENT_CARD_EDGE_CLAMP_PERCENT,
      Math.max(naturalLeftPercent, previousDisplayPercent + EVENT_CARD_MIN_GAP_PERCENT),
    )
    previousDisplayPercent = displayLeftPercent
    return { group, naturalLeftPercent, displayLeftPercent }
  })
  // Restores the original (time) order -- the sort above was only needed
  // for the left-to-right spacing pass itself.
  return groups.map((group) => positionedByPosition.find((p) => p.group === group)!)
}

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
  /** OA-167: Optimise's short, calm appliance-safety note (with a link to the fuller "Safety information" dialog) -- shown below the chart alongside the other below-chart disclosures, only on Optimise (Baseline/Compare never move anything, so pass nothing here). */
  safetyNote?: ReactNode
  /** OA-104: an optional prominent payoff line shown above `summary`, carrying more visual weight than the daily figure -- e.g. "You could save around £73/year...". Only the Optimise step passes this. */
  payoff?: ReactNode
  /** OA-126: the standing charge, disclosed quietly right next to the result it's deliberately excluded from (e.g. "+ 55p/day standing charge") -- shown on every stage, consistently, so the headline £ figure is never mistaken for a visitor's full daily bill. */
  standingChargeNote?: ReactNode
  /** OA-137: Optimise's quiet tariff-context label (e.g. "Smart · Agile") -- the old "Reset"/"Optimise" buttons this slot used to carry are removed (arriving at Optimise always auto-optimises; see LandingDemo.tsx). Rendered in the heading row for the `'result-right'` split, or in its own right-hand column for `'context-right'` -- see `splitLayout`. */
  controls?: ReactNode
  /** OA-141/136: Baseline's current-tariff selector and Compare's A/B comparison selector, each promoted to its own full-width, visually prominent block -- "the key decision on this tab... should have stronger hierarchy than secondary controls." Rendered between the supporting copy and the result (never squeezed into the `controls` slot beside the heading, which stays small/secondary for Optimise's Reset/Optimise buttons). Baseline and Compare pass this; Optimise doesn't. */
  primarySelector?: ReactNode
  /** OA-143/OA-136/OA-137: the two-column layout every stage now uses, in one of two arrangements. `'result-right'` (Baseline/Compare) -- "left = choose, right = result": heading/supporting copy/primary selector/`controls` on the left, the result summary (resultLabel/result/payoff/standingChargeNote) in a compact right-hand column, so the tariff choice stays the dominant action and pricing reads as its secondary result. `'context-right'` (Optimise) -- OA-137's "main text should not float on the right": heading/supporting copy/result summary all sit together on the left as the dominant content, with `controls` (now just a quiet tariff-context label, no buttons) alone in the right column. Omit for the default stacked narrative (no stage currently uses this). */
  splitLayout?: 'result-right' | 'context-right'
  /** Remounts just the narrative block (not the chart) to replay its OA-80 fade/slide on step change -- see the component doc comment for why the chart itself must stay mounted. */
  stepKey: string
  /** OA-99/OA-101: the 16:00-19:00 structural-peak annotation is a documented feature of *Agile's* pricing formula specifically -- showing it on a flat Standard Variable day would wrongly imply that flat tariff has the same structural peak. Baseline passes `false`; Compare/Optimise (both on Agile) pass `true`. */
  showStructuralPeakAnnotation: boolean
  /** OA-131: how the active tariff's price should be segmented in the dedicated price strip above the chart -- `'flat'` for Standard Variable, `'two-rate'` for Economy 7, `'dynamic'` for Agile's 48 genuinely distinct half-hourly prices. The caller already knows which tariff is active (`TariffId`); this keeps that domain concept out of this presentation-only component. */
  priceStripShape: PriceStripShape
  /** OA-105: every household event, shown as an overlay on the track -- the same plain annotation on every tab (see the component doc comment for why nothing here is draggable any more). */
  events?: LandingTimeProfileEventOverlay[]
  /** OA-156: the Step 1 -> Step 2 -> Step 3 navigation (`<LandingStepNav>`), rendered inside this card between the choices/result narrative above and the chart below -- replaces the old top-of-section drag scrubber, which sat above this whole card instead. Optional only so a caller without a story to navigate (none currently) can omit it. */
  stepNav?: ReactNode
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
 * OA-168: event dragging (OA-103/105/107/108/109/115/116) is removed --
 * every event (Baseline, Compare and Optimise alike) is now a plain,
 * non-interactive annotation, positioned by its own `startSlot`. Events
 * that overlap (or sit close enough in time that separate labels would
 * collide) are merged into one card listing each of their names, rather
 * than the old per-event lane system -- a deliberate simplification: with
 * nothing draggable any more, a handful of static cards never need to
 * fight for the same horizontal space the way live-dragged sliders could,
 * so a full collision-avoidance pass (lanes, label-width estimation) is
 * no longer worth its own complexity -- only a simple edge clamp
 * (`EVENT_CARD_EDGE_CLAMP_PERCENT`) keeps a card's centre off the chart's
 * own left/right edge.
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
  safetyNote,
  payoff,
  standingChargeNote,
  controls,
  primarySelector,
  splitLayout,
  stepKey,
  showStructuralPeakAnnotation,
  priceStripShape,
  events,
  stepNav,
}: LandingTimeProfileProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const panelId = useId()
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])

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

  // OA-133/OA-168: the off-peak segment itself (whichever carries the
  // lower of the two 'two-rate' rates) -- both the legend's time range and
  // the chart's own subtle background shading are derived from this one
  // value, so the two treatments can never drift apart.
  const offPeakSegment = useMemo(() => {
    if (priceStripShape !== 'two-rate') return null
    const rates = priceStripSegments.map((s) => s.rate).filter((r): r is number => r !== null)
    if (rates.length === 0) return null
    const offPeakRate = Math.min(...rates)
    return priceStripSegments.find((s) => s.rate === offPeakRate) ?? null
  }, [priceStripShape, priceStripSegments])

  // OA-133: the real off-peak time range for a 'two-rate' tariff (e.g.
  // "01:30–08:30"), resolved from this day's own segments -- never a
  // hand-written clock window that could drift from the actual rate data.
  const offPeakTimeRange = useMemo(() => {
    const firstSlot = offPeakSegment && day.slots[offPeakSegment.startSlot]
    const lastSlot = offPeakSegment && day.slots[offPeakSegment.startSlot + offPeakSegment.slotCount - 1]
    if (!firstSlot || !lastSlot) return null
    const lastSlotEnd = new Date(new Date(lastSlot.startsAt).getTime() + 30 * 60 * 1000).toISOString()
    return `${formatSlotTime(firstSlot.startsAt)}–${formatSlotTime(lastSlotEnd)}`
  }, [offPeakSegment, day])

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

  function eventTimeRange(startSlot: number, slotCount: number): string {
    const slots = Array.from({ length: slotCount }, (_, i) => day.slots[startSlot + i]).filter(
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
      eventTimeRange(overlay.startSlot, overlay.slotCount) !== ''
    )
  }

  // OA-106: "no duplicate event containers" -- keep only the first overlay
  // for a given id, in the unexpected case the caller's `events` array
  // repeats one.
  const renderableEventOverlays = useMemo(
    () =>
      (events ?? [])
        .filter(isRenderableEventOverlay)
        .filter((overlay, index, all) => all.findIndex((o) => o.id === overlay.id) === index),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRenderableEventOverlay closes over `day` only; `events` already covers every input this memo actually varies on.
    [events],
  )
  const eventGroups = useMemo(() => groupOverlappingEvents(renderableEventOverlays), [renderableEventOverlays])
  const positionedEventGroups = useMemo(
    () => layoutEventCardPositions(eventGroups, day.slots.length),
    [eventGroups, day],
  )

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
        {(() => {
          // OA-110/OA-126: the question heading/supporting line sit in a
          // row alongside "Reset"/"Optimise" -- top-right of the card, next
          // to the heading they relate to, rather than stacked as their own
          // full-width row between the narrative and the chart. Only the
          // Optimise step passes `controls`.
          const headingRow = (
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
              {/* OA-137: `'context-right'` (Optimise) renders `controls` in
                  its own right-hand column below instead -- inlining it here
                  too would duplicate the now-quiet tariff-context label. */}
              {splitLayout !== 'context-right' && controls}
            </div>
          )
          // OA-141/136: "the selector should not feel visually lost between
          // the intro copy and the graph" -- its own full-width block,
          // between the supporting copy and the result, with stronger
          // hierarchy than the small `controls` slot above (which stays
          // as-is for Optimise's Reset/Optimise buttons). Baseline and
          // Compare pass this.
          const primarySelectorBlock = primarySelector && (
            <div className="landing-time-profile__primary-selector">{primarySelector}</div>
          )
          const resultBlock = (
            <>
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
            </>
          )

          // OA-143/OA-136: "left = choose, right = result" -- Baseline/
          // Compare. The tariff choice (heading + selector) stays the
          // dominant left-hand action; the pricing summary becomes a
          // compact right-hand result, never a second primary task
          // competing with it.
          if (splitLayout === 'result-right') {
            return (
              <div className="landing-time-profile__split">
                <div className="landing-time-profile__split-left">
                  {headingRow}
                  {primarySelectorBlock}
                </div>
                <div className="landing-time-profile__split-right">{resultBlock}</div>
              </div>
            )
          }

          // OA-137: "the main text should not float on the right" --
          // Optimise. The headline saving is the dominant *left*-hand
          // content, alongside the heading/supporting copy; the right
          // column holds only `controls` (now a quiet "Smart · Agile"
          // tariff-context label, no buttons), never a second result.
          if (splitLayout === 'context-right') {
            return (
              <div className="landing-time-profile__split">
                <div className="landing-time-profile__split-left">
                  {headingRow}
                  {primarySelectorBlock}
                  {resultBlock}
                </div>
                <div className="landing-time-profile__split-right">{controls}</div>
              </div>
            )
          }

          return (
            <>
              {headingRow}
              {primarySelectorBlock}
              {resultBlock}
            </>
          )
        })()}
      </div>

      {/* OA-156: the Step 1 -> Step 2 -> Step 3 nav sits here, inside the
          card, under the choices/result narrative above and above the
          chart below -- not remounted on step change (unlike the
          narrative above it) since it's the control driving that change,
          not part of what it animates. */}
      {stepNav}

      <div className="landing-time-profile__body">
        {/* OA-131/OA-168: the dedicated rate bar -- a plain muted track
            with only the genuinely distinct price information picked out:
            one highlighted off-peak segment for 'two-rate', a uniform
            fill for 'flat' (nothing to distinguish), and the real
            per-slot colour ramp for 'dynamic'. Still a real row of
            `<button>`s (not a decorative strip) so "exact rate details
            available via tap" and "touch interaction must work without
            hover" both still hold -- clicking/tapping reuses the same
            selection + live region the usage columns below already
            expose. */}
        <div
          className="landing-time-profile__rate-bar"
          role="group"
          aria-label={`${heading} — price strip`}
        >
          {priceStripSegments.map((segment) => {
            const isOffPeak = priceStripShape === 'two-rate' && segment === offPeakSegment
            const dynamicStep =
              priceStripShape === 'dynamic'
                ? segment.rate !== null
                  ? rateColorStepIndex(segment.rate, min, max)
                  : null
                : null
            return (
              <button
                key={segment.startSlot}
                type="button"
                className="landing-time-profile__rate-bar-segment"
                data-shape={priceStripShape}
                data-offpeak={isOffPeak || undefined}
                style={{
                  flexGrow: segment.slotCount,
                  backgroundColor: dynamicStep !== null ? RATE_COLOR_STEPS_DARK[dynamicStep] : undefined,
                }}
                data-unknown={priceStripShape === 'dynamic' && dynamicStep === null ? '' : undefined}
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

        {/* OA-168: a dot-based legend naming the same two states the rate
            bar above highlights -- a hollow dot for day rate, the same
            filled accent dot the bar's own off-peak segment uses for
            off-peak, so the legend and the bar read as one treatment
            rather than two unrelated colour systems. */}
        {priceStripShape === 'two-rate' ? (
          <p className="landing-time-profile__price-legend">
            <span className="landing-time-profile__legend-item">
              <span className="landing-time-profile__legend-dot" data-tone="day" aria-hidden="true" />
              Day rate
            </span>
            <span className="landing-time-profile__legend-item">
              <span className="landing-time-profile__legend-dot" data-tone="offpeak" aria-hidden="true" />
              <strong>Off-peak</strong>
              {offPeakTimeRange ? ` ${offPeakTimeRange}` : ''}
            </span>
          </p>
        ) : priceStripShape === 'flat' ? (
          <p className="landing-time-profile__price-legend">
            <span className="landing-time-profile__legend-dot" data-tone="flat" aria-hidden="true" />
            Flat rate — the same price all day
          </p>
        ) : (
          <p className="landing-time-profile__price-legend landing-time-profile__price-legend--gradient">
            <span className="landing-time-profile__legend-gradient-label">Cheaper</span>
            <span className="landing-time-profile__legend-gradient" aria-hidden="true" />
            <span className="landing-time-profile__legend-gradient-label">More expensive</span>
          </p>
        )}

        {/* Follow-up fix: event chips/labels used to live inside
            `__track` itself, which clips (`overflow: hidden`, needed so
            the price-neutral columns keep the track's own rounded
            corners) -- a long label on an event near the end of the day
            could get visually cut off at the track's right edge.
            `__track-wrap` sizes to the track (the only element in normal
            flow inside it), and `__event-layer` is an absolutely-
            positioned sibling covering the exact same box but *without*
            the clip, so a card can overflow past the track's edge
            without being hidden. Percentage-based left positioning is
            unaffected since the layer's box is identical to the track's. */}
        <div className="landing-time-profile__track-wrap">
        <div
          className="landing-time-profile__track"
          role="group"
          aria-label={heading}
          aria-describedby={selectedSlot ? panelId : undefined}
        >
          {/* OA-133/OA-168: a subtle background tint across the off-peak
              window -- the same accent hue the legend dot/rate-bar
              highlight above use, kept deliberately much lower-opacity
              here so it reads as ambient context for the usage shape
              rather than competing with it. */}
          {offPeakSegment && (
            <div
              className="landing-time-profile__offpeak-band"
              aria-hidden="true"
              style={{
                left: `${(offPeakSegment.startSlot / day.slots.length) * 100}%`,
                width: `${(offPeakSegment.slotCount / day.slots.length) * 100}%`,
              }}
            />
          )}

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
        </div>

        {/* OA-105/OA-168: every shared household event, grouped (by
            `groupOverlappingEvents`) into one annotation card per cluster
            of overlapping/adjacent events, floating above the chart --
            replaces the old per-event lane chips (see the component doc
            comment for why collision-avoidance beyond the spacing pass
            below isn't needed once nothing is draggable). `layoutEventCardPositions`
            spaces cards that would otherwise sit too close together out
            left-to-right; a curved connector (drawn below, in the same
            layer) links each card back down to the real time position it
            describes whenever that spacing has moved it away. */}
        <div className="landing-time-profile__event-layer">
          <svg
            className="landing-time-profile__event-connectors"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {positionedEventGroups.map(({ group, naturalLeftPercent, displayLeftPercent }) => {
              const groupKey = group.events.map((e) => e.id).join('+')
              // A smooth S-curve from just under the card (vertical
              // tangent, so it reads as leaving the card cleanly) down to
              // the real time position at the foot of the track (also
              // vertical, so it reads as landing squarely on it).
              return (
                <path
                  key={groupKey}
                  className="landing-time-profile__event-connector"
                  d={`M ${displayLeftPercent} 20 C ${displayLeftPercent} 60, ${naturalLeftPercent} 60, ${naturalLeftPercent} 100`}
                />
              )
            })}
          </svg>
          {positionedEventGroups.map(({ group, displayLeftPercent }) => {
            const timeRange = eventTimeRange(group.startSlot, group.endSlot - group.startSlot)
            const isGrouped = group.events.length > 1
            const groupKey = group.events.map((e) => e.id).join('+')
            return (
              <div
                key={groupKey}
                className="landing-time-profile__event-group"
                style={{ left: `${displayLeftPercent}%` }}
              >
                <div className="landing-time-profile__event-card">
                  <span className="landing-time-profile__event-card-time">
                    {/* OA-168: a small clock mark only on a grouped card --
                        a quiet visual cue that this one time range covers
                        several appliances, not just one. */}
                    {isGrouped && (
                      <svg
                        className="landing-time-profile__event-card-clock"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M8 4.5V8l2.6 1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    )}
                    {timeRange}
                  </span>
                  {isGrouped ? (
                    <ul className="landing-time-profile__event-card-list">
                      {group.events.map((overlay) => (
                        <li key={overlay.id}>
                          {overlay.label}
                          {overlay.safetyConstraintNote && (
                            <InfoTooltip label={`Why is ${overlay.label.toLowerCase()} kept in this window?`}>
                              {overlay.safetyConstraintNote}
                            </InfoTooltip>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="landing-time-profile__event-card-name">
                      {group.events[0].label}
                      {group.events[0].safetyConstraintNote && (
                        <InfoTooltip label={`Why is ${group.events[0].label.toLowerCase()} kept in this window?`}>
                          {group.events[0].safetyConstraintNote}
                        </InfoTooltip>
                      )}
                      {group.events[0].savingText && (
                        <span className="landing-time-profile__event-card-saving">{group.events[0].savingText}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
        {safetyNote && <div className="landing-time-profile__safety-note">{safetyNote}</div>}
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
