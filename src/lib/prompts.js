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
