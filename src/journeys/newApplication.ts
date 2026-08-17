// ============================================================================
// New application builder (§0.2) — applications created through a journey.
//
// `src/data/seed.ts`'s 14 literals (APP-2601…APP-2614) stay untouched, and the
// bulk seed occupies APP-2701…APP-2900. Journey-created applications are placed
// clear of both — see the note on JOURNEY_APP_FLOOR below.
//
// This file materialises a genuinely EMPTY file: every document `requested`,
// every consent `not_requested`, validations `pending` from S01. Nothing is
// pre-verified — the whole point is watching it fill up.
// ============================================================================
import type {
  Application,
  Assignment,
  Channel,
  DocumentBucket,
  DocumentItem,
  Intake,
  Party,
  Tier,
} from '@/types'
import { generateBuckets, generateDocuments } from '@/data/buckets'
import { buildConsents } from '@/data/consents'
import { buildValidations } from '@/data/seedHelpers'
import { POLICY } from '@/data/policy'
import { DEFAULT_BRANCH_ID, OFFICER_BY_ID, PRIMARY_OFFICER } from '@/data/org'
import { nowIso } from '@/lib/clock'
import { registerJourneyReset } from '@/journeys/resetRegistry'

// ---------------------------------------------------------------------------
// Where journey-created applications start (§0.2).
//
// ⚠ DEVIATION FROM THE BUILD SPEC, deliberate and load-bearing.
//
// The spec says new applications "start at APP-2801 so they can collide with
// neither the curated 14 nor the bulk 27xx range". The bulk seed is not a 27xx
// range: `buildBulkSeed()` generates 200 applications from APP-2701, so it runs
// to **APP-2900**. APP-2801 is therefore an existing seeded application, and
// creating a journey file there produced a duplicate id — verified in the
// browser, where the new file silently resolved to a REJECTED bulk record.
//
// The spec's INTENT ("collide with neither") is what matters, so the floor is
// kept at 2801 and then pushed clear of whatever the seed actually occupies.
// Computing it from live state rather than hardcoding a number means a future
// change to the bulk seed size can never reintroduce this.
// ---------------------------------------------------------------------------

/** The floor the spec asks for. The effective start is this or higher. */
export const JOURNEY_APP_FLOOR = 2801

let _journeyAppSeq = 0

/** §18 — a module-global counter, so it must reset with the demo. */
export function resetJourneyAppSeq(): void {
  _journeyAppSeq = 0
}
registerJourneyReset(resetJourneyAppSeq)

