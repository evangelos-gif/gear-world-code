// GWH-MEMBERS (lessons L92): "Get deal updates" of the Gear World sites, into the one member list of the Hub.
// - The sites send their sign-ups here ONLY through their service binding HUB: the address https://hub.internal/...
//   is never reachable from the internet (no route has this host name).
// - A sign-up is written into hub_subscribers exactly like a sign-up on the Hub form (mailerlite.js, Gear World email
//   step 5): ml_status 'pending', source = the site code (MailerLite field source_site). mailerlite.js then adds it to
//   MailerLite (group "Gear World subscribers") right away, and its cron tries again every 10 minutes. This file never
//   talks to MailerLite itself, so there is one way to MailerLite and one key (MAILERLITE_API_KEY).
// - No IP address arrives here: the site sends a one-way key of it, used only to limit attempts (5 an hour).
// - The Rewards members of the older sites were added by tools/hub-members.ps1 with ml_status 'hold': they go to
//   MailerLite only with the owner's approval (email step 6), like the first Hub sign-ups.
// - Security fixes of 8/11/2026 (F02, F03, lessons L106, security.js): every sign-up carries the Turnstile token of the
//   site's box; the Hub checks it with the secret key of that site's widget, for that site's hostname and the form
//   "deal-updates" (no token, or a bad one: nothing is written). The network's daily sign-up limit counts here too.
//   POST https://hub.internal/internal/ai-slot gives the sites one place of the daily limit of translation-model calls.
import { syncOne, dailySignupGate } from './mailerlite.js';
import { checkToken, takeNetworkSlot, readLimit, SITE_DOMAINS, SITE_ACTION, DEFAULT_TRANSLATE_DAILY_LIMIT } from './security.js';

export const INTERNAL_HOST = 'hub.internal';
export const SITE_CODES = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];
export const CONSENT_VERSION = '2026-11-03-deal-updates';
export const RATE_LIMIT = 5; // sign-ups per site, visitor key and hour

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export function isInternal(url) {
  return url.hostname === INTERNAL_HOST;
}

async function allowed(db, key, now) {
  const hour = Math.floor(now / 3600000);
  const k = `${key}:${hour}`;
  const row = await db.prepare(
    'INSERT INTO member_rate (rl_key, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT (rl_key) DO UPDATE SET hits = hits + 1 RETURNING hits'
  ).bind(k, (hour + 2) * 3600).first();
  // Old windows are removed now and then (one in ten requests).
  if (Math.random() < 0.1) await db.prepare('DELETE FROM member_rate WHERE expires_at < ?').bind(Math.floor(now / 1000)).run();
  return !row || Number(row.hits) <= RATE_LIMIT;
}

// POST https://hub.internal/internal/ai-slot { site }: one place of the network's daily limit of calls to the translation
// models (F03). { ok: false } when the day is full or the counter cannot be read: the site then searches without
// translation. The Hub's own translations count against the same limit (worker.js).
export async function aiSlot(env, now = new Date()) {
  const db = env && env.gear_world_registry;
  if (!db) return false;
  const limit = readLimit(env.TRANSLATE_DAILY_LIMIT, DEFAULT_TRANSLATE_DAILY_LIMIT, 1000000);
  try { return await takeNetworkSlot(db, now, 'translate', limit); } catch { return false; }
}

// POST https://hub.internal/internal/subscribe { email, consent, site, page, client, turnstile_token } from a site's Worker.
export async function handleInternal(request, env, ctx, { now = Date.now(), sync = syncOne, verify } = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/internal/ai-slot' && request.method === 'POST') {
    const ok = await aiSlot(env, new Date(now));
    return json(ok ? { ok: true } : { ok: false, error: 'limit_day' }, ok ? 200 : 429);
  }
  if (url.pathname !== '/internal/subscribe' || request.method !== 'POST') return json({ ok: false, error: 'not_found' }, 404);
  const db = env.gear_world_registry;
  if (!db) return json({ ok: false, error: 'no_database' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400); }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const site = String((body && body.site) || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (!SITE_CODES.includes(site)) return json({ ok: false, error: 'site' }, 400);
  if (!body || body.consent !== true) return json({ ok: false, error: 'consent_required' }, 400);
  const key = /^[0-9a-f]{16,64}$/.test(String(body.client || '')) ? String(body.client) : 'unknown';
  // Turnstile (F02): the token of the site's box, for that site's hostname and form. The site never sends the IP.
  const token = String((body && body.turnstile_token) || '').trim();
  if (!token) return json({ ok: false, error: 'turnstile_required' }, 403);
  const check = await checkToken(env, token, { domain: SITE_DOMAINS[site], action: SITE_ACTION, verify });
  if (check === 'not_ready') return json({ ok: false, error: 'not_ready' }, 503);
  if (check !== 'ok') return json({ ok: false, error: 'turnstile_failed' }, 403);
  // The test address of the Hub answers but writes and sends nothing (like mailerlite.js).
  if (String(env.GWH_PREVIEW || '') === '1') return json({ ok: true, preview: true });
  try {
    if (!(await allowed(db, `${site}:${key}`, now))) return json({ ok: false, error: 'too_many' }, 429);
    const full = await dailySignupGate(db, new Date(now), env);
    if (full) return full;
    await db.prepare(`INSERT INTO hub_subscribers (email, locale, marketing_consent, consent_version, source, status, ml_status, ml_attempts, ml_error, site, member_source)
      VALUES (?, 'en-GB', 1, ?, ?, 'active', 'pending', 0, NULL, ?, ?)
      ON CONFLICT (email) DO UPDATE SET marketing_consent = 1, consent_version = excluded.consent_version, source = excluded.source,
        status = 'active', ml_status = 'pending', ml_attempts = 0, ml_error = NULL,
        site = COALESCE(hub_subscribers.site, excluded.site), updated_at = CURRENT_TIMESTAMP`)
      .bind(email, CONSENT_VERSION, site, site, `site-form:${site}`).run();
  } catch (e) {
    console.error('member sign-up failed:', String((e && e.message) || e).replace(/[^\s@]+@[^\s@]+/g, '[email]'));
    return json({ ok: false, error: 'subscribe_failed' }, 500);
  }
  // MailerLite in the background (mailerlite.js): a failure only leaves the row 'pending' for the cron.
  const work = Promise.resolve().then(() => sync(env, email)).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work); else await work;
  return json({ ok: true });
}
