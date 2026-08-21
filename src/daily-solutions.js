#!/usr/bin/env node
// Asks each model how it would attack one problem from the board, in every
// format, and stores the answers side by side. Runs daily.
//
// The PROBLEM rotates daily down the board, so a full pass covers every
// problem before repeating. Every FORMAT is asked every day; the site shows
// one by default (seeded by the date, so it varies day to day but a rebuild
// within a day cannot re-roll it) and the visitor switches between the rest.
// Comparability holds within each format: all three models share it, so any
// difference between their answers in a panel is substance, not style.
//
// One shared format per panel rather than letting each model choose. Per-model
// choice was the original idea and it does not survive contact with the point
// of the site: if one answers in prose and another in code, style differences
// swamp substance and you cannot tell whether the models actually disagree.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { today } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { SOLUTION } from './lib/schemas.js';
import { solutionSystem, solutionUser } from './lib/prompts.js';

// Days since epoch, so the walk down the board is continuous across month
// boundaries and a given date always resolves to the same position.
export function problemForDate(date, board) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return board[day % board.length];
}

// The displayed default: seeded by the date rather than truly random, so it
// varies day to day but every rebuild of the same day agrees, and a rerun of
// the pipeline reproduces the record exactly.
export function defaultFormatForDate(date, formats) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return formats[h % formats.length];
}

async function askFormat({ format, top, entry, config }) {
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
          {
            custom_id: `solution__${format.id}__${name}`,
            tier: 'reasoning',
            grounded: false,
            system,
            user,
            schema: SOLUTION,
          },
          { providerConfig: cfg },
        );
        if (!res.ok) return failures.push({ provider: name, error: res.error });
        // Usage is stored so recorded spend stays computable from the file
        // alone; the display prices it by the model that produced it.
        answers.push({ provider: name, label: cfg.label, model: res.model ?? cfg.models.reasoning, ...res.data, usage: res.usage ?? null });
        log(`${format.id}/${name} done in ${Math.round((Date.now() - started) / 1000)}s`);
      } catch (err) {
        failures.push({ provider: name, error: String(err.message ?? err) });
      }
    }),
  );
  const order = enabledProviders(config).map((p) => p.name);
  answers.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  return {
    format: { id: format.id, label: format.label, instruction: format.instruction },
    answers,
    failures,
  };
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const date = process.argv[2] ?? today();

  if (exists(paths.data('solutions', `${date}.json`))) {
    log(`${date}: already answered, nothing to do`);
    return;
  }

  const months = listJSON(paths.data('index'));
  const latest = months.length ? readJSON(paths.data('index', months[months.length - 1])) : null;
  if (!latest?.board?.length) {
    log('no board published yet; skipping until the monthly index has run');
    return;
  }

  const registry = readJSON(paths.registry());
  const top = problemForDate(date, latest.board);
  const entry = registry.problems.find((p) => p.id === top.canonical_id);
  const allFormats = readJSON(paths.config('formats.json')).formats;
  const defaultFormat = defaultFormatForDate(date, allFormats);

  log(
    `${date}: asking about "${top.canonical_name}" in ${allFormats.length} formats ` +
      `(${enabledProviders(config).length * allFormats.length} calls), default "${defaultFormat.id}"`,
  );

  // All format/provider pairs run concurrently: each provider sees at most
  // one call per format at a time, well inside every rate limit.
  const formats = await Promise.all(
    allFormats.map((format) => askFormat({ format, top, entry, config })),
  );

  const usable = formats.filter((f) => f.answers.length > 0);
  if (usable.length === 0) {
    throw new Error(`no answers gathered in any format: ${JSON.stringify(formats.map((f) => f.failures))}`);
  }
  // The seeded default might have failed entirely; fall back to the first
  // format that has answers so the page always has something to show.
  const effectiveDefault = usable.some((f) => f.format.id === defaultFormat.id)
    ? defaultFormat.id
    : usable[0].format.id;

  writeJSON(paths.data('solutions', `${date}.json`), {
    date,
    month: date.slice(0, 7),
    board_month: latest.month,
    board_rank: latest.board.indexOf(top) + 1,
    generated_at: new Date().toISOString(),
    provenance: provenance(config),
    problem: {
      canonical_id: top.canonical_id,
      canonical_name: top.canonical_name,
      plain: entry?.plain ?? '',
    },
    default_format: effectiveDefault,
    formats,
  });
  const total = formats.reduce((n, f) => n + f.answers.length, 0);
  const failed = formats.reduce((n, f) => n + f.failures.length, 0);
  log(`wrote ${total} answers across ${usable.length} formats, ${failed} failures`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
