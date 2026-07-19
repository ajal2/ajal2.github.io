// Single source of truth for story frontmatter — the site-side mirror of the
// Notion "Filing Cabinet" database (data source 7a6cb4ea-57f9-4ab1-9827-d44ae80942a9).
// Imported by src/content.config.ts (site build) and by the future
// sync-stories script, so Notion, the snapshot, and the build can't drift.
// Uses astro's bundled zod to avoid a second zod instance breaking
// defineCollection (same reasoning as project-schema.mjs).
import { z } from 'astro/zod';

// Notion owns words, photos, and tags; the repo owns desk scenography
// (src/data/desk-layout.json). `slug` is the join key between the two and
// must match the print ids in the desk layout — never rename one side alone.
export const storySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(3).max(80),
    tags: z.array(z.enum(['Case Study', 'Project', 'Experience'])).min(1),
    org: z.string().max(40).optional(),
    // Typewriter place+date, verbatim from Notion: "CHICAGO ’24".
    stamp: z.string().max(32),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date().optional(),
    // Polaroid front/back. Only desk prints carry them (enforced below).
    printCaption: z.string().max(60).optional(),
    typedNote: z.string().max(280).optional(),
    // The three photo slots (Aryan's convention): photo = the one visual
    // (polaroid/lead), proofs = up to two captioned work exhibits. All live
    // in Notion table properties — story bodies are pure prose, no images.
    photo: z.string().optional(),
    proof1: z.string().optional(),
    proof1Caption: z.string().max(200).optional(),
    proof2: z.string().optional(),
    proof2Caption: z.string().max(200).optional(),
    onDesk: z.boolean().default(false),
    // Notion's publishing gate. The build renders Filed stories only, so a
    // half-written row in Notion can never leak onto the site.
    status: z.enum(['Idea', 'Drafting', 'Scrubbing', 'Filed']),
    // Slugs of related stories. One-way in Notion; the build resolves the
    // reverse direction, so link child→parent once and both pages show it.
    related: z.array(z.string()).default([]),
    // Notion page id, so sync can match files to rows even if a slug typo
    // gets fixed later.
    notionId: z.string().uuid(),
  })
  // Desk completeness is a PUBLISH rule: a Drafting story may sit on the
  // desk half-dressed for preview, but it can't be Filed without both
  // sides of the polaroid.
  .refine((s) => !s.onDesk || s.status !== 'Filed' || (s.printCaption && s.typedNote), {
    message: 'a Filed desk print needs both printCaption and typedNote',
  })
  .refine((s) => (!s.proof1 || s.proof1Caption) && (!s.proof2 || s.proof2Caption), {
    message: 'every proof needs its caption — fill "Proof N caption" in Notion',
  })
  .refine((s) => !s.proof2 || s.proof1, {
    message: 'Proof 2 is set but Proof 1 is empty — fill slots in order',
  });
