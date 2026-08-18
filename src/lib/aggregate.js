import { parseCustomId } from './requests.js';

const round = (n, places = 4) =>
  Number.isFinite(n) ? Number(n.toFixed(places)) : null;

function emptyBucket() {
  return {
    mentions: 0,
    rank_sum: 0,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
  };
}

function shareOf(bucket, total) {
  return total > 0 ? round(bucket.mentions / total) : 0;
}

// A "run" is one (provider, pass, sample) unit answering every question in the
// template. Share is computed within a run, then summarised across runs, which
// is what makes a variance band possible. A single sample reported to two
// decimals is not a credible number.
export function aggregateTemplate(template, results) {
  const known = new Set(template.entities);
  const entities = new Map();
  const other = new Map();
  const runs = new Map();
  const providers = new Set();
  const sources = new Set();
  const topByProviderQuestion = new Map();
  let responses = 0;
  let failed = 0;
  let totalMentions = 0;

  const ensure = (map, name) => {
    if (!map.has(name)) map.set(name, { total: emptyBucket(), by_provider: {}, by_pass: {} });
    return map.get(name);
  };

  for (const result of results) {
    const meta = parseCustomId(result.custom_id);
    providers.add(meta.provider);

    if (!result.ok) {
      failed += 1;
      continue;
    }
    responses += 1;

    const runKey = `${meta.provider}|${meta.pass}|${meta.sample}`;
    if (!runs.has(runKey)) runs.set(runKey, { total: 0, byEntity: new Map() });
    const run = runs.get(runKey);

    for (const url of result.data.sources ?? []) sources.add(url);

    const seenThisResponse = new Map();

    for (const mention of result.data.mentions ?? []) {
      const name = String(mention.name || '').trim();
      if (!name) continue;
      const isKnown = known.has(name);
      const map = isKnown ? entities : other;
      const record = ensure(map, name);

      record.total.mentions += 1;
      record.total.rank_sum += Number(mention.rank) || 0;
      const sentiment = ['positive', 'neutral', 'negative'].includes(mention.sentiment)
        ? mention.sentiment
        : 'neutral';
      record.total.sentiment[sentiment] += 1;

      record.by_provider[meta.provider] ??= emptyBucket();
      record.by_provider[meta.provider].mentions += 1;
      record.by_pass[meta.pass] ??= emptyBucket();
      record.by_pass[meta.pass].mentions += 1;

      totalMentions += 1;
      if (isKnown) {
        run.total += 1;
        run.byEntity.set(name, (run.byEntity.get(name) ?? 0) + 1);
        const best = seenThisResponse.get(name) ?? Infinity;
        seenThisResponse.set(name, Math.min(best, Number(mention.rank) || 99));
      }
    }

    // Top-1 per (provider, question), used for the cross-model agreement rate.
    const top = [...seenThisResponse.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
    if (top) {
      const key = meta.question;
      if (!topByProviderQuestion.has(key)) topByProviderQuestion.set(key, new Map());
      const perProvider = topByProviderQuestion.get(key);
      perProvider.set(meta.provider, (perProvider.get(meta.provider) ?? new Map()));
      const tally = perProvider.get(meta.provider);
      tally.set(top, (tally.get(top) ?? 0) + 1);
    }
  }

  // Variance band: per-run share for each entity, then min/mean/max across runs.
  const runShares = new Map();
  for (const run of runs.values()) {
    for (const name of entities.keys()) {
      const share = run.total > 0 ? (run.byEntity.get(name) ?? 0) / run.total : 0;
      if (!runShares.has(name)) runShares.set(name, []);
      runShares.get(name).push(share);
    }
  }

  const knownMentions = [...entities.values()].reduce((n, r) => n + r.total.mentions, 0);

  const entityOut = {};
  for (const [name, record] of entities) {
    const shares = runShares.get(name) ?? [];
    entityOut[name] = {
      mentions: record.total.mentions,
      share: shareOf(record.total, knownMentions),
      share_low: shares.length ? round(Math.min(...shares)) : 0,
      share_high: shares.length ? round(Math.max(...shares)) : 0,
      mean_rank:
        record.total.mentions > 0
          ? round(record.total.rank_sum / record.total.mentions, 2)
          : null,
      sentiment: record.total.sentiment,
      by_provider: Object.fromEntries(
        Object.entries(record.by_provider).map(([p, b]) => [p, b.mentions]),
      ),
      by_pass: Object.fromEntries(
        Object.entries(record.by_pass).map(([p, b]) => [p, b.mentions]),
      ),
    };
  }

  const otherOut = [...other.entries()]
    .map(([name, record]) => ({ name, mentions: record.total.mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 40);

  return {
    template: template.id,
    label: template.label,
    totals: { responses, failed, mentions: totalMentions, runs: runs.size },
    entities: entityOut,
    other: otherOut,
    agreement: agreementRate(topByProviderQuestion),
    sources: [...sources].sort().slice(0, 200),
    providers: [...providers].sort(),
  };
}

// Fraction of provider pairs that pick the same top entity, averaged over
// questions. A number near 1 means the models are echoing one consensus; a
// number near 0 means the answer a brand gets depends entirely on which
// assistant the buyer opened.
function agreementRate(topByProviderQuestion) {
  const scores = [];
  for (const perProvider of topByProviderQuestion.values()) {
    const picks = [...perProvider.values()].map(
      (tally) => [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
    );
    if (picks.length < 2) continue;
    let agree = 0;
    let pairs = 0;
    for (let i = 0; i < picks.length; i += 1) {
      for (let j = i + 1; j < picks.length; j += 1) {
        pairs += 1;
        if (picks[i] && picks[i] === picks[j]) agree += 1;
      }
    }
    if (pairs > 0) scores.push(agree / pairs);
  }
  if (scores.length === 0) return null;
  return round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
