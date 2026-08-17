// ============================================================================
// Routing (§2.2).
//
// The JOURNEYS use real routes — deep links, resume, handoff links and browser
// back are all load-bearing. The DASHBOARD keeps its `tab`-in-store pattern
// unchanged and mounts at /console/* as a single route: it was built without a
// router on purpose, and retrofitting one would touch every view for no gain.
// ============================================================================
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Console from '@/App'
import { PersonaSwitch } from '@/journeys/shell/PersonaSwitch'
import { Landing } from '@/journeys/customer/Landing'
import { Identify } from '@/journeys/auth/Identify'
import { Otp } from '@/journeys/auth/Otp'
import { MyApplications } from '@/journeys/customer/MyApplications'
import { CustomerJourney } from '@/journeys/customer/CustomerJourney'
import { CoApplicantPortal } from '@/journeys/coapplicant/CoApplicantPortal'
import { CollateralPortal } from '@/journeys/collateral/CollateralPortal'
import { AssistedJourney } from '@/journeys/assisted/AssistedJourney'
import { HandoffLanding } from '@/journeys/assisted/HandoffLanding'
import { TaskInspector } from '@/journeys/dev/TaskInspector'
import { NotFound } from '@/journeys/common/NotFound'

export function AppRoutes() {
  const loc = useLocation()
  // The console renders its own chrome; the journeys render theirs.
  const inConsole = loc.pathname.startsWith('/console')
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/start" element={<Identify partyRole="applicant" returnTo="/apply" />} />
        <Route path="/otp" element={<Otp />} />

        <Route path="/apply" element={<MyApplications />} />
        <Route path="/apply/:appId/*" element={<CustomerJourney />} />

        <Route path="/co/:token/*" element={<CoApplicantPortal />} />
        <Route path="/security/:token/*" element={<CollateralPortal />} />

        <Route path="/rm/*" element={<AssistedJourney />} />
        <Route path="/handoff/:token" element={<HandoffLanding />} />

        <Route path="/console/*" element={<Console />} />

        {/* Dev-only surfaces (§P2). Harmless in a build — they read state only. */}
        <Route path="/__dev/tasks" element={<TaskInspector />} />
        <Route path="/__dev/persona" element={<Navigate to="/" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* The persona switch floats above every surface INCLUDING the console,
          so a reviewer can jump back into the journeys from the Ops queue. */}
      <PersonaSwitch key={inConsole ? 'console' : 'journey'} />
    </>
  )
}
