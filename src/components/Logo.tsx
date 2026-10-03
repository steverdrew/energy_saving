// OA-62: a simple vector mark built on the product's actual idea -- a
// cheap price window amid more expensive ones (the same idea Cheapest
// Times surfaces) -- rather than a generic bolt/energy icon. No raster
// artwork; pure SVG shapes so it stays legible at favicon size.
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 32"
      width="28"
      height="22"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="8" width="6" height="20" rx="2" fill="currentColor" opacity="0.4" />
      <rect
        className="logo-mark__bar logo-mark__bar--neighbor"
        x="9"
        y="14"
        width="6"
        height="14"
        rx="2"
        fill="currentColor"
        opacity="0.4"
      />
      <rect
        className="logo-mark__bar logo-mark__bar--center"
        x="17"
        y="22"
        width="6"
        height="6"
        rx="2"
        fill="currentColor"
        style={{ transformOrigin: '20px 25px' }}
      />
      <rect
        className="logo-mark__bar logo-mark__bar--neighbor"
        x="25"
        y="14"
        width="6"
        height="14"
        rx="2"
        fill="currentColor"
        opacity="0.4"
      />
      <rect x="33" y="8" width="6" height="20" rx="2" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

function BetaBadge() {
  return <span className="brand-mark__beta">BETA</span>
}

// Horizontal mark + wordmark + beta badge, used in the app header. The
// mark-only export above is for places (favicon, smaller UI) that just
// need the icon.
function BrandMark() {
  return (
    <span className="brand-mark">
      <LogoMark className="brand-mark__icon" />
      <span className="brand-mark__word">Shift &amp; Save</span>
      <BetaBadge />
    </span>
  )
}

export { LogoMark, BrandMark }
