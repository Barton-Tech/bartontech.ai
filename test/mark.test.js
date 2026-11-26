import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal } from '../src/mark/crypto.js';
import { handleMark } from '../src/mark/worker.js';
import shipped from '../src/mark/sealed.js';

const PAGE = '<!DOCTYPE html><p>secret deck</p>';
const sealed = await seal(PAGE, 'right-pass');
const req = (path, init) => new Request(`https://bartontech.ai${path}`, init);
const post = (pw) => req('/mark', { method: 'POST', body: new URLSearchParams({ password: pw }) });

test('shipped blob is ciphertext, not the page', () => {
  assert.equal(shipped.v, 1);
  assert.ok(shipped.data.length > 1000);
  assert.ok(!JSON.stringify(shipped).includes('Thumbtack'));
});

test('no cookie shows the login form, not the page', async () => {
  const res = await handleMark(req('/mark'), sealed);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.match(body, /type="password"/);
  assert.ok(!body.includes('secret deck'));
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
});

test('wrong password is refused', async () => {
  const res = await handleMark(post('nope'), sealed);
  assert.equal(res.status, 401);
  assert.match(await res.text(), /didn't work/);
  assert.equal(res.headers.get('Set-Cookie'), null);
});

test('right password sets a scoped cookie that unlocks the page', async () => {
  const res = await handleMark(post('right-pass'), sealed);
  assert.equal(res.status, 303);
  const cookie = res.headers.get('Set-Cookie');
  assert.match(cookie, /^mark_k=[\w-]+; Path=\/mark; .*HttpOnly; Secure; SameSite=Lax$/);
  const page = await handleMark(req('/mark', { headers: { Cookie: cookie.split(';')[0] } }), sealed);
  assert.equal(await page.text(), PAGE);
});

test('a forged cookie falls back to the login form', async () => {
  const res = await handleMark(req('/mark', { headers: { Cookie: 'mark_k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } }), sealed);
  assert.match(await res.text(), /type="password"/);
});

test('subpaths redirect to /mark', async () => {
  const res = await handleMark(req('/mark/'), sealed);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), '/mark');
});
