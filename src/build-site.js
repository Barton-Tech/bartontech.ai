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
import { lineChart, barChart, statTile, esc, fmtPct } from './lib/charts.js';
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

  const tiles = [
    statTile({
      label: 'Hottest unsolved problem',
      value: topProblem ?? 'Pending first index',
      note: latestMonth
        ? `Panel consensus, ${latestMonth.month}`
        : 'Runs on the 1st of each month',
    }),
    statTile({
      label: 'Days tracked',
      value: String(days.length),
      note: days.length ? `Since ${days[0].date}` : 'Starts with the first daily run',
    }),
    statTile({
      label: 'Problems in registry',
      value: String(registry.problems.length),
      note: registry.pending_review.length
        ? `${registry.pending_review.length} awaiting review`
        : 'No entries pending review',
    }),
    statTile({
      label: 'Cross-model agreement',
      value:
        latestDay?.templates?.anchor?.agreement != null
          ? fmtPct(latestDay.templates.anchor.agreement)
          : 'Pending',
      note: 'How often the three models name the same leading vendor',
    }),
  ].join('');

  const boardRows = (latestMonth?.board ?? [])
    .slice(0, 8)
    .map((b) => ({ name: b.canonical_name, value: b.score }));

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
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#fcfcfb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1a19" media="(prefers-color-scheme: dark)">
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
<div class="wrap">
<header>
  <div>
    <h1>${esc(TITLE)}</h1>
    <p class="tagline">Every month, three frontier models are asked what the martech industry's hardest unsolved problem is. Every day, they are asked who leads in it. Both answers are recorded, and neither can be backfilled.</p>
  </div>
  <button class="theme-toggle" type="button" data-toggle-theme aria-pressed="false">
    <span class="visually-hidden">Switch to </span>Dark theme
  </button>
</header>

<main id="main">

<h2 id="current">Where things stand</h2>
<p class="section-note">A snapshot of the most recent daily and monthly runs.</p>
<div class="stats">${tiles}</div>

<h2 id="problems">What the industry can't solve</h2>
<p class="section-note">A monthly panel across three models, reconciled against a canonical registry so the same problem under a different name does not fragment the series. New entries queue for human review before they enter the registry.</p>
${
  months.length >= 2
    ? lineChart({
        id: 'problem-index',
        title: 'Problem Index over time',
        subtitle:
          'Panel score by month. A rising line means more models, with higher confidence, named that problem.',
        series: indexSeries(months),
        yFormat: (n) => n.toFixed(0),
      })
    : barChart({
        id: 'problem-board',
        title: `Current board${latestMonth ? ` — ${latestMonth.month}` : ''}`,
        subtitle:
          'Panel score: confidence-weighted across every model that named the problem. The time series replaces this chart once a second month lands.',
        rows: boardRows,
        format: (n) => n.toFixed(0),
        emptyNote: 'Collecting. The first board appears after the monthly index run.',
      })
}

<h2 id="vendors">Who the models name</h2>
<p class="section-note">The anchor question set never changes, which is what lets this series accumulate across years. Problem-specific sets rotate as the board moves; retired ones keep running in the background.</p>
${lineChart({
  id: 'share-anchor',
  title: 'Anchor: vendor share of voice',
  subtitle: `Mention share across ${anchor.questions.length} fixed questions, sampled three times per model per day. The shaded band is the spread across samples: a single sample reported to two decimals would not be credible.`,
  series: shareSeries(days, 'anchor'),
})}
${problemCharts}
${lineChart({
  id: 'agreement',
  title: 'Cross-model agreement',
  subtitle:
    'How often two models independently name the same leading vendor. Low agreement means the answer a buyer gets depends on which assistant they opened.',
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

<h2 id="method">Method</h2>
<div class="prose">
  <p>Each question is put to Claude, ChatGPT and Gemini three times per model per day. Language models do not return identical answers to identical prompts, so every reported share carries the spread across those samples rather than a single figure dressed up with decimal places.</p>
  <p>Two passes run separately and are never merged. In the ungrounded pass the model answers from its training data, which reflects the web as of its cutoff and can lag current reality by months. In the web-grounded pass the model searches first. The gap between the two is treated as a measurement in its own right.</p>
  <p>Every stored run records its prompt version and the exact model identifiers that produced it. When a model version ships, the numbers step-change; the charts are annotated at that point rather than smoothed across it. Raw model responses are kept alongside the parsed extraction, so an improved parser can re-derive history instead of discarding it. Stored runs are never edited.</p>
  <p>Monthly proposals are reconciled against a canonical registry before they are counted. Without that step, "answer engine optimization", "GEO" and "LLM brand visibility" become three registry entries and the time series fragments into pieces too short to chart. A proposal that no existing entry covers is queued for human review rather than added automatically.</p>

  <h3 id="data">Data</h3>
  <p>Every run is plain JSON, append-only, and served without authentication: <a href="${SITE}/data/latest.json"><code>/data/latest.json</code></a> for the current snapshot, <a href="${SITE}/data/registry/problems.json"><code>/data/registry/problems.json</code></a> for the canonical registry, <code>/data/tracker/YYYY-MM-DD.json</code> for each tracked day, and <code>/data/index/YYYY-MM.json</code> for each monthly run including every model's raw proposals and the reconciliation decisions.</p>
</div>

<h2 id="faq">Questions</h2>
${faqHtml}

</main>

<footer>
  <p>Built from an open harness. Reproducibility is the point: prompt versions, model identifiers and raw responses are all stored with the numbers they produced.</p>
  <p>Last built <time datetime="${now.toISOString()}">${esc(lastmod)}</time>. Warren Barton, independent consultant. <a href="mailto:warren@bartontech.ai">warren@bartontech.ai</a></p>
</footer>
</div>
<script>
(() => {
  const root = document.documentElement;
  const btn = document.querySelector('[data-toggle-theme]');
  const sync = () => {
    const dark = getComputedStyle(root).colorScheme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.innerHTML = '<span class="visually-hidden">Switch to </span>' + (dark ? 'Light theme' : 'Dark theme');
  };
  const saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
  if (btn) {
    sync();
    btn.addEventListener('click', () => {
      root.dataset.theme = getComputedStyle(root).colorScheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', root.dataset.theme);
      sync();
    });
  }

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
