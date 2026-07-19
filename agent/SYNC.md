# Stories: how content gets from Notion to the site

No AI is involved in this pipeline. Notion is the CMS; this repo renders it.

## The flow

```
Notion "The Filing Cabinet"          (write, edit, drag photos in)
        │  only rows with Status = Filed
        ▼
agent/sync-stories.mjs               (runs twice daily in CI, or manually)
        │  writes src/content/stories/*.md + public/photos/stories/<slug>/
        ▼
astro build → GitHub Pages           (site rebuilds and deploys)
```

To publish a story: flip its Status to `Filed` in Notion. Done — it ships on
the next scheduled run. To publish *now*: GitHub → Actions → "Stories sync"
→ Run workflow. To unpublish: flip Status back; the next sync deletes the
page and its photos from the repo.

## The rules (enforced by the sync — it aborts with a message if broken)

- Only `Filed` rows ever leave Notion. The repo is public: half-written or
  unscrubbed drafts stay in Notion, invisible.
- `Slug` is permanent. It's the page URL and the join key to desk layout.
- All images live in **table properties** — never in the page body:
  - `Photo` — the one visual (polaroid on the desk / lead on the page)
  - `Proof 1` + `Proof 1 caption` — work exhibit (slide, deliverable)
  - `Proof 2` + `Proof 2 caption` — optional second exhibit or visual
  A proof without its caption, or an image dropped into a page body, aborts
  the sync. Page bodies are pure prose.
- Images must be JPG/PNG/WebP (not HEIC — drag out of Apple Photos to
  convert). Upload originals; the build handles sizing.
- Desk rows (`On desk` checked) need both a Card line (the polaroid front)
  and a Flip note (its back — also the quote on case-study index cards).

## One-time setup (needed before the first run)

1. Create an internal integration at notion.so/profile/integrations
   (name it e.g. `site-sync`; read access is enough).
2. In Notion, open The Filing Cabinet page → ⋯ menu → Connections →
   add `site-sync`.
3. GitHub repo → Settings → Secrets and variables → Actions → new secret
   `NOTION_TOKEN` = the integration secret.

## Running locally

```bash
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --dry-run   # validate only
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs             # sync Filed stories
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --drafts    # + drafts, for local preview
npx astro dev                                                # look at it
```

`--drafts` mirrors every status so the dev server can preview unfinished
stories (the published build still renders Filed only). It refuses to run
in CI, and a later CI sync prunes draft files — don't commit them.

`agent/story-archive/` holds a frozen copy of the original 13 seeded
stories (the 11 desk prints from the Claude Design handoff + 2 project
stubs) taken 2026-07-18 before the Notion cleanup — re-seed from here if
the desk prints are ever wanted back in Notion.

## Where things live

- `agent/story-schema.mjs` — the field contract (Notion ↔ repo, one source
  of truth). Change the Notion schema → change this file to match.
- `src/content/stories/*.md` — the mirror. Never edit by hand; the next
  sync overwrites it. Edit in Notion.
- `public/photos/stories/<slug>/` — downloaded photos (`photo.*` = the
  visual, `exhibit-N.*` = proofs). Also sync-owned.
- `src/data/desk-layout.json` — print positions/rotation/tape-pin for the
  homepage desk. Repo-owned on purpose: a Notion edit can change what a
  print says, never where it sits.
- `src/pages/stories/[slug].astro` — the one template every story page
  uses. `src/pages/files/index.astro` — The Files index, the guaranteed
  route into every story (membership = every Filed story; it's data, not
  curation — tags show on the cards).
