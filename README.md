# bartontech.ai — the martech problem index

Two questions, asked on a schedule and never backfilled.

**Monthly:** three frontier models are asked what the martech industry's hardest
*unsolved* problem is. Their answers are reconciled against a canonical registry
so the same problem under three names does not become three entries.

**Daily:** the same three models are asked who leads, both for a fixed anchor
question set and for whichever problem currently tops the board. Mention share,
rank, sentiment, citation sources, and cross-model agreement are recorded.

The asset is the accumulation. A record of how the industry's attention moved,
month by month, alongside how brand visibility inside AI answers moved with it,
is not something a competitor can start collecting retroactively.

## Architecture

Three layers, deliberately separated so a rotating subject does not destroy the
history:

| Layer | Cadence | Rotates? | Purpose |
|---|---|---|---|
| Problem Index | monthly | the board rotates | What the industry cannot solve |
| Tracker | daily | follows the board | Who leads in the current top problem |
| Anchor | daily | **never** | The continuity spine |

The anchor question set is frozen. Editing it breaks the only thing it exists to
provide. To ask something new, add a problem template under `config/problems/`.

## Layout

```
config/
  models.json          model id per provider per tier, sampling settings
  anchor.json          the frozen question set
  problems/*.json      per-problem question sets and entity lists
data/
  registry/problems.json   canonical problems + pending_review queue
  index/YYYY-MM.json       monthly board, proposals, reconciliation
  tracker/YYYY-MM-DD.json  daily aggregates
  raw/YYYY-MM-DD.json      raw model responses, kept for re-derivation
  batches/*.json           in-flight batch handles
src/
  submit-daily.js      stage 1: build + submit (Batches API) + backfill
  collect-daily.js     stage 2: poll, aggregate, commit
  monthly-index.js     panel + reconciliation
  build-site.js        renders dist/index.html
```

## Setup

```bash
npm install
```

1. Fill in the `REPLACE_ME` model ids in `config/models.json` for OpenAI and
   Google. Anthropic's are current. Set `enabled: false` for any provider you
   are not using yet.
2. Add repository secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `GOOGLE_API_KEY`.
3. Set a hard spend cap in each provider's console. An unattended daily loop
   without a ceiling is the one way this becomes expensive.
4. Point the domain at Cloudflare Pages, build command `npm run build`, output
   directory `dist`.

All three providers run a real web-grounded pass. Anthropic uses the
`web_search_20260209` tool, OpenAI the Responses API `web_search` tool, and
Google Search grounding. Every response records `grounded_actual`, so a pass
that silently failed to search is visible in the data rather than being
averaged in as if it had.

Two provider-specific constraints are load-bearing:

- **OpenAI grounding is Responses-API only.** Chat Completions can only reach
  web search through separate specialised search models, which are not the
  models configured here, so both passes use `/v1/responses`.
- **Google grounding plus a response schema needs Gemini 3.** The two are
  mutually exclusive on older models. Every id in `config/models.json` is on
  the 3.x line; moving one back would break the grounded pass.

Citations are merged from two places on every provider: whatever the model
reported inside the schema, plus the provider's own citation metadata
(`url_citation` annotations on OpenAI, `groundingMetadata.groundingChunks` on
Google). Models under-report their own sources, so trusting only the schema
field loses most of them.

## Cost

Daily Anthropic work runs through the Message Batches API: a flat 50% discount,
and latency is irrelevant for a once-a-day job. Roughly $10-12/month for
Anthropic at the default sampling, using Haiku 4.5 for bulk ungrounded sampling,
Sonnet 5 for the grounded pass (the current web-search tool requires Sonnet 5 or
above), and Opus 5 for the monthly index and reconciliation.

Turn it down by lowering `sampling.samples_per_question`. Turn it up by moving
the grounded pass to `claude-opus-5`.

## Accessibility and discoverability

The site measures how legible brands are to answer engines, so it has to be
exemplary at the thing it measures. Both properties are verified, not assumed.

- **Zero axe-core violations** in light and dark, across `wcag2a`, `wcag2aa`,
  `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` (43 rule groups pass).
  Re-run it after any visual change: load axe in the browser console against a
  built page and call `axe.run()`.
- **Every text token clears WCAG AA (4.5:1).** The palette's muted gray
  (`#898781`) measures 3.50:1 on the light surface and is darkened to `#6f6d69`
  (5.03:1); links use blue ramp step 500 (`#256abf`, 5.26:1) rather than the
  categorical slot-1 blue, which measures 4.30:1.
- **Charts have full keyboard parity.** Each plot is focusable; arrow keys walk
  the series, Escape dismisses. Every chart also ships a legend and a table
  view, which is what discharges the relief rule for the light-mode series
  colors that sit below 3:1.
- **Nothing depends on JavaScript.** The page is fully server-rendered:
  ~1,500 words and every number are present in the raw HTML.
- **AI crawlers are welcomed by name** in `robots.txt` (GPTBot, ClaudeBot,
  Google-Extended, PerplexityBot and the rest). A site about AI-answer
  visibility that blocked them would be absurd.
- **`llms.txt`** points an assistant at the current state, the data endpoints,
  and the method, and is regenerated on every build with live figures.
- **JSON-LD** describes the site as a `Dataset` with `variableMeasured`,
  `measurementTechnique` and `distribution`, plus `FAQPage`, `Person` and
  `WebSite`. The FAQ markup and the on-page FAQ are generated from one source,
  so they cannot drift apart.
- **`/data/latest.json`** is a stable machine-readable snapshot, linked from
  the page, the sitemap and llms.txt.

The FAQ answers are written to stand alone when an answer engine lifts one out
of the page: no pronouns pointing at other answers, no "as described above".
That is the single highest-leverage AEO tactic on the site, and it doubles as
the site's own demonstration of it.

## Design rules

These are load-bearing. Breaking one silently corrupts the series.

- **Append-only.** Never edit a stored run. Raw responses are kept next to the
  parsed extraction so an improved parser can re-derive history.
- **Version the prompts.** `sampling.prompt_version` is stamped on every run.
  A share-of-voice number is meaningless without knowing which prompt produced
  it; annotate the charts wherever it changes.
- **Record exact model ids.** When a model version ships, the numbers step-change.
  That is not noise to hide, it is the most interesting thing on the site.
- **Sample, do not single-shot.** Three samples per question with a variance
  band. One sample reported to two decimals is not credible and a practitioner
  audience will notice.
- **Canonicalize aggressively.** The reconciliation step exists because
  "AEO", "GEO", and "LLM visibility" are one problem. A registry that splits
  them produces a chart that fragments. New entries queue in `pending_review`
  and need a human before they count.
- **Label the grounding.** Parametric model knowledge lags by months. The
  ungrounded and web-grounded passes are stored separately and never merged;
  the gap between them is itself a metric.

## Local development

```bash
npm run check            # syntax check every entrypoint
npm run build            # renders dist/ from whatever is in data/
npm run submit:daily     # needs API keys
npm run collect:daily
npm run index:monthly    # optionally: node src/monthly-index.js 2026-08
```

`npm run build` works with an empty `data/` and produces a live page with empty
chart frames, so the site can go up before the first run lands.
