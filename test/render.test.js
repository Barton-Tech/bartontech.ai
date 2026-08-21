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

test('recognitionCards escapes model-supplied text', () => {
  const html = recognitionCards({
    results: [{ label: 'X', model: 'm', familiar: false, basis: 'none', answer: '<script>alert(1)</script>', sources: [] }],
  });
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
