// Gear World Hub - email sign-ups to MailerLite (Gear World email, step 5, November 2026).
//
// POST /api/subscribe (the Hub form, the Gear World app and, later, the sign-up box of the sites):
//   1. checks the address and the consent, and a fair-use limit per visitor (the IP address is never stored);
//   2. writes the sign-up into the Hub D1 (hub_subscribers) FIRST, with ml_status 'pending', so it is never lost;
//   3. then, in the background, adds it to MailerLite: group "Gear World subscribers", field source_site.
//      If MailerLite does not answer, the row stays 'pending' and the cron (every 10 minutes) tries again.
// Rows from before this change have ml_status 'hold': they go to MailerLite only with email step 6 (with approval).
// Unsubscribes happen in MailerLite (link in every email); MailerLite is the list that is sent to.
// On the test address (GWH_PREVIEW = "1") nothing is written and nothing is sent: the form only answers.
// The API key is the Worker secret MAILERLITE_API_KEY. Email addresses are never written to logs.
//
// Security fixes of 8/11/2026 (F02, lessons L07, L106, security.js):
//   - a browser (it always sends Origin) must send a Turnstile token, checked here with the secret key of widget 1,
//     for gearworldhub.com and the form "hub-signup"; no token or a bad one: nothing is written (403);
//   - a request without Origin and without a token is the Gear World app (it has no widget yet, and is not released):
//     it is allowed only within its own small daily limit (SUBSCRIBE_APP_DAILY_LIMIT, default 10, 0 = never), and it is
//     kept in the Hub D1 with ml_status 'hold', the existing state for sign-ups that go to MailerLite only with the
//     owner's approval (email step 6): never sent from here, never by the cron. An address already on the list is not
//     touched by such an unverified request. The app gets Turnstile later;
//   - all sign-ups of the network (this form, the app and the 13 sites through members.js) share one daily limit
//     (SUBSCRIBE_DAILY_LIMIT, default 50). When it is reached: 429 "limit_day", and the form says to try tomorrow.
//   - status "active" (no double opt-in) stays for now: the owner decides about double opt-in later.

import { visitorCode } from "./photo-search.js";
import {
  checkToken, takeNetworkSlot, readLimit, secondsToNextDay, HUB_ACTION,
  DEFAULT_SUBSCRIBE_DAILY_LIMIT, DEFAULT_APP_DAILY_LIMIT
} from "./security.js";

export const ML_API = "https://connect.mailerlite.com/api";
export const GROUP_NAME = "Gear World subscribers";
export const SOURCE_FIELD = "source_site";
export const CONSENT_VERSION = "2026-11-02";
export const OLD_CONSENT_VERSION = "2026-10-05";
export const HOURLY_LIMIT = 5;
export const RETRY_BATCH = 25;
export const MAX_ATTEMPTS = 288; // every 10 minutes: about two days, then 'failed' (shown in the Monday report)
const KEEP_USAGE_HOURS = 48;
const ML_TIMEOUT_MS = 15000;

// Where a sign-up came from: the Hub form, the app, or one of the 13 Gear World sites (for their sign-up box).
export const SOURCES = new Set(["hub", "app", "agw", "bgw", "cgw", "ggw", "hgw", "kgw", "mgw", "pgw", "sgw", "tgw", "vgw", "wgw", "zgw"]);
const LOCALES = new Set(["en-GB", "el-GR", "de-DE", "fr-FR", "it-IT", "es-ES", "pt-PT", "nl-NL", "sq-AL", "ro-RO", "ru-RU"]);

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function reply(status, body, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function isPreviewEnv(env) {
  return String((env && env.GWH_PREVIEW) || "") === "1";
}

export function validEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email);
}

// Counts one sign-up attempt of this visitor in this hour; false when the limit is reached.
export async function takeSubscribeSlot(db, now, visitor, limit = HOURLY_LIMIT) {
  const hour = now.toISOString().slice(0, 13);
  const row = await db.prepare(
    "INSERT INTO subscribe_usage (visitor, hour, count) VALUES (?, ?, 1) " +
    "ON CONFLICT(visitor, hour) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count"
  ).bind(visitor, hour, limit).first();
  return !!row;
}

export async function cleanUsage(db, now) {
  const oldHour = new Date(now.getTime() - KEEP_USAGE_HOURS * 3600 * 1000).toISOString().slice(0, 13);
  await db.prepare("DELETE FROM subscribe_usage WHERE hour < ?").bind(oldHour).run();
}

// One place of the network's daily sign-up limit (and of the app's own one for a sign-up without a token).
// Returns null when there is a place, else the answer to send.
export async function dailySignupGate(db, now, env, { tokenless = false } = {}) {
  const retry = String(secondsToNextDay(now));
  if (tokenless) {
    const appLimit = readLimit(env && env.SUBSCRIBE_APP_DAILY_LIMIT, DEFAULT_APP_DAILY_LIMIT, 100000);
    if (!(await takeNetworkSlot(db, now, "subscribe-app", appLimit))) return reply(429, { ok: false, error: "limit_day" }, { "Retry-After": retry });
  }
  const limit = readLimit(env && env.SUBSCRIBE_DAILY_LIMIT, DEFAULT_SUBSCRIBE_DAILY_LIMIT, 100000);
  if (!(await takeNetworkSlot(db, now, "subscribe", limit))) return reply(429, { ok: false, error: "limit_day" }, { "Retry-After": retry });
  return null;
}

