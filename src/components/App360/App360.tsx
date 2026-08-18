// ============================================================================
// Application 360 — the orchestration screen (§12.3)
// ============================================================================
import { ArrowLeft } from 'lucide-react'
import { useStore } from '@/store/appStore'
import type { App360Tab, Application } from '@/types'
import { inr } from '@/lib/format'
import { customerFacingStatus } from '@/data/customerMirror'
import { STAGE_NAME } from '@/data/stages'
import { StatusChip, EmptyState } from '@/components/common/ui'
import {
  AgingDot, BlockerBadge, DoABandChip, SanctionExpiryChip, TierChip,
} from '@/components/common/badges'
import { ActionBar } from './ActionBar'
import { JourneyTimeline } from './JourneyTimeline'
import { PeerPanel } from './PeerPanel'
import { ConsentsPanel } from './ConsentsPanel'
import {
  AuditTab, CollateralTab, CommsTab, CovenantsTab, CreditTab, DecisionTab, DocumentsTab, ExtractedTab,
  IntegrationsTab, NotesTab, OnboardingTab, PapersTab, TranchesTab, UniversityTab, ValidationsTab,
} from './tabs'

const TABS: { id: App360Tab; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'extracted', label: 'Extracted data' },
  { id: 'validations', label: 'Validations' },
  { id: 'onboarding', label: 'Readiness' },
  { id: 'credit', label: 'Credit assessment' },
  { id: 'collateral', label: 'Security' },
  { id: 'decision', label: 'Decision (CAM-lite)' },
  { id: 'papers', label: 'Sanction pack' },
  { id: 'covenants', label: 'Covenants' },
  { id: 'tranches', label: 'Tranches' },
  { id: 'comms', label: 'Comms' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'university', label: 'University brief' },
  { id: 'consents', label: 'Consents' },
  { id: 'peers', label: 'Peers' },
  { id: 'audit', label: 'Audit' },
  { id: 'notes', label: 'Notes' },
]

export function App360() {
  const appId = useStore((s) => s.selectedAppId)
  const app = useStore((s) => s.applications.find((a) => a.appId === appId))
  const tab = useStore((s) => s.app360Tab)
  const setTab = useStore((s) => s.setApp360Tab)
  const setMainTab = useStore((s) => s.setTab)

  if (!app) {
    return <EmptyState>Select an application from the Pipeline or Queues to open its 360 view.</EmptyState>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header band */}
      <div className="border-b border-[var(--line)] bg-white px-5 py-3.5">
        <button onClick={() => setMainTab('pipeline')} className="mb-2 inline-flex items-center gap-1 text-12 font-medium text-slate-400 transition-colors hover:text-slate-600">
          <ArrowLeft size={13} /> Back to Pipeline
        </button>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-12 font-semibold tnum text-slate-500">{app.appId}</span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">{app.studentName}</span>
          <span className="text-12 text-slate-500">{app.programLevel} · {app.program} · {app.university}</span>
          <span className="ml-auto text-lg font-semibold tnum text-slate-800">{inr(app.askInr)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-11 font-medium text-slate-600">{STAGE_NAME[app.stage]}</span>
          <StatusChip status={app.status} />
          <TierChip app={app} />
          <DoABandChip app={app} />
          <BlockerBadge app={app} />
          <AgingDot app={app} />
          <SanctionExpiryChip app={app} />
          <span className="text-11 text-slate-400">· owner: {app.owner.officer} ({app.owner.department})</span>
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-slate-50 px-2.5 py-1.5 text-12 text-slate-600">
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Customer sees</span>
          <span className="italic text-slate-700">“{customerFacingStatus(app)}”</span>
        </div>
      </div>

      {/* Action bar */}
      <ActionBar app={app} />

      {/* Body: timeline + tabs */}
      <div className="thin-scroll flex-1 overflow-auto p-4">
        <div className="mb-4">
          <JourneyTimeline app={app} />
        </div>

        {/* Tab strip */}
        <div className="thin-scroll mb-4 flex gap-0.5 overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-card">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-13 font-medium transition-colors ${
                tab === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="animate-fade-in">
          <TabContent app={app} tab={tab} />
        </div>
      </div>
    </div>
  )
}

function TabContent({ app, tab }: { app: Application; tab: App360Tab }) {
  switch (tab) {
    case 'documents': return <DocumentsTab app={app} />
    case 'extracted': return <ExtractedTab app={app} />
    case 'validations': return <ValidationsTab app={app} />
    case 'onboarding': return <OnboardingTab app={app} />
    case 'credit': return <CreditTab app={app} />
    case 'collateral': return <CollateralTab app={app} />
    case 'decision': return <DecisionTab app={app} />
    case 'papers': return <PapersTab app={app} />
    case 'covenants': return <CovenantsTab app={app} />
    case 'tranches': return <TranchesTab app={app} />
    case 'comms': return <CommsTab app={app} />
    case 'integrations': return <IntegrationsTab app={app} />
    case 'university': return <UniversityTab app={app} />
    case 'consents': return <ConsentsPanel app={app} />
    case 'peers': return <PeerPanel app={app} />
    case 'audit': return <AuditTab app={app} />
    case 'notes': return <NotesTab app={app} />
  }
}
