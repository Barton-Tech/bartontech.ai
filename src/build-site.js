#!/usr/bin/env node
// Renders dist/ from whatever is in data/. Runs with zero data and produces a
// live page with empty frames, so the record starts accumulating in public
// from day one.
//
// The page is fully server-rendered and ships no JavaScript at all: a site
// that measures AI-answer legibility has to be legible to the crawlers that
// build those answers, and nothing on the page needs a script.

import fs from 'node:fs';
import { paths, readJSON, listJSON, log } from './lib/io.js';
import { rankedBoard, esc } from './lib/charts.js';
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


const noEmDash = (text) => {
  if (!text || !text.includes('\u2014')) return text ?? '';
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      let first = true;
      return sentence.replace(/\s*\u2014\s*/g, () => {
        const sep = first ? ': ' : ', ';
        first = false;
        return sep;
      });
    })
    .join(' ');
};

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232a78d6'/%3E%3Cpath d='M6 22 L13 14 L19 18 L26 8' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

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

function latestSnapshot({ months, solutions, registry, latestMonth, solution, themesToday }) {
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
      ? {
          date: solution.date,
          problem: solution.problem.canonical_name,
          format: solution.format.label,
          models: solution.answers.map((a) => a.model),
        }
      : null,
    themes: themesToday
      ? { date: themesToday.date, names: themesToday.themes.map((t) => t.name) }
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
  const faq = faqItems({ topProblem, topPlain, days: solutions.length, months: months.length });

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

  // The day's three answers, alphabetical by model name so the order is fixed
  // and carries no implied ranking.
  const verse = solution?.format?.id === 'haiku';
  const answersHtml = solution
    ? `<p class="solutions__meta">
        On ${esc(solution.date)} the question was: how would you attack
        <strong>${esc(solution.problem.plain || solution.problem.canonical_name)}</strong>?
        <span class="solutions__format">Format: ${esc(solution.format.label)}</span>
       </p>
       <ul class="answers">${[...solution.answers]
         .sort((a, b) => a.label.localeCompare(b.label))
         .map(
           (a) => `<li class="answer">
           <div class="answer__who">
             <span class="answer__model">${esc(a.label)}</span>
             <span class="answer__id">${esc(a.model)}</span>
           </div>
           <p class="answer__body${verse ? ' answer__body--verse' : ''}">${esc(a.approach)}</p>
           <dl class="answer__foot">
             <dt>First move</dt><dd>${esc(a.first_move)}</dd>
             <dt>Hardest part</dt><dd>${esc(a.hardest_part)}</dd>
           </dl>
           <p class="answer__conf">Its own confidence: ${esc(a.confidence)}</p>
         </li>`,
         )
         .join('')}</ul>`
    : '<div class="empty">Collecting. The first answers land with the next daily run.</div>';

  const boardRows = (latestMonth?.board ?? [])
    .slice(0, 10)
    .map((b) => ({ name: b.canonical_name, value: b.score, providers: b.providers }));
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
<script type="application/ld+json">${structuredData({
    lastmod,
    days: solutions.length,
    months: months.length,
    faq,
    topProblem,
    board: latestMonth?.board ?? [],
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
    <p class="hero__eyebrow">The Martech problem index${latestMonth ? ` &middot; ${esc(latestMonth.month)}` : ''} &middot; <time datetime="${now.toISOString()}">updated ${esc(lastmod)}</time></p>
    <h1>${heroHeadline}</h1>
    <p class="hero__deck">${esc(heroDeck)}${heroTerm ? ` <span class="hero__term">${heroTerm}</span>` : ''}</p>
    <p class="hero__foot">${esc(heroFoot)}</p>
  </div>
</header>

<main id="main">
<div class="wrap">

<section class="section" aria-labelledby="solutions">
  <div class="section__head">
    <div class="section__num">01</div>
    <h2 id="solutions">How would the models attack it?</h2>
    <p class="section__note">We rotate through this month's board, one problem each day. ChatGPT, Claude and Gemini all get the same question (how would you attack this?) and answer in the same format, which changes monthly. We never ask for a solution: everything here is unsolved, and a model asked to solve it will invent a plan. So any difference between the answers is substance, not style.</p>
  </div>
  ${answersHtml}
</section>

<section class="section" aria-labelledby="board">
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
</section>

<section class="section" aria-labelledby="themes">
  <div class="section__head">
    <div class="section__num">03</div>
    <h2 id="themes">What themes keep coming up?</h2>
    <p class="section__note">Every day, Claude reads the whole record from the last six months, every board and every answer, and names the patterns that cut across problems. This is one model's synthesis, labeled as such; the board above is what all three produced together.</p>
  </div>
  ${themesHtml}
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
  <p>Built from an open harness. Reproducibility is the point: prompt versions, model identifiers and raw responses are all stored with the answers they produced. The data is append-only and <a href="${SITE}/data/latest.json">machine-readable</a>.</p>
  </div>
</footer>
</body>
</html>`;

  fs.rmSync(paths.dist(), { recursive: true, force: true });
  fs.mkdirSync(paths.dist(), { recursive: true });
  fs.writeFileSync(paths.dist('index.html'), html);
  fs.cpSync(paths.data(), paths.dist('data'), { recursive: true });
  fs.cpSync(new URL('../assets/', import.meta.url).pathname, paths.dist(), { recursive: true });

  fs.writeFileSync(
    paths.dist('data/latest.json'),
    `${JSON.stringify(latestSnapshot({ months, solutions, registry, latestMonth, solution, themesToday }), null, 2)}\n`,
  );
  fs.writeFileSync(paths.dist('robots.txt'), ROBOTS);
  fs.writeFileSync(paths.dist('sitemap.xml'), sitemap({ lastmod }));
  fs.writeFileSync(
    paths.dist('llms.txt'),
    llmsTxt({
      month: latestMonth?.month ?? null,
      topProblem,
      topPlain: topEntry?.plain ?? null,
      days: solutions.length,
      months: months.length,
      solution,
    }),
  );

  log(`built dist/ (${solutions.length} solution days, ${months.length} months)`);
}

build();
