#!/usr/bin/env node
// Stage 1 of the daily run. Builds every request for the day, hands the
// Anthropic ones to the Batches API (50% off, results within 24h) and runs the
// inline providers immediately. Writes a pending file; stage 2 collects.
//
// Also backfills: any date in the lookback window with no tracker file and no
// pending batch gets submitted too, so a night the cron skipped is not a
// permanent hole in the series.

import { paths, readJSON, writeJSON, exists, listJSON, log } from './lib/io.js';
import { today, missingDates } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { buildRequests, loadTemplates } from './lib/requests.js';

const BACKFILL_WINDOW = 7;

async function submitForDate(date, config, templates) {
  if (exists(paths.batch(date))) {
    log(`${date}: pending file already exists, skipping`);
    return;
  }

  const providers = enabledProviders(config);
  const handles = {};
  let total = 0;

  for (const { name, cfg, impl } of providers) {
    const requests = templates.all.flatMap((t) => buildRequests(t, name, config));
    total += requests.length;
    log(`${date}: submitting ${requests.length} requests to ${name}`);
    try {
      handles[name] = await impl.submit(requests, { providerConfig: cfg });
    } catch (err) {
      log(`${date}: ${name} submit failed: ${err.message}`);
      handles[name] = { kind: 'inline', results: [], error: String(err.message ?? err) };
    }
  }

  writeJSON(paths.batch(date), {
    date,
    submitted_at: new Date().toISOString(),
    prompt_version: config.sampling.prompt_version,
    templates: templates.all.map((t) => t.id),
    request_count: total,
    handles,
  });
  log(`${date}: submitted ${total} requests across ${providers.length} providers`);
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const templates = loadTemplates(readJSON, paths, listJSON);

  const done = new Set(listJSON(paths.data('tracker')).map((f) => f.replace('.json', '')));
  const dates = missingDates(BACKFILL_WINDOW, (d) => done.has(d), today());

  if (dates.length === 0) {
    log('nothing to submit; the window is complete');
    return;
  }
  log(`submitting for: ${dates.join(', ')}`);
  for (const date of dates) await submitForDate(date, config, templates);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
