# bartontech.ai

Daily and monthly measurement of AI-answer brand visibility. See README.md for
architecture.

## Rules that are load-bearing

- `config/anchor.json` questions are **frozen**. Never edit them. They are the
  continuity spine for a multi-year series; changing one silently invalidates
  every prior data point. New questions go in a `config/problems/*.json`
  template.
- Data files under `data/` are **append-only**. Never rewrite a stored run.
  If a parser bug is found, fix the parser and re-derive from `data/raw/`.
- Bump `sampling.prompt_version` in `config/models.json` whenever prompt text in
  `src/lib/prompts.js` changes. Charts annotate the changeover.
- New canonical problems go to `registry.pending_review`, never straight into
  `registry.problems`. Promotion is a human decision.

## Accessibility and AEO invariants

The site is its own proof of the thing it measures. Do not regress these:

- Zero axe-core violations in **both** themes. Re-run axe after any visual
  change; do not eyeball contrast.
- Text colors: `--text-muted` is `#6f6d69` in light mode (not the palette's
  `#898781`, which fails AA at 3.50:1). Links use `--link`, never `--series-1`.
- Every chart keeps its legend, its table view, and arrow-key navigation. The
  table view is load-bearing, not decoration: it is what discharges the relief
  rule for light-mode series colors below 3:1.
- The page must render completely without JavaScript. Never move content into
  a client-side render path.
- FAQ content lives in `faqItems()` in `src/lib/seo.js` and feeds both the
  JSON-LD and the visible `<dl>`. Edit it in one place so the two cannot drift.
- Write FAQ answers to stand alone out of context: no "as described above", no
  pronouns pointing at neighbouring answers.
- `robots.txt` allows AI crawlers by name. Do not "tidy" that list.

## Provider constraints

Verified against the installed SDK types, not from memory. Re-verify after any
SDK upgrade; the published docs and the SDK have disagreed before.

- OpenAI: `web_search` is a Responses-API tool. Both passes use
  `client.responses.create` with `text.format.type = 'json_schema'`. Chat
  Completions cannot do grounding on these models.
- Google: the tool is `{ googleSearch: {} }` (an SDK `Tool` member), not
  `{ type: 'google_search' }`. Config uses `responseMimeType` plus
  `responseSchema`. Grounding combined with a schema requires Gemini 3.x.
- Google's schema dialect rejects `additionalProperties`; `adaptSchema()`
  strips it. Do not remove that.
- Always merge provider citation metadata into `sources`. Models under-report
  their own citations, so the schema field alone loses most of them.

## Conventions

- ESM, Node 22+, no build step for the scripts.
- Zero runtime dependencies in the site build; charts are server-rendered
  inline SVG in `src/lib/charts.js`.
- Chart colors come from the validated categorical palette in
  `src/lib/page-css.js` (slots 1-6, fixed order, never cycled). Light-mode
  slots 3-5 are below 3:1 against the surface, so every chart ships a legend
  and a table view.
- Anthropic calls go through the official SDK. Daily work uses the Message
  Batches API for the 50% discount.
