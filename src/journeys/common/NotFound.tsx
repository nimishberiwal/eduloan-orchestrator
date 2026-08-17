import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/journeys/shell/AppShell'
import { GButton, ScreenTitle } from '@/journeys/common/glib'

/** Errors say what happened and what to do next (§3.5). */
export function NotFound() {
  const nav = useNavigate()
  return (
    <AppShell>
      <ScreenTitle
        title="That page isn’t here"
        intro="The link may be old, or it may have been mistyped. Your application is safe — nothing was lost."
      />
      <div className="flex flex-col gap-3">
        <GButton block onClick={() => nav('/apply')}>
          Go to my applications
        </GButton>
        <GButton block tone="secondary" onClick={() => nav('/')}>
          Back to the start
        </GButton>
      </div>
    </AppShell>
  )
}