/** The first id a journey application may take, given what already exists. */
export function journeyAppStart(existingIds: string[]): number {
  let max = JOURNEY_APP_FLOOR - 1
  for (const id of existingIds) {
    const n = Number(id.slice(4))
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

export function nextJourneyAppId(existingIds: string[]): string {
  const id = `APP-${journeyAppStart(existingIds) + _journeyAppSeq}`
  _journeyAppSeq += 1
  return id
}

export interface NewApplicationSpec {
  studentName: string
  university: string
  universityShort: string
  program: string
  programLevel: Application['programLevel']
  programStartDate: string
  intake: Intake
  channel: Channel
  askInr: number
  tier: Tier
  overlayBasis?: Application['overlayBasis']
  overlayCeilingInr?: number
  incomeBranch: 'salaried' | 'self_employed'
  nriOverlay: boolean
  securedConstruct: boolean
  /** Named once the student adds them at CJ-11; a placeholder until then. */
  coApplicantName?: string
  branchId?: string
  /** Set on the assisted path so the file lands with its originating officer. */
  officerId?: string
}

export function buildJourneyApplication(spec: NewApplicationSpec, appId: string): Application {
  const now = nowIso()
  const profile = {
    incomeBranch: spec.incomeBranch,
    nriOverlay: spec.nriOverlay,
    securedConstruct: spec.securedConstruct,
  }
  const buckets: DocumentBucket[] = generateBuckets(profile)
  // Everything starts `requested`. A journey file has collected nothing yet.
  const documents: DocumentItem[] = generateDocuments(buckets, 'requested')

  // The owner's NAME and officerId must describe the same person. Resolving the
  // id and falling back to the primary Sales officer keeps them in step — an
  // earlier version set the id from the spec but always wrote P. Shah's name,
  // so a file captured by any other officer was owned by two different people
  // depending on which field you read.
  const officer = (spec.officerId ? OFFICER_BY_ID[spec.officerId] : undefined) ?? PRIMARY_OFFICER.Sales
  const branchId = spec.branchId ?? officer.branchId ?? DEFAULT_BRANCH_ID

  const parties: Party[] = [
    {
      id: `${appId}-A`,
      role: 'applicant',
      name: spec.studentName,
      kycStatus: 'not_started',
      bucketIds: buckets.filter((b) => b.section === 'applicant').map((b) => b.id),
    },
  ]
  if (spec.coApplicantName) {
    parties.push({
      id: `${appId}-C`,
      role: 'co_applicant',
      name: spec.coApplicantName,
      kycStatus: 'not_started',
      bucketIds: buckets.filter((b) => b.section === 'co_applicant').map((b) => b.id),
    })
  }

  const assignment: Assignment = {
    officerId: officer.id,
    assignedAt: now,
    slaHours: POLICY.assignmentSlaHours,
    escalationLevel: 0,
  }

  return {
    appId,
    studentName: spec.studentName,
    university: spec.university,
    universityShort: spec.universityShort,
    program: spec.program,
    programLevel: spec.programLevel,
    programStartDate: spec.programStartDate,
    intake: spec.intake,
    channel: spec.channel,
    askInr: spec.askInr,
    tier: spec.tier,
    overlayBasis: spec.overlayBasis,
    overlayCeilingInr: spec.overlayCeilingInr,

    stage: 'S01',
    status: 'in_progress',
    owner: {
      department: officer.department,
      officer: officer.name,
      officerId: officer.id,
    },
    // A brand-new file is waiting on the customer to finish their own capture.
    blocker: { kind: 'customer', detail: 'customer: application in progress' },

    branchId,
    assignment,
    createdAt: now,
    stageEnteredAt: now,
    stageHistory: [{ stage: 'S01', enteredAt: now }],
    lastCustomerActivityAt: now,

    incomeBranch: spec.incomeBranch,
    nriOverlay: spec.nriOverlay,
    securedConstruct: spec.securedConstruct,

    parties,
    buckets,
    documents,
    // Nothing has been asked for yet — the journey requests each consent at the
    // point it actually needs it.
    consents: buildConsents(appId, parties, now, undefined, 0),
    extracted: [],
    // `pendingFrom: 'S01'` leaves every rule triggered after S01 as `pending`,
    // which gating.isResolved() treats correctly (a rule the file has not
    // reached is not a failure).
    validations: buildValidations({}, 'S01', {
      university: spec.university,
      program: spec.program,
      programLevel: spec.programLevel,
      incomeBranch: spec.incomeBranch,
    }),
    deviations: [],
    covenants: [],
    tranches: [],
    audit: [],
    comms: [],
    integrations: [],
    notes: [],
    lanes: {
      applicant: [
        { node: 'kyc', label: 'KYC', status: 'not_started' },
        { node: 'docs', label: 'Documents', status: 'not_started' },
        { node: 'verification', label: 'Verification', status: 'not_started' },
      ],
      coApplicant: [
        { node: 'kyc', label: 'KYC', status: 'not_started' },
        { node: 'docs', label: 'Documents', status: 'not_started' },
        { node: 'bureau', label: 'Bureau', status: 'not_started' },
      ],
      collateral: spec.securedConstruct
        ? [
            { node: 'c1', label: 'C1 KYC & net worth', status: 'not_started' },
            { node: 'c2', label: 'C2 Title / asset', status: 'not_started' },
            { node: 'c3', label: 'C3 Legal & valuation', status: 'not_started' },
            { node: 'c4', label: 'C4 Charge creation', status: 'not_started' },
          ]
        : null,
    },
  }
}
