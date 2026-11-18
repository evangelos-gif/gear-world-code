// GWH-REMIND (lessons L182, owner's decisions of 15 and 17 Nov 2026): "Remind me on 27 Nov" of the 13 sites.
// - A site sends a reminder ONLY through its service binding (POST https://hub.internal/internal/remind), with the
//   Turnstile token of its "Get deal updates" widget, a one-way key of the visitor's IP (never the IP), and one product:
//   its id, its name and its page on that site (https://<site>/product/...-<id>/, never /out/ or /go/).
// - The Hub writes it into its D1 FIRST (table remind_signups, migrations/0004_remind.sql), then adds the address to
//   MailerLite in the background: group "Gear World Remind me 27 Nov" (made by the email chat, never made here), fields
//   remind_name_1..3, remind_url_1..3, remind_site_1..3 and remind_signup_date. NEVER the group "Gear World subscribers"
//   and no status: a new address is added as MailerLite adds it, an address that unsubscribed stays unsubscribed (422).
//   A failure leaves the row 'pending' for the cron (every 10 minutes), like mailerlite.js.
// - Up to three products per address: the three most recent (a product chosen again moves to the top).
// - No confirmation email (owner, 17 Nov 2026): the unticked box and Turnstile, like "Get deal updates".
// - Open until 27 Nov 2026 06:00 in London (GMT): the email chat makes the drafts of the 27 Nov email at 06:41, so
//   nobody is told "we will email you on 27 Nov" after the list for that email was made (independent review, 17 Nov).
//   GET https://hub.internal/internal/remind tells the sites whether the list is open (so their box shows only when
//   this code and its table are live). From 28 Nov 2026 12:00 UTC the cron deletes every row (the privacy policies say
//   the list is deleted on 28 Nov); in MailerLite the email chat clears the group and the remind_* fields on 28 Nov
//   with the owner's approval.
// - The MailerLite free plan (250 subscribers in all): at most REMIND_DAILY_LIMIT new reminders a day (its own counter,
//   so reminders never take the weekly sign-ups' places) and at most REMIND_MAX_ROWS addresses on the list.
import { checkToken, SITE_DOMAINS, SITE_ACTION, takeNetworkSlot, readLimit } from "./security.js";
import { validEmail, mailerLiteRequest, MAX_ATTEMPTS, RETRY_BATCH } from "./mailerlite.js";
import { memberSlot } from "./members.js";

export const REMIND_GROUP = "Gear World Remind me 27 Nov";
export const REMIND_UNTIL_ISO = "2026-11-27T06:00:00Z";
export const REMIND_UNTIL = Date.parse(REMIND_UNTIL_ISO);
export const DEFAULT_REMIND_DAILY_LIMIT = 40;
export const REMIND_MAX_ROWS = 150;
// The fields the email chat made in MailerLite (17 Nov 2026). MailerLite ignores a field it does not know, so they are
// checked before a row counts as sent.
export const REMIND_FIELDS = ["remind_name_1", "remind_name_2", "remind_name_3", "remind_url_1", "remind_url_2", "remind_url_3",
  "remind_site_1", "remind_site_2", "remind_site_3", "remind_signup_date"];
