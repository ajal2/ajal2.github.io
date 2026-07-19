import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { frontmatterSchema } from '../agent/project-schema.mjs';
import { storySchema } from '../agent/story-schema.mjs';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  // Site-side, date becomes a real Date (YAML may parse it either way).
  schema: frontmatterSchema.extend({ date: z.coerce.date() }),
});

// Snapshot of the Notion "Filing Cabinet" — see agent/story-schema.mjs for
// the field contract and the Notion↔repo split.
const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: storySchema,
});

const experience = defineCollection({
  loader: file('./src/data/experience.json'),
  schema: z.object({
    id: z.string(),
    role: z.string(),
    org: z.string(),
    url: z.string().url().optional(),
    period: z.string(),
    location: z.string().optional(),
    summary: z.string().max(280).optional(),
    highlights: z.array(z.string().max(200)).max(4).default([]),
  }),
});

const education = defineCollection({
  loader: file('./src/data/education.json'),
  schema: z.object({
    id: z.string(),
    school: z.string(),
    degree: z.string(),
    period: z.string(),
    detail: z.string().optional(),
  }),
});

export const collections = { projects, stories, experience, education };
