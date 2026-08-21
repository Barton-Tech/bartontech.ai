import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, paths, readJSON, writeJSON, exists, listJSON, provenance, log } from '../src/lib/io.js';

test('paths resolve under the repo root', () => {
  assert.ok(paths.config('models.json').startsWith(ROOT));
  for (const p of [paths.data('x'), paths.registry(), paths.tracker('d'), paths.anchor('d'), paths.index('m'), paths.batch('d'), paths.dist('f')]) {
    assert.ok(p.startsWith(ROOT));
  }
});

test('readJSON falls back only on a missing file', () => {
  assert.deepEqual(readJSON('/nonexistent/x.json', { a: 1 }), { a: 1 });
  assert.throws(() => readJSON('/nonexistent/x.json'));
});

test('writeJSON round-trips and listJSON filters and sorts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-test-'));
  writeJSON(path.join(dir, 'b.json'), { v: 2 });
  writeJSON(path.join(dir, 'a.json'), { v: 1 });
  fs.writeFileSync(path.join(dir, 'ignore.txt'), 'x');
  assert.equal(exists(path.join(dir, 'a.json')), true);
  assert.deepEqual(listJSON(dir), ['a.json', 'b.json']);
  assert.deepEqual(readJSON(path.join(dir, 'a.json')), { v: 1 });
  assert.deepEqual(listJSON(path.join(dir, 'missing')), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('provenance stamps version, samples and extras', () => {
  const p = provenance({ sampling: { prompt_version: 'v', samples_per_question: 3 } }, { model: 'm' });
  assert.equal(p.prompt_version, 'v');
  assert.equal(p.model, 'm');
  assert.equal(p.harness_version, 1);
});

test('log writes a timestamped line', () => {
  const orig = console.log;
  let line = '';
  console.log = (...a) => { line = a.join(' '); };
  try { log('hello'); } finally { console.log = orig; }
  assert.match(line, /^\[\d{4}.*hello$/);
});
