# Visual design guide

The look contract for ajal2.github.io. `STYLE_GUIDE.md` governs the *words* on a
project page; this governs the *pixels* on every page. The machine source of
truth is [`src/styles/tokens.css`](../src/styles/tokens.css) — this file
explains how to use it. When they disagree, the CSS wins; fix this doc.

## The one rule

**Semantic UI reads from tokens. The desk's physical props keep their own
literal colors.** The homepage is a skeuomorphic desk — wood, a mug, tape, a
notebook, boarding passes. Those objects are hand-made set dressing; their
browns and brand reds (Air India, United) are material, not system, and stay as
raw hex. Everything that is *interface* — page background, body text, headings,
links, captions, stamps — uses a token so it stays consistent and themeable.

If you're unsure which side a color is on, ask: is this the color of an *object
on the desk*, or the color of *text/chrome the reader navigates by*? Object →
literal. Chrome → token.

## Type

Two voices, and that's the whole set. Never introduce a third.

- `var(--font-sans)` — **Fraunces** (a variable editorial serif). The site's
  voice: every heading, the letterhead, and all body prose. Headings use weight
  800–900; body 400–600. (The token keeps its `--font-sans` name for continuity
  even though the face is a serif — swap the face in `tokens.css`, not the name.)
- `var(--font-mono)` — **Courier Prime**. The second voice, the *typed artifact*:
  the desk's props (boarding passes' typed data, stamps, the slip, the to-do
  pad) and the small stamp-style labels that annotate a filed document (a card's
  stamp, a story's FILED BY / PERIOD rail, section eyebrows, the crumb).

The contrast is the point: serif carries the reading, Courier is the rubber
stamp on top of it. Keep prose in the serif — never set body copy in Courier
(that monospace-everywhere look is what we moved away from). The boarding-pass
display text (`DEL → ORD`, airline) is pinned to a plain `system-ui` sans so the
pass reads like a real pass, not the site serif — a deliberate prop exception.

Size from the scale, don't invent px:

| token | ~size | role |
|---|---|---|
| `--text-hero` | 44 | the 404 code; rare big moments |
| `--text-display` | 38 | a page's H1 (The Files, a story) |
| `--text-title` | 32 | an article/page title (a project) |
| `--text-subtitle` | 23 | a section label inside a page |
| `--text-lead` | 18 | the one-line summary under a title |
| `--text-body` | 16 | running prose and bullets |
| `--text-meta` | 13 | meta rows, small body |
| `--text-caption` | 12 | captions, nav links |
| `--text-stamp` | 10.5 | uppercase stamp/label voice |
| `--text-micro` | 8.5 | the tiniest stamps |

Tracking: `--track-tight` (-0.5px) on large display sans; `--track-wide`
(1.5px) and `--track-stamp` (2px) on uppercase mono. The desk's tiny prop
labels predate the scale and keep their own hand-tuned sizes — don't retrofit
them.

## Color

Palette lives in `tokens.css`. Two groups, and the distinction matters:

**Page surface — flips with theme** (text/background of the page itself):
`--page` (background), `--paper` (a raised sheet), `--ink` (primary text),
`--sub` (muted text), `--line` (hairlines), `--accent` (`#2b52b8` — the *one*
interactive accent: links, focus, selection, pins; same blue in both themes),
`--note` (the tan sticky-note stock). `--desk`/`--lamp` are the homepage
surface only.

**Ink on paper — constant across themes** (the desk's paper objects are cream
in *both* themes, so ink printed on them does not flip): `--stamp` (`#8b8574`,
the caption/stamp gray), `--stamp-red` (`#a32c22`, rubber stamps / DRAFT tags /
the ribbon), `--ink-title` (`#211f19`, near-black heading ink on paper).

That's why a story's stamp gray is `--stamp` and never flips, while the page's
body text is `--ink` and does.

## Theme

Light is the default; dark is the override. A JS toggle writes
`localStorage['aryan-theme2']` and sets `document.body.dataset.theme`; the dark
values live under `body[data-theme='dark']` in `tokens.css`. The desk has its
lamp-cord toggle; inner pages get the nav's NIGHT·DAY button (via
`<JournalNav themeToggle />`, which `JournalShell` already passes). If you build
a page that renders its own shell, include a toggle or it won't honor the saved
theme.

## Starting a new page

1. Fonts and tokens load automatically — every page routes through
   `src/components/Head.astro`, which imports them once. **Never re-import
   `@fontsource/*` or `tokens.css` in a page.**
2. For a standard inner page, use the `JournalShell` layout — you get the nav,
   the paper sheet (`.js-sheet`), the crumb (`.js-crumb`), the theme toggle,
   and the base styles for free. `src/pages/404.astro` is the minimal model.
3. Style with tokens: `var(--font-*)`, `var(--text-*)`, the palette vars. Do
   **not** re-declare `body` background/color/font — the base owns them.
4. Reach for a literal hex only for a genuinely new skeuomorphic object. If it's
   interface, it belongs in `tokens.css` first.

## What's deliberately not standardized

The desk's ~120 one-off material colors and its micro-typography are hand-made
and intentional. Don't tokenize wood grain, mug ceramics, folder manila, tape,
paper drop-shadows, or airline brand colors.
