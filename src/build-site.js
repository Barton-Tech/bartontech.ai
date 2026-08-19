#!/usr/bin/env node
// Renders dist/ from whatever is in data/. Runs with zero data and produces a
// live page with empty chart frames, so the series starts accumulating in
// public from day one.
//
// The page is fully server-rendered: no content depends on JavaScript, because
// a site that measures AI-answer legibility has to be legible to the crawlers
// that build those answers.

import fs from 'node:fs';
import { paths, readJSON, listJSON, log } from './lib/io.js';
import { lineChart, barChart, rankedBoard, esc, fmtPct } from './lib/charts.js';
import { CSS } from './lib/page-css.js';
import {
  SITE,
  TITLE,
  DESCRIPTION,
  ROBOTS,
  llmsTxt,
  sitemap,
  structuredData,
  faqItems,
} from './lib/seo.js';

const TOP_N = 5;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232a78d6'/%3E%3Cpath d='M6 22 L13 14 L19 18 L26 8' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

function loadSeries(dir) {
  return listJSON(paths.data(dir)).map((f) => readJSON(paths.data(dir, f)));
}

function shareSeries(days, templateId) {
  const points = days
    .map((d) => ({ date: d.date, t: d.templates?.[templateId] }))
    .filter((d) => d.t);
  if (points.length === 0) return [];

  const latest = points[points.length - 1].t.entities;
  const ranked = Object.entries(latest)
    .sort((a, b) => b[1].share - a[1].share)
    .map(([name]) => name);
  const top = ranked.slice(0, TOP_N);
  const rest = new Set(ranked.slice(TOP_N));

  const series = top.map((name) => ({
    name,
    points: points
      .filter((p) => p.t.entities[name])
      .map((p) => ({
        x: p.date,
        y: p.t.entities[name].share,
        low: p.t.entities[name].share_low,
        high: p.t.entities[name].share_high,
      })),
  }));

  if (rest.size > 0) {
    series.push({
      name: 'Other',
      points: points.map((p) => ({
        x: p.date,
        y: Object.entries(p.t.entities)
          .filter(([n]) => rest.has(n))
          .reduce((sum, [, v]) => sum + v.share, 0),
      })),
    });
  }
  return series;
}

