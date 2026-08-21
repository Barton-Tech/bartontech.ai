#!/usr/bin/env node
// The experiment loop. Once a month, after the recognition check, Claude
// reads the recognition log, the site's crawler-facing surfaces, and every
// prior experiment, judges the most recent one against the newest results,
// and proposes at most one falsifiable change for the coming month.
//
// The proposal is a log entry plus a review issue, never an applied change:
// a person applies it (or declines), the same trust model as the weekly
// model refresh. Next month's recognition entry is the result, in public.
// Unlike the recognition prompt, this call knows everything about the site;
// it is the optimizer, not the measurement.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { thisMonth } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { assertWithinBudget, usd } from './lib/cost.js';
import { EXPERIMENT } from './lib/schemas.js';
import { experimentSystem, experimentUser } from './lib/prompts.js';
import { TITLE, DESCRIPTION, NAV_ITEMS, faqItems } from './lib/seo.js';

// What the optimizer is allowed to see and propose against: the surfaces a
// crawler reads. Assembled from the same sources the build renders from, so
// the model quotes real current text rather than a stale copy.
export function currentSurfaces() {
  const registry = readJSON(paths.registry());
  const months = listJSON(paths.data('index')).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  const latest = months.length ? readJSON(paths.data('index', months[months.length - 1])) : null;
  const top = latest?.board?.[0] ?? null;
  const entry = top ? registry.problems.find((p) => p.id === top.canonical_id) : null;
  const faq = faqItems({
    topProblem: top?.canonical_name ?? null,
    topPlain: entry?.plain ?? null,
  });
  return [
    `Title: ${TITLE}`,
    `Meta description: ${DESCRIPTION}`,
    `Navigation: ${NAV_ITEMS.map((n) => n.label).join(', ')}`,
    '',
    'FAQ (also FAQPage structured data):',
    ...faq.map((f) => `Q: ${f.q}\nA: ${f.a}`),
  ].join('\n');
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');
  const month = args[0] ?? thisMonth();
  const file = paths.data('experiments', `${month}.json`);

  if (exists(file) && !force) {
    log(`${month}: experiment already proposed, nothing to do`);
    return;
  }

  const recognitions = listJSON(paths.data('recognition'))
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => readJSON(paths.data('recognition', f)));
  if (recognitions.length === 0) {
    log('no recognition log yet; the experiment loop starts after the first check');
    return;
  }
  const previous = listJSON(paths.data('experiments'))
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f) && f.slice(0, 7) < month)
    .map((f) => readJSON(paths.data('experiments', f)));

  const anthropic = enabledProviders(config).find((p) => p.name === 'anthropic');
  if (!anthropic) throw new Error('the experiment loop requires the anthropic provider');

  const guard = assertWithinBudget(
    [{ provider: 'anthropic', requests: [{ tier: 'reasoning', grounded: false }] }],
    config,
  );
  log(`proposing the ${month} experiment (projected ${usd(guard.projection.total)})`);

  const res = await anthropic.impl.once(
    {
      custom_id: `experiment__${month}`,
      tier: 'reasoning',
      grounded: false,
      system: experimentSystem(),
      user: experimentUser({ month, recognitions, surfaces: currentSurfaces(), previous }),
      schema: EXPERIMENT,
    },
    { providerConfig: anthropic.cfg },
  );
  if (!res.ok) throw new Error(`experiment proposal failed: ${res.error}`);

  if (force && exists(file)) {
    const prior = readJSON(file);
    const n = listJSON(paths.data('experiments/archive')).filter((f) => f.startsWith(month)).length + 1;
    writeJSON(paths.data('experiments/archive', `${month}.v${n}.json`), prior);
    log(`archived the previous ${month} proposal as v${n}`);
  }

  writeJSON(file, {
    month,
    generated_at: new Date().toISOString(),
    provenance: provenance(config, { model: res.model ?? anthropic.cfg.models.reasoning }),
    model: res.model ?? anthropic.cfg.models.reasoning,
    usage: res.usage ?? null,
    proposal: res.data,
  });
  log(
    res.data.no_change
      ? `wrote ${month}: no change (${res.data.hypothesis})`
      : `wrote ${month}: ${res.data.change.surface} change proposed (${res.data.hypothesis})`,
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
