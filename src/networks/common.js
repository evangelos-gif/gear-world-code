// Shared pieces of the network sales sync (src/network-sync.js, lessons L197): one row shape for every network, money,
// dates, our sub id, hiding secrets, and the encryption of a key kept in D1.
import { siteOf, productRefOf } from '../awin-sync.js';

// The first run of a network reads from here (CJ started on 31 Oct 2026, Daisycon on 12 Nov, Linkwise on 19 Nov).
export const FIRST_DAY = '2026-10-01';
// Sales stay pending for weeks (CJ locks on the 11th of the next month, or a month later when extended): every run
// reads the last 90 days again.
export const LOOKBACK_DAYS = 90;
export const DAY = 864e5;

export const text = (v, max = 120) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, max));

// Money as the networks send it: a number, or text such as "13.29" / "-1.852" (CJ's DecimalNumber is text).
export function num(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean' || typeof v === 'object') return null;
  const n = Number(typeof v === 'string' ? v.replace(',', '.').trim() : v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}

// Our sub id back from the network: site and product as in the Awin clickref (src/awin-sync.js, SITE_CODES).
export function subIdParts(subId) {
  const s = text(typeof subId === 'string' ? subId.trim() : subId, 100);
  return { sub_id: s, site: siteOf(s), product_ref: productRefOf(s) };
}

export const STATUSES = ['pending', 'approved', 'declined'];

// The columns of network_transactions (sites/awin/migrations/0002_network_sales.sql): only these are ever kept.
export const COLS = ['network', 'id', 'site', 'sub_id', 'product_ref', 'advertiser_id', 'advertiser_name', 'sale_date',
  'locking_date', 'status', 'raw_status', 'sale_amount', 'commission_amount', 'currency', 'sale_amount_gbp',
  'commission_amount_gbp', 'is_correction', 'group_ref', 'first_seen_at', 'updated_at'];

// One row from an adapter's plain fields. GBP amounts only when the network gave pounds (our publisher currency).
export function makeRow(network, f, nowIso) {
  const sub = subIdParts(f.subId);
  const currency = f.currency ? String(f.currency).toUpperCase().slice(0, 3) : null;
  const sale = num(f.sale);
  const commission = num(f.commission);
  const gbp = currency === 'GBP';
  return {
    network,
    id: String(f.id).slice(0, 80),
    site: sub.site,
    sub_id: sub.sub_id,
    product_ref: sub.product_ref,
    advertiser_id: text(f.advertiserId, 20),
    advertiser_name: text(f.advertiserName, 120),
    sale_date: text(f.saleDate, 40),
    locking_date: text(f.lockingDate, 40),
    status: STATUSES.includes(f.status) ? f.status : 'pending',
    raw_status: text(f.rawStatus, 40),
    sale_amount: sale,
    commission_amount: commission,
    currency,
    sale_amount_gbp: gbp ? sale : null,
    commission_amount_gbp: gbp ? commission : null,
    is_correction: f.isCorrection ? 1 : 0,
    group_ref: text(f.groupRef, 40),
    first_seen_at: nowIso,
    updated_at: nowIso
  };
}

// 2026-11-19T10:00:00Z (no milliseconds), the form CJ asks for.
export const iso = d => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
export const ymd = d => d.toISOString().slice(0, 10);

// Back-to-back date windows of at most `days` days from `from` to `now`, oldest first: [start, end) as Dates.
export function windows(from, now, days = 30) {
  const out = [];
  let start = from instanceof Date ? new Date(from.getTime()) : new Date(`${from}T00:00:00Z`);
  while (start < now) {
    const end = new Date(Math.min(start.getTime() + days * DAY, now.getTime()));
    out.push({ start, end });
    start = end;
  }
  return out;
}

// Every secret value (and the "Bearer"/"Basic" forms) out of a text. Values under 6 characters are left alone: they
// would hide ordinary words.
export function makeMask(values) {
  return s => {
    let t = String(s ?? '');
    for (const v of values) if (v && v.length >= 6) t = t.split(v).join('[secret]');
    return t.replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[secret]');
  };
}

// ---- a key kept in D1: AES-GCM with the Worker secret NETWORK_SYNC_KEY (32 random bytes, base64) ----
const b64 = buf => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(String(s)), c => c.charCodeAt(0));

async function aesKey(keyB64) {
  let raw;
  try { raw = unb64(String(keyB64 || '').trim()); } catch { raw = new Uint8Array(0); }
  if (raw.length !== 32) throw new Error('NETWORK_SYNC_KEY is not a 32-byte key (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// label binds the text to its row (e.g. "daisycon"), so a sealed key cannot be moved to another network's row.
export async function sealText(keyB64, plain, label) {
  const key = await aesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(label) }, key, new TextEncoder().encode(plain));
  return { iv: b64(iv), ciphertext: b64(ct) };
}

export async function openText(keyB64, sealed, label) {
  const key = await aesKey(keyB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv), additionalData: new TextEncoder().encode(label) }, key, unb64(sealed.ciphertext));
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- small facts in network_sync_meta (migration 0003): the running commit, a resume point ----
export async function getMeta(db, key) {
  const r = await db.prepare('SELECT value FROM network_sync_meta WHERE key = ?').bind(key).first();
  return r && r.value !== undefined && r.value !== null ? String(r.value) : '';
}
export async function setMeta(db, key, value, nowIso) {
  await db.prepare(`INSERT INTO network_sync_meta (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(key, String(value), nowIso).run();
}
export async function delMeta(db, key) {
  await db.prepare('DELETE FROM network_sync_meta WHERE key = ?').bind(key).run();
}

// The JSON of an answer, or null; never throws.
export async function readJson(res) {
  let t = '';
  try { t = await res.text(); } catch { return { json: null, text: '' }; }
  try { return { json: JSON.parse(t), text: t }; } catch { return { json: null, text: t }; }
}
