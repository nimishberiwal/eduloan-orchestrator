// ============================================================================
// /apply/:appId/* — the customer journey router.
//
// Also the host for the document and consent flows, because they need to hold
// the capture result between CJ-17 and CJ-18 and then emit ONE event pair.
// ============================================================================
import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { Application, ConsentType, PartyRole } from '@/types'
import type { CaptureResult, JourneySurface } from '@/types/journeys'
import { useStore } from '@/store/appStore'
import { useSessionStore } from '@/store/sessionStore'
import { AppShell } from '@/journeys/shell/AppShell'
import { GButton, ScreenTitle } from '@/journeys/common/glib'
import { useJourney } from '@/journeys/useJourney'
import {
  BucketDetail,
  Capture,
  ConfirmDetails,
  ConsentScreen,
  DeclinedNotice,
} from '@/journeys/common/DocFlows'
import { Cost, Offer, ParentSnapshot, Plan } from './PreQual'
import { Academics, AddParent, Admission, ParentInviteSent, Profile, Security } from './Details'
import { ActionNeeded, SharingHub, Tasks, VerifyIdentity } from './Tasks'
import { Closed, Submit, Track } from './Track'
import { Agreement, Disbursement, Fee, Mandate, Sanction } from './PostSanction'
import { FixValidation } from './FixValidation'
import { liveRail } from './rail'

