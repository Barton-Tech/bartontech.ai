import test from 'node:test';
import assert from 'node:assert/strict';
import { proposedAliases } from '../src/monthly-index.js';

const registry = {
  problems: [{ id: 'aeo', canonical_name: 'Answer Engine Optimization', aliases: ['GEO'] }],
  pending_aliases: [{ alias: 'Queued Name', canonical_id: 'aeo', status: 'pending_review' }],
};
const res = (over) => ({
  proposed_name: 'LLM visibility', decision: 'match', canonical_id: 'aeo',
  canonical_name: 'Answer Engine Optimization', reason: 'same friction', confidence: 'high', ...over,
});

test('a confident match under a new name queues as an alias', () => {
  const out = proposedAliases(registry, [res()], '2026-09');
  assert.equal(out.length, 1);
  assert.equal(out[0].alias, 'LLM visibility');
  assert.equal(out[0].proposed_in, '2026-09');
  assert.equal(out[0].status, 'pending_review');
});

test('low confidence, new problems, and unknown ids never queue', () => {
  assert.equal(proposedAliases(registry, [res({ confidence: 'low' })], 'm').length, 0);
  assert.equal(proposedAliases(registry, [res({ decision: 'new' })], 'm').length, 0);
  assert.equal(proposedAliases(registry, [res({ canonical_id: 'ghost' })], 'm').length, 0);
});

test('names the registry already knows are not re-queued, case-insensitively', () => {
  for (const name of ['answer engine optimization', 'geo', 'QUEUED NAME']) {
    assert.equal(proposedAliases(registry, [res({ proposed_name: name })], 'm').length, 0, name);
  }
});

test('duplicates within one batch collapse to a single proposal', () => {
  const out = proposedAliases(registry, [res(), res()], 'm');
  assert.equal(out.length, 1);
});
