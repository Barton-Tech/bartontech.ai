import test from 'node:test';
import assert from 'node:assert/strict';
import { findMissing, validateProposal, mergeProposal } from '../src/model-refresh.js';

const config = {
  providers: { a: { enabled: true, models: { bulk: 'old-model' } } },
  pricing: { a: { 'old-model': { in: 1, out: 2 } } },
};

test('findMissing flags configured models absent from the live list', () => {
  assert.deepEqual(findMissing(config, { a: ['other'] }), ['a.bulk=old-model']);
  assert.deepEqual(findMissing(config, { a: ['old-model'] }), []);
});

test('findMissing treats an unverifiable provider as not missing', () => {
  assert.deepEqual(findMissing(config, {}), []);
});

test('validateProposal rejects a model id not in the live list', () => {
  assert.throws(
    () => validateProposal(
      { providers: [{ provider: 'a', tiers: [{ tier: 'bulk', model_id: 'invented', price_in: 1, price_out: 1 }] }] },
      { a: ['real'] },
      config,
    ),
    /not in the provider's live model list/,
  );
});

test('validateProposal rejects non-positive prices', () => {
  assert.throws(
    () => validateProposal(
      { providers: [{ provider: 'a', tiers: [{ tier: 'bulk', model_id: 'real', price_in: 0, price_out: 1 }] }] },
      { a: ['real'] },
      config,
    ),
    /non-positive price/,
  );
});

test('mergeProposal keeps superseded pricing so recorded spend stays priceable', () => {
  const next = mergeProposal(config, {
    providers: [{ provider: 'a', tiers: [{ tier: 'bulk', model_id: 'new-model', price_in: 3, price_out: 4 }] }],
  });
  assert.equal(next.providers.a.models.bulk, 'new-model');
  assert.deepEqual(next.pricing.a['new-model'], { in: 3, out: 4 });
  assert.deepEqual(next.pricing.a['old-model'], { in: 1, out: 2 }, 'old pricing must never be deleted');
});
