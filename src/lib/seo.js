// Discovery surface. This site measures how legible brands are to answer
// engines, so it has to be exemplary at the thing it measures: crawlable
// without JavaScript, explicitly welcoming to AI crawlers, structured data
// that mirrors the visible page, and prose that answers questions in
// self-contained chunks.

export const SITE = 'https://bartontech.ai';

// One source for the global navigation: render.js draws the visible nav from
// this list and structuredData() emits it as SiteNavigationElement entries,
// so the markup and the schema cannot disagree.
export const NAV_ITEMS = [
  { href: '/', label: 'Today' },
  { href: '/archive/', label: 'Archive' },
  { href: '/recognition/', label: 'Recognition log' },
  { href: '/how-it-works/', label: 'How it works' },
];
export const TITLE = 'The martech problem index';
export const DESCRIPTION =
  'Each month, ChatGPT, Claude and Gemini name the hardest unsolved problems in marketing technology. Each day, all three explain how they would attack one of them, in the same format, side by side. Open data, open harness.';

// A site about AI-answer visibility that blocks AI crawlers would be absurd.
// Every major answer-engine agent is named and allowed explicitly, because
// several of them treat an unnamed agent differently from an allowed one.
export const ROBOTS = `# This site is about being legible to AI answer engines.
# Every AI crawler below is welcome, by name and on purpose.

User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: Claude-SearchBot
User-agent: anthropic-ai
User-agent: Google-Extended
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Applebot
User-agent: Applebot-Extended
User-agent: CCBot
User-agent: meta-externalagent
User-agent: Amazonbot
User-agent: Bytespider
User-agent: cohere-ai
User-agent: DuckAssistBot
User-agent: MistralAI-User
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

// llms.txt: the emerging convention for pointing an assistant at the parts of
// a site worth reading, in the order worth reading them.
export function llmsTxt({ month, topProblem, topPlain, days, months, solution, archive = '' }) {
  const solutionFormats = solution
    ? (solution.formats ?? [{ format: solution.format, answers: solution.answers }])
    : [];
  const solutionLine = solution
    ? `- Today's question (${solution.date}): how would you attack "${solution.problem.canonical_name}"? Answered by ${[...new Set(solutionFormats.flatMap((f) => f.answers.map((a) => a.label)))].join(', ')}${solutionFormats.length > 1 ? ` in ${solutionFormats.length} formats` : ` in the format "${solutionFormats[0]?.format.label}"`}.`
    : '- The first daily answers land with the next run.';
  return `# ${TITLE}

> ${DESCRIPTION}

Two records, on a fixed schedule, never backfilled. Monthly: three frontier models are asked what the martech industry's hardest unsolved problems are; their proposals are reconciled against a canonical registry so one problem under three names does not become three entries, and new entries are reviewed by a person before they count. Daily: one problem rotates off the board and all three models answer the same question about it, in the same format, so any difference between their answers is substance rather than style.

## Current state

- Hardest unsolved problem: ${topProblem ?? 'pending the first monthly index'}${topPlain ? ` (in plain terms, ${topPlain})` : ''}${month ? ` (panel consensus, ${month})` : ''}
${solutionLine}
- Days of daily answers recorded: ${days}
- Monthly index runs recorded: ${months}

## Data

Every file is plain JSON, append-only, and served without authentication.

- [Latest snapshot](${SITE}/data/latest.json): the current board, today's answers, registry summary.
- [Problem registry](${SITE}/data/registry/problems.json): canonical problems, plain-language summaries, aliases, and the human review log.
- [Monthly index](${SITE}/data/index/): one file per month, named \`YYYY-MM.json\`, including every model's raw proposals and the reconciliation decisions. Forced reruns are archived under \`archive/\`, never overwritten silently.
- [Daily themes](${SITE}/data/themes/): one file per day. Claude reads the whole six-month record and names the cross-cutting themes; a single-model synthesis, labeled as such.
- [Daily answers](${SITE}/data/solutions/): one file per day, named \`YYYY-MM-DD.json\`, with each model's approach, first move, hardest part, and self-rated confidence.
- [Recognition log](${SITE}/data/recognition/): one file per month, named \`YYYY-MM.json\`. Each model is asked, with web search on and no hints, what bartontech.ai is; the verbatim answers are logged, including the months where the honest answer is "not found".

## Method

- The monthly panel runs each model twice: once answering from its own knowledge, once after searching the web. Proposals are reconciled against the registry by canonical id, so "AEO", "GEO" and "LLM visibility" stay one problem rather than three.
- The daily question asks how a model would attack the problem, not how to solve it. Every problem on the board is selected for being unsolved; a model asked to solve one invents a confident plan.
- All three models answer in every format on the list, and each panel holds one shared format, so any difference inside a panel is substance rather than style. The site shows one format by default, chosen by a date seed so it varies day to day, and the visitor switches to the rest.
- Every stored run records its prompt version and the exact model ids that produced it, and raw responses are kept so history can be re-derived rather than lost.
- Full method write-up, with a process diagram: ${SITE}/how-it-works/

${archive ? `## Archive\n\nEvery problem and every day has its own page.\n\n${archive}\n\n` : ''}## Author

