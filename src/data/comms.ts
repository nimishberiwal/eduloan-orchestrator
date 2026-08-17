// ============================================================================
// Communication centre templates (§13.2) — simulated auto/manual comms.
// ============================================================================
import type { CommChannel } from '@/types'

export interface CommTemplate {
  id: string
  channel: CommChannel
  subject: string
  render: (ctx: Record<string, string | number>) => string
}

export const COMM_TEMPLATES: CommTemplate[] = [
  {
    id: 'welcome',
    channel: 'Email',
    subject: 'Welcome to Horizon Bank EduLoan',
    render: (c) => `Dear ${c.student}, your education loan application ${c.appId} has been registered. We'll guide you through each step.`,
  },
  {
    id: 'doc_request',
    channel: 'WhatsApp',
    subject: 'Documents required',
    render: (c) => `Hi ${c.student}, please upload the pending documents to proceed: ${c.docs}. Log in to your portal to continue.`,
  },
  {
    id: 'doc_rejected',
    channel: 'SMS',
    subject: 'Re-upload required',
    render: (c) => `Horizon Bank: The document "${c.doc}" needs to be re-uploaded. Please check your portal.`,
  },
  {
    id: 'nudge',
    channel: 'WhatsApp',
    subject: 'Reminder',
    render: (c) => `Reminder ${c.stamp}: your application ${c.appId} is awaiting action from you. Please complete the pending step.`,
  },
  {
    id: 'sanction_issued',
    channel: 'Email',
    subject: 'Sanction letter issued',
    render: (c) => `Congratulations ${c.student}! Your loan is sanctioned. Please review and accept your offer (valid till ${c.validity}).`,
  },
  {
    id: 'acceptance_reminder',
    channel: 'SMS',
    subject: 'Accept your offer',
    render: (c) => `Horizon Bank: Please accept your sanction offer and pay the processing fee to proceed.`,
  },
  {
    id: 'sanction_expiry',
    channel: 'Email',
    subject: 'Sanction expiring soon',
    render: (c) => `Your sanction for ${c.appId} expires on ${c.validity}. Please complete acceptance to avoid revalidation.`,
  },
  {
    id: 'tranche_disbursed',
    channel: 'SMS',
    subject: 'Disbursement processed',
    render: (c) => `Horizon Bank: Tranche ${c.n} of your loan has been disbursed to ${c.payee}.`,
  },
  {
    id: 'decision_comm',
    channel: 'Email',
    subject: 'Application update',
    render: (c) => `Dear ${c.student}, there is an update on your application ${c.appId}. Please log in to view details.`,
  },
  {
    id: 'inactivity_warning',
    channel: 'WhatsApp',
    subject: 'Action needed to keep your application open',
    render: (c) => `Hi ${c.student}, your application ${c.appId} will close due to inactivity in 7 days. Please complete the pending step.`,
  },
]

export const COMM_TEMPLATE_BY_ID: Record<string, CommTemplate> = Object.fromEntries(
  COMM_TEMPLATES.map((t) => [t.id, t]),
)
