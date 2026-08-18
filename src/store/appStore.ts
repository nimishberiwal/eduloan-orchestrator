// ============================================================================
// Single Zustand store — orchestration verbs + guardrails (§5, §6).
// ============================================================================
import { create } from 'zustand'
import type {
  App360Tab,
  Application,
  CallOutcome,
  CommChannel,
  CommEvent,
  Covenant,
  Deviation,
  FilterClause,
  FilterPredicate,
  IntegrationCall,
  Note,
  RoleId,
  Stage,
  StageId,
  TabId,
  Toast,
} from '@/types'
import type {
  AuditRole, AutomationEvent, ClosureKind, ConsentType, EscalationEvent, StageRule,
} from '@/types'
import type { HitlStatus, HitlTrigger } from '@/types'
import type { DocumentAgentCheck, ExtractedField, PartyRole, UniversityBrief } from '@/types'
import type { HitlDecisions } from '@/lib/hitl'
import type { JourneyActor, JourneyEvent } from '@/types/journeys'
import {
  buildJourneyApplication,
  nextJourneyAppId,
  type NewApplicationSpec,
} from '@/journeys/newApplication'
import { runJourneyResets } from '@/journeys/resetRegistry'
import { gatesFor, mergeFields, verifyDeclared } from '@/lib/declared'
import { docsFromRun, draftsFromRun, runSanctionSwarm } from '@/lib/agents/sanction'
import { runOnboardingSwarm, verdictFrom } from '@/lib/agents/onboarding'
import { POLICY } from '@/data/policy'
import type { AgentResults } from '@/lib/agents/types'
import type { FraudOutput, ValidationOutput } from '@/lib/agents/documents'
import { hasBlocking } from '@/lib/agents/runtime'
import { CONSENT_BY_TYPE } from '@/data/consents'
import { HITL_BY_TRIGGER } from '@/data/hitl'
import { classifyDoc } from '@/data/classification'
import { hitlKey } from '@/lib/hitl'
import { isBlockedOnConsent } from '@/lib/sourcing'
import type { GroupKey } from '@/lib/groupBy'
import type { PlannedAction } from '@/lib/rules'
import { clockOffsetHours, nowIso, resetClock, setClockOffsetHours } from '@/lib/clock'
import { generateBucketsForParty, materialiseDoc, resetDocSeq } from '@/data/buckets'
import { RULE_CATALOGUE } from '@/data/rules'
import { firedKey, sweepRules } from '@/lib/rules'
import { escalationTarget, rungFor, sweepEscalations } from '@/lib/escalation'
import { OFFICER_BY_ID, PRIMARY_OFFICER, officersOf } from '@/data/org'
import { COMM_TEMPLATE_BY_ID } from '@/data/comms'
import { CODE_LABEL } from '@/data/reasonCodes'
import { buildSeed, SAVED_FILTERS } from '@/data/seed'
import { NOW_ISO } from '@/lib/format'
import {
  ROLE_BY_ID,
  canCountersign,
  canMoveForward,
  defaultDeptForStage,
  officerOf,
  resetRoundRobin,
  roundRobinOfficer,
} from '@/lib/stateMachine'
import { nextStage } from '@/data/stages'
import { evaluateGate } from '@/lib/gating'
import { effectiveBand, decisionRole, deviationApprovalLevel } from '@/lib/doa'
import { DEV_LABEL } from '@/data/reasonCodes'
import { COV_DEFS } from '@/data/covenants'
import { VALIDATION_BY_ID, renderMessage } from '@/data/validations'

let _seq = 1000
const uid = (p: string) => `${p}-${++_seq}`

interface State {
  applications: Application[]
  role: RoleId
  tab: TabId
  selectedAppId: string | null
  app360Tab: App360Tab
  search: string
  activeFilters: FilterPredicate[]
  savedFilters: typeof SAVED_FILTERS
  toasts: Toast[]
  // --- §v2 ---
  /** Global composable clauses (filter builder in the header). */
  filterClauses: FilterClause[]
  /** Per-Kanban-column clauses, keyed by stage id (req 9). */
  columnFilters: Record<string, FilterClause[]>
  /** Batch-mode grouping dimension (req 5). */
  groupBy: GroupKey
  groupBy2: GroupKey
  /** CRM composer (req 1) — a global drawer with many entry points. */
  composerAppIds: string[]
  composerMode: 'message' | 'call' | null
  // --- §v2 automation (req 2) & escalation (req 10) ---
  rules: StageRule[]
  automationLog: AutomationEvent[]
  pendingAutomation: AutomationEvent[]
  firedRuleKeys: string[] // array (not Set) so state stays clone-safe
  escalations: EscalationEvent[]
  /** Bumped whenever the prototype clock moves, so views re-derive ageing. */
  clockTick: number
  clockOffsetHours: number
  /** §v3 — persisted HITL decisions; the queue itself is derived from state. */
  hitlDecisions: HitlDecisions
  // --- §v4 Glib.money journeys (§16) ---
  /** Append-only log of everything the journey surfaces emitted. */
  journeyEvents: JourneyEvent[]
  /** Idempotency keys already reduced. Array, not Set, so state stays
   *  clone-safe — the same reason firedRuleKeys is an array. */
  journeyKeys: string[]
}

interface Actions {
  setRole: (r: RoleId) => void
  setTab: (t: TabId) => void
  openApp: (appId: string) => void
  setApp360Tab: (t: App360Tab) => void
  setSearch: (s: string) => void
  toggleFilter: (f: FilterPredicate) => void
  clearFilters: () => void
  // --- §v2 filters & grouping ---
  addFilterClause: (c: FilterClause) => void
  removeFilterClause: (id: string) => void
  clearFilterClauses: () => void
  setColumnFilter: (stage: string, clauses: FilterClause[]) => void
  clearColumnFilter: (stage: string) => void
  setGroupBy: (k: GroupKey, k2?: GroupKey) => void
  // --- §v2 CRM (req 1) ---
  openComposer: (appId: string | null, mode?: 'message' | 'call') => void
  openBulkComposer: (appIds: string[]) => void
  sendComm: (
    appId: string,
    i: { channel: CommChannel; templateId?: string; subject: string; body: string },
  ) => void
  bulkSendComm: (
    appIds: string[],
    i: { channel: CommChannel; templateId?: string; subject: string; body: string },
  ) => void
  logCall: (
    appId: string,
    i: { outcome: CallOutcome; durationSec: number; notes: string; followUpAt?: string },
  ) => void
  // --- §v2 automation & escalation ---
  runAutomationSweep: () => void
  toggleRule: (ruleId: string) => void
  approvePendingAutomation: (eventId: string, note?: string) => void
  rejectPendingAutomation: (eventId: string, reason: string) => void
  acknowledgeEscalation: (escId: string) => void
  advanceClock: (hours: number) => void
  resetClockOffset: () => void
  withdrawApplication: (appId: string, code: string, remarks: string) => void
  // --- §v2 in-application deviations (req 3) ---
  addCoApplicant: (
    appId: string,
    i: { name: string; relationship: string; incomeBranch: 'salaried' | 'self_employed'; rationale: string },
  ) => void
  waiveDocument: (appId: string, docId: string, reason: string) => void
  // --- §v3 consent-gated sourcing ---
  /** `journeyActor` is set when a Glib.money surface initiated this. The
   *  mutation is identical either way — only the AUDIT ATTRIBUTION differs, so
   *  a consent granted by a parent on their own phone reads as theirs and not
   *  as the console operator's (§16.4). */
  requestConsent: (appId: string, type: ConsentType, journeyActor?: JourneyActor) => void
  grantConsent: (appId: string, type: ConsentType, journeyActor?: JourneyActor) => void
  declineConsent: (appId: string, type: ConsentType, reason: string, journeyActor?: JourneyActor) => void
  revokeConsent: (appId: string, type: ConsentType, journeyActor?: JourneyActor) => void
  runAutoFetch: (appId: string) => void
  // --- §v3 HITL review queue ---
  resolveHitl: (
    appId: string, trigger: HitlTrigger, status: HitlStatus, resolution: string,
  ) => void
  pushToast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: string) => void
  resetDemo: () => void

  // orchestration verbs
  moveForward: (appId: string, journeyActor?: JourneyActor) => void
  sendBack: (appId: string, code: string, target: Stage, remarks: string) => void
  reassign: (appId: string, department: Application['owner']['department'], officer: string) => void
  hold: (appId: string, code: string, remarks: string) => void
  releaseHold: (appId: string, remarks: string) => void
  requestDocs: (appId: string, bucketId: string, label: string) => void
  nudge: (appId: string) => void
  verifyDoc: (appId: string, docId: string, action: 'verify' | 'reject' | 'waive', reason?: string) => void
  waiveValidation: (appId: string, valId: string) => void
  retryIntegration: (appId: string, integrationId: string) => void
  raiseDeviation: (appId: string, defId: string, rationale: string) => void
  clearCovenant: (appId: string, covId: string) => void
  finalDecision: (appId: string, decision: NonNullable<Application['decision']>, opts: { code?: string; target?: Stage; covenantIds?: string[]; remarks?: string }) => void
  countersign: (appId: string) => void
  releaseTranche: (appId: string, trancheId: string) => void
  countersignTranche: (appId: string, trancheId: string) => void
  toggleExtractedField: (appId: string, fieldId: string) => void
  revalidate: (appId: string) => void

  // --- §v4 Glib.money journeys: the event contract (§16) ------------------
  /** THE reduction point. Dispatches to the verbs above; holds no mutation
   *  logic of its own, so the two surfaces cannot disagree. */
  emitJourneyEvent: (e: JourneyEvent) => void
  /** Verbs the journeys need that the back office never had. Each is an
   *  ordinary orchestration verb — audited, gated, idempotent-safe. */
  createJourneyApplication: (spec: NewApplicationSpec, actor: JourneyActor) => string
  uploadDocument: (
    appId: string,
    docId: string,
    meta: { fileName: string; sizeKb: number; actor: JourneyActor; replaced?: boolean },
  ) => void
  confirmExtraction: (
    appId: string,
    docId: string,
    fields: Record<string, string | number>,
    actor: JourneyActor,
  ) => void
  reassignDocument: (appId: string, fromDocId: string, toDocId: string, actor: JourneyActor) => void
  recordJourneyMilestone: (
    appId: string,
    verb: string,
    remarks: string,
    actor: JourneyActor,
    patch?: (app: Application) => void,
  ) => void
  joinJourneyParty: (
    appId: string,
    i: { role: PartyRole; name: string; relationship: string; partyId: string },
    actor: JourneyActor,
  ) => void
  requestTranche: (appId: string, trancheId: string, actor: JourneyActor) => void
  /** §v5 — record what the customer told us on a detail screen. Typed values
   *  arrive `selfDeclared`; evidenced ones arrive with both sides and a
   *  computed match. Merged by field id, so re-doing a screen corrects rather
   *  than duplicates. */
  recordDeclaredFields: (
    appId: string,
    fields: ExtractedField[],
    actor: JourneyActor,
    note?: string,
  ) => void
  /** §E — persist a university-intelligence brief produced by the crawl agent.
   *  Idempotent on `fetchedAt`: re-running the crawl in the same clock state
   *  produces the same stamp and is a no-op, so opening a file repeatedly does
   *  not pile up audit lines. */
  recordUniversityBrief: (
    appId: string,
    brief: UniversityBrief,
    actor: JourneyActor,
    note?: string,
  ) => void
  /** §v5 — lands a settled document swarm on the file. The validation agent's
   *  results go onto `app.validations`, which is what `evaluateGate` reads, so
   *  a rule the agent failed genuinely holds the stage. The audit line
   *  distinguishes a BLOCK-severity finding from a warning. */
  recordAgentFindings: (
    appId: string,
    docId: string,
    results: AgentResults,
    actor: JourneyActor,
  ) => void
  /** §V3 — run the onboarding orchestrator over a file and record its verdict.
   *  The verdict is what the S05 gate reads, so this is the verb that decides
   *  whether a file can be handed to Credit. */
  assessOnboarding: (appId: string, actor: JourneyActor) => void
  /** §V3 — proceed past a `ready: false` verdict. Audited, and the override is
   *  written onto the verdict itself so the file carries its own record of
   *  having been pushed through. */
  overrideOnboarding: (appId: string, reason: string) => void
  /** §Phase D item 5 — an officer approves one outreach draft, which sends it.
   *  Nothing the outreach agent writes leaves the bank without this call. */
  approveOutreachDraft: (appId: string, commId: string) => void
  discardOutreachDraft: (appId: string, commId: string) => void
  /** §v5 CJ-28 — re-check one already-recorded declaration group against a
   *  freshly read document. `groupKey` is `${section}|${group}`. Never touches
   *  `enteredValue`: the typed value is the thing being verified. */
  verifyDeclaredFields: (
    appId: string,
    groupKey: string,
    extracted: Record<string, string>,
    docId: string,
    actor: JourneyActor,
  ) => void
}

