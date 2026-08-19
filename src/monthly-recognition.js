#!/usr/bin/env node
// The recognition log. Once a month, asks each model one neutral question
// with web search on and no hints: what is bartontech.ai? The verbatim
// answers are stored append-only, including every "I could not find much".
//
// Getting named by AI answers is one of the problems on the board, so this is
// the experiment run on the site itself. The early entries are expected to be
// embarrassing; the point is to record the date that changes, per model. The
// prompt must never describe the site: the moment the question leaks the
// answer, the log measures prompt-following rather than recognition.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { thisMonth } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { assertWithinBudget, usd } from './lib/cost.js';
import { RECOGNITION } from './lib/schemas.js';
import { recognitionSystem, recognitionUser } from './lib/prompts.js';

// Search-infrastructure redirect hosts are plumbing, not sources a reader can
// evaluate, so they are dropped from the stored source list.
const INFRASTRUCTURE = /vertexaisearch\.cloud\.google\.com|googleusercontent\.com/;

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');
  const month = args[0] ?? thisMonth();
  const file = paths.data('recognition', `${month}.json`);

  // Append-only, like every other record here. A rerun has to be asked for,
  // and a forced rerun archives the prior version rather than discarding it.
  if (exists(file) && !force) {
    log(`${month}: recognition already logged, nothing to do`);
    return;
  }

  const providers = enabledProviders(config);
  const guard = assertWithinBudget(
    providers.map(({ name }) => ({ provider: name, requests: [{ tier: 'grounded', grounded: true }] })),
    config,
  );
  log(`asking ${providers.length} models (projected ${usd(guard.projection.total)})`);

  const user = recognitionUser({ month });
  const results = [];
  const failures = [];
  await Promise.all(
    providers.map(async ({ name, cfg, impl }) => {
      try {
        const res = await impl.once(
          {
            custom_id: `recognition__${name}`,
            tier: 'grounded',
            grounded: true,
            system: recognitionSystem(),
            user,
            schema: RECOGNITION,
          },
          { providerConfig: cfg },
        );
        if (!res.ok) return failures.push({ provider: name, error: res.error });
        results.push({
          provider: name,
          label: cfg.label,
          model: res.model ?? cfg.models.grounded,
          ...res.data,
          sources: (res.data.sources ?? []).filter((u) => !INFRASTRUCTURE.test(u)),
        });
        log(`${name}: familiar=${res.data.familiar} (basis: ${res.data.basis})`);
      } catch (err) {
        failures.push({ provider: name, error: String(err.message ?? err) });
      }
    }),
  );

  if (results.length === 0) {
    throw new Error(`no recognition answers gathered: ${JSON.stringify(failures)}`);
  }
  const order = providers.map((p) => p.name);
  results.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));

  if (force && exists(file)) {
    const prior = readJSON(file);
    const n = listJSON(paths.data('recognition/archive')).filter((f) => f.startsWith(month)).length + 1;
    writeJSON(paths.data('recognition/archive', `${month}.v${n}.json`), prior);
    log(`archived the previous ${month} log entry as v${n}`);
  }

  writeJSON(file, {
    month,
    generated_at: new Date().toISOString(),
    question: user,
    provenance: provenance(config, {
      models: Object.fromEntries(providers.map(({ name, cfg }) => [name, cfg.models.grounded])),
    }),
    results,
    failures,
  });
  log(`wrote ${results.length} answers, ${failures.length} failures`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
