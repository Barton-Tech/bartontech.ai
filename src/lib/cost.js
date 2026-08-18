// Spend guard.
//
// The primary guard projects what a run is about to cost BEFORE any API call
// and refuses to start if it exceeds the ceiling. That ordering is the whole
// point: cost is incurred at submit time, so a guard that reads recorded spend
// is blind to exactly the failure it needs to catch, namely a run whose results
// never persisted. Projection needs no history and works on a first run.
//
// The rolling guard reads recorded usage and catches slower problems: token
// growth, price rises, an estimate that turns out to be wrong.

import { paths, readJSON, listJSON } from './io.js';
import { parseCustomId } from './requests.js';
import { shiftDays, today } from './dates.js';

const M = 1_000_000;

function modelPrice(config, provider, model) {
  const table = config.pricing?.[provider];
  const price = table?.[model];
  if (!price) throw new Error(`no pricing for ${provider}/${model}; add it to config.pricing`);
  return { ...price, discount: table.batch_discount ?? 1, search: table.search_per_call ?? 0 };
}

// Average observed tokens per (provider, pass), from stored raw responses.
// Only used where there is enough signal; otherwise the configured estimate
// stands in.
export function measuredAverages(minSamples = 20) {
  const acc = new Map();
  for (const file of listJSON(paths.data('raw'))) {
    const day = readJSON(paths.data('raw', file), null);
    for (const r of day?.responses ?? []) {
      if (!r.ok || !r.usage) continue;
      const { provider, pass } = parseCustomId(r.custom_id);
      const key = `${provider}|${pass}`;
      const u = r.usage;
      const inTok = u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount ?? 0;
      const outTok = u.output_tokens ?? u.completion_tokens ?? u.candidatesTokenCount ?? 0;
      if (!acc.has(key)) acc.set(key, { in: 0, out: 0, n: 0 });
      const a = acc.get(key);
      a.in += inTok; a.out += outTok; a.n += 1;
    }
  }
  const out = new Map();
  for (const [key, a] of acc) {
    if (a.n >= minSamples) out.set(key, { in: a.in / a.n, out: a.out / a.n, n: a.n });
  }
  return out;
}

function tokensFor(config, measured, provider, grounded) {
  const pass = grounded ? 'grounded' : 'ungrounded';
  return measured.get(`${provider}|${pass}`) ?? config.token_estimates[pass];
}

// What this run is about to cost, before it runs.
export function projectCost(plan, config, measured = measuredAverages()) {
  const byProvider = new Map();
  let total = 0;

  for (const { provider, requests } of plan) {
    const cfg = config.providers[provider];
    let subtotal = 0;
    for (const req of requests) {
      const model = cfg.models[req.tier];
      const p = modelPrice(config, provider, model);
      const t = tokensFor(config, measured, provider, req.grounded);
      subtotal +=
        ((t.in / M) * p.in + (t.out / M) * p.out) * p.discount +
        (req.grounded ? p.search : 0);
    }
    // A plan holds one entry per (date, provider), so this accumulates across
    // dates rather than overwriting the previous date's subtotal.
    byProvider.set(provider, (byProvider.get(provider) ?? 0) + subtotal);
    total += subtotal;
  }
  return { total, byProvider, basis: measured.size > 0 ? 'measured' : 'estimated' };
}

// Recorded spend over a trailing window, from stored usage.
export function recordedSpend(config, days = 7, end = today()) {
  const from = shiftDays(end, -(days - 1));
  let total = 0;
  for (const file of listJSON(paths.data('raw'))) {
    const date = file.replace('.json', '');
    if (date < from || date > end) continue;
    const day = readJSON(paths.data('raw', file), null);
    for (const r of day?.responses ?? []) {
      if (!r.ok || !r.usage || !r.model) continue;
      const { provider, pass } = parseCustomId(r.custom_id);
      let p;
      try { p = modelPrice(config, provider, r.model); } catch { continue; }
      const u = r.usage;
      const inTok = u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount ?? 0;
      const outTok = u.output_tokens ?? u.completion_tokens ?? u.candidatesTokenCount ?? 0;
      total +=
        ((inTok / M) * p.in + (outTok / M) * p.out) * p.discount +
        (pass === 'grounded' ? p.search : 0);
    }
  }
  return total;
}

export const usd = (n) => `$${n.toFixed(2)}`;

// Throws rather than returning a flag: a spend guard that can be ignored by a
// caller that forgets to check the return value is not a guard.
export function assertWithinBudget(plan, config) {
  const measured = measuredAverages();
  const projection = projectCost(plan, config, measured);
  const rolling = recordedSpend(config, 7);
  const { max_run_usd: maxRun, max_rolling_7d_usd: maxRolling } = config.budget;

  const detail =
    `projected ${usd(projection.total)} (${projection.basis}) ` +
    `[${[...projection.byProvider].map(([k, v]) => `${k} ${usd(v)}`).join(', ')}], ` +
    `recorded last 7d ${usd(rolling)}`;

  if (projection.total > maxRun) {
    throw new Error(
      `run refused: ${detail}. Projected cost exceeds budget.max_run_usd ` +
        `(${usd(maxRun)}). Nothing was submitted. Either the run is larger than ` +
        `intended, or raise the ceiling deliberately.`,
    );
  }
  if (rolling + projection.total > maxRolling) {
    throw new Error(
      `run refused: ${detail}. Recorded plus projected exceeds ` +
        `budget.max_rolling_7d_usd (${usd(maxRolling)}). Nothing was submitted.`,
    );
  }
  return { projection, rolling, detail };
}