/** `nowIso()`, not `NOW_ISO`.
 *
 *  `NOW_ISO` is the frozen BASE instant; `nowIso()` is that base plus whatever
 *  offset the operator has applied with the clock control. Defaulting to the
 *  base meant every audit line written after someone advanced the clock was
 *  stamped at 10:00 on the base day — so a reviewer who advanced +48h to trip
 *  an SLA, or +25h to force a university re-crawl, saw the resulting audit
 *  entries dated before the thing they had just done. It hid exactly what the
 *  clock control exists to show.
 *
 *  Callers that know better still override: `recordUniversityBrief` stamps
 *  `ts: brief.fetchedAt` so the line matches the crawl it describes. */
function audit(app: Application, e: Partial<Application['audit'][number]>): void {
  app.audit = [
    { id: uid('AE'), ts: nowIso(), actor: '', role: 'Admin', verb: '', ...e } as Application['audit'][number],
    ...app.audit,
  ]
}

function reeval(app: Application): void {
  // Re-run derived gate state after mutations (no-op placeholder; gating is
  // computed on demand via evaluateGate — kept for clarity/extension).
  void app
}

export const useStore = create<State & Actions>((set, get) => ({
  applications: buildSeed(),
  role: 'Admin',
  tab: 'pipeline',
  selectedAppId: null,
  app360Tab: 'documents',
  search: '',
  activeFilters: [],
  savedFilters: SAVED_FILTERS,
  toasts: [],
  filterClauses: [],
  columnFilters: {},
  groupBy: 'branch',
  groupBy2: 'stage',
  composerAppIds: [],
  composerMode: null,
  rules: RULE_CATALOGUE.map((r) => ({ ...r })),
  automationLog: [],
  pendingAutomation: [],
  firedRuleKeys: [],
  escalations: [],
  clockTick: 0,
  clockOffsetHours: 0,
  hitlDecisions: {},
  journeyEvents: [],
  journeyKeys: [],

  setRole: (role) =>
    set((st) => {
      // On role switch, land officers on their department queue when in Queues.
      return { role, tab: st.tab }
    }),
  setTab: (tab) => set({ tab }),
  openApp: (appId) => set({ selectedAppId: appId, tab: 'app360', app360Tab: 'documents' }),
  setApp360Tab: (app360Tab) => set({ app360Tab }),
  setSearch: (search) => set({ search }),
  toggleFilter: (f) =>
    set((st) => ({
      activeFilters: st.activeFilters.includes(f)
        ? st.activeFilters.filter((x) => x !== f)
        : [...st.activeFilters, f],
    })),
  clearFilters: () => set({ activeFilters: [], filterClauses: [] }),

  addFilterClause: (c) =>
    set((st) => ({
      // one clause per field keeps the builder predictable
      filterClauses: [...st.filterClauses.filter((x) => x.field !== c.field), c],
    })),
  removeFilterClause: (id) =>
    set((st) => ({ filterClauses: st.filterClauses.filter((c) => c.id !== id) })),
  clearFilterClauses: () => set({ filterClauses: [] }),

  setColumnFilter: (stage, clauses) =>
    set((st) => ({ columnFilters: { ...st.columnFilters, [stage]: clauses } })),
  clearColumnFilter: (stage) =>
    set((st) => {
      const next = { ...st.columnFilters }
      delete next[stage]
      return { columnFilters: next }
    }),

  setGroupBy: (k, k2) => set((st) => ({ groupBy: k, groupBy2: k2 ?? st.groupBy2 })),

  // -------------------------------------------------------------------------
  // CRM (§v2 req 1)
  // -------------------------------------------------------------------------
  openComposer: (appId, mode = 'message') =>
    set({ composerAppIds: appId ? [appId] : [], composerMode: appId ? mode : null }),

  openBulkComposer: (appIds) =>
    set({ composerAppIds: appIds, composerMode: appIds.length ? 'message' : null }),

  sendComm: (appId, i) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.comms = [buildComm(app, i, role), ...app.comms]
      audit(app, {
        actor: officerOf(role),
        role,
        verb: `SEND ${i.channel.toUpperCase()}`,
        remarks: i.subject,
      })
      // Reaching out is bank-side work — the file is now awaiting the customer.
      if (app.blocker.kind === 'none') {
        app.blocker = { kind: 'customer', detail: `customer: awaiting response to "${i.subject}"` }
      }
      return true
    })
    pushToast('success', `${i.channel} sent to the customer.`)
  },

  bulkSendComm: (appIds, i) => {
    const { role, pushToast } = get()
    const n = mutateMany(set, appIds, (app) => {
      app.comms = [buildComm(app, i, role), ...app.comms]
      audit(app, { actor: officerOf(role), role, verb: `SEND ${i.channel.toUpperCase()} (bulk)`, remarks: i.subject })
      return true
    })
    pushToast('success', `${i.channel} sent to ${n} customer${n === 1 ? '' : 's'}.`)
  },

  logCall: (appId, i) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const connected = i.outcome === 'connected'
      app.comms = [
        {
          id: uid('C'),
          ts: nowIso(),
          channel: 'Call',
          templateId: 'manual_call',
          subject: `Call — ${i.outcome.replace('_', ' ')}`,
          body: i.notes || '(no notes)',
          auto: false,
          direction: 'outbound',
          status: connected ? 'delivered' : 'no_answer',
          actor: officerOf(role),
          role,
          to: maskPhone(app.appId),
          callOutcome: i.outcome,
          durationSec: i.durationSec,
          followUpAt: i.followUpAt,
        },
        ...app.comms,
      ]
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'LOG CALL',
        remarks: `${i.outcome.replace('_', ' ')}${i.durationSec ? ` · ${i.durationSec}s` : ''}${i.notes ? ` — ${i.notes}` : ''}`,
      })
      if (connected) app.lastCustomerActivityAt = nowIso()
      return true
    })
    pushToast('success', `Call logged (${i.outcome.replace('_', ' ')}).`)
  },

  // -------------------------------------------------------------------------
  // Automation & escalation (§v2 req 2, 10)
  // -------------------------------------------------------------------------
  runAutomationSweep: () => {
    const st = get()
    const now = nowIso()
    const fired = new Set(st.firedRuleKeys)

    // 1. Stage rules
    const plan = sweepRules(st.applications, st.rules, fired, now)

    // 2. SLA escalations
    const esc = sweepEscalations(st.applications, now, () => uid('ESC'))

    if (plan.auto.length === 0 && plan.queued.length === 0 && esc.events.length === 0) {
      st.pushToast('info', `Sweep complete — nothing new to action (${plan.skipped} already handled).`)
      return
    }

    // --- apply the non-destructive actions, one set() for the whole sweep ---
    const byApp = new Map<string, PlannedAction[]>()
    for (const p of plan.auto) {
      const arr = byApp.get(p.appId)
      if (arr) arr.push(p)
      else byApp.set(p.appId, [p])
    }
    for (const appId of Object.keys(esc.byApp)) {
      if (!byApp.has(appId)) byApp.set(appId, [])
    }

    const appliedEvents: AutomationEvent[] = []
    mutateMany(set, [...byApp.keys()], (app) => {
      for (const p of byApp.get(app.appId) ?? []) {
        applyAction(app, p, now)
        appliedEvents.push({
          id: uid('AUT'),
          ts: now,
          ruleId: p.ruleId,
          ruleName: p.ruleName,
          appId: p.appId,
          stage: p.stage,
          action: p.action,
          status: 'applied',
          detail: p.detail,
        })
      }
      // record escalation on the assignment itself
      const level = esc.byApp[app.appId]
      if (level) {
        app.assignment.escalationLevel = level
        app.assignment.lastEscalatedAt = now
        const ev = esc.events.find((e) => e.appId === app.appId)
        audit(app, {
          actor: 'System',
          role: 'Admin',
          verb: `ESCALATED — level ${level}`,
          remarks: ev ? `${ev.reason} → ${officerNameOf(ev.toOfficerId)}` : undefined,
        })
      }
      return true
    })

    // --- queue the destructive ones for approval ---
    const queuedEvents: AutomationEvent[] = plan.queued.map((p) => ({
      id: uid('AUT'),
      ts: now,
      ruleId: p.ruleId,
      ruleName: p.ruleName,
      appId: p.appId,
      stage: p.stage,
      action: p.action,
      status: 'pending_approval',
      detail: p.detail,
    }))

    const newKeys = [...plan.auto, ...plan.queued].map((p) => firedKey(p.ruleId, p.appId, p.stage))

    set((s) => ({
      automationLog: [...appliedEvents, ...queuedEvents, ...s.automationLog],
      pendingAutomation: [...queuedEvents, ...s.pendingAutomation],
      firedRuleKeys: [...new Set([...s.firedRuleKeys, ...newKeys])],
      escalations: [...esc.events, ...s.escalations],
    }))

    st.pushToast(
      'success',
      `Sweep: ${appliedEvents.length} applied · ${queuedEvents.length} awaiting approval · ${esc.events.length} escalated.`,
    )
  },

  toggleRule: (ruleId) =>
    set((st) => ({
      rules: st.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
    })),

  approvePendingAutomation: (eventId, note) => {
    const { role, pushToast } = get()
    const ev = get().pendingAutomation.find((e) => e.id === eventId)
    if (!ev) return
    const now = nowIso()

    mutate(set, ev.appId, (app) => {
      applyDestructive(app, ev, officerOf(role), role, now)
      return true
    })

    set((s) => ({
      pendingAutomation: s.pendingAutomation.filter((e) => e.id !== eventId),
      automationLog: s.automationLog.map((e) =>
        e.id === eventId
          ? { ...e, status: 'approved', decidedBy: officerOf(role), decidedByRole: role, decidedAt: now, decisionNote: note }
          : e,
      ),
    }))
    pushToast('success', `${ev.action.label} approved and applied to ${ev.appId}.`)
  },

  rejectPendingAutomation: (eventId, reason) => {
    const { role, pushToast } = get()
    const now = nowIso()
    set((s) => ({
      pendingAutomation: s.pendingAutomation.filter((e) => e.id !== eventId),
      automationLog: s.automationLog.map((e) =>
        e.id === eventId
          ? { ...e, status: 'rejected', decidedBy: officerOf(role), decidedByRole: role, decidedAt: now, decisionNote: reason }
          : e,
      ),
    }))
    pushToast('info', 'Automation action dismissed.')
  },

  acknowledgeEscalation: (escId) => {
    const { role } = get()
    set((s) => ({
      escalations: s.escalations.map((e) =>
        e.id === escId ? { ...e, acknowledgedAt: nowIso() } : e,
      ),
    }))
    void role
  },

  advanceClock: (hours) => {
    const next = clockOffsetHours() + hours
    setClockOffsetHours(next)
    // The offset lives as a module global, so bump a counter to force re-render.
    set((s) => ({ clockOffsetHours: next, clockTick: s.clockTick + 1 }))
    get().pushToast('info', `Clock advanced ${hours}h — now ${fmtDateTimeSafe(nowIso())}.`)
  },

  resetClockOffset: () => {
    resetClock()
    set((s) => ({ clockOffsetHours: 0, clockTick: s.clockTick + 1 }))
  },

  withdrawApplication: (appId, code, remarks) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      closeApplication(app, 'withdrawn', code, officerOf(role), role, remarks, nowIso())
      return true
    })
    pushToast('success', `${appId} withdrawn (${code}).`)
  },

  // -------------------------------------------------------------------------
  // In-application deviations (§v2 req 3)
  // -------------------------------------------------------------------------
  addCoApplicant: (appId, i) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const instance = app.parties.filter((p) => p.role === 'co_applicant').length + 1
      const partyId = `${app.appId}-C${instance}`
      const { buckets, documents } = generateBucketsForParty(i.incomeBranch, instance, partyId)

      // APPEND — never regenerate, or every verified document is destroyed.
      app.parties = [
        ...app.parties,
        {
          id: partyId,
          role: 'co_applicant',
          name: i.name,
          kycStatus: 'not_started',
          kycDetail: `${i.relationship} · added post-capture`,
          bucketIds: buckets.map((b) => b.id),
        },
      ]
      app.buckets = [...app.buckets, ...buckets]
      app.documents = [...app.documents, ...documents]

      // An added co-applicant is an application-level deviation (DEV-10).
      app.deviations = [
        ...app.deviations,
        {
          id: uid('DEV'),
          defId: 'DEV-10',
          title: DEV_LABEL['DEV-10'],
          raisedBy: officerOf(role),
          stage: String(app.stage),
          rationale: i.rationale || `${i.name} (${i.relationship}) added as co-applicant ${instance}`,
          approvalLevel: deviationApprovalLevel(app.askInr),
          status: 'open',
        },
      ]

      app.blocker = { kind: 'customer', detail: `customer: KYC & documents pending for ${i.name}` }
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'ADD CO-APPLICANT',
        reasonCode: 'DEV-10',
        remarks: `${i.name} (${i.relationship}) — ${buckets.length} new document buckets requested`,
      })
      return true
    })
    pushToast('success', `${i.name} added as co-applicant — checklist extended, DEV-10 raised.`)
  },

  waiveDocument: (appId, docId, reason) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const d = app.documents.find((x) => x.id === docId)
      if (!d) return false
      d.status = 'waived'
      d.reason = reason
      d.waivedBy = officerOf(role)
      // Waiving a document is an application-level deviation (DEV-09).
      app.deviations = [
        ...app.deviations,
        {
          id: uid('DEV'),
          defId: 'DEV-09',
          title: DEV_LABEL['DEV-09'],
          raisedBy: officerOf(role),
          stage: String(app.stage),
          rationale: `${d.label} waived — ${reason}`,
          approvalLevel: deviationApprovalLevel(app.askInr),
          status: 'open',
        },
      ]
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'WAIVE DOCUMENT',
        reasonCode: 'DEV-09',
        remarks: `${d.label} — ${reason}`,
      })
      return true
    })
    pushToast('success', 'Document waived — DEV-09 raised for approval.')
  },

  // -------------------------------------------------------------------------
  // Consent-gated sourcing (§v3) — BRD checklist "Digital Source"
  // -------------------------------------------------------------------------
  requestConsent: (appId, type, journeyActor) => {
    const { role, pushToast } = get()
    const def = CONSENT_BY_TYPE[type]
    mutate(set, appId, (app) => {
      const c = app.consents.find((x) => x.type === type)
      if (!c) return false
      c.status = 'requested'
      c.requestedAt = nowIso()
      c.declineReason = undefined
      app.blocker = { kind: 'customer', detail: `customer: consent pending — ${def.label}` }
      app.comms = [
        {
          id: uid('C'), ts: nowIso(), channel: 'WhatsApp', templateId: 'consent_request',
          subject: `Consent required — ${def.label}`,
          body: `Hi ${app.studentName}, we need your approval to fetch documents via ${def.label}. ${def.mechanism}.`,
          auto: true, direction: 'outbound', status: 'sent', actor: officerOf(role), role,
        },
        ...app.comms,
      ]
      audit(app, {
        actor: journeyActor ? actorName(journeyActor) : officerOf(role),
        role: journeyActor ? actorAuditRole(journeyActor) : role,
        verb: 'CONSENT REQUESTED',
        remarks: `${def.label} → ${c.partyName}${journeyActor ? actorSuffix(journeyActor) : ''}`,
      })
      return true
    })
    if (!journeyActor) pushToast('success', `Consent requested — ${def.label}.`)
  },

  /** Granting a consent unlocks a whole class of documents at once: every
   *  outstanding doc sourced through that consent is fetched in one step. This
   *  is the operational point of the BRD's consent-fetch category. */
  grantConsent: (appId, type, journeyActor) => {
    const { role, pushToast } = get()
    const def = CONSENT_BY_TYPE[type]
    let fetched = 0
    mutate(set, appId, (app) => {
      const c = app.consents.find((x) => x.type === type)
      if (!c) return false
      const now = nowIso()
      c.status = 'granted'
      c.decidedAt = now
      c.expiresAt = plusDays(now, def.validityDays)
      c.handle = `${type.toUpperCase().slice(0, 4)}-${appId.slice(-4)}`
      c.declineReason = undefined

      for (const d of app.documents) {
        if (d.status !== 'requested') continue
        if (d.consentType !== type && !def.unlocks.includes(d.sourceSystem)) continue
        // Fetched ≠ verified — the document still goes through QC/extraction.
        d.status = 'fetched'
        d.fetchedAt = now
        d.classification = classifyDoc(d.label)
        fetched++
      }

      // ONE audit line per consent, never one per document.
      audit(app, {
        actor: journeyActor ? actorName(journeyActor) : officerOf(role),
        role: journeyActor ? actorAuditRole(journeyActor) : role,
        verb: 'CONSENT GRANTED',
        remarks: `${def.label} — ${fetched} document${fetched === 1 ? '' : 's'} auto-fetched from ${def.unlocks.join(', ')}${journeyActor ? actorSuffix(journeyActor) : ''}`,
      })
      // If nothing else is outstanding on the customer, clear the blocker.
      const stillOnCustomer = app.documents.some(
        (d) => d.status === 'requested' && (d.sourcing === 'manual_upload' || isBlockedOnConsent(app, d)),
      )
      if (!stillOnCustomer && app.blocker.kind === 'customer') app.blocker = { kind: 'none' }
      return true
    })
    pushToast('success', `${def.label} granted — ${fetched} document${fetched === 1 ? '' : 's'} fetched.`)
  },

  declineConsent: (appId, type, reason, journeyActor) => {
    const { role, pushToast } = get()
    const def = CONSENT_BY_TYPE[type]
    mutate(set, appId, (app) => {
      const c = app.consents.find((x) => x.type === type)
      if (!c) return false
      c.status = 'declined'
      c.decidedAt = nowIso()
      c.declineReason = reason
      // Declined consent doesn't stop the file — it falls back to manual upload.
      for (const d of app.documents) {
        if (d.consentType === type && d.status === 'requested') {
          d.sourcing = 'manual_upload'
          d.reason = `Consent declined — collect by upload (${reason})`
        }
      }
      audit(app, {
        actor: journeyActor ? actorName(journeyActor) : officerOf(role),
        role: journeyActor ? actorAuditRole(journeyActor) : role,
        verb: 'CONSENT DECLINED',
        remarks: `${def.label} — ${reason}. Affected documents fall back to manual upload.${journeyActor ? actorSuffix(journeyActor) : ''}`,
      })
      return true
    })
    pushToast('warn', `${def.label} declined — those documents now need manual upload.`)
  },

  revokeConsent: (appId, type, journeyActor) => {
    const { role, pushToast } = get()
    const def = CONSENT_BY_TYPE[type]
    mutate(set, appId, (app) => {
      const c = app.consents.find((x) => x.type === type)
      if (!c) return false
      c.status = 'revoked'
      c.decidedAt = nowIso()
      audit(app, {
        actor: journeyActor ? actorName(journeyActor) : officerOf(role),
        role: journeyActor ? actorAuditRole(journeyActor) : role,
        verb: 'CONSENT REVOKED',
        remarks: `${def.label}${journeyActor ? actorSuffix(journeyActor) : ''}`,
      })
      return true
    })
    pushToast('info', `${def.label} revoked.`)
  },

  /** Pull everything obtainable from a public registry — no consent involved.
   *  This is bank-side work, not a customer chase. */
  runAutoFetch: (appId) => {
    const { role, pushToast } = get()
    let fetched = 0
    const systems = new Set<string>()
    mutate(set, appId, (app) => {
      const now = nowIso()
      for (const d of app.documents) {
        if (d.status !== 'requested') continue
        if (d.sourcing !== 'auto_fetch' && d.sourcing !== 'internal') continue
        d.status = 'fetched'
        d.fetchedAt = now
        d.classification = classifyDoc(d.label)
        systems.add(d.sourceSystem)
        fetched++
      }
      if (fetched === 0) return false
      audit(app, {
        actor: officerOf(role), role, verb: 'AUTO-FETCH RUN',
        remarks: `${fetched} document(s) pulled from ${[...systems].join(', ')}`,
      })
      return true
    })
    if (fetched === 0) pushToast('info', 'Nothing left to auto-fetch on this file.')
    else pushToast('success', `${fetched} document(s) auto-fetched — no customer action needed.`)
  },

  /** Record an officer's decision on a HITL case. The case itself is derived
   *  from application state; only the decision is persisted. */
  resolveHitl: (appId, trigger, status, resolution) => {
    const { role, pushToast } = get()
    const def = HITL_BY_TRIGGER[trigger]
    const now = nowIso()
    set((s) => ({
      hitlDecisions: {
        ...s.hitlDecisions,
        [hitlKey(appId, trigger)]: { status, resolution, resolvedAt: now, resolvedBy: officerOf(role) },
      },
    }))
    mutate(set, appId, (app) => {
      audit(app, {
        actor: officerOf(role), role,
        verb: `HITL ${status.toUpperCase().replace('_', ' ')}`,
        remarks: `${def.title} — ${resolution}`,
      })
      return true
    })
    pushToast('success', `HITL case ${status.replace('_', ' ')} — ${def.title}.`)
  },

  pushToast: (kind, message) =>
    set((st) => ({ toasts: [...st.toasts, { id: uid('T'), kind, message }] })),
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  resetDemo: () => {
    // Clear module-global counters/state that would otherwise survive a reset.
    resetRoundRobin()
    resetDocSeq()
    resetClock()
    // §v4 — sessions, OTP challenges, leads, handoffs, invite tokens, capture
    // results and every journey counter (_sessionSeq, _leadSeq, _handoffSeq,
    // _journeyAppSeq, …) tear down through the registry.
    runJourneyResets()
    set((s) => ({
      applications: buildSeed(),
      selectedAppId: null,
      activeFilters: [],
      filterClauses: [],
      columnFilters: {},
      search: '',
      // §v2 — automation/escalation state must reset too, or a "fresh" demo
      // would still carry the previous session's fired rules.
      rules: RULE_CATALOGUE.map((r) => ({ ...r })),
      automationLog: [],
      pendingAutomation: [],
      firedRuleKeys: [],
      escalations: [],
      hitlDecisions: {},
      journeyEvents: [],
      journeyKeys: [],
      composerAppIds: [],
      composerMode: null,
      clockOffsetHours: 0,
      clockTick: s.clockTick + 1,
      toasts: [{ id: uid('T'), kind: 'info', message: 'Demo data reset to seed.' }],
    }))
  },

  // -------------------------------------------------------------------------
  /** `journeyActor` is set only when a customer / co-applicant / RM initiated
   *  the move from a Glib.money surface (§16.3).
   *
   *  Two things are deliberately NOT the same for the two callers:
   *    · the §5 role matrix is a BANK-role permission table. A customer is not
   *      a bank role, so it is skipped for a journey actor — a customer is by
   *      definition allowed to submit their own application.
   *    · FORWARD_GATES is a POLICY table, and it is evaluated identically for
   *      both. The journey must not be a side door. */
  moveForward: (appId, journeyActor) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      if (!journeyActor && !canMoveForward(role, app.stage)) {
        pushToast('error', `${ROLE_BY_ID[role].label} cannot move this stage forward (§5 transition matrix).`)
        return false
      }
      const gate = evaluateGate(app)
      if (gate && !gate.passed) {
        // The customer never sees a gate ID — the caller surfaces the blocking
        // task instead (acceptance item 14). The toast is for the console.
        if (!journeyActor) {
          pushToast('error', `Blocked at ${gate.exit}: ${gate.failures.length} gate item(s) failing.`)
        }
        return false
      }
      const next = nextStage(app.stage as StageId)
      if (!next) {
        if (!journeyActor) pushToast('info', 'Already at the final stage.')
        return false
      }
      const from = app.stage
      app.stage = next
      app.status = 'in_progress'
      app.stageEnteredAt = NOW_ISO
      app.stageHistory = [...app.stageHistory, { stage: next, enteredAt: NOW_ISO }]
      const dept = defaultDeptForStage(next)
      app.owner = { department: dept, officer: roundRobinOfficer(dept) }
      if (journeyActor) {
        app.blocker = { kind: 'bank', detail: 'bank: submitted by the customer, awaiting review' }
        audit(app, {
          actor: actorName(journeyActor),
          role: actorAuditRole(journeyActor),
          verb: 'APPLICATION SUBMITTED',
          fromStage: from,
          toStage: next,
          remarks: actorSuffix(journeyActor),
        })
      } else {
        audit(app, { actor: officerOf(role), role, verb: 'MOVE FORWARD', fromStage: from, toStage: next })
        pushToast('success', `Moved ${app.appId} forward to ${next}.`)
      }
      reeval(app)
      return true
    })
  },

  sendBack: (appId, code, target, remarks) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const from = app.stage
      app.stage = target
      app.status = 'sent_back'
      app.stageEnteredAt = NOW_ISO
      if (/SB-01|SB-02|SB-03/.test(code)) {
        app.blocker = { kind: 'customer', detail: `customer: re-work per ${code}` }
      }
      audit(app, { actor: officerOf(role), role, verb: 'SEND BACK', fromStage: from, toStage: target, reasonCode: code, remarks })
      pushToast('success', `Sent ${app.appId} back to ${target} (${code}).`)
      return true
    })
  },

  reassign: (appId, department, officer) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.owner = { department, officer }
      audit(app, { actor: officerOf(role), role, verb: 'REASSIGN', remarks: `→ ${department} / ${officer}` })
      pushToast('success', `Reassigned ${app.appId} to ${officer} (${department}).`)
      return true
    })
  },

  hold: (appId, code, remarks) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.status = 'on_hold'
      audit(app, { actor: officerOf(role), role, verb: 'HOLD', reasonCode: code, remarks })
      pushToast('success', `${app.appId} put on hold (${code}).`)
      return true
    })
  },

  releaseHold: (appId, remarks) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.status = 'in_progress'
      audit(app, { actor: officerOf(role), role, verb: 'RELEASE HOLD', remarks })
      pushToast('success', `Hold released on ${app.appId}.`)
      return true
    })
  },

  requestDocs: (appId, bucketId, label) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.documents = [
        ...app.documents,
        materialiseDoc(uid('D'), bucketId, { label, mandate: 'M', src: 'Upload' }, 'requested'),
      ]
      app.blocker = { kind: 'customer', detail: `customer: additional document requested (${label})` }
      audit(app, { actor: officerOf(role), role, verb: 'REQUEST ADDITIONAL DOCS', remarks: `${bucketId}: ${label}` })
      app.comms = [
        { id: uid('C'), ts: NOW_ISO, channel: 'WhatsApp', templateId: 'doc_request', subject: 'Documents required', body: `Please upload: ${label}.`, auto: true },
        ...app.comms,
      ]
      pushToast('success', `Requested "${label}" — customer notified.`)
      return true
    })
  },

  nudge: (appId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      audit(app, { actor: officerOf(role), role, verb: 'SEND NUDGE', remarks: 'Manual nudge' })
      app.comms = [
        { id: uid('C'), ts: NOW_ISO, channel: 'WhatsApp', templateId: 'nudge', subject: 'Reminder', body: `Reminder: application ${app.appId} is awaiting your action.`, auto: false },
        ...app.comms,
      ]
      pushToast('success', `Nudge sent for ${app.appId}.`)
      return true
    })
  },

  verifyDoc: (appId, docId, action, reason) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const d = app.documents.find((x) => x.id === docId)
      if (!d) return false
      if (action === 'verify') d.status = 'verified'
      if (action === 'reject') { d.status = 'rejected'; d.reason = reason; d.version += 1 }
      if (action === 'waive') { d.status = 'waived'; d.reason = reason; d.waivedBy = officerOf(role) }
      audit(app, { actor: officerOf(role), role, verb: `DOC ${action.toUpperCase()}`, remarks: `${d.label}${reason ? ` — ${reason}` : ''}` })
      pushToast('success', `Document "${d.label}" ${action}${action === 'verify' ? 'ied' : action === 'reject' ? 'ed' : 'd'}.`)
      return true
    })
  },

  waiveValidation: (appId, valId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const v = app.validations.find((x) => x.catalogueId === valId)
      const def = VALIDATION_BY_ID[valId]
      if (!v || !def) return false
      if (def.severity !== 'WARN') {
        pushToast('error', 'Only WARN validations can be waived (§5).')
        return false
      }
      v.status = 'waived'
      v.waivedBy = officerOf(role)
      audit(app, { actor: officerOf(role), role, verb: 'WAIVE VALIDATION', remarks: `${valId} waived` })
      pushToast('success', `${valId} waived by ${officerOf(role)}.`)
      return true
    })
  },

  retryIntegration: (appId, integrationId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const call = app.integrations.find((c) => c.id === integrationId)
      if (!call) return false
      call.status = 'success'
      call.latencyMs = 400 + ((_seq * 7) % 600)
      call.lastAttempt = NOW_ISO
      audit(app, { actor: officerOf(role), role, verb: 'RETRY INTEGRATION', remarks: `${call.system} → success` })
      // re-evaluate linked VAL-EXT rule → pass
      if (call.linkedValidationId) {
        const v = app.validations.find((x) => x.catalogueId === call.linkedValidationId)
        const def = VALIDATION_BY_ID[call.linkedValidationId]
        if (v && def) {
          v.status = 'pass'
          v.message = def.passMessage
        }
        // clear a customer/bank blocker hint if it was integration-driven
        if (app.blocker.kind !== 'none' && app.status !== 'on_hold') {
          app.blocker = { kind: 'none' }
        }
      }
      pushToast('success', `${call.system} retried — success; linked check re-evaluated.`)
      return true
    })
  },

  raiseDeviation: (appId, defId, rationale) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const d: Deviation = {
        id: uid('DEV'),
        defId,
        title: DEV_LABEL[defId],
        raisedBy: officerOf(role),
        stage: typeof app.stage === 'string' ? app.stage : 'S07',
        rationale,
        approvalLevel: deviationApprovalLevel(app.askInr),
        status: 'open',
      }
      app.deviations = [...app.deviations, d]
      audit(app, { actor: officerOf(role), role, verb: 'RAISE DEVIATION', reasonCode: defId, remarks: rationale })
      pushToast('success', `${defId} raised — approval level: ${d.approvalLevel}.`)
      return true
    })
  },

  clearCovenant: (appId, covId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const c = app.covenants.find((x) => x.id === covId)
      if (!c) return false
      c.status = 'cleared'
      audit(app, { actor: officerOf(role), role, verb: 'CLEAR COVENANT', remarks: `${c.defId} cleared` })
      pushToast('success', `${c.defId} cleared.`)
      return true
    })
  },

  finalDecision: (appId, decision, opts) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const band = effectiveBand(app)
      const requiredRole = decisionRole(band)
      if (role !== requiredRole && role !== 'Admin') {
        pushToast('error', `Final decision for ${band} must be recorded by ${ROLE_BY_ID[requiredRole].label}.`)
        return false
      }
      if (decision === 'APPROVE_WITH_CONDITIONS' && (!opts.covenantIds || opts.covenantIds.length === 0)) {
        pushToast('error', 'APPROVE-WITH-CONDITIONS requires ≥1 covenant (§6).')
        return false
      }
      if (decision === 'DECLINE' && !opts.code) {
        pushToast('error', 'DECLINE requires a REJ-xx code.')
        return false
      }
      if (decision === 'REFER_BACK' && (!opts.code || !opts.target)) {
        pushToast('error', 'REFER_BACK requires an SB-xx code and target stage.')
        return false
      }
      // attach covenants
      if (opts.covenantIds) {
        for (const cid of opts.covenantIds) {
          const def = COV_DEFS.find((d) => d.id === cid)
          if (def && !app.covenants.some((c) => c.defId === cid)) {
            const c: Covenant = { id: uid('COV'), defId: cid, title: def.title, raisedAt: NOW_ISO, clearBy: def.clearBy, status: 'open' }
            app.covenants = [...app.covenants, c]
          }
        }
      }
      app.decision = decision
      app.committeePath = band === 'Committee'
      // maker records; checker must countersign (maker-checker)
      app.status = 'pending_checker'
      app.pendingChecker = {
        verb: 'final_decision',
        maker: officerOf(role),
        makerRole: role,
        ts: NOW_ISO,
        summary: `${decision} at ${band}${band === 'Committee' ? ' (Committee: Central Risk decides + Admin countersigns)' : ''}`,
        payload: { decision, ...opts },
      }
      audit(app, { actor: officerOf(role), role, verb: 'FINAL DECISION (maker)', remarks: `${decision} — ${band}` })
      pushToast('success', `${decision} recorded — awaiting checker countersign (${band}).`)
      return true
    })
  },

  countersign: (appId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const pc = app.pendingChecker
      if (!pc) { pushToast('info', 'Nothing pending countersign.'); return false }
      if (!canCountersign(role, pc.maker, pc.makerRole)) {
        pushToast('error', `Checker must differ from maker (${pc.maker}) and be same-or-higher authority. Switch role to countersign.`)
        return false
      }
      const band = effectiveBand(app)
      // Committee path: Central Risk decides + Admin countersigns
      if (band === 'Committee' && role !== 'Admin') {
        pushToast('error', 'Committee path: Admin must countersign the Central Risk decision.')
        return false
      }
      const decision = app.decision
      audit(app, { actor: officerOf(role), role, verb: 'COUNTERSIGN (checker)', remarks: `${decision} countersigned` })
      app.pendingChecker = undefined
      if (decision === 'DECLINE') {
        app.stage = 'REJECTED'
        app.status = 'rejected'
        app.rejectionCode = (pc.payload as any)?.code
        audit(app, { actor: officerOf(role), role, verb: 'DECISION FINALISED — DECLINE', fromStage: 'S10', toStage: 'REJECTED', reasonCode: app.rejectionCode })
      } else if (decision === 'REFER_BACK') {
        const target = (pc.payload as any)?.target as Stage
        app.stage = target
        app.status = 'sent_back'
        app.stageEnteredAt = NOW_ISO
      } else {
        // APPROVE / AWC → advance to S11 sanction
        app.stage = 'S11'
        app.status = 'in_progress'
        app.stageEnteredAt = NOW_ISO
        app.sanctionDate = NOW_ISO
        // POLICY, not a literal 180. The number appeared three times in this
        // block — the expiry date, the audit remark and the customer's letter —
        // and a committee editing `sanctionValidityDays` would have moved one
        // of the three.
        app.sanctionExpiryDate = plusDays(NOW_ISO, POLICY.sanctionValidityDays)
        // The owning Credit officer comes from the org model. It was hardcoded
        // to 'S. Kulkarni', which is who PRIMARY_OFFICER.Credit happens to be —
        // so the file silently disagreed with the org chart the moment anyone
        // edited data/org.ts.
        app.owner = { department: 'Credit', officer: PRIMARY_OFFICER.Credit.name }
        app.stageHistory = [...app.stageHistory, { stage: 'S11', enteredAt: NOW_ISO }]
        audit(app, {
          actor: officerOf(role),
          role,
          verb: 'SANCTION ISSUED',
          toStage: 'S11',
          remarks: `Validity clock started (${POLICY.sanctionValidityDays}d)`,
        })

        // §Phase D — the sanction pack. Seven agents, computed completely and
        // synchronously here: the results are a pure function of the file, and
        // only the REVEAL is ever on a timer (§2).
        const pack = runSanctionSwarm(app, NOW_ISO)
        app.generatedDocs = docsFromRun(pack)

        // The outreach agent WRITES; it does not send. Each draft is inert
        // until an officer approves it, which is the whole point of item 5 —
        // an agent that could message a customer about their own sanction
        // without a person reading it first is not a feature.
        const drafts: CommEvent[] = draftsFromRun(pack).map((d) => ({
          id: uid('C'),
          ts: NOW_ISO,
          channel: d.channel,
          templateId: 'sanction_outreach_draft',
          subject: d.subject,
          body: d.body,
          auto: false,
          direction: 'outbound',
          status: 'draft',
          actor: 'Agent',
          role,
        }))

        audit(app, {
          actor: 'Agent',
          role,
          verb: 'SANCTION PACK GENERATED',
          remarks: `${app.generatedDocs.length} paper(s) produced · ${drafts.length} message(s) drafted, none sent`,
        })

        app.comms = [
          ...drafts,
          // The template owns the wording. This body was inlined and dropped
          // the `validity` token the template itself interpolates, so the
          // customer's email omitted the one date the letter turns on.
          {
            id: uid('C'),
            ts: NOW_ISO,
            channel: 'Email',
            templateId: 'sanction_issued',
            subject: 'Sanction letter issued',
            body:
              COMM_TEMPLATE_BY_ID['sanction_issued']?.render({
                student: app.studentName,
                validity: new Date(app.sanctionExpiryDate).toDateString(),
              }) ?? `Your loan is sanctioned.`,
            auto: true,
          },
          ...app.comms,
        ]
      }
      pushToast('success', `${decision} countersigned by ${officerOf(role)}.`)
      return true
    })
  },

  releaseTranche: (appId, trancheId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const t = app.tranches.find((x) => x.id === trancheId)
      if (!t) return false
      // `gatesFor` — tranche 1 also carries the derived declaration gate, so a
      // file with self-declared facts still unevidenced cannot be released even
      // though it sanctioned and signed normally.
      const gatesOk = gatesFor(app, t).every((g) => g.passed)
      if (!gatesOk) {
        pushToast('error', `Tranche ${t.n} has failing gates — cannot release.`)
        return false
      }
      t.pendingChecker = true
      t.maker = officerOf(role)
      t.status = 'scheduled'
      audit(app, { actor: officerOf(role), role, verb: 'RELEASE TRANCHE (maker)', remarks: `Tranche ${t.n} — awaiting checker` })
      pushToast('success', `Tranche ${t.n} release proposed — awaiting Credit checker.`)
      return true
    })
  },

  countersignTranche: (appId, trancheId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const t = app.tranches.find((x) => x.id === trancheId)
      if (!t || !t.pendingChecker) return false
      if (t.maker && officerOf(role) === t.maker) {
        pushToast('error', 'Tranche checker must differ from maker. Switch role to countersign.')
        return false
      }
      if (role !== 'Credit-Regional' && role !== 'Admin') {
        pushToast('error', 'Tranche release checker must be Credit (or Admin).')
        return false
      }
      t.pendingChecker = false
      t.status = 'remitted'
      audit(app, { actor: officerOf(role), role, verb: 'RELEASE TRANCHE (checker)', remarks: `Tranche ${t.n} remitted` })
      app.comms = [
        { id: uid('C'), ts: NOW_ISO, channel: 'SMS', templateId: 'tranche_disbursed', subject: 'Disbursement processed', body: `Tranche ${t.n} disbursed.`, auto: true },
        ...app.comms,
      ]
      // if all tranches remitted → terminal
      if (app.tranches.every((x) => x.status === 'remitted')) {
        app.stage = 'DISBURSED_ACTIVE'
        app.status = 'completed'
      }
      pushToast('success', `Tranche ${t.n} remitted.`)
      return true
    })
  },

  toggleExtractedField: (appId, fieldId) => {
    const { pushToast } = get()
    mutate(set, appId, (app) => {
      const f = app.extracted.find((x) => x.id === fieldId)
      if (!f) return false
      // Special demo hook: flipping endorsement_verified flips CRS-23/EXT-18 and gates
      if (f.label === 'endorsement_verified') {
        const nowTrue = f.match === 'fail'
        f.extractedValue = nowTrue ? 'true' : 'false'
        f.enteredValue = nowTrue ? 'true' : 'false'
        f.match = nowTrue ? 'pass' : 'fail'
        for (const vid of ['VAL-CRS-23', 'VAL-EXT-18']) {
          const v = app.validations.find((x) => x.catalogueId === vid)
          const def = VALIDATION_BY_ID[vid]
          if (v && def) {
            v.status = nowTrue ? 'pass' : 'fail'
            v.message = nowTrue ? def.passMessage : renderMessage(def.failMessage, v.tokens)
          }
        }
        // update visa tranche gates
        for (const t of app.tranches) {
          for (const g of t.gates) {
            if (g.ref === 'VAL-CRS-23' || g.ref === 'VAL-EXT-18') g.passed = nowTrue
          }
        }
        audit(app, { actor: 'System', role: get().role, verb: 'FIELD TOGGLED', remarks: `endorsement_verified=${nowTrue} → CRS-23/EXT-18 re-evaluated` })
        pushToast('info', `endorsement_verified set to ${nowTrue}; gates re-evaluated.`)
        return true
      }
      return false
    })
  },

  // =========================================================================
  // §v4 — Glib.money journeys. New orchestration verbs + the event contract.
  // =========================================================================

  createJourneyApplication: (spec, actor) => {
    // The id is derived from what already exists, so a journey file can never
    // land on a seeded one (see newApplication.ts).
    const appId = nextJourneyAppId(get().applications.map((a) => a.appId))
    const app = buildJourneyApplication(spec, appId)
    audit(app, {
      actor: actorName(actor),
      role: actorAuditRole(actor),
      verb: 'APPLICATION STARTED',
      toStage: 'S01',
      remarks: `${spec.program} at ${spec.university} — ${spec.intake}${actorSuffix(actor)}`,
    })
    set((st) => ({ applications: [app, ...st.applications] }))
    return appId
  },

  /** The doc-status path the journeys write through. `fetched` and `uploaded`
   *  sit at the same standing — neither is verification (§9 of HANDOFF). */
  uploadDocument: (appId, docId, meta) => {
    mutate(set, appId, (app) => {
      const d = app.documents.find((x) => x.id === docId)
      if (!d) return false
      const replacing = meta.replaced || d.status === 'rejected' || d.status === 'qc_fail'
      d.status = 'uploaded'
      d.reason = undefined
      d.classification = classifyDoc(d.label)
      if (replacing) d.version += 1
      audit(app, {
        actor: actorName(meta.actor),
        role: actorAuditRole(meta.actor),
        verb: replacing ? 'DOCUMENT REPLACED' : 'DOCUMENT UPLOADED',
        remarks: `${d.label} — ${meta.fileName} (${meta.sizeKb} kB)${actorSuffix(meta.actor)}`,
      })
      app.lastCustomerActivityAt = nowIso()
      // Once nothing is outstanding on the customer, the file is ours again.
      const stillOnCustomer = app.documents.some(
        (x) => x.status === 'requested' && (x.sourcing === 'manual_upload' || isBlockedOnConsent(app, x)),
      )
      if (!stillOnCustomer && app.blocker.kind === 'customer') {
        app.blocker = { kind: 'bank', detail: 'bank: everything received, awaiting review' }
      }
      return true
    })
  },

  confirmExtraction: (appId, docId, fields, actor) => {
    mutate(set, appId, (app) => {
      const d = app.documents.find((x) => x.id === docId)
      if (!d) return false
      // Extraction is NOT verification. The document moves to `extracted`, and
      // the customer-facing word stays "Received" (§12.3).
      if (d.status === 'uploaded' || d.status === 'fetched') d.status = 'extracted'
      const summary = Object.entries(fields)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: 'EXTRACTION CONFIRMED',
        remarks: `${d.label}${summary ? ` — ${summary}` : ''}${actorSuffix(actor)}`,
      })
      return true
    })
  },

  /** The mismatch path at CJ-18: this file is really the OTHER document. */
  reassignDocument: (appId, fromDocId, toDocId, actor) => {
    const { pushToast } = get()
    mutate(set, appId, (app) => {
      const from = app.documents.find((x) => x.id === fromDocId)
      const to = app.documents.find((x) => x.id === toDocId)
      if (!from || !to) return false
      to.status = 'uploaded'
      // The document is now filed against ITS OWN slot, so it classifies as
      // that slot — carrying the wrong slot's label across would leave the
      // bank's record asserting the mis-file.
      to.classification = classifyDoc(to.label)
      to.version += 1
      from.status = 'requested'
      from.classification = undefined
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: 'DOCUMENT REASSIGNED',
        remarks: `Upload moved from "${from.label}" to "${to.label}"${actorSuffix(actor)}`,
      })
      return true
    })
    pushToast('success', 'Document filed against the right slot.')
  },

  /** One audited milestone + an optional targeted patch. Used for sanction
   *  acceptance, fee, e-sign, mandate and the invite/consent bookkeeping that
   *  has no dashboard verb of its own. */
  recordJourneyMilestone: (appId, verb, remarks, actor, patch) => {
    mutate(set, appId, (app) => {
      patch?.(app)
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb,
        remarks: `${remarks}${actorSuffix(actor)}`,
      })
      app.lastCustomerActivityAt = nowIso()
      return true
    })
  },

  /** A co-applicant or security owner completing their own OTP (§7.5, §8). */
  joinJourneyParty: (appId, i, actor) => {
    mutate(set, appId, (app) => {
      const section = i.role === 'co_applicant' ? 'co_applicant' : 'collateral'
      const existing = app.parties.find((p) => p.role === i.role)
      if (existing) {
        existing.name = i.name
        existing.kycDetail = i.relationship
        existing.kycStatus = existing.kycStatus === 'not_started' ? 'in_progress' : existing.kycStatus
      } else {
        app.parties = [
          ...app.parties,
          {
            id: i.partyId,
            role: i.role,
            name: i.name,
            kycStatus: 'in_progress',
            kycDetail: i.relationship,
            bucketIds: app.buckets.filter((b) => b.section === section).map((b) => b.id),
          },
        ]
      }
      // The consent ledger names the party who must grant each consent, so it
      // has to learn the real name the moment they join.
      for (const c of app.consents) {
        if (c.partyRole !== i.role) continue
        c.partyName = i.name
        c.partyId = i.partyId
      }
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: i.role === 'co_applicant' ? 'CO-APPLICANT JOINED' : 'SECURITY OWNER JOINED',
        remarks: `${i.name} (${i.relationship}) verified their own mobile${actorSuffix(actor)}`,
      })
      return true
    })
  },

  /** The customer REQUESTS a tranche; the bank releases it. Never both (§15). */
  requestTranche: (appId, trancheId, actor) => {
    const { pushToast } = get()
    mutate(set, appId, (app) => {
      const t = app.tranches.find((x) => x.id === trancheId)
      if (!t) return false
      if (t.status === 'released' || t.status === 'remitted') return false
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: 'TRANCHE REQUESTED',
        remarks: `Tranche ${t.n} requested — queued for Ops release under maker-checker${actorSuffix(actor)}`,
      })
      app.blocker = { kind: 'bank', detail: `bank: tranche ${t.n} release requested by the customer` }
      return true
    })
    pushToast('info', 'Tranche request queued for the bank. Release stays a bank action.')
  },

  assessOnboarding: (appId, actor) => {
    const population = get().applications
    mutate(set, appId, (app) => {
      const results = runOnboardingSwarm(app, population)
      const v = verdictFrom(results)
      app.onboardingVerdict = {
        ready: v.ready,
        blockingReasons: v.blockingReasons,
        headlines: Object.values(results).map((r) => ({ agent: r.agent, headline: r.headline })),
        assessedAt: nowIso(),
      }
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: v.ready ? 'ONBOARDING CLEARED' : 'ONBOARDING HELD',
        remarks: v.ready
          ? 'Complete enough to hand to credit'
          : v.blockingReasons.join(' · '),
      })
      return true
    })
  },

  overrideOnboarding: (appId, reason) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const v = app.onboardingVerdict
      if (!v || v.ready) {
        pushToast('info', 'Nothing to override — this file is not being held.')
        return false
      }
      // The verdict is NOT rewritten to ready. An override records that a person
      // disagreed and proceeded; it does not retrospectively make the file
      // complete, and the reviewer downstream should see both facts.
      v.overriddenBy = officerOf(role)
      v.overrideReason = reason
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'ONBOARDING OVERRIDDEN',
        remarks: `Proceeded past ${v.blockingReasons.length} outstanding item(s) — ${reason}`,
      })
      return true
    })
    pushToast('info', 'Override recorded. The file can now move to credit.')
  },

  approveOutreachDraft: (appId, commId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const draft = app.comms.find((c) => c.id === commId)
      if (!draft || draft.status !== 'draft') {
        pushToast('info', 'That message is not a draft.')
        return false
      }
      // The draft BECOMES the sent message rather than spawning a copy, so the
      // thread shows one message with a history, not a ghost draft beside a
      // near-identical send.
      draft.status = draft.channel === 'Email' ? 'delivered' : 'sent'
      draft.actor = officerOf(role)
      draft.role = role
      draft.auto = false
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'OUTREACH APPROVED',
        remarks: `${draft.channel} — "${draft.subject}" approved by an officer and sent`,
      })
      return true
    })
    pushToast('success', 'Message approved and sent.')
  },

  discardOutreachDraft: (appId, commId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      const draft = app.comms.find((c) => c.id === commId)
      if (!draft || draft.status !== 'draft') return false
      app.comms = app.comms.filter((c) => c.id !== commId)
      audit(app, {
        actor: officerOf(role),
        role,
        verb: 'OUTREACH DISCARDED',
        remarks: `${draft.channel} — "${draft.subject}" discarded unsent`,
      })
      return true
    })
    pushToast('info', 'Draft discarded.')
  },

  verifyDeclaredFields: (appId, groupKey, extracted, docId, actor) => {
    mutate(set, appId, (app) => {
      const [section, group] = groupKey.split('|')
      const target = app.extracted.filter(
        (f) => f.section === section && f.group === group && f.backingDocIds !== undefined,
      )
      if (target.length === 0) return false

      const verified = verifyDeclared(target, extracted, docId)
      app.extracted = mergeFields(app.extracted, verified)

      const checked = verified.filter((f) => f.match === 'pass').length
      const clashed = verified.filter((f) => f.match === 'fail').length
      const stillOwed = verified.filter((f) => f.match === 'pending').length

      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        // A contradiction is not a successful verification and the audit trail
        // should not read as though it were.
        verb: clashed > 0 ? 'DECLARATION CONTRADICTED' : 'DECLARATION EVIDENCED',
        remarks: `${group} — ${checked} matched${clashed ? `, ${clashed} DID NOT MATCH` : ''}${
          stillOwed ? `, ${stillOwed} still unread` : ''
        }${actorSuffix(actor)}`,
      })
      app.lastCustomerActivityAt = nowIso()
      return true
    })
  },

  recordAgentFindings: (appId, docId, results, actor) => {
    mutate(set, appId, (app) => {
      const doc = app.documents.find((d) => d.id === docId)
      const val = results.validation?.output as ValidationOutput | undefined
      const incoming = val?.results ?? []

      // The validation agent already builds real `ValidationResult`s off the
      // real catalogue and refuses to re-open anything waived or failed. Until
      // now they were thrown away, so nothing the swarm found ever reached the
      // Validations tab — or `evaluateGate`, which reads exactly this array.
      if (incoming.length > 0) {
        const byId = new Map(app.validations.map((v) => [v.catalogueId, v]))
        for (const r of incoming) byId.set(r.catalogueId, r)
        app.validations = [...byId.values()]
      }

      const fraud = results.fraud?.output as FraudOutput | undefined
      const failed = incoming.filter((r) => r.status === 'fail').length
      const blocking = hasBlocking(results)

      // §Phase F — the fraud agent's verdict lands on the file. It was
      // computed and dropped: the customer watched the lane finish and the
      // bank was never told what it found. Merged by docId so re-uploading a
      // document corrects the record rather than appending a second opinion.
      const check: DocumentAgentCheck = {
        docId,
        docLabel: doc?.label ?? docId,
        ranAt: nowIso(),
        fraudScore: fraud?.score ?? 0,
        fraudSignals: fraud?.signals ?? [],
        validationIds: incoming.map((r) => r.catalogueId),
        failedValidationIds: incoming.filter((r) => r.status === 'fail').map((r) => r.catalogueId),
        blocking,
      }
      app.agentChecks = [...(app.agentChecks ?? []).filter((c) => c.docId !== docId), check]

      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        // `hasBlocking` is the whole reason the runtime tags findings with a
        // level: a BLOCK-severity rule failing is not the same event as a
        // warning, and the audit trail should not read as though it were.
        verb: blocking ? 'AGENT CHECKS — BLOCKING' : 'AGENT CHECKS RAN',
        remarks: `${doc?.label ?? docId} — ${incoming.length} validation(s) recorded${
          failed ? `, ${failed} failed` : ''
        }${fraud ? ` · fraud signals: ${fraud.signals.length}` : ''}${
          blocking ? ' · A PERSON MUST LOOK BEFORE THIS FILE MOVES' : ''
        }${actorSuffix(actor)}`,
      })

      app.lastCustomerActivityAt = nowIso()
      return true
    })
  },

  recordDeclaredFields: (appId, fields, actor, note) => {
    if (fields.length === 0) return
    mutate(set, appId, (app) => {
      app.extracted = mergeFields(app.extracted, fields)
      const declared = fields.filter((f) => f.selfDeclared).length
      const checked = fields.filter((f) => f.match === 'pass').length
      const clashed = fields.filter((f) => f.match === 'fail').length
      audit(app, {
        actor: actorName(actor),
        role: actorAuditRole(actor),
        verb: declared > 0 ? 'DETAILS DECLARED' : 'DETAILS EVIDENCED',
        remarks: `${note ? `${note} — ` : ''}${fields.length} field(s)${
          declared ? `, ${declared} self-declared` : ''
        }${checked ? `, ${checked} matched the document` : ''}${
          clashed ? `, ${clashed} DID NOT MATCH` : ''
        }${actorSuffix(actor)}`,
      })
      app.lastCustomerActivityAt = nowIso()
      return true
    })
  },

  recordUniversityBrief: (appId, brief, actor, note) => {
    mutate(set, appId, (app) => {
      // Idempotent on the stamp. The panel re-runs the crawl whenever it mounts
      // against a stale brief; without this guard a reviewer clicking between
      // tabs would write an audit line each time, and the audit trail would stop
      // meaning "the crawl ran again" and start meaning "somebody looked".
      if (app.universityBrief?.fetchedAt === brief.fetchedAt) return false

      const previous = app.universityBrief
      app.universityBrief = brief

      const adverse = brief.sources.filter((s) => s.category === 'adverse').length
      audit(app, {
        // `audit()` defaults `ts` to NOW_ISO — the UN-OFFSET frozen base, kept
        // that way for seed construction. Overridden here deliberately: the
        // point of this line is that the crawl re-ran after the operator
        // advanced the clock, and a row stamped 10:00 on the base day would
        // hide exactly the thing a reviewer came to see.
        ts: brief.fetchedAt,
        actor: actorName(actor),
        role: actorAuditRole(actor),
        // The verb distinguishes the first crawl from a refresh, because the
        // thing worth being able to see in the trail is that the 24-hour cycle
        // actually fired — not merely that a brief exists.
        verb: previous ? 'UNIVERSITY BRIEF REFRESHED' : 'UNIVERSITY BRIEF RECORDED',
        remarks: `${note ? `${note} — ` : ''}${brief.university} · revision ${
          brief.revision
        } · ${brief.sources.length} source(s)${
          adverse ? `, ${adverse} adverse` : ''
        } · corpus ${brief.coverage}${
          previous
            ? ` · previous stamp ${previous.fetchedAt} (${Math.round(
                (new Date(brief.fetchedAt).getTime() - new Date(previous.fetchedAt).getTime()) /
                  3_600_000,
              )}h earlier)`
            : ''
        }${actorSuffix(actor)}`,
      })
      return true
    })
  },

  /** §16.3 — the reduction that keeps the two surfaces honest. This function
   *  DISPATCHES; it holds no mutation logic of its own. */
  emitJourneyEvent: (e) => {
    const st = get()
    // Idempotency: a double-tap, a browser back, a retried handoff — all no-ops.
    if (st.journeyKeys.includes(e.idempotencyKey)) return
    set((s) => ({
      journeyEvents: [e, ...s.journeyEvents],
      journeyKeys: [...s.journeyKeys, e.idempotencyKey],
    }))

    const p = e.payload as Record<string, never> & Record<string, unknown>
    switch (e.type) {
      case 'CONSENT_GRANTED':
        st.grantConsent(e.appId, p.consentType as ConsentType, e.actor)
        break
      case 'CONSENT_REQUESTED':
        st.requestConsent(e.appId, p.consentType as ConsentType, e.actor)
        break
      case 'CONSENT_DECLINED':
        st.declineConsent(
          e.appId,
          p.consentType as ConsentType,
          String(p.reason ?? 'declined by the customer'),
          e.actor,
        )
        break
      case 'CONSENT_REVOKED':
        st.revokeConsent(e.appId, p.consentType as ConsentType, e.actor)
        break
      case 'DOCUMENT_UPLOADED':
      case 'DOCUMENT_REPLACED':
        st.uploadDocument(e.appId, String(p.docId), {
          fileName: String(p.fileName ?? 'upload'),
          sizeKb: Number(p.sizeKb ?? 0),
          actor: e.actor,
          replaced: e.type === 'DOCUMENT_REPLACED',
        })
        break
      case 'EXTRACTION_CONFIRMED':
        st.confirmExtraction(
          e.appId,
          String(p.docId),
          (p.fields as Record<string, string | number>) ?? {},
          e.actor,
        )
        break
      case 'APPLICATION_SUBMITTED':
        // Same FORWARD_GATES as an Ops officer clicking move-forward.
        st.moveForward(e.appId, e.actor)
        break
      case 'COAPPLICANT_JOINED':
      case 'COLLATERAL_JOINED':
        st.joinJourneyParty(
          e.appId,
          {
            role: e.type === 'COAPPLICANT_JOINED' ? 'co_applicant' : 'collateral_provider',
            name: String(p.name),
            relationship: String(p.relationship ?? ''),
            partyId: String(p.partyId),
          },
          e.actor,
        )
        break
      case 'TRANCHE_REQUESTED':
        // Queues for releaseTranche — never releases.
        st.requestTranche(e.appId, String(p.trancheId), e.actor)
        break
      case 'WITHDRAWAL_REQUESTED':
        st.withdrawApplication(e.appId, String(p.code ?? 'WD-03'), String(p.remarks ?? 'Requested by the customer'))
        break
      case 'DOCUMENT_CAPTURE_REJECTED':
        st.recordJourneyMilestone(
          e.appId,
          'CAPTURE REJECTED',
          `${p.docLabel} — ${p.reason}`,
          e.actor,
        )
        break
      default:
        // Everything else is a milestone: audited, with a targeted patch the
        // caller supplied through recordJourneyMilestone directly.
        break
    }
  },

  revalidate: (appId) => {
    const { role, pushToast } = get()
    mutate(set, appId, (app) => {
      app.stage = 'S10'
      app.status = 'in_progress'
      app.stageEnteredAt = NOW_ISO
      app.sanctionDate = undefined
      app.sanctionExpiryDate = undefined
      audit(app, { actor: officerOf(role), role, verb: 'REVALIDATE', toStage: 'S10', remarks: 'Sanction lapsed — sent back to S10 for revalidation' })
      pushToast('success', `${app.appId} sent to S10 for revalidation.`)
      return true
    })
  },
}))

