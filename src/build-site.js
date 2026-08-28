#!/usr/bin/env node
// Renders dist/ from whatever is in data/. Runs with zero data and produces a
// live page with empty frames, so the record starts accumulating in public
// from day one.
//
// The page is fully server-rendered and ships no JavaScript at all: a site
// that measures AI-answer legibility has to be legible to the crawlers that
// build those answers, and nothing on the page needs a script.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, paths, readJSON, listJSON, log } from './lib/io.js';
import { rankedBoard, esc } from './lib/charts.js';

import {
  FAVICON,
  PAGE_CSS,
  noEmDash,
  normalizeSolution,
  recognitionCards,
  renderAnswers,
  siteNav,
  siteFooter,
  subShell,
  breadcrumbLd,
  questionLd,
  problemLd,
} from './lib/render.js';
import { swimlaneSvg, stackSvg } from './lib/diagram.js';
import { projectCost, measuredAverages, spendByMonth, usd } from './lib/cost.js';
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


function loadMonths() {
  return listJSON(paths.data('index')).map((f) => readJSON(paths.data('index', f)));
}

// Only date-shaped filenames. A YYYY-MM file sorts AFTER YYYY-MM-DD lexically
// ('-' < '.'), so a stray month-shaped artifact would be picked as the newest.
function loadThemes() {
  return listJSON(paths.data('themes'))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => readJSON(paths.data('themes', f)));
}

function loadSolutions() {
  return listJSON(paths.data('solutions'))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => readJSON(paths.data('solutions', f)));
}

