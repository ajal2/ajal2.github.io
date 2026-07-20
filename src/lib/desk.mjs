// Where a print sits on the desk — decided here, never in Notion and never by
// hand. Ticking "On desk" in Notion is the whole job.
//
// WHY SENIORITY AND NOT A HASH: positions must be stable. If cells were picked
// by hashing the slug, two slugs could collide; if they were dealt by sorted
// slug, adding a story called "acme-two" would shove every print that sorts
// after it. Dealing by Notion's created_time fixes both: a NEW row always has
// the newest timestamp, so it sorts last and takes the first free cell after
// every incumbent. No existing print can ever move because of a new one.
//
// The one case that does reshuffle: un-ticking a story frees its cell and the
// prints junior to it shift up one. That reflects a real change, and `pin` in
// desk-slots.json freezes any print whose exact spot matters.

/**
 * @param stories array of story data objects (need .slug and .createdAt)
 * @param table   desk-slots.json: { cells: [...], pin: { slug: cellIndex } }
 * @returns { placed: [{ story, cell }], overflow: [story] }
 */
export function placeDesk(stories, table) {
  const cells = table?.cells ?? [];
  const pins = table?.pin ?? {};
  const takenCell = new Set();
  const placedFor = new Map(); // slug -> cell

  // 1. Explicit pins claim their cell first and drop out of the deal.
  for (const [slug, idx] of Object.entries(pins)) {
    const cell = cells[idx];
    if (!cell || takenCell.has(idx)) continue;
    if (!stories.some((s) => s.slug === slug)) continue;
    takenCell.add(idx);
    placedFor.set(slug, cell);
  }

  // 2. Everyone else is dealt oldest-first into the remaining cells. Slug is a
  //    deterministic tiebreak so two rows created in the same second can't
  //    swap places between builds.
  const queue = stories
    .filter((s) => !placedFor.has(s.slug))
    .sort(
      (a, b) =>
        new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0) ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
    );

  const overflow = [];
  let cursor = 0;
  for (const s of queue) {
    while (cursor < cells.length && takenCell.has(cursor)) cursor++;
    if (cursor >= cells.length) {
      overflow.push(s);
      continue;
    }
    takenCell.add(cursor);
    placedFor.set(s.slug, cells[cursor]);
    cursor++;
  }

  // Return in cell order so the landing animation cascades across the desk
  // rather than jumping around.
  const placed = stories
    .filter((s) => placedFor.has(s.slug))
    .map((s) => ({ story: s, cell: placedFor.get(s.slug) }))
    .sort((a, b) => cells.indexOf(a.cell) - cells.indexOf(b.cell));

  return { placed, overflow };
}
