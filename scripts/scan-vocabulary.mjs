#!/usr/bin/env node
// ============================================================================
// Static half of the no-internal-vocabulary check (§0.6).
//
//   node scripts/scan-vocabulary.mjs
//
// Scans the STRING AND JSX TEXT of every customer-facing source file for
// internal vocabulary. Exits 1 on a hit, so it can gate a release.
//
// This is the half that runs without a browser. It catches a literal typed into
// a customer screen. It does NOT catch a leak that only exists once a value has
// been interpolated — `{bucket.code} verified` is invisible here — which is why
// the live DOM walk over CUSTOMER_ROUTES exists alongside it. Both read their
// patterns from src/lib/vocabulary.ts so the two cannot drift.
//
// Console files are deliberately NOT scanned: internal vocabulary is correct
// there. The whole rule is about which surface a word reaches.
// ============================================================================
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

// ---- Patterns, lifted from src/lib/vocabulary.ts ---------------------------
// Parsed out of the TS module rather than duplicated, so there is exactly one
// definition of what counts as internal vocabulary in this repo.
const vocabSrc = readFileSync(join(ROOT, 'src/lib/vocabulary.ts'), 'utf8')
const PATTERNS = [...vocabSrc.matchAll(/name:\s*'([^']+)',\s*\n\s*re:\s*(\/.+\/[gimsuy]*),/g)].map(
  ([, name, literal]) => {
    const lastSlash = literal.lastIndexOf('/')
    return {
      name,
      re: new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1)),
    }
  },
)
if (PATTERNS.length === 0) {
  console.error('Could not parse patterns from src/lib/vocabulary.ts — has its shape changed?')
  process.exit(2)
}

// ---- Which files a customer's eyes can reach -------------------------------
const CUSTOMER_DIRS = ['src/journeys']
const EXCLUDE = [
  'src/journeys/dev', // the harness is for us
  'src/journeys/assisted', // the RM is bank staff
]
/** Files whose internal vocabulary is the point. */
const EXCLUDE_FILES = [
  // Translates internal ids INTO plain language: it necessarily names them.
  'src/journeys/copy.ts',
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (EXCLUDE.some((e) => rel.startsWith(e))) continue
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !EXCLUDE_FILES.includes(rel)) out.push(full)
  }
  return out
}

// ---- Extract only what a customer could read -------------------------------
// Comments are stripped first: this file's own header would otherwise trip
// every pattern in it, and a comment is not a surface.
//
// Then only PROSE is kept. The first version of this scanner reported 38 hits,
// and all but one were identifiers that never reach a screen — event names
// passed to emit('DOCUMENT_UPLOADED'), status values like 'qc_fail', CSS
// constants interpolated into className. A scanner with a 97% false-positive
// rate is worse than no scanner: it teaches its reader to skim past a real hit.
// So a chunk has to look like something a person reads.
function isProse(s) {
  const t = s.trim()
  if (t.length < 6 || !t.includes(' ')) return false // identifiers have no spaces
  if (/[{}=<>]|=>|\$\{|\bclassName\b|^\s*[a-z-]+:/.test(t)) return false // code, or CSS
  if (!/[a-z]{3}/.test(t)) return false // needs real lowercase words
  return true
}

function customerText(src) {
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    // `group: 'Academic (E3)'` is a CONSOLE grouping key that happens to be
    // declared in a customer-facing file. It is passed to useDeclaration as
    // config and stored on ExtractedField.group, where the App-360 Extracted
    // tab renders it — a bank surface, where a bucket code is correct.
    //
    // This exemption is only safe because no customer screen renders it raw.
    // CJ-28 did, as a fallback when the backing document was missing, and this
    // scanner is what found it. If you add a customer surface that shows a
    // group label, remove this line and deal with the seven hits.
    .replace(/\bgroup:\s*'[^']*'/g, ' ')
  const out = []
  // String and template literals.
  for (const m of noComments.matchAll(/'([^'\\\n]{6,})'|"([^"\\\n]{6,})"|`([^`\\]{6,})`/g)) {
    const s = m[1] ?? m[2] ?? m[3]
    if (isProse(s)) out.push(s)
  }
  // JSX text between tags.
  for (const m of noComments.matchAll(/>([^<>{}\n]{6,})</g)) {
    if (isProse(m[1])) out.push(m[1])
  }
  return out
}

const files = CUSTOMER_DIRS.flatMap((d) => walk(join(ROOT, d)))
const leaks = []

for (const file of files) {
  const rel = relative(ROOT, file)
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  for (const chunk of customerText(src)) {
    for (const p of PATTERNS) {
      const m = chunk.match(new RegExp(p.re.source, p.re.flags))
      if (!m) continue
      const lineNo = lines.findIndex((l) => l.includes(chunk)) + 1
      leaks.push({ file: rel, line: lineNo || '?', pattern: p.name, sample: [...new Set(m)].join(', '), chunk: chunk.trim().slice(0, 90) })
    }
  }
}

console.log(`scanned ${files.length} customer-facing files · ${PATTERNS.length} patterns`)
if (leaks.length === 0) {
  console.log('leaks: []')
  process.exit(0)
}
console.log(`leaks: ${leaks.length}\n`)
for (const l of leaks) {
  console.log(`  ${l.file}:${l.line}  [${l.pattern}]  ${l.sample}`)
  console.log(`      "${l.chunk}"`)
}
process.exit(1)
