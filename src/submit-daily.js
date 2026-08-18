#!/usr/bin/env node
// Stage 1 of the daily run. Builds every request for the day, hands the
// Anthropic ones to the Batches API (50% off, results within 24h) and runs the
// inline providers immediately. Writes a pending file; stage 2 collects.
//
// Also backfills: any date in the lookback window with no tracker file and no
// pending batch gets submitted too, so a night the cron skipped is recovered
// rather than becoming a permanent hole.
//
// Nothing is submitted until the whole run has been costed and cleared against
// the budget. Cost is incurred at submit time, so the guard has to run first.

import { paths, readJSON, writeJSON, exists, listJSON, log } from './lib/io.js';
import { today, missingDates } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { buildRequests, loadTemplates } from './lib/requests.js';
import { assertWithinBudget, usd } from './lib/cost.js';

const BACKFILL_WINDOW = 7;

function plannedDates(config) {
  const done = new Set(listJSON(paths.data('tracker')).map((f) => f.replace('.json', '')));

  // Backfill exists to recover a night the cron skipped. On a series with no
  // history every date in the window looks skipped, so an unguarded first run
  // submits a week of work at once and bills accordingly. Start with today and
  // let the window fill forward.
  if (done.size === 0) {
    log('no history yet: submitting today only, not the backfill window');
    return [today()];
  }
  return missingDates(BACKFILL_WINDOW, (d) => done.has(d), today());
}

function buildPlan(dates, config, templates) {
  const plan = [];
  for (const date of dates) {
    if (exists(paths.batch(date))) {
      log(`${date}: pending file already exists, skipping`);
      continue;
    }
    for (const { name } of enabledProviders(config)) {
      plan.push({
        date,
        provider: name,
        requests: templates.all.flatMap((t) => buildRequests(t, name, config)),
      });
    }
  }
  return plan;
}

async function submitDate(date, entries, config) {
  const handles = {};
  let total = 0;

  for (const entry of entries) {
    const { cfg, impl } = enabledProviders(config).find((p) => p.name === entry.provider);
    total += entry.requests.length;
    log(`${date}: submitting ${entry.requests.length} requests to ${entry.provider}`);
    try {
      handles[entry.provider] = await impl.submit(entry.requests, { providerConfig: cfg });
    } catch (err) {
      log(`${date}: ${entry.provider} submit failed: ${err.message}`);
      handles[entry.provider] = {
        kind: 'inline',
        results: [],
        error: String(err.message ?? err),
      };
    }
  }

  writeJSON(paths.batch(date), {
    date,
    submitted_at: new Date().toISOString(),
    prompt_version: config.sampling.prompt_version,
    templates: [...new Set(entries.flatMap((e) => e.requests.map((r) => r.custom_id.split('__')[0])))],
    request_count: total,
    handles,
  });
  log(`${date}: submitted ${total} requests across ${entries.length} providers`);
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const templates = loadTemplates(readJSON, paths, listJSON);

  const dates = plannedDates(config);
  if (dates.length === 0) {
    log('nothing to submit; the window is complete');
    return;
  }

  const plan = buildPlan(dates, config, templates);
  if (plan.length === 0) {
    log('every planned date already has a pending file; nothing to do');
    return;
  }

  // Refuses by throwing. Nothing above this line has cost anything.
  const { projection, rolling } = assertWithinBudget(plan, config);
  log(
    `budget ok: projected ${usd(projection.total)} (${projection.basis}), ` +
      `recorded last 7d ${usd(rolling)}, ceiling ${usd(config.budget.max_run_usd)}/run`,
  );

  const byDate = new Map();
  for (const entry of plan) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  log(`submitting for: ${[...byDate.keys()].join(', ')}`);
  for (const [date, entries] of byDate) await submitDate(date, entries, config);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
