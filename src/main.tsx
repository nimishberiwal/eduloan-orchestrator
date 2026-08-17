import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AppRoutes } from '@/routes'
import { useStore } from '@/store/appStore'
import { useSessionStore } from '@/store/sessionStore'
import { buildTasks, tasksFor } from '@/lib/customerTasks'
import { runCapture } from '@/lib/capture'
import './index.css'

// §3.3 — the self-hosted faces are loaded CONDITIONALLY. `BUILD_FONTS=none`
// falls back to the system stack and must render without layout breakage; that
// is the mode the artifact viewer may end up using.
if (import.meta.env.VITE_BUILD_FONTS !== 'none') {
  import('./fonts.css')
}

// Dev-only handles so state can be inspected from the console while building.
// `__glibmoney` mirrors `__eduloan` (§0.7) — verify, don't assert.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__eduloan = { store: useStore }
  w.__glibmoney = {
    store: useStore,
    sessions: useSessionStore,
    /** Every task the projection produces for an application, by party. */
    tasks: (appId: string) => {
      const app = useStore.getState().applications.find((a) => a.appId === appId)
      return app ? tasksFor(app) : null
    },
    buildTasks,
    /** Dev overrides for the deterministic capture mock (§12.1). */
    capture: runCapture,
  }
}

// §2.4 — the same bundle ships three ways, and one of them is a standalone HTML
// file opened by double-click. `file://` has no server to resolve /apply/… and
// pushState against it is meaningless, so that surface routes on the hash
// instead. Everything else keeps clean paths.
const Router =
  typeof location !== 'undefined' && location.protocol === 'file:'
    ? HashRouter
    : BrowserRouter

// Opt into the v7 behaviours now. Both are already how this app expects to
// behave, and leaving them off puts two warnings in the console of anyone who
// opens dev tools during a review.
const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Router future={FUTURE}>
        <AppRoutes />
      </Router>
    </React.StrictMode>,
  )
}

// The standalone single-file build strips `type="module"` (a module script is
// CORS-blocked over `file://`), and `vite-plugin-singlefile` inlines the script
// into <head>. Without the module type there is no implicit defer, and `defer`
// is ignored on inline scripts — so the script would run before `#root` is
// parsed and React would throw "target container is not a DOM element".
// Waiting for the DOM fixes it at the source, rather than by moving script tags
// around in the built HTML afterwards.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
