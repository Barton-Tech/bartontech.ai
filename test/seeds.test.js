// The rotation and the default format are seeded by the date. If either ever
// re-rolls for the same date, a rerun stops reproducing the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { problemForDate, defaultFormatForDate } from '../src/daily-solutions.js';

const board = ['a', 'b', 'c'].map((id) => ({ canonical_id: id }));
const formats = ['w', 'x', 'y', 'z'].map((id) => ({ id }));

test('problemForDate is deterministic for a date', () => {
  assert.equal(problemForDate('2026-08-19', board), problemForDate('2026-08-19', board));
});

test('problemForDate advances one slot per day and wraps', () => {
  const seen = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'].map(
    (d) => problemForDate(d, board).canonical_id,
  );
  assert.equal(new Set(seen.slice(0, 3)).size, 3);
  assert.equal(seen[3], seen[0]);
});

test('defaultFormatForDate is deterministic and in range', () => {
  const f = defaultFormatForDate('2026-08-20', formats);
  assert.equal(f, defaultFormatForDate('2026-08-20', formats));
  assert.ok(formats.includes(f));
});

test('defaultFormatForDate varies across a month of dates', () => {
  const picks = new Set();
  for (let d = 1; d <= 28; d += 1) {
    picks.add(defaultFormatForDate(`2026-09-${String(d).padStart(2, '0')}`, formats).id);
  }
  assert.ok(picks.size > 1, 'a whole month landing on one format means the hash is degenerate');
});
