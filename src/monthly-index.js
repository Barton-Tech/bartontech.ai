#!/usr/bin/env node
// The Problem Index. Once a month, asks every provider what the industry's
// most pressing unsolved problems are, then reconciles the proposals against
// the canonical registry.
//
// Reconciliation is the load-bearing step. Without it "answer engine
// optimization", "GEO", and "AI search visibility" become three registry
// entries and the monthly series fragments into confetti. New entries land in
// pending_review rather than the registry: a new entry claims the industry's
// attention moved somewhere new, and that claim gets a person's sign-off.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { thisMonth } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { PROBLEM_PROPOSAL, RECONCILIATION } from './lib/schemas.js';
import {
  PROBLEM_INDEX_SYSTEM,
  problemIndexUser,
  reconciliationSystem,
  reconciliationUser,
} from './lib/prompts.js';

async function gatherProposals(config, month) {
  // The six calls are independent, so they run concurrently. Sequentially this
  // step took roughly nine minutes, most of it waiting on reasoning-tier models
  // with grounding enabled.
  const tasks = enabledProviders(config).flatMap(({ name, cfg, impl }) =>
    [false, true].map((grounded) => ({
      provider: name,
      pass: grounded ? 'grounded' : 'ungrounded',
      run: () =>
        impl.once(
          {
            custom_id: `index__${name}__${grounded ? 'grounded' : 'ungrounded'}`,
            tier: 'reasoning',
            grounded,
            system: PROBLEM_INDEX_SYSTEM,
            user: problemIndexUser({ grounded, month }),
            schema: PROBLEM_PROPOSAL,
          },
          { providerConfig: cfg },
        ),
    })),
  );

  log(`asking ${tasks.length} model/pass combinations concurrently`);
  const settled = await Promise.all(
    tasks.map(async (task) => {
      const started = Date.now();
      try {
        const res = await task.run();
        log(`${task.provider} (${task.pass}) done in ${Math.round((Date.now() - started) / 1000)}s`);
        return { task, res };
      } catch (err) {
        return { task, res: { ok: false, error: String(err.message ?? err) } };
      }
    }),
  );

  // Flattened in task order rather than completion order, so a rerun with the
  // same inputs produces the same proposal ordering.
  const proposals = [];
  const failures = [];
  const calls = [];
  for (const { task, res } of settled) {
    calls.push({
      provider: task.provider,
      pass: task.pass,
      ok: Boolean(res?.ok),
      model: res?.model ?? null,
      usage: res?.usage ?? null,
    });
    if (!res?.ok) {
      failures.push({ provider: task.provider, pass: task.pass, error: res?.error ?? 'unknown' });
      continue;
    }
    for (const problem of res.data.problems ?? []) {
      proposals.push({ provider: task.provider, pass: task.pass, ...problem });
    }
  }

  return { proposals, failures, calls };
}

async function reconcile(proposals, registry, config) {
  const anthropic = enabledProviders(config).find((p) => p.name === 'anthropic');
  if (!anthropic) throw new Error('reconciliation requires the anthropic provider');

  const res = await anthropic.impl.once(
    {
      custom_id: 'reconcile',
      tier: 'reasoning',
      grounded: false,
      system: reconciliationSystem(registry),
      user: reconciliationUser(proposals),
      schema: RECONCILIATION,
    },
    { providerConfig: anthropic.cfg },
  );

  if (!res.ok) throw new Error(`reconciliation failed: ${res.error}`);
  return res;
}

