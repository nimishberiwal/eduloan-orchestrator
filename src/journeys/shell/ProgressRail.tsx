// ============================================================================
// Progress Rail (§3.4) — the ONE place the brand's signature crossings and
// intersections appear in product UI.
//
// The connector between two steps is a pair of lines that cross. The crossing
// TIGHTENS as the step completes: an open X for work not yet done, closing to a
// near-flat seam once it is. That gives the rail a state readable at a glance
// without adding a second colour.
//
// Everywhere else in the product stays quiet. This is a signature, not
// wallpaper.
// ============================================================================

export interface RailStep {
  id: string
  label: string
  state: 'done' | 'current' | 'todo'
}

/** Connector between step i and i+1. `t` = 0 (wide open) … 1 (tight seam). */
function Crossing({ t }: { t: number }) {
  // Amplitude collapses from 5px to 0.6px as the pair tightens.
  const a = 5 - 4.4 * t
  const tone = t > 0.5 ? 'var(--glib-blue)' : 'var(--grey-300)'
  return (
    <svg
      className="h-3 w-full"
      viewBox="0 0 40 12"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <line x1="0" y1={6 - a} x2="40" y2={6 + a} stroke={tone} strokeWidth="1.5" />
      <line x1="0" y1={6 + a} x2="40" y2={6 - a} stroke={tone} strokeWidth="1.5" />
    </svg>
  )
}

export function ProgressRail({ steps }: { steps: RailStep[] }) {
  if (steps.length === 0) return null
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.state === 'current'),
  )
  const current = steps[currentIdx] ?? steps[0]

  return (
    <nav
      aria-label="Application progress"
      className="border-b border-[var(--blue-grey)] bg-[var(--blue-grey)]"
    >
      <div className="mx-auto max-w-[560px] px-4 py-2.5">
        <div className="flex items-center gap-1">
          {steps.map((s, i) => {
            const dot =
              s.state === 'done'
                ? 'bg-[var(--glib-blue)]'
                : s.state === 'current'
                  ? 'bg-white ring-2 ring-[var(--glib-blue)]'
                  : 'bg-[var(--grey-300)]'
            return (
              <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1 last:flex-none">
                <span
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot}`}
                  aria-hidden
                />
                {i < steps.length - 1 ? (
                  <span className="min-w-0 flex-1">
                    {/* Tighten fully once the step behind the connector is done. */}
                    <Crossing t={s.state === 'done' ? 1 : s.state === 'current' ? 0.55 : 0.1} />
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="mt-1.5 text-[12px] leading-4 text-[var(--grey-600)]">
          Step {currentIdx + 1} of {steps.length}
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          <span className="display font-semibold text-[var(--glib-grey)]">{current.label}</span>
        </p>
      </div>
    </nav>
  )
}
