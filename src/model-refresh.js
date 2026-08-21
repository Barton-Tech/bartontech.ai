#!/usr/bin/env node
// Weekly model refresh. Keeps the configured models from going stale without
// letting automation corrupt the pipeline.
//
// Three stages, each with a different trust level:
//   1. Deterministic: fetch each provider's live model list and check every
//      configured id still exists. A missing id is urgent, because every run
//      that uses it fails.
//   2. Claude, grounded: review the configuration against the fetched lists
//      and current pricing, and propose the most applicable model per tier.
//      Stability is instructed: no churn for marginal gains.
//   3. Validation: every proposed id must appear in the fetched lists, and
//      every price must be a positive number. A proposal that fails is
//      discarded, because a wrong price corrupts the spend guard.
//
// The result is a PR, never a direct commit. Model pricing feeds cost
// projection, so a human verifies prices before they take effect. Old pricing
// entries are kept when models change, because recorded historical spend is
// priced by the model that produced it.

import fs from 'node:fs';
import { paths, readJSON, log } from './lib/io.js';
import { enabledProviders, assertConfigured } from './lib/providers/index.js';
import { MODEL_REFRESH } from './lib/schemas.js';
import { modelRefreshSystem, modelRefreshUser } from './lib/prompts.js';

const REPORT = process.env.REPORT_PATH ?? '/tmp/model-refresh-report.md';

const FILTERS = {
  anthropic: (id) => /^claude/.test(id),
  openai: (id) => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|transcribe|tts|image)/.test(id),
  google: (id) => /gemini/.test(id) && !/(embed|image|tts|live|audio|veo|imagen)/.test(id),
};

async function fetchAvailable() {
  const available = {};
  const errors = {};

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const ids = [];
    for await (const m of new Anthropic().models.list()) ids.push(m.id);
    available.anthropic = ids.filter(FILTERS.anthropic).sort();
  } catch (err) {
    errors.anthropic = String(err.message ?? err);
  }

  try {
    const { default: OpenAI } = await import('openai');
    const ids = [];
    for await (const m of new OpenAI().models.list()) ids.push(m.id);
    available.openai = ids.filter(FILTERS.openai).sort();
  } catch (err) {
    errors.openai = String(err.message ?? err);
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ids = [];
    const pager = await new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }).models.list();
    for await (const m of pager) ids.push(String(m.name ?? '').replace(/^models\//, ''));
    available.google = ids.filter(FILTERS.google).sort();
  } catch (err) {
    errors.google = String(err.message ?? err);
  }

  return { available, errors };
}

export function findMissing(config, available) {
  const missing = [];
  for (const [name, p] of Object.entries(config.providers)) {
    if (!p.enabled || !available[name]) continue; // unverifiable is not missing
    for (const [tier, id] of Object.entries(p.models)) {
      if (!available[name].includes(id)) missing.push(`${name}.${tier}=${id}`);
    }
  }
  return missing;
}

export function validateProposal(proposal, available, config) {
  for (const prov of proposal.providers ?? []) {
    const list = available[prov.provider];
    if (!config.providers[prov.provider]?.enabled) continue;
    for (const t of prov.tiers ?? []) {
      if (list && !list.includes(t.model_id)) {
        throw new Error(
          `proposal rejected: ${prov.provider}.${t.tier}=${t.model_id} is not in the provider's live model list`,
        );
      }
      if (!(t.price_in > 0) || !(t.price_out > 0)) {
        throw new Error(`proposal rejected: non-positive price for ${prov.provider}.${t.tier}`);
      }
    }
  }
}

// Old pricing entries are preserved on purpose: recorded spend is priced by
// the model that produced it, so removing a superseded model's price would
// silently under-count the rolling budget window.
export function mergeProposal(config, proposal) {
  const next = structuredClone(config);
  for (const prov of proposal.providers ?? []) {
    const target = next.providers[prov.provider];
    const pricing = next.pricing[prov.provider];
    if (!target) continue;
    if (prov.batch_discount > 0) pricing.batch_discount = prov.batch_discount;
    if (prov.search_per_call >= 0) pricing.search_per_call = prov.search_per_call;
    for (const t of prov.tiers ?? []) {
      target.models[t.tier] = t.model_id;
      pricing[t.model_id] = { in: t.price_in, out: t.price_out };
    }
  }
  return next;
}

function report({ missing, errors, proposal, changed }) {
  const lines = ['## Weekly model refresh', ''];
  if (missing.length) {
    lines.push(`URGENT: configured models missing from provider lists: ${missing.join(', ')}.`);
    lines.push('Every run using them will fail until this merges.', '');
  }
  for (const [prov, err] of Object.entries(errors)) {
    lines.push(`Could not verify ${prov} (list fetch failed: ${err}); its models were left untouched.`);
  }
  if (proposal) {
    lines.push('', proposal.summary, '');
    for (const prov of proposal.providers) {
      for (const t of prov.tiers) {
        lines.push(`- ${prov.provider}.${t.tier}: ${t.model_id} ($${t.price_in}/$${t.price_out} per MTok) since ${t.rationale} (source: ${t.source_url})`);
      }
    }
    lines.push('', 'Verify the prices before merging: the spend guard prices every run from this table.');
  } else if (!changed) {
    lines.push('No changes proposed; the current configuration is still the most applicable.');
  }
  fs.writeFileSync(REPORT, lines.join('\n') + '\n');
  log(`report written to ${REPORT}`);
}

async function main() {
  const config = readJSON(paths.config('models.json'));
  assertConfigured(config);

  const { available, errors } = await fetchAvailable();
  for (const [name, ids] of Object.entries(available)) log(`${name}: ${ids.length} models listed`);
  for (const [name, err] of Object.entries(errors)) log(`${name}: list fetch FAILED (${err})`);
  const missing = findMissing(config, available);
  if (missing.length) log(`URGENT: missing from provider lists: ${missing.join(', ')}`);

  let proposal;
  try {
    const anthropic = enabledProviders(config).find((p) => p.name === 'anthropic');
    const res = await anthropic.impl.once(
      {
        custom_id: 'model-refresh',
        tier: 'reasoning',
        grounded: true,
        system: modelRefreshSystem(),
        user: modelRefreshUser({ config, available, missing }),
        schema: MODEL_REFRESH,
      },
      { providerConfig: anthropic.cfg },
    );
    if (!res.ok) throw new Error(res.error);
    proposal = res.data;
  } catch (err) {
    log(`proposal step failed: ${err.message ?? err}`);
    report({ missing, errors, proposal: null, changed: false });
    // A missing model with no proposal still needs a human, which the report
    // and the workflow's issue step handle; the run itself has done its job.
    return;
  }

  if (!proposal.changed) {
    log('no changes proposed');
    report({ missing, errors, proposal: null, changed: false });
    return;
  }

  validateProposal(proposal, available, config);
  const next = mergeProposal(config, proposal);
  fs.writeFileSync(paths.config('models.json'), `${JSON.stringify(next, null, 2)}\n`);
  report({ missing, errors, proposal, changed: true });
  log('config/models.json updated; the workflow opens a PR from the diff');
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
