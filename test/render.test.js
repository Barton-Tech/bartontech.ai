import test from 'node:test';
import assert from 'node:assert/strict';
import { noEmDash, normalizeSolution, siteNav, recognitionCards, renderAnswers } from '../src/lib/render.js';

test('noEmDash: first dash becomes a colon, later ones commas', () => {
  assert.equal(noEmDash('One — two — three.'), 'One: two, three.');
});

test('noEmDash: the colon resets per sentence', () => {
  assert.equal(noEmDash('A — b. C — d.'), 'A: b. C: d.');
});

test('noEmDash: text without em dashes passes through untouched', () => {
  const s = 'Plain text, with: punctuation.';
  assert.equal(noEmDash(s), s);
});

test('normalizeSolution: old single-format shape gains a formats array', () => {
  const norm = normalizeSolution({ date: 'd', format: { id: 'x' }, answers: [{ a: 1 }] });
  assert.equal(norm.formats.length, 1);
  assert.equal(norm.defaultId, 'x');
});

test('normalizeSolution: formats with no answers are dropped, default falls back', () => {
  const norm = normalizeSolution({
    default_format: 'a',
    formats: [
      { format: { id: 'a' }, answers: [] },
      { format: { id: 'b' }, answers: [{}] },
    ],
  });
  assert.equal(norm.formats.length, 1);
  assert.equal(norm.defaultId, 'b');
});

test('normalizeSolution: nothing usable returns null', () => {
  assert.equal(normalizeSolution(null), null);
  assert.equal(normalizeSolution({ formats: [{ format: { id: 'a' }, answers: [] }] }), null);
});

test('siteNav marks the exact page and the archive section', () => {
  assert.match(siteNav('/archive/'), /href="\/archive\/" aria-current="page"/);
  assert.match(siteNav('/days/2026-08-19/'), /href="\/archive\/" aria-current="true"/);
  assert.match(siteNav('/'), /href="\/" aria-current="page"/);
  assert.doesNotMatch(siteNav('/404'), /aria-current/);
});

test('recognitionCards escapes model-supplied text and sorts by label', () => {
  const html = recognitionCards({
    results: [
      { label: 'X', model: 'm', familiar: false, basis: 'none', answer: '<script>alert(1)</script>', sources: [] },
      { label: 'A', model: 'm', familiar: false, basis: 'none', answer: 'plain', sources: [] },
    ],
  });
  assert.ok(html.indexOf('>A<') < html.indexOf('>X<'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('pseudocode panels render as code, haiku as verse, prose as neither', () => {
  const ans = [{ label: 'M', model: 'm', approach: 'x', first_move: 'f', hardest_part: 'h', confidence: 'low' }];
  const sol = (id) => ({ date: 'd', problem: { canonical_name: 'p' }, formats: [{ format: { id, label: id }, answers: ans }] });
  assert.match(renderAnswers(sol('pseudocode')), /answer__body answer__body--code/);
  assert.match(renderAnswers(sol('haiku')), /answer__body answer__body--verse/);
  assert.doesNotMatch(renderAnswers(sol('cmo-memo')), /answer__body--/);
});

test('renderAnswers multi-format: radios, pills, checked default, linked date', () => {
  const ans = (t) => [
    { label: 'Z', model: 'm', approach: t, first_move: 'f', hardest_part: 'h', confidence: 'low' },
    { label: 'M', model: 'm', approach: t, first_move: 'f', hardest_part: 'h', confidence: 'low' },
  ];
  const sol = {
    date: '2026-08-20', problem: { plain: 'pp', canonical_name: 'P' }, default_format: 'b',
    formats: [{ format: { id: 'a', label: 'A' }, answers: ans('x') }, { format: { id: 'b', label: 'B' }, answers: ans('y') }],
  };
  const html = renderAnswers(sol, { linkDate: true });
  assert.ok(html.includes('id="fmt-b" checked'));
  assert.ok(html.includes('fmt-bar') && html.includes('href="/days/2026-08-20/"'));
  assert.ok(renderAnswers(null).includes('Collecting'));
});

test('page shells: head block, subshell, footer and breadcrumbs', async () => {
  const { headBlock, subShell, siteFooter, breadcrumbLd, questionLd, problemLd, PAGE_CSS, FAVICON } = await import('../src/lib/render.js');
  const head = headBlock({ title: 'T', description: 'D', path: '/x/', jsonLd: '{"a":1}' });
  assert.ok(head.includes('<title>T</title>') && head.includes('application/ld+json'));
  assert.ok(!headBlock({ title: 'T', description: 'D', path: '/x/', jsonLd: null }).includes('application/ld+json'));
  const shell = subShell({ title: 'T', description: 'D', path: '/x/', eyebrow: 'E', heading: 'H', deck: 'DK', body: 'B', jsonLd: null });
  assert.ok(shell.includes('<p class="subpage__deck">DK</p>') && shell.includes('aria-label="Site"'));
  assert.ok(!subShell({ title: 'T', description: 'D', path: '/x/', eyebrow: 'E', heading: 'H', body: 'B', jsonLd: null }).includes('<p class="subpage__deck">'));
  assert.ok(siteFooter().includes('Orchestrated by'));
  const ld = JSON.parse(breadcrumbLd([{ name: 'A', path: '/' }, { name: 'B', path: '/b/' }]));
  assert.equal(ld['@graph'][0].itemListElement.length, 2);
  const q = questionLd({
    date: 'd', problem: { plain: 'pp', canonical_name: 'P' }, default_format: 'a',
    formats: [
      { format: { id: 'a', label: 'A' }, answers: [
        { label: 'M', model: 'm', approach: 'body', first_move: 'f', hardest_part: 'h', confidence: 'low' },
        { label: 'B', model: 'm', approach: 'body2', first_move: 'f', hardest_part: 'h', confidence: 'low' },
      ] },
      { format: { id: 'b', label: 'B' }, answers: [{ label: 'M', model: 'm', approach: 'other', first_move: 'f', hardest_part: 'h', confidence: 'low' }] },
    ],
  });
  assert.ok(q.suggestedAnswer[0].text.startsWith('[Format: A]'));
  const single = questionLd({ date: 'd', problem: { canonical_name: 'P' }, format: { id: 'a', label: 'A' }, answers: [{ label: 'M', model: 'm', approach: 'solo', first_move: 'f', hardest_part: 'h', confidence: 'low' }] });
  assert.equal(single.suggestedAnswer[0].text, 'solo');
  const p = problemLd({ canonical_name: 'N', definition: 'D' }, '/problems/n/');
  assert.deepEqual(p.alternateName, []);
  assert.ok(PAGE_CSS.includes('#fmt-haiku:checked') && FAVICON.startsWith('data:image/svg'));
});

test('recognitionCards trims long sources and counts the overflow', async () => {
  const { recognitionCards } = await import('../src/lib/render.js');
  const long = `https://example.com/${'a'.repeat(90)}`;
  const html = recognitionCards({
    results: [{ label: 'X', model: 'm', familiar: true, basis: 'search_results', answer: 'a', sources: [long, 'u2', 'u3', 'u4', 'u5'] }],
  }, { sources: true });
  assert.ok(html.includes('...') && html.includes('and 1 more'));
  assert.ok(!html.includes('a'.repeat(85)));
});