export const REMIND_DELETE_FROM = Date.parse("2026-11-28T12:00:00Z");
export const REMIND_CONSENT_VERSION = "2026-11-19-remind";
export const REMIND_ITEMS = 3;
// The site names in the email (remind_site_*), as the sites call themselves.
export const SITE_NAMES = {
  cgw: "Construction Gear World", mgw: "Men's Gear World", wgw: "Women's Gear World", kgw: "Kids' Gear World",
  hgw: "Home Gear World", ggw: "Garden Gear World", tgw: "Technology Gear World", agw: "Car Gear World",
  vgw: "Travel Gear World", sgw: "Sporty Gear World", bgw: "Biker Gear World", pgw: "Gaming Gear World",
  zgw: "Pets Gear World"
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const isPreview = env => String((env && env.GWH_PREVIEW) || "") === "1";
const clean = s => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

// The product as the site sent it, or null: an id, a name, and that site's own product page for that id.
export function remindItem(site, product) {
  if (!product || typeof product !== "object" || !SITE_DOMAINS[site]) return null;
  const id = Number(product.id);
  if (!Number.isInteger(id) || id <= 0 || id > 1e12) return null;
  const name = clean(product.name).slice(0, 200);
  if (name.length < 2) return null;
  const url = String(product.url || "");
  const domain = SITE_DOMAINS[site].replace(/\./g, "\\.");
  if (url.length > 400 || !new RegExp(`^https://${domain}/product/[a-z0-9-]*-${id}/$`).test(url)) return null;
  return { site, id, name, url };
}

// The new product first, without an older copy of it, at most three.
export function mergeItems(oldJson, item, at) {
  let old = [];
  try { old = JSON.parse(oldJson || "[]"); } catch (_) { old = []; }
  if (!Array.isArray(old)) old = [];
  const rest = old.filter(x => x && !(x.site === item.site && Number(x.id) === item.id));
  return [{ ...item, at }, ...rest].slice(0, REMIND_ITEMS);
}

// The table exists (the migration ran) and how many addresses it holds - kept for a few minutes in this Worker.
let tableSeen = { at: -Infinity, ok: false, rows: 0 };
async function tableState(db, now) {
  if (now - tableSeen.at < 300000) return tableSeen;
  let ok = false;
  let rows = 0;
  try { const r = await db.prepare("SELECT COUNT(*) AS n FROM remind_signups").first(); ok = true; rows = Number((r && r.n) || 0); } catch (_) { ok = false; }
  tableSeen = { at: now, ok, rows };
  return tableSeen;
}
async function tableReady(db, now) {
  return (await tableState(db, now)).ok;
}
export function resetRemindCache() { tableSeen = { at: -Infinity, ok: false, rows: 0 }; groupCache.id = ""; groupCache.fields = false; }

// Open: before the closing time, with the table, and while the list has room (the sites hide the box otherwise).
export async function remindOpen(env, now = Date.now()) {
  const db = env && env.gear_world_registry;
  if (!db || !(now <= REMIND_UNTIL)) return false;
  const t = await tableState(db, now);
  return t.ok && t.rows < REMIND_MAX_ROWS;
}

// GET and POST https://hub.internal/internal/remind (members.js sends them here).
export async function handleRemind(request, env, ctx, { now = Date.now(), sync = syncRemind, verify } = {}) {
  if (request.method === "GET") return json({ ok: true, open: await remindOpen(env, now), until: REMIND_UNTIL_ISO });
  if (request.method !== "POST") return json({ ok: false, error: "not_found" }, 404);
  const db = env && env.gear_world_registry;
  if (!db) return json({ ok: false, error: "no_database" }, 503);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "json" }, 400); }
  if (!body || typeof body !== "object") return json({ ok: false, error: "json" }, 400);
  if (!(now <= REMIND_UNTIL)) return json({ ok: false, error: "closed" }, 410);
  const email = String(body.email || "").trim().toLowerCase();
  const site = String(body.site || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ ok: false, error: "invalid_email" }, 400);
  if (!SITE_DOMAINS[site]) return json({ ok: false, error: "site" }, 400);
  if (body.consent !== true) return json({ ok: false, error: "consent_required" }, 400);
  const item = remindItem(site, body.product);
  if (!item) return json({ ok: false, error: "product" }, 400);
  const key = /^[0-9a-f]{16,64}$/.test(String(body.client || "")) ? String(body.client) : "unknown";
  const token = String(body.turnstile_token || "").trim();
  if (!token) return json({ ok: false, error: "turnstile_required" }, 403);
  const check = await checkToken(env, token, { domain: SITE_DOMAINS[site], action: SITE_ACTION, verify });
  if (check === "not_ready") return json({ ok: false, error: "not_ready" }, 503);
  if (check !== "ok") return json({ ok: false, error: "turnstile_failed" }, 403);
  // The test address of the Hub answers but writes and sends nothing (like mailerlite.js and members.js).
  if (isPreview(env)) return json({ ok: true, preview: true });
  if (!(await tableReady(db, now))) return json({ ok: false, error: "closed" }, 410);
  try {
    if (!(await memberSlot(db, `remind:${site}:${key}`, now))) return json({ ok: false, error: "too_many" }, 429);
    const row = await db.prepare("SELECT items FROM remind_signups WHERE email = ?").bind(email).first();
    if (!row) {
      // A new address: the list's own size and daily limits (the MailerLite free plan, 250 subscribers in all).
      const count = await db.prepare("SELECT COUNT(*) AS n FROM remind_signups").first();
      if (Number((count && count.n) || 0) >= REMIND_MAX_ROWS) return json({ ok: false, error: "closed" }, 410);
      const limit = readLimit(env.REMIND_DAILY_LIMIT, DEFAULT_REMIND_DAILY_LIMIT, 100000);
      if (!(await takeNetworkSlot(db, new Date(now), "remind", limit))) return json({ ok: false, error: "limit_day" }, 429);
    }
    const items = mergeItems(row && row.items, item, new Date(now).toISOString().slice(0, 10));
    await db.prepare(`INSERT INTO remind_signups (email, items, consent_version, ml_status, ml_attempts, ml_error)
      VALUES (?, ?, ?, 'pending', 0, NULL)
      ON CONFLICT (email) DO UPDATE SET items = excluded.items, consent_version = excluded.consent_version,
        ml_status = 'pending', ml_attempts = 0, ml_error = NULL, updated_at = CURRENT_TIMESTAMP`)
      .bind(email, JSON.stringify(items), REMIND_CONSENT_VERSION).run();
  } catch (e) {
    console.error("remind sign-up failed:", String((e && e.message) || e).replace(/[^\s@]+@[^\s@]+/g, "[email]"));
    return json({ ok: false, error: "subscribe_failed" }, 500);
  }
  const work = Promise.resolve().then(() => sync(env, email)).catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work); else await work;
  return json({ ok: true });
}

