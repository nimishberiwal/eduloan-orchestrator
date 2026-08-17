// ============================================================================
// Customer-facing status mirror (§11) — support-safe single source of truth.
// Internal reason codes (REJ/SB/DEV) are NEVER exposed in the customer string.
// ============================================================================
import type { Application, Stage } from '@/types'

interface MirrorCtx {
  blockerIsCustomer: boolean
  pendingDocs?: number
  reuploadDoc?: string
  sanctionExpiry?: string
  trancheN?: number
  trancheTotal?: number
  trancheState?: string
  payee?: string
  gate?: string
}

export function customerFacingStatus(app: Application): string {
  const stage: Stage = app.stage
  const blockerIsCustomer = app.blocker.kind === 'customer'
  const ctx: MirrorCtx = {
    blockerIsCustomer,
    pendingDocs: app.documents.filter(
      (d) => d.status === 'requested' || d.status === 'uploaded',
    ).length,
    reuploadDoc: app.documents.find((d) => d.status === 'rejected')?.label,
    sanctionExpiry: app.sanctionExpiryDate,
    trancheN: app.tranches.find((t) => t.status !== 'remitted')?.n ?? app.tranches.length,
    trancheTotal: app.tranches.length,
    trancheState: app.tranches.find((t) => t.status !== 'remitted')?.status,
    payee: 'the university',
    gate: 'upload stamped visa',
  }
  return mirrorFor(stage, ctx)
}

export function mirrorFor(stage: Stage, ctx: MirrorCtx): string {
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  switch (stage) {
    case 'S01':
      return 'Application in progress — complete your details'
    case 'S02':
      // v4: a customer journey can SUBMIT at S02, so the stage alone no longer
      // implies the file is still in their hands. The blocker decides.
      return ctx.blockerIsCustomer
        ? 'Application in progress — complete your details'
        : 'Application received — we’re checking it over'
    case 'S03':
      return ctx.blockerIsCustomer
        ? 'Action needed: complete KYC verification'
        : 'Verifying your identity'
    case 'S04':
      return ctx.blockerIsCustomer
        ? `Action needed: upload pending documents (${ctx.pendingDocs ?? 0} remaining)`
        : 'Collecting your documents'
    case 'S05':
    case 'S06':
    case 'S07':
    case 'S08':
    case 'S09':
      return ctx.blockerIsCustomer && ctx.reuploadDoc
        ? `Action needed: re-upload ${ctx.reuploadDoc}`
        : 'Application under review'
    case 'S10':
      return 'Final decision in progress'
    case 'S11':
      return ctx.blockerIsCustomer
        ? 'Action needed: accept offer & pay processing fee'
        : `Congratulations — sanction issued. Review and accept your offer (valid till ${fmtDate(ctx.sanctionExpiry)})`
    case 'S12':
      return ctx.blockerIsCustomer
        ? 'Action needed: complete e-sign / NACH'
        : 'Almost there — sign your loan agreement'
    case 'S13':
      return ctx.blockerIsCustomer
        ? `Action needed: ${ctx.gate}`
        : `Disbursement in progress — Tranche ${ctx.trancheN} ${ctx.trancheState ?? ''}`.trim()
    case 'DISBURSED_ACTIVE':
      return `Loan active — Tranche ${ctx.trancheN} of ${ctx.trancheTotal} disbursed to ${ctx.payee}`
    case 'REJECTED':
      return "We're unable to approve your application at this time. Our team will share details."
    case 'WITHDRAWN':
      return 'Application withdrawn at your request'
    case 'EXPIRED':
      return 'Application closed due to inactivity / lapsed sanction'
    default:
      return 'Application under review'
  }
}
