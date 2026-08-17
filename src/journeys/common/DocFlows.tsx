// ============================================================================
// CJ-16 Task detail · CJ-17 Capture · CJ-18 Confirm details, plus the consent
// host screen. Party-agnostic — the co-applicant and collateral portals mount
// exactly these components with a different `forParty`.
// ============================================================================
import { useState } from 'react'
import type { Application, ConsentType, DocumentItem, PartyRole } from '@/types'
import type { CaptureResult } from '@/types/journeys'
import {
  ActionBar,
  Callout,
  GButton,
  GCard,
  GChip,
  GError,
  GField,
  GInput,
  ScreenTitle,
  SectionHeading,
} from '@/journeys/common/glib'
import { ConsentFlow } from '@/journeys/common/ConsentFlow'
import { bucketCopy } from '@/journeys/copy'
import { checkFile, extractFields, labelToWords, runCapture } from '@/lib/capture'
import { POLICY } from '@/data/policy'
import { isSettled } from '@/lib/customerTasks'

// ---------------------------------------------------------------------------
// CJ-16 · Task detail for an upload bucket
// ---------------------------------------------------------------------------
export function BucketDetail({
  app,
  bucketId,
  onCapture,
  onBack,
}: {
  app: Application
  bucketId: string
  onCapture: (docId: string) => void
  onBack: () => void
}) {
  const bucket = app.buckets.find((b) => b.id === bucketId)
  const docs = app.documents.filter((d) => d.bucketId === bucketId)
  if (!bucket) {
    return (
      <>
        <ScreenTitle title="We can’t find that" intro="It may already be done." />
        <GButton block onClick={onBack}>
          Back to my list
        </GButton>
      </>
    )
  }
  const copy = bucketCopy(bucket.code)
  const outstanding = docs.filter((d) => !isSettled(d))
  const done = docs.filter(isSettled)

  return (
    <>
      <ScreenTitle title={copy.title} intro={copy.why} />

      {outstanding.length === 0 ? (
        <Callout tone="ok" title="All done here">
          Everything in this group is with the bank.
        </Callout>
      ) : (
        <>
          <SectionHeading>
            {outstanding.length} to send
          </SectionHeading>
          <ul className="mb-5 space-y-2">
            {outstanding.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => onCapture(d.id)}
                  className="flex w-full min-h-[56px] items-center justify-between gap-3 rounded-xl border border-[var(--grey-300)] bg-white p-3.5 text-left hover:border-[var(--glib-blue)] hover:bg-[var(--blue-100)]/40"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-[21px]">{d.label}</span>
                    <span className="mt-0.5 block text-[12px] text-[var(--grey-600)]">
                      {d.mandate === 'O'
                        ? 'Optional'
                        : d.mandate === 'C'
                          ? 'Only if it applies to you'
                          : 'Needed'}
                      {d.vintageNote ? ` · ${d.vintageNote}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--glib-blue)]">
                    Send
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {done.length > 0 ? (
        <>
          <SectionHeading>Already with us</SectionHeading>
          <ul className="space-y-1.5">
            {done.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-1.5">
                <span className="text-[14px] leading-[21px] text-[var(--grey-600)]">{d.label}</span>
                {/* "Received", never "Verified" — fetched is not verified. */}
                <GChip tone="ok">{d.status === 'waived' ? 'Not needed' : 'Received'}</GChip>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <ActionBar>
        <GButton block tone="secondary" onClick={onBack}>
          Back to my list
        </GButton>
      </ActionBar>
    </>
  )
}

// ---------------------------------------------------------------------------
// CJ-17 · Capture — camera or file, quality check, retake loop
// ---------------------------------------------------------------------------
export function Capture({
  app,
  docId,
  onAccepted,
  onRejected,
  onBack,
}: {
  app: Application
  docId: string
  onAccepted: (result: CaptureResult) => void
  onRejected: (result: CaptureResult) => void
  onBack: () => void
}) {
  const doc = app.documents.find((d) => d.id === docId)
  const [error, setError] = useState<string | null>(null)
  const [retake, setRetake] = useState<CaptureResult | null>(null)
  const [busy, setBusy] = useState(false)

  if (!doc) {
    return (
      <>
        <ScreenTitle title="We can’t find that document" />
        <GButton block onClick={onBack}>
          Back to my list
        </GButton>
      </>
    )
  }

  function handle(fileName: string, sizeKb: number) {
    setError(null)
    const check = checkFile(fileName, sizeKb)
    if (!check.ok) {
      setError(check.message ?? null)
      return
    }
    setBusy(true)
    const result = runCapture(doc!, fileName, sizeKb)
    setBusy(false)
    if (result.verdict === 'retake') {
      setRetake(result)
      onRejected(result)
      return
    }
    setRetake(null)
    onAccepted(result)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    handle(f.name, Math.max(1, Math.round(f.size / 1024)))
    e.target.value = ''
  }

  return (
    <>
      <ScreenTitle
        title={doc.label}
        intro="Take a photo of the whole page, or pick a file you already have."
      />

      {retake ? (
        <div className="mb-4">
          <Callout tone="warn" title="Let’s try that again">
            {retake.retakeReason}
          </Callout>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <GError what={error} />
        </div>
      ) : null}

      <div className="mb-4 space-y-3">
        <label className="block">
          <span className="sr-only">Take a photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="peer sr-only"
          />
          <span className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--glib-blue)] bg-[var(--blue-100)]/40 p-5 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--glib-blue)]">
            <span className="display text-[16px] font-semibold text-[var(--glib-blue)]">
              Take a photo
            </span>
            <span className="text-[13px] text-[var(--grey-600)]">
              Lay it flat, in good light, all four corners in frame
            </span>
          </span>
        </label>

        <label className="block">
          <span className="sr-only">Choose a file</span>
          <input
            type="file"
            accept={POLICY.uploadAcceptedTypes.map((t) => `.${t}`).join(',')}
            onChange={onPick}
            className="peer sr-only"
          />
          <span className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border border-[var(--grey-300)] bg-white p-3.5 text-[15px] font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--glib-blue)]">
            Choose a file instead
          </span>
        </label>
      </div>

      <p className="text-[12px] leading-4 text-[var(--grey-600)]">
        {POLICY.uploadAcceptedTypes.join(', ').toUpperCase()} · up to{' '}
        {POLICY.uploadMaxMb} MB
      </p>

      {busy ? <p className="mt-3 text-[13px] text-[var(--grey-600)]">Checking the photo…</p> : null}

      <ActionBar>
        <GButton block tone="secondary" onClick={onBack}>
          Back
        </GButton>
      </ActionBar>
    </>
  )
}

// ---------------------------------------------------------------------------
// CJ-18 · Confirm details — classification + extraction
// ---------------------------------------------------------------------------
export function ConfirmDetails({
  app,
  docId,
  capture,
  onConfirm,
  onReassign,
  onRetake,
}: {
  app: Application
  docId: string
  capture: CaptureResult | null
  onConfirm: (fields: Record<string, string | number>) => void
  onReassign: (toDocId: string) => void
  onRetake: () => void
}) {
  const doc = app.documents.find((d) => d.id === docId)
  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (!doc) return {}
    return Object.fromEntries(
      extractFields(doc, `${docId}|${capture?.fileName ?? ''}`).map((f) => [f.key, f.value]),
    )
  })
  const [showReassign, setShowReassign] = useState(false)

  if (!doc) return null

  const shown = extractFields(doc, `${docId}|${capture?.fileName ?? ''}`)
  const cls = capture?.classification
  const expected = doc.classification?.label ?? cls?.label
  // The classifier's vocabulary bottoms out at GENERIC_UPLOAD, which renders as
  // the word "document" — so "we asked for your document" says nothing. Fall
  // back to the checklist's own name for the slot, trimmed of its parenthetical
  // caveat: "Form 60 (where first PAN is pending)" → "Form 60".
  const expectedName =
    expected && expected !== 'GENERIC_UPLOAD' ? labelToWords(expected) : shortDocName(doc.label)
  // A mismatch is when the reader thinks this is a DIFFERENT document type.
  const mismatch = Boolean(cls && expected && cls.label !== expected)
  const ambiguous = Boolean(cls?.ambiguous)

  // Candidate slots for the reassign path — outstanding documents on the file.
  const candidates: DocumentItem[] = app.documents.filter(
    (d) => d.id !== docId && !isSettled(d),
  )

  return (
    <>
      <ScreenTitle title="Does this look right?" />

      {mismatch ? (
        <div className="mb-4">
          <Callout tone="warn" title={`This looks like a ${labelToWords(cls!.label)}`}>
            We asked for your {expectedName}. Use it for the{' '}
            {labelToWords(cls!.label)} instead?
          </Callout>
        </div>
      ) : ambiguous ? (
        // §12.2 — the customer is NEVER asked to resolve a classifier ambiguity.
        <div className="mb-4">
          <Callout tone="info" title="Received">
            Someone will check this one. Nothing more is needed from you.
          </Callout>
        </div>
      ) : (
        <div className="mb-4">
          <Callout tone="ok">
            Looks like your {labelToWords(cls?.label ?? doc.label)}.
          </Callout>
        </div>
      )}

      <SectionHeading>What we read</SectionHeading>
      <div className="mb-4">
        {shown.map((f) => (
          <GField
            key={f.key}
            label={f.label}
            hint={f.uncertain ? 'Worth a quick check — we weren’t sure of this one.' : undefined}
            htmlFor={`ex-${f.key}`}
          >
            <GInput
              id={`ex-${f.key}`}
              value={fields[f.key] ?? f.value}
              onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
              className={f.uncertain ? 'border-[color:var(--warn)]' : undefined}
            />
          </GField>
        ))}
      </div>

      <p className="text-[12px] leading-4 text-[var(--grey-600)]">
        Received isn&rsquo;t the same as checked. The bank still reads through
        each document, and we&rsquo;ll tell you if anything needs a second look.
      </p>

      {showReassign ? (
        <div className="mt-4">
          <SectionHeading>Which document is this?</SectionHeading>
          <ul className="space-y-2">
            {candidates.slice(0, 8).map((c) => (
              <li key={c.id}>
                <GButton block tone="secondary" onClick={() => onReassign(c.id)}>
                  {c.label}
                </GButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionBar>
        <GButton block onClick={() => onConfirm(fields)}>
          Yes, that&rsquo;s right
        </GButton>
        {mismatch ? (
          <GButton block tone="secondary" onClick={() => setShowReassign((v) => !v)}>
            File it as something else
          </GButton>
        ) : null}
        <GButton block tone="quiet" onClick={onRetake}>
          Send a different photo
        </GButton>
      </ActionBar>
    </>
  )
}

/** The checklist name, short enough to sit inside a sentence. */
function shortDocName(label: string): string {
  return label
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*[—–-]\s.*$/, '')
    .split(',')[0]
    .trim()
}

// ---------------------------------------------------------------------------
// Consent host — puts ConsentFlow on a screen and wires the two outcomes.
// ---------------------------------------------------------------------------
export function ConsentScreen({
  app,
  type,
  partyRole,
  onGrant,
  onDecline,
  onCancel,
}: {
  app: Application
  type: ConsentType
  partyRole: PartyRole
  onGrant: () => void
  onDecline: (reason: string) => void
  onCancel: () => void
}) {
  return (
    <ConsentFlow
      app={app}
      type={type}
      partyRole={partyRole}
      onGrant={onGrant}
      onDecline={onDecline}
      onCancel={onCancel}
    />
  )
}

/** Shown after a decline — the file is never blocked by one (§11.4). */
export function DeclinedNotice({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <ScreenTitle
        title="No problem — you can upload these yourself"
        intro="We’ve put them back on your list as ordinary uploads. Your application carries on exactly as before."
      />
      <GCard tone="support" className="mb-4">
        <p className="text-[14px] leading-[21px]">
          If you change your mind, the permission is still there on your sharing
          screen and you can give it at any point.
        </p>
      </GCard>
      <ActionBar>
        <GButton block onClick={onContinue}>
          Back to my list
        </GButton>
      </ActionBar>
    </>
  )
}
