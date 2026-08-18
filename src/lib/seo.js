// Discovery surface. This site measures how legible brands are to answer
// engines, so it has to be exemplary at the thing it measures: crawlable
// without JavaScript, explicitly welcoming to AI crawlers, structured as a
// Dataset, and carrying prose that answers questions in self-contained chunks.

export const SITE = 'https://bartontech.ai';
export const TITLE = 'The martech problem index';
export const DESCRIPTION =
  "A daily record of which brands Claude, ChatGPT and Gemini name when asked about martech, and a monthly record of what the industry's hardest unsolved problem is. Open data, open harness.";

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
export function llmsTxt({ latestMonth, latestDay, topProblem, days, months }) {
  return `# ${TITLE}

> ${DESCRIPTION}

Two questions are asked on a fixed schedule and the answers are never backfilled. Monthly, three frontier models are asked what the martech industry's hardest unsolved problem is; their proposals are reconciled against a canonical registry so one problem under three names does not become three entries. Daily, the same models are asked who leads, and mention share, rank, sentiment, citation sources and cross-model agreement are recorded.

## Current state

- Hottest unsolved problem: ${topProblem ?? 'pending the first monthly index'}${latestMonth ? ` (panel consensus, ${latestMonth})` : ''}
- Days of daily tracking recorded: ${days}
- Monthly index runs recorded: ${months}
- Most recent daily run: ${latestDay ?? 'pending'}

## Data

Every file is plain JSON, append-only, and served without authentication.

- [Latest snapshot](${SITE}/data/latest.json): current board, top vendors by share of voice, cross-model agreement.
- [Problem registry](${SITE}/data/registry/problems.json): canonical problems, their aliases, and entries awaiting human review.
- [Daily tracker](${SITE}/data/tracker/): one file per day, named \`YYYY-MM-DD.json\`.
- [Monthly index](${SITE}/data/index/): one file per month, named \`YYYY-MM.json\`, including every model's raw proposals and the reconciliation decisions.

## Method

- Three samples per question per model per day. A single sample reported to two decimals is not a credible number, so every share carries a spread across samples.
- Ungrounded and web-grounded passes are stored separately and never merged. Parametric model knowledge lags by months; the gap between the two passes is itself a measurement.
- Every stored run records its prompt version and the exact model ids that produced it. When a model version ships, the numbers step-change, and the charts are annotated rather than smoothed.
- Raw model responses are kept alongside the parsed extraction, so an improved parser can re-derive history instead of losing it.

## Author

Warren Barton is an independent consultant working on martech, content architecture, and agentic systems. Contact: warren@bartontech.ai
`;
}

export function sitemap({ lastmod }) {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE}/data/latest.json`, priority: '0.8', changefreq: 'daily' },
    { loc: `${SITE}/llms.txt`, priority: '0.5', changefreq: 'daily' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

export function structuredData({ lastmod, days, months, faq, topProblem }) {
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
      'AI search visibility',
      'martech',
      'brand share of voice',
      'large language models',
    ],
    measurementTechnique:
      'Repeated sampling of three frontier language models against a frozen question set, with separate ungrounded and web-grounded passes and a spread reported across samples.',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Share of voice', description: 'Share of brand mentions attributable to one vendor across a question set.' },
      { '@type': 'PropertyValue', name: 'Mean rank', description: 'Average position at which a vendor is named within an answer.' },
      { '@type': 'PropertyValue', name: 'Cross-model agreement', description: 'How often two models independently name the same leading vendor.' },
      { '@type': 'PropertyValue', name: 'Panel score', description: 'Confidence-weighted count of models naming a problem as unsolved.' },
    ],
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/latest.json`, name: 'Latest snapshot' },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/registry/problems.json`, name: 'Canonical problem registry' },
    ],
  };

  const person = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: 'Warren Barton',
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

  const observation = topProblem
    ? [
        {
          '@type': 'Observation',
          '@id': `${SITE}/#top-problem`,
          measuredProperty: 'Hottest unsolved problem in marketing technology',
          observationDate: lastmod,
          observationAbout: { '@id': `${SITE}/#dataset` },
          measuredValue: topProblem,
        },
      ]
    : [];

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [website, person, dataset, faqPage, ...observation],
  });
}

// Written so each answer stands alone when an answer engine lifts it out of
// the page. No "as described above", no pronouns pointing at other questions.
export function faqItems({ topProblem, days, months }) {
  return [
    {
      q: 'What does the martech problem index measure?',
      a: `The martech problem index measures two things. Monthly, it asks Claude, ChatGPT and Gemini what the marketing technology industry's hardest unsolved problem is, and reconciles their answers into a canonical registry. Daily, it asks the same three models which vendors lead, recording mention share, the rank at which each vendor is named, sentiment, citation sources, and how often the models agree with each other.${topProblem ? ` As of the most recent monthly run the panel's leading answer is ${topProblem}.` : ''}`,
    },
    {
      q: 'How is share of voice inside AI answers calculated here?',
      a: 'Share of voice is the proportion of vendor mentions attributable to one vendor across a fixed question set. Each question is asked three times per model per day, and the reported share is accompanied by the spread across those samples. A share reported from a single sample would not be credible, because language models do not return identical answers to identical prompts.',
    },
    {
      q: 'Why separate ungrounded answers from web-grounded ones?',
      a: 'A language model answering from its own training data reflects the state of the web at its training cutoff, which can lag current reality by months. A model that searches before answering reflects what is findable today. Merging the two produces a number that means neither. This dataset stores the two passes separately, and the gap between them is treated as a measurement in its own right.',
    },
    {
      q: 'What is answer engine optimization?',
      a: 'Answer engine optimization, also called generative engine optimization or GEO, is the practice of influencing whether and how a brand appears inside answers generated by AI assistants rather than inside a ranked list of links. It differs from traditional search engine optimization because there is no results page to rank on: a brand is either named in the generated answer or it is absent, and the citation sources the model consulted determine which.',
    },
    {
      q: 'Why does the tracked problem change over time?',
      a: 'The problem the industry considers most urgent moves, and a tracker pinned to one topic goes stale. The index rotates its focus as the monthly panel moves, but a frozen anchor question set runs every day regardless, so the long-run series stays continuous. Retired problem sets keep running in the background rather than being deleted.',
    },
    {
      q: 'How are duplicate problem names handled?',
      a: 'Language models name the same problem differently on different runs, so "answer engine optimization", "GEO" and "LLM brand visibility" would otherwise become three separate entries and fragment the time series. Every monthly proposal is reconciled against a canonical registry that decides whether the proposal names an existing problem or a genuinely new one. New entries queue for human review before they enter the registry.',
    },
    {
      q: 'Is the underlying data available?',
      a: `Yes. Every run is stored as plain JSON and served without authentication at ${SITE}/data/, including a latest snapshot, the canonical problem registry, one file per tracked day, and one file per monthly index run containing each model's raw proposals and the reconciliation decisions. The harness that produces the data is open source.`,
    },
    {
      q: 'Can these numbers be reproduced or audited?',
      a: 'Every stored run records the prompt version and the exact model identifiers that produced it, and raw model responses are kept alongside the parsed extraction. That means a change in the numbers can be attributed to a prompt change, a model version change, or a real shift in behaviour, and an improved parser can re-derive history rather than discarding it. The data is append-only: stored runs are never edited.',
    },
  ];
}