export async function handleSubscribe(request, env, ctx, { verify } = {}) {
  if (request.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return reply(403, { ok: false, error: "wrong_origin" });
  if (Number(request.headers.get("content-length") || 0) > 4096) return reply(413, { ok: false, error: "too_large" });

  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return reply(413, { ok: false, error: "too_large" });
    body = JSON.parse(text);
  } catch (_) {
    return reply(400, { ok: false, error: "bad_request" });
  }
  if (!body || typeof body !== "object") return reply(400, { ok: false, error: "bad_request" });

  // Honeypot: silently accept obvious automated submissions (nothing is stored).
  if (String(body.website || "").trim()) return reply(200, { ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (!validEmail(email)) return reply(400, { ok: false, error: "invalid_email" });
  if (body.consent !== true) return reply(400, { ok: false, error: "consent_required" });
  const locale = LOCALES.has(String(body.locale || "")) ? String(body.locale) : "en-GB";
  const asked = String(body.source || "").toLowerCase();
  const source = SOURCES.has(asked) && asked !== "app" ? asked : (origin ? "hub" : "app");
  // The new Hub form sends the version of the consent text it showed; the app (and older pages) the first version.
  const consentVersion = body.consent_version === CONSENT_VERSION ? CONSENT_VERSION : OLD_CONSENT_VERSION;

  // Turnstile (F02): a browser always sends Origin, so a request with Origin needs a token. Without Origin and without a
  // token it is the app, which has only its own small daily limit (below).
  const token = String(body.turnstile_token || "").trim();
  const tokenless = !token;
  if (tokenless && origin) return reply(403, { ok: false, error: "turnstile_required" });
  if (!tokenless) {
    const check = await checkToken(env, token, { domain: "gearworldhub.com", action: HUB_ACTION, ip: request.headers.get("cf-connecting-ip") || "", verify });
    if (check === "not_ready") return reply(503, { ok: false, error: "not_ready" });
    if (check !== "ok") return reply(403, { ok: false, error: "turnstile_failed" });
  }

  // The test address answers like the live Hub but writes and sends nothing.
  if (isPreviewEnv(env)) return reply(200, { ok: true, preview: true });

  const db = env.gear_world_registry;
  const now = new Date();
  try {
    const salt = String(env.PHOTO_LIMIT_SALT || "");
    if (salt) {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const visitor = await visitorCode(ip, `subscribe|${salt}`, now.toISOString().slice(0, 10));
      if (!(await takeSubscribeSlot(db, now, visitor))) {
        return reply(429, { ok: false, error: "too_many" }, { "Retry-After": "3600" });
      }
    }
    const full = await dailySignupGate(db, now, env, { tokenless });
    if (full) return full;
    if (tokenless) {
      await db.prepare(`
        INSERT INTO hub_subscribers (email, locale, marketing_consent, consent_version, source, status, ml_status, ml_attempts, ml_error)
        VALUES (?, ?, 1, ?, ?, 'active', 'hold', 0, NULL)
        ON CONFLICT(email) DO NOTHING
      `).bind(email, locale, consentVersion, source).run();
      return reply(200, { ok: true });
    }
    await db.prepare(`
      INSERT INTO hub_subscribers (email, locale, marketing_consent, consent_version, source, status, ml_status, ml_attempts, ml_error)
      VALUES (?, ?, 1, ?, ?, 'active', 'pending', 0, NULL)
      ON CONFLICT(email) DO UPDATE SET
        locale = excluded.locale,
        marketing_consent = 1,
        consent_version = excluded.consent_version,
        source = excluded.source,
        status = 'active',
        ml_status = 'pending',
        ml_attempts = 0,
        ml_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).bind(email, locale, consentVersion, source).run();
  } catch (error) {
    console.error("Hub email signup failed:", String((error && error.message) || error).replace(/[^\s@]+@[^\s@]+/g, "[email]"));
    return reply(500, { ok: false, error: "subscribe_failed" });
  }

  // MailerLite in the background: the visitor does not wait, and a failure only leaves the row 'pending'.
  const work = (async () => {
    await syncOne(env, email);
    if (now.getUTCMinutes() % 10 === 0) await cleanUsage(db, now);
  })().catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work); else await work;
  return reply(200, { ok: true });
}

// ------------------------------------------------------------------------------------------------
// MailerLite API (only GET and POST, only what step 5 needs)
// ------------------------------------------------------------------------------------------------

async function ml(env, method, path, body, fetchImpl) {
  const res = await (fetchImpl || fetch)(ML_API + path, {
    method,
    headers: {
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(ML_TIMEOUT_MS)
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  return { status: res.status, data };
}

// The group id and the field are looked up once per Worker instance (and made when missing).
const cache = { groupId: "", fieldReady: false };
export function resetMailerLiteCache() { cache.groupId = ""; cache.fieldReady = false; }

async function ensureGroup(env, fetchImpl) {
  if (cache.groupId) return cache.groupId;
  const r = await ml(env, "GET", `/groups?limit=100&filter[name]=${encodeURIComponent(GROUP_NAME)}`, null, fetchImpl);
  if (r.status !== 200) throw new Error(`groups ${r.status}`);
  const found = ((r.data && r.data.data) || []).find((g) => g && g.name === GROUP_NAME);
  if (found) { cache.groupId = String(found.id); return cache.groupId; }
  const c = await ml(env, "POST", "/groups", { name: GROUP_NAME }, fetchImpl);
  if ((c.status !== 200 && c.status !== 201) || !c.data || !c.data.data) throw new Error(`group create ${c.status}`);
  cache.groupId = String(c.data.data.id);
  return cache.groupId;
}

async function ensureField(env, fetchImpl) {
  if (cache.fieldReady) return;
  const r = await ml(env, "GET", `/fields?limit=100&filter[keyword]=${SOURCE_FIELD}`, null, fetchImpl);
  if (r.status !== 200) throw new Error(`fields ${r.status}`);
  if (((r.data && r.data.data) || []).some((f) => f && f.key === SOURCE_FIELD)) { cache.fieldReady = true; return; }
  const c = await ml(env, "POST", "/fields", { name: SOURCE_FIELD, type: "text" }, fetchImpl);
  if (c.status !== 200 && c.status !== 201) throw new Error(`field create ${c.status}`);
  cache.fieldReady = true;
}

function mlTime(value) {
  // D1 CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" (UTC), the format MailerLite expects.
  const s = String(value || "");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 19).replace("T", " ");
}

// Sends one 'pending' row to MailerLite and writes the outcome back. Returns 'synced', 'pending', 'failed' or 'skip'.
export async function syncOne(env, email, fetchImpl) {
  const db = env.gear_world_registry;
  const row = await db.prepare(
    "SELECT email, source, updated_at, ml_status, ml_attempts FROM hub_subscribers " +
    "WHERE email = ? AND status = 'active' AND marketing_consent = 1"
  ).bind(email).first();
  if (!row || row.ml_status !== "pending") return "skip";
  if (!env.MAILERLITE_API_KEY || isPreviewEnv(env)) return "pending";

  let outcome = "pending";
  let note = "";
  try {
    const groupId = await ensureGroup(env, fetchImpl);
    await ensureField(env, fetchImpl);
    const source = SOURCES.has(String(row.source)) ? String(row.source) : "hub";
    const r = await ml(env, "POST", "/subscribers", {
      email: row.email,
      fields: { [SOURCE_FIELD]: source },
      groups: [groupId],
      status: "active",
      opted_in_at: mlTime(row.updated_at)
    }, fetchImpl);
    if (r.status === 200 || r.status === 201) outcome = "synced";
    else if (r.status === 422) { outcome = "failed"; note = "mailerlite 422 (address refused)"; }
    else note = `mailerlite ${r.status}`;
    if (r.status === 401 || r.status === 403 || r.status === 404) cache.groupId = "";
  } catch (error) {
    note = String((error && error.message) || error || "network").slice(0, 120);
  }

  if (outcome === "synced") {
    await db.prepare(
      "UPDATE hub_subscribers SET ml_status = 'synced', ml_synced_at = CURRENT_TIMESTAMP, ml_error = NULL WHERE email = ? AND ml_status = 'pending'"
    ).bind(email).run();
    return "synced";
  }
  const attempts = Number(row.ml_attempts || 0) + 1;
  if (outcome !== "failed" && attempts >= MAX_ATTEMPTS) outcome = "failed";
  await db.prepare(
    "UPDATE hub_subscribers SET ml_status = ?, ml_attempts = ?, ml_error = ? WHERE email = ? AND ml_status = 'pending'"
  ).bind(outcome === "failed" ? "failed" : "pending", attempts, note.replace(/[^\s@]+@[^\s@]+/g, "[email]"), email).run();
  return outcome;
}

// The cron (every 10 minutes): sends the 'pending' rows again, oldest first, a few at a time.
export async function syncPending(env, fetchImpl) {
  if (!env.MAILERLITE_API_KEY || isPreviewEnv(env)) return { tried: 0, synced: 0 };
  const db = env.gear_world_registry;
  const { results } = await db.prepare(
    "SELECT email FROM hub_subscribers WHERE ml_status = 'pending' AND status = 'active' AND marketing_consent = 1 " +
    "ORDER BY updated_at LIMIT ?"
  ).bind(RETRY_BATCH).all();
  let synced = 0;
  for (const r of results || []) {
    if ((await syncOne(env, r.email, fetchImpl)) === "synced") synced++;
  }
  try { await cleanUsage(db, new Date()); } catch (_) { /* the table may not exist yet */ }
  return { tried: (results || []).length, synced };
}
