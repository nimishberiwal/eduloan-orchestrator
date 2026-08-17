// ============================================================================
// AppShell (§5) — brand header + progress rail + task drawer.
//
// Mobile-first: 375–430px is the primary target and the customer surfaces must
// stay usable at 320px, so the content column is a 560px max-width centred
// measure with 16px gutters and nothing that needs horizontal scroll.
// ============================================================================
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandHeader } from './BrandHeader'
import { ProgressRail, type RailStep } from './ProgressRail'

export function AppShell({
  children,
  steps,
  right,
  homeTo,
  taskDrawer,
  wide,
}: {
  children: ReactNode
  steps?: RailStep[]
  right?: ReactNode
  homeTo?: string
  /** The persistent "what we need from you" strip, when the journey has one. */
  taskDrawer?: ReactNode
  /** Assisted surfaces target 1024px+ and opt out of the mobile measure. */
  wide?: boolean
}) {
  return (
    <div className="glib flex min-h-screen flex-col bg-white">
      <BrandHeader right={right} homeTo={homeTo} />
      {steps && steps.length > 0 ? <ProgressRail steps={steps} /> : null}
      <main
        className={`mx-auto w-full flex-1 px-4 pb-10 pt-5 ${wide ? 'max-w-[1180px]' : 'max-w-[560px]'}`}
      >
        {children}
      </main>
      {taskDrawer}
    </div>
  )
}

/** Back affordance. An action keeps its name through the flow (§3.5), so the
 *  label is always the destination, never a bare arrow. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-1 mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-[var(--glib-blue)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
        <path
          d="M10 3 5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </Link>
  )
}