function scoreProblems(proposals, resolutions, ranking) {
  const weight = { low: 1, medium: 2, high: 3 };
  const byName = new Map(resolutions.map((r) => [r.proposed_name, r]));
  const scores = new Map();

  for (const p of proposals) {
    const resolution = byName.get(p.name);
    if (!resolution) continue;
    const id = resolution.canonical_id;
    if (!scores.has(id)) {
      scores.set(id, {
        canonical_id: id,
        canonical_name: resolution.canonical_name,
        is_new: resolution.decision === 'new',
        score: 0,
        proposals: 0,
        providers: new Set(),
        categories: new Set(),
      });
    }
    const entry = scores.get(id);
    entry.score += weight[p.confidence] ?? 1;
    entry.proposals += 1;
    entry.providers.add(p.provider);
    entry.categories.add(p.category);
  }

  const order = new Map(ranking.map((id, i) => [id, i]));
  return [...scores.values()]
    .map((e) => ({
      ...e,
      providers: [...e.providers].sort(),
      categories: [...e.categories].sort(),
      panel_rank: order.has(e.canonical_id) ? order.get(e.canonical_id) + 1 : null,
    }))
    .sort((a, b) => {
      if (a.panel_rank && b.panel_rank) return a.panel_rank - b.panel_rank;
      if (a.panel_rank) return -1;
      if (b.panel_rank) return 1;
      return b.score - a.score;
    });
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');
  const month = args[0] ?? thisMonth();
  const registry = readJSON(paths.registry());

  // The site tells readers the record is append-only and cannot be backfilled.
  // Re-running a month silently replaced a published board once already, moving
  // the top problem and changing every score, so a rerun now has to be asked
  // for. When forced, the previous version is archived rather than discarded.
  if (exists(paths.index(month)) && !force) {
    throw new Error(
      `${month} already has a published board. Re-running would replace it, and the ` +
        'panel is not deterministic: the same month can return a different ordering. ' +
        'Pass --force to archive the current version and regenerate.',
    );
  }

  const { proposals, failures, calls } = await gatherProposals(config, month);
  if (proposals.length === 0) {
    throw new Error(`no proposals gathered: ${JSON.stringify(failures)}`);
  }
  log(`gathered ${proposals.length} proposals`);

  const reconciled = await reconcile(proposals, registry, config);
  const { resolutions, ranking } = reconciled.data;
  calls.push({ provider: 'anthropic', pass: 'reconcile', ok: true, model: reconciled.model ?? null, usage: reconciled.usage ?? null });
  const board = scoreProblems(proposals, resolutions, ranking);

  if (force && exists(paths.index(month))) {
    const prior = readJSON(paths.index(month));
    const n = listJSON(paths.data('index/archive')).filter((f) => f.startsWith(month)).length + 1;
    writeJSON(paths.data('index/archive', `${month}.v${n}.json`), prior);
    log(`archived the previous ${month} board as v${n}`);
  }

  writeJSON(paths.index(month), {
    month,
    generated_at: new Date().toISOString(),
    provenance: provenance(config, {
      models: Object.fromEntries(
        enabledProviders(config).map(({ name, cfg }) => [name, cfg.models.reasoning]),
      ),
    }),
    board,
    proposals,
    resolutions,
    failures,
    calls,
  });

  // New canonical entries queue for review instead of entering the registry.
  const knownIds = new Set(registry.problems.map((p) => p.id));
  const queued = new Set(registry.pending_review.map((p) => p.id));
  let added = 0;
  for (const entry of board) {
    if (!entry.is_new || knownIds.has(entry.canonical_id) || queued.has(entry.canonical_id)) {
      continue;
    }
    const resolution = resolutions.find((r) => r.canonical_id === entry.canonical_id);
    const source = proposals.find((p) => p.name === resolution?.proposed_name);
    registry.pending_review.push({
      id: entry.canonical_id,
      canonical_name: entry.canonical_name,
      definition: source?.definition ?? '',
      why_unsolved: source?.why_unsolved ?? '',
      category: source?.category ?? 'other',
      aliases: [],
      proposed_in: month,
      proposed_by: entry.providers,
      reason: resolution?.reason ?? '',
      status: 'pending_review',
    });
    added += 1;
  }

  if (added > 0) {
    registry.updated_at = new Date().toISOString();
    writeJSON(paths.registry(), registry);
  }

  log(`board: ${board.map((b) => b.canonical_name).join(' > ')}`);
  log(`${added} new problems queued for review; ${failures.length} provider failures`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
