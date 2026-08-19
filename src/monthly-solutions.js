#!/usr/bin/env node
// Asks each model how it would attack the month's top problem, all three in the
// same format, and stores the answers side by side.
//
// One shared format per month rather than letting each model choose. Per-model
// choice was the original idea and it does not survive contact with the point
// of the site: if one answers in prose and another in code, style differences
// swamp substance and you cannot tell whether the models actually disagree.
// Rotating monthly keeps variety across time while holding format constant
// within a month, which makes the format a controlled variable.

import { paths, readJSON, writeJSON, listJSON, provenance, log } from './lib/io.js';
import { thisMonth } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { SOLUTION } from './lib/schemas.js';
import { solutionSystem, solutionUser } from './lib/prompts.js';

// Monotonic month index gives an exact cycle: every format appears once per
// pass, and the same month always resolves to the same format on a rerun.
export function formatForMonth(month, formats) {
  const [y, m] = month.split('-').map(Number);
  return formats[(y * 12 + (m - 1)) % formats.length];
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const month = process.argv[2] ?? thisMonth();

  const index = readJSON(paths.index(month), null);
  if (!index?.board?.length) {
    throw new Error(`no board for ${month}; run the monthly index first`);
  }
  const registry = readJSON(paths.registry());
  const top = index.board[0];
  const entry = registry.problems.find((p) => p.id === top.canonical_id);
  const format = formatForMonth(month, readJSON(paths.config('formats.json')).formats);

  log(`${month}: asking about "${top.canonical_name}" in format "${format.id}"`);

  const system = solutionSystem(format);
  const user = solutionUser({
    problem: top.canonical_name,
    plain: entry?.plain ?? '',
    definition: entry?.definition ?? '',
    why_unsolved: entry?.why_unsolved ?? '',
    format,
  });

  const answers = [];
  const failures = [];

  await Promise.all(
    enabledProviders(config).map(async ({ name, cfg, impl }) => {
      const started = Date.now();
      try {
        const res = await impl.once(
          { custom_id: `solution__${name}`, tier: 'reasoning', grounded: false, system, user, schema: SOLUTION },
          { providerConfig: cfg },
        );
        if (!res.ok) return failures.push({ provider: name, error: res.error });
        answers.push({ provider: name, label: cfg.label, model: res.model ?? cfg.models.reasoning, ...res.data });
        log(`${name} done in ${Math.round((Date.now() - started) / 1000)}s`);
      } catch (err) {
        failures.push({ provider: name, error: String(err.message ?? err) });
      }
    }),
  );

  if (answers.length === 0) throw new Error(`no answers gathered: ${JSON.stringify(failures)}`);

  // Stable provider order so a rerun renders identically.
  const order = enabledProviders(config).map((p) => p.name);
  answers.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));

  writeJSON(paths.data('solutions', `${month}.json`), {
    month,
    generated_at: new Date().toISOString(),
    provenance: provenance(config),
    problem: {
      canonical_id: top.canonical_id,
      canonical_name: top.canonical_name,
      plain: entry?.plain ?? '',
    },
    format: { id: format.id, label: format.label, instruction: format.instruction },
    answers,
    failures,
  });
  log(`wrote ${answers.length} answers, ${failures.length} failures`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
