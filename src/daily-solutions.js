#!/usr/bin/env node
// Asks each model how it would attack one problem from the board, all three in
// the same format, and stores the answers side by side. Runs daily.
//
// Two rotations at different speeds, deliberately. The PROBLEM rotates daily
// down the board, so a full pass covers every problem before repeating and each
// day is genuinely new content rather than a re-ask of the same question. The
// FORMAT rotates monthly, so within a month it is constant and answers stay
// comparable across problems as well as across models.
//
// One shared format rather than letting each model choose. Per-model choice was
// the original idea and it does not survive contact with the point of the site:
// if one answers in prose and another in code, style differences swamp substance
// and you cannot tell whether the models actually disagree.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { thisMonth, today } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { SOLUTION } from './lib/schemas.js';
import { solutionSystem, solutionUser } from './lib/prompts.js';

// Monotonic month index gives an exact cycle: every format appears once per
// pass, and the same month always resolves to the same format on a rerun.
export function formatForMonth(month, formats) {
  const [y, m] = month.split('-').map(Number);
  return formats[(y * 12 + (m - 1)) % formats.length];
}

// Days since epoch, so the walk down the board is continuous across month
// boundaries and a given date always resolves to the same position.
export function problemForDate(date, board) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return board[day % board.length];
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const date = process.argv[2] ?? today();
  const month = date.slice(0, 7);

  if (exists(paths.data('solutions', `${date}.json`))) {
    log(`${date}: already answered, nothing to do`);
    return;
  }

  // Use the most recent published board, which may be an earlier month than
  // today if the monthly run has not fired yet.
  const months = listJSON(paths.data('index'));
  const latest = months.length ? readJSON(paths.data('index', months[months.length - 1])) : null;
  if (!latest?.board?.length) {
    log('no board published yet; skipping until the monthly index has run');
    return;
  }

  const registry = readJSON(paths.registry());
  const top = problemForDate(date, latest.board);
  const entry = registry.problems.find((p) => p.id === top.canonical_id);
  const format = formatForMonth(month, readJSON(paths.config('formats.json')).formats);

  log(`${date}: asking about "${top.canonical_name}" in format "${format.id}"`);

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

  writeJSON(paths.data('solutions', `${date}.json`), {
    date,
    month,
    board_month: latest.month,
    board_rank: latest.board.indexOf(top) + 1,
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

// Only run when invoked directly. The rotation helpers are exported for tests
// and for the site build, and importing them should not fire a paid run.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
