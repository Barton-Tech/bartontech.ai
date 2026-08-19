# bartontech.ai

The Martech problem index. See README.md for architecture and workflows.

## Rules that are load-bearing

- Data under `data/` is **append-only**. Never rewrite a stored run. Forced
  monthly reruns (`--force`) archive the prior version automatically.
- New canonical problems go to `registry.pending_review`, never straight into
  `registry.problems`. Promotion is a human decision; record it in review_log.
- Every problem needs `plain` (short gloss for the hero headline) and
  `plain_summary` (2-3 sentences, ~8th grade, for the hero deck). The build
  falls back to canonical_name/definition, but the fallbacks read worse.
- Bump `sampling.prompt_version` in config/models.json when prompt text in
  src/lib/prompts.js changes.
- `config/models.json` pricing must cover every model id in use; an unpriced
  model throws deliberately. Never delete old pricing entries: recorded spend
  is priced by the model that produced it.
- Model id changes ship as PRs via the weekly model-refresh workflow. Do not
  hand-edit ids without checking the provider still serves them.

## Site invariants

- Single theme; no dark mode, no toggle. The dark hero band is a design
  element with fixed 19:1 contrast, not a mode.
- The page ships **zero JavaScript**. Never move content into a client render
  path; the only script tag is JSON-LD.
- Zero axe violations in the built page, and re-measure contrast if any color
  token or surface changes; the measured pairs are listed in page-css.js.
- Hero copy targets 8th-grade reading level or below. Measure, don't eyeball
  (Flesch-Kincaid; the hero currently sits around grade 6).
- **No em dashes in anything the site authors** (page copy, llms.txt, FAQ,
  themes). The three model answers are quotations and render raw.
- FAQ content lives in `faqItems()` in src/lib/seo.js and feeds both the
  visible dl and the FAQPage JSON-LD; edit one place only. Answers must stand
  alone out of context.
- The JSON-LD ItemList must mirror the visible board; don't change one
  without the other.
- robots.txt allows AI crawlers by name. Do not "tidy" the list. After any
  Cloudflare settings change, re-check the LIVE robots.txt: the CDN once
  injected a managed block that disallowed the crawlers this site exists for.

## Provider constraints (verified against installed SDKs)

- OpenAI: both passes use the Responses API; web_search is Responses-only.
- Google: the search tool is `{ googleSearch: {} }`; grounding + response
  schema requires Gemini 3.x; adaptSchema strips additionalProperties.
- Anthropic: daily bulk work uses the Message Batches API when the tracker is
  active; web_search_20260209 needs Sonnet 5 or above.
- Always merge provider citation metadata into sources; models under-report.

## Analytics

Deliberately dashboard-side (Cloudflare Web Analytics, auto-injected).
No analytics script belongs in the repo; its absence is not an oversight.
