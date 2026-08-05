# ajal2.github.io

Personal site of Aryan Jalota. Astro, vanilla CSS, hosted on GitHub Pages.
Live at <https://ajal2.github.io>.

**Notion is the content.** Every story on this site is a row in the Notion
database "The Filing Cabinet". You publish by ticking a checkbox there; nothing
in this repo is edited to put something on the site. Full runbook:
[agent/SYNC.md](agent/SYNC.md).

## Map

```
src/content/stories/*.md     the Notion mirror (generated, never hand-edited)
public/photos/stories/       story photos, resized to webp by the sync
agent/sync-stories.mjs       the whole pipeline: Notion → markdown + photos
agent/story-schema.mjs       the field contract (deliberately permissive)
src/pages/index.astro        the desk homepage
src/pages/[tag]/index.astro  a section per Notion tag, generated from the data
src/data/desk-slots.json     desk positions only, no story names
src/lib/desk.mjs             deals prints into those positions by seniority
src/styles/tokens.css        the design system (Fraunces + Courier Prime)
.github/workflows/           deploy.yml (push → Pages) · stories-sync.yml (2×/day + manual)
```

## How updates work

- **Publish a story**: tick `Live` on the row in Notion. `Live` is the master
  switch: an un-Live row is never mirrored, so nothing else takes effect until
  it's ticked. The sync picks it up on the next run (02:43 / 14:43 UTC) or
  immediately via Actions → "Stories sync" → Run workflow. Untick to take it down.
- **Feature it on the desk**: tick `On desk` (on a `Live` row). The position is
  assigned automatically; a new story never moves the prints already there.
- **Add a section**: add a `Tag`. `/experience/`, `/case-study/` etc. and their
  nav links are generated from whatever tags exist.
- **Change the code**: push to `main` → Actions builds and deploys.

Requires repo secret `NOTION_TOKEN` (an internal Notion integration connected to
The Filing Cabinet). See the one-time setup in [agent/SYNC.md](agent/SYNC.md).

## Local

```sh
npm install
npx astro dev --background                                   # localhost:4321
npx astro build
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --dry-run    # read Notion, write nothing
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --drafts     # mirror unpublished rows too
```

## Conventions

[AGENTS.md](AGENTS.md) is where to start before touching anything;
[agent/DESIGN_GUIDE.md](agent/DESIGN_GUIDE.md) covers colour and type,
[agent/STYLE_GUIDE.md](agent/STYLE_GUIDE.md) the writing voice.