function indexSeries(months) {
  const byId = new Map();
  for (const m of months) {
    for (const entry of m.board ?? []) {
      if (!byId.has(entry.canonical_id)) {
        byId.set(entry.canonical_id, { name: entry.canonical_name, points: [] });
      }
      byId.get(entry.canonical_id).points.push({ x: m.month, y: entry.score });
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 6);
}

function latestSnapshot(days, months, registry) {
  const day = days[days.length - 1];
  const month = months[months.length - 1];
  const anchor = day?.templates?.anchor;
  return {
    generated_at: new Date().toISOString(),
    site: SITE,
    days_tracked: days.length,
    months_indexed: months.length,
    hottest_unsolved_problem: month?.board?.[0]
      ? {
          canonical_id: month.board[0].canonical_id,
          canonical_name: month.board[0].canonical_name,
          panel_score: month.board[0].score,
          month: month.month,
        }
      : null,
    board: month?.board ?? [],
    latest_day: day?.date ?? null,
    cross_model_agreement: anchor?.agreement ?? null,
    anchor_share_of_voice: anchor
      ? Object.entries(anchor.entities)
          .sort((a, b) => b[1].share - a[1].share)
          .slice(0, 10)
          .map(([name, v]) => ({
            name,
            share: v.share,
            share_low: v.share_low,
            share_high: v.share_high,
            mean_rank: v.mean_rank,
          }))
      : [],
    registry: {
      problems: registry.problems.map((p) => ({ id: p.id, name: p.canonical_name })),
      pending_review: registry.pending_review.length,
    },
  };
}

function build() {
  const days = loadSeries('tracker');
  const months = loadSeries('index');
  const registry = readJSON(paths.registry());
  const anchor = readJSON(paths.config('anchor.json'));
  const activeProblems = listJSON(paths.config('problems'))
    .map((f) => readJSON(paths.config('problems', f)))
    .filter((t) => t.status === 'active');

  const latestDay = days[days.length - 1];
  const latestMonth = months[months.length - 1];
  const topProblem = latestMonth?.board?.[0]?.canonical_name ?? null;
  const now = new Date();
  const lastmod = now.toISOString().slice(0, 10);
  const faq = faqItems({ topProblem, days: days.length, months: months.length });

  // The hook is the disagreement, not the roster. When three models answer the
  // same question about the same category and name different leaders, the brand
  // a buyer hears about depends on which assistant they happened to open.
  //
  // The headline uses each problem's plain-language gloss from the registry, so
  // a reader meets the idea in ordinary words and the industry term arrives in
  // the next sentence rather than the first.
  const topEntry = topProblem
    ? registry.problems.find((x) => x.id === latestMonth.board[0].canonical_id)
    : null;
  const topPlain = topEntry?.plain || topProblem;
  const topTemplate = topProblem ? latestDay?.templates?.[latestMonth.board[0].canonical_id] : null;
  const topAgreement = topTemplate?.agreement ?? null;
  const anchorAgreement = latestDay?.templates?.anchor?.agreement ?? null;

  const heroHeadline = topProblem
    ? `The hardest problem in martech right now is <em>${esc(topPlain)}</em>.`
    : 'Three AI models, asked each month what the industry cannot solve.';

  const heroDeck = topAgreement != null
    ? `Every day we ask ChatGPT, Claude, and Gemini who leads. They name the same company just ${fmtPct(topAgreement)} of the time. The industry calls this ${topProblem}.`
    : 'Every month they name the hardest unsolved problem. Every day they name who leads in it. We keep every answer, and we cannot go back and fill gaps in.';

  // These measure agreement about VENDORS, not about problems: for each
  // question, whether two models name the same leading company.
  const figures = [
    topAgreement != null
      ? { value: fmtPct(topAgreement), accent: true,
          label: 'They pick the same top company',
          note: `How often two of the three name the same leader for ${topPlain}.` }
      : { value: '--', accent: true, label: 'They pick the same top company', note: 'Waiting on the first daily run.' },
    anchorAgreement != null
      ? { value: fmtPct(anchorAgreement),
          label: 'And on well-known martech tools',
          note: 'The same test, on a fixed list of big vendors that never changes.' }
      : { value: '--', label: 'And on well-known martech tools', note: 'Waiting on the first daily run.' },
    // Counts the registry, which is every problem the panel named this month.
    // Only the top one gets a daily vendor question set, so 'problems we track'
    // overstated this by the size of the board.
    { value: String(registry.problems.length),
      label: 'Problems the models call unsolved',
      note: 'Named this month, then checked by a person. We follow the top one every day.' },
  ];

  const figureRow = figures.map((f) => `<div class="figure">
      <div class="figure__value${f.accent ? ' figure__value--accent' : ''}">${esc(f.value)}</div>
      <div class="figure__label">${esc(f.label)}</div>
      <div class="figure__note">${esc(f.note)}</div>
    </div>`).join('');

  const dailyAnswers = latestDay
    ? Object.values(latestDay.templates).reduce((n, t) => n + (t.totals?.responses ?? 0), 0)
    : 0;
  const heroFoot = days.length
    ? `We collect ${dailyAnswers} answers a day. ${days.length} ${days.length === 1 ? 'day' : 'days'} so far, starting ${days[0].date}.`
    : 'The first day of answers lands with the next run.';

  // Every model answers twice (once from memory, once after searching) and
  // rates its own confidence high/medium/low, worth 3/2/1. So the ceiling is
  // passes x 3. Showing it turns a bare 14 into 14 of 18.
  const proposalPasses = latestMonth
    ? new Set((latestMonth.proposals ?? []).map((x) => `${x.provider}|${x.pass}`)).size
    : 0;
  const scoreMax = proposalPasses > 0 ? proposalPasses * 3 : null;

  const boardRows = (latestMonth?.board ?? [])
    .slice(0, 8)
    .map((b) => ({ name: b.canonical_name, value: b.score, providers: b.providers }));

  const problemCharts = activeProblems
    .map((template) =>
      lineChart({
        id: `share-${template.id}`,
        title: `${template.label}: share of voice`,
        subtitle: `Mention share across Claude, ChatGPT and Gemini for the ${template.label} question set. The shaded band is the spread across independent samples.`,
        series: shareSeries(days, template.id),
      }),
    )
    .join('');

  const faqHtml = `<dl class="faq">${faq
    .map((item) => `<dt>${esc(item.q)}</dt><dd>${esc(item.a)}</dd>`)
    .join('')}</dl>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE)} — bartontech.ai</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE}/">
<link rel="icon" href="${FAVICON}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#0b0b0b">
<meta name="author" content="Warren Barton">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="bartontech.ai">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
<link rel="alternate" type="application/json" href="${SITE}/data/latest.json" title="Latest snapshot">
<script type="application/ld+json">${structuredData({
    lastmod,
    days: days.length,
    months: months.length,
    faq,
    topProblem,
  })}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="hero">
  <div class="wrap">
    <div class="hero__bar">
      <div class="hero__mark"><b>bartontech</b>.ai</div>
      <div class="hero__updated">Updated every day</div>
    </div>
    <p class="hero__eyebrow">Martech problem index${latestMonth ? ` &middot; ${esc(latestMonth.month)}` : ''}</p>
    <h1>${heroHeadline}</h1>
    <p class="hero__deck">${esc(heroDeck)}</p>
    <div class="figure-row">${figureRow}</div>
    <p class="hero__foot">${esc(heroFoot)}</p>
  </div>
</header>

<main id="main">
<div class="wrap">

<section class="section" aria-labelledby="problems">
  <div class="section__head">
    <div class="section__num">01</div>
    <h2 id="problems">What the industry can't solve</h2>
    <p class="section__note">A monthly panel across three models, reconciled against a canonical registry so one problem under three names does not become three entries. Rank is the panel's consensus ordering; the score is confidence-weighted across every model that named it, so the two can disagree.</p>
  </div>
  ${rankedBoard({
    rows: boardRows,
    scoreMax,
    title: latestMonth ? `Current board \u2014 ${latestMonth.month}` : 'Current board',
    subtitle: scoreMax
      ? `Rank is what the models agreed on together. The score is separate: each model rates how sure it is, worth 3 for high, 2 for medium, 1 for low. We ask three models twice each, so ${scoreMax} is the most any problem can get. Rank and score can disagree.`
      : 'Rank is what the models agreed on together. The score adds up how sure each model was.',
  })}
  ${
    // The board answers "what is the standing now", the trend answers "how did
    // it get there". Both are shown once there is more than one month, because
    // a league table and its movement are different questions.
    months.length >= 2
      ? lineChart({
          id: 'problem-index',
          title: 'How the board has moved',
          subtitle:
            'Panel score by month. A rising line means more models, with higher confidence, named that problem. Lines start when a problem first enters the registry.',
          series: indexSeries(months),
          yFormat: (n) => n.toFixed(0),
        })
      : ''
  }
</section>

<section class="section" aria-labelledby="vendors">
  <div class="section__head">
    <div class="section__num">02</div>
    <h2 id="vendors">Who the models name</h2>
    <p class="section__note">The anchor question set never changes, which is what lets this series accumulate across years. Problem-specific sets rotate as the board moves; retired ones keep running in the background.</p>
  </div>
  ${lineChart({
    id: 'share-anchor',
    title: 'Anchor: vendor share of voice',
    subtitle: `Mention share across ${anchor.questions.length} fixed questions, sampled three times per model per day. The shaded band is the spread across samples: a single sample reported to two decimals would not be credible.`,
    series: shareSeries(days, 'anchor'),
  })}
  ${problemCharts}
  ${lineChart({
    id: 'agreement',
    title: 'Cross-model agreement over time',
    subtitle: 'How often two models independently name the same leading vendor. Low agreement means the answer a buyer gets depends on which assistant they opened.',
    series: [
      {
        name: 'Agreement',
        points: days
          .filter((d) => d.templates?.anchor?.agreement != null)
          .map((d) => ({ x: d.date, y: d.templates.anchor.agreement })),
      },
    ],
    yMax: 1,
  })}
</section>

<section class="section" aria-labelledby="method">
  <div class="section__head">
    <div class="section__num">03</div>
    <h2 id="method">How it is measured</h2>
  </div>
<div class="prose">
  <p>Each question is put to Claude, ChatGPT and Gemini three times per model per day. Language models do not return identical answers to identical prompts, so every reported share carries the spread across those samples rather than a single figure dressed up with decimal places.</p>
  <p>Two passes run separately and are never merged. In the ungrounded pass the model answers from its training data, which reflects the web as of its cutoff and can lag current reality by months. In the web-grounded pass the model searches first. The gap between the two is treated as a measurement in its own right.</p>
  <p>Every stored run records its prompt version and the exact model identifiers that produced it. When a model version ships, the numbers step-change; the charts are annotated at that point rather than smoothed across it. Raw model responses are kept alongside the parsed extraction, so an improved parser can re-derive history instead of discarding it. Stored runs are never edited.</p>
  <p>Monthly proposals are reconciled against a canonical registry before they are counted. Without that step, "answer engine optimization", "GEO" and "LLM brand visibility" become three registry entries and the time series fragments into pieces too short to chart. A proposal that no existing entry covers is queued for human review rather than added automatically.</p>

  <h3 id="data">Data</h3>
  <p>Every run is plain JSON, append-only, and served without authentication: <a href="${SITE}/data/latest.json"><code>/data/latest.json</code></a> for the current snapshot, <a href="${SITE}/data/registry/problems.json"><code>/data/registry/problems.json</code></a> for the canonical registry, <code>/data/tracker/YYYY-MM-DD.json</code> for each tracked day, and <code>/data/index/YYYY-MM.json</code> for each monthly run including every model's raw proposals and the reconciliation decisions.</p>
</div>

</section>

<section class="section" aria-labelledby="faq">
  <div class="section__head">
    <div class="section__num">04</div>
    <h2 id="faq">Questions</h2>
  </div>
  ${faqHtml}
</section>

</div>

</main>

<footer>
  <div class="wrap">
  <p>Built from an open harness. Reproducibility is the point: prompt versions, model identifiers and raw responses are all stored with the numbers they produced.</p>
  <p>Last built <time datetime="${now.toISOString()}">${esc(lastmod)}</time>. Warren Barton, independent consultant. <a href="mailto:warren@bartontech.ai">warren@bartontech.ai</a></p>
  </div>
</footer>
</div>
<script>
(() => {
  for (const plot of document.querySelectorAll('.chart__plot[data-chart]')) {
    const spec = JSON.parse(plot.dataset.chart);
    const svg = plot.querySelector('svg');
    const tip = plot.querySelector('.tooltip');
    const cross = svg.querySelector('.crosshair');
    const { left, width } = spec.geom;
    const n = spec.xs.length;

    const show = (i) => {
      const x = n > 1 ? left + (i / (n - 1)) * width : left;
      cross.setAttribute('x1', x);
      cross.setAttribute('x2', x);
      cross.style.opacity = '1';
      tip.innerHTML = '<b>' + spec.xs[i] + '</b>' + spec.series
        .map((s, k) => {
          const p = s.points.find((q) => q.x === spec.xs[i]);
          return p ? '<div><span>' + s.name + '</span><em style="color:var(--series-' + ((k % 6) + 1) + ')">' + p.y + '</em></div>' : '';
        })
        .join('');
      tip.hidden = false;
      const box = svg.getBoundingClientRect();
      const px = (x / svg.viewBox.baseVal.width) * box.width;
      tip.style.left = Math.min(Math.max(px - tip.offsetWidth / 2, 4), box.width - tip.offsetWidth - 4) + 'px';
      tip.style.top = '8px';
    };
    const hide = () => { tip.hidden = true; cross.style.opacity = '0'; };

    svg.addEventListener('pointermove', (event) => {
      const box = svg.getBoundingClientRect();
      const vx = ((event.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
      const t = n > 1 ? (vx - left) / width : 0;
      show(Math.max(0, Math.min(n - 1, Math.round(t * (n - 1)))));
    });
    svg.addEventListener('pointerleave', hide);

    // Keyboard parity: the plot is focusable, so arrow keys walk the series.
    let cursor = n - 1;
    plot.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') cursor = Math.min(n - 1, cursor + 1);
      else if (event.key === 'ArrowLeft') cursor = Math.max(0, cursor - 1);
      else if (event.key === 'Escape') { hide(); return; }
      else return;
      event.preventDefault();
      show(cursor);
    });
    plot.addEventListener('blur', hide);
  }
})();
</script>
</body>
</html>`;

  // Clear dist/ first. cpSync copies over the top of what is already there
  // and never removes, so a locally-deleted day would keep being served from a
  // stale copy. CI clones fresh and never saw this; a local deploy would have.
  fs.rmSync(paths.dist(), { recursive: true, force: true });
  fs.mkdirSync(paths.dist(), { recursive: true });
  fs.writeFileSync(paths.dist('index.html'), html);
  fs.cpSync(paths.data(), paths.dist('data'), { recursive: true });

  fs.writeFileSync(
    paths.dist('data/latest.json'),
    `${JSON.stringify(latestSnapshot(days, months, registry), null, 2)}\n`,
  );
  fs.writeFileSync(paths.dist('robots.txt'), ROBOTS);
  fs.writeFileSync(paths.dist('sitemap.xml'), sitemap({ lastmod }));
  fs.writeFileSync(
    paths.dist('llms.txt'),
    llmsTxt({
      latestMonth: latestMonth?.month ?? null,
      latestDay: latestDay?.date ?? null,
      topProblem,
      days: days.length,
      months: months.length,
    }),
  );

  log(`built dist/ (${days.length} days, ${months.length} months)`);
}

build();
