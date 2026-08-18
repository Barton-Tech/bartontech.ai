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

import { paths, readJSON, writeJSON, provenance, log } from './lib/io.js';
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
  const proposals = [];
  const failures = [];

  for (const { name, cfg, impl } of enabledProviders(config)) {
    for (const grounded of [false, true]) {
      const pass = grounded ? 'grounded' : 'ungrounded';
      const req = {
        custom_id: `index__${name}__${pass}`,
        tier: 'reasoning',
        grounded,
        system: PROBLEM_INDEX_SYSTEM,
        user: problemIndexUser({ grounded, month }),
        schema: PROBLEM_PROPOSAL,
      };
      log(`asking ${name} (${pass})`);
      try {
        const res = await impl.once(req, { providerConfig: cfg });
        if (!res.ok) {
          failures.push({ provider: name, pass, error: res.error });
          continue;
        }
        for (const problem of res.data.problems ?? []) {
          proposals.push({ provider: name, pass, ...problem });
        }
      } catch (err) {
        failures.push({ provider: name, pass, error: String(err.message ?? err) });
      }
    }
  }

  return { proposals, failures };
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
  return res.data;
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
  const month = process.argv[2] ?? thisMonth();
  const registry = readJSON(paths.registry());

  const { proposals, failures } = await gatherProposals(config, month);
  if (proposals.length === 0) {
    throw new Error(`no proposals gathered: ${JSON.stringify(failures)}`);
  }
  log(`gathered ${proposals.length} proposals`);

  const { resolutions, ranking } = await reconcile(proposals, registry, config);
  const board = scoreProblems(proposals, resolutions, ranking);

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
