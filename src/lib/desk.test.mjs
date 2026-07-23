// Guards the desk-placement invariants (see src/lib/desk.mjs and AGENTS.md).
// Run with `npm test` (node's built-in runner — no dependencies).
//
// The load-bearing property: adding a new story must NEVER move a print that is
// already on the desk. Placement is dealt by Notion created_time, oldest first,
// so a new row always sorts last and takes the next free cell. If anyone
// "improves" this with hashing or slug-sorting, these tests fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeDesk } from './desk.mjs';

const cell = (i) => ({ x: i, y: i, rot: 0, w: 100, h: 100, pad: '0', fastener: 'pin' });
const table = (n) => ({ cells: Array.from({ length: n }, (_, i) => cell(i)), pin: {} });
const story = (slug, createdAt) => ({ slug, createdAt });

test('deals oldest story into the first cell', () => {
  const stories = [story('b', '2026-01-02'), story('a', '2026-01-01')];
  const { placed } = placeDesk(stories, table(4));
  const a = placed.find((p) => p.story.slug === 'a');
  assert.equal(a.cell.x, 0, 'the oldest row (a) takes cell 0');
});

test('adding a NEW story never moves existing prints', () => {
  const t = table(4);
  const before = placeDesk(
    [story('a', '2026-01-01'), story('b', '2026-01-02'), story('c', '2026-01-03')],
    t
  );
  const after = placeDesk(
    [
      story('a', '2026-01-01'),
      story('b', '2026-01-02'),
      story('c', '2026-01-03'),
      story('new', '2026-06-01'), // newest → must sort last
    ],
    t
  );
  for (const p of before.placed) {
    const q = after.placed.find((x) => x.story.slug === p.story.slug);
    assert.deepEqual(q.cell, p.cell, `${p.story.slug} must not move when a newer story is added`);
  }
});

test('is deterministic across runs (same input → same output)', () => {
  const stories = [story('a', '2026-01-01'), story('b', '2026-01-02')];
  const t = table(4);
  assert.deepEqual(placeDesk(stories, t).placed, placeDesk(stories, t).placed);
});

test('ties on created_time break deterministically by slug', () => {
  const t = table(4);
  const one = placeDesk([story('zed', '2026-01-01'), story('abc', '2026-01-01')], t);
  const abc = one.placed.find((p) => p.story.slug === 'abc');
  assert.equal(abc.cell.x, 0, 'the alphabetically-first slug wins a created_time tie');
});

test('overflow past capacity is returned, not dropped', () => {
  const stories = ['a', 'b', 'c'].map((s, i) => story(s, `2026-01-0${i + 1}`));
  const { placed, overflow } = placeDesk(stories, table(2));
  assert.equal(placed.length, 2);
  assert.equal(overflow.length, 1);
  assert.equal(overflow[0].slug, 'c', 'the newest story overflows');
});

test('a pin freezes a slug to its cell and removes that cell from the deal', () => {
  const t = { ...table(4), pin: { b: 2 } };
  const { placed } = placeDesk(
    [story('a', '2026-01-01'), story('b', '2026-01-02')],
    t
  );
  const b = placed.find((p) => p.story.slug === 'b');
  const a = placed.find((p) => p.story.slug === 'a');
  assert.equal(b.cell.x, 2, 'pinned story b sits in cell 2');
  assert.equal(a.cell.x, 0, 'unpinned story a still takes the first free cell');
});
