// ============================================================================
// Starting an application (§16.2 APPLICATION_STARTED).
//
// One place, shared by the customer journey (CJ-03) and the assisted journey
// (RM-02 lead conversion), so a file created on behalf of a customer is
// identical to one they created themselves — only the actor differs.
// ============================================================================
import type { Application, Tier } from '@/types'
import type { JourneyActor } from '@/types/journeys'
import type { NewApplicationSpec } from '@/journeys/newApplication'
import { POLICY } from '@/data/policy'

/** Course start used until the student names their intake at CJ-04. */
export const PROGRAM_START_DEFAULT = '2026-08-24T00:00:00.000Z'

/** A draft's opening ask, before the customer has told us anything. Sits in
 *  Tier-3 because at this product's ticket sizes everything does unless the
 *  Premier-PG overlay applies (POLICY.tierBands.note). */
const DRAFT_ASK_INR = 40_00_000

export function draftSpec(studentName: string, officerId?: string, branchId?: string): NewApplicationSpec {
  return {
    studentName,
    university: 'Not chosen yet',
    universityShort: '—',
    program: 'Not chosen yet',
    programLevel: 'Masters',
    programStartDate: PROGRAM_START_DEFAULT,
    intake: 'Fall-2026',
    channel: officerId ? 'Branch' : 'Digital',
    askInr: Math.min(DRAFT_ASK_INR, POLICY.maxTicketInr),
    tier: 'Tier-3' as Tier,
    incomeBranch: 'salaried',
    nriOverlay: false,
    // Security is decided at CJ-07 from the offer, not assumed at the start.
    securedConstruct: false,
    officerId,
    branchId,
  }
}

export function startApplication(i: {
  create: (spec: NewApplicationSpec, actor: JourneyActor) => string
  studentName: string
  actor: JourneyActor
  officerId?: string
  branchId?: string
}): string {
  return i.create(draftSpec(i.studentName, i.officerId, i.branchId), i.actor)
}

/** Is this file still a draft the customer is filling in? */
export function isDraft(app: Application): boolean {
  return app.stage === 'S01' || app.stage === 'S02'
}
