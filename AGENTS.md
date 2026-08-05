# AGENTS.md

Instructions for any coding agent working in this repo: Claude, Cursor, Codex,
Copilot, Gemini, whatever. This file is the single source of truth for how to
work here; tool-specific files just point back to it. Written to be enough on
its own: you do not need any external memory or chat history to be productive.

**If you read one thing before starting, make it [agent/STATE.md](agent/STATE.md)**:
the living snapshot of where the project is, what was decided and why, the open
questions, and the known gotchas. It is the "pick up where the last session left
off" file.

## What this is

`ajal2.github.io` is Aryan Jalota's personal portfolio: a static
[Astro](https://astro.build) site deployed to GitHub Pages. It renders as a
"field journal": a desk homepage strewn with draggable polaroid "prints," one
per story, plus per-tag section pages and a combined index.

**The one rule that governs everything: Notion is the content.** Every story is
a row in a Notion database. You publish by ticking a checkbox in Notion; nobody
edits this repo to add, change, or remove content. A sync job pulls Notion into
the repo as generated files. Understand this before touching anything.

## Quickstart

```sh
npm install
npm run dev        # http://localhost:4321, live-reload dev server
npm run build      # static build into dist/ (this is also the typecheck/validation)
npm test           # invariant checks (node's built-in runner, no extra deps)
```

Node ≥ 22.12 (see `engines`). There is no separate lint/typecheck step;
`npm run build` validates the content collections against the schema and fails
on type or schema errors, so **a green `npm run build` is the bar for "it works."**

## Architecture: the data flow

```
Notion "The Filing Cabinet"  (the CMS; a human edits rows, ticks "Live")
        │  agent/sync-stories.mjs   ← twice-daily GitHub Action, or manual/local
        ▼
src/content/stories/<slug>.md      ← the mirror: generated frontmatter + body
public/photos/stories/<slug>/*.webp ← photos, downloaded + resized by the sync
        │  astro build
        ▼
dist/  →  GitHub Pages (ajal2.github.io)
```

Two GitHub workflows in `.github/workflows/`:
- **`stories-sync.yml`**: runs `agent/sync-stories.mjs` on a cron (`43 2,14 * * *`,
  twice daily) and on manual dispatch. It commits any content changes and
  triggers a deploy. On failure it opens/updates a GitHub issue titled
  "Notion sync is failing" (and closes it on the next success).
- **`deploy.yml`**: builds and deploys to Pages on push to `main`.

Key files:

| Path | Role |
|---|---|
| `agent/sync-stories.mjs` | The whole Notion→repo pipeline. No AI in it. |
| `agent/story-schema.mjs` | The story field contract (zod). Deliberately permissive. |
| `src/content.config.ts` | Astro content collection: imports the schema above. There is exactly one collection: `stories`. |
| `src/pages/index.astro` | The desk homepage + all its interaction JS. |
| `src/pages/[tag]/index.astro` | One section page per Notion tag, generated from the data. |
| `src/pages/files/index.astro` | The combined "everything" index. |
| `src/pages/stories/[slug].astro` | One template for every story page. |
| `src/components/StoryCards.astro` | The shared card grid (Files + tag pages + narrow homepage). |
| `src/components/Head.astro` | The one place fonts, tokens, and `cards.css` are imported. Every route funnels through it. |
| `src/lib/desk.mjs` | Assigns each print a desk position (see invariants). |
| `src/lib/stories.mjs` | `isPublished` (the publish gate) + tag helpers. |
| `src/lib/story-body.mjs` | Parses a story's markdown body into the page's shape. |
| `src/data/desk-slots.json` | Desk positions: **positions only, no story names**. |
| `src/data/site.json` | Identity: name, links, email. |
| `src/styles/tokens.css` | The design system (colors, fonts, type scale, base). |

## Guardrails: do NOT break these

These are load-bearing. Several have already caused real incidents.

1. **Never hand-edit the Notion mirror to change content.** `src/content/stories/*.md`
   and `public/photos/stories/` are *generated*; the next sync overwrites them.
   Content changes happen in Notion. (Editing the mirror is fine only as a
   throwaway to preview a rendering locally, never commit it as "content.")

2. **Never `git add -A` / `git add .` blindly. Leak-check first.** This is a
   **public** repo. Unpublished Notion rows are mirrored locally as untracked
   files (`src/content/stories/*.md`, `public/photos/`) and may contain
   unscrubbed client material. They are deliberately **not** gitignored (CI
   commits the *live* ones). Before every commit run:
   ```sh
   git diff --cached --name-only | grep -E '^(src/content/stories/|public/photos/|\.env)' && echo "STOP, review this" || echo "clean"
   ```
   Stage explicit paths, not wildcards.

3. **Publishing is a human decision. An agent must not tick `Live` in Notion.**
   Some rows are client engagements; whether they go public is Aryan's call.

4. **`src/data/desk-slots.json` contains positions only, no slugs.** Placement
   is assigned in `src/lib/desk.mjs` by Notion `created_time` (oldest first) so a
   new story can never reshuffle existing prints. Do **not** re-introduce a
   slug→position map, hashing (collides), or slug-sorting (reshuffles). `npm test`
   guards this.

5. **The story schema is permissive on purpose.** Missing optional fields must
   degrade the page, never block a publish or abort the sync. Do not re-tighten
   it, and do not re-close `tags` into an enum, a new tag in Notion must create a
   new section with zero code change.

6. **Fonts and design tokens are imported exactly once, in `src/components/Head.astro`.**
   Never re-import `@fontsource/*`, `tokens.css`, or `cards.css` elsewhere. See
   [agent/DESIGN_GUIDE.md](agent/DESIGN_GUIDE.md) before restyling anything.

7. **`sharp` must stay a declared `devDependency`.** It resolves transitively via
   Astro's *optional* dependencies; under `npm ci --omit=optional` it vanishes and
   the sync crashes. Do not "clean it up."

8. **Commit or push only when asked.** If you're on `main`, branch first. Code
   reaches production by landing on `main` (a merge or fast-forward), the push
   to `main` is exactly what triggers `deploy.yml`, so treat merging to `main` as
   "deploy." End commit bodies with a `Co-Authored-By` line for whatever tool you are.

## Deeper docs

- [agent/STATE.md](agent/STATE.md): current status, decisions + rationale, open questions, gotchas. **Read first.**
- [agent/SYNC.md](agent/SYNC.md): the Notion→site pipeline in full, and the publishing protocol.
- [agent/DESIGN_GUIDE.md](agent/DESIGN_GUIDE.md): the visual system (color, type, theme).
- [agent/STYLE_GUIDE.md](agent/STYLE_GUIDE.md): the writing voice for story text.
- [README.md](README.md): the human-facing overview (shorter version of this).

Astro reference: <https://docs.astro.build>; routing, components, content
collections, and styling guides.

## Development notes

- The dev server can run in the background: `npm run dev &`, or with the Astro
  CLI's own backgrounding if your tool provides it. Stop it before a fresh build.
- To preview *unpublished* Notion rows locally, run the sync with `--drafts`
  (see `agent/SYNC.md`); it mirrors every row, not just live ones. Never commit
  that output.
