import test from 'node:test';
import assert from 'node:assert/strict';
import { today, thisMonth, shiftDays, missingDates } from '../src/lib/dates.js';

test('today and thisMonth are ISO shaped', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(thisMonth(), /^\d{4}-\d{2}$/);
});

test('shiftDays crosses month and year boundaries', () => {
  assert.equal(shiftDays('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDays('2025-12-31', 1), '2026-01-01');
});

test('missingDates reports only the gaps in the window', () => {
  const have = new Set(['2026-08-19', '2026-08-21']);
  assert.deepEqual(missingDates(3, (d) => have.has(d), '2026-08-21'), ['2026-08-20']);
});
