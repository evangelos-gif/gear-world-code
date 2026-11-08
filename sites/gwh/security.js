// GWH-SECURITY: the security fixes of 8/11/2026 (lessons L106), in one place for worker.js, mailerlite.js and members.js.
//   - Turnstile (F02, L07): the Hub checks every sign-up token itself, with the secret key of the widget the token
//     came from, and the hostname and form it was made for.
//   - Daily limits of the whole network (F02, F03): sign-ups and calls to the translation models. One row per limit
//     and day in the existing table subscribe_usage (no new table): visitor = 'network:<name>', hour = the UTC day.
//     The cron of mailerlite.js already removes rows older than 48 hours.
//   - The response headers of the Hub (F11, L05, L06): charset=utf-8 on text, and a full Content-Security-Policy in
//     Report-Only mode first. HSTS is NOT sent here: the zone's own rule sends it (F08), and two values would disagree.
// Secrets (Worker secrets, never in the code): TURNSTILE_SECRET_KEY (widget 1), TURNSTILE_SECRET_KEY_2 (widget 2).
// Public: TURNSTILE_SITE_KEY (the sitekey of widget 1, for the Hub page). tools/gw-security-fixes.ps1 sets them.

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare's published test keys: they always pass and never protect anything. Only on the test address (GWH_PREVIEW).
export const TEST_SITE_KEY = "1x00000000000000000000AA";
export const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
export const HUB_ACTION = "hub-signup";
export const SITE_ACTION = "deal-updates";

// A Turnstile widget of the free plan takes at most 10 hostnames (each covers its www too), so the Hub and the 13 sites
// use two widgets. tools/gw-security-fixes.ps1 makes them with exactly these hostnames (tests check both lists agree).
export const TURNSTILE_WIDGETS = {
  1: ["gearworldhub.com", "constructiongearworld.com", "mensgearworld.com", "womensgearworld.com", "kidsgearworld.com",
    "homegearworld.com", "gardengearworld.com", "technologygearworld.com", "cargearworld.com", "travelgearworld.com"],
  2: ["sportygearworld.com", "bikergearworld.com", "gaminggearworld.com", "petsgearworld.com"]
};
export const SITE_DOMAINS = {
  cgw: "constructiongearworld.com", mgw: "mensgearworld.com", wgw: "womensgearworld.com", kgw: "kidsgearworld.com",
  hgw: "homegearworld.com", ggw: "gardengearworld.com", tgw: "technologygearworld.com", agw: "cargearworld.com",
  vgw: "travelgearworld.com", sgw: "sportygearworld.com", bgw: "bikergearworld.com", pgw: "gaminggearworld.com",
  zgw: "petsgearworld.com"
};

export function widgetOf(domain) {
  const d = String(domain || "").toLowerCase();
  if (TURNSTILE_WIDGETS[1].includes(d)) return 1;
  if (TURNSTILE_WIDGETS[2].includes(d)) return 2;
  return 0;
}

export function isPreviewEnv(env) {
  return String((env && env.GWH_PREVIEW) || "") === "1";
}

// The secret key that checks tokens of this hostname ("" = not set yet). The test address uses the test secret.
export function secretFor(env, domain) {
  if (isPreviewEnv(env)) return TEST_SECRET_KEY;
  const w = widgetOf(domain);
  const s = w === 1 ? env && env.TURNSTILE_SECRET_KEY : w === 2 ? env && env.TURNSTILE_SECRET_KEY_2 : "";
  return String(s || "").trim();
}

// The public sitekey of the Hub page (widget 1); the test key on the test address.
export function hubSiteKey(env) {
  if (isPreviewEnv(env)) return TEST_SITE_KEY;
  const k = String((env && env.TURNSTILE_SITE_KEY) || "").trim();
  return /^[0-9]x[0-9A-Za-z_-]{10,64}$/.test(k) ? k : "";
}

// Siteverify: the whole answer, never throws. The secret goes only to Cloudflare and is never logged.
export async function turnstileResult(token, secret, ip, fetchImpl) {
  const t = String(token || "");
  if (!t || t.length > 2048 || !secret) return { success: false, "error-codes": ["missing-input"] };
  const body = new URLSearchParams({ secret: String(secret), response: t });
  if (ip) body.set("remoteip", String(ip));
  try {
    const r = await (fetchImpl || fetch)(TURNSTILE_VERIFY_URL, { method: "POST", body });
    const data = await r.json();
    return data && typeof data === "object" ? data : { success: false };
  } catch (_) {
    return { success: false, "error-codes": ["network"] };
  }
}

// 'ok' | 'not_ready' (no secret key yet) | 'failed'. A real token must be for this hostname (or its www) and this form.
// The test keys of the test address answer with another hostname and no form name, so those two are not compared there.
export async function checkToken(env, token, { domain, action, ip, verify } = {}) {
  const secret = secretFor(env, domain);
  if (!secret) return "not_ready";
  const data = await (verify || turnstileResult)(token, secret, ip);
  if (!data || data.success !== true) return "failed";
  if (isPreviewEnv(env)) return "ok";
  const host = String(data.hostname || "").toLowerCase();
  if (host !== domain && host !== `www.${domain}`) return "failed";
  if (action && String(data.action || "") !== action) return "failed";
  return "ok";
}

export function readLimit(value, fallback, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
}

