// ============================================================================
// Prototype clock. The demo runs against a FROZEN base instant so aging, TAT and
// sanction countdowns are deterministic. An adjustable offset lets the committee
// watch time pass (e.g. +48h to trip an SLA) without wiring real timers.
//
// The offset lives here as a module global, so mutating it does NOT trigger a
// React re-render on its own — the store must bump `clockTick` alongside
// `setClockOffsetHours()` and views must subscribe to it.
// ============================================================================

export const BASE_NOW_ISO = '2026-07-20T10:00:00.000Z'

let _offsetHours = 0

/** The prototype's "now", including any operator-applied offset. */
export function nowIso(): string {
  if (_offsetHours === 0) return BASE_NOW_ISO
  const d = new Date(BASE_NOW_ISO)
  d.setUTCHours(d.getUTCHours() + _offsetHours)
  return d.toISOString()
}

export function clockOffsetHours(): number {
  return _offsetHours
}

export function setClockOffsetHours(h: number): void {
  _offsetHours = Math.max(0, h)
}

export function resetClock(): void {
  _offsetHours = 0
}

/** Fractional hours between two ISO instants (a − b). Unlike daysBetween in
 *  format.ts this does NOT floor to whole days — the 48h SLA needs sub-day
 *  resolution. */
export function hoursBetween(aIso: string, bIso: string): number {
  return (new Date(aIso).getTime() - new Date(bIso).getTime()) / 3_600_000
}

/** Hours elapsed since `iso` as of `now` (defaults to the prototype clock). */
export function hoursSince(iso: string, now: string = nowIso()): number {
  return hoursBetween(now, iso)
}

export function addHoursIso(iso: string, hours: number): string {
  const d = new Date(iso)
  d.setUTCHours(d.getUTCHours() + hours)
  return d.toISOString()
}
