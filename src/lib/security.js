// Turnstile verification, rate limiting and bot detection.

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// The whole Siteverify answer: { success, hostname, action, 'error-codes' }. Never throws; no token or no secret = not human.
// A token is single-use and valid for 5 minutes. The secret is sent only to Cloudflare, never logged.
export async function turnstileResult(token, secret, ip, fetchImpl) {
  const t = String(token || '');
  if (!t || t.length > 2048 || !secret) return { success: false, 'error-codes': ['missing-input'] };
  const body = new URLSearchParams({ secret: String(secret), response: t });
  if (ip) body.set('remoteip', String(ip));
  try {
    const r = await (fetchImpl || fetch)(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    const data = await r.json();
    return data && typeof data === 'object' ? data : { success: false };
  } catch {
    return { success: false, 'error-codes': ['network'] };
  }
}

export async function verifyTurnstile(token, secret, ip) {
  const data = await turnstileResult(token, secret, ip);
  return data.success === true;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fixed-window limit stored in D1. The client IP is hashed and never stored in clear.
export async function rateLimit(db, { route, client, limit, windowSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  const key = `${route}:${(await sha256Hex(`${client}|${route}`)).slice(0, 24)}:${window}`;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (rl_key, hits, expires_at) VALUES (?, 1, ?)
       ON CONFLICT(rl_key) DO UPDATE SET hits = hits + 1
       RETURNING hits`
    )
    .bind(key, (window + 1) * windowSeconds)
    .first();
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
  }
  return Number(row?.hits || 0) <= limit;
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|monitor|headless|curl|wget|python|java\/|go-http|httpclient|axios|node-fetch|scrapy|lighthouse/i;

export function isBot(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!ua) return true;
  if (BOT_UA.test(ua)) return true;
  const verified = request.cf && request.cf.botManagement && request.cf.botManagement.verifiedBot;
  return Boolean(verified);
}

// Comparison for tokens that does not tell how much of a guess was right (F16, 8/11/2026): both sides are turned into
// SHA-256 digests first, which always have the same length, and every byte of the digests is compared. The old version
// stopped at once when the lengths differed, so the time showed the length of the token.
export async function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  const enc = new TextEncoder();
  const [dx, dy] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(x)),
    crypto.subtle.digest('SHA-256', enc.encode(y))
  ]);
  const p = new Uint8Array(dx);
  const q = new Uint8Array(dy);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  // An empty side never matches (an unset token must not equal an empty header).
  return diff === 0 && x.length > 0 && y.length > 0;
}