// Immutable-ish helper: clone the target app, run the mutator, replace in array.
function mutate(
  set: (fn: (st: State & Actions) => Partial<State & Actions>) => void,
  appId: string,
  fn: (app: Application) => boolean,
): void {
  set((st) => {
    const idx = st.applications.findIndex((a) => a.appId === appId)
    if (idx < 0) return {}
    const clone: Application = structuredClone(st.applications[idx])
    const changed = fn(clone)
    if (!changed) return {}
    const arr = st.applications.slice()
    arr[idx] = clone
    return { applications: arr }
  })
}

/** Batch sibling of mutate(): clones ONLY the applications the mutator actually
 *  changes and issues a SINGLE set(). Without this a 200-app automation sweep
 *  would fire 200 separate re-renders. Returns how many changed. */
function mutateMany(
  set: (fn: (st: State & Actions) => Partial<State & Actions>) => void,
  appIds: string[],
  fn: (app: Application) => boolean,
): number {
  let changed = 0
  set((st) => {
    const targets = new Set(appIds)
    const arr = st.applications.map((a) => {
      if (!targets.has(a.appId)) return a
      const clone: Application = structuredClone(a)
      if (!fn(clone)) return a
      changed++
      return clone
    })
    return changed > 0 ? { applications: arr } : {}
  })
  return changed
}

