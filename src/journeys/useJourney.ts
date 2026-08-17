// ============================================================================
// Journey context — the small amount of plumbing every surface needs.
//
// Keeps actor construction in ONE place. Every event carries who actually did
// it, including the officer who issued a handoff link, because the audit trail
// has to answer "who actually clicked this" (§9.5, §16.4).
// ============================================================================
import { useCallback, useMemo } from 'react'
import type { Application, PartyRole } from '@/types'
import type {
  JourneyActor,
  JourneyEvent,
  JourneyEventType,
  JourneySurface,
} from '@/types/journeys'
import { useStore } from '@/store/appStore'
import { useSessionStore } from '@/store/sessionStore'
import { nowIso } from '@/lib/clock'

let _eventSeq = 0

export interface JourneyContext {
  app?: Application
  actor: JourneyActor
  surface: JourneySurface
  /** Emit an event through the reducer (§16.3). Idempotent on stableKey. */
  emit: <T>(type: JourneyEventType, payload: T, stableKey?: string) => void
  /** Audit-only milestone with an optional targeted patch. */
  milestone: (verb: string, remarks: string, patch?: (app: Application) => void) => void
}

export function useJourney(opts: {
  appId?: string
  partyRole: PartyRole
  surface: JourneySurface
  /** Set when this surface is being driven from an assisted session. */
  onBehalfOfficerId?: string
  /** Set when the surface is a handoff landing. */
  viaHandoff?: string
}): JourneyContext {
  const app = useStore((s) => s.applications.find((a) => a.appId === opts.appId))
  const emitJourneyEvent = useStore((s) => s.emitJourneyEvent)
  const recordJourneyMilestone = useStore((s) => s.recordJourneyMilestone)

  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)

  const actor: JourneyActor = useMemo(() => {
    const sid = activeIds[opts.partyRole]
    const session = sessions.find((s) => s.id === sid)
    const rmSession = sessions.find((s) => s.id === activeIds.rm)
    // An assisted session acting for a party is still an RM in the audit; a
    // handoff is the PARTY acting, with the issuing officer named alongside.
    if (opts.onBehalfOfficerId && !opts.viaHandoff) {
      return {
        kind: 'rm',
        officerId: opts.onBehalfOfficerId,
        onBehalfOf: opts.partyRole,
        sessionId: rmSession?.id ?? 'SES-RM',
        name: rmSession?.displayName,
      }
    }
    return {
      kind: opts.partyRole,
      partyRole: opts.partyRole,
      sessionId: session?.id ?? 'SES-ANON',
      name: session?.displayName ?? app?.studentName,
      viaHandoff: opts.viaHandoff,
      officerId: opts.onBehalfOfficerId,
    }
  }, [activeIds, sessions, opts.partyRole, opts.onBehalfOfficerId, opts.viaHandoff, app?.studentName])

  const emit = useCallback(
    <T,>(type: JourneyEventType, payload: T, stableKey?: string) => {
      if (!opts.appId) return
      _eventSeq += 1
      const e: JourneyEvent<T> = {
        id: `JE-${String(_eventSeq).padStart(5, '0')}`,
        type,
        appId: opts.appId,
        actor,
        at: nowIso(),
        surface: opts.surface,
        payload,
        idempotencyKey: `${type}:${opts.appId}:${stableKey ?? _eventSeq}`,
      }
      emitJourneyEvent(e as JourneyEvent)
    },
    [opts.appId, opts.surface, actor, emitJourneyEvent],
  )

  const milestone = useCallback(
    (verb: string, remarks: string, patch?: (app: Application) => void) => {
      if (!opts.appId) return
      recordJourneyMilestone(opts.appId, verb, remarks, actor, patch)
    },
    [opts.appId, actor, recordJourneyMilestone],
  )

  return { app, actor, surface: opts.surface, emit, milestone }
}

/** The party whose name a screen should show — the session's, falling back to
 *  what the application already knows. */
export function partyName(app: Application | undefined, role: PartyRole): string {
  return app?.parties.find((p) => p.role === role)?.name ?? 'you'
}