Warren Barton is an independent consultant working on martech, content architecture, and agentic systems. Contact: warren@bartontech.ai
`;
}

export function sitemap({ lastmod, extra = [] }) {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
    ...extra,
    { loc: `${SITE}/data/latest.json`, priority: '0.8', changefreq: 'daily' },
    { loc: `${SITE}/llms.txt`, priority: '0.5', changefreq: 'daily' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod ?? lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

export function structuredData({ lastmod, days, months, faq, topProblem, board = [] }) {
  const dataset = {
    '@type': 'Dataset',
    '@id': `${SITE}/#dataset`,
    name: TITLE,
    description: DESCRIPTION,
    url: SITE,
    license: 'https://opensource.org/licenses/MIT',
    isAccessibleForFree: true,
    creator: { '@id': `${SITE}/#person` },
    dateModified: lastmod,
    temporalCoverage: `2026-08/..`,
    keywords: [
      'answer engine optimization',
      'generative engine optimization',
      'marketing technology',
      'unsolved problems',
      'large language models',
      'AI model comparison',
    ],
    measurementTechnique:
      'A monthly panel of three frontier language models proposes the industry’s hardest unsolved problems; proposals are reconciled against a canonical registry with human review. Daily, one problem rotates off the board and all three models answer the same question in the same format.',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Panel score', description: 'How often and how confidently the models named a problem as unsolved, confidence-weighted.' },
      { '@type': 'PropertyValue', name: 'Panel rank', description: 'The consensus ordering of problems for the month.' },
      { '@type': 'PropertyValue', name: 'Model confidence', description: 'Each model’s self-rated confidence that its proposed approach would work.' },
    ],
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/latest.json`, name: 'Latest snapshot' },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/registry/problems.json`, name: 'Canonical problem registry' },
    ],
  };

  // WebPage with speakable: the parts of the page written to be read out as
  // answers. The hero claim, its explanation, and the model answers themselves.
  const webPage = {
    '@type': 'WebPage',
    '@id': `${SITE}/#page`,
    url: `${SITE}/`,
    name: TITLE,
    isPartOf: { '@id': `${SITE}/#website` },
    about: { '@id': `${SITE}/#dataset` },
    dateModified: lastmod,
    lastReviewed: lastmod,
    reviewedBy: { '@id': `${SITE}/#person` },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.hero h1', '.hero__deck', '.answer__body'],
    },
  };

  const person = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: 'Warren Barton',
    alternateName: ['Warren Jay Barton', 'Warren J. Barton'],
    givenName: 'Warren',
    additionalName: 'Jay',
    familyName: 'Barton',
    email: 'warren@bartontech.ai',
    url: SITE,
    jobTitle: 'Independent consultant',
    knowsAbout: [
      'Marketing technology',
      'Content management systems',
      'Answer engine optimization',
      'Agentic AI systems',
      'Enterprise content architecture',
    ],
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': `${SITE}/#person` },
  };

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${SITE}/#faq`,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  // The board as an ItemList: the ranked problems are the site's core entities
  // and this is the machine-readable form of the ranking. Mirrors the visible
  // board on the page.
  const itemList = board.length
    ? [{
        '@type': 'ItemList',
        '@id': `${SITE}/#board`,
        name: 'Hardest unsolved problems in marketing technology, ranked by AI model consensus',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: board.length,
        itemListElement: board.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.canonical_name,
        })),
      }]
    : [];

  const observation = topProblem
    ? [
        {
          '@type': 'Observation',
          '@id': `${SITE}/#top-problem`,
          measuredProperty: 'Hardest unsolved problem in marketing technology',
          observationDate: lastmod,
          observationAbout: { '@id': `${SITE}/#dataset` },
          measuredValue: topProblem,
        },
      ]
    : [];

  const nav = {
    '@type': 'ItemList',
    '@id': `${SITE}/#nav`,
    name: 'Site navigation',
    itemListElement: NAV_ITEMS.map((n, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: n.label,
      url: `${SITE}${n.href}`,
    })),
  };

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [website, webPage, person, dataset, faqPage, nav, ...itemList, ...observation],
  });
}

