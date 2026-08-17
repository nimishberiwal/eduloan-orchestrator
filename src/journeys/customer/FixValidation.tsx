// ============================================================================
// The plain-language validation card (§13.2).
//
// The worked example the spec calls out — VAL-CRS-01, a name that doesn't match
// between PAN and I-20 — renders here. Rules it obeys: no rule ID, no
// similarity score, never the word "failed". Name the two documents, quote both
// values, offer the specific fix.
// ============================================================================
import { useNavigate, useParams } from 'react-router-dom'
import type { Application } from '@/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  ScreenTitle,
  SectionHeading,
} from '@/journeys/common/glib'
import { customerFixableFailures } from '@/lib/plainLanguage'
import { liveRail } from './rail'
import { useJourney } from '@/journeys/useJourney'

export function FixValidation({ app, root }: { app: Application; root: string }) {
  const { validationId } = useParams()
  const nav = useNavigate()
  const { milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'customer',
  })

  const failure = customerFixableFailures(app).find((f) => f.id === validationId)

  if (!failure) {
    return (
      <AppShell steps={liveRail(app)} homeTo="/apply">
        <ScreenTitle
          title="This has been sorted"
          intro="Nothing more is needed here."
        />
        <GButton block onClick={() => nav(`${root}/tasks`)}>
          Back to my list
        </GButton>
      </AppShell>
    )
  }

  const targets = failure.targetDocIds
    .map((id) => app.documents.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))

  function act(kind: string, label: string) {
    if (kind === 'reupload') {
      const target = targets.find((d) => d.status !== 'verified') ?? targets[0]
      if (target) {
        nav(`${root}/capture/${target.id}`)
        return
      }
    }
    // "It's the same person" / "My university didn't require it" — the customer
    // asserts something, the bank reviews it. The validation is NOT flipped by
    // the customer; only an officer can resolve it.
    milestone(
      'CUSTOMER RESPONSE RECORDED',
      `"${label}" — customer responded to a document query; sent for review`,
      (a) => {
        a.blocker = { kind: 'bank', detail: 'bank: customer response awaiting review' }
      },
    )
    nav(`${root}/tasks`)
  }

  return (
    <AppShell steps={liveRail(app)} homeTo="/apply">
      <BackLink to={`${root}/tasks`}>What we need from you</BackLink>
      <ScreenTitle title={failure.title} />

      <GCard tone="warn" className="mb-4">
        <p className="text-[15px] leading-[22px]">{failure.body}</p>
      </GCard>

      {targets.length > 0 ? (
        <>
          <SectionHeading>The documents involved</SectionHeading>
          <ul className="mb-4 space-y-1.5">
            {targets.map((d) => (
              <li key={d.id} className="text-[14px] leading-[21px] text-[var(--grey-600)]">
                {d.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Callout tone="support">
        Whichever you choose, a person at the bank looks at it. Nothing is
        decided automatically here.
      </Callout>

      <ActionBar>
        {failure.actions.map((a, i) => (
          <GButton
            key={a.label}
            block
            tone={i === 0 ? 'primary' : 'secondary'}
            onClick={() => act(a.kind, a.label)}
          >
            {a.label}
          </GButton>
        ))}
      </ActionBar>
    </AppShell>
  )
}
