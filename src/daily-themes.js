#!/usr/bin/env node
// The themes layer. Once a day, Claude reads the whole record from the last
// six months, every monthly board and every day's answers, and names the
// cross-cutting themes.
//
// This is deliberately a single-model synthesis, distinct from the
// multi-model measurements everywhere else on the site, and the page labels
// it as such. Stability is the design constraint: yesterday's themes are
// passed back in and renaming is discouraged, so a reader who visits two days
// running sees the same themes unless the record actually moved. Movement is
// recorded in the trend field, not by churning the names.

import { paths, readJSON, writeJSON, exists, listJSON, provenance, log } from './lib/io.js';
import { today } from './lib/dates.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { THEMES } from './lib/schemas.js';
import { themesSystem, themesUser } from './lib/prompts.js';

const WINDOW_MONTHS = 6;

export function windowStart(date, months = WINDOW_MONTHS) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function loadWindow(date) {
  const from = windowStart(date);
  const boards = listJSON(paths.data('index'))
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f) && f.slice(0, 7) >= from.slice(0, 7))
    .map((f) => readJSON(paths.data('index', f)))
    .map((m) => ({ month: m.month, board: m.board }));
  const solutions = listJSON(paths.data('solutions'))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) >= from && f.slice(0, 10) <= date)
    .map((f) => readJSON(paths.data('solutions', f)));
  const themeFiles = listJSON(paths.data('themes')).filter(
    (f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < date,
  );
  const previous = themeFiles.length
    ? readJSON(paths.data('themes', themeFiles[themeFiles.length - 1]))
    : null;
  return { from, boards, solutions, previous };
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);
  const date = process.argv[2] ?? today();

  if (exists(paths.data('themes', `${date}.json`))) {
    log(`${date}: themes already written, nothing to do`);
    return;
  }

  const { from, boards, solutions, previous } = loadWindow(date);
  if (boards.length === 0) {
    log('no boards published yet; skipping until the monthly index has run');
    return;
  }

  const anthropic = enabledProviders(config).find((p) => p.name === 'anthropic');
  if (!anthropic) throw new Error('themes synthesis requires the anthropic provider');

  log(
    `${date}: synthesizing themes from ${boards.length} board(s) and ` +
      `${solutions.length} day(s) of answers (window from ${from})`,
  );

  const res = await anthropic.impl.once(
    {
      custom_id: `themes__${date}`,
      tier: 'reasoning',
      grounded: false,
      system: themesSystem(),
      user: themesUser({ date, boards, solutions, previous }),
      schema: THEMES,
    },
    { providerConfig: anthropic.cfg },
  );
  if (!res.ok) throw new Error(`themes synthesis failed: ${res.error}`);

  writeJSON(paths.data('themes', `${date}.json`), {
    date,
    generated_at: new Date().toISOString(),
    provenance: provenance(config, { model: res.model ?? anthropic.cfg.models.reasoning }),
    window: { from, to: date, months: WINDOW_MONTHS },
    based_on: { boards: boards.map((b) => b.month), solution_days: solutions.length },
    themes: res.data.themes,
  });
  log(`wrote ${res.data.themes.length} themes`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
