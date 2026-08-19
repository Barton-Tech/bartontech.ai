// Prompt text is versioned in config/models.json (sampling.prompt_version) and
// stamped onto every stored run. A share-of-voice number is meaningless
// without knowing which prompt produced it, and the charts annotate the points
// where this version changes.

export function trackerSystem(template) {
  return [
    'You are answering a question the way you would answer it for a marketer who asked you directly.',
    '',
    'Answer the question first, on the merits. Then report which brands, vendors, or approaches your answer named, in the order you named them.',
    '',
    'The entity list below exists so results stay comparable across runs. It is a reference, not a menu: name whatever your answer would genuinely name. When something you named is on the list, use the list spelling exactly and set in_entity_list to true. When it is not, use your own name for it and set in_entity_list to false.',
    '',
    `Entities: ${template.entities.join(', ')}`,
  ].join('\n');
}

export function trackerUser(question, { grounded }) {
  if (grounded) {
    return [
      question.text,
      '',
      'Search for current information before answering, and list the URLs you consulted.',
    ].join('\n');
  }
  return [
    question.text,
    '',
    'Answer from what you already know. Do not search. Return an empty sources array.',
  ].join('\n');
}

export const PROBLEM_INDEX_SYSTEM = [
  'You track the marketing technology industry closely.',
  '',
  'You are being asked what the industry\'s most pressing unsolved problems are right now. "Unsolved" is the load-bearing word: the interest is in genuine friction that practitioners hit and current tooling does not resolve, not in whatever vendors are marketing hardest.',
  '',
  'A problem qualifies when a competent team with budget still cannot reliably solve it today. Name the specific blocker rather than restating that the area is difficult. Prefer problems that are live now over perennial complaints that have been true for a decade, and say what makes you believe each one is live.',
].join('\n');

export function problemIndexUser({ grounded, month }) {
  const base = `What are the most pressing unsolved problems in marketing technology as of ${month}? Give up to eight, ranked.`;
  return grounded
    ? `${base}\n\nSearch for current sources before answering.`
    : `${base}\n\nAnswer from your own knowledge. Do not search.`;
}

export function reconciliationSystem(registry) {
  const known = registry.problems
    .map(
      (p) =>
        `- ${p.id}: ${p.canonical_name}. ${p.definition} Also called: ${p.aliases.join(', ') || 'none recorded'}.`,
    )
    .join('\n');

  return [
    'You maintain a registry of canonically-named industry problems so that a monthly time series stays coherent.',
    '',
    'Several models have each proposed a list of the industry\'s most pressing unsolved problems. Your job is to decide, for each proposal, whether it names a problem the registry already contains or a genuinely new one.',
    '',
    'Two proposals are the same problem when they describe the same underlying friction, regardless of naming. "Answer engine optimization", "GEO", and "LLM brand visibility" are one problem under three labels. Matching aggressively is the point: a registry that splits one problem across three ids produces a time series that fragments and cannot be charted.',
    '',
    'Create a new entry only when no existing entry covers the proposal. A new entry is a claim that the industry\'s attention moved somewhere it had not been before, and it will be reviewed by a person before it enters the registry.',
    '',
    'Existing registry entries:',
    known || '(registry is empty)',
  ].join('\n');
}

export function reconciliationUser(proposals) {
  const lines = proposals.map(
    (p) =>
      `- [${p.provider}] ${p.name} (${p.category}, confidence ${p.confidence}): ${p.definition} Blocker: ${p.why_unsolved}`,
  );
  return [
    'Resolve each of these proposals against the registry, then give a merged ranking of canonical ids, most pressing first.',
    '',
    ...lines,
  ].join('\n');
}

// Deliberately asks how a model would attack the problem, not how to solve it.
// Every problem on this board is selected for being unsolved, so a model asked
// to solve one produces confident nonsense. Asking for an approach and for what
// makes it hard gets the honest answer, and sharpens the differences between
// models rather than flattening them into three versions of the same pitch.
export function solutionSystem(format) {
  return [
    'You work on marketing technology and you are talking to someone who does too.',
    '',
    'You are being asked how you would attack a problem the industry has not solved. Do not claim to solve it. A confident plan for something genuinely unsolved is worse than an honest account of where you would start and what you would expect to run into.',
    '',
    'Say what you actually think. Where you disagree with the obvious answer, say so.',
    '',
    `Format: ${format.instruction}`,
  ].join('\n');
}

export function solutionUser({ problem, plain, definition, why_unsolved, format }) {
  return [
    `The problem: ${problem}${plain ? ` (in plain terms: ${plain})` : ''}.`,
    '',
    definition,
    why_unsolved ? `\nWhat has blocked it so far: ${why_unsolved}` : '',
    '',
    `How would you attack this? Answer in the required format: ${format.label.toLowerCase()}.`,
  ].join('\n');
}

