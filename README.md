# ajal2.github.io

Personal site of Aryan Jalota — Astro, vanilla CSS, hosted on GitHub Pages.
Live at <https://ajal2.github.io>.

## Map

```
src/content/projects/*.md    project pages (frontmatter schema: agent/project-schema.mjs)
src/content/now.md           the "Now" section
src/data/*.json              site identity, experience, education
src/styles/tokens.css        the design system (paper/ink/madder, Mukta, danda ।)
agent/                       the pipeline that drafts new project pages
.github/workflows/           deploy.yml (push → Pages) · portfolio-agent.yml (daily + manual)
```

## How updates work

- **Edit anything** → push to `main` → GitHub Actions builds and deploys.
- **New project**: add the `portfolio` topic to a public repo (with a real
  README). The nightly agent drafts `src/content/projects/<repo>.md` with
  Claude, validates it against the schema and a real `astro build`, and opens
  a PR. Review, tweak, merge — merging deploys it. Manual run: Actions →
  "Portfolio agent" → Run workflow (optional `repo` + `dry_run` inputs).
- **Un-list a project**: remove the `portfolio` topic AND delete its content
  file (else the next run re-drafts it).

Requires repo secret `ANTHROPIC_API_KEY` and Settings → Actions → General →
"Allow GitHub Actions to create and approve pull requests".

## Local

```sh
npm install
npm run dev        # localhost:4321
npm run build
node agent/draft-project.mjs --repo <name> --dry-run   # test the agent
```
