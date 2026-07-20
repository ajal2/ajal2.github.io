// Mirror the Notion "Filing Cabinet" into src/content/stories/ + photos.
// Runs on a schedule in CI (stories-sync.yml) and locally via
//   NOTION_TOKEN=... node agent/sync-stories.mjs [--dry-run] [--drafts]
// No AI anywhere in this path: Notion is the CMS, the Live checkbox is the gate.
//
// THE CONTRACT (why this script is shaped the way it is):
// - Notion is the single source of truth. The owner edits rows; nobody edits
//   this repo to publish. Anything derivable is derived here, never demanded.
// - ONE row can never break the whole site. A bad row is skipped and reported;
//   the rest publish. There is no global abort for content problems.
// - The owner does not read CI logs. Every per-row problem is written BACK into
//   Notion's "Sync" / "Sync note" columns, next to the row that caused it.
// - The mirror is authoritative: rows that stop being Live are deleted here.
//   That power is guarded (see the zero-live guard) so a Notion/API mishap
//   cannot silently wipe the site.
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storySchema, storyWarnings } from './story-schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STORIES_DIR = join(ROOT, 'src/content/stories');
const PHOTOS_DIR = join(ROOT, 'public/photos/stories');
const DATA_SOURCE_ID = '7a6cb4ea-57f9-4ab1-9827-d44ae80942a9'; // The Filing Cabinet
const NOTION_VERSION = '2025-09-03';
const WEB_IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif)$/i;

const DRY_RUN = process.argv.includes('--dry-run');
// --drafts mirrors every row regardless of the Live checkbox, for local
// preview only. Refused in CI: the repo is public and unpublished rows may
// hold unscrubbed client detail.
const DRAFTS = process.argv.includes('--drafts');
// Escape hatch for the zero-live guard, for the legitimate "I really did
// unpublish everything" case.
const ALLOW_EMPTY = process.argv.includes('--allow-empty');
if (DRAFTS && process.env.CI) {
  console.error('--drafts is a local preview flag; CI publishes Live rows only.');
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
  // Reads both `select` and Notion's native `status` property type, so
  // converting the column in Notion can't silently blank the value.
  select: (p) => p?.select?.name ?? p?.status?.name,
  multi: (p) => (p?.multi_select ?? []).map((o) => o.name),
  check: (p) => !!p?.checkbox,
  date: (p) => p?.date ?? {},
  relation: (p) => (p?.relation ?? []).map((r) => r.id),
  file: (p) => p?.files?.[0]?.file?.url ?? p?.files?.[0]?.external?.url,
};

// --- derivation: fill in what the owner left blank ------------------------
const CURLY = '’';
// House typography: stamps use a curly apostrophe ("CHICAGO ’25"). Notion gets
// whatever the phone keyboard produced, so normalise rather than nag.
const curlify = (s) => (s ?? '').replace(/'/g, CURLY);

export const slugify = (s) =>
  (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Titles are often "Name — subtitle"; keep the part before the dash.
    .split(/[—–|:]/)[0]
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');

const yy = (d) => (d ? `${CURLY}${String(new Date(d).getUTCFullYear()).slice(2)}` : '');

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

// Converts the supported block subset. Anything unsupported is skipped with a
// warning rather than failing the row — an odd block in Notion must never cost
// the owner a publish.
function blocksToMarkdown(blocks) {
  const lines = [];
  const notes = [];
  for (const b of blocks) {
    const t = b.type;
    if (t === 'paragraph') lines.push(inline(b.paragraph.rich_text), '');
    else if (t === 'heading_1') lines.push(`## ${inline(b.heading_1.rich_text)}`, '');
    else if (t === 'heading_2') lines.push(`## ${inline(b.heading_2.rich_text)}`, '');
    else if (t === 'heading_3') lines.push(`### ${inline(b.heading_3.rich_text)}`, '');
    else if (t === 'bulleted_list_item') lines.push(`- ${inline(b.bulleted_list_item.rich_text)}`);
    else if (t === 'numbered_list_item') lines.push(`- ${inline(b.numbered_list_item.rich_text)}`);
    else if (t === 'quote') lines.push(`> ${inline(b.quote.rich_text)}`, '');
    else if (t === 'callout') lines.push(inline(b.callout.rich_text), '');
    else if (t === 'toggle') lines.push(inline(b.toggle.rich_text), '');
    else if (t === 'code') lines.push(inline(b.code.rich_text), '');
    else if (t === 'divider') lines.push('---', '');
    else if (t === 'image') notes.push('an image in the page body was skipped — put photos in the Photo / Proof properties');
    else notes.push(`a "${t}" block was skipped — the site renders text, lists and quotes`);
  }
  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), notes };
}

