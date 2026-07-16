# Project-page style guide

This file is the voice contract for project pages on ajal2.github.io. It is
fed verbatim to the drafting agent and applies equally to human-written pages.

## The job

The reader is a recruiter or admission officer with seconds to spend. A
project page has one job: let them understand — fast — what was built, why it
was hard, and whether it worked in the real world. It is evidence, not
marketing.

## Voice

Modeled on the tender-copilot README. The rules, with the receipts:

1. **Outcome-led.** Lead with what the thing does and what happened when it
   met reality. *"Validated on a live ₹3 Cr bid."* — not "a powerful tool for
   tender analysis."
2. **Say what it is not.** Scope earns trust. *"It is not a document
   generator. The PDFs are the boring byproduct. The product is the
   decision."*
3. **Concrete stakes, real nouns.** *"A bad eligibility call forfeits the
   EMD."* Name the tender, the amount, the failure mode. Never "improves
   efficiency" or "streamlines workflows."
4. **Honest about limits.** Every page ends with what the project does NOT do
   or deliberately leaves open. *"This repo claims a validated process, not a
   win."* If there is nothing honest to say, the page is not done.
5. **Plain sentences.** Short, declarative, active voice. Weight comes from
   facts, not adjectives.

## Frontmatter semantics

- `title` — the repo name, verbatim. Not a marketing rename.
- `summary` — one sentence a recruiter reads in a list row (30–160 chars).
  What it does, concretely.
- `outcome` — a real result stated in the README, verifiable near-verbatim
  (≤120 chars). Omit when none exists. **Never invent metrics, users, or
  outcomes.**
- `stack` — up to 6 short labels from the repo languages and README.
- `status` — `active` (ongoing), `shipped` (done, usable), `archived`.
- `repo`, `demo`, `date`, `featured`, `draftedBy` — injected by the script
  from GitHub metadata. The model never writes links or dates.

## Body shape (150–300 words)

1. Opening paragraph, no heading: the problem and what this is.
2. `## How it works` — the interesting design decision(s), not a file tour.
3. `## Honest limits` — what it doesn't do, what's deliberately manual, what's
   unproven. (A results section like `## Validated on a real bid` may come
   before it when the README supports one.)

## Banned

Emoji. Exclamation marks. "Passionate", "excited", "thrilled", "delighted".
"Powerful", "robust", "seamless", "cutting-edge", "blazing", "revolutionary",
"game-changing". "Leverage" as a verb. "Hi, I'm". Superlatives without
evidence. Any claim not traceable to the README.

## Gold examples

The two hand-written pages are the reference output:

- `src/content/projects/tender-copilot.md`
- `src/content/projects/jbss-website.md`

The drafting script embeds both in the prompt. Match their register exactly.
