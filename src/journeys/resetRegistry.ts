// ============================================================================
// Reset registry (§18).
//
// `resetDemo()` in appStore must now also clear sessions, OTP challenges,
// leads, handoffs, invite tokens, capture results — AND every new module-global
// counter. The dashboard already learned this lesson twice (`_docSeq`,
// `RR_STATE`); a registry means the next module that adds a counter cannot
// forget, and — critically — it keeps appStore from importing sessionStore,
// which would close an import cycle (sessionStore needs appStore's verbs).
//
// This module imports NOTHING. That is what makes it safe to import from both
// sides.
// ============================================================================

type ResetFn = () => void

const _resets: ResetFn[] = []

/** Register a teardown to run on `resetDemo()`. Call at module scope. */
export function registerJourneyReset(fn: ResetFn): void {
  _resets.push(fn)
}

/** Run every registered teardown. Called from appStore.resetDemo(). */
export function runJourneyResets(): void {
  for (const fn of _resets) fn()
}
