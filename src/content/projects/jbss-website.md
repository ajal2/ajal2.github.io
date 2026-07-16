---
title: "JBSS website"
summary: "Marketing site for JBSS LLP, an Indian waste-infrastructure firm — Next.js with Notion as the CMS, so the team edits content without touching code."
stack: ["Next.js 14", "TypeScript", "Notion CMS", "Vercel"]
repo: "https://github.com/ajal2/jbss-website"
demo: "https://jbssgroup.com"
date: "2026-07-06"
status: "shipped"
featured: false
draftedBy: "human"
---
JBSS LLP builds and operates construction-and-demolition waste processing
plants and municipal sanitation systems across India. Its site has one job:
make a heavy-infrastructure firm legible to municipal clients and partners.

## How it works

A Next.js 14 app-router site in TypeScript, deployed on Vercel at
jbssgroup.com. The deliberate choice is the content boundary: projects and
careers live in Notion and are fetched at revalidation time, so the operations
team updates the site from a tool they already use — no commits, no CMS to
host. Repo conventions, including the design-system rules and the
non-negotiables (the India map data source is never replaced), are written
down in `AGENTS.md` and apply to humans and coding agents alike.

## Honest limits

It's a marketing site, not a product. The engineering interest is in the CMS
boundary and in making the repo safely operable by coding agents.
