// ============================================================================
// CSV export (§v2 req 7) — dependency-free Blob download.
// ============================================================================

/** Escape one cell: quote when needed, and neutralise formula injection.
 *  A cell starting with = + - @ is executed by Excel/Sheets on open, so it is
 *  prefixed with an apostrophe. */
export function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export interface CsvColumn<T> {
  key: string
  header: string
  csv?: (row: T) => unknown
  get?: (row: T) => unknown
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[], totals?: Record<string, unknown>): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((r) =>
    columns.map((c) => escapeCell((c.csv ?? c.get)?.(r))).join(','),
  )
  const lines = [head, ...body]
  if (totals) {
    lines.push(columns.map((c) => escapeCell(totals[c.key] ?? '')).join(','))
  }
  // BOM so Excel reads UTF-8 (₹, ≤, — survive intact).
  return '﻿' + lines.join('\r\n')
}

/** Minimal shape of the published-artifact host — see downloads.d.ts. */
interface SaveHost {
  use?: (name: string) => Promise<{ save(r: { filename: string; data: string }): Promise<unknown> } | null>
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  void deliver(filename, text, mime)
}

/** A viewer reading this as a published artifact cannot receive a download the
 *  page starts itself — the host mediates saves instead. Everywhere else (dev
 *  server, standalone HTML file) the ordinary blob download is used unchanged. */
async function deliver(filename: string, text: string, mime: string): Promise<void> {
  const host = (globalThis as unknown as { claude?: SaveHost }).claude
  if (host?.use) {
    try {
      const downloads = await host.use('downloads')
      if (downloads) {
        try {
          await downloads.save({ filename, data: text })
        } catch (err) {
          // `csv` sits in the host's extended extension set and may not be
          // enabled; the same bytes under `.txt` still open in Excel.
          const code = (err as { code?: string })?.code
          if (code === 'extension_not_enabled' || code === 'rejected_extension') {
            await downloads.save({ filename: filename.replace(/\.[^.]+$/, '') + '.txt', data: text })
          }
          // `declined` and the rest are the viewer's call — never retry.
        }
        return
      }
    } catch {
      // Host present but unusable — fall through to the direct download.
    }
  }
  directDownload(filename, text, mime)
}

function directDownload(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(filename: string, csv: string): void {
  downloadText(filename, csv, 'text/csv;charset=utf-8')
}

/** `stage-register_2026-07-20.csv` */
export function stampedName(base: string, nowIso: string, ext = 'csv'): string {
  const d = nowIso.slice(0, 10)
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${d}.${ext}`
}
