// Shared rendering for every page the build emits. One head block, one footer,
// one answers renderer, so the homepage and the archive pages cannot drift
// apart in metadata or markup.

import { esc } from './charts.js';
import { CSS } from './page-css.js';
import { SITE, NAV_ITEMS } from './seo.js';
import { paths, readJSON } from './io.js';

// Per-format switcher rules, generated from the same config the runner asks
// with: show the checked panel, mark the active pill, carry focus from the
// hidden radio onto its visible label.
const FORMAT_IDS = readJSON(paths.config('formats.json')).formats.map((f) => f.id);
export const PAGE_CSS =
  CSS +
  FORMAT_IDS.map(
    (i) => `
#fmt-${i}:checked ~ .fmt-panel--${i} { display:block; }
#fmt-${i}:checked ~ .fmt-bar label[for="fmt-${i}"] { background:#0b0b0b; color:#fff; border-color:#0b0b0b; }
#fmt-${i}:focus-visible ~ .fmt-bar label[for="fmt-${i}"] { outline:2px solid var(--link); outline-offset:3px; }`,
  ).join('');

export const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232a78d6'/%3E%3Cpath d='M6 22 L13 14 L19 18 L26 8' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const noEmDash = (text) => {
  if (!text || !text.includes('—')) return text ?? '';
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      let first = true;
      return sentence.replace(/\s*—\s*/g, () => {
        const sep = first ? ': ' : ', ';
        first = false;
        return sep;
      });
    })
    .join(' ');
};

export function headBlock({ title, description, path, jsonLd }) {
  const url = `${SITE}${path}`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="${FAVICON}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#0b0b0b">
<meta name="author" content="Warren Barton">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="bartontech.ai">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="The Martech problem index: one unsolved problem, three AI answers, every day.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="twitter:image:alt" content="The Martech problem index: one unsolved problem, three AI answers, every day.">
<link rel="alternate" type="application/atom+xml" href="${SITE}/feed.xml" title="The Martech problem index, daily">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
<style>${PAGE_CSS}</style>`;
}

// The global navigation. One list, rendered identically in the homepage hero
// bar and every subpage masthead, so orientation never depends on which page
// the visitor landed on. aria-current marks the exact page; day and problem
// pages mark Archive as the current section instead, since that is where
// they live in the hierarchy. The item list lives in seo.js so the visible
// nav and the SiteNavigationElement structured data cannot drift apart.
export function siteNav(currentPath) {
  const items = NAV_ITEMS.map((item) => {
    const exact = currentPath === item.href;
    const section =
      item.href === '/archive/' &&
      (currentPath.startsWith('/days/') || currentPath.startsWith('/problems/'));
    const current = exact ? ' aria-current="page"' : section ? ' aria-current="true"' : '';
    return `<li><a href="${item.href}"${current}>${item.label}</a></li>`;
  }).join('');
  // A details/summary disclosure, so the menu opens and closes with zero
  // JavaScript and the summary reports its expanded state to assistive tech
  // natively. The links stay in the document for crawlers whether or not the
  // menu is open.
  return `<details class="menu">
    <summary>
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <span class="visually-hidden">Menu</span>
    </summary>
    <nav class="nav" aria-label="Site"><ul>${items}</ul></nav>
  </details>`;
}

export function siteFooter() {
  return `<footer>
  <div class="wrap">
  <p>Built from an open harness. Reproducibility is the point: prompt versions, model identifiers and raw responses are all stored with the answers they produced. The data is append-only and <a href="${SITE}/data/latest.json">machine-readable</a>. The whole machine is on one page: <a href="/how-it-works/">how this site works</a>.</p>
  <p><s aria-hidden="true">Developed</s> Orchestrated by <a href="mailto:warren@bartontech.ai">warren@bartontech.ai</a>.</p>
  </div>
</footer>`;
}


// Old solution files carry a single format at the top level; new files carry
// a formats array and a default id. Everything downstream consumes this shape.
export function normalizeSolution(sol) {
  if (!sol) return null;
  const formats = sol.formats
    ? sol.formats.filter((f) => f.answers?.length)
    : sol.answers?.length
      ? [{ format: sol.format, answers: sol.answers }]
      : [];
  if (!formats.length) return null;
  const defaultId =
    sol.default_format && formats.some((f) => f.format.id === sol.default_format)
      ? sol.default_format
      : formats[0].format.id;
  return { ...sol, formats, defaultId };
}

function answerList(answers, verse) {
  return `<ul class="answers">${[...answers]
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
    .join('')}</ul>`;
}

// The day's three answers, alphabetical by model name so the order is fixed
// and carries no implied ranking. Model text renders raw: the answers are
// quotations, and house punctuation applies only to what the site authors.
export function renderAnswers(sol, { linkDate = false } = {}) {
  const solution = normalizeSolution(sol);
  if (!solution) {
    return '<div class="empty">Collecting. The first answers land with the next daily run.</div>';
  }
  const dateHtml = linkDate
    ? `<a href="/days/${esc(solution.date)}/">${esc(solution.date)}</a>`
    : esc(solution.date);
  const single = solution.formats.length === 1;

  const inputs = solution.formats
    .map(
      (f) =>
        `<input class="fmt-radio" type="radio" name="fmt" id="fmt-${esc(f.format.id)}"${f.format.id === solution.defaultId ? ' checked' : ''}>`,
    )
    .join('');
  const labels = solution.formats
    .map((f) => `<label class="fmt-pill" for="fmt-${esc(f.format.id)}">${esc(f.format.label)}</label>`)
    .join('');
  // A single-format day renders its answers bare: the panel wrapper's
  // display:none is only ever lifted by a checked radio, and single mode has
  // no radios, so wrapping would hide the answers with no way to show them.
  const panels = single
    ? answerList(solution.formats[0].answers, solution.formats[0].format.id === 'haiku')
    : solution.formats
        .map(
          (f) =>
            `<div class="fmt-panel fmt-panel--${esc(f.format.id)}">${answerList(f.answers, f.format.id === 'haiku')}</div>`,
        )
        .join('');

  const chooser = single
    ? `<span class="solutions__format">Format: ${esc(solution.formats[0].format.label)}</span>`
    : '';

  return `<div class="formats">
    ${single ? '' : inputs}
    <p class="solutions__meta">
      On ${dateHtml} the question was: how would you attack
      <strong>${esc(solution.problem.plain || solution.problem.canonical_name)}</strong>?
      ${chooser}
    </p>
    ${
      single
        ? ''
        : `<fieldset class="fmt-bar">
        <legend class="fmt-legend">Answer format</legend>
        ${labels}
      </fieldset>`
    }
    ${panels}
  </div>`;
}

export function breadcrumbLd(trail, extraNodes = []) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          item: `${SITE}${t.path}`,
        })),
      },
      {
        '@type': 'WebPage',
        url: `${SITE}${trail[trail.length - 1].path}`,
        name: trail[trail.length - 1].name,
        isPartOf: { '@id': `${SITE}/#website` },
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.answer__body', '.subpage__deck'] },
      },
      ...extraNodes,
    ],
  });
}

