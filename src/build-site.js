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
import { paths, readJSON, listJSON, log } from './lib/io.js';
import { rankedBoard, esc } from './lib/charts.js';

import {
  FAVICON,
  PAGE_CSS,
  noEmDash,
  normalizeSolution,
  renderAnswers,
  siteFooter,
  subShell,
  breadcrumbLd,
  questionLd,
  problemLd,
} from './lib/render.js';
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
    days: solutions.length,
    months: months.length,
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
    <p class="section__note">We rotate through this month's board, one problem each day. ChatGPT, Claude and Gemini all get the same question (how would you attack this?) and answer it in every format on the list, from a memo to a haiku. Pick the format you want to read; a different one leads each day. We never ask for a solution: everything here is unsolved, and a model asked to solve it will invent a plan. So any difference between the answers is substance, not style.</p>
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
    `${JSON.stringify(latestSnapshot({ months, solutions, registry, latestMonth, solution, themesToday }), null, 2)}\n`,
  );
  // ---------- archive pages ----------
  // Yesterday's answers used to vanish from the site every morning: preserved
  // in data/, shown nowhere. Each day and each problem now has its own page,
  // which is also where the record's depth becomes visible and citable.
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
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
        description: `On ${sol.date}, ChatGPT, Claude and Gemini were each asked how they would attack ${plain}, in ${(sol.formats ?? [sol]).length > 1 ? 'six formats, from a memo to a haiku' : `the format: ${(sol.formats?.[0]?.format ?? sol.format).label.toLowerCase()}`}. Their full answers, side by side.`,
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
    <summary>${esc(`ChatGPT, Claude and Gemini each answer${x.formats ? ' in six formats, from a memo to a haiku' : ` in the format: ${x.format.label.toLowerCase()}`}. ${x.problem.canonical_name}, from the ${x.board_month} board.`)}</summary>
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