async function download(url, destBase, label) {
  const clean = new URL(url).pathname;
  const ext = (clean.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase();
  // Validate BEFORE spending the download.
  if (!WEB_IMAGE_EXT.test(ext))
    throw new Error(
      `${label}: "${ext || 'no extension'}" isn't a web image. Re-export as JPG/PNG ` +
        `(dragging out of Apple Photos converts automatically) and re-upload.`
    );
  const res = await fetch(url); // signed Notion URL — valid ~1h, used immediately
  if (!res.ok) throw new Error(`${label}: download failed (${res.status})`);
  const dest = `${destBase}${ext}`;
  if (!DRY_RUN) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  return ext;
}

// --- YAML emit -------------------------------------------------------------
// A JSON string literal is also a valid YAML double-quoted scalar and escapes
// everything hand-rolled quoting misses (newlines, tabs, control chars).
const q = (s) => JSON.stringify(String(s));
const yamlList = (a) => `[${a.map(q).join(', ')}]`;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

function frontmatter(s) {
  const l = [
    `slug: ${q(s.slug)}`,
    `name: ${q(s.name)}`,
    `tags: ${yamlList(s.tags)}`,
    ...(s.org ? [`org: ${q(s.org)}`] : []),
    ...(s.stamp ? [`stamp: ${q(s.stamp)}`] : []),
    ...(s.periodStart ? [`periodStart: ${iso(s.periodStart)}`] : []),
    ...(s.periodEnd ? [`periodEnd: ${iso(s.periodEnd)}`] : []),
    ...(s.printCaption ? [`printCaption: ${q(s.printCaption)}`] : []),
    ...(s.typedNote ? [`typedNote: ${q(s.typedNote)}`] : []),
    ...(s.photo ? [`photo: ${q(s.photo)}`] : []),
    ...(s.proof1 ? [`proof1: ${q(s.proof1)}`] : []),
    ...(s.proof1Caption ? [`proof1Caption: ${q(s.proof1Caption)}`] : []),
    ...(s.proof2 ? [`proof2: ${q(s.proof2)}`] : []),
    ...(s.proof2Caption ? [`proof2Caption: ${q(s.proof2Caption)}`] : []),
    `onDesk: ${s.onDesk}`,
    `live: ${s.live}`,
    `related: ${yamlList(s.related)}`,
    `createdAt: ${q(new Date(s.createdAt).toISOString())}`,
    `notionId: ${q(s.notionId)}`,
  ];
  return `---\n${l.join('\n')}\n---\n`;
}

// --- writeback: put the result next to the row, inside Notion --------------
// Best-effort. If the integration is read-only this fails harmlessly and the
// sync still publishes; it just can't report into Notion.
let writebackBroken = false;
async function writeBack(pageId, properties) {
  if (DRY_RUN || writebackBroken) return;
  try {
    await notion(`pages/${pageId}`, { method: 'PATCH', body: JSON.stringify({ properties }) });
  } catch (e) {
    if (!writebackBroken) {
      writebackBroken = true;
      console.warn(
        '  ! could not write status back into Notion (needs the integration\'s\n' +
          '    "Update content" capability). Publishing continues regardless.'
      );
    }
  }
}
// NOTE: writeback bumps the row's last_edited_time. Harmless today; if this
// sync ever becomes incremental keyed on last_edited_time, it would re-trigger
// itself — key incremental runs off content hashes instead.

// --- sync ------------------------------------------------------------------
console.log(`${DRY_RUN ? '[dry-run] ' : ''}reading The Filing Cabinet…`);
const rows = await paginate((cursor) =>
  notion(`data_sources/${DATA_SOURCE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify({ page_size: 100, ...(cursor && { start_cursor: cursor }) }),
  })
);

// Resolve slugs first so relations can be mapped, filling blanks from the name.
const slugById = new Map();
for (const r of rows) {
  const explicit = prop.rich(r.properties.Slug);
  slugById.set(r.id, explicit || slugify(prop.title(r.properties.Name)));
}

const isLive = (r) => prop.check(r.properties.Live);
const selected = rows.filter((r) => DRAFTS || isLive(r));
console.log(`${rows.length} rows · ${selected.length} ${DRAFTS ? 'previewed (drafts included)' : 'live'}`);

const problems = []; // per-row, non-fatal
const output = [];
const seen = new Map(); // slug -> name, for duplicate detection

for (const row of selected) {
  const p = row.properties;
  const name = prop.title(p.Name) || 'Untitled';
  const explicitSlug = prop.rich(p.Slug);
  const slug = explicitSlug || slugify(name);
  const label = `"${name}"`;
  try {
    if (!slug) throw new Error('needs a Name (the slug is derived from it)');
    if (seen.has(slug))
      throw new Error(`duplicate Slug "${slug}" — already used by "${seen.get(slug)}". Give one a different Slug.`);

    const blocks = await paginate((cursor) =>
      notion(`blocks/${row.id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
    );
    const { markdown, notes } = blocksToMarkdown(blocks);

    const date = prop.date(p.Period);
    const org = prop.select(p.Org) || undefined;
    const rawStamp = prop.rich(p.Stamp);
    const story = {
      slug,
      name,
      tags: prop.multi(p.Tags),
      org,
      // Blank stamp? Compose one from Org + the period year so the print still
      // reads right. Apostrophes normalised to the house curly form either way.
      stamp: curlify(rawStamp) || [org?.toUpperCase(), yy(date.start)].filter(Boolean).join(' ') || undefined,
      periodStart: date.start || undefined,
      periodEnd: date.end || undefined,
      printCaption: prop.rich(p['Card line']) || undefined,
      typedNote: prop.rich(p['Flip note']) || undefined,
      photo: undefined,
      proof1: undefined,
      proof1Caption: prop.rich(p['Proof 1 caption']) || undefined,
      proof2: undefined,
      proof2Caption: prop.rich(p['Proof 2 caption']) || undefined,
      onDesk: prop.check(p['On desk']),
      live: isLive(row),
      related: prop
        .relation(p['Related stories'])
        .map((id) => slugById.get(id))
        .filter(Boolean),
      createdAt: row.created_time,
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
    seen.set(slug, name);
    output.push({ slug, story, content: frontmatter(story) + (markdown ? `\n${markdown}\n` : '') });

    const warns = [...storyWarnings(story), ...notes];
    console.log(`  ✓ ${label}${warns.length ? ` (${warns.length} note${warns.length > 1 ? 's' : ''})` : ''}`);
    // Fill the Slug column in Notion the first time we derive one, so the URL
    // is stable from then on even if the Name changes later.
    const patch = {
      Sync: { select: { name: warns.length ? 'Check' : 'OK' } },
      'Sync note': {
        rich_text: [{ text: { content: (warns.join(' · ') || `published ${new Date().toISOString().slice(0, 10)}`).slice(0, 1900) } }],
      },
    };
    if (!explicitSlug) patch.Slug = { rich_text: [{ text: { content: slug } }] };
    await writeBack(row.id, patch);
  } catch (e) {
    const msg = e?.issues?.[0]?.message || e.message || String(e);
    problems.push(`  ✗ ${label}: ${msg}`);
    console.error(`  ✗ ${label}: ${msg}`);
    await writeBack(row.id, {
      Sync: { select: { name: 'Blocked' } },
      'Sync note': { rich_text: [{ text: { content: msg.slice(0, 1900) } }] },
    });
  }
}

// Rows that are no longer live get their status cleared, so a stale "OK" never
// lingers next to something that is actually off the site.
if (!DRAFTS) {
  for (const row of rows) {
    if (isLive(row)) continue;
    await writeBack(row.id, {
      Sync: { select: null },
      'Sync note': { rich_text: [] },
    });
  }
}

const liveSlugs = new Set(output.map((o) => o.slug));

if (DRY_RUN) {
  console.log(`\n[dry-run] would publish ${output.length} stories; nothing written.`);
  if (problems.length) {
    console.log(`\n${problems.length} row(s) need attention in Notion:`);
    for (const p of problems) console.log(p);
  }
  process.exit(0);
}

// --- the zero-live guard --------------------------------------------------
// The mirror is authoritative, which means a bad read could delete the whole
// site. If Notion returns nothing publishable but the mirror currently holds
// stories, that is far more likely to be a token/permission/schema accident
// than a deliberate unpublish-everything. Refuse and keep the site up.
mkdirSync(STORIES_DIR, { recursive: true });
mkdirSync(PHOTOS_DIR, { recursive: true }); // must exist for CI's `git add`
const existing = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.md'));
if (!liveSlugs.size && existing.length && !ALLOW_EMPTY) {
  console.error(
    `\nRefusing to publish: Notion returned 0 live stories but the site currently\n` +
      `has ${existing.length}. That usually means the integration lost access or a\n` +
      `property was renamed — not that everything was unpublished.\n` +
      `The site is unchanged. If you really did untick every row, re-run with --allow-empty.`
  );
  process.exit(1);
}

for (const { slug, content } of output) writeFileSync(join(STORIES_DIR, `${slug}.md`), content);

// Prune stories that are no longer live.
for (const f of existing) {
  const slug = f.replace(/\.md$/, '');
  if (!liveSlugs.has(slug)) {
    rmSync(join(STORIES_DIR, f));
    console.log(`  − removed ${slug} (no longer Live)`);
  }
}
// Prune photo directories for dropped stories, AND stale files inside kept ones
// (a cleared Photo property, or a re-upload under a different extension).
if (existsSync(PHOTOS_DIR)) {
  const keepBySlug = new Map(output.map((o) => [o.slug, o.story]));
  for (const d of readdirSync(PHOTOS_DIR)) {
    const dir = join(PHOTOS_DIR, d);
    if (!statSync(dir).isDirectory()) continue;
    const story = keepBySlug.get(d);
    if (!story) {
      rmSync(dir, { recursive: true });
      continue;
    }
    const keep = new Set(
      [story.photo, story.proof1, story.proof2].filter(Boolean).map((p) => p.split('/').pop())
    );
    for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(join(dir, f));
  }
}

console.log(`\npublished ${output.length} stories`);
if (problems.length) {
  console.log(`\n${problems.length} row(s) need attention — see the Sync column in Notion:`);
  for (const p of problems) console.log(p);
}
