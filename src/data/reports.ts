// ============================================================================
// Standard report catalogue (§v2 req 7).
// Each report turns the in-memory portfolio into a flat table that can be
// previewed, exported to CSV, or printed to PDF.
// ============================================================================
import type {
  Application, DocumentBucket, DocumentItem, PartySection, SourcingMode,
} from '@/types'
import { BRANCH_BY_ID, OFFICER_BY_ID, resolveOfficer } from '@/data/org'
import { ALL_VALIDATIONS } from '@/data/validations'
import { MODE_LABEL, sourceLabel } from '@/data/sources'
import { consentLabel } from '@/data/consents'
import { SECTION_LABEL } from '@/data/buckets'
import { STAGE_NAME } from '@/data/stages'
import { CODE_LABEL } from '@/data/reasonCodes'
import { daysInStage, fmtDate, inr } from '@/lib/format'
import { slaStateOf } from '@/lib/filters'
import { hoursSince } from '@/lib/clock'
import {
  branchRollup, closureRollup, funnelRollup, isTerminalStage, slaRollup,
  stageValueRollup, tatRollup,
} from '@/lib/reports'

export interface ReportColumn {
  key: string
  header: string
  align?: 'left' | 'right'
  get: (row: any) => string | number
  csv?: (row: any) => string | number
}

export interface ReportTable {
  columns: ReportColumn[]
  rows: any[]
  totals?: Record<string, string | number>
  subtitle?: string
}

export type ReportGroup = 'Operations' | 'Credit' | 'Risk' | 'Portfolio'

export interface ReportDef {
  id: string
  title: string
  description: string
  group: ReportGroup
  build: (apps: Application[]) => ReportTable
}

const num = (n: number) => n // csv gets the raw number, screen gets formatted

