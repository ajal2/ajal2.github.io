// The story contract — the site-side mirror of the Notion "Filing Cabinet"
// (data source 7a6cb4ea-57f9-4ab1-9827-d44ae80942a9). Imported by
// src/content.config.ts (site build) and agent/sync-stories.mjs, so Notion
// and the build can't drift. Uses astro's bundled zod so defineCollection
// gets the same zod instance.
//
// DESIGN RULE: this schema is deliberately PERMISSIVE. Notion is the source of
// truth and its rows are edited by a human, at speed, from a phone. Anything
// that can be derived is derived in the sync (see deriveStory) rather than
// rejected here. Only what genuinely cannot be invented is required. A missing
// optional field must degrade the page, never block a publish or abort a run.
import { z } from 'astro/zod';

export const storySchema = z.object({
  // --- required: cannot be invented -----------------------------------
  // Auto-derived from the row's Name when the owner leaves Slug empty, so in
  // practice this is never a reason a publish fails.
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1).max(200),
  notionId: z.string().uuid(),
  // Notion's created_time. The desk deals positions by seniority off this, so
  // a NEW row always sorts last and can never reshuffle existing prints.
  // Sync-owned; the owner never sees or types it.
  createdAt: z.coerce.date(),

  // --- the publish gate -------------------------------------------------
  // One checkbox in Notion: ticked = on the site, unticked = off it.
  live: z.boolean().default(false),

  // --- everything below is optional and degrades gracefully -------------
  // Open on purpose: a NEW tag invented in Notion must create a new section on
  // the site, not abort the sync. Never make this an enum again.
  tags: z.array(z.string()).default([]),
  org: z.string().max(60).optional(),
  // Typewriter place+date, e.g. "CHICAGO ’25". Derived from Org + period year
  // when blank, and its apostrophes are normalised to the house curly form.
  stamp: z.string().max(40).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  // Polaroid front (Card line) and back (Flip note). A desk print with neither
  // still renders — the front falls back to the name, the back to the summary.
  printCaption: z.string().max(120).optional(),
  typedNote: z.string().max(400).optional(),
  // photo = the one visual; proofs = up to two captioned work exhibits. All
  // live in Notion table properties; story bodies are pure prose.
  photo: z.string().optional(),
  proof1: z.string().optional(),
  proof1Caption: z.string().max(300).optional(),
  proof2: z.string().optional(),
  proof2Caption: z.string().max(300).optional(),
  // Exhibit dimensions, written by the sync so pages can reserve the right
  // space before the image loads instead of jumping. Never typed by hand.
  proof1W: z.number().optional(),
  proof1H: z.number().optional(),
  proof2W: z.number().optional(),
  proof2H: z.number().optional(),
  onDesk: z.boolean().default(false),
  // Slugs of related stories. One-way in Notion; the build resolves the
  // reverse direction, so link child→parent once and both pages show it.
  related: z.array(z.string()).default([]),
});

// Non-blocking quality checks. These NEVER fail a sync — they are surfaced back
// into Notion's "Sync note" column so the owner sees them next to the row.
// Returns [] when the story is in good shape.
export function storyWarnings(s) {
  const w = [];
  if (s.onDesk && !s.printCaption) w.push('On desk: add a Card line for the front of the print');
  if (s.onDesk && !s.typedNote) w.push('On desk: add a Flip note for the back of the print');
  if (s.proof1 && !s.proof1Caption) w.push('Proof 1 has no caption');
  if (s.proof2 && !s.proof2Caption) w.push('Proof 2 has no caption');
  if (s.proof2 && !s.proof1) w.push('Proof 2 is set but Proof 1 is empty — fill slots in order');
  if (!s.periodStart) w.push('No Period date — the story sorts last and shows no date');
  if (!s.tags.length) w.push('No Tags — it will only appear in The Files, not in a section');
  return w;
}