// The day page is literally one question answered three ways, so it says so
// in schema: a Question whose suggestedAnswers are authored by the models,
// typed as software rather than people.
export function questionLd(sol) {
  const solution = normalizeSolution(sol);
  // Every panel's answers are equally real; all of them go into the schema,
  // with the format named in each answer's text so the variants are distinct.
  const all = solution.formats.flatMap((f) =>
    [...f.answers]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((a) => ({
        '@type': 'Answer',
        text: solution.formats.length > 1 ? `[Format: ${f.format.label}] ${a.approach}` : a.approach,
        dateCreated: solution.date,
        author: { '@type': 'SoftwareApplication', name: `${a.label} (${a.model})` },
      })),
  );
  return {
    '@type': 'Question',
    name: `How would you attack ${solution.problem.plain || solution.problem.canonical_name}?`,
    answerCount: all.length,
    dateCreated: solution.date,
    about: { '@type': 'Thing', name: solution.problem.canonical_name },
    suggestedAnswer: all,
  };
}

// The problem entity with every name the models use for it, so a query in any
// of those vocabularies can resolve to this page.
export function problemLd(entry, path) {
  return {
    '@type': 'Thing',
    '@id': `${SITE}${path}#problem`,
    name: entry.canonical_name,
    alternateName: entry.aliases ?? [],
    description: entry.plain_summary || entry.definition || '',
    url: `${SITE}${path}`,
  };
}

// Every page below the homepage: slim dark masthead linking home, a light
// heading block, the body, the shared footer.
export function subShell({ title, description, path, eyebrow, heading, deck = '', body, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
${headBlock({ title, description, path, jsonLd })}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="subhead">
  <div class="wrap subhead__row">
    <div class="subhead__ident">
      <a class="subhead__mark" href="/"><b>bartontech</b>.ai</a>
      <a class="subhead__site" href="/">The Martech problem index</a>
    </div>
    ${siteNav(path)}
  </div>
</header>
<main id="main">
<div class="wrap">
  <div class="subpage__head">
    <p class="subpage__eyebrow">${eyebrow}</p>
    <h1 class="subpage__title">${heading}</h1>
    ${deck ? `<p class="subpage__deck">${deck}</p>` : ''}
  </div>
  ${body}
</div>
</main>
${siteFooter()}
</body>
</html>`;
}

// The recognition log reuses the answer-card markup: its entries are
// quotations too, and the shared classes keep the two lists one visual
// family with no new CSS. Model text renders raw, same as the daily answers.
const RECOGNITION_BASIS = {
  search_results: 'what it found searching',
  prior_knowledge: 'what it already knew',
  name_inference: 'a guess from the name alone',
  none: 'nothing: it found no information',
};

export function recognitionCards(rec, { sources = false } = {}) {
  return `<ul class="answers">${[...rec.results]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(
      (r) => `<li class="answer">
      <div class="answer__who">
        <span class="answer__model">${esc(r.label)}</span>
        <span class="answer__id">${esc(r.model)}</span>
      </div>
      <p class="answer__body">${esc(r.answer)}</p>
      <dl class="answer__foot">
        <dt>Recognized the site</dt><dd>${r.familiar ? 'Yes' : 'No'}</dd>
        <dt>Answer based on</dt><dd>${esc(RECOGNITION_BASIS[r.basis] ?? r.basis)}</dd>
      </dl>
      ${
        sources && r.sources?.length
          ? `<p class="answer__conf">Sources: ${r.sources.slice(0, 4).map(esc).join('; ')}${r.sources.length > 4 ? ` and ${r.sources.length - 4} more` : ''}</p>`
          : ''
      }
    </li>`,
    )
    .join('')}</ul>`;
}
