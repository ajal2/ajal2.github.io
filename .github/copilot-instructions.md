# Copilot instructions

**[AGENTS.md](../AGENTS.md) at the repo root is the canonical guide — read it and
[agent/STATE.md](../agent/STATE.md) first.** This file only restates the two rules
that must never be missed:

1. **Notion is the content.** Every story is a row in a Notion database, mirrored
   into `src/content/stories/*.md` and `public/photos/` by `agent/sync-stories.mjs`.
   Those files are generated — never hand-edit them to change content, and never
   add a page to "publish" something. Publishing happens by ticking a checkbox in
   Notion, not in this repo.

2. **This is a public repo; never `git add -A`.** Unpublished Notion rows sit
   locally as untracked files that may contain unscrubbed client material. Stage
   explicit paths and leak-check before committing:
   `git diff --cached --name-only | grep -E '^(src/content/stories/|public/photos/|\.env)'`

Validate any change with `npm run build` (green build = the bar) and `npm test`.
