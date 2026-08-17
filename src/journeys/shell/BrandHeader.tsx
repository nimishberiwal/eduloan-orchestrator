// ============================================================================
// Brand header (§1, §3.4).
//
// Glib.money is the PLATFORM; Horizon Bank is the LENDER. Both appear, in that
// relationship — a co-brand lockup, not two logos fighting.
//
// The logo mark is the diamond from the identity. No gradients, no drop shadow
// on the logo, never inside a box, and the badge/seal never appears in product
// UI (it is collateral-only).
// ============================================================================
import { Link } from 'react-router-dom'

export function GlibMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className="shrink-0"
    >
      {/* Diamond built from the guidelines' crossing geometry: two strokes that
          intersect, plus the solid core. */}
      <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" fill="var(--glib-blue)" />
      <path d="M12 6.4 17.6 12 12 17.6 6.4 12Z" fill="var(--white)" />
    </svg>
  )
}

export function GlibWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`display inline-flex items-center gap-2 ${className}`}>
      <GlibMark />
      <span className="text-[16px] font-bold tracking-[-0.01em] text-[var(--glib-grey)]">
        glib<span className="text-[var(--glib-blue)]">.</span>money
      </span>
    </span>
  )
}

export function BrandHeader({
  right,
  homeTo = '/',
}: {
  right?: React.ReactNode
  homeTo?: string
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--blue-grey)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[56px] max-w-[560px] items-center justify-between gap-3 px-4">
        <Link
          to={homeTo}
          className="flex min-h-[44px] items-center rounded-lg"
          aria-label="Glib.money home"
        >
          <GlibWordmark />
        </Link>
        <div className="flex items-center gap-2">
          {right}
          {/* Lender lockup — the customer is borrowing from Horizon Bank. */}
          <span className="hidden text-right text-[11px] leading-[14px] text-[var(--grey-600)] sm:block">
            Lending partner
            <br />
            <span className="display font-semibold text-[var(--glib-grey)]">Horizon Bank</span>
          </span>
        </div>
      </div>
    </header>
  )
}
