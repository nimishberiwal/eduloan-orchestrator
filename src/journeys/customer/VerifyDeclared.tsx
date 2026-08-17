// ============================================================================
// CJ-28 · Verify what you told us (§Phase C).
//
// The other half of the "I'll type it myself" bargain. A customer who skipped
// the upload on a detail screen was told, in those words, that we'd ask for the
// document later to check it against what they said. This is later.
//
// TWO LISTS, AND THEY ARE NOT THE SAME PROBLEM.
//   Still to send  — typed, no document yet. Upload resolves it.
//   Doesn't match  — the document arrived and disagreed. An upload will not fix
//                    this one; a person has to decide which value is right.
//
// The screen NEVER rewrites what the customer entered. `enteredValue` is the
// thing being verified, and a verification step that quietly corrects its own
// subject would be worth nothing to the credit officer reading it later.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application, DocumentItem } from '@/types'
import type { AgentResults } from '@/lib/agents/types'
import { AppShell, BackLink } from '@/journeys/shell/AppShell'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  ScreenTitle,
  SectionHeading,
} from '@/journeys/common/glib'
import { SmartFill } from '@/journeys/common/SmartFill'
import { useJourney } from '@/journeys/useJourney'
import { useStore } from '@/store/appStore'
import { fieldsFromRun } from '@/lib/agents/documents'
import {
  declarationsSettled,
  discrepancies,
  pendingDeclarations,
  type DeclaredGroup,
} from '@/lib/declared'

/** The checklist name, short enough to sit inside a sentence. */
function shortDocName(label: string): string {
  return label
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*[—–-]\s.*$/, '')
    .split(',')[0]
    .trim()
}

/** "You told us 9.1 CGPA for result; the document says 8.4 CGPA."
 *
 *  Deliberately not a verdict. We do not know which of the two is right — the
 *  customer may have mistyped, or the reader may have misread a scan — and a
 *  screen that says "you were wrong" about the second case is worse than one
 *  that states both values and lets a person look.
 *
 *  The document is NAMED on the card rather than inside the sentence. Checklist
 *  labels are plural and verbose ("UG marksheets all semesters"), and dropping
 *  one into a possessive clause produced "your ug marksheets all semesters
 *  says" — a plural subject with a singular verb, in the one place on the
 *  screen where the customer is being told something has gone wrong. */
function discrepancyLine(label: string, entered: string, read: string): string {
  return `You told us ${entered} for ${label.toLowerCase()}; the document says ${read}.`
}

export function VerifyDeclared({ app }: { app: Application }) {
  const nav = useNavigate()
  const { actor, milestone } = useJourney({
    appId: app.appId,
    partyRole: 'applicant',
    surface: 'customer',
  })
  const verify = useStore((s) => s.verifyDeclaredFields)
  const recordFindings = useStore((s) => s.recordAgentFindings)
  const uploadDocument = useStore((s) => s.uploadDocument)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const pending = pendingDeclarations(app)
  const clashes = discrepancies(app)
  const settled = declarationsSettled(app)

  const docOf = (g: DeclaredGroup): DocumentItem | undefined =>
    app.documents.find((d) => (g.backingDocIds ?? []).includes(d.id))

  function onSwarm(g: DeclaredGroup, results: AgentResults, doc: DocumentItem) {
    // Same verb an ordinary upload uses — the checklist must not be able to
    // disagree with the fact that a page was read.
    uploadDocument(app.appId, doc.id, {
      fileName: `verify-${doc.id}`,
      sizeKb: 0,
      actor,
    })
    recordFindings(app.appId, doc.id, results, actor)
    verify(
      app.appId,
      `${g.section}|${g.group}`,
      fieldsFromRun(results as Record<string, never>),
      doc.id,
      actor,
    )
    setOpenGroup(null)
  }

  return (
    <AppShell homeTo="/apply">
      <BackLink to={`/apply/${app.appId}/status`}>Where my application is</BackLink>
      <ScreenTitle
        title="Check what you told us"
        intro="You typed some of these in rather than uploading the document at the time. We said we'd ask for them later — this is that."
      />

      {settled ? (
        <Callout tone="ok" title="Nothing outstanding">
          Everything you told us has been checked against a document. Your
          instalments aren&rsquo;t waiting on anything here.
        </Callout>
      ) : (
        <Callout tone="support" title="Why this matters now">
          Your loan is sanctioned and signed. The first instalment doesn&rsquo;t
          go out until these are checked.
        </Callout>
      )}

      {pending.length > 0 ? (
        <>
          <SectionHeading>Still to send</SectionHeading>
          <ul className="mb-5 space-y-3">
            {pending.map((g) => {
              const doc = docOf(g)
              const key = `${g.section}|${g.group}`
              const open = openGroup === key
              return (
                <li key={key}>
                  <GCard tone="plain">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="display text-[15px] font-semibold leading-[21px]">
                          {doc ? shortDocName(doc.label) : g.group}
                        </p>
                        <p className="mt-1 text-[13px] leading-[19px] text-[var(--grey-600)]">
                          {g.fields.map((f) => `${f.label}: ${f.enteredValue}`).join(' · ')}
                        </p>
                      </div>
                      <GChip tone="warn">To check</GChip>
                    </div>

                    {open && doc ? (
                      <div className="mt-3">
                        <SmartFill
                          app={app}
                          match={/^$/}
                          docId={doc.id}
                          noun={`your ${shortDocName(doc.label).toLowerCase()}`}
                          onExtracted={() => {
                            /* CJ-28 does not prefill a form — there is no form
                               here. The reading is applied to the RECORD in
                               onComplete, against what was typed earlier. */
                          }}
                          onComplete={(r, d) => onSwarm(g, r, d)}
                        />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <GButton
                          size="sm"
                          tone="secondary"
                          onClick={() => setOpenGroup(open ? null : key)}
                          disabled={!doc}
                        >
                          {doc ? 'Send this one' : 'Not on your list yet'}
                        </GButton>
                      </div>
                    )}
                  </GCard>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      {clashes.length > 0 ? (
        <>
          <SectionHeading>Doesn&rsquo;t match</SectionHeading>
          <ul className="mb-5 space-y-3">
            {clashes.map((f) => {
              const doc = app.documents.find((d) => (f.backingDocIds ?? []).includes(d.id))
              return (
                <li key={f.id}>
                  <GCard tone="warn">
                    {doc ? (
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--grey-600)]">
                        {shortDocName(doc.label)}
                      </p>
                    ) : null}
                    <p className="text-[14px] leading-[21px]">
                      {discrepancyLine(f.label, f.enteredValue, f.extractedValue)}
                    </p>
                    <p className="mt-2 text-[13px] leading-[19px] text-[var(--grey-600)]">
                      Someone at the bank will look at this and come back to you.
                      You don&rsquo;t need to do anything right now.
                    </p>
                  </GCard>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      <ActionBar>
        <GButton
          block
          onClick={() => {
            milestone(
              'DECLARATIONS REVIEWED',
              settled
                ? 'All self-declared details evidenced'
                : `${pending.length} group(s) still owed · ${clashes.length} contradicted`,
            )
            nav(`/apply/${app.appId}/status`)
          }}
        >
          {settled ? 'Done' : 'Back to my application'}
        </GButton>
      </ActionBar>
    </AppShell>
  )
}
