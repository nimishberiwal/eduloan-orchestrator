// ============================================================================
// Persona switch (§2.2) — the demo's spine.
//
// Jumps between Student / Parent / Security owner / RM / Back office ON THE
// SAME APPLICATION without re-authenticating. It is a dev+demo affordance, not
// a product feature: hidden unless import.meta.env.DEV or __DEMO__.
//
// It also carries the "Links issued" tray, because the prototype sends no real
// SMS, email or WhatsApp (§22) and every invite / handoff link has to land
// somewhere a reviewer can click.
// ============================================================================
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/store/sessionStore'
import { useStore } from '@/store/appStore'
import { fmtDateTime } from '@/lib/format'
import { GlibMark } from './BrandHeader'

export function personaSwitchEnabled(): boolean {
  const demo = (globalThis as Record<string, unknown>).__DEMO__
  return Boolean(import.meta.env.DEV || demo)
}

const PERSONAS = [
  { key: 'student', label: 'Student', hint: 'The applicant' },
  { key: 'parent', label: 'Parent', hint: 'The co-applicant' },
  { key: 'collateral', label: 'Security owner', hint: 'Tier-3 only' },
  { key: 'rm', label: 'RM', hint: 'Assisted journey' },
  { key: 'console', label: 'Back office', hint: 'The Ops dashboard' },
] as const

export function PersonaSwitch() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'persona' | 'links'>('persona')
  const nav = useNavigate()
  const loc = useLocation()

  const persona = useSessionStore((s) => s.persona)
  const setPersona = useSessionStore((s) => s.setPersona)
  const sessions = useSessionStore((s) => s.sessions)
  const active = useSessionStore((s) => s.activeSessionId)
  const links = useSessionStore((s) => s.issuedLinks)
  const invites = useSessionStore((s) => s.invites)
  const selectedAppId = useStore((s) => s.selectedAppId)

  if (!personaSwitchEnabled()) return null

  /** The application the demo is currently "on" — used to land the new persona
   *  in the right place rather than at a generic home screen. */
  function currentAppId(): string | null {
    const m = loc.pathname.match(/\/(?:apply|rm\/apply)\/(APP-\d+)/)
    if (m) return m[1]
    const co = loc.pathname.match(/^\/(?:co|security)\/([A-Za-z0-9]+)/)
    if (co) {
      const inv = invites.find((i) => i.token === co[1])
      if (inv) return inv.appId
    }
    return selectedAppId
  }

  function go(key: (typeof PERSONAS)[number]['key']) {
    setPersona(key)
    const appId = currentAppId()
    if (key === 'console') {
      nav('/console')
      return
    }
    if (key === 'rm') {
      nav(appId ? `/rm/apply/${appId}/summary` : '/rm')
      return
    }
    if (key === 'student') {
      const s = active.applicant ? sessions.find((x) => x.id === active.applicant) : undefined
      nav(appId ? `/apply/${appId}/tasks` : s ? '/apply' : '/start')
      return
    }
    if (key === 'parent') {
      const inv = invites.find((i) => i.kind === 'co_applicant' && (!appId || i.appId === appId))
      nav(inv ? `/co/${inv.token}` : '/start')
      return
    }
    const inv = invites.find((i) => i.kind === 'collateral_provider' && (!appId || i.appId === appId))
    nav(inv ? `/security/${inv.token}` : '/start')
  }

  const sessionFor: Record<string, string | undefined> = {
    student: active.applicant,
    parent: active.co_applicant,
    collateral: active.collateral_provider,
    rm: active.rm,
  }

  return (
    <div className="fixed right-3 top-3 z-[200] print:hidden">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-[36px] items-center gap-2 rounded-full border border-[var(--grey-300)] bg-white/95 px-3 text-[12px] font-semibold text-[var(--glib-grey)] shadow-sm backdrop-blur hover:bg-[var(--blue-grey)]"
          title="Demo persona switch (dev only)"
        >
          <GlibMark size={14} />
          {PERSONAS.find((p) => p.key === persona)?.label ?? 'Persona'}
          {links.length > 0 ? (
            <span className="rounded-full bg-[var(--glib-blue)] px-1.5 text-[11px] font-bold text-white">
              {links.length}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="w-[300px] overflow-hidden rounded-xl border border-[var(--grey-300)] bg-white shadow-[0_10px_34px_rgba(16,18,20,0.18)]">
          <div className="flex items-center justify-between border-b border-[var(--blue-grey)] px-3 py-2">
            <span className="display text-[12px] font-bold uppercase tracking-wide text-[var(--grey-600)]">
              Demo controls
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close demo controls"
              className="rounded-md px-2 py-1 text-[13px] text-[var(--grey-600)] hover:bg-[var(--blue-grey)]"
            >
              ✕
            </button>
          </div>

          <div className="flex border-b border-[var(--blue-grey)] text-[12px] font-semibold">
            {(['persona', 'links'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 ${
                  tab === t
                    ? 'border-b-2 border-[var(--glib-blue)] text-[var(--glib-blue)]'
                    : 'text-[var(--grey-600)]'
                }`}
              >
                {t === 'persona' ? 'Persona' : `Links issued (${links.length})`}
              </button>
            ))}
          </div>

          {tab === 'persona' ? (
            <div className="p-2">
              {PERSONAS.map((p) => {
                const sid = sessionFor[p.key]
                return (
                  <button
                    key={p.key}
                    onClick={() => go(p.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left ${
                      persona === p.key ? 'bg-[var(--blue-100)]' : 'hover:bg-[var(--blue-grey)]'
                    }`}
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-[var(--glib-grey)]">
                        {p.label}
                      </span>
                      <span className="block text-[11px] text-[var(--grey-600)]">{p.hint}</span>
                    </span>
                    {p.key !== 'console' ? (
                      <span
                        className={`num rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          sid
                            ? 'bg-[#eef7f2] text-[var(--ok)]'
                            : 'bg-[var(--blue-grey)] text-[var(--grey-600)]'
                        }`}
                      >
                        {sid ?? 'no session'}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              <p className="px-2.5 pb-1 pt-2 text-[11px] leading-4 text-[var(--grey-600)]">
                Sessions are separate per party. Switching persona does not
                re-authenticate — it is a demo shortcut only.
              </p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-auto p-2">
              {links.length === 0 ? (
                <p className="px-2.5 py-6 text-center text-[12px] text-[var(--grey-600)]">
                  No links issued yet. Invite a parent or hand off an
                  identity-bound step and it will appear here.
                </p>
              ) : (
                links.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      nav(l.path)
                      setOpen(false)
                    }}
                    className="mb-1 block w-full rounded-lg px-2.5 py-2 text-left hover:bg-[var(--blue-grey)]"
                  >
                    <span className="block text-[12px] font-semibold text-[var(--glib-grey)]">
                      {l.label}
                    </span>
                    <span className="num block truncate text-[11px] text-[var(--glib-blue)]">
                      {l.path}
                    </span>
                    <span className="block text-[11px] text-[var(--grey-600)]">
                      {l.channel === 'in_branch' ? 'handed over in branch' : `sent by ${l.channel}`} ·
                      expires {fmtDateTime(l.expiresAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
