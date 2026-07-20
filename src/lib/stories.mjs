// The publish gate, in one place. One checkbox in Notion — "Live" — decides
// what the world sees. Local dev also shows unpublished rows so new work can
// be previewed on the desk before it ships.
export const isPublished = (entry) => entry.data.live || import.meta.env.DEV;

// Tags drive the site's sections. A tag invented in Notion becomes a section
// automatically, so this must stay derived from the data — never a fixed list.
export const tagSlug = (tag) =>
  tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Every tag present on the given stories, with its slug and story count. */
export function tagsFrom(entries) {
  const counts = new Map();
  for (const e of entries)
    for (const t of e.data.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
