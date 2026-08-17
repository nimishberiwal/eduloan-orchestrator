// ============================================================================
// useDeclaration (§Phase C) — the plumbing every detail screen shares.
//
// A screen collects some facts. Either a document evidenced them (SmartFill ran
// and the extraction agent read the page) or the customer typed them and owes
// us the document later. Both paths end in `ExtractedField`s on the
// application; only `selfDeclared` and `match` differ.
//
// Screens call `commit()` once, at the end, with what the customer is actually
// submitting — which may be the extracted values, or the extracted values the
// customer then corrected, or something typed from scratch. That ordering
// matters: the value recorded is always what is on screen at submit time, not
// what the agent proposed.
// ============================================================================
import { useCallback, useRef, useState } from 'react'
import type { Application, DocumentItem, PartySection } from '@/types'
import type { CaptureResult } from '@/types/journeys'
import type { AgentResults } from '@/lib/agents/types'
import { useStore } from '@/store/appStore'
import { useJourney } from '@/journeys/useJourney'
import { declareEvidenced, declareSelfReported, type DeclarationSpec } from '@/lib/declared'
import { fieldsFromRun } from '@/lib/agents/documents'

export interface UseDeclarationOpts {
  section: PartySection
  group: string
  backingMatch: RegExp
}

export interface Declaration {
  /** True once a document has been read for this screen. */
  evidenced: boolean
  /** Hand to `SmartFill.onComplete`. */
  onSwarmComplete: (results: AgentResults, doc: DocumentItem, capture: CaptureResult) => void
  /** Call once, on submit, with the values as they stand on screen. */
  commit: (fields: DeclarationSpec['fields']) => void
}

export function useDeclaration(
  app: Application,
  opts: UseDeclarationOpts,
): Declaration {
  const record = useStore((s) => s.recordDeclaredFields)
  const uploadDocument = useStore((s) => s.uploadDocument)
  const { actor } = useJourney({
    appId: app.appId,
    partyRole: opts.section === 'co_applicant' ? 'co_applicant' : 'applicant',
    surface: 'customer',
  })

  const [evidenced, setEvidenced] = useState(false)
  // Refs, not state: these are read inside `commit`, and a stale closure here
  // would silently record the wrong provenance.
  const readRef = useRef<Record<string, string>>({})
  const docRef = useRef<DocumentItem | null>(null)

  const onSwarmComplete = useCallback(
    (results: AgentResults, doc: DocumentItem) => {
      readRef.current = fieldsFromRun(results as Record<string, never>)
      docRef.current = doc
      setEvidenced(true)
      // The document genuinely arrived, so it moves through the SAME verb an
      // ordinary upload uses. The checklist must not be able to disagree with
      // the fact that a page was read.
      uploadDocument(app.appId, doc.id, {
        fileName: `smartfill-${doc.id}`,
        sizeKb: 0,
        actor,
      })
    },
    [app.appId, uploadDocument, actor],
  )

  const commit = useCallback(
    (fields: DeclarationSpec['fields']) => {
      const spec = { ...opts, fields }
      const doc = docRef.current
      const built =
        evidenced && doc
          ? declareEvidenced(app, spec, readRef.current, doc.id)
          : declareSelfReported(app, spec)
      record(app.appId, built, actor, opts.group)
    },
    [app, opts, evidenced, record, actor],
  )

  return { evidenced, onSwarmComplete, commit }
}
