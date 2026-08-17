// ============================================================================
// Standalone single-file HTML (delivery surface 2).
//
//   node scripts/build-standalone.mjs [outPath]
//
// Two things have to be true for the file to work by double-click:
//
//  1. NO `type="module"`. A module script fetched over `file://` is blocked by
//     CORS, and the page renders blank. (This one the dashboard already knew.)
//
//  2. The script must run AFTER `#root` exists. `vite-plugin-singlefile` inlines
//     it into `<head>`, and an INLINE script cannot be deferred — `defer` is
//     ignored on inline scripts — so removing `type="module"` (which defers
//     implicitly) would make it execute before the body is parsed. That is
//     handled in `src/main.tsx`, which waits for DOMContentLoaded. Rewriting the
//     built HTML to move script tags was tried first and is NOT safe: the
//     bundle contains `</script>` inside string literals, so any regex that
//     tries to find the end of the inline script cuts it in the wrong place.
//
// Fonts are built with BUILD_FONTS=none for this surface: `fonts.css` is a
// dynamic import, so it becomes a second chunk that the single-file inliner
// leaves as an external reference. The system stack takes over and the layout
// is identical — verified, not assumed (see docs/ACCEPTANCE-JOURNEYS.md).
// ============================================================================
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const out = process.argv[2] ?? resolve(homedir(), 'Downloads', 'glibmoney-journeys.html')

execSync('./node_modules/.bin/vite build --mode singlefile', {
  stdio: 'inherit',
  env: { ...process.env, VITE_BUILD_FONTS: 'none' },
})

let html = readFileSync('dist/index.html', 'utf8')

// 1. Drop the module type.
html = html.replace(/<script\s+type="module"/g, '<script')

const external = html.match(/(?:src|href)="[.\/]*assets\//g) ?? []
if (external.length > 0) {
  console.error(`✗ ${external.length} external asset reference(s) left — the file is not self-contained.`)
  process.exit(1)
}

writeFileSync(out, html)
console.log(`✓ ${out} — ${(html.length / 1048576).toFixed(2)} MB, self-contained`)
