// Shared by the Worker and the seal script. WebCrypto only, so the same code
// runs on Cloudflare Workers and in Node 22.
//
// The deck is stored as AES-GCM ciphertext. The key is derived from the
// password with PBKDF2, so the repo (which is public) holds neither the
// password nor the plaintext. A wrong password fails GCM authentication.

// Cloudflare Workers caps PBKDF2 at 100,000 iterations.
export const ITERATIONS = 100000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function toB64url(bytes) {
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  return fromB64(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

export async function deriveKeyBytes(password, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
  return new Uint8Array(bits);
}

async function aesKey(keyBytes, usage) {
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [usage]);
}

export async function seal(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await deriveKeyBytes(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyBytes, 'encrypt'), enc.encode(plaintext));
  return { v: 1, iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
}

// Returns the plaintext, or null if the key is wrong or the blob is damaged.
export async function openWithKey(sealed, keyBytes) {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(sealed.iv) },
      await aesKey(keyBytes, 'decrypt'),
      fromB64(sealed.data),
    );
    return dec.decode(pt);
  } catch {
    return null;
  }
}