// The daily limits (owner can change them with a Worker variable of the same name; 0 = none allowed).
export const DEFAULT_SUBSCRIBE_DAILY_LIMIT = 50;   // MailerLite free plan: 250 subscribers in all
export const DEFAULT_APP_DAILY_LIMIT = 10;         // sign-ups without a Turnstile token (the app has no widget yet)
export const DEFAULT_TRANSLATE_DAILY_LIMIT = 2000; // calls to the translation models, Hub and sites together

export function secondsToNextDay(now) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

// One place of a daily limit of the network: true while the day has places left. Atomic in D1 (one UPSERT).
export async function takeNetworkSlot(db, now, name, limit) {
  if (!(limit > 0)) return false;
  const day = now.toISOString().slice(0, 10);
  const row = await db.prepare(
    "INSERT INTO subscribe_usage (visitor, hour, count) VALUES (?, ?, 1) " +
    "ON CONFLICT(visitor, hour) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count"
  ).bind(`network:${name}`, day, limit).first();
  return !!row;
}

// The user agent of a bot (the same words as the sites' src/lib/security.js), or none at all.
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|monitor|headless|curl|wget|python|java\/|go-http|httpclient|axios|node-fetch|scrapy|lighthouse/i;
export function isBotRequest(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return true;
  const cf = request.cf;
  return Boolean(cf && cf.botManagement && cf.botManagement.verifiedBot);
}

// How the Hub introduces itself to the sites when it asks /api/products (not a bot: the sites may translate for it).
export const HUB_USER_AGENT = "GearWorldHub/1.0 (+https://gearworldhub.com/about/)";

// Translations of a search, kept for one day per normalised term (Cache API of this data centre).
export const TRANSLATE_CACHE_SECONDS = 86400;
export function translationKey(q) {
  return String(q || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
function cacheRequest(kind, key) {
  return new Request(`https://gearworldhub.com/__gwh/translate/v1?k=${encodeURIComponent(kind)}&q=${encodeURIComponent(key)}`, { method: "GET" });
}
export function defaultCache() {
  try { return typeof caches !== "undefined" && caches.default ? caches.default : null; } catch (_) { return null; }
}
export async function cachedTranslation(cache, kind, key) {
  if (!cache) return null;
  try {
    const hit = await cache.match(cacheRequest(kind, key));
    if (!hit) return null;
    const data = await hit.json();
    return data && typeof data.c === "string" ? data.c : null;
  } catch (_) { return null; }
}
export async function storeTranslation(cache, kind, key, value) {
  if (!cache) return;
  try {
    await cache.put(cacheRequest(kind, key), new Response(JSON.stringify({ c: value }), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${TRANSLATE_CACHE_SECONDS}` }
    }));
  } catch (_) { /* the cache is only a help */ }
}

// The full Content-Security-Policy of the Hub, sent first as Report-Only (lessons L06): the browser blocks nothing and
// only reports what it would have blocked to /api/csp-report. What the Hub really loads (8/11/2026): its own files, the
// Google tag after "Allow" (Analytics + Ads), Cloudflare Web Analytics, Turnstile on the sign-up form, product photos
// of the retailers (https:), the photo of the camera search (blob:), the seasonal videos (its own). Voice search uses
// the browser's own speech service (no request from the page). The zone's enforced policy stays as it is.
export const HUB_CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
  "style-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://google.com https://www.googleadservices.com",
  "frame-src https://challenges.cloudflare.com https://td.doubleclick.net https://www.googletagmanager.com",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report"
].join("; ");

const TEXT_TYPE = /^(text\/(html|css|plain|javascript|xml)|application\/(javascript|json|xml))\s*(;|$)/i;

// charset=utf-8 on every text answer that has none (L05), the Report-Only policy on HTML pages (L06). The body and the
// status stay exactly as they are, so the files still match live-baseline.txt byte for byte.
export function withHubHeaders(response) {
  if (!response || !response.headers) return response;
  const type = String(response.headers.get("Content-Type") || "");
  const needsCharset = TEXT_TYPE.test(type) && !/charset=/i.test(type);
  const isHtml = /^text\/html/i.test(type);
  if (!needsCharset && !isHtml) return response;
  const copy = new Response(response.body, response);
  if (needsCharset) copy.headers.set("Content-Type", `${type.split(";")[0].trim()}; charset=utf-8`);
  if (isHtml) copy.headers.set("Content-Security-Policy-Report-Only", HUB_CSP);
  // HSTS comes from the zone's rule only (F08): never a second, different value from the Worker.
  copy.headers.delete("Strict-Transport-Security");
  return copy;
}

// POST /api/csp-report: the browser's reports of the Report-Only policy go to the Worker logs (short, no cookies).
// A real report is about 1 KB: a body over CSP_REPORT_MAX is refused (413) before it is read (Content-Length), and a
// body without that header is read only up to the limit (the rest is never read).
export const CSP_REPORT_MAX = 8192;
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
async function readLimited(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      try { await reader.cancel(); } catch (_) { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}
export async function cspReport(request) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const declared = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(declared) || declared > CSP_REPORT_MAX) return new Response(null, { status: 413, headers: NO_STORE });
  try {
    const body = await readLimited(request, CSP_REPORT_MAX);
    if (body === null) return new Response(null, { status: 413, headers: NO_STORE });
    console.warn("gwh csp-report", body.slice(0, 2000).replace(/[^\s@]+@[^\s@]+/g, "[email]"));
  } catch (_) { /* ignore */ }
  return new Response(null, { status: 204, headers: NO_STORE });
}