export function CustomerJourney() {
  const { appId } = useParams()
  const app = useStore((s) => s.applications.find((a) => a.appId === appId))
  const sessions = useSessionStore((s) => s.sessions)
  const activeIds = useSessionStore((s) => s.activeSessionId)
  const nav = useNavigate()

  const session = sessions.find((s) => s.id === activeIds.applicant)
  const root = `/apply/${appId}`

  if (!app) {
    return (
      <AppShell>
        <ScreenTitle
          title="We can’t find that application"
          intro="The link may be out of date. Your other applications are still here."
        />
        <GButton block onClick={() => nav('/apply')}>
          My applications
        </GButton>
      </AppShell>
    )
  }

  // Deep links are load-bearing (§2.2), so an unauthenticated arrival is sent to
  // sign in and returned here rather than being dead-ended.
  if (!session) {
    return <Navigate to="/start" state={{ returnTo: root }} replace />
  }

  const terminal = ['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(String(app.stage))
  if (terminal) {
    return (
      <Routes>
        <Route path="closed" element={<Closed app={app} />} />
        <Route path="*" element={<Navigate to={`${root}/closed`} replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route index element={<Navigate to={`${root}/tasks`} replace />} />

      {/* Pre-qualification */}
      <Route path="plan" element={<Plan app={app} />} />
      <Route path="cost" element={<Cost app={app} />} />
      <Route path="parent-snapshot" element={<ParentSnapshot app={app} />} />
      <Route path="offer" element={<Offer app={app} />} />

      {/* Capture */}
      <Route path="profile" element={<Profile app={app} />} />
      <Route path="academics" element={<Academics app={app} />} />
      <Route path="admission" element={<Admission app={app} />} />
      <Route path="co-applicant" element={<AddParent app={app} />} />
      <Route path="co-applicant/sent" element={<ParentInviteSent app={app} />} />
      <Route path="security" element={<Security app={app} />} />
      <Route path="submit" element={<Submit app={app} />} />

      {/* Identity & sharing */}
      <Route path="kyc" element={<VerifyIdentity app={app} root={root} />} />
      <Route path="consents" element={<SharingHub app={app} root={root} />} />
      <Route path="consent/:type" element={<ConsentHost app={app} root={root} />} />

      {/* The task spine */}
      <Route path="tasks" element={<Tasks app={app} root={root} />} />
      <Route path="bucket/:bucketId" element={<BucketHost app={app} root={root} />} />
      <Route path="capture/:docId" element={<CaptureHost app={app} root={root} />} />
      <Route path="fix/:validationId" element={<FixValidation app={app} root={root} />} />

      {/* Tracking */}
      <Route path="status" element={<Track app={app} />} />
      <Route path="action" element={<ActionNeeded app={app} root={root} />} />

      {/* Post-sanction */}
      <Route path="sanction" element={<Sanction app={app} />} />
      <Route path="fee" element={<Fee app={app} />} />
      <Route path="agreement" element={<Agreement app={app} />} />
      <Route path="mandate" element={<Mandate app={app} />} />
      <Route path="disbursement" element={<Disbursement app={app} />} />
      <Route path="closed" element={<Closed app={app} />} />

      <Route path="*" element={<Navigate to={`${root}/tasks`} replace />} />
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// Hosts — the bits that need to hold state across two screens.
// ---------------------------------------------------------------------------

function BucketHost({ app, root }: { app: Application; root: string }) {
  const { bucketId } = useParams()
  const nav = useNavigate()
  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BucketDetail
        app={app}
        bucketId={bucketId!}
        onCapture={(docId) => nav(`${root}/capture/${docId}`)}
        onBack={() => nav(`${root}/tasks`)}
      />
    </AppShell>
  )
}

/** CJ-17 → CJ-18. The capture result lives here so the confirm screen can read
 *  the classification and extraction without re-running the mock. */
export function CaptureHost({
  app,
  root,
  partyRole = 'applicant',
  surface = 'customer',
}: {
  app: Application
  root: string
  partyRole?: PartyRole
  surface?: JourneySurface
}) {
  const { docId } = useParams()
  const nav = useNavigate()
  const [result, setResult] = useState<CaptureResult | null>(null)
  // These hosts are mounted by the portals too, so the rail follows the PARTY.
  const steps = partyRole === 'applicant' ? liveRail(app) : undefined
  const home = partyRole === 'applicant' ? '/apply' : root
  const { emit } = useJourney({ appId: app.appId, partyRole, surface })
  const reassignDocument = useStore((s) => s.reassignDocument)
  const doc = app.documents.find((d) => d.id === docId)
  const wasRejected = doc?.status === 'rejected' || doc?.status === 'qc_fail'

  if (!result) {
    return (
      <AppShell steps={steps} homeTo={home}>
        <Capture
          app={app}
          docId={docId!}
          onAccepted={(r) => {
            setResult(r)
            emit(
              wasRejected ? 'DOCUMENT_REPLACED' : 'DOCUMENT_UPLOADED',
              { docId: r.docId, fileName: r.fileName, sizeKb: r.sizeKb },
              `${r.docId}:${r.fileName}:${r.sizeKb}`,
            )
          }}
          onRejected={(r) =>
            emit(
              'DOCUMENT_CAPTURE_REJECTED',
              { docId: r.docId, docLabel: doc?.label, reason: r.retakeReason },
              `${r.docId}:reject:${r.fileName}:${r.sizeKb}`,
            )
          }
          onBack={() => nav(-1)}
        />
      </AppShell>
    )
  }

  return (
    <AppShell steps={steps} homeTo={home}>
      <ConfirmDetails
        app={app}
        docId={docId!}
        capture={result}
        onConfirm={(fields) => {
          emit('EXTRACTION_CONFIRMED', { docId: docId!, fields }, `${docId}:extract:${result.fileName}`)
          nav(`${root}/tasks`)
        }}
        onReassign={(toDocId) => {
          reassignDocument(app.appId, docId!, toDocId, {
            kind: partyRole,
            partyRole,
            sessionId: 'SES-ANON',
          })
          nav(`${root}/tasks`)
        }}
        onRetake={() => setResult(null)}
      />
    </AppShell>
  )
}

/** Hosts a consent flow and emits the grant/decline pair. */
export function ConsentHost({
  app,
  root,
  partyRole = 'applicant',
  surface = 'customer',
}: {
  app: Application
  root: string
  partyRole?: PartyRole
  surface?: JourneySurface
}) {
  const { type } = useParams()
  const nav = useNavigate()
  const [declined, setDeclined] = useState(false)
  const steps = partyRole === 'applicant' ? liveRail(app) : undefined
  const home = partyRole === 'applicant' ? '/apply' : root
  const { emit } = useJourney({ appId: app.appId, partyRole, surface })

  const consentType = type as ConsentType

  if (declined) {
    return (
      <AppShell steps={steps} homeTo={home}>
        <DeclinedNotice onContinue={() => nav(`${root}/tasks`)} />
      </AppShell>
    )
  }

  return (
    <AppShell steps={steps} homeTo={home}>
      <ConsentScreen
        app={app}
        type={consentType}
        partyRole={partyRole}
        onGrant={() => {
          emit('CONSENT_GRANTED', { consentType }, `${consentType}:grant`)
          nav(`${root}/tasks`)
        }}
        onDecline={(reason) => {
          emit('CONSENT_DECLINED', { consentType, reason }, `${consentType}:decline`)
          setDeclined(true)
        }}
        onCancel={() => nav(-1)}
      />
    </AppShell>
  )
}
