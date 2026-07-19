// Parses a story's markdown body (the Notion mirror) into the shape the
// case-study design renders: a bold one-line summary, then EITHER the four
// known parts (Situation / What I did / Value / What I learned) as bullets,
// OR free prose paragraphs. Mirrors the "Body rules" in the design handoff
// (design_handoff_case_studies/README.md).
const KNOWN = ['Situation', 'What I did', 'Value', 'What I learned'];

// Bodies render in Courier as typed text — strip markdown emphasis markers
// and Notion's escapes rather than rendering rich text.
const clean = (s) =>
  s
    .replace(/\*\*/g, '')
    .replace(/\\([$*_`[\]])/g, '$1')
    .trim();

export function parseStoryBody(md) {
  let summary = '';
  const parts = [];
  const prose = [];
  let heading = null; // current "## Situation"-style section

  const partFor = (label) => {
    let p = parts.find((x) => x.label === label);
    if (!p) parts.push((p = { label, bullets: [] }));
    return p;
  };

  for (const raw of (md ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const lead = line.match(/^\*\*(.+)\*\*$/);
    if (!summary && lead && !line.startsWith('- ')) {
      summary = clean(lead[1]);
      continue;
    }

    const labeled = line.match(/^-\s+\*\*(.+?):?\*\*:?\s*(.*)$/);
    if (labeled && KNOWN.includes(labeled[1].trim())) {
      heading = null;
      const text = clean(labeled[2]);
      if (text) partFor(labeled[1].trim()).bullets.push(text);
      continue;
    }

    const head = line.match(/^#{2,3}\s+(.+)$/);
    if (head && KNOWN.includes(clean(head[1]))) {
      heading = clean(head[1]);
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      const target = heading ? partFor(heading) : parts.at(-1);
      if (target) target.bullets.push(clean(bullet[1]));
      else prose.push(clean(bullet[1]));
      continue;
    }

    if (heading) partFor(heading).bullets.push(clean(line));
    else prose.push(clean(line));
  }

  return { summary, parts: parts.filter((p) => p.bullets.length), prose };
}

// "JAN – MAY ’22", "AUG ’24 – MAY ’25", or "MAR ’24" — the rail's PERIOD row.
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function formatPeriod(start, end) {
  if (!start) return '';
  // Date-only frontmatter parses to UTC midnight; read it in UTC so the month
  // and year don't slip a day back when the build runs west of UTC.
  const y = (d) => `’${String(d.getUTCFullYear()).slice(2)}`;
  const m = (d) => MON[d.getUTCMonth()];
  if (!end) return `${m(start)} ${y(start)}`;
  if (start.getUTCFullYear() === end.getUTCFullYear()) return `${m(start)} – ${m(end)} ${y(end)}`;
  return `${m(start)} ${y(start)} – ${m(end)} ${y(end)}`;
}
