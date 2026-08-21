import test from 'node:test';
import assert from 'node:assert/strict';
import { customId, parseCustomId, buildRequests, loadTemplates } from '../src/lib/requests.js';

test('customId round-trips through parseCustomId, slugging as it goes', () => {
  const id = customId({ template: 'a b', question: 'q/1', provider: 'openai', pass: 'grounded', sample: 3 });
  assert.deepEqual(parseCustomId(id), { template: 'a-b', question: 'q-1', provider: 'openai', pass: 'grounded', sample: 3 });
});

test('buildRequests emits every sample of both passes per question', () => {
  const template = { id: 't', entities: ['E'], questions: [{ id: 'q1', text: 'One?' }, { id: 'q2', text: 'Two?' }] };
  const reqs = buildRequests(template, 'google', { sampling: { samples_per_question: 2, grounded_samples: 1 } });
  assert.equal(reqs.length, 6);
  assert.equal(reqs.filter((r) => r.grounded).length, 2);
  assert.ok(reqs.every((r) => r.schema && r.system.includes('E') && r.custom_id.includes('google')));
});

test('loadTemplates keeps the anchor and only active problem sets', () => {
  const files = { 'config/anchor.json': { id: 'anchor' }, 'config/problems/a.json': { id: 'a', status: 'active' }, 'config/problems/b.json': { id: 'b', status: 'retired' } };
  const fakePaths = { config: (...p) => ['config', ...p].join('/') };
  const out = loadTemplates((f) => files[f], fakePaths, () => ['a.json', 'b.json']);
  assert.deepEqual(out.all.map((t) => t.id), ['anchor', 'a']);
});
