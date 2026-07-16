#!/usr/bin/env node
// Portfolio agent: finds public repos tagged with the `portfolio` topic that
// have no project page yet, drafts one with Claude (structured outputs),
// validates it against the shared schema AND a real `astro build`, then opens
// a PR for human review. Links, dates, and prominence are injected from
// GitHub API metadata — never model-produced.
//
// Usage:
//   node agent/draft-project.mjs                    # all tagged repos
//   node agent/draft-project.mjs --repo NAME        # one repo, topic filter bypassed
//   node agent/draft-project.mjs --repo NAME --dry-run   # draft + validate, write nothing
//
// Env: ANTHROPIC_API_KEY (only needed when something must be drafted),
//      GH_TOKEN (in CI; local `gh` auth works too).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { modelOutputSchema, wireSchema } from './project-schema.mjs';

const OWNER = 'ajal2';
const TOPIC = 'portfolio';
const CONTENT_DIR = 'src/content/projects';
const MODEL = 'claude-sonnet-5';
const README_MAX_CHARS = 16000;
const README_MIN_CHARS = 300;

const BANNED = /(!|\p{Extended_Pictographic}|\bpassionate\b|\bexcited\b|\bthrilled\b|\bdelighted\b|\bpowerful\b|\brobust\b|\bseamless\b|\bcutting-edge\b|\bblazing\b|\brevolutionary\b|\bgame-changing\b|\bleverages?\b)/iu;

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const onlyRepo = argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : null;

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const gh = (endpoint, extra = []) => JSON.parse(sh('gh', ['api', endpoint, ...extra]));

// ---------- discovery ----------

function candidates() {
  const repos = gh(`users/${OWNER}/repos?per_page=100&type=owner`, ['--paginate']);
  return repos.filter(
    (r) =>
      !r.fork &&
      !r.archived &&
      r.name !== `${OWNER}.github.io` &&
      (onlyRepo ? r.name === onlyRepo : (r.topics ?? []).includes(TOPIC))
  );
}

function pendingBranchExists(slug) {
  try {
    sh('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/agent/add-${slug}`]);
    return true;
  } catch {
    return false;
  }
}

// ---------- drafting ----------

function buildSystemPrompt() {
  const guide = readFileSync('agent/STYLE_GUIDE.md', 'utf8');
  const gold = ['tender-copilot', 'jbss-website']
    .filter((s) => existsSync(`${CONTENT_DIR}/${s}.md`))
    .map((s) => `--- GOLD EXAMPLE: ${s}.md ---\n${readFileSync(`${CONTENT_DIR}/${s}.md`, 'utf8')}`)
    .join('\n\n');
  return [
    'You draft one project page for a personal portfolio site from a GitHub repo README and metadata. Return only the JSON object described by the output schema.',
    'Hard rules: never invent metrics, users, dates, links, or outcomes — everything must be traceable to the README or metadata. If the README states no concrete real-world result, outcome is null. No emoji, no exclamation marks, no marketing adjectives.',
    guide,
    gold,
  ].join('\n\n');
}

async function draftWithClaude(repo, readme) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ maxRetries: 3 });
  const metadata = {
    name: repo.name,
    description: repo.description,
    primary_language: repo.language,
    languages: gh(`repos/${OWNER}/${repo.name}/languages`),
    homepage: repo.homepage || null,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
    topics: repo.topics,
    stars: repo.stargazers_count,
  };

  const messages = [
    { role: 'user', content: JSON.stringify({ metadata, readme: readme.text.slice(0, README_MAX_CHARS) }) },
  ];
  const system = buildSystemPrompt();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      output_config: { format: { type: 'json_schema', schema: wireSchema } },
    });
    if (res.stop_reason === 'refusal') throw new Error('model refused the request');
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    try {
      const raw = JSON.parse(text);
      if (raw.outcome === null) delete raw.outcome;
      const draft = modelOutputSchema.parse(raw);
      const bannedHit = [draft.summary, draft.outcome ?? '', draft.body].join('\n').match(BANNED);
      if (bannedHit) throw new Error(`banned phrase or character: "${bannedHit[0]}"`);
      return { draft, model: res.model };
    } catch (err) {
      if (attempt === 2) throw new Error(`validation failed after repair retry: ${err.message}`);
      messages.push(
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: `That draft failed validation: ${err.message}. Fix the problem and return the corrected JSON object only.`,
        }
      );
    }
  }
}