export const REPORT_DEFS: ReportDef[] = [
  // ---- Operations ---------------------------------------------------------
  {
    id: 'stage-register',
    title: 'Stage register',
    description: 'Every application with its current stage, owner, ageing and value. The operational worklist of record.',
    group: 'Operations',
    build: (apps) => ({
      subtitle: `${apps.length} applications`,
      columns: [
        { key: 'appId', header: 'APP ID', get: (r) => r.appId },
        { key: 'student', header: 'Student', get: (r) => r.studentName },
        { key: 'university', header: 'University', get: (r) => r.university },
        { key: 'program', header: 'Program', get: (r) => r.program },
        { key: 'stage', header: 'Stage', get: (r) => `${r.stage} — ${STAGE_NAME[r.stage] ?? ''}` },
        { key: 'status', header: 'Status', get: (r) => r.status },
        { key: 'blocker', header: 'Blocker', get: (r) => r.blocker.kind },
        { key: 'days', header: 'Days in stage', align: 'right', get: (r) => daysInStage(r.stageEnteredAt) },
        { key: 'branch', header: 'Branch', get: (r) => BRANCH_BY_ID[r.branchId]?.name ?? r.branchId },
        { key: 'city', header: 'City', get: (r) => BRANCH_BY_ID[r.branchId]?.city ?? '' },
        { key: 'owner', header: 'Owner', get: (r) => r.owner.officer },
        { key: 'dept', header: 'Department', get: (r) => r.owner.department },
        { key: 'channel', header: 'Channel', get: (r) => r.channel },
        { key: 'tier', header: 'Tier', get: (r) => r.tier },
        { key: 'ask', header: 'Ask (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
      ],
      rows: apps,
      totals: { appId: 'TOTAL', student: `${apps.length} files`, ask: apps.reduce((t, a) => t + a.askInr, 0) },
    }),
  },
  {
    id: 'stage-summary',
    title: 'Stage summary',
    description: 'Count, exposure and median ageing per stage — the "₹ at each stage" view.',
    group: 'Operations',
    build: (apps) => {
      const rows = stageValueRollup(apps)
      return {
        subtitle: 'Open pipeline by stage',
        columns: [
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'name', header: 'Stage name', get: (r) => r.name },
          { key: 'count', header: 'Applications', align: 'right', get: (r) => r.count },
          { key: 'value', header: 'Value (INR)', align: 'right', get: (r) => inr(r.valueInr), csv: (r) => num(r.valueInr) },
          { key: 'median', header: 'Median days', align: 'right', get: (r) => r.medianDays },
          { key: 'blocked', header: 'Blocked', align: 'right', get: (r) => r.blocked },
        ],
        rows,
        totals: {
          stage: 'TOTAL',
          count: rows.reduce((t, r) => t + r.count, 0),
          value: rows.reduce((t, r) => t + r.valueInr, 0),
          blocked: rows.reduce((t, r) => t + r.blocked, 0),
        },
      }
    },
  },
  {
    id: 'tat-report',
    title: 'TAT report',
    description: 'Median and p90 turnaround per stage, derived from recorded stage-entry timestamps.',
    group: 'Operations',
    build: (apps) => {
      const rows = tatRollup(apps)
      return {
        subtitle: 'Turnaround time per stage (days)',
        columns: [
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'name', header: 'Stage name', get: (r) => r.name },
          { key: 'median', header: 'Median days', align: 'right', get: (r) => r.median },
          { key: 'p90', header: 'p90 days', align: 'right', get: (r) => r.p90 },
          { key: 'n', header: 'Observations', align: 'right', get: (r) => r.n },
        ],
        rows,
      }
    },
  },
  {
    id: 'doc-pendency',
    title: 'Document pendency',
    description: 'Applications with outstanding document requests, and how many items are still awaited.',
    group: 'Operations',
    build: (apps) => {
      const rows = apps
        .filter((a) => !isTerminalStage(a.stage))
        .map((a) => ({
          ...a,
          pending: a.documents.filter((d) => d.status === 'requested').length,
          rejectedDocs: a.documents.filter((d) => d.status === 'rejected').length,
        }))
        .filter((r) => r.pending > 0 || r.rejectedDocs > 0)
        .sort((a, b) => b.pending - a.pending)
      return {
        subtitle: `${rows.length} applications with outstanding documents`,
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.studentName },
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'blocker', header: 'Blocker', get: (r) => r.blocker.kind },
          { key: 'pending', header: 'Docs requested', align: 'right', get: (r) => r.pending },
          { key: 'rejectedDocs', header: 'Docs rejected', align: 'right', get: (r) => r.rejectedDocs },
          { key: 'days', header: 'Days in stage', align: 'right', get: (r) => daysInStage(r.stageEnteredAt) },
          { key: 'owner', header: 'Owner', get: (r) => r.owner.officer },
          { key: 'ask', header: 'Ask (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
        ],
        rows,
        totals: { appId: 'TOTAL', pending: rows.reduce((t, r) => t + r.pending, 0) },
      }
    },
  },

  // ---- Portfolio ----------------------------------------------------------
  {
    id: 'funnel-report',
    title: 'Funnel report',
    description: 'How far applications reach, by count and exposure, with stage-on-stage drop-off.',
    group: 'Portfolio',
    build: (apps) => {
      const rows = funnelRollup(apps)
      return {
        subtitle: 'Reach and drop-off across S01–S13',
        columns: [
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'name', header: 'Stage name', get: (r) => r.name },
          { key: 'count', header: 'Reached', align: 'right', get: (r) => r.count },
          { key: 'value', header: 'Value (INR)', align: 'right', get: (r) => inr(r.valueInr), csv: (r) => num(r.valueInr) },
          { key: 'pct', header: '% of intake', align: 'right', get: (r) => `${r.pctReached}%`, csv: (r) => r.pctReached },
          { key: 'drop', header: 'Drop-off %', align: 'right', get: (r) => (r.dropOff == null ? '—' : `${r.dropOff}%`), csv: (r) => r.dropOff ?? '' },
        ],
        rows,
      }
    },
  },
  {
    id: 'branch-productivity',
    title: 'Branch productivity',
    description: 'Volume, exposure and ageing by branch — the batch view in tabular form.',
    group: 'Portfolio',
    build: (apps) => {
      const rows = branchRollup(apps)
      return {
        subtitle: `${rows.length} branches`,
        columns: [
          { key: 'branch', header: 'Branch', get: (r) => r.branch },
          { key: 'city', header: 'City', get: (r) => r.city },
          { key: 'region', header: 'Region', get: (r) => r.region },
          { key: 'count', header: 'Applications', align: 'right', get: (r) => r.count },
          { key: 'open', header: 'Open', align: 'right', get: (r) => r.open },
          { key: 'closed', header: 'Closed', align: 'right', get: (r) => r.closed },
          { key: 'median', header: 'Median days', align: 'right', get: (r) => r.medianDays },
          { key: 'value', header: 'Value (INR)', align: 'right', get: (r) => inr(r.valueInr), csv: (r) => num(r.valueInr) },
        ],
        rows,
        totals: {
          branch: 'TOTAL',
          count: rows.reduce((t, r) => t + r.count, 0),
          open: rows.reduce((t, r) => t + r.open, 0),
          closed: rows.reduce((t, r) => t + r.closed, 0),
          value: rows.reduce((t, r) => t + r.valueInr, 0),
        },
      }
    },
  },
  {
    id: 'sanction-expiry',
    title: 'Sanction-expiry watchlist',
    description: 'Sanctioned files inside the 180-day validity window, nearest expiry first.',
    group: 'Portfolio',
    build: (apps) => {
      const rows = apps
        .filter((a) => a.sanctionExpiryDate)
        .map((a) => ({ ...a, daysLeft: Math.round((new Date(a.sanctionExpiryDate!).getTime() - Date.parse('2026-07-20T10:00:00.000Z')) / 86400000) }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
      return {
        subtitle: `${rows.length} sanctioned files`,
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.studentName },
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'sanctionDate', header: 'Sanctioned', get: (r) => fmtDate(r.sanctionDate) },
          { key: 'expiry', header: 'Expires', get: (r) => fmtDate(r.sanctionExpiryDate) },
          { key: 'daysLeft', header: 'Days left', align: 'right', get: (r) => r.daysLeft },
          { key: 'owner', header: 'Owner', get: (r) => r.owner.officer },
          { key: 'ask', header: 'Ask (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
        ],
        rows,
        totals: { appId: 'TOTAL', ask: rows.reduce((t, r) => t + r.askInr, 0) },
      }
    },
  },

  // ---- Credit -------------------------------------------------------------
  {
    id: 'closure-report',
    title: 'Rejection & closure report',
    description: 'Every closed file: when in the journey it died, why, and who decided.',
    group: 'Credit',
    build: (apps) => {
      const rows = apps.filter((a) => a.outcome)
      return {
        subtitle: `${rows.length} closed files`,
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.studentName },
          { key: 'kind', header: 'Closure type', get: (r) => r.outcome.kind },
          { key: 'code', header: 'Code', get: (r) => r.outcome.code },
          { key: 'reason', header: 'Reason', get: (r) => r.outcome.label },
          { key: 'stageAt', header: 'Stage at closure', get: (r) => r.outcome.stageAtClosure },
          { key: 'decidedBy', header: 'Decided by', get: (r) => r.outcome.decidedBy },
          { key: 'dept', header: 'Department', get: (r) => r.outcome.department },
          { key: 'branch', header: 'Branch', get: (r) => BRANCH_BY_ID[r.branchId]?.name ?? r.branchId },
          { key: 'days', header: 'Days to closure', align: 'right', get: (r) => r.outcome.daysToClosure },
          { key: 'closedAt', header: 'Closed on', get: (r) => fmtDate(r.outcome.closedAt) },
          { key: 'ask', header: 'Value (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
        ],
        rows,
        totals: { appId: 'TOTAL', student: `${rows.length} files`, ask: rows.reduce((t, r) => t + r.askInr, 0) },
      }
    },
  },
  {
    id: 'closure-reasons',
    title: 'Closure reason analysis',
    description: 'Pareto of closure reasons with exposure and median time-to-close.',
    group: 'Credit',
    build: (apps) => {
      const rows = closureRollup(apps)
      return {
        subtitle: 'Grouped by reason code',
        columns: [
          { key: 'code', header: 'Code', get: (r) => r.code },
          { key: 'kind', header: 'Type', get: (r) => r.kind },
          { key: 'label', header: 'Reason', get: (r) => r.label },
          { key: 'count', header: 'Files', align: 'right', get: (r) => r.count },
          { key: 'value', header: 'Value (INR)', align: 'right', get: (r) => inr(r.valueInr), csv: (r) => num(r.valueInr) },
          { key: 'median', header: 'Median days to close', align: 'right', get: (r) => r.medianDaysToClose },
        ],
        rows,
        totals: {
          code: 'TOTAL',
          count: rows.reduce((t, r) => t + r.count, 0),
          value: rows.reduce((t, r) => t + r.valueInr, 0),
        },
      }
    },
  },
  {
    id: 'deviation-covenant',
    title: 'Deviations & covenants',
    description: 'Open deviations and covenants by application, with approval level and clearing gate.',
    group: 'Credit',
    build: (apps) => {
      const rows: any[] = []
      for (const a of apps) {
        for (const d of a.deviations) {
          rows.push({ appId: a.appId, student: a.studentName, kind: 'Deviation', ref: d.defId, title: d.title, status: d.status, extra: d.approvalLevel, askInr: a.askInr })
        }
        for (const c of a.covenants) {
          rows.push({ appId: a.appId, student: a.studentName, kind: 'Covenant', ref: c.defId, title: c.title, status: c.status, extra: c.clearBy, askInr: a.askInr })
        }
      }
      return {
        subtitle: `${rows.length} items`,
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.student },
          { key: 'kind', header: 'Type', get: (r) => r.kind },
          { key: 'ref', header: 'Code', get: (r) => r.ref },
          { key: 'title', header: 'Description', get: (r) => r.title },
          { key: 'status', header: 'Status', get: (r) => r.status },
          { key: 'extra', header: 'Approval / clear by', get: (r) => r.extra },
          { key: 'ask', header: 'Value (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
        ],
        rows,
      }
    },
  },

  // ---- Risk ---------------------------------------------------------------
  {
    id: 'sla-report',
    title: 'SLA & escalation report',
    description: 'Assignment SLA state per open file, hours elapsed and escalation level.',
    group: 'Risk',
    build: (apps) => {
      const open = apps.filter((a) => !isTerminalStage(a.stage))
      const rows = open
        .map((a) => {
          const off = resolveOfficer(a.owner)
          const mgr = off?.managerId ? OFFICER_BY_ID[off.managerId] : null
          return {
            ...a,
            slaState: slaStateOf(a),
            hours: Math.round(hoursSince(a.assignment.assignedAt)),
            manager: mgr?.name ?? '—',
            title: off?.title ?? '—',
          }
        })
        .sort((a, b) => b.hours - a.hours)
      const summary = slaRollup(apps)
      return {
        subtitle: summary.map((s) => `${s.state.replace('_', ' ')}: ${s.count}`).join(' · '),
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.studentName },
          { key: 'stage', header: 'Stage', get: (r) => r.stage },
          { key: 'owner', header: 'Assignee', get: (r) => r.owner.officer },
          { key: 'title', header: 'Role', get: (r) => r.title },
          { key: 'manager', header: 'Escalates to', get: (r) => r.manager },
          { key: 'sla', header: 'SLA state', get: (r) => r.slaState },
          { key: 'hours', header: 'Hours held', align: 'right', get: (r) => r.hours },
          { key: 'level', header: 'Escalation level', align: 'right', get: (r) => r.assignment.escalationLevel },
          { key: 'blocker', header: 'Blocker', get: (r) => r.blocker.kind },
          { key: 'ask', header: 'Value (INR)', align: 'right', get: (r) => inr(r.askInr), csv: (r) => num(r.askInr) },
        ],
        rows,
      }
    },
  },
  {
    id: 'comms-log',
    title: 'Communications log',
    description: 'Every customer communication sent or logged, by channel and outcome.',
    group: 'Operations',
    build: (apps) => {
      const rows: any[] = []
      for (const a of apps) {
        for (const c of a.comms) {
          rows.push({
            appId: a.appId, student: a.studentName, ts: c.ts, channel: c.channel,
            subject: c.subject, direction: c.direction ?? 'outbound',
            status: c.status ?? 'sent', actor: c.actor ?? (c.auto ? 'System' : '—'),
            outcome: c.callOutcome ?? '', body: c.body,
          })
        }
      }
      rows.sort((a, b) => (b.ts > a.ts ? 1 : -1))
      return {
        subtitle: `${rows.length} communications`,
        columns: [
          { key: 'appId', header: 'APP ID', get: (r) => r.appId },
          { key: 'student', header: 'Student', get: (r) => r.student },
          { key: 'ts', header: 'When', get: (r) => fmtDate(r.ts) },
          { key: 'channel', header: 'Channel', get: (r) => r.channel },
          { key: 'direction', header: 'Direction', get: (r) => r.direction },
          { key: 'subject', header: 'Subject', get: (r) => r.subject },
          { key: 'status', header: 'Status', get: (r) => r.status },
          { key: 'outcome', header: 'Call outcome', get: (r) => r.outcome },
          { key: 'actor', header: 'Sent by', get: (r) => r.actor },
        ],
        rows,
      }
    },
  },
]