// Written so each answer stands alone when an answer engine lifts it out of
// the page. No "as described above", no pronouns pointing at other questions.
export function faqItems({ topProblem, topPlain, days, months }) {
  return [
    {
      q: 'What is the martech problem index?',
      a: `The martech problem index asks ChatGPT, Claude and Gemini, once a month, to name the hardest unsolved problems in marketing technology. Their proposals are merged into one ranked board, checked by a person. Then, every day, one problem rotates off the board and all three models answer the same question about it: how would you attack this?${topProblem ? ` The problem at the top of the board right now is ${topProblem}${topPlain ? `, which in plain terms means ${topPlain}` : ''}.` : ''}`,
    },
    {
      q: 'What is Answer Engine Optimization?',
      a: 'Answer Engine Optimization, also called Generative Engine Optimization or GEO, is the practice of influencing whether and how a brand appears inside answers generated by AI assistants rather than inside a ranked list of links. It differs from traditional search engine optimization because there is no results page to rank on: a brand is either named in the generated answer or it is absent.',
    },
    {
      q: 'Why ask the models how they would attack a problem instead of how to solve it?',
      a: 'Every problem on the board is there because the industry has not solved it. A language model asked to solve an unsolved problem will produce a confident plan anyway, which is worse than useless. Asking how it would attack the problem, where it would start, and what it expects to be hard produces honest answers, and makes the real differences between the models visible.',
    },
    {
      q: 'Why do all three models answer in the same formats?',
      a: 'If one model answers in prose and another in code, the difference in style hides whether they actually disagree. So every answer panel holds one shared format: all three models write a memo, or all three write a haiku. The models answer in every format each day, the site opens on one chosen by a date seed, and the reader switches between the rest. Within any panel, difference is substance, not presentation.',
    },
    {
      q: 'How is the monthly board ranked?',
      a: 'Rank is the consensus ordering the models produced together. The score is separate: it counts every time a model named the problem, weighted by how confident the model said it was, with high worth three, medium two, and low one. A problem can rank first on consensus while another has a higher score, and the two are shown side by side rather than merged.',
    },
    {
      q: 'How are duplicate problem names handled?',
      a: 'Language models name the same problem differently on different runs, so "answer engine optimization", "GEO" and "LLM brand visibility" would otherwise become three separate entries and fragment the record. Every monthly proposal is reconciled against a canonical registry that decides whether the proposal names an existing problem or a genuinely new one. New entries queue for human review before they enter the registry.',
    },
    {
      q: 'Who writes the themes?',
      a: 'Claude does, once a day, by reading the whole record from the last six months: every monthly board and every day of answers. The themes are a single-model synthesis and the page labels them that way, unlike the board, which is what all three models produced together. Theme names are kept stable day to day, and movement is recorded as a trend (new, rising, steady, or fading) rather than by renaming.',
    },
    {
      q: 'Do the AI models know this site exists?',
      a: 'Once a month, ChatGPT, Claude and Gemini are each asked one neutral question, with web search on and no hints: what is bartontech.ai? Their verbatim answers go into a public, append-only recognition log, including the months where the honest answer is that they found nothing. Getting named by AI answers is itself one of the unsolved problems the index tracks, so the log is the site running that experiment on itself, and it records the date each model first gives a correct answer.',
    },
    {
      q: 'Is the underlying data available?',
      a: `Yes. Every run is stored as plain JSON and served without authentication at ${SITE}/data/, including the current snapshot, the canonical problem registry with its review log, one file per monthly index run containing each model's raw proposals, one file per day of answers, and one file per day of themes. The harness that produces the data is open source.`,
    },
    {
      q: 'Can the results be reproduced or audited?',
      a: 'Every stored run records the prompt version and the exact model identifiers that produced it, and raw model responses are kept alongside the parsed data. The monthly panel is not deterministic: the same month can return a different ordering on a rerun, so published months are never overwritten silently. A forced rerun archives the previous version, and the archive is public. The model lineup itself is checked weekly against the live model lists published by the providers, and any change ships as a reviewed pull request rather than a silent swap.',
    },
  ];
}
