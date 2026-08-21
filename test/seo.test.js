import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE, TITLE, DESCRIPTION, NAV_ITEMS, ROBOTS, llmsTxt, sitemap, structuredData, faqItems } from '../src/lib/seo.js';

test('robots welcomes AI crawlers by name and points at the sitemap', () => {
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) assert.ok(ROBOTS.includes(bot));
  assert.ok(ROBOTS.includes(`${SITE}/sitemap.xml`));
});

test('llmsTxt covers multi-format, single-format and empty days', () => {
  const base = { month: '2026-08', topProblem: 'P', topPlain: 'plain p', days: 2, months: 1, archive: '- x' };
  const multi = llmsTxt({ ...base, solution: { date: 'd', problem: { canonical_name: 'P' }, formats: [{ format: { label: 'A' }, answers: [{ label: 'M' }] }, { format: { label: 'B' }, answers: [{ label: 'M' }] }] } });
  assert.ok(multi.includes('in 2 formats'));
  const single = llmsTxt({ ...base, solution: { date: 'd', problem: { canonical_name: 'P' }, format: { label: 'A' }, answers: [{ label: 'M' }] } });
  assert.ok(single.includes('in the format "A"'));
  const empty = llmsTxt({ month: null, topProblem: null, topPlain: null, days: 0, months: 0, solution: null });
  assert.ok(empty.includes('pending the first monthly index'));
  assert.ok(empty.includes('first daily answers land'));
  assert.ok(!empty.includes('## Archive'));
});

test('sitemap honors per-url lastmod and appends fixed endpoints', () => {
  const xml = sitemap({ lastmod: '2026-08-20', extra: [{ loc: `${SITE}/x/`, changefreq: 'weekly', priority: '0.5', lastmod: '2026-08-01' }] });
  assert.ok(xml.includes('<lastmod>2026-08-01</lastmod>'));
  assert.ok(xml.includes(`${SITE}/llms.txt`));
});

test('structuredData mirrors the board and carries the nav and person', () => {
  const faq = [{ q: 'Q?', a: 'A.' }];
  const full = JSON.parse(structuredData({ lastmod: 'd', faq, topProblem: 'P', board: [{ canonical_name: 'P' }] }));
  const types = full['@graph'].map((n) => n['@type']);
  for (const t of ['WebSite', 'WebPage', 'Person', 'Dataset', 'FAQPage', 'ItemList', 'Observation']) assert.ok(types.includes(t), t);
  const nav = full['@graph'].find((n) => n['@id']?.endsWith('#nav'));
  assert.deepEqual(nav.itemListElement.map((i) => i.name), NAV_ITEMS.map((n) => n.label));
  const person = full['@graph'].find((n) => n['@type'] === 'Person');
  assert.ok(person.alternateName.includes('Warren Jay Barton'));
  const bare = JSON.parse(structuredData({ lastmod: 'd', faq, topProblem: null, board: [] }));
  const bareTypes = bare['@graph'].flatMap((n) => n['@type']);
  assert.ok(!bareTypes.includes('Observation'));
});

test('faqItems stand alone with and without a live board', () => {
  const withTop = faqItems({ topProblem: 'P', topPlain: 'plain' });
  assert.ok(withTop[0].a.includes('P'));
  const without = faqItems({ topProblem: null, topPlain: null });
  assert.ok(!without[0].a.includes('null'));
  for (const item of without) {
    assert.ok(item.q.endsWith('?'));
    assert.ok(!item.a.includes('—'), 'faq answers carry no em dashes');
  }
  assert.ok(withTop.some((i) => i.q === 'Does the site improve itself?'));
});

test('title and description carry the site identity', () => {
  assert.ok(TITLE.toLowerCase().includes('martech'));
  assert.ok(DESCRIPTION.includes('ChatGPT'));
});
