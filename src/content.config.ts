import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { storySchema } from '../agent/story-schema.mjs';

// The mirror of the Notion "Filing Cabinet" — the site's only content source.
// See agent/story-schema.mjs for the field contract and agent/SYNC.md for how
// a row gets here. Nothing else is a collection: everything on this site is a
// story, so there is exactly one pipeline to understand.
const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: storySchema,
});

export const collections = { stories };
