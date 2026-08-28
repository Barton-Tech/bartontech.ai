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

test('spend accounting: usd, averages, recorded spend and monthly rollup', async () => {
  const { usd, measuredAverages, recordedSpend, spendByMonth } = await import('../src/lib/cost.js');
  const { paths, readJSON, listJSON } = await import('../src/lib/io.js');
  const real = readJSON(paths.config('models.json'));
  assert.equal(usd(1.5), '$1.50');
  const avg = measuredAverages();
  assert.ok(avg instanceof Map);
  assert.ok(recordedSpend(real) >= 0);
  // Pinned to the last stored day, not the clock. Collection stopped
  // 2026-08-19, so the default trailing week walked off the end of the
  // record and stopped pricing anything at all.
  const lastRaw = listJSON(paths.data('raw')).at(-1).replace('.json', '');
  assert.ok(recordedSpend(real, 7, lastRaw) > 0);
  const rows = spendByMonth(real);
  assert.ok(Array.isArray(rows) && rows.length >= 1);
  const aug = rows.find((r) => r.month === '2026-08');
  assert.ok(aug.priced > 0 && aug.usd > 0);
});

test('assertWithinBudget passes small runs and refuses over either ceiling', async () => {
  const { assertWithinBudget } = await import('../src/lib/cost.js');
  const { paths, readJSON } = await import('../src/lib/io.js');
  const real = readJSON(paths.config('models.json'));
  const plan = [{ provider: 'anthropic', requests: [{ tier: 'reasoning', grounded: false }] }];
  const ok = assertWithinBudget(plan, real);
  assert.ok(ok.projection.total > 0 && typeof ok.detail === 'string');
  const perRun = structuredClone(real);
  perRun.budget.max_run_usd = 0;
  assert.throws(() => assertWithinBudget(plan, perRun), /max_run_usd/);
  const rolling = structuredClone(real);
  rolling.budget.max_rolling_7d_usd = 0;
  assert.throws(() => assertWithinBudget(plan, rolling), /max_rolling_7d_usd/);
});

test('the recorded-call walk prices every artifact kind from a synthetic tree', async () => {
  const { spendByMonth, measuredAverages } = await import('../src/lib/cost.js');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spend-'));
  const dataDir = (...p) => path.join(root, ...p);
  const put = (rel, obj) => {
    const f = dataDir(...rel.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(obj));
  };
  const usage = { input_tokens: 1_000_000, output_tokens: 500_000 };
  const cfg = {
    pricing: {
      p: { m: { in: 10, out: 20 }, batch_discount: 0.5, search_per_call: 0.01 },
      anthropic: { m: { in: 10, out: 20 } }, // themes and experiments price under their fixed provider
    },
  };
  put('raw/2026-07-01.json', { responses: [
    { ok: true, custom_id: 't__q__p__grounded__s1', model: 'm', usage },
    { ok: false, custom_id: 't__q__p__ungrounded__s1' },
  ] });
  put('solutions/2026-07-02.json', { answers: [{ provider: 'p', model: 'm', usage }, { provider: 'p', model: 'm' }] });
  put('solutions/2026-07-03.json', { formats: [{ answers: [{ provider: 'p', model: 'm', usage }] }] });
  put('themes/2026-07-02.json', { model: 'm', usage });
  put('index/2026-06.json', { board: [] }); // pre-calls shape: seven unrecorded
  put('index/2026-07.json', { calls: [
    { ok: true, provider: 'p', pass: 'grounded', model: 'm', usage },
    { ok: false, provider: 'p', pass: 'ungrounded' },
  ] });
  put('experiments/2026-07.json', { model: 'm', usage });
  put('experiments/not-a-month.json', { model: 'm', usage });
  put('recognition/2026-07.json', { results: [{ provider: 'p', model: 'm', usage }, { provider: 'ghost', model: 'unpriced', usage }] });

  const rows = spendByMonth(cfg, dataDir);
  const june = rows.find((r) => r.month === '2026-06');
  const july = rows.find((r) => r.month === '2026-07');
  assert.equal(june.unrecorded, 7);
  assert.equal(july.priced, 7); // raw, 2 solutions shapes, themes, index call, experiment, recognition
  assert.equal(july.unrecorded, 2); // solution without usage, unpriced recognition model
  // raw is batch-discounted plus search fee; the index and recognition
  // grounded calls pay the fee undiscounted
  assert.ok(Math.abs(july.usd - (10.01 + 20.01 + 20.01 + 20 * 4)) < 1e-9);

  const avg = measuredAverages(1, dataDir);
  assert.equal(avg.get('p|grounded').in, 1_000_000);
  assert.equal(avg.get('p|grounded').n, 3);
  assert.equal(avg.get('p|ungrounded').n, 2);
  assert.equal(avg.get('anthropic|ungrounded').n, 2);
  fs.rmSync(root, { recursive: true, force: true });
});
