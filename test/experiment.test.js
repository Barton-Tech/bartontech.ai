import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSurfaces } from '../src/monthly-experiment.js';
import { experimentSystem, experimentUser } from '../src/lib/prompts.js';
import { TITLE } from '../src/lib/seo.js';

test('currentSurfaces quotes the real title, description and FAQ', () => {
  const s = currentSurfaces();
  assert.ok(s.includes(`Title: ${TITLE}`));
  assert.ok(s.includes('Meta description:'));
  assert.ok((s.match(/^Q: /gm) || []).length >= 9);
});

test('the experiment prompt demands one attributable change and allows none', () => {
  const sys = experimentSystem();
  assert.ok(sys.includes('at most one'));
  assert.ok(sys.includes('"No change" is a respectable outcome'));
});

test('experimentUser assembles history, verbatim answers, surfaces and priors', () => {
  const rec = { month: '2026-08', results: [{ label: 'C', model: 'm', familiar: false, basis: 'none', answer: 'VERBATIM_TEXT' }] };
  const prior = { month: '2026-07', proposal: { no_change: false, hypothesis: 'HYP', change: { surface: 'faq', proposed_text: 'NEW_TEXT' } } };
  const noChangePrior = { month: '2026-06', proposal: { no_change: true, hypothesis: 'WAIT' } };
  const u = experimentUser({ month: '2026-09', recognitions: [rec], surfaces: 'SURFACES', previous: [noChangePrior, prior] });
  for (const bit of ['VERBATIM_TEXT', 'SURFACES', 'HYP', 'NEW_TEXT', 'no change', 'familiar=false']) assert.ok(u.includes(bit), bit);
  const empty = experimentUser({ month: '2026-09', recognitions: [], surfaces: 's', previous: [] });
  assert.ok(empty.includes('(none yet)') && empty.includes('(no prior experiments)'));
});
