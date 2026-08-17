// ============================================================================
// Seed builders — reduce boilerplate across the 14 applications.
// ============================================================================
import { ACTIVE_VALIDATIONS, VALIDATION_BY_ID, renderMessage } from '@/data/validations'
import { generateBuckets, generateDocuments } from '@/data/buckets'
import { STAGES } from '@/data/stages'
import { defaultDeptForStage } from '@/lib/stateMachine'
import type {
  Application,
  AuditEvent,
  DocumentItem,
  ExtractedField,
  LaneNodeStatus,
  Stage,
  StageId,
  ValidationResult,
} from '@/types'

// Deterministic clock helpers -------------------------------------------------
export function daysAgoIso(days: number, base = '2026-07-20T10:00:00.000Z'): string {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}
export function plusDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

// Back-fill stage history for TAT analytics: each prior stage entered ~gap days
// earlier than the next, ending at stageEnteredAt for the current stage.
export function buildHistory(
  current: Stage,
  stageEnteredAt: string,
  gapDays = 3,
): { stage: string; enteredAt: string }[] {
  const order: StageId[] = STAGES.map((s) => s.id)
  const idx = order.indexOf(current as StageId)
  const history: { stage: string; enteredAt: string }[] = []
  if (idx < 0) {
    // terminal — synthesize a short history up to S10 for analytics
    const synthUpto = current === 'REJECTED' ? 10 : current === 'EXPIRED' ? 4 : 13
    for (let i = 0; i < synthUpto; i++) {
      history.push({ stage: order[i], enteredAt: daysAgoIso((synthUpto - i) * gapDays + 5) })
    }
    history.push({ stage: current, enteredAt: stageEnteredAt })
    return history
  }
  for (let i = 0; i <= idx; i++) {
    const stepsBack = idx - i
    history.push({
      stage: order[i],
      enteredAt: stepsBack === 0 ? stageEnteredAt : daysAgoBefore(stageEnteredAt, stepsBack * gapDays),
    })
  }
  return history
}
function daysAgoBefore(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

// Validation results: default every applicable rule to `pass`, override some.
export interface ValOverride {
  status: ValidationResult['status']
  tokens?: Record<string, string | number>
}
// Generic plausible token bag so PASS messages read naturally (no raw {braces}).
const GENERIC_PASS_TOKENS: Record<string, string | number> = {
  months: 57, duration: 2, coa_year: '$45,000', coa_total: '$90,000',
  language_test: 'IELTS', lang_age: 8, test_type: 'GRE-General', test_age: 2,
  calc: '72.4', decl: '72.0', ask: 'as computed', fx: '84.00', gap: '1',
  years: 30, score: '0.98', relation: 'Father', residency: 'Resident',
  ug_univ: 'recognised institution', regulator: 'UGC', program_level: 'Masters',
  program: 'the program', min: '7.0', university: 'the university', slot: 'Tier-A',
  accreditor: 'AACSB', sevis_id: 'N0012345678', status: 'Unconditional',
  agency: 'WES', coa: 'as stated', city: 'city', sponsor: '0', ref: '84.00',
  income: '2,85,000', foir_m: '62', foir_p: '48', tier: 'Premier-Overlay',
  amt: '40,000', n: '1', agg: 'within policy', pct: '96', company: 'the sponsor',
  regional: 'MSCHE', programmatic: 'AACSB', basis: 'Global-Rank', ceiling: 'ceiling',
}

export interface ValCtx {
  university?: string
  program?: string
  programLevel?: string
  incomeBranch?: 'salaried' | 'self_employed'
}

export function buildValidations(
  overrides: Record<string, ValOverride> = {},
  pendingFrom?: string, // stage id — rules triggered at/after this are pending
  ctx: ValCtx = {},
): ValidationResult[] {
  const passTokens: Record<string, string | number> = {
    ...GENERIC_PASS_TOKENS,
    ...(ctx.university ? { university: ctx.university, ug_univ: ctx.university } : {}),
    ...(ctx.program ? { program: ctx.program } : {}),
    ...(ctx.programLevel ? { program_level: ctx.programLevel } : {}),
    ...(ctx.incomeBranch === 'self_employed' ? { test_type: 'GMAT' } : {}),
  }
  // Out-of-scope rules (non-US country checks) exist for BRD traceability only
  // and never evaluate on an application.
  return ACTIVE_VALIDATIONS.map((def) => {
    const o = overrides[def.id]
    if (o) {
      const msg = o.status === 'fail'
        ? renderMessage(def.failMessage, { ...passTokens, ...o.tokens })
        : renderMessage(def.passMessage, { ...passTokens, ...o.tokens })
      return { catalogueId: def.id, status: o.status, message: msg, tokens: { ...passTokens, ...o.tokens } }
    }
    let status: ValidationResult['status'] = 'pass'
    if (pendingFrom && stageRank(def.triggerStage) > stageRank(pendingFrom)) {
      status = 'pending'
    }
    return {
      catalogueId: def.id,
      status,
      message: status === 'pass' ? renderMessage(def.passMessage, passTokens) : '',
      tokens: passTokens,
    }
  })
}
function stageRank(trigger: string): number {
  const m = trigger.match(/S(\d\d)/)
  return m ? parseInt(m[1], 10) : 99
}

// Documents at a lifecycle: verified through the sanction gate by default, with
// overrides for specific docs (by bucket code or label substring).
export function buildDocs(
  profile: { incomeBranch: 'salaried' | 'self_employed'; nriOverlay: boolean; securedConstruct: boolean },
  defaultStatus: DocumentItem['status'],
  overrides: { match: string; status: DocumentItem['status']; reason?: string; version?: number; waivedBy?: string; validUntil?: string; stale?: boolean }[] = [],
): { buckets: ReturnType<typeof generateBuckets>; documents: DocumentItem[] } {
  const buckets = generateBuckets(profile)
  const documents = generateDocuments(buckets, defaultStatus)
  for (const ov of overrides) {
    for (const d of documents) {
      if (d.bucketId === ov.match || d.label.toLowerCase().includes(ov.match.toLowerCase())) {
        d.status = ov.status
        if (ov.reason) d.reason = ov.reason
        if (ov.version) d.version = ov.version
        if (ov.waivedBy) d.waivedBy = ov.waivedBy
        if (ov.validUntil) d.validUntil = ov.validUntil
        if (ov.stale) d.stale = ov.stale
      }
    }
  }
  return { buckets, documents }
}

// Lanes derived from stage (§4 parallel-track rendering).
export function buildLanes(
  stage: Stage,
  secured: boolean,
  opts?: { coApplicantFailedKyc?: boolean; collateralUpto?: number },
): Application['lanes'] {
  const rank = stageRank(typeof stage === 'string' ? stage : 'S01')
  const done = (afterStage: number): LaneNodeStatus['status'] =>
    rank > afterStage ? 'completed' : rank === afterStage ? 'in_progress' : 'not_started'

  const applicant: LaneNodeStatus[] = [
    { node: 'kyc', label: 'KYC', status: done(3) },
    { node: 'docs', label: 'Documents', status: done(4) },
    { node: 'verification', label: 'Verification', status: done(5) },
  ]
  const coApplicant: LaneNodeStatus[] = [
    { node: 'kyc', label: 'KYC', status: opts?.coApplicantFailedKyc ? 'failed' : done(3) },
    { node: 'docs', label: 'Documents', status: done(4) },
    { node: 'bureau', label: 'Bureau', status: done(6) },
  ]
  if (opts?.coApplicantFailedKyc) {
    coApplicant[0].detail = 'Aadhaar eKYC failed (VAL-EXT-03)'
  }
  let collateral: LaneNodeStatus[] | null = null
  if (secured) {
    const upto = opts?.collateralUpto ?? (rank >= 9 ? 3 : rank >= 7 ? 1 : 0)
    collateral = [
      { node: 'c1', label: 'C1 KYC & net worth', status: upto >= 1 ? 'completed' : 'in_progress' },
      { node: 'c2', label: 'C2 Title / asset', status: upto >= 2 ? 'completed' : upto === 1 ? 'in_progress' : 'not_started' },
      { node: 'c3', label: 'C3 Legal & valuation', status: upto >= 3 ? 'completed' : upto === 2 ? 'in_progress' : 'not_started' },
      { node: 'c4', label: 'C4 Charge creation', status: upto >= 4 ? 'completed' : 'not_started' },
    ]
  }
  return { applicant, coApplicant, collateral }
}

export function mkAudit(
  partial: Omit<AuditEvent, 'id'> & { id?: string },
  idx: number,
): AuditEvent {
  return { id: partial.id ?? `AE-${idx}`, ...partial }
}

// Convenience for extracted-field rows.
export function ef(
  section: ExtractedField['section'],
  group: string,
  label: string,
  entered: string,
  extracted: string,
  match: ExtractedField['match'] = 'pass',
  derived = false,
): ExtractedField {
  return {
    id: `${section}-${label}`.replace(/\W+/g, '-').toLowerCase(),
    section,
    group,
    label,
    enteredValue: entered,
    extractedValue: extracted,
    match,
    derived,
  }
}

export const defaultDept = defaultDeptForStage
export { VALIDATION_BY_ID }
