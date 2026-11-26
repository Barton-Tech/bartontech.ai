// Worker for the unlisted, password-protected /mark page.
//
// wrangler.jsonc routes only /mark and /mark/* here (run_worker_first); every
// other path is served straight from dist/ as before, without invoking this
// script. The page itself is sealed in ./sealed.js (see seal.js for how to
// update it). On a correct password the derived key goes into an HttpOnly
// cookie scoped to /mark, and each visit decrypts the page with it.

import sealed from './sealed.js';
import { deriveKeyBytes, fromB64, fromB64url, openWithKey, toB64url } from './crypto.js';

const COOKIE = 'mark_k';
const MAX_AGE = 60 * 60 * 24 * 30;

const BASE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', ...extra } });
}

function redirect(location, extra = {}) {
  return new Response(null, { status: 303, headers: { ...BASE_HEADERS, Location: location, ...extra } });
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function loginPage(wrong = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#1D252B">
<title>Barton Tech | Private</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100svh;display:grid;place-items:center;background:#1D252B;color:#fff;font:17px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:24px}
main{width:100%;max-width:380px}
p.k{font:700 12px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#E0913F;margin:0 0 12px}
h1{font:900 28px/1.15 "Arial Black",Arial,sans-serif;margin:0 0 8px}
p{color:#B9C1C6;margin:0 0 24px}
label{display:block;font-weight:700;margin-bottom:8px}
input{width:100%;font-size:18px;padding:14px;border-radius:10px;border:2px solid #5C6870;background:#fff;color:#1D252B}
input:focus{outline:3px solid #E0913F;outline-offset:2px}
button{margin-top:14px;width:100%;font:700 18px Arial,sans-serif;padding:14px;border:0;border-radius:10px;background:#E0913F;color:#1D252B}
.err{color:#FFB4A8;font-weight:700;margin:12px 0 0}
</style>
</head>
<body>
<main>
<p class="k">Barton Tech</p>
<h1>Private case study</h1>
<p>Enter the password you were given to view this page.</p>
<form method="post" action="/mark">
<label for="pw">Password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
<button type="submit">Open</button>
${wrong ? '<p class="err" role="alert">That password didn\'t work. Please try again.</p>' : ''}
</form>
</main>
</body>
</html>`;
}

export async function handleMark(request, data = sealed) {
  const url = new URL(request.url);
  if (url.pathname !== '/mark') return redirect('/mark');

  if (request.method === 'POST') {
    const password = await request.formData().then((f) => String(f.get('password') || ''), () => '');
    const keyBytes = password ? await deriveKeyBytes(password, fromB64(data.salt), data.iterations) : null;
    if (!keyBytes || (await openWithKey(data, keyBytes)) === null) return html(loginPage(true), 401);
    return redirect('/mark', {
      'Set-Cookie': `${COOKIE}=${toB64url(keyBytes)}; Path=/mark; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { ...BASE_HEADERS, Allow: 'GET, HEAD, POST' } });
  }

  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    const page = await Promise.resolve()
      .then(() => openWithKey(data, fromB64url(cookie)))
      .catch(() => null);
    if (page !== null) return html(page);
  }
  return html(loginPage(false));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/mark' || pathname.startsWith('/mark/')) return handleMark(request);
    // Not expected (only /mark paths run this script first), but stay safe.
    return env.ASSETS.fetch(request);
  },
};
