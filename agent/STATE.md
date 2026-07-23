# Project state — read this to resume

The living snapshot of this project: where it is, what was decided and why, what
is still open, and the non-obvious things that will bite you. Any agent (or
person) should be able to read this file plus [AGENTS.md](../AGENTS.md) and
continue work without any other context.

**Keep this current.** When you finish a meaningful change, update the relevant
section here — this file *is* the handoff between sessions and between tools.

_Last updated: 2026-07-23._

## Current status

- The site is **live** at <https://ajal2.github.io> and the pipeline runs itself:
  ticking `Live` in Notion publishes on the next sync with no repo edits.
- Content model is settled: **one** Notion database → **one** Astro collection
  (`stories`). The older second pipeline (a bot that drafted project pages from
  GitHub READMEs) and the dead `experience`/`education` collections were removed —
  everything is a Notion story now.
- Local `main`, `origin/main`, and Notion are in sync. Build is green; photos are
  optimized (site ~1.8 MB total, down from 8.5 MB).
- The story mirror (`src/content/stories/*.md`) and live photos are now **tracked**
  in git — CI commits them when it syncs. Unpublished rows remain untracked and
  must stay that way (see the leak-check guardrail in AGENTS.md).

## Decisions and their rationale (the "why" the code can't tell you)

- **Publish gate is a single `Live` checkbox**, not the old 4-value status select.
  Simplest possible control; the status select still exists in Notion as personal
  tracking but the site ignores it.
- **Desk placement is by Notion `created_time`, oldest first.** Considered and
  rejected: hashing slug→cell (collisions) and sorting by slug (adding one story
  reshuffles the whole desk). Seniority means a new row always sorts last and
  never moves existing prints. This is guarded by `npm test`.
- **The schema is intentionally permissive.** The person editing Notion is doing
  it fast, from a phone. Anything derivable is derived by the sync (a blank slug
  fills from the name; a blank stamp from org + year); a missing optional field
  degrades the page rather than blocking a publish. One bad row is skipped and
  reported, never aborting the others.
- **Zero-live safety guard:** if Notion returns zero live rows while the site
  currently has stories, the sync refuses to prune and leaves the site up — a lost
  token or a renamed property is far likelier than a deliberate "unpublish
  everything." Override with `--allow-empty` if it was intentional.
- **Type: Fraunces (serif) is the site's voice; Courier Prime is the "typed
  artifact" voice** (desk props, stamps, small labels). Do not set body copy in
  Courier — that monospace-everywhere look is what the redesign moved away from.
  Full rationale in [DESIGN_GUIDE.md](DESIGN_GUIDE.md).
- **Images are resized in the sync (sharp), not at build time via `astro:assets`.**
  The sync commits photos to the repo, so optimizing at build would leave the
  multi-MB originals in git history forever; doing it in the sync keeps them out.

## Gotchas (real ones that cost time)

- **`sharp` is a declared `devDependency` on purpose.** It's only a *transitive
  optional* dep of Astro, so `npm ci --omit=optional` drops it and the sync
  crashes at import. Don't remove it as "unused."
- **The card styles live in `src/styles/cards.css`, imported from `Head.astro`** —
  not in a `<style>` block inside `StoryCards.astro`. Astro silently dropped a
  component style block that contained only global rules, so The Files and the tag
  pages rendered unstyled. Keep card CSS in the stylesheet.
- **Theme is set on `<html>` by a tiny inline script in `Head.astro` before first
  paint**, and the dark palette selector is `:root[data-theme='dark']`. If you
  ever move it back to `<body>`, move the desk lamp rule too, or dark mode flashes.
- **`body { overflow-x: clip }`** (in `tokens.css`) stops decorative overhang
  (card tape, desk props) from creating a horizontal scrollbar. It must be `clip`,
  not `hidden` — `hidden` creates a scroll container and breaks the story page's
  sticky rail.
- **Below 1100px the desk is hidden** (`display:none`) and a plain card list shows
  instead; the scaled 1440px desk becomes unreadable (~3px captions) on a phone.
  The homepage nav shows its theme button only in that narrow mode.
- **Headless-Chrome screenshots clamp to a ~500px minimum window.** A
  `--window-size=390,844` does *not* give a 390px viewport — don't trust it for
  phone testing.
- **`npm run dev` shows unpublished rows.** The publish gate is
  `isPublished = live || import.meta.env.DEV`, so dev renders everything, live or
  not. Production shows only `Live` rows — never confirm a "why isn't it
  publishing" fix in dev; check the real build / the live site.

## Open questions / parked decisions

- **Hosting model is undecided.** The site is a static build on GitHub Pages, so
  Notion content only appears after the twice-daily sync commits it (or a manual
  run). A discussed alternative is moving to Vercel (like a sibling project) to
  fetch Notion at request/revalidation time — instant updates, far less
  machinery — at the cost of the `ajal2.github.io` address (would need a custom
  domain) and solving Notion's ~1-hour signed-image-URL expiry. **Parked, not
  chosen. Don't act on it without the owner.**
- **The Notion integration is currently read-only.** The `Sync` / `Sync note`
  columns (meant to report per-row publish status back into Notion) therefore stay
  blank. Enabling "Update content" on the integration turns them on; publishing
  works fine without it.
- A couple of on-desk stories have no "flip note," so the back of those prints
  reads thin. Cosmetic; a content fix in Notion, not code.

## Recent history (most recent first)

- **Perf + cleanup sweep** — image optimization in the sync (8.5 MB → 1.8 MB),
  fixed a stale-field bug that stamped every story "DRAFT," killed a dark-mode
  flash, added the mobile card fallback, removed an unused SDK dependency, and
  rewrote stale docs.
- **Desk auto-placement + single-checkbox publishing** — replaced a hand-authored
  slug→position map with automatic placement; made Notion the true single source
  of truth; hardened the sync (skip-bad-row, zero-live guard, GitHub-issue alerts).
- **Design system + Fraunces** — centralized all color/type into `tokens.css`,
  swapped the type to an editorial serif.
- **The redesign** — the whole "field journal" desk site and the Notion pipeline.

## How to resume (a checklist for the next agent)

1. Read this file, then [AGENTS.md](../AGENTS.md).
2. Run `git status` and `git log --oneline -5` yourself — trust the real tree, not
   any snapshot your tool hands you at startup (those can be stale).
3. `npm install && npm run build && npm test` — confirm a clean baseline.
4. To see real content locally, run the sync in `--drafts` mode (needs a
   `NOTION_TOKEN`; see [SYNC.md](SYNC.md)). Do not commit draft output.
5. Make your change, `npm run build` to validate, leak-check, then commit.