// Month-shaped filenames only, so the archive/ subdirectory of forced reruns
// never leaks into the log.
// Practical code metrics for the method page, computed from the source tree
// at build time so the page cannot claim numbers the repo no longer has.
function codeMetrics() {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
  const read = (f) => fs.readFileSync(f, 'utf8');
  const srcFiles = walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
  const srcLines = srcFiles.reduce((n, f) => n + read(f).split('\n').filter((l) => l.trim()).length, 0);
  const testFiles = walk(path.join(ROOT, 'test')).filter((f) => f.endsWith('.test.js'));
  // The count comes from actually running the suite, not from grepping call
  // sites (loops generate tests a grep cannot see). A red suite refuses to
  // build: the page must never publish a test count that is not passing.
  const tap = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', '--experimental-test-coverage',
      '--test-coverage-include=src/lib/**',
      '--test-coverage-exclude=src/lib/providers/**',
      '--test-coverage-exclude=src/lib/aggregate.js'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const pass = Number(tap.stdout.match(/^# pass (\d+)$/m)?.[1] ?? 0);
  const fail = Number(tap.stdout.match(/^# fail (\d+)$/m)?.[1] ?? 1);
  if (!pass || fail > 0) {
    throw new Error(`test suite not green (pass ${pass}, fail ${fail}); refusing to publish metrics`);
  }
  const testCount = pass;
  const lineCoverage = tap.stdout.match(/^# all files[^|]*\|\s*([\d.]+)/m)?.[1] ?? null;
  // Lint runs against eslint:recommended when the dev dependency is present
  // (it is in CI and local builds; a production-only install skips the card
  // rather than failing the build). Errors refuse to publish, same as tests.
  let lintErrors = null;
  const eslintBin = path.join(ROOT, 'node_modules/.bin/eslint');
  if (fs.existsSync(eslintBin)) {
    const lint = spawnSync(eslintBin, ['.', '--format', 'json'], { cwd: ROOT, encoding: 'utf8' });
    try {
      lintErrors = JSON.parse(lint.stdout).reduce((n, f) => n + f.errorCount, 0);
    } catch {
      lintErrors = null;
    }
    if (lintErrors > 0) throw new Error(`${lintErrors} lint errors; refusing to publish metrics`);
  }
  const schemaCount = (read(path.join(ROOT, 'src/lib/schemas.js')).match(/^export const /gm) ?? []).length;
  const workflowCount = fs.readdirSync(path.join(ROOT, '.github/workflows')).filter((f) => f.endsWith('.yml')).length;
  const deps = Object.keys(readJSON(path.join(ROOT, 'package.json')).dependencies ?? {}).length;
  const maxRun = readJSON(paths.config('models.json')).budget.max_run_usd;
  return { srcFiles: srcFiles.length, srcLines, testFiles: testFiles.length, testCount, lineCoverage, lintErrors, schemaCount, workflowCount, deps, maxRun };
}

function loadRecognition() {
  return listJSON(paths.data('recognition'))
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => readJSON(paths.data('recognition', f)));
}

function latestSnapshot({ months, solutions, registry, latestMonth, solution, themesToday, latestRec }) {
  return {
    generated_at: new Date().toISOString(),
    site: SITE,
    months_indexed: months.length,
    solution_days: solutions.length,
    hottest_unsolved_problem: latestMonth?.board?.[0]
      ? {
          canonical_id: latestMonth.board[0].canonical_id,
          canonical_name: latestMonth.board[0].canonical_name,
          panel_score: latestMonth.board[0].score,
          month: latestMonth.month,
        }
      : null,
    board: latestMonth?.board ?? [],
    latest_answers: solution
      ? (() => {
          const norm = normalizeSolution(solution);
          return {
            date: norm.date,
            problem: norm.problem.canonical_name,
            formats: norm.formats.map((f) => f.format.label),
            default_format: norm.defaultId,
            models: [...new Set(norm.formats.flatMap((f) => f.answers.map((a) => a.model)))],
          };
        })()
      : null,
    themes: themesToday
      ? { date: themesToday.date, names: themesToday.themes.map((t) => t.name) }
      : null,
    recognition: latestRec
      ? {
          month: latestRec.month,
          results: latestRec.results.map((r) => ({ label: r.label, familiar: r.familiar, basis: r.basis })),
        }
      : null,
    registry: {
      problems: registry.problems.map((p) => ({ id: p.id, name: p.canonical_name })),
      pending_review: registry.pending_review.length,
    },
  };
}

function build() {
  const months = loadMonths();
  const solutions = loadSolutions();
  const themeDays = loadThemes();
  const themesToday = themeDays[themeDays.length - 1] ?? null;
  const recognitions = loadRecognition();
  const latestRec = recognitions[recognitions.length - 1] ?? null;
  const registry = readJSON(paths.registry());

  const latestMonth = months[months.length - 1] ?? null;
  const solution = solutions[solutions.length - 1] ?? null;
  const topBoard = latestMonth?.board?.[0] ?? null;
  const topEntry = topBoard
    ? registry.problems.find((x) => x.id === topBoard.canonical_id)
    : null;
  const topProblem = topBoard?.canonical_name ?? null;
  const topPlain = topEntry?.plain || topProblem;

  const now = new Date();
  const lastmod = now.toISOString().slice(0, 10);
  const faq = faqItems({ topProblem, topPlain });

  // The hero features the same problem the day's answers are about. Nine
  // problems cannot all be "the most challenging", so the claim is "one of the
  // most challenging", which is true whichever one the rotation lands on.
  const featured = solution
    ? {
        entry: registry.problems.find((x) => x.id === solution.problem.canonical_id) ?? null,
        name: solution.problem.canonical_name,
        plain: solution.problem.plain || solution.problem.canonical_name,
      }
    : topBoard
      ? { rank: 1, entry: topEntry, name: topProblem, plain: topPlain }
      : null;

  // "One of the most challenging" is true whichever problem the rotation lands
  // on, including rank 1, so the sentence shape stays constant day to day and
  // only the problem changes.
  // Problem first, claim second. Every gloss is a gerund phrase, so it works
  // as the sentence subject; the leading letter gets capitalized here.
  const lead = featured ? featured.plain.charAt(0).toUpperCase() + featured.plain.slice(1) : '';
  const heroHeadline = featured
    ? `<em>${esc(lead)}</em> is one of the most challenging problems in martech right now.`
    : 'Three AI models, asked each month what martech cannot solve.';
  const heroDeck =
    featured?.entry?.plain_summary ||
    featured?.entry?.definition ||
    'Every month, ChatGPT, Claude and Gemini name the hardest unsolved problems in marketing technology. Every day, they explain how they would attack one.';
  // "The industry calls this X" broke the deck's voice and was only sometimes
  // true: the canonical names are the board's titles, and for AEO the term
  // names the practice of fixing the problem, not the problem itself. Board
  // attribution is accurate every day and the contraction keeps the register.
  // The board title set in italics rather than straight quotes, and a shade
  // brighter than the muted sentence around it so the name reads as a title.
  const heroTerm =
    featured && featured.plain !== featured.name
      ? `LLMs call that <i class="hero__term-name">${esc(featured.name)}</i>.`
      : '';
  const heroFoot = solutions.length
    ? `One problem with three answers, every day. ${solutions.length} ${solutions.length === 1 ? 'day' : 'days'} so far.`
    : 'The first answers land with the next daily run.';

  const answersHtml =
    renderAnswers(solution, { linkDate: true }) +
    (solution
      ? `<p class="archive-link">Every day is archived: <a href="/archive/">browse all days and all problems</a>.</p>`
      : '');

  const boardRows = (latestMonth?.board ?? [])
    .slice(0, 10)
    .map((b) => ({
      name: b.canonical_name,
      value: b.score,
      providers: b.providers,
      href: `/problems/${b.canonical_id}/`,
    }));
  const topScore = boardRows.length ? Math.max(...boardRows.map((r) => r.value)) : null;

  const themesHtml = themesToday
    ? `<p class="solutions__meta">As of ${esc(themesToday.date)}, from ${themesToday.based_on.boards.length} monthly ${themesToday.based_on.boards.length === 1 ? 'board' : 'boards'} and ${themesToday.based_on.solution_days} ${themesToday.based_on.solution_days === 1 ? 'day' : 'days'} of answers.</p>
       <ol class="themes">${themesToday.themes
         .map(
           (t) => `<li class="theme">
           <div class="theme__head">
             <span class="theme__name">${esc(t.name)}</span>
             <span class="theme__trend theme__trend--${esc(t.trend)}">${esc(t.trend)}</span>
           </div>
           <p class="theme__plain">${esc(noEmDash(t.plain))}</p>
           <p class="theme__evidence">${esc(noEmDash(t.evidence))}</p>
         </li>`,
         )
         .join('')}</ol>`
    : '<div class="empty">Collecting. The first themes land with the next daily run.</div>';

  const recognitionHtml = latestRec
    ? `<p class="solutions__meta">Checked ${esc(latestRec.month)}. The question, verbatim: what is bartontech.ai?</p>
       ${recognitionCards(latestRec)}
       <p class="archive-link">Every month is kept: <a href="/recognition/">browse the recognition log</a>.</p>`
    : '<div class="empty">The first check runs with the next monthly index.</div>';

  const faqHtml = `<dl class="faq">${faq
    .map((item) => `<dt>${esc(item.q)}</dt><dd>${esc(item.a)}</dd>`)
    .join('')}</dl>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE)} · bartontech.ai</title>
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
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="The Martech problem index: one unsolved problem, three AI answers, every day.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="twitter:image:alt" content="The Martech problem index: one unsolved problem, three AI answers, every day.">
<link rel="alternate" type="application/json" href="${SITE}/data/latest.json" title="Latest snapshot">
<link rel="alternate" type="application/atom+xml" href="${SITE}/feed.xml" title="The Martech problem index, daily">
<script type="application/ld+json">${structuredData({
    lastmod,
    faq,
    topProblem,
    board: latestMonth?.board ?? [],
  })}</script>
<style>${PAGE_CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="hero">
  <div class="wrap">
    <div class="hero__bar">
      <div class="hero__mark"><b>bartontech</b>.ai</div>
      ${siteNav('/')}
    </div>
    <p class="hero__eyebrow">The Martech problem index${latestMonth ? ` &middot; ${esc(latestMonth.month)}` : ''} &middot; <time datetime="${now.toISOString()}">updated ${esc(lastmod)}</time></p>
    <h1>${heroHeadline}</h1>
    <p class="hero__deck">${esc(heroDeck)}${heroTerm ? ` <span class="hero__term">${heroTerm}</span>` : ''}</p>
    <p class="hero__foot">${esc(heroFoot)}</p>
  </div>
</header>

<main id="main">

<section class="section" aria-labelledby="solutions">
  <div class="wrap">
  <div class="section__head">
    <div class="section__num">01</div>
    <h2 id="solutions">How would the models attack it?</h2>
    <p class="section__note">We rotate through this month's board, one problem each day. ChatGPT, Claude and Gemini all get the same question (how would you attack this?) and answer it in every format on the list, from a memo to a lullaby. Pick the format you want to read; a different one leads each day. We never ask for a solution: everything here is unsolved, and a model asked to solve it will invent a plan. So any difference between the answers is substance, not style.</p>
  </div>
  ${answersHtml}
  </div>
</section>

<section class="section section--band" aria-labelledby="board">
  <div class="wrap">
  <div class="section__head">
    <div class="section__num">02</div>
    <h2 id="board">What else can't martech solve right now?</h2>
    <p class="section__note">Every problem the models named in ${latestMonth ? esc(latestMonth.month) : 'the current month'}, merged into one board and checked by a person. One of these rotates into the daily question above.</p>
  </div>
  ${rankedBoard({
    rows: boardRows,
    subtitle: topScore
      ? `Rank is what the models agreed on together. The score counts every time a model named the problem, weighted by how sure it said it was. The highest score this month was ${topScore}. Rank and score can disagree.`
      : '',
  })}
  </div>
</section>

<section class="section" aria-labelledby="themes">
  <div class="wrap">
  <div class="section__head">
    <div class="section__num">03</div>
    <h2 id="themes">What themes keep coming up?</h2>
    <p class="section__note">Every day, Claude reads the whole record from the last six months, every board and every answer, and names the patterns that cut across problems. This is one model's synthesis, labeled as such; the board above is what all three produced together.</p>
  </div>
  ${themesHtml}
  </div>
</section>

<section class="section section--band" aria-labelledby="recognition">
  <div class="wrap">
  <div class="section__head">
    <div class="section__num">04</div>
    <h2 id="recognition">Do the models know this site exists?</h2>
    <p class="section__note">Getting named by AI answers is one of the unsolved problems this index tracks, so the site runs that experiment on itself. Once a month, each model gets one neutral question with web search on and no hints: what is bartontech.ai? The answers are logged verbatim, including every "found nothing". A log like this starts out embarrassing on purpose. What it records, per model, is the date "found nothing" turns into a correct answer.</p>
  </div>
  ${recognitionHtml}
  </div>
</section>

<section class="section" aria-labelledby="faq">
  <div class="wrap">
  <div class="section__head">
    <div class="section__num">05</div>
    <h2 id="faq">Questions</h2>
  </div>
  ${faqHtml}
  </div>
</section>

</main>

${siteFooter()}
</body>
</html>`;

  fs.rmSync(paths.dist(), { recursive: true, force: true });
  fs.mkdirSync(paths.dist(), { recursive: true });
  fs.writeFileSync(paths.dist('index.html'), html);
  fs.cpSync(paths.data(), paths.dist('data'), { recursive: true });
  fs.cpSync(new URL('../assets/', import.meta.url).pathname, paths.dist(), { recursive: true });

  fs.writeFileSync(
    paths.dist('data/latest.json'),
    `${JSON.stringify(latestSnapshot({ months, solutions, registry, latestMonth, solution, themesToday, latestRec }), null, 2)}\n`,
  );
  // ---------- archive pages ----------
  // Yesterday's answers used to vanish from the site every morning: preserved
  // in data/, shown nowhere. Each day and each problem now has its own page,
  // which is also where the record's depth becomes visible and citable.
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  // Day descriptions state their own format count; the list can grow.
  const countWord = (n) =>
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
  const writePage = (relPath, html) => {
    const file = paths.dist(...relPath.split('/').filter(Boolean), 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  };
  const subUrls = [];

  for (let i = 0; i < solutions.length; i += 1) {
    const sol = solutions[i];
    const older = solutions[i - 1] ?? null;
    const newer = solutions[i + 1] ?? null;
    const entry = registry.problems.find((x) => x.id === sol.problem.canonical_id) ?? null;
    const plain = sol.problem.plain || sol.problem.canonical_name;
    const pager =
      older || newer
        ? `<nav class="pager" aria-label="Adjacent days">
            <span>${older ? `<a href="/days/${esc(older.date)}/">Previous day: ${esc(older.date)}</a>` : ''}</span>
            <span>${newer ? `<a href="/days/${esc(newer.date)}/">Next day: ${esc(newer.date)}</a>` : ''}</span>
          </nav>`
        : '';
    writePage(
      `/days/${sol.date}/`,
      subShell({
        title: `${cap(plain)}: three AI answers · ${sol.date}`,
        description: `On ${sol.date}, ChatGPT, Claude and Gemini were each asked how they would attack ${plain}, in ${(sol.formats ?? [sol]).length > 1 ? `${countWord((sol.formats ?? []).length)} formats` : `the format: ${(sol.formats?.[0]?.format ?? sol.format).label.toLowerCase()}`}. Their full answers, side by side.`,
        path: `/days/${sol.date}/`,
        eyebrow: `${esc(sol.date)} &middot; <a href="/problems/${esc(sol.problem.canonical_id)}/">${esc(sol.problem.canonical_name)}</a>`,
        heading: `How would you attack <em>${esc(plain)}</em>?`,
        deck: entry?.plain_summary ? esc(entry.plain_summary) : '',
        body: renderAnswers(sol) + pager,
        jsonLd: breadcrumbLd(
          [
            { name: 'The Martech problem index', path: '/' },
            { name: 'Archive', path: '/archive/' },
            { name: sol.date, path: `/days/${sol.date}/` },
          ],
          [questionLd(sol)],
        ),
      }),
    );
    subUrls.push({ loc: `${SITE}/days/${sol.date}/`, changefreq: 'monthly', priority: '0.6', lastmod: sol.date });
  }

  for (const entry of registry.problems) {
    const sols = solutions.filter((x) => x.problem.canonical_id === entry.id);
    const history = months
      .map((m) => {
        const idx = (m.board ?? []).findIndex((b) => b.canonical_id === entry.id);
        return idx === -1
          ? null
          : `<li>${esc(m.month)}: rank ${idx + 1} of ${m.board.length}, score ${m.board[idx].score}</li>`;
      })
      .filter(Boolean)
      .join('');
    const timeline = sols.length
      ? `<ul class="meta-list">${sols
          .map((x) => {
            const norm = normalizeSolution(x);
            const panel = norm.formats.find((f) => f.format.id === norm.defaultId) ?? norm.formats[0];
            const firsts = [...panel.answers]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((a) => `<strong>${esc(a.label)}:</strong> ${esc(a.first_move)}`)
              .join(' ');
            return `<li>
              <div class="meta-list__top">
                <a class="meta-list__title" href="/days/${esc(x.date)}/">${esc(x.date)}</a>
                <span class="meta-list__note">${norm.formats.length > 1 ? `${norm.formats.length} formats` : `format: ${esc(panel.format.label.toLowerCase())}`}</span>
              </div>
              <p class="meta-list__body">${firsts}</p>
            </li>`;
          })
          .join('')}</ul>`
      : `<div class="empty">No daily answers yet. This problem's turn comes around in the rotation.</div>`;
    writePage(
      `/problems/${entry.id}/`,
      subShell({
        title: `${entry.canonical_name} · The Martech problem index`,
        description:
          entry.plain_summary ||
          noEmDash(entry.definition) ||
          `${entry.canonical_name}, one of the unsolved problems tracked by the Martech problem index.`,
        path: `/problems/${entry.id}/`,
        eyebrow: `Unsolved problem &middot; first seen ${esc(entry.first_seen ?? '')}`,
        heading: esc(entry.canonical_name),
        deck: esc(entry.plain_summary || noEmDash(entry.definition) || ''),
        body: `
          ${entry.why_unsolved ? `<h2 class="board__title">What has blocked it</h2><p class="meta-list__body">${esc(noEmDash(entry.why_unsolved))}</p>` : ''}
          <h2 class="board__title">On the board</h2>
          ${history ? `<ul class="meta-list">${history}</ul>` : '<div class="empty">Not on a published board yet.</div>'}
          <h2 class="board__title">The daily answers so far</h2>
          <p class="board__sub">First moves only. Each date links to the full answers.</p>
          ${timeline}
          ${entry.aliases?.length ? `<p class="aka">Also called: ${entry.aliases.map(esc).join('; ')}.</p>` : ''}
        `,
        jsonLd: breadcrumbLd(
          [
            { name: 'The Martech problem index', path: '/' },
            { name: 'Archive', path: '/archive/' },
            { name: entry.canonical_name, path: `/problems/${entry.id}/` },
          ],
          [problemLd(entry, `/problems/${entry.id}/`)],
        ),
      }),
    );
    const problemLastmod = sols.length
      ? sols[sols.length - 1].date
      : (latestMonth?.generated_at ?? '').slice(0, 10) || lastmod;
    subUrls.push({ loc: `${SITE}/problems/${entry.id}/`, changefreq: 'weekly', priority: '0.8', lastmod: problemLastmod });
  }

  const archiveBody = `
    <h2 class="board__title">Problems</h2>
    <ul class="meta-list">${registry.problems
      .map(
        (e) => `<li>
        <div class="meta-list__top"><a class="meta-list__title" href="/problems/${esc(e.id)}/">${esc(e.canonical_name)}</a></div>
        <p class="meta-list__body">${esc(e.plain_summary || noEmDash(e.definition) || '')}</p>
      </li>`,
      )
      .join('')}</ul>
    <h2 class="board__title">Days</h2>
    ${
      solutions.length
        ? `<ul class="meta-list">${[...solutions]
            .reverse()
            .map(
              (x) => `<li><div class="meta-list__top">
              <a class="meta-list__title" href="/days/${esc(x.date)}/">${esc(x.date)}</a>
              <span class="meta-list__note">${esc(x.problem.plain || x.problem.canonical_name)}</span>
            </div></li>`,
            )
            .join('')}</ul>`
        : '<div class="empty">The first day lands with the next daily run.</div>'
    }`;
  writePage(
    '/archive/',
    subShell({
      title: 'Archive · The Martech problem index',
      description:
        'Every day of answers and every unsolved problem tracked by the Martech problem index, each with its own page.',
      path: '/archive/',
      eyebrow: 'The full record',
      heading: 'Every day, every problem',
      deck: 'The record is append-only and cannot be backfilled. Each day links three full answers; each problem collects everything the models have said about it.',
      body: archiveBody,
      jsonLd: breadcrumbLd([
        { name: 'The Martech problem index', path: '/' },
        { name: 'Archive', path: '/archive/' },
      ]),
    }),
  );
  subUrls.push({ loc: `${SITE}/archive/`, changefreq: 'daily', priority: '0.7' });

  // The recognition log, every month on one page, newest first. Each month's
  // cards carry their sources here; the homepage shows only the latest month.
  const recognitionBody = recognitions.length
    ? [...recognitions]
        .reverse()
        .map((r) => `<h2 class="board__title">${esc(r.month)}</h2>${recognitionCards(r, { sources: true })}`)
        .join('')
    : '<div class="empty">The first check runs with the next monthly index.</div>';
  writePage(
    '/recognition/',
    subShell({
      title: 'The recognition log · The Martech problem index',
      description:
        'Once a month, ChatGPT, Claude and Gemini are each asked one neutral question with web search on and no hints: what is bartontech.ai? Their verbatim answers, logged append-only, including the months where the honest answer is "not found".',
      path: '/recognition/',
      eyebrow: 'The site running its own experiment',
      heading: 'Do the models know this site exists?',
      deck: 'Getting named by AI answers is one of the unsolved problems this index tracks. So once a month, each model gets the same neutral question, with web search on and no hints: what is bartontech.ai? The answers below are verbatim and append-only. The log records, per model, the date "found nothing" turns into a correct answer.',
      body: recognitionBody,
      jsonLd: breadcrumbLd([
        { name: 'The Martech problem index', path: '/' },
        { name: 'The recognition log', path: '/recognition/' },
      ]),
    }),
  );
  subUrls.push({
    loc: `${SITE}/recognition/`,
    changefreq: 'monthly',
    priority: '0.6',
    lastmod: latestRec ? (latestRec.generated_at ?? '').slice(0, 10) || lastmod : lastmod,
  });

  // The method page: the whole machine on one swimlane, then each process in
  // prose. The prose repeats the diagram's content deliberately; the SVG has
  // a full text alternative in its desc, and the page works without either.
  const m = codeMetrics();

  // The cost model, projected from today's configured models and prices with
  // the same machinery the spend guard runs before every paid call.
  const modelsCfg = readJSON(paths.config('models.json'));
  const provs = Object.entries(modelsCfg.providers)
    .filter(([, p]) => p.enabled)
    .map(([n]) => n);
  const nFormats = readJSON(paths.config('formats.json')).formats.length;
  const measured = measuredAverages();
  const per = (plan) => projectCost(plan, modelsCfg, measured);
  const costDaily = per(provs.map((p) => ({
    provider: p,
    requests: Array.from({ length: nFormats }, () => ({ tier: 'reasoning', grounded: false })),
  })));
  const costThemes = per([{ provider: 'anthropic', requests: [{ tier: 'reasoning', grounded: false }] }]);
  const costBoard = per([
    ...provs.map((p) => ({ provider: p, requests: [{ tier: 'reasoning', grounded: false }, { tier: 'reasoning', grounded: true }] })),
    { provider: 'anthropic', requests: [{ tier: 'reasoning', grounded: false }] },
  ]);
  const costRec = per(provs.map((p) => ({ provider: p, requests: [{ tier: 'grounded', grounded: true }] })));
  const costExp = per([{ provider: 'anthropic', requests: [{ tier: 'reasoning', grounded: false }] }]);
  const costMonthly =
    (costDaily.total + costThemes.total) * 30 + costBoard.total + costRec.total + costExp.total;
  const costRows = [
    ['Daily answers', `${provs.length * nFormats}`, 'daily', costDaily.total, costDaily.total * 30],
    ['Daily themes', '1', 'daily', costThemes.total, costThemes.total * 30],
    ['Monthly board', '7', 'monthly', costBoard.total, costBoard.total],
    ['Recognition check', `${provs.length}`, 'monthly', costRec.total, costRec.total],
    ['Monthly experiment', '1', 'monthly', costExp.total, costExp.total],
  ];
  const spendRows = spendByMonth(modelsCfg);
  const experiments = listJSON(paths.data('experiments'))
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => readJSON(paths.data('experiments', f)));
  const experimentsHtml = experiments.length
    ? `<ul class="meta-list">${[...experiments]
        .reverse()
        .map((e) => {
          const p = e.proposal;
          return `<li>
            <div class="meta-list__top">
              <span class="meta-list__title">${esc(e.month)}</span>
              <span class="meta-list__note">${p.no_change ? 'no change proposed' : `${esc(p.change.surface)} change proposed`} &middot; prior: ${esc(p.prior_result.verdict.replace('_', ' '))}</span>
            </div>
            <p class="meta-list__body"><strong>Hypothesis:</strong> ${esc(p.hypothesis)}</p>
            ${p.no_change ? '' : `<p class="meta-list__body"><strong>Change:</strong> ${esc(p.change.proposed_text)}</p>`}
            <p class="meta-list__body"><strong>Expected signal:</strong> ${esc(p.expected_signal)}</p>
          </li>`;
        })
        .join('')}</ul>`
    : '<div class="empty">The first proposal lands with the next monthly run.</div>';

  const howBody = `
    <figure class="diagram">
      ${swimlaneSvg()}
      <figcaption>The four scheduled processes. Follow the numbered steps within each column; the blue boxes are the points where a person decides. Every column ends in the same place: a commit to the append-only record, which redeploys the site.</figcaption>
    </figure>
    <h2 class="board__title">The monthly board</h2>
    <div class="prose">
      <p>On the first of each month, ChatGPT, Claude and Gemini are each asked the same question twice, once from their own knowledge and once with web search on: what are the hardest unsolved problems in marketing technology? Claude then acts as editor, reconciling every proposal against a canonical registry, because models name the same problem differently and "AEO", "GEO" and "LLM visibility" must stay one entry rather than three.</p>
      <p>Anything the registry has never seen queues for human review before it counts. A new problem is a claim that the industry's attention moved somewhere new, and that claim gets a person's sign-off. The result is one ranked board per month.</p>
      <p>The reconciliation also compounds. When a proposal matches an existing problem under a new name, that name queues as a proposed alias for the same review, so each month's editorial decisions sharpen the next month's matching instead of being made twice.</p>
    </div>
    <h2 class="board__title">The daily answers</h2>
    <div class="prose">
      <p>Every day at 06:37 UTC, the date deterministically picks one problem off the board, and all three models answer the same question about it: how would you attack this? Never "solve this". Everything on the board is there because it is unsolved, and a model asked to solve it invents a confident plan. Each model answers in every format on the list, from a memo to a lullaby. The page opens on one format chosen by a date seed and the reader switches to the rest. Within any panel all three models share the format, so differences between their answers are substance, not style.</p>
      <p>After the answers land, Claude rereads the whole six-month record and refreshes a small set of cross-cutting themes. That layer is a single-model synthesis, and the page labels it that way.</p>
    </div>
    <h2 class="board__title">The recognition check</h2>
    <div class="prose">
      <p>Once a month, in the same run as the board, each model gets one neutral question with web search on and no hints: what is bartontech.ai? The verbatim answers go into an append-only <a href="/recognition/">recognition log</a>. Getting named by AI answers is one of the problems the index tracks, so this is the site running that experiment on itself. The log records the date each model's "found nothing" turns into a correct answer, and it drives the <a href="#learning">experiment loop</a> below.</p>
    </div>
    <h2 class="board__title">The model refresh</h2>
    <div class="prose">
      <p>Every Monday, the pipeline fetches the live model lists from all three providers and asks Claude whether the configured lineup is still the most applicable, with pricing verified by search. Any change ships as a pull request that a person reviews; a retired model raises an urgent issue instead. Models never change silently, because every stored run is priced and stamped with the exact model ids that produced it.</p>
    </div>
    <h2 class="board__title">The guardrails</h2>
    <div class="prose">
      <p>Nothing runs before a spend guard projects what the run is about to cost and refuses to start if it exceeds the ceiling. The record is append-only: no stored run is ever edited, and a forced rerun archives the prior version in public rather than replacing it. Every run records its prompt version and exact model ids, and raw responses are kept, so any number on the site can be traced back to what produced it.</p>
    </div>
    <h2 class="board__title">The cost model</h2>
    <div class="prose">
      <p>Every price the site pays lives in the public config, and the weekly model refresh verifies prices against provider pages before they can change. Before any paid call, the spend guard projects the run's cost from ${measured.size > 0 ? 'measured token averages' : 'configured token estimates'} and refuses to start above ${usd(modelsCfg.budget.max_run_usd)} per run or ${usd(modelsCfg.budget.max_rolling_7d_usd)} over a rolling seven days. The projections below come from the same machinery, at today's configured models and prices; the whole site runs on roughly ${usd(costMonthly)} a month.</p>
    </div>
    <div class="table"><div class="table__scroll"><table>
      <caption class="visually-hidden">Projected cost per scheduled process</caption>
      <thead><tr><th scope="col">Process</th><th scope="col">Model calls per run</th><th scope="col">Cadence</th><th scope="col">Projected per run</th><th scope="col">Per month, about</th></tr></thead>
      <tbody>${costRows
        .map(
          ([name, calls, cadence, run, month]) =>
            `<tr><th scope="row">${name}</th><td>${calls}</td><td>${cadence}</td><td>${usd(run)}</td><td>${usd(month)}</td></tr>`,
        )
        .join('')}
      <tr><th scope="row">Everything</th><td></td><td></td><td></td><td>${usd(costMonthly)}</td></tr></tbody>
    </table></div></div>
    <h2 class="board__title">Recorded spend</h2>
    <div class="prose">
      <p>What the site has actually spent, computed from stored token usage and priced by the exact model that produced each call. Calls whose usage was not stored are counted as unrecorded, never estimated: the runners began persisting usage on 2026-08-20, so the early record is mostly unrecorded, and the share shrinks from here. The retired vendor tracker's calls are priced from its raw responses.</p>
    </div>
    ${
      spendRows.length
        ? `<div class="table"><div class="table__scroll"><table>
      <caption class="visually-hidden">Recorded spend by month</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Priced calls</th><th scope="col">Unrecorded calls</th><th scope="col">Recorded spend</th></tr></thead>
      <tbody>${spendRows
        .map(
          (r) =>
            `<tr><th scope="row">${esc(r.month)}</th><td>${r.priced}</td><td>${r.unrecorded}</td><td>${usd(r.usd)}</td></tr>`,
        )
        .join('')}</tbody>
    </table></div></div>`
        : '<div class="empty">The first recorded calls land with the next run.</div>'
    }
    <h2 class="board__title" id="learning">What learns, and what deliberately doesn't</h2>
    <div class="prose">
      <p>Four feedback loops run with a human gate on each. The spend projections learn from every recorded call, replacing configured estimates with measured token averages. The registry learns names: when reconciliation matches a proposal to an existing problem under a new name, the name queues as an alias, and one review click makes that month's editorial decision permanent. The model lineup adapts weekly against the live provider lists, by pull request. And the recognition log drives an experiment loop: once a month, Claude judges the previous experiment against the newest recognition results, then proposes at most one falsifiable change to a crawler-facing surface, as a review issue a person applies or declines. The proposal, hypothesis and expected signal are logged below before the result exists, so the loop cannot quietly rewrite its own history.</p>
      <p>Just as deliberately, the measurements never learn. The daily rotation, the shared formats, and the question wording are held fixed so the record stays comparable across time; prompt changes are versioned and stamped onto every run rather than adapted silently. Nothing learns from visitor behavior: analytics stay outside the repo, and the pages carry no tracking of their own.</p>
    </div>
    <h2 class="board__title">The experiment log</h2>
    <div class="prose">
      <p>Every monthly proposal, judged in public. Each entry records its hypothesis and expected signal before the outcome exists; the following month's entry judges it as supported, refuted, or inconclusive against the fresh recognition answers.</p>
    </div>
    ${experimentsHtml}
    <h2 class="board__title">The stack</h2>
    <div class="prose">
      <p>GitHub Actions runs the schedules; Cloudflare serves the result. The page is fully server-rendered and ships zero JavaScript (the only script tag is structured data), including the format switcher and the site menu, which are CSS and native HTML only. All data is plain JSON, served without authentication, and the harness that produces it is <a href="https://github.com/Barton-Tech/bartontech.ai">open source</a>.</p>
    </div>
    <figure class="diagram">
      ${stackSvg()}
      <figcaption>The stack, end to end. The model APIs are the only external calls, guarded by a projected-cost check; everything downstream of them is a git commit, a static build and an edge cache.</figcaption>
    </figure>
    <h2 class="board__title">The code</h2>
    <div class="prose">
      <p>Everything above is one public repository: <a href="https://github.com/Barton-Tech/bartontech.ai">github.com/Barton-Tech/bartontech.ai</a>. The code is held to two widely adopted standards, enforced in CI on every push: the eslint:recommended ruleset with zero tolerated errors, and test coverage thresholds requiring 100 percent line and function coverage of the library code (the provider network shims and the paid entry points are exercised by the scheduled runs themselves, which is the honest place to test code whose job is to spend money). The numbers below are computed from the source tree at build time, and the build refuses to publish them if the suite is red or the linter objects, so they cannot drift from the code they describe.</p>
    </div>
    <ul class="metrics">
      <li class="metric"><span class="metric__value">0</span><span class="metric__label">bytes of JavaScript shipped to the browser</span></li>
      <li class="metric"><span class="metric__value">${m.testCount}</span><span class="metric__label">unit tests across ${m.testFiles} files, run in CI on every push</span></li>
      ${m.lineCoverage ? `<li class="metric"><span class="metric__value">${m.lineCoverage}%</span><span class="metric__label">line coverage of the library code, measured at build</span></li>` : ''}
      ${m.lintErrors === 0 ? `<li class="metric"><span class="metric__value">0</span><span class="metric__label">errors against eslint:recommended, checked at build</span></li>` : ''}
      <li class="metric"><span class="metric__value">${m.srcLines.toLocaleString('en-US')}</span><span class="metric__label">lines of source in ${m.srcFiles} JavaScript files</span></li>
      <li class="metric"><span class="metric__value">${m.deps}</span><span class="metric__label">runtime dependencies, one SDK per model provider</span></li>
      <li class="metric"><span class="metric__value">${m.schemaCount}</span><span class="metric__label">JSON schemas constraining every model response</span></li>
      <li class="metric"><span class="metric__value">$${m.maxRun}</span><span class="metric__label">spend ceiling per run, enforced before any call</span></li>
      <li class="metric"><span class="metric__value">${m.workflowCount}</span><span class="metric__label">GitHub Actions workflows, scheduled and reviewed</span></li>
    </ul>`;
  writePage(
    '/how-it-works/',
    subShell({
      title: 'How this site works · The Martech problem index',
      description:
        'How the Martech problem index runs itself: a monthly three-model panel with human review, daily multi-format answers, a monthly recognition check, and a weekly model refresh, all committing to an append-only record.',
      path: '/how-it-works/',
      eyebrow: 'The method',
      heading: 'How this site works',
      deck: 'One page, produced by an unattended pipeline: a three-model panel, one editor model, one human gate, and a record that only grows. Everything below runs on a schedule; nothing is manual except the two review steps.',
      body: howBody,
      jsonLd: breadcrumbLd([
        { name: 'The Martech problem index', path: '/' },
        { name: 'How this site works', path: '/how-it-works/' },
      ]),
    }),
  );
  subUrls.push({ loc: `${SITE}/how-it-works/`, changefreq: 'monthly', priority: '0.7' });

  const feedEntries = [...solutions].reverse().slice(0, 30);
  const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Martech problem index</title>
  <subtitle>One unsolved problem, three AI answers, every day.</subtitle>
  <id>${SITE}/</id>
  <link href="${SITE}/"/>
  <link rel="self" href="${SITE}/feed.xml"/>
  <updated>${feedEntries[0] ? `${feedEntries[0].date}T06:30:00Z` : now.toISOString()}</updated>
  <author><name>Warren Barton</name><email>warren@bartontech.ai</email></author>
${feedEntries
  .map((x) => {
    const plain = x.problem.plain || x.problem.canonical_name;
    return `  <entry>
    <title>${esc(`How would you attack ${plain}?`)}</title>
    <id>${SITE}/days/${x.date}/</id>
    <link href="${SITE}/days/${x.date}/"/>
    <updated>${x.date}T06:30:00Z</updated>
    <summary>${esc(`ChatGPT, Claude and Gemini each answer${x.formats ? ` in ${countWord(x.formats.length)} formats` : ` in the format: ${x.format.label.toLowerCase()}`}. ${x.problem.canonical_name}, from the ${x.board_month} board.`)}</summary>
  </entry>`;
  })
  .join('\n')}
</feed>
`;
  fs.writeFileSync(paths.dist('feed.xml'), atom);

  const llmsArchive = [
    ...registry.problems.map((e) => `- [${e.canonical_name}](${SITE}/problems/${e.id}/): ${e.plain || ''}`),
    ...[...solutions].reverse().slice(0, 7).map((x) => `- [${x.date}](${SITE}/days/${x.date}/): ${x.problem.canonical_name}`),
  ].join('\n');

  fs.writeFileSync(
    paths.dist('404.html'),
    subShell({
      title: 'Page not found · The Martech problem index',
      description: 'That page does not exist. The archive lists every day and every problem.',
      path: '/404',
      eyebrow: '404',
      heading: 'That page does not exist.',
      deck: 'The record is append-only, so pages appear but never move. Whatever you were looking for is either in the archive or not yet written.',
      body: `<p class="archive-link"><a href="/">Back to today</a> or <a href="/archive/">browse the archive</a>.</p>`,
      jsonLd: null,
    }),
  );

  fs.writeFileSync(paths.dist('robots.txt'), ROBOTS);
  fs.writeFileSync(paths.dist('sitemap.xml'), sitemap({ lastmod, extra: subUrls }));
  fs.writeFileSync(
    paths.dist('llms.txt'),
    llmsTxt({
      month: latestMonth?.month ?? null,
      topProblem,
      topPlain: topEntry?.plain ?? null,
      days: solutions.length,
      months: months.length,
      solution,
      archive: llmsArchive,
    }),
  );

  log(`built dist/ (${solutions.length} solution days, ${months.length} months, ${subUrls.length} archive pages)`);
}

build();
