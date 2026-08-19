// Shared rendering for every page the build emits. One head block, one footer,
// one answers renderer, so the homepage and the archive pages cannot drift
// apart in metadata or markup.

import { esc } from './charts.js';
import { CSS } from './page-css.js';
import { SITE } from './seo.js';

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
<style>${CSS}</style>`;
}

export function siteFooter() {
  return `<footer>
  <div class="wrap">
  <p>Built from an open harness. Reproducibility is the point: prompt versions, model identifiers and raw responses are all stored with the answers they produced. The data is append-only and <a href="${SITE}/data/latest.json">machine-readable</a>.</p>
  <p><s aria-hidden="true">Developed</s> Orchestrated by <a href="mailto:warren@bartontech.ai">warren@bartontech.ai</a>.</p>
  </div>
</footer>`;
}

// The day's three answers, alphabetical by model name so the order is fixed
// and carries no implied ranking. Model text renders raw: the answers are
// quotations, and house punctuation applies only to what the site authors.
export function renderAnswers(solution, { linkDate = false } = {}) {
  if (!solution) {
    return '<div class="empty">Collecting. The first answers land with the next daily run.</div>';
  }
  const verse = solution.format?.id === 'haiku';
  const dateHtml = linkDate
    ? `<a href="/days/${esc(solution.date)}/">${esc(solution.date)}</a>`
    : esc(solution.date);
  return `<p class="solutions__meta">
        On ${dateHtml} the question was: how would you attack
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
         .join('')}</ul>`;
}

// extraNodes lets a page add its own typed content next to the breadcrumb:
// a Question with its three answers on day pages, the problem entity with its
// aliases on problem pages.
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
export function questionLd(solution) {
  return {
    '@type': 'Question',
    name: `How would you attack ${solution.problem.plain || solution.problem.canonical_name}?`,
    answerCount: solution.answers.length,
    dateCreated: solution.date,
    about: { '@type': 'Thing', name: solution.problem.canonical_name },
    suggestedAnswer: [...solution.answers]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((a) => ({
        '@type': 'Answer',
        text: a.approach,
        dateCreated: solution.date,
        author: { '@type': 'SoftwareApplication', name: `${a.label} (${a.model})` },
      })),
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
    <a class="subhead__mark" href="/"><b>bartontech</b>.ai</a>
    <a class="subhead__site" href="/">The Martech problem index</a>
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
