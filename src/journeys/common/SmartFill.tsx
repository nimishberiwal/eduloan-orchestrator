// ============================================================================
// SmartFill (§Phase B) — "upload it and we'll fill this in".
//
// Sits at the top of every detail screen that would otherwise make a customer
// retype what a document already says. Three states:
//
//   offer   → "Upload your {document}" / "I'll type it myself"
//   running → the three-agent swarm
//   filled  → a short receipt; the form below is now prefilled and editable
//
// AGENTS PROPOSE, THEY DO NOT DECIDE. Extracted values land in the parent
// form's own state through `onExtracted`, where the customer can change any of
// them before continuing. Nothing is committed by the act of uploading.
// ============================================================================
import { useMemo, useState } from 'react'
import type { Application, DocumentItem } from '@/types'
import type { CaptureResult } from '@/types/journeys'
import type { AgentResults } from '@/lib/agents/types'
import { AgentSwarm } from '@/journeys/common/AgentSwarm'
import { GButton, GCard, GChip, GError } from '@/journeys/common/glib'
import { checkFile, runCapture } from '@/lib/capture'
import { planRun } from '@/lib/agents/runtime'
import { extractionContext, fieldsFromRun, runDocumentSwarm } from '@/lib/agents/documents'
import { POLICY } from '@/data/policy'

export interface SmartFillProps {
  app: Application
  /** Which checklist document backs this screen. First match wins. */
  match: RegExp
  /** Exact document, bypassing `match`/`bucket`. CJ-28 works from the
   *  `backingDocIds` already recorded on a field, so it knows the id and should
   *  not have to reverse it into a label pattern. */
  docId?: string
  /** Scopes `match` to one bucket. Labels repeat across sections — "PAN" is a
   *  document in both E1 and P1 — and without this the parent's screen would
   *  read the student's PAN. */
  bucket?: RegExp
  /** What to call it in the offer line — "your PAN", "your marksheets". */
  noun: string
  /** Extracted key → value, handed to the parent to apply to its own fields. */
  onExtracted: (fields: Record<string, string>, doc: DocumentItem) => void
  /** Fired when the swarm settles, so the parent can record the upload. */
  onComplete?: (results: AgentResults, doc: DocumentItem, capture: CaptureResult) => void
}

export function SmartFill({
  app,
  match,
  docId,
  bucket,
  noun,
  onExtracted,
  onComplete,
}: SmartFillProps) {
  const [phase, setPhase] = useState<'offer' | 'running' | 'filled' | 'skipped'>('offer')
  const [error, setError] = useState<string | null>(null)
  const [retake, setRetake] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ fileName: string; sizeKb: number } | null>(null)
  const [count, setCount] = useState(0)

  const doc = useMemo(
    () =>
      docId
        ? app.documents.find((d) => d.id === docId)
        : app.documents.find((d) => match.test(d.label) && (!bucket || bucket.test(d.bucketId))),
    [app.documents, match, docId, bucket],
  )

  // Every hook runs unconditionally — the "no such document" case is handled
  // after them, not by an early return above them.
  const capture = useMemo(
    () =>
      doc && picked
        ? runCapture(doc, picked.fileName, picked.sizeKb, extractionContext(app, doc))
        : null,
    [app, doc, picked],
  )
  const results = useMemo<AgentResults>(
    () => (doc && capture ? (runDocumentSwarm(app, doc, capture) as AgentResults) : {}),
    [app, doc, capture],
  )
  const plan = useMemo(
    () =>
      doc && picked
        ? planRun('document', app.appId, `${doc.id}|${picked.fileName}|${picked.sizeKb}`, {
            forCustomer: true,
          })
        : null,
    [app.appId, doc, picked],
  )

  // No such document on this file's checklist — say nothing rather than offer
  // an upload that has nowhere to go.
  if (!doc) return null

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const sizeKb = Math.max(1, Math.round(f.size / 1024))
    setError(null)

    const check = checkFile(f.name, sizeKb)
    if (!check.ok) {
      setError(check.message ?? null)
      return
    }

    // Quality gate BEFORE the agents run. There is no point spending three
    // lanes on a photo we already know is unreadable.
    const probe = runCapture(doc!, f.name, sizeKb)
    if (probe.verdict === 'retake') {
      setRetake(probe.retakeReason ?? 'Let’s try that photo again.')
      return
    }

    setRetake(null)
    setPicked({ fileName: f.name, sizeKb })
    setCount((c) => c + 1)
    setPhase('running')
  }

  // ---- running ------------------------------------------------------------
  if (phase === 'running' && plan && capture) {
    return (
      <div className="mb-6">
        <AgentSwarm
          key={count}
          plan={plan}
          results={results}
          title="Reading your document"
          intro="Three checks run at the same time. This takes a few seconds."
          audience="customer"
          onComplete={(r) => {
            onExtracted(fieldsFromRun(r as Record<string, never>), doc)
            onComplete?.(r, doc, capture)
            setPhase('filled')
          }}
        />
      </div>
    )
  }

  // ---- filled -------------------------------------------------------------
  if (phase === 'filled') {
    return (
      <GCard tone="ok" className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="display text-[15px] font-semibold leading-[21px]">
              We’ve filled this in from {noun}
            </p>
            <p className="mt-1 text-[14px] leading-[21px] text-[var(--grey-600)]">
              Have a look through and change anything we got wrong.
            </p>
          </div>
          <GChip tone="ok">Received</GChip>
        </div>
        <div className="mt-3">
          <GButton
            size="sm"
            tone="secondary"
            onClick={() => {
              setPicked(null)
              setPhase('offer')
            }}
          >
            Upload a different one
          </GButton>
        </div>
      </GCard>
    )
  }

  // ---- skipped ------------------------------------------------------------
  if (phase === 'skipped') {
    return (
      <GCard tone="support" className="mb-6">
        <p className="text-[14px] leading-[21px]">
          No problem — type it in below. We’ll ask for {noun} later to check it
          against what you’ve told us.
        </p>
        <div className="mt-3">
          <GButton size="sm" tone="secondary" onClick={() => setPhase('offer')}>
            Actually, let me upload it
          </GButton>
        </div>
      </GCard>
    )
  }

  // ---- offer --------------------------------------------------------------
  return (
    <GCard tone="info" className="mb-6">
      <p className="display text-[16px] font-semibold leading-[22px]">
        Save yourself the typing
      </p>
      <p className="mt-1 text-[14px] leading-[21px]">
        Upload {noun} and we’ll read the details off it. You can still change
        anything before you carry on.
      </p>

      {retake ? (
        <p className="mt-3 rounded-lg bg-[#fdf6ea] p-3 text-[14px] leading-[21px] text-[var(--glib-grey)]">
          {retake}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <GError what={error} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <label className="block">
          <span className="sr-only">Upload {noun}</span>
          <input
            type="file"
            accept={POLICY.uploadAcceptedTypes.map((t) => `.${t}`).join(',')}
            onChange={onPick}
            className="peer sr-only"
          />
          <span className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border border-[var(--glib-blue)] bg-[var(--glib-blue)] px-5 text-[15px] font-semibold text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--glib-blue)]">
            Upload {noun}
          </span>
        </label>

        <GButton block tone="quiet" onClick={() => setPhase('skipped')}>
          I’ll type it myself
        </GButton>
      </div>

      <p className="mt-3 text-[12px] leading-4 text-[var(--grey-600)]">
        {POLICY.uploadAcceptedTypes.join(', ').toUpperCase()} · up to{' '}
        {POLICY.uploadMaxMb} MB
      </p>
    </GCard>
  )
}