// ---------- compose / validate / PR ----------

function composePage(repo, draft) {
  const fm = {
    title: draft.title,
    summary: draft.summary,
    ...(draft.outcome ? { outcome: draft.outcome } : {}),
    stack: draft.stack,
    repo: repo.html_url,
    ...(repo.homepage ? { demo: repo.homepage } : {}),
    date: repo.created_at.slice(0, 10),
    status: draft.status,
    featured: false,
    draftedBy: 'agent',
  };
  // JSON-encoded scalars/arrays are valid YAML and immune to quoting bugs.
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n${draft.body.trim()}\n`;
}

function astroBuild() {
  sh('npx', ['astro', 'build'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function openPr(slug, filePath, repo, readmeSha, model) {
  const base = sh('git', ['rev-parse', 'HEAD']).trim();
  const branch = `agent/add-${slug}`;
  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '(local run)';
  const body = [
    `Drafted from [\`${OWNER}/${repo.name}\`](${repo.html_url}) — README @ \`${readmeSha.slice(0, 12)}\`, model \`${model}\`, run: ${runUrl}`,
    '',
    'Review checklist:',
    '- [ ] `summary` reads right in the list row (≤160 chars, no hype)',
    '- [ ] `outcome` (if present) is TRUE and appears in the README',
    '- [ ] stack / links / date are correct',
    '- [ ] voice matches `agent/STYLE_GUIDE.md` — would you say this out loud?',
    '- [ ] flip `featured: true`?',
  ].join('\n');
  const bodyFile = path.join(mkdtempSync(path.join(tmpdir(), 'agent-pr-')), 'body.md');
  writeFileSync(bodyFile, body);
  try {
    sh('git', ['checkout', '-B', branch]);
    sh('git', ['add', filePath]);
    sh('git', ['commit', '-m', `agent: add project page for ${slug}`]);
    sh('git', ['push', '-u', 'origin', branch]);
    const prUrl = sh('gh', [
      'pr', 'create',
      '--title', `agent: add project page for ${slug}`,
      '--body-file', bodyFile,
      '--base', 'main',
      '--head', branch,
    ]).trim();
    return prUrl;
  } finally {
    sh('git', ['checkout', base]);
  }
}

// ---------- main ----------

const rows = [];
let failed = false;

for (const repo of candidates()) {
  const slug = repo.name.toLowerCase();
  const filePath = `${CONTENT_DIR}/${slug}.md`;
  try {
    if (existsSync(filePath)) {
      rows.push([slug, 'skipped: page exists']);
      continue;
    }
    if (!dryRun && pendingBranchExists(slug)) {
      rows.push([slug, 'skipped: PR pending']);
      continue;
    }
    let readme;
    try {
      const r = gh(`repos/${OWNER}/${repo.name}/readme`);
      readme = { text: Buffer.from(r.content, 'base64').toString('utf8'), sha: r.sha };
    } catch {
      rows.push([slug, 'skipped: no README']);
      continue;
    }
    if (readme.text.length < README_MIN_CHARS) {
      rows.push([slug, `skipped: README too short (${readme.text.length} chars)`]);
      continue;
    }

    const { draft, model } = await draftWithClaude(repo, readme);
    const page = composePage(repo, draft);
    writeFileSync(filePath, page);
    try {
      astroBuild();
    } catch (err) {
      unlinkSync(filePath);
      throw new Error(`astro build rejected the page: ${String(err.stderr || err.message).slice(0, 500)}`);
    }

    if (dryRun) {
      unlinkSync(filePath);
      console.log(`\n===== DRY RUN — ${filePath} (validated by astro build, not written) =====\n${page}`);
      rows.push([slug, 'drafted (dry run, validated)']);
    } else {
      const prUrl = openPr(slug, filePath, repo, readme.sha, model);
      unlinkSync(filePath); // lives on the PR branch; keep the working tree clean
      rows.push([slug, `drafted → ${prUrl}`]);
    }
  } catch (err) {
    failed = true;
    rows.push([slug, `failed: ${err.message}`]);
  }
}

if (rows.length === 0) rows.push(['—', onlyRepo ? `repo "${onlyRepo}" not found or not eligible` : 'no repos tagged with topic "portfolio"']);

const table = ['| repo | result |', '|---|---|', ...rows.map(([r, s]) => `| ${r} | ${s} |`)].join('\n');
console.log(`\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Portfolio agent\n\n${table}\n`);
process.exit(failed ? 1 : 0);
