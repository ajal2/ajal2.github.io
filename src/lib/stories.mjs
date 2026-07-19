// The publish gate, in one place. A story reaches the live site only when its
// Notion Status is Filed; dev builds also show drafts so new work previews on
// the desk before it ships. Every page that lists stories — the desk, The
// Files, and each story page — filters through this, so the rule can never
// drift between them.
export const isPublished = (entry) => entry.data.status === 'Filed' || import.meta.env.DEV;
