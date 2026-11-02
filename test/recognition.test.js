import test from 'node:test';
import assert from 'node:assert/strict';
import { recognitionRequest } from '../src/monthly-recognition.js';
import { PANEL_TIER } from '../src/lib/providers/index.js';

test('the recognition check asks the panel, the models that answer the martech questions', () => {
  const req = recognitionRequest('anthropic', '2026-12');
  assert.equal(req.tier, PANEL_TIER);
  assert.equal(req.grounded, true);
  assert.equal(req.custom_id, 'recognition__anthropic');
});
