# How the website works

Notion is the website. You edit rows in **The Filing Cabinet**; the site rebuilds
itself. Nobody edits this repo to publish anything — not you, not an AI agent.

```
Notion "The Filing Cabinet"          write, tick Live, drag photos in
        │  twice daily, or on demand
        ▼
agent/sync-stories.mjs               (GitHub Actions)
        │  writes src/content/stories/*.md + public/photos/stories/<slug>/
        ▼
astro build → GitHub Pages           the site updates
```

## Publishing something

1. Write the row in Notion.
2. **Tick `Live`.** That's it.

Untick `Live` to take it down again. It ships on the next scheduled sync
(02:43 and 14:43 UTC), or immediately via **GitHub → Actions → Stories sync →
Run workflow**.

## Where it shows up

**`Live` is the master switch.** An un-Live row is never mirrored, so `On desk`
and `Tags` do nothing on their own — tick `Live` first, then:

| Also tick / fill | Where it appears (once `Live`) |
|---|---|
| _nothing else_ | `/files/` — the index of everything |
| `On desk` | a polaroid on the homepage desk, **placed automatically** |
| a `Tags` value | that tag's section, e.g. `Experience` → `/experience/` |

> The single most common "why isn't it showing?" is a row that's `On desk` but
> not `Live`. On desk without Live = invisible.

Tags build the sections. Invent a new tag in Notion and a new section and nav
link appear by themselves. Nothing to configure — but a tag joins a section only
on an **exact** text match: `Case Study` and `case study` become two different
sections whose URLs collide (`/case-study/`), which breaks the build. Reuse the
existing spelling.

The desk holds 8 prints. Tick a 9th and nothing breaks — the extras show up as
a **"+N more prints — in the files"** chit on the desk, linking to `/files/`.
Prints are dealt oldest-row-first, so adding a new story never moves the ones
already there.

## The only field you must fill

**`Name`.** Everything else is optional and degrades:

- `Slug` — leave blank; it fills itself from the Name on the first sync, and
  stays fixed after that. (It's the page URL, so changing it later changes the
  address.)
- `Stamp` — leave blank; it's built from `Org` + the year. Straight apostrophes
  are corrected to the house curly form automatically.
- `Card line` / `Flip note` — the front and back of a desk polaroid. A print
  without them still renders; it just reads better with them.
- `Period`, `Org`, `Tags`, photos, `Related stories` — all optional.

## Photos

Drop them in the **`Photo`**, **`Proof 1`**, **`Proof 2`** properties — never
paste an image into the page body (it will be skipped, and the sync tells you).

- `Photo` is the one visual: the polaroid and the story's lead image.
- `Proof 1` / `Proof 2` are work exhibits, with their captions.
- JPG, PNG or WebP. **Not HEIC** — drag out of Apple Photos to convert.

## How you know it worked

Look at the **`Sync`** column in Notion after a run:

| `Sync` | Means |
|---|---|
| **OK** | published |
| **Check** | published, but read `Sync note` — something's thin (e.g. a desk print with no Flip note) |
| **Blocked** | *not* published — `Sync note` says why, in plain words |

One bad row never blocks the others: the rest publish and only that row is held
back. If the whole sync fails (expired token, lost Notion access), GitHub opens
an issue titled **"Notion sync is failing"** and emails you — and the site stays
on its last good version rather than emptying out.

## One-time setup (already done, recorded here in case it must be redone)

1. notion.so/profile/integrations → internal integration `site-sync`, with
   **Read content** *and* **Update content** (Update is what lets the sync write
   the `Sync` column back; without it publishing still works, you just don't get
   the status back in Notion).
2. Notion → The Filing Cabinet → `⋯` → **Connections** → add `site-sync`.
   Missing this makes the token authenticate but see nothing.
3. `gh secret set NOTION_TOKEN --repo ajal2/ajal2.github.io`

## Running it locally

```bash
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --dry-run   # read + report only
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs             # publish Live rows
NOTION_TOKEN=ntn_... node agent/sync-stories.mjs --drafts    # include unpublished, for preview
npx astro dev --background                                   # look at it
```

`--drafts` mirrors every row so the dev server can preview unfinished stories.
It refuses to run in CI, and a later CI sync prunes the extra files.

## Where things live

- `agent/sync-stories.mjs` — the whole pipeline. No AI in it.
- `agent/story-schema.mjs` — the field contract. Deliberately permissive: a
  missing optional field degrades the page, it never blocks a publish.
- `src/content/stories/*.md` + `public/photos/stories/` — the mirror. Never edit
  by hand; the next sync overwrites it. Edit in Notion.
- `src/data/desk-slots.json` — desk positions, **with no story names in it**.
  Prints are dealt into these cells automatically. Touch it only to redesign the
  desk composition, never to publish.
- `src/lib/desk.mjs` — the placement rule (oldest row first, so new stories
  never shuffle old ones). `pin` in desk-slots.json can freeze one story to one
  cell if a specific spot ever matters.
- `agent/DESIGN_GUIDE.md` — colours and type. `agent/STYLE_GUIDE.md` — writing
  voice.

## Extending the sync (adding a field)

Each Notion property is read by a typed helper in `sync-stories.mjs` (`prop.*`).
Use the one that matches the property's Notion **type**, or you get `undefined`
back with no error:

| Notion property | Type | Reader |
|---|---|---|
| Name | title | `prop.title` |
| Slug, Stamp, Card line, Flip note, Proof N caption | rich_text | `prop.rich` |
| Org | select | `prop.select` |
| Tags | multi_select | `prop.multi` |
| Live, On desk | checkbox | `prop.check` |
| Period | date | `prop.date` |
| Photo, Proof 1, Proof 2 | files | `prop.file` |

To add a field end to end: read it in the row loop, add it to the `story`
object, add it to `frontmatter()`, add it to the zod schema in
`story-schema.mjs` (**optional**, per the permissive rule), then use it in the
page template. Validate with `npm run build`.

**Gotcha:** a `select`/`status` type change is guarded, but **renaming a
checkbox column** (`Live`, `On desk`) is not — `prop.check` just returns `false`
and the row silently drops off the site with nothing in the logs. If a print
vanishes for no reason, check the Notion column names first.

## The safety net

The mirror is authoritative: rows that stop being `Live` are deleted from the
site. That power is guarded — if Notion returns **zero** live rows while the
site currently has stories, the sync refuses and leaves the site untouched, on
the assumption that a lost token or renamed property is far likelier than a
deliberate unpublish-everything. Override with `--allow-empty` if you really
did mean it.
