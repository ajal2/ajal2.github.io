## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Building pages

Before adding or restyling a page, read the two contracts that keep the site
coherent — they apply to human- and agent-written pages alike:

- [agent/DESIGN_GUIDE.md](agent/DESIGN_GUIDE.md) — the visual system: the color
  palette, the two fonts and the type scale, the theme model, and when to use a
  token vs a literal. The machine source is `src/styles/tokens.css`, imported
  once via `src/components/Head.astro` (never re-import fonts or tokens).
- [agent/STYLE_GUIDE.md](agent/STYLE_GUIDE.md) — the writing voice for story
  bodies and notes (outcome-led, concrete, banned words).
- [agent/SYNC.md](agent/SYNC.md) — how content gets from Notion to the site.
  **All content lives in Notion.** Never add a page or hand-edit
  `src/content/stories/` to publish something; the sync overwrites it.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
