// JSON Schemas for structured outputs.
//
// Constraints that apply across providers: every object needs
// additionalProperties:false, every property must appear in `required`, and
// numeric/string constraints (minimum, maxLength, ...) are not supported.
// Optionality is expressed with sentinel values ("" / "unknown"), not by
// omitting the key.

export const MENTION_EXTRACTION = {
  type: 'object',
  properties: {
    mentions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'The brand, vendor, or approach as you would name it. Use the entity list verbatim when it matches; otherwise give your own name for it.',
          },
          rank: {
            type: 'integer',
            description:
              'Order of mention in your answer, starting at 1. Reflects prominence, not quality.',
          },
          sentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative'],
            description: 'How your answer characterises this entity.',
          },
          in_entity_list: {
            type: 'boolean',
            description:
              'True if this exactly matches one of the supplied entities. False means it belongs in the "other" bucket.',
          },
          rationale: {
            type: 'string',
            description: 'One short sentence on why you named it.',
          },
        },
        required: ['name', 'rank', 'sentiment', 'in_entity_list', 'rationale'],
        additionalProperties: false,
      },
    },
    sources: {
      type: 'array',
      description:
        'URLs you actually consulted. Empty array when answering from parametric knowledge alone.',
      items: { type: 'string' },
    },
    answer_summary: {
      type: 'string',
      description: 'Two sentences summarising the answer you would have given.',
    },
  },
  required: ['mentions', 'sources', 'answer_summary'],
  additionalProperties: false,
};

export const PROBLEM_PROPOSAL = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      description: 'Ranked, most pressing first.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short name for the problem.' },
          definition: {
            type: 'string',
            description: 'One or two sentences stating the problem precisely.',
          },
          why_unsolved: {
            type: 'string',
            description:
              'What specifically prevents this from being solved today. Not "it is hard" but the actual blocker.',
          },
          category: {
            type: 'string',
            enum: [
              'measurement',
              'data',
              'content',
              'identity',
              'automation',
              'governance',
              'org',
              'other',
            ],
          },
          evidence: {
            type: 'string',
            description:
              'What makes you believe this is live right now rather than a perennial complaint.',
          },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: [
          'name',
          'definition',
          'why_unsolved',
          'category',
          'evidence',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['problems'],
  additionalProperties: false,
};

export const RECONCILIATION = {
  type: 'object',
  properties: {
    resolutions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          proposed_name: {
            type: 'string',
            description: 'The proposal you are resolving, verbatim.',
          },
          decision: {
            type: 'string',
            enum: ['match', 'new'],
            description:
              '"match" if this is the same underlying problem as an existing registry entry, even under a different name. "new" only when no existing entry covers it.',
          },
          canonical_id: {
            type: 'string',
            description:
              'For "match", the existing registry id. For "new", a proposed lowercase-hyphenated id.',
          },
          canonical_name: {
            type: 'string',
            description:
              'For "match", the existing canonical name unchanged. For "new", the name you propose.',
          },
          reason: {
            type: 'string',
            description: 'One sentence justifying the decision.',
          },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: [
          'proposed_name',
          'decision',
          'canonical_id',
          'canonical_name',
          'reason',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    ranking: {
      type: 'array',
      description:
        'Canonical ids ordered most pressing first, merging the panel proposals.',
      items: { type: 'string' },
    },
  },
  required: ['resolutions', 'ranking'],
  additionalProperties: false,
};

// Each model answers the same question about the same problem in the same
// format. `first_move` and `hardest_part` are held constant regardless of the
// month's format, so there is always something comparable across models even
// when the formatted answer is a haiku.
export const SOLUTION = {
  type: 'object',
  properties: {
    approach: {
      type: 'string',
      description:
        'Your answer, in exactly the format requested. Do not restate the question or add a preamble.',
    },
    first_move: {
      type: 'string',
      description:
        'One short sentence: the single thing you would do first. Plain language, no jargon.',
    },
    hardest_part: {
      type: 'string',
      description:
        'One sentence on what genuinely makes this hard, not what makes it tedious.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'How confident you are that this approach would actually work.',
    },
  },
  required: ['approach', 'first_move', 'hardest_part', 'confidence'],
  additionalProperties: false,
};

// Cross-cutting themes synthesized from the accumulated record. A theme is a
// pattern that recurs across problems or across models' answers, not a
// restatement of one problem. Names should stay stable day to day; `trend` is
// where movement gets recorded.
export const THEMES = {
  type: 'object',
  properties: {
    themes: {
      type: 'array',
      description: 'Three to five themes, strongest evidence first.',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Short stable name, two to five words. Reuse yesterday\'s name for a continuing theme; rename only when the data genuinely moved.',
          },
          plain: {
            type: 'string',
            description:
              'One or two sentences a smart non-specialist follows on first read. Plain words, no industry jargon.',
          },
          evidence: {
            type: 'string',
            description:
              'One sentence naming the specific problems or answers in the supplied record that support this theme. Use plain problem names, never ids like agent-safe-execution: this sentence is read aloud by screen readers. Only what is in the record.',
          },
          problem_ids: {
            type: 'array',
            description: 'Canonical ids of the problems this theme draws on.',
            items: { type: 'string' },
          },
          trend: {
            type: 'string',
            enum: ['new', 'rising', 'steady', 'fading'],
            description:
              'Relative to the previous themes you were shown. "new" when there were none, or the theme was not present yesterday.',
          },
        },
        required: ['name', 'plain', 'evidence', 'problem_ids', 'trend'],
        additionalProperties: false,
      },
    },
  },
  required: ['themes'],
  additionalProperties: false,
};

