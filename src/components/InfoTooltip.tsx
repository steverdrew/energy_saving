import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './InfoTooltip.css'

export interface InfoTooltipProps {
  /** Accessible name for the trigger button, e.g. "Why is the tumble dryer kept in this window?" -- never just "Info". */
  label: string
  /** The tooltip's own content, shown on hover, focus, or tap. */
  children: ReactNode
}

/**
 * OA-165/OA-167: a small info icon whose explanation works identically on
 * hover, keyboard focus, and touch -- a native `title` tooltip was already
 * rejected elsewhere in this chart (see LandingTimeProfile.tsx's price-strip
 * segments) for being hover-only and absent on touch, so this follows the
 * same real-`<button>`-plus-visible-panel pattern instead of introducing a
 * second one. `onMouseEnter`/`onFocus` open it (desktop hover/keyboard);
 * `onClick` also opens it, which is what makes tap work on touch devices
 * that never fire a hover event at all. It deliberately never *toggles* on
 * click -- a real browser fires `mouseenter` just before `click`, so a
 * toggle would open it on hover and immediately close it again on the same
 * interaction. Instead it closes on `mouseleave`, on blur, or on a
 * pointerdown anywhere outside it (so a tap elsewhere, including on touch,
 * dismisses it).
 */
function InfoTooltip({ label, children }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDownOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDownOutside)
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside)
  }, [isOpen])

  return (
    <span className="info-tooltip" ref={rootRef}>
      <button
        type="button"
        className="info-tooltip__trigger"
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        // Stops a tap/click on the icon from also being read as the start of
        // a drag by the (movable) event chip it sits inside of.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {isOpen && (
        <span id={tooltipId} role="tooltip" className="info-tooltip__bubble">
          {children}
        </span>
      )}
    </span>
  )
}

export default InfoTooltip
