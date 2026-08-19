# bartontech.ai · The Martech problem index

Two records, on a fixed schedule, never backfilled.

**Monthly:** ChatGPT, Claude and Gemini are asked what the martech industry's
hardest *unsolved* problems are. Their proposals are reconciled against a
canonical registry so one problem under three names does not become three
entries, and new entries queue for human review before they count.

**Daily:** one problem rotates off the board and all three models answer the
same question about it, in the same format: how would you attack this? Not how
to solve it. Everything on the board is unsolved, and a model asked to solve it
will invent a plan. The answers render side by side, raw.

**Daily, on top:** Claude reads the whole six-month record and maintains a set
of cross-cutting themes. A single-model synthesis, labeled as such on the page.

## The site

One page, fully server-rendered, zero JavaScript (the only script tag is
JSON-LD). Hero features the day's problem in plain language with the board
title beneath it; then the three answers; then the ranked board; then themes;
then a FAQ that generates both the visible text and the FAQPage structured
data from one source.

- Zero axe-core violations and zero incomplete checks across WCAG 2.x A/AA.
- Every text token measured above 4.5:1 on the surfaces it renders on.
- robots.txt allows AI crawlers by name; llms.txt regenerates each build.
- Structured data: WebSite, WebPage (speakable), Person, Dataset, FAQPage,
  ItemList (mirrors the visible board), Observation.

## Layout

```
config/
  models.json          providers, tiers, pricing, budget, sampling
  formats.json         the monthly answer-format rotation
  anchor.json          frozen questions for the dormant vendor tracker
  problems/*.json      question sets for the dormant vendor tracker
data/
  registry/problems.json   canonical problems: definitions, plain_summary,
                           aliases, review_log. Human-gated.
  index/YYYY-MM.json       monthly boards (archive/ holds forced-rerun priors)
  solutions/YYYY-MM-DD.json  the day's three answers
  themes/YYYY-MM-DD.json     Claude's daily theme synthesis
  tracker/, raw/, batches/   the stopped vendor tracker's series, preserved
src/
  monthly-index.js     panel + reconciliation (overwrite needs --force)
  daily-solutions.js   the day's answers; problem rotates daily, format monthly
  daily-themes.js      six-month synthesis, name-stable day to day
  model-refresh.js     weekly model/pricing check; ships changes as a PR
  submit-daily.js, collect-daily.js   dormant vendor tracker (spend-guarded)
  build-site.js        renders dist/ (works with empty data/)
```

## Workflows

| Workflow | Schedule | Does |
|---|---|---|
| daily answers | 06:10 UTC | solutions + themes, commits results |
| monthly problem index | 1st, 03:00 UTC | panel, reconciliation, review issue |
| weekly model refresh | Mon 05:00 UTC | verifies model ids against live provider lists; opens a PR when the lineup should change; urgent issue if a configured model was retired |
| keepalive | monthly | keeps schedules from being auto-disabled |
| daily submit | manual only | stopped 2026-08-19; resuming restores the cron |

Cost at current cadence: roughly $6/month.

## Design rules

These are load-bearing. Breaking one silently corrupts the record.

- **Append-only.** Never edit a stored run. Forced monthly reruns archive the
  prior version. The display may normalize; the data may not.
- **Registry changes are human-gated.** New canonical problems queue in
  pending_review. Promotion, merging and aliasing are editorial decisions.
- **Version the prompts.** sampling.prompt_version stamps every run.
- **One shared format per day.** Model answers are comparable only because
  style is held constant; the format rotates monthly, deterministically.
- **Model answers render raw.** House punctuation (no em dashes) applies to
  everything the site authors, including themes, but never to the quoted
  model responses.
- **Models change by PR, not silently.** The weekly refresh proposes; a human
  merges. Pricing feeds the spend guard, so unverified prices never land.
