// Turnstile verification, rate limiting and bot detection.

export async function verifyTurnstile(token, secret, ip) {
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: String(token) });
  if (ip) body.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await r.json();
    return data && data.success === true;
  } catch {
    return false;
  }
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

// Constant-time comparison for tokens.
export function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
