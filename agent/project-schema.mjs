// Single source of truth for project-page frontmatter.
// Imported by src/content.config.ts (site build) AND agent/draft-project.mjs
// (drafting + validation), so the model, the content collection, and the
// build can never drift apart. Uses astro's bundled zod to avoid a second
// zod instance breaking defineCollection.
import { z } from 'astro/zod';

export const frontmatterSchema = z.object({
  title: z.string().min(3).max(60),
  // The recruiter one-liner shown in the list row.
  summary: z.string().min(30).max(160),
  // A real, README-verifiable result. Never invented — omit when none exists.
  outcome: z.string().max(120).optional(),
  stack: z.array(z.string().max(24)).min(1).max(6),
  repo: z.string().url(),
  demo: z.string().url().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['active', 'shipped', 'archived']).default('shipped'),
  featured: z.boolean().default(false),
  draftedBy: z.enum(['human', 'agent']).default('human'),
});

// The only fields the model may produce. repo/demo/date/featured/draftedBy
// are injected by the agent script from GitHub API metadata — links, dates,
// and prominence never come from the model.
export const modelOutputSchema = frontmatterSchema
  .pick({ title: true, summary: true, outcome: true, stack: true })
  .extend({
    status: z.enum(['active', 'shipped', 'archived']),
    // Markdown body: what it does / how it works / honest limits.
    body: z.string().min(400).max(3600),
  });

// Wire schema for the Claude structured-outputs call. Structured outputs
// reject length constraints on the wire, so this only guarantees SHAPE;
// modelOutputSchema.parse() enforces lengths client-side (with one repair
// retry in draft-project.mjs). Keep field names in lockstep with the zod
// schema above. All fields required; `outcome` is nullable instead of
// optional because strict schemas require every property to be present.
export const wireSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'outcome', 'stack', 'status', 'body'],
  properties: {
    title: { type: 'string', description: 'Project title — usually the repo name, verbatim.' },
    summary: {
      type: 'string',
      description:
        'One plain sentence for the list row a recruiter scans (30–160 characters). What it does, concretely. No hype.',
    },
    outcome: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description:
        'A concrete, real result stated in the README, verifiable near-verbatim (max 120 chars). null when the README claims no such result. NEVER invent metrics, users, or outcomes.',
    },
    stack: {
      type: 'array',
      items: { type: 'string' },
      description: '1–6 short technology labels (max 24 chars each), from the repo languages and README.',
    },
    status: {
      type: 'string',
      enum: ['active', 'shipped', 'archived'],
      description: 'active = clearly ongoing work; shipped = done and usable (default); archived = explicitly retired.',
    },
    body: {
      type: 'string',
      description:
        'Markdown page body, 150–300 words. Structure: opening paragraph (the problem and what this is — no heading), then "## How it works", then "## Honest limits". No H1, no emoji, no exclamation marks.',
    },
  },
};