// The MailerLite fields of a row: the products newest first, and the day of the last request.
export function remindFields(items, updatedAt) {
  const fields = {};
  (items || []).slice(0, REMIND_ITEMS).forEach((x, i) => {
    fields[`remind_name_${i + 1}`] = x.name;
    fields[`remind_url_${i + 1}`] = x.url;
    fields[`remind_site_${i + 1}`] = SITE_NAMES[x.site] || "Gear World";
  });
  const day = String(updatedAt || "").slice(0, 10);
  fields.remind_signup_date = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
  return fields;
}

// The group is looked up by its name, once per Worker; never made here (the email chat made it, 17 Nov 2026).
const groupCache = { id: "", fields: false };
async function remindFieldsReady(env, fetchImpl) {
  if (groupCache.fields) return;
  const r = await mailerLiteRequest(env, "GET", "/fields?limit=100&filter[keyword]=remind", null, fetchImpl);
  if (r.status !== 200) throw new Error(`fields ${r.status}`);
  const have = new Set(((r.data && r.data.data) || []).map(f => f && f.key));
  const missing = REMIND_FIELDS.filter(k => !have.has(k));
  if (missing.length) throw new Error(`MailerLite fields missing: ${missing.join(", ")}`);
  groupCache.fields = true;
}
async function remindGroup(env, fetchImpl) {
  if (groupCache.id) return groupCache.id;
  const r = await mailerLiteRequest(env, "GET", `/groups?limit=100&filter[name]=${encodeURIComponent(REMIND_GROUP)}`, null, fetchImpl);
  if (r.status !== 200) throw new Error(`groups ${r.status}`);
  const found = ((r.data && r.data.data) || []).find(g => g && g.name === REMIND_GROUP);
  if (!found) throw new Error("the group Gear World Remind me 27 Nov is missing");
  groupCache.id = String(found.id);
  return groupCache.id;
}