// The themes layer is a single-model synthesis over the whole record, distinct
// from the multi-model measurements. Stability matters more than novelty: a
// reader who visits two days running should see the same themes unless the
// record actually moved, so yesterday's themes are passed back in and renaming
// is discouraged.
export function themesSystem() {
  return [
    'You maintain the themes layer of a public record about marketing technology.',
    '',
    'The record has two parts. Monthly, three AI models name the hardest unsolved problems in martech, merged into a ranked board. Daily, one problem rotates off the board and all three models explain how they would attack it.',
    '',
    'Your job is to read the record and name three to five cross-cutting themes. A theme is a pattern that shows up across several problems, or across several models\' answers: a shared root cause, a shared blocker, a shared bet the models keep making. A theme is not a restatement of a single problem.',
    '',
    'Write the plain field so a smart non-specialist follows it on first read: short sentences, ordinary words, roughly an 8th-grade reading level.',
    '',
    'Keep names stable. If you are shown yesterday\'s themes, reuse their names for anything that continues, and record movement in the trend field instead of renaming. Rename or replace a theme only when the record genuinely moved.',
    '',
    'Ground everything in the supplied record. If the record is thin, say less: fewer themes with real evidence beat five themes padded with guesswork.',
    '',
    'Write without em dashes. Use commas, colons, parentheses, or separate sentences instead.',
  ].join('\n');
}

export function themesUser({ date, boards, solutions, previous }) {
  const boardLines = boards
    .map(
      (b) =>
        `${b.month}: ${b.board.map((x, i) => `${i + 1}. ${x.canonical_name} (id ${x.canonical_id}, score ${x.score})`).join('; ')}`,
    )
    .join('\n');

  const solutionLines = solutions
    .map((s) => {
      const per = s.answers
        .map((a) => `${a.label}: first move: ${a.first_move} hardest part: ${a.hardest_part} (confidence ${a.confidence})`)
        .join(' | ');
      return `${s.date} · ${s.problem.canonical_name} (id ${s.problem.canonical_id}): ${per}`;
    })
    .join('\n');

  const prior = previous
    ? `Yesterday's themes, for name stability:\n${previous.themes
        .map((t) => `- ${t.name} (${t.trend}): ${t.plain}`)
        .join('\n')}`
    : 'There are no previous themes; every theme you name will be "new".';

  return [
    `Today is ${date}. The record below covers the last six months.`,
    '',
    'MONTHLY BOARDS',
    boardLines || '(none yet)',
    '',
    'DAILY ANSWERS',
    solutionLines || '(none yet)',
    '',
    prior,
    '',
    'Name the themes.',
  ].join('\n');
}

export function modelRefreshSystem() {
  return [
    'You maintain the model configuration of an unattended weekly pipeline that compares AI models on marketing technology questions.',
    '',
    'Three tiers per provider: bulk carries high-volume cheap sampling, grounded needs reliable web-search tool use, reasoning runs monthly synthesis and reconciliation.',
    '',
    'Hard requirements, from the pipeline code:',
    '- Anthropic grounded tier must support the current web_search tool generation.',
    '- OpenAI models must support the Responses API with web_search and strict structured outputs.',
    '- Google models must be from a generation that supports Search grounding combined with a response schema.',
    '- Every model id you propose must be copied exactly from the available-model lists supplied. Never propose an id that is not in those lists.',
    '',
    'Stability is preferred over novelty. Recommend a change only when a configured model is retired, deprecated, or clearly superseded within the same family and price class. Set changed to false when the current configuration is still the most applicable.',
    '',
    'Verify pricing with web search before reporting it, in USD per million tokens, and cite where you found it. A wrong price corrupts a spend guard, so an honest "unchanged" beats a guessed upgrade.',
    '',
    'Write without em dashes. Use commas, colons, parentheses, or separate sentences instead.',
  ].join('\n');
}

export function modelRefreshUser({ config, available, missing }) {
  const cfg = Object.fromEntries(
    Object.entries(config.providers).map(([name, p]) => [
      name,
      { enabled: p.enabled, models: p.models },
    ]),
  );
  return [
    'Current configuration:',
    JSON.stringify(cfg, null, 2),
    '',
    'Current pricing table:',
    JSON.stringify(config.pricing, null, 2),
    '',
    'Available models, fetched from each provider today:',
    JSON.stringify(available, null, 2),
    missing.length
      ? `\nURGENT: these configured models were NOT in the fetched lists and every run using them will fail: ${missing.join(', ')}. Propose replacements for them regardless of the stability preference.`
      : '',
    '',
    'Review the configuration against what is available and propose the most applicable model per tier per provider, with verified pricing.',
  ].join('\n');
}
