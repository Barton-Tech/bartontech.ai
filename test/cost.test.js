import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCost } from '../src/lib/cost.js';

const config = {
  providers: { p1: { models: { grounded: 'm1' } }, p2: { models: { grounded: 'ghost' } } },
  pricing: { p1: { m1: { in: 10, out: 20 } }, p2: {} },
  token_estimates: { grounded: { in: 1_000_000, out: 500_000 }, ungrounded: { in: 1, out: 1 } },
};

test('projectCost prices a grounded request from the estimates', () => {
  const { total } = projectCost([{ provider: 'p1', requests: [{ tier: 'grounded', grounded: true }] }], config, new Map());
  assert.equal(total, 20); // 1M in at $10/M + 0.5M out at $20/M
});

test('projectCost accumulates across plan entries for the same provider', () => {
  // Regression: byProvider once overwrote instead of accumulating, so a
  // multi-date backfill projected only its last day.
  const plan = [
    { provider: 'p1', requests: [{ tier: 'grounded', grounded: true }] },
    { provider: 'p1', requests: [{ tier: 'grounded', grounded: true }] },
  ];
  const { total, byProvider } = projectCost(plan, config, new Map());
  assert.equal(total, 40);
  assert.equal(byProvider.get('p1'), 40);
});

test('projectCost throws on an unpriced model rather than guessing zero', () => {
  assert.throws(
    () => projectCost([{ provider: 'p2', requests: [{ tier: 'grounded', grounded: true }] }], config, new Map()),
    /no pricing/,
  );
});

test('priceUsage prices by stored usage with search fee and batch discount', async () => {
  const { priceUsage } = await import('../src/lib/cost.js');
  const cfg = {
    pricing: { p: { m: { in: 10, out: 20 }, batch_discount: 0.5, search_per_call: 0.01 } },
  };
  const usage = { input_tokens: 1_000_000, output_tokens: 500_000 };
  assert.equal(priceUsage(cfg, 'p', 'm', usage), 20);
  assert.equal(priceUsage(cfg, 'p', 'm', usage, { batch: true }), 10);
  assert.equal(priceUsage(cfg, 'p', 'm', usage, { grounded: true }), 20.01);
  assert.throws(() => priceUsage(cfg, 'p', 'ghost', usage), /no pricing/);
});
