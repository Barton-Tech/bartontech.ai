import { MENTION_EXTRACTION } from './schemas.js';
import { trackerSystem, trackerUser } from './prompts.js';

const slug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-');

export function customId({ template, question, provider, pass, sample }) {
  return [slug(template), slug(question), provider, pass, `s${sample}`].join('__');
}

export function parseCustomId(id) {
  const [template, question, provider, pass, sample] = id.split('__');
  return { template, question, provider, pass, sample: Number(sample.slice(1)) };
}

// One template x one provider produces every request that provider owes for
// the day: N ungrounded samples per question plus the grounded pass.
export function buildRequests(template, providerName, config) {
  const { samples_per_question: samples, grounded_samples: groundedSamples } =
    config.sampling;
  const system = trackerSystem(template);
  const out = [];

  for (const question of template.questions) {
    for (let i = 1; i <= samples; i += 1) {
      out.push({
        custom_id: customId({
          template: template.id,
          question: question.id,
          provider: providerName,
          pass: 'ungrounded',
          sample: i,
        }),
        tier: 'bulk',
        grounded: false,
        system,
        user: trackerUser(question, { grounded: false }),
        schema: MENTION_EXTRACTION,
      });
    }

    for (let i = 1; i <= groundedSamples; i += 1) {
      out.push({
        custom_id: customId({
          template: template.id,
          question: question.id,
          provider: providerName,
          pass: 'grounded',
          sample: i,
        }),
        tier: 'grounded',
        grounded: true,
        system,
        user: trackerUser(question, { grounded: true }),
        schema: MENTION_EXTRACTION,
      });
    }
  }

  return out;
}

export function loadTemplates(readJSON, paths, listJSON) {
  const anchor = readJSON(paths.config('anchor.json'));
  const problems = listJSON(paths.config('problems'))
    .map((f) => readJSON(paths.config('problems', f)))
    .filter((t) => t.status === 'active');
  return { anchor, problems, all: [anchor, ...problems] };
}
