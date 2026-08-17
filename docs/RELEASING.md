# Releasing

**The standing rule for this repo, set by the owner on 2026-08-16:**

> Every push to GitHub keeps a version of it, with clear documentation of what
> was pushed in that version.

So: **no push without a version.** A commit that reaches `origin/main` gets a
semver tag, a `CHANGELOG.md` entry, and a GitHub Release carrying those notes.
If you are an agent picking this repo up cold, this is not optional and not a
nicety — it is how the owner tracks what shipped.

---

## The procedure

### 1. Verify before you version

A version that says "verified" and wasn't is worse than no version at all.
Minimum bar before tagging:

```bash
./node_modules/.bin/tsc --noEmit          # must be clean
npm run build                             # must be clean
node scripts/build-standalone.mjs /tmp/x.html && rm /tmp/x.html
```

Then re-walk whatever the change touched:

- Anything in `src/journeys/**` or `src/lib/customerTasks.ts` →
  `docs/ACCEPTANCE-JOURNEYS.md`, and check `/__dev/tasks` is green.
- Any customer-facing copy → the internal-vocabulary scanner
  (`HANDOFF-JOURNEYS.md` §7). It must report `leaks: []`.
- Anything in `src/data/**`, `src/store/appStore.ts` or `src/lib/gating.ts` →
  `docs/ACCEPTANCE.md` too. Items 4 and 5 there are the fragile ones.

### 2. Pick the bump

| Bump | When |
|---|---|
| **major** | A new surface, or a change that breaks how the demo is walked |
| **minor** | New screens, new engine capability, new catalogue coverage |
| **patch** | Defect fixes, copy corrections, doc-only changes |

### 3. Write the entry FIRST, then tag

Add a new section at the top of `CHANGELOG.md`, above the previous version.
Every entry carries these, in this order:

- **Added / Changed / Fixed** — what actually changed, in plain terms.
- **Verified** — a table of checks and their *results*. Evidence, not intent.
- **Known / open** — anything left undone, known-broken, or awaiting a decision.
  An empty section is fine; a missing one means you didn't look.

Bump `version` in `package.json` to match.

### 4. Commit, tag, push, release

```bash
VERSION=1.1.0            # no leading v here

git add -A
git commit -m "Release v$VERSION — <one line on what shipped>"
git tag -a "v$VERSION" -m "v$VERSION"
git push origin main --follow-tags

# Release notes come from the changelog entry, so the two can never disagree.
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes-file <(awk "/^## \[$VERSION\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md)
```

Then confirm it landed:

```bash
gh release view "v$VERSION" --json tagName,name,url -q '.tagName + "  " + .url'
```

### 5. If you have to amend

Tags are cheap; rewritten history is not. If a release turns out wrong, cut a
**new patch version** with a `### Fixed` entry explaining what the previous one
got wrong. Do not force-push over a tag that has been shared.

---

## Why the changelog carries "Verified" and "Known / open"

This prototype exists to be reviewed by a product-clearance committee. A
reviewer's first question about any version is *"what does this actually do, and
what do you know is wrong with it?"* — and the honest answer has to be written
down at the moment it was true, not reconstructed later.

Nineteen defects were found in v1.0.0 by walking the browser rather than
trusting that the code looked right. Every one of them typechecked. That is the
standard the **Verified** table has to meet: things that were *checked*, with
their results, not things that were *intended*.
