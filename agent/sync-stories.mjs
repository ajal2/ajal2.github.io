// Mirror the Notion "Filing Cabinet" into src/content/stories/ + photos.
// Runs on a schedule in CI (stories-sync.yml) and locally via
//   NOTION_TOKEN=... node agent/sync-stories.mjs [--dry-run]
// No AI anywhere in this path: Notion is the CMS, Status is the editor.
//
// Rules this script enforces (the "standard way of doing things"):
// - ONLY rows with Status = Filed leave Notion. The repo is public, so a
//   Drafting story (possibly with unscrubbed client names) must never be
//   mirrored, even though the site build would also skip it.
// - Photo convention: three table slots per story — Photo (the one visual,
//   polaroid/lead), Proof 1 and Proof 2 (captioned work exhibits). Bodies
//   are pure prose; an image dropped into a page body is a sync error.
// - The mirror is authoritative: stories and photos that stop being Filed
//   (or disappear in Notion) are deleted here on the next sync.
// - Any rule violation aborts the whole sync before anything is written,
//   so the repo never holds a half-synced state.
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storySchema } from './story-schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STORIES_DIR = join(ROOT, 'src/content/stories');
const PHOTOS_DIR = join(ROOT, 'public/photos/stories');
const DATA_SOURCE_ID = '7a6cb4ea-57f9-4ab1-9827-d44ae80942a9'; // The Filing Cabinet
const NOTION_VERSION = '2025-09-03';
const WEB_IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

const DRY_RUN = process.argv.includes('--dry-run');
// --drafts mirrors ALL statuses for local preview (the dev server renders
// drafts, the prod build still won't). Never allowed in CI: the repo is
// public and unscrubbed drafts must not be committed. A later CI sync
// prunes any draft files, so a local --drafts run self-heals too.
const DRAFTS = process.argv.includes('--drafts');
if (DRAFTS && process.env.CI) {
  console.error('--drafts is a local preview flag; CI syncs Filed stories only.');
  process.exit(1);
}
const TOKEN = process.env.NOTION_TOKEN;
if (!TOKEN) {
  console.error('NOTION_TOKEN is not set. Create an internal integration at');
  console.error('notion.so/profile/integrations, connect The Filing Cabinet to it,');
  console.error('and export the secret as NOTION_TOKEN (repo secret in CI).');
  process.exit(1);
}

async function notion(path, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`Notion ${path} → ${res.status}: ${await res.text()}`);
  }
}

const paginate = async (fn) => {
  const all = [];
  let cursor;
  do {
    const page = await fn(cursor);
    all.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return all;
};

// --- property readers (Notion API → plain values) -------------------------
const text = (rt) => (rt ?? []).map((t) => t.plain_text).join('').trim();
const prop = {
  title: (p) => text(p?.title),
  rich: (p) => text(p?.rich_text),
  select: (p) => p?.select?.name,
  multi: (p) => (p?.multi_select ?? []).map((o) => o.name),
  check: (p) => !!p?.checkbox,
  date: (p) => p?.date ?? {},
  relation: (p) => (p?.relation ?? []).map((r) => r.id),
  file: (p) => p?.files?.[0]?.file?.url ?? p?.files?.[0]?.external?.url,
};

// --- rich text / blocks → markdown ----------------------------------------
function inline(rt) {
  return (rt ?? [])
    .map((t) => {
      let s = t.plain_text;
      if (t.annotations?.code) s = `\`${s}\``;
      if (t.annotations?.bold) s = `**${s}**`;
      if (t.annotations?.italic) s = `*${s}*`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join('');
}

// Converts the supported block subset. Bodies are prose-only by convention —
// images belong in the Photo / Proof 1 / Proof 2 properties.
function blocksToMarkdown(blocks) {
  const lines = [];
  const problems = [];
  for (const b of blocks) {
    const t = b.type;
    if (t === 'paragraph') lines.push(inline(b.paragraph.rich_text), '');
    else if (t === 'heading_1') lines.push(`# ${inline(b.heading_1.rich_text)}`, '');
    else if (t === 'heading_2') lines.push(`## ${inline(b.heading_2.rich_text)}`, '');
    else if (t === 'heading_3') lines.push(`### ${inline(b.heading_3.rich_text)}`, '');
    else if (t === 'bulleted_list_item') lines.push(`- ${inline(b.bulleted_list_item.rich_text)}`);
    else if (t === 'numbered_list_item') lines.push(`1. ${inline(b.numbered_list_item.rich_text)}`);
    else if (t === 'quote') lines.push(`> ${inline(b.quote.rich_text)}`, '');
    else if (t === 'divider') lines.push('---', '');
    else if (t === 'image')
      problems.push('image in the page body — move it to the Photo / Proof 1 / Proof 2 property instead');
    else problems.push(`unsupported block type "${t}" — use plain text, lists, or quotes`);
  }
  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), problems };
}

async function download(url, destBase, label) {
  const res = await fetch(url); // signed Notion URL — valid for ~1h, used immediately
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${label}`);
  const clean = new URL(url).pathname;
  const ext = (clean.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg').toLowerCase();
  if (!WEB_IMAGE_EXT.test(ext))
    throw new Error(
      `${label} is "${ext}" — browsers can't render that. Re-export as JPG/PNG ` +
        `(dragging out of Apple Photos converts automatically) and re-upload.`
    );
  const dest = `${destBase}${ext}`;
  if (!DRY_RUN) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  return ext;
}