// ---- Automation action appliers -------------------------------------------
function officerNameOf(id: string): string {
  return OFFICER_BY_ID[id]?.name ?? id
}

function fmtDateTimeSafe(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Apply one NON-destructive rule action to an application clone. */
function applyAction(app: Application, p: PlannedAction, now: string): void {
  const a = p.action
  switch (a.kind) {
    case 'comm':
    case 'nudge': {
      const tpl = a.templateId ? COMM_TEMPLATE_BY_ID[a.templateId] : undefined
      const channel = a.channel ?? tpl?.channel ?? 'WhatsApp'
      const subject = tpl?.subject ?? a.label
      const body = tpl
        ? tpl.render({
            student: app.studentName,
            appId: app.appId,
            docs: app.documents.filter((d) => d.status === 'requested').map((d) => d.label).slice(0, 4).join(', ') || 'the pending items',
            doc: app.documents.find((d) => d.status === 'rejected')?.label ?? 'the pending document',
            validity: app.sanctionExpiryDate ? new Date(app.sanctionExpiryDate).toDateString() : '',
            stamp: 'automated',
            n: 1,
            payee: 'the university',
          })
        : a.label
      app.comms = [
        {
          id: uid('C'), ts: now, channel, templateId: a.templateId ?? 'auto',
          subject, body, auto: true, direction: 'outbound', status: 'sent',
          actor: 'System', ruleId: p.ruleId,
        },
        ...app.comms,
      ]
      if (app.blocker.kind === 'none') {
        app.blocker = { kind: 'customer', detail: `customer: awaiting response to "${subject}"` }
      }
      audit(app, { actor: 'System', role: 'Admin', verb: 'AUTO-RULE FIRED', reasonCode: p.ruleId, remarks: `${a.label} (${channel})` })
      break
    }
    case 'reassign': {
      const dept = a.toDepartment ?? app.owner.department
      const pool = officersOf(dept)
      const target =
        (a.toTitle ? pool.find((o) => o.title.toLowerCase().includes(a.toTitle!.toLowerCase())) : undefined) ??
        pool[0]
      if (target) {
        app.owner = { department: dept, officer: target.name, officerId: target.id }
        app.assignment = { ...app.assignment, officerId: target.id, assignedAt: now, escalationLevel: 0 }
        audit(app, { actor: 'System', role: 'Admin', verb: 'AUTO-RULE FIRED', reasonCode: p.ruleId, remarks: `${a.label} → ${target.name}` })
      }
      break
    }
    case 'escalate': {
      const rung = rungFor(app, 9999) // highest applicable rung for a forced escalation
      const target = rung ? escalationTarget(app, rung) : null
      app.assignment.escalationLevel = Math.max(app.assignment.escalationLevel, 1)
      app.assignment.lastEscalatedAt = now
      audit(app, {
        actor: 'System', role: 'Admin', verb: 'AUTO-RULE FIRED', reasonCode: p.ruleId,
        remarks: `${a.label}${target ? ` → ${target.name}` : ''}`,
      })
      break
    }
    case 'flag': {
      if (a.blockerKind) app.blocker = { kind: a.blockerKind, detail: `${a.label} (auto-flagged by ${p.ruleId})` }
      audit(app, { actor: 'System', role: 'Admin', verb: 'AUTO-RULE FIRED', reasonCode: p.ruleId, remarks: a.label })
      break
    }
    case 'request_docs': {
      audit(app, { actor: 'System', role: 'Admin', verb: 'AUTO-RULE FIRED', reasonCode: p.ruleId, remarks: a.label })
      break
    }
  }
}

/** Close an application into a terminal state with structured forensics. */
function closeApplication(
  app: Application,
  kind: ClosureKind,
  code: string,
  by: string,
  byRole: RoleId,
  detail: string,
  now: string,
): void {
  const priorStage = app.stage
  app.stage = kind === 'rejected' ? 'REJECTED' : kind === 'withdrawn' ? 'WITHDRAWN' : 'EXPIRED'
  app.status = 'rejected'
  app.stageEnteredAt = now
  app.stageHistory = [...app.stageHistory, { stage: app.stage, enteredAt: now }]
  if (kind === 'rejected') app.rejectionCode = code
  app.outcome = {
    kind,
    code,
    label: CODE_LABEL[code] ?? code,
    stageAtClosure: priorStage,
    closedAt: now,
    decidedBy: by,
    decidedByRole: byRole,
    department: app.owner.department,
    branchId: app.branchId,
    daysToClosure: Math.max(0, Math.round((Date.parse(now) - Date.parse(app.createdAt)) / 86_400_000)),
    askInr: app.askInr,
    detail,
  }
  audit(app, { actor: by, role: byRole, verb: `CLOSED — ${kind.toUpperCase()}`, fromStage: String(priorStage), toStage: app.stage, reasonCode: code, remarks: detail })
}

/** Apply an approved DESTRUCTIVE automation action. */
function applyDestructive(
  app: Application,
  ev: AutomationEvent,
  by: string,
  byRole: RoleId,
  now: string,
): void {
  const a = ev.action
  switch (a.kind) {
    case 'close':
      closeApplication(app, 'expired', a.closureCode ?? 'EXP-01', by, byRole, `Auto-rule ${ev.ruleId} approved: ${a.label}`, now)
      break
    case 'withdraw':
      closeApplication(app, 'withdrawn', a.closureCode ?? 'WD-01', by, byRole, `Auto-rule ${ev.ruleId} approved: ${a.label}`, now)
      break
    case 'reject':
      closeApplication(app, 'rejected', a.closureCode ?? 'REJ-07', by, byRole, `Auto-rule ${ev.ruleId} approved: ${a.label}`, now)
      break
    case 'hold':
      app.status = 'on_hold'
      audit(app, { actor: by, role: byRole, verb: 'HOLD (automation)', reasonCode: a.holdCode ?? 'HLD-04', remarks: a.label })
      break
  }
}

/** Deterministic masked contact details — the prototype has no real PII. */
function maskPhone(appId: string): string {
  const n = appId.replace(/\D/g, '').slice(-3).padStart(3, '0')
  return `+91-98•••••${n}`
}
function maskEmail(name: string): string {
  const first = name.split(' ')[0].toLowerCase()
  return `${first[0]}•••@gmail.com`
}

function buildComm(
  app: Application,
  i: { channel: CommChannel; templateId?: string; subject: string; body: string },
  role: RoleId,
): CommEvent {
  return {
    id: uid('C'),
    ts: nowIso(),
    channel: i.channel,
    templateId: i.templateId ?? 'manual',
    subject: i.subject,
    body: i.body,
    auto: false,
    direction: 'outbound',
    status: i.channel === 'Email' ? 'delivered' : 'sent',
    actor: officerOf(role),
    role,
    to: i.channel === 'Email' ? maskEmail(app.studentName) : maskPhone(app.appId),
  }
}

// ---- §v4 journey actor → audit line (§16.4) -------------------------------
// The audit trail must be able to answer "who actually clicked this". These
// three helpers flatten the actor block into readable text:
//
//   "Priya Sharma (co-applicant) granted Account Aggregator consent
//    via link issued by R. Iyer"

const ACTOR_ROLE_LABEL: Record<string, AuditRole> = {
  applicant: 'Applicant',
  co_applicant: 'Co-applicant',
  collateral_provider: 'Collateral provider',
  system: 'System',
}

function actorAuditRole(a: JourneyActor): AuditRole {
  if (a.kind === 'rm') return OFFICER_BY_ID[a.officerId ?? '']?.role ?? 'Sales'
  if (a.kind === 'back_office') return 'Ops'
  return ACTOR_ROLE_LABEL[a.kind] ?? 'System'
}

function actorName(a: JourneyActor): string {
  if (a.kind === 'rm') return OFFICER_BY_ID[a.officerId ?? '']?.name ?? 'Officer'
  if (a.kind === 'system') return 'System'
  return a.name ?? ACTOR_ROLE_LABEL[a.kind] ?? 'Customer'
}

/** The " via …" tail that names the other human involved, when there is one. */
function actorSuffix(a: JourneyActor): string {
  if (a.viaHandoff) {
    const officer = OFFICER_BY_ID[a.officerId ?? '']?.name
    return officer
      ? ` — via a link issued by ${officer}`
      : ' — via a handoff link'
  }
  if (a.kind === 'rm' && a.onBehalfOf) {
    return ` — entered by ${actorName(a)} on behalf of the ${a.onBehalfOf.replace('_', '-')}`
  }
  return ''
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

// ---- Derived selectors ------------------------------------------------------
export function selectApp(appId: string | null): Application | undefined {
  if (!appId) return undefined
  return useStore.getState().applications.find((a) => a.appId === appId)
}

export function addNote(appId: string, body: string): void {
  const role = useStore.getState().role
  const mentions = Array.from(body.matchAll(/@([\w.\s]+?)(?=[,.]|$|@)/g)).map((m) => m[1].trim())
  useStore.setState((st) => {
    const arr = st.applications.map((a) => {
      if (a.appId !== appId) return a
      const note: Note = { id: uid('N'), ts: NOW_ISO, author: officerOf(role), role, body, mentions }
      return { ...a, notes: [note, ...a.notes] }
    })
    return { applications: arr }
  })
}

export type { State, Actions }
export { ROLE_BY_ID }
export type { IntegrationCall }