// Weekly model refresh. The proposal is validated hard before it touches
// config: every proposed id must appear in the provider's live model list
// fetched moments earlier, which keeps a hallucinated id out of the pipeline.
export const MODEL_REFRESH = {
  type: 'object',
  properties: {
    changed: {
      type: 'boolean',
      description:
        'True only when at least one tier should move to a different model. Stability is preferred: do not churn for marginal gains.',
    },
    summary: {
      type: 'string',
      description:
        'Two or three sentences for a human reviewer: what changed, what did not, and why.',
    },
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['anthropic', 'openai', 'google'] },
          batch_discount: {
            type: 'number',
            description: 'Multiplier applied to daily-work pricing. 0.5 when a batch API discount applies, 1 otherwise.',
          },
          search_per_call: {
            type: 'number',
            description: 'USD per web search call on this provider. 0 when included free.',
          },
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tier: { type: 'string', enum: ['bulk', 'grounded', 'reasoning'] },
                model_id: {
                  type: 'string',
                  description: 'Must be copied exactly from the available-model list supplied in the prompt.',
                },
                price_in: { type: 'number', description: 'USD per million input tokens.' },
                price_out: { type: 'number', description: 'USD per million output tokens.' },
                rationale: { type: 'string', description: 'One sentence: why this model for this tier.' },
                source_url: { type: 'string', description: 'Where the pricing was verified.' },
              },
              required: ['tier', 'model_id', 'price_in', 'price_out', 'rationale', 'source_url'],
              additionalProperties: false,
            },
          },
        },
        required: ['provider', 'batch_discount', 'search_per_call', 'tiers'],
        additionalProperties: false,
      },
    },
  },
  required: ['changed', 'summary', 'providers'],
  additionalProperties: false,
};

// The recognition log's answer shape. `basis` exists because a model can
// return a plausible description of "the Martech problem index" reasoned from
// the words in the domain alone; that is not recognition, and the log needs
// to tell the two apart.
export const RECOGNITION = {
  type: 'object',
  properties: {
    familiar: {
      type: 'boolean',
      description:
        'True only if you found or already had real information about this specific site. False when you found little or nothing, even if you can guess from the name.',
    },
    basis: {
      type: 'string',
      enum: ['search_results', 'prior_knowledge', 'name_inference', 'none'],
      description:
        'Where your answer actually comes from: pages you found searching, knowledge you already had, a guess from the domain name alone, or nothing at all.',
    },
    answer: {
      type: 'string',
      description:
        'Your answer to the question, two to four sentences, exactly as you would give it to the person asking. "I could not find much about this site" is a complete and correct answer.',
    },
    sources: {
      type: 'array',
      description: 'URLs you actually consulted. Empty array when none.',
      items: { type: 'string' },
    },
  },
  required: ['familiar', 'basis', 'answer', 'sources'],
  additionalProperties: false,
};

// The monthly experiment proposal. One change at most, stated precisely
// enough to apply and falsify; no_change is a first-class outcome so the
// model is never pushed to invent churn.
export const EXPERIMENT = {
  type: 'object',
  properties: {
    prior_result: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          enum: ['supported', 'refuted', 'inconclusive', 'no_prior'],
          description:
            'Judge the most recent prior experiment against the newest recognition results. "no_prior" when there is no earlier experiment to judge.',
        },
        explanation: {
          type: 'string',
          description: 'One or two sentences citing what in the recognition log supports the verdict. Empty string when no_prior.',
        },
      },
      required: ['verdict', 'explanation'],
      additionalProperties: false,
    },
    observation: {
      type: 'string',
      description: 'What the recognition log currently shows, in one or two sentences.',
    },
    hypothesis: {
      type: 'string',
      description: 'The falsifiable claim this month tests, e.g. "if X changes, model Y stops citing Z".',
    },
    no_change: {
      type: 'boolean',
      description:
        'True when the right move is to change nothing, for example while a prior change has not yet been observed by a fresh crawl.',
    },
    change: {
      type: 'object',
      properties: {
        surface: {
          type: 'string',
          enum: ['title', 'meta_description', 'faq', 'llms_txt', 'hero', 'other'],
          description: 'Which crawler-facing surface to change. "other" only with a precise location in rationale.',
        },
        current_text: { type: 'string', description: 'The exact current text. Empty string when no_change.' },
        proposed_text: { type: 'string', description: 'The exact replacement text. Empty string when no_change.' },
        rationale: { type: 'string', description: 'Why this change, in one or two sentences. Empty string when no_change.' },
      },
      required: ['surface', 'current_text', 'proposed_text', 'rationale'],
      additionalProperties: false,
    },
    expected_signal: {
      type: 'string',
      description: 'What next month\'s recognition log should show if the hypothesis holds.',
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['prior_result', 'observation', 'hypothesis', 'no_change', 'change', 'expected_signal', 'confidence'],
  additionalProperties: false,
};
