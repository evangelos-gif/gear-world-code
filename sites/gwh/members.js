// GWH-MEMBERS (lessons L90): the one member list of the Gear World network, in the Hub's D1 (hub_subscribers).
// - The 12 sites send their "Get deal updates" sign-ups here, ONLY through their service binding HUB: the address
//   https://hub.internal/... is never reachable from the internet (no route has this host name).
// - People who gave marketing consent are copied to MailerLite (the only place the MailerLite key is kept is the Hub's
//   secret MAILERLITE_TOKEN). New sign-ups go to the group "Gear World" (its automation sends the welcome email);
//   members who were already there before (Rewards, the first Hub sign-ups) go to "Gear World existing members", which
//   has no automation. Nothing is ever sent by this code: MailerLite sends only what the owner set up there.
// - No IP address arrives here: the site sends a one-way key of it, used only to limit attempts for one hour.

export const INTERNAL_HOST = 'hub.internal';
export const SITE_CODES = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];
export const CONSENT_VERSION = '2026-11-03-deal-updates';
export const RATE_LIMIT = 5; // sign-ups per visitor key and hour
export const ML_API = 'https://connect.mailerlite.com/api';
export const GROUP_NEW = 'Gear World';
export const GROUP_EXISTING = 'Gear World existing members';
export const MAX_TRIES = 5;

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

// POST https://hub.internal/internal/subscribe { email, consent, site, page, client } from a site's Worker.
export async function handleInternal(request, env, ctx, { now = Date.now(), fetchFn = fetch } = {}) {
  const url = new URL(request.url);
  if (url.pathname !== '/internal/subscribe' || request.method !== 'POST') return json({ ok: false, error: 'not_found' }, 404);
  const db = env.gear_world_registry;
  if (!db) return json({ ok: false, error: 'no_database' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400); }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const site = String((body && body.site) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
  if (!SITE_CODES.includes(site)) return json({ ok: false, error: 'site' }, 400);
  if (!body || body.consent !== true) return json({ ok: false, error: 'consent_required' }, 400);
  const key = /^[0-9a-f]{16,64}$/.test(String(body.client || '')) ? String(body.client) : 'unknown';
  try {
    if (!(await allowed(db, `${site}:${key}`, now))) return json({ ok: false, error: 'too_many' }, 429);
    await db.prepare(`INSERT INTO hub_subscribers (email, locale, marketing_consent, consent_version, source, status, site, member_source)
      VALUES (?, 'en-GB', 1, ?, 'site-form', 'active', ?, ?)
      ON CONFLICT (email) DO UPDATE SET marketing_consent = 1, consent_version = excluded.consent_version, status = 'active',
        site = COALESCE(hub_subscribers.site, excluded.site), updated_at = CURRENT_TIMESTAMP,
        mailerlite_status = CASE WHEN hub_subscribers.marketing_consent = 1 AND hub_subscribers.mailerlite_status = 'ok' THEN 'ok' ELSE NULL END,
        mailerlite_tries = 0`)
      .bind(email, CONSENT_VERSION, site, `site-form:${site}`).run();
  } catch (e) {
    console.error('member sign-up failed:', e && e.message);
    return json({ ok: false, error: 'subscribe_failed' }, 500);
  }
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(syncMailerLite(env, { limit: 5, fetchFn }));
  return json({ ok: true });
}

async function ml(fetchFn, token, method, path, body) {
  const res = await fetchFn(ML_API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const what = res.status === 401 ? 'the MailerLite key was refused' : res.status === 429 ? 'MailerLite rate limit' : `MailerLite answered ${res.status}`;
    throw new Error(what);
  }
  return data;
}

const groupCache = new Map();
export function resetGroupCache() { groupCache.clear(); }

// The id of a MailerLite group by its name; the group is made when it does not exist yet.
export async function groupId(fetchFn, token, name) {
  if (groupCache.has(name)) return groupCache.get(name);
  const found = await ml(fetchFn, token, 'GET', `/groups?limit=50&filter[name]=${encodeURIComponent(name)}`);
  let g = found && Array.isArray(found.data) ? found.data.find(x => x && x.name === name) : null;
  if (!g) {
    const made = await ml(fetchFn, token, 'POST', '/groups', { name });
    g = made && made.data;
  }
  if (!g || !g.id) throw new Error(`MailerLite group "${name}" not found or made`);
  groupCache.set(name, String(g.id));
  return String(g.id);
}

// Copies to MailerLite the members with marketing consent that are not there yet (or failed before). Never throws.
export async function syncMailerLite(env, { limit = 50, fetchFn = fetch, nowIso = new Date().toISOString() } = {}) {
  const db = env && env.gear_world_registry;
  const token = String((env && env.MAILERLITE_TOKEN) || '').trim();
  const out = { tried: 0, ok: 0, failed: 0, message: '' };
  if (!db) return { ...out, message: 'no database' };
  if (!token) return { ...out, message: 'no MailerLite key yet' };
  let rows;
  try {
    rows = (await db.prepare(`SELECT id, email, site, first_name, mailerlite_group FROM hub_subscribers
      WHERE marketing_consent = 1 AND status = 'active' AND (mailerlite_status IS NULL OR mailerlite_status = 'error')
        AND mailerlite_tries < ? ORDER BY id LIMIT ?`).bind(MAX_TRIES, limit).all()).results || [];
  } catch (e) {
    return { ...out, message: 'list not read: ' + String(e && e.message || e).slice(0, 120) };
  }
  for (const r of rows) {
    out.tried++;
    try {
      const gid = await groupId(fetchFn, token, r.mailerlite_group === 'existing' ? GROUP_EXISTING : GROUP_NEW);
      const fields = {};
      if (r.first_name) fields.name = String(r.first_name).slice(0, 60);
      await ml(fetchFn, token, 'POST', '/subscribers', { email: r.email, groups: [gid], fields });
      await db.prepare("UPDATE hub_subscribers SET mailerlite_status = 'ok', mailerlite_synced_at = ?, mailerlite_tries = mailerlite_tries + 1 WHERE id = ?").bind(nowIso, r.id).run();
      out.ok++;
    } catch (e) {
      out.failed++;
      out.message = String(e && e.message || e).slice(0, 160).split(token).join('[key]');
      try { await db.prepare("UPDATE hub_subscribers SET mailerlite_status = 'error', mailerlite_tries = mailerlite_tries + 1 WHERE id = ?").bind(r.id).run(); } catch { /* next time */ }
      if (/refused|rate limit/.test(out.message)) break;
    }
  }
  return out;
}