// --- YAML emit (matches the hand-written frontmatter style) ----------------
// A JSON string literal is also a valid YAML double-quoted scalar, and it
// escapes everything hand-rolled quoting misses — newlines (Shift+Enter in a
// Notion field), tabs, control chars — so a stray line break can't break the
// frontmatter or silently fold two lines together.
const q = (s) => JSON.stringify(String(s));
const yamlList = (a) => `[${a.map(q).join(', ')}]`;

function frontmatter(story) {
  const l = [
    `slug: ${q(story.slug)}`,
    `name: ${q(story.name)}`,
    `tags: ${yamlList(story.tags)}`,
    ...(story.org ? [`org: ${q(story.org)}`] : []),
    `stamp: ${q(story.stamp)}`,
    `periodStart: ${story.periodStart}`,
    ...(story.periodEnd ? [`periodEnd: ${story.periodEnd}`] : []),
    ...(story.printCaption ? [`printCaption: ${q(story.printCaption)}`] : []),
    ...(story.typedNote ? [`typedNote: ${q(story.typedNote)}`] : []),
    ...(story.photo ? [`photo: ${q(story.photo)}`] : []),
    ...(story.proof1 ? [`proof1: ${q(story.proof1)}`] : []),
    ...(story.proof1Caption ? [`proof1Caption: ${q(story.proof1Caption)}`] : []),
    ...(story.proof2 ? [`proof2: ${q(story.proof2)}`] : []),
    ...(story.proof2Caption ? [`proof2Caption: ${q(story.proof2Caption)}`] : []),
    `onDesk: ${story.onDesk}`,
    `status: ${q(story.status)}`,
    `related: ${yamlList(story.related)}`,
    `notionId: ${q(story.notionId)}`,
  ];
  return `---\n${l.join('\n')}\n---\n`;
}