// Sends one 'pending' row to MailerLite. Returns 'synced', 'pending', 'failed' or 'skip'.
export async function syncRemind(env, email, fetchImpl) {
  const db = env.gear_world_registry;
  const row = await db.prepare("SELECT email, items, updated_at, ml_status, ml_attempts FROM remind_signups WHERE email = ?").bind(email).first();
  if (!row || row.ml_status !== "pending") return "skip";
  if (!env.MAILERLITE_API_KEY || isPreview(env)) return "pending";
  let items = [];
  try { items = JSON.parse(row.items || "[]"); } catch (_) { items = []; }
  let outcome = "pending";
  let note = "";
  try {
    const groupId = await remindGroup(env, fetchImpl);
    await remindFieldsReady(env, fetchImpl);
    // No status: a new address is added, an unsubscribed one is refused (422) and stays unsubscribed.
    const r = await mailerLiteRequest(env, "POST", "/subscribers", { email: row.email, fields: remindFields(items, row.updated_at), groups: [groupId] }, fetchImpl);
    if (r.status === 200 || r.status === 201) outcome = "synced";
    else if (r.status === 422) { outcome = "failed"; note = "mailerlite 422 (address refused or unsubscribed)"; }
    else note = `mailerlite ${r.status}`;
    if (r.status === 401 || r.status === 403 || r.status === 404) { groupCache.id = ""; groupCache.fields = false; }
  } catch (error) {
    note = String((error && error.message) || error || "network").slice(0, 120);
  }
  // Only the row that was sent: a newer request in the meantime (updated_at changed) stays 'pending' for the cron.
  if (outcome === "synced") {
    await db.prepare("UPDATE remind_signups SET ml_status = 'synced', ml_synced_at = CURRENT_TIMESTAMP, ml_error = NULL WHERE email = ? AND ml_status = 'pending' AND updated_at = ?").bind(email, row.updated_at).run();
    return "synced";
  }
  const attempts = Number(row.ml_attempts || 0) + 1;
  if (outcome !== "failed" && attempts >= MAX_ATTEMPTS) outcome = "failed";
  await db.prepare("UPDATE remind_signups SET ml_status = ?, ml_attempts = ?, ml_error = ? WHERE email = ? AND ml_status = 'pending' AND updated_at = ?")
    .bind(outcome === "failed" ? "failed" : "pending", attempts, note.replace(/[^\s@]+@[^\s@]+/g, "[email]"), email, row.updated_at).run();
  return outcome;
}

// The cron: the 'pending' rows again, oldest first, a few at a time; from 28 Nov 2026 12:00 UTC every row is deleted.
export async function remindCron(env, fetchImpl, now = Date.now()) {
  const db = env && env.gear_world_registry;
  if (!db || isPreview(env)) return { tried: 0, synced: 0, deleted: 0 };
  try {
    if (now >= REMIND_DELETE_FROM) {
      const r = await db.prepare("DELETE FROM remind_signups").run();
      return { tried: 0, synced: 0, deleted: Number((r && r.meta && r.meta.changes) || 0) };
    }
    if (!env.MAILERLITE_API_KEY) return { tried: 0, synced: 0, deleted: 0 };
    const { results } = await db.prepare("SELECT email FROM remind_signups WHERE ml_status = 'pending' ORDER BY updated_at LIMIT ?").bind(RETRY_BATCH).all();
    let synced = 0;
    for (const r of results || []) if ((await syncRemind(env, r.email, fetchImpl)) === "synced") synced++;
    return { tried: (results || []).length, synced, deleted: 0 };
  } catch (_) {
    return { tried: 0, synced: 0, deleted: 0 }; // the table may not exist yet
  }
}
