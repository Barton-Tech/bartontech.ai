#!/usr/bin/env node
// Stage 2 of the daily run. Polls each pending batch, aggregates the results
// into one dated tracker file, and removes the pending file. Runs that are not
// ready yet are left alone for the next invocation.
//
// Raw model responses are stored alongside the parsed extraction, so a later
// parser improvement can re-derive history instead of losing it.

import fs from 'node:fs';
import { paths, readJSON, writeJSON, listJSON, provenance, log } from './lib/io.js';
import { enabledProviders } from './lib/providers/index.js';
import { loadTemplates } from './lib/requests.js';
import { parseCustomId } from './lib/requests.js';
import { aggregateTemplate } from './lib/aggregate.js';

async function collectDate(pendingFile, config, templates) {
  const pending = readJSON(pendingFile);
  const providers = enabledProviders(config);
  const results = [];
  const failures = [];
  let allReady = true;

  for (const { name, impl } of providers) {
    const handle = pending.handles?.[name];
    if (!handle) continue;
    if (handle.error) {
      failures.push({ provider: name, error: handle.error, stage: 'submit' });
      continue;
    }
    let collected;
    try {
      collected = await impl.collect(handle);
    } catch (err) {
      failures.push({ provider: name, error: String(err.message ?? err), stage: 'collect' });
      continue;
    }
    if (!collected.ready) {
      log(`${pending.date}: ${name} still ${collected.status ?? 'processing'}`);
      allReady = false;
      continue;
    }
    results.push(...collected.results);
  }

  if (!allReady) return false;

  for (const r of results) {
    if (!r.ok) failures.push({ custom_id: r.custom_id, error: r.error, stage: 'response' });
  }

  const byTemplate = new Map();
  for (const r of results) {
    const { template } = parseCustomId(r.custom_id);
    if (!byTemplate.has(template)) byTemplate.set(template, []);
    byTemplate.get(template).push(r);
  }

  const out = {
    date: pending.date,
    submitted_at: pending.submitted_at,
    collected_at: new Date().toISOString(),
    provenance: provenance(config, {
      prompt_version: pending.prompt_version,
      models: Object.fromEntries(
        providers.map(({ name, cfg }) => [name, cfg.models]),
      ),
    }),
    templates: {},
    failures,
  };

  for (const template of templates.all) {
    const rows = byTemplate.get(template.id) ?? [];
    if (rows.length === 0) continue;
    out.templates[template.id] = aggregateTemplate(template, rows);
  }

  writeJSON(paths.tracker(pending.date), out);
  writeJSON(paths.data('raw', `${pending.date}.json`), {
    date: pending.date,
    responses: results.map((r) => ({
      custom_id: r.custom_id,
      ok: r.ok,
      model: r.model ?? null,
      usage: r.usage ?? null,
      raw: r.raw ?? null,
      error: r.error ?? null,
    })),
  });
  fs.rmSync(pendingFile);
  log(
    `${pending.date}: wrote ${Object.keys(out.templates).length} templates, ` +
      `${results.filter((r) => r.ok).length} ok, ${failures.length} failed`,
  );
  return true;
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  const templates = loadTemplates(readJSON, paths, listJSON);
  const pendingFiles = listJSON(paths.data('batches'));

  if (pendingFiles.length === 0) {
    log('no pending batches');
    return;
  }

  for (const file of pendingFiles) {
    await collectDate(paths.data('batches', file), config, templates);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