// --- sync ------------------------------------------------------------------
console.log(`${DRY_RUN ? '[dry-run] ' : ''}querying The Filing Cabinet…`);
const rows = await paginate((cursor) =>
  notion(`data_sources/${DATA_SOURCE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({ page_size: 100, ...(cursor && { start_cursor: cursor }) }),
  })
);

const slugById = new Map(rows.map((r) => [r.id, prop.rich(r.properties.Slug)]));
const selected = DRAFTS ? rows : rows.filter((r) => prop.select(r.properties.Status) === 'Filed');

// Slug is the filename and the URL — two rows sharing one would silently
// clobber each other's story and photos, so it's a sync error like any other.
const slugs = selected.map((r) => prop.rich(r.properties.Slug));
const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
if (dupes.length) {
  console.error(`Sync aborted — duplicate Slug${dupes.length > 1 ? 's' : ''} in Notion: ${dupes.join(', ')}`);
  console.error('Each row needs a unique Slug; fix in Notion and re-run.');
  process.exit(1);
}

const filedSlugs = new Set(slugs);
console.log(`${rows.length} rows, syncing ${selected.length}${DRAFTS ? ' (drafts included — local preview only)' : ' Filed'}`);

const errors = [];
const output = []; // fully validated before anything touches disk

for (const row of selected) {
  const p = row.properties;
  const slug = prop.rich(p.Slug);
  const label = `"${prop.title(p.Name)}" (${slug || 'no slug'})`;
  try {
    const blocks = await paginate((cursor) =>
      notion(`blocks/${row.id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
    );
    const { markdown, problems } = blocksToMarkdown(blocks);
    if (problems.length) throw new Error(problems.join('; '));

    const date = prop.date(p.Period);
    const story = {
      slug,
      name: prop.title(p.Name),
      tags: prop.multi(p.Tags),
      org: prop.select(p.Org) || undefined,
      stamp: prop.rich(p.Stamp),
      periodStart: date.start,
      periodEnd: date.end || undefined,
      printCaption: prop.rich(p['Card line']) || undefined,
      typedNote: prop.rich(p['Flip note']) || undefined,
      photo: undefined, // photo/proof paths set below once extensions are known
      proof1: undefined,
      proof1Caption: prop.rich(p['Proof 1 caption']) || undefined,
      proof2: undefined,
      proof2Caption: prop.rich(p['Proof 2 caption']) || undefined,
      onDesk: prop.check(p['On desk']),
      status: prop.select(p.Status),
      related: prop
        .relation(p['Related stories'])
        .map((id) => slugById.get(id))
        .filter((s) => s && filedSlugs.has(s)),
      notionId: row.id,
    };

    for (const [key, propName, file] of [
      ['photo', 'Photo', 'photo'],
      ['proof1', 'Proof 1', 'exhibit-1'],
      ['proof2', 'Proof 2', 'exhibit-2'],
    ]) {
      const url = prop.file(p[propName]);
      if (!url) continue;
      const ext = await download(url, join(PHOTOS_DIR, slug, file), `${label} ${propName}`);
      story[key] = `/photos/stories/${slug}/${file}${ext}`;
    }

    storySchema.parse(story);
    output.push({ slug, content: frontmatter(story) + (markdown ? `\n${markdown}\n` : '') });
    console.log(`  ✓ ${label}${story.proof1 ? ` — ${story.proof2 ? 2 : 1} proof(s)` : ''}`);
  } catch (e) {
    errors.push(`  ✗ ${label}: ${e.message}`);
  }
}

if (errors.length) {
  console.error('\nSync aborted — fix these in Notion and re-run:');
  for (const e of errors) console.error(e);
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`\n[dry-run] would write ${output.length} stories; no files touched`);
  process.exit(0);
}

// Mirror: write everything, then prune stories/photos that are no longer Filed.
mkdirSync(STORIES_DIR, { recursive: true });
for (const { slug, content } of output) writeFileSync(join(STORIES_DIR, `${slug}.md`), content);
for (const f of readdirSync(STORIES_DIR).filter((f) => f.endsWith('.md'))) {
  const slug = f.replace(/\.md$/, '');
  if (!filedSlugs.has(slug)) {
    rmSync(join(STORIES_DIR, f));
    console.log(`  − pruned ${f} (no longer Filed in Notion)`);
  }
}
if (existsSync(PHOTOS_DIR))
  for (const d of readdirSync(PHOTOS_DIR))
    if (!filedSlugs.has(d)) rmSync(join(PHOTOS_DIR, d), { recursive: true });

console.log(`\nsynced ${output.length} stories`);