// ---- §v3: BRD conformance reports ------------------------------------------
REPORT_DEFS.push(
  {
    id: 'brd-traceability',
    title: 'BRD traceability matrix',
    description:
      'Every dashboard validation rule mapped to the BRD rule it implements (BRD-18 V-INT-01–14 → BRD-20 V-INT-15–19 / V-EXT-01–22 → BRD-21 V-INT-20–23 / V-EXT-23). Tick off all 73.',
    group: 'Credit',
    build: () => {
      const rows = ALL_VALIDATIONS
      return {
        subtitle: `${rows.length} rules · ${rows.filter((r) => r.applicability !== 'out_of_scope_us_only').length} evaluating · ${rows.filter((r) => r.applicability === 'out_of_scope_us_only').length} out of scope (USA-only build)`,
        columns: [
          { key: 'brdRef', header: 'BRD rule', get: (r) => r.brdRef ?? '—' },
          { key: 'id', header: 'Dashboard rule', get: (r) => r.id },
          { key: 'tier', header: 'Tier', get: (r) => (r.tier === 'INT' ? 'Tier 1 intra-doc' : r.tier === 'CRS' ? 'Tier 2 cross-doc' : 'Tier 3 external') },
          { key: 'title', header: 'Rule', get: (r) => r.title },
          { key: 'stage', header: 'Trigger stage', get: (r) => r.triggerStage },
          { key: 'severity', header: 'Severity', get: (r) => r.severity },
          { key: 'applicability', header: 'Applicability', get: (r) => (r.applicability ?? 'in_scope').replace(/_/g, ' ') },
        ],
        rows,
      }
    },
  },
  {
    id: 'sourcing-matrix',
    title: 'Document sourcing matrix',
    description:
      'The BRD document checklist, generated from live configuration: every bucket × document × party × digital source × sourcing mode × consent required.',
    group: 'Operations',
    build: (apps) => {
      // The checklist is the same for every application of a given profile, so
      // report it from the widest one rather than repeating it 214 times.
      const widest = apps.reduce<Application | null>(
        (best, a) => (!best || a.documents.length > best.documents.length ? a : best), null,
      )
      const rows: { d: DocumentItem; bucket?: DocumentBucket }[] = (widest?.documents ?? []).map((d) => ({
        d,
        bucket: widest!.buckets.find((b) => b.id === d.bucketId),
      }))
      const byMode = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.d.sourcing] = (acc[r.d.sourcing] ?? 0) + 1
        return acc
      }, {})
      return {
        subtitle: Object.entries(byMode)
          .map(([m, n]) => `${MODE_LABEL[m as SourcingMode] ?? m}: ${n}`)
          .join(' · '),
        columns: [
          { key: 'bucket', header: 'Bucket', get: (r) => r.bucket?.code ?? '' },
          { key: 'bucketTitle', header: 'Bucket name', get: (r) => r.bucket?.title ?? '' },
          { key: 'party', header: 'Party', get: (r) => SECTION_LABEL[(r.bucket?.section ?? 'loan') as PartySection] },
          { key: 'document', header: 'Document', get: (r) => r.d.label },
          { key: 'mandate', header: 'M/C/O', get: (r) => r.d.mandate },
          { key: 'gate', header: 'Required by', get: (r) => r.bucket?.requiredByStage ?? '' },
          { key: 'source', header: 'Digital source', get: (r) => sourceLabel(r.d.sourceSystem) },
          { key: 'mode', header: 'Sourcing mode', get: (r) => MODE_LABEL[r.d.sourcing as SourcingMode] },
          { key: 'consent', header: 'Consent required', get: (r) => (r.d.consentType ? consentLabel(r.d.consentType) : '—') },
        ],
        rows,
        totals: { bucket: 'TOTAL', document: `${rows.length} documents` },
      }
    },
  },
)

export const REPORT_BY_ID: Record<string, ReportDef> = Object.fromEntries(
  REPORT_DEFS.map((r) => [r.id, r]),
)
export const REPORT_GROUPS: ReportGroup[] = ['Operations', 'Credit', 'Risk', 'Portfolio']
