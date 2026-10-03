import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './Dialog.css'

export interface DialogProps {
  isOpen: boolean
  onClose: () => void
  titleId: string
  title: ReactNode
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/**
 * OA-166/OA-167: this codebase's first dialog/drawer -- no existing
 * accessible modal pattern to reuse (confirmed: no `role="dialog"`
 * anywhere in `src/`), so this is a small, self-contained implementation
 * rather than a dependency. Native `<dialog>`/`showModal()` was considered
 * and rejected: jsdom (this repo's test environment) doesn't implement its
 * focus-trap/backdrop behaviour, so a hand-rolled, directly testable
 * version is both simpler to verify here and has no browser-support gap.
 *
 * Focus moves to the dialog's first focusable element on open, Tab/Shift+Tab
 * cycles only within it (a manual focus trap -- no native support to rely
 * on), Escape closes it, and focus returns to whatever triggered it on
 * close. The overlay itself is a click target that also closes it, but
 * clicks inside the dialog body don't bubble to that handler.
 */
function Dialog({ isOpen, onClose, titleId, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = dialogRef.current
    const [first] = container ? getFocusableElements(container) : []
    ;(first ?? container)?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) return
      const firstFocusable = focusable[0]
      const lastFocusable = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className={className ? `dialog ${className}` : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog__header">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  )
}

export default Dialog
