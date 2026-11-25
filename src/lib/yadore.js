// Yadore (pay per click, lessons L232). Yadore GmbH (Munich) pays for every click on an offer of one of its stores
// (70% to us). Manager's order of 25 Nov 2026 (rules of Anna Andrews, Yadore, 20 Nov 2026):
//   - first the Greek market (gr) in the categories that are empty in the Greek view, then the UK;
//   - few stores at the start, few and steady clicks every day, raised step by step (Yadore is told before a rise of
//     20% or more, contract); live on Wed 2 Dec 2026 18:00 (UK), never in the Black Friday week ("no peaks");
//   - clicks and sales per store from the Report and Conversion APIs; a store with 300 clicks and no sale is paused;
//     target conversion at least 1%;
//   - the same product of the same store once (the rule of Kelkoo and Connexity); never the 5 big stores of Linkwise
//     (Public, Sephora, e-shop.gr, AB Vasilopoulos, Kotsovolos), no Amazon on a site that watches prices (here: no
//     Amazon at all), and Aliexpress and Panora only on Mega Stores (L230);
//   - no iframes, buttons rel="sponsored nofollow", a note that we are paid for the click, no word of L107.
// The API key is a Worker secret, YADORE_API_KEY, put there by tools/yadore.ps1 from a hidden PowerShell prompt (never in
// chat, GitHub or the plan). Without it nothing of this file runs: no box, and /out/y/ links go back to the page.
// API: https://docs.yadore.com/ (GET /v2/offer with the header API-Key; all prices in euros).
import { categoryPath } from './text.js';
import { YADORE_WORDS } from './yadore-words.js';

export const YADORE_API = 'https://api.yadore.com/v2/offer';
export const YADORE_NAME = 'Yadore';
// The visitor's own country (request.cf.country, never the Group's ?for= browsing) and the Yadore market for it.
export const YADORE_MARKETS = Object.freeze({ GR: 'gr' });
// Not before Wed 2 Dec 2026 18:00 UK time (= UTC in December): the Manager's date, after Black Friday and Cyber Monday.
export const YADORE_FROM = Date.parse('2026-12-02T18:00:00Z');
// The box shows on page 1 of a category without filters, in the categories of src/lib/yadore-words.js ("the empty
// categories of the Greek view": no Greek retailer there; the Greek view shows retailers that deliver mostly to the UK).
export const YADORE_SHOWN = 8; // offers in the box
export const YADORE_PER_STORE = 2; // offers of one store in the box
export const YADORE_ASK = 30; // offers asked from Yadore per word (the API allows 1-100)
export const YADORE_CACHE_SECONDS = 3600; // one answer of Yadore kept per data centre
export const YADORE_TIMEOUT_MS = 2500; // a slow Yadore never holds the page
export const YADORE_LINK_HOURS = 26; // a /out/y/ link older than this goes back to the page (fresh offers there)
export const YADORE_PER_VISITOR = 3; // clicks in the box a day per visitor and site (a one-way hash of the IP, cache only)
// Clicks a day (UTC day), per site and per store on that site. Few and steady at the start (Anna, 20 Nov 2026). A higher
// step is a new line with its date, after the Manager's decision and an email to Yadore when it is 20% or more.
export const YADORE_CAPS = Object.freeze([
  Object.freeze({ from: '2026-12-02', site: 15, store: 5 })
]);
// The stores allowed now, per market, by the name Yadore gives (merchant.name, lower case, without "www."). Few at the
// start (Anna's rule): chosen from the read-only list of tools/yadore.ps1 -Step plan. An empty list shows nothing.
// A store that reaches 300 clicks without a sale is taken out (or paused at once with the secret YADORE_PAUSE).
export const YADORE_STORES = Object.freeze({
  gr: Object.freeze([])
});
// The tests set other lists (like useClock of src/lib/visibility.js); the live Worker never calls this.
let STORES = YADORE_STORES;
export function useYadoreStores(map) {
  STORES = map || YADORE_STORES;
}
export function storesOf(market) {
  return (STORES[market] || []).map(storeKey);
}
// Never, whatever the lists say: the 5 big Linkwise stores, Amazon, and Aliexpress and Panora (only for Mega Stores).
const NEVER_LABELS = ['public', 'sephora', 'e-shop', 'eshop', 'ab', 'abvasilopoulos', 'ab-vasilopoulos', 'kotsovolos', 'amazon', 'aliexpress', 'panora'];
const NEVER_WORDS = /amazon|aliexpress|sephora|kotsovolos|κωτσόβολος|κωτσοβολος|βασιλόπουλος|βασιλοπουλος|vasilopoulos|\bpanora\b|e-?shop\.gr|\bpublic\.gr\b/i;
// The words the sites never use (lessons L107). A title or a store name with one of them is left out (never rewritten).
export const L107_WORDS = /\bshop|\bcart\b|\bsale\b|\bdeals?\b|\bofficial\b|\bpartner|lowest price|% ?off\b|\bsave\b|buy now|\bwas\s*£|uk retailers/i;
// Sale words of a title in Greek too (L107 is about our texts; a store's title with them is left out, never rewritten):
// προσφορά, έκπτωση, ξεπούλημα, and a percentage like "-30%" (not "100%").
export const PROMO_TITLE = /προσφορ|εκπτωσ|ξεπουλ|black friday|cyber monday|(?:^|[^\d])-?\d{1,2}\s?%/i;
export function promoTitle(t) {
  return PROMO_TITLE.test(String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}
const BAD_STOCK = new Set(['UNAVAILABLE', 'SOON', 'PREORDER', 'BACKORDER']);

// The store's name as compared everywhere: lower case, no "www.", single spaces.
// A final sigma is folded to σ, as Windows PowerShell's ToLowerInvariant does (tools/yadore.ps1 -Step pause).
export function storeKey(name) {
  return String(name || '').normalize('NFKC').trim().toLowerCase().replace(/ς/g, 'σ').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/\s+/g, ' ');
}
export function neverStore(name) {
  const k = storeKey(name);
  if (!k) return true;
  // The first word or label: "public.gr", "Public GR", "Public Greece", "AB Vasilopoulos" (independent review).
  const label = k.split(/[.\s-]/)[0];
  return NEVER_LABELS.includes(label) || NEVER_WORDS.test(k);
}

export function yadoreKey(env) {
  const k = String((env && env.YADORE_API_KEY) || '').trim();
  return /^[\x21-\x7e]{16,200}$/.test(k) ? k : '';
}
// Stores paused at once without a new code version (the 300-click rule): the secret YADORE_PAUSE, names separated by
// commas or new lines, set by tools/yadore.ps1 -Step pause.
export function pausedStores(env) {
  return new Set(String((env && env.YADORE_PAUSE) || '').split(/[,\n]/).map(storeKey).filter(Boolean));
}
export function storeAllowed(env, market, name) {
  const k = storeKey(name);
  if (!k || neverStore(k) || L107_WORDS.test(k)) return false;
  return storesOf(market).includes(k) && !pausedStores(env).has(k);
}

export function capsFor(at) {
  const day = new Date(at).toISOString().slice(0, 10);
  let cap = null;
  for (const c of YADORE_CAPS) if (c.from <= day) cap = c;
  return cap;
}

// The market of this visitor on this site's category, or '' (no box): the key is set, the date has come, the country is
// a Yadore market of ours and the site has words for the category in that market.
export function yadoreMarket(site, env, cat, country, at) {
  if (!yadoreKey(env) || !(at >= YADORE_FROM) || !capsFor(at)) return '';
  const market = YADORE_MARKETS[String(country || '').toUpperCase()] || '';
  if (!market || !storesOf(market).length) return '';
  return categoryWords(site, cat, market).length ? market : '';
}

// The words Yadore searches for a category (src/lib/yadore-words.js), at most 2.
export function categoryWords(site, cat, market) {
  const bySite = (YADORE_WORDS[market] || {})[String((site && site.code) || '').toLowerCase()] || {};
  const words = bySite[cat && cat.slug] || [];
  return words.filter(w => typeof w === 'string' && w.trim()).slice(0, 2);
}
export function placementId(site, market, cat) {
  return `${String(site.code).toLowerCase()}-${market}-${cat.slug}`.replace(/[^\x21-\x7e]/g, '').slice(0, 128);
}

// Offers of one Yadore answer that may be shown: an https link of Yadore, a price, a photo, a title and store without an
// L107 word, a store of the list, not out of stock. No promoText, no original price ("Was", L107), no CPC on the page.
// anyStore (the read-only plan of tools/yadore-api.mjs only): every store but the never ones, to choose the list.
export function readOffers(json, env, market, { anyStore = false } = {}) {
  const list = json && Array.isArray(json.offers) ? json.offers : [];
  const out = [];
  for (const o of list) {
    if (!o || typeof o !== 'object') continue;
    const click = httpsUrl(o.clickUrl);
    if (!click || !/(^|\.)yadore\.com$/i.test(click.hostname)) continue;
    const store = String((o.merchant && o.merchant.name) || '').trim();
    if (anyStore ? (neverStore(store) || L107_WORDS.test(storeKey(store))) : !storeAllowed(env, market, store)) continue;
    const title = String(o.title || '').replace(/\s+/g, ' ').trim();
    if (!title || title.length > 200 || L107_WORDS.test(title) || promoTitle(title)) continue;
    const price = Number.parseFloat(String((o.price && o.price.amount) || '').replace(',', '.'));
    const currency = String((o.price && o.price.currency) || '').toUpperCase();
    if (!(price > 0 && price < 100000) || !/^[A-Z]{3}$/.test(currency)) continue;
    if (BAD_STOCK.has(String(o.availability || '').toUpperCase())) continue;
    const img = httpsUrl((o.thumbnail && o.thumbnail.url) || (o.image && o.image.url));
    if (!img) continue;
    const cpc = Number.parseFloat(String((o.estimatedCpc && o.estimatedCpc.amount) || '0')) || 0;
    out.push({ title: title.slice(0, 160), store, price, currency, image: img.toString(), click: click.toString(), cpc });
  }
  return out;
}
function httpsUrl(v) {
  try {
    const u = new URL(String(v || ''));
    return u.protocol === 'https:' ? u : null;
  } catch { return null; }
}

// The same product of the same store once, with the link that pays more (Kelkoo/Connexity rule). Against our own cards:
// a product that one of our own retailers already lists on the page keeps our card (we cannot compare a commission on a
// sale with a payment per click), so Yadore's copy is left out.
export function titleKey(t) {
  return String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
// A store's name without "www.", its ending (.gr, .com, .co.uk ...), a country word at the end (GR, UK) and anything but
// letters and digits: "Tsakiris Mallas GR" and "tsakirismallas.gr" are the same store.
export function storeLabel(name) {
  return storeKey(name).replace(/\.(co\.uk|com\.gr|com|gr|uk|eu|net|org|de|cy|ie)$/, '').replace(/\s+(gr|uk|cy|ie|eu)$/, '').replace(/[^\p{L}\p{N}]+/gu, '');
}
export function dedupe(offers, own = []) {
  const keyOf = (store, title) => `${storeLabel(store)}|${titleKey(title)}`;
  const best = new Map();
  for (const o of offers) {
    const k = keyOf(o.store, o.title);
    const had = best.get(k);
    if (!had || o.cpc > had.cpc) best.set(k, o);
  }
  const ownKeys = new Set((own || []).map(p => keyOf(p.retailer, p.product_name)));
  return offers.filter(o => {
    const k = keyOf(o.store, o.title);
    return best.get(k) === o && !ownKeys.has(k);
  });
}

// Picks the offers of the box: Yadore's order (relevance for the words), the words taken in turn, at most 2 per store,
// at most 8, and no store whose clicks of the day are used up (nor any when the site's are).
export function pickOffers(lists, counts, cap) {
  if (!cap || counts.total >= cap.site) return [];
  const merged = [];
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) merged.push(l[i]);
  const perStore = new Map();
  const out = [];
  for (const o of merged) {
    const k = storeKey(o.store);
    if ((counts.byStore.get(k) || 0) >= cap.store) continue;
    const n = perStore.get(k) || 0;
    if (n >= YADORE_PER_STORE) continue;
    perStore.set(k, n + 1);
    out.push(o);
    if (out.length >= YADORE_SHOWN) break;
  }
  return out;
}

// Clicks of today (UTC) to Yadore stores on this site: the click table of both database layouts has retailer and
// clicked_at (with an index on clicked_at), and a Yadore click is kept as retailer "Yadore · <store>".
export const CLICK_PREFIX = `${YADORE_NAME} · `;
export async function clicksToday(db, at) {
  const day = new Date(at).toISOString().slice(0, 10);
  const counts = { total: 0, byStore: new Map() };
  const r = await db.prepare('SELECT retailer, COUNT(*) AS n FROM affiliate_clicks WHERE clicked_at >= ? AND retailer LIKE ? GROUP BY retailer')
    .bind(day, `${CLICK_PREFIX}%`).all();
  for (const row of (r && r.results) || []) {
    const n = Number(row.n) || 0;
    counts.total += n;
    const store = storeKey(String(row.retailer || '').slice(CLICK_PREFIX.length));
    counts.byStore.set(store, (counts.byStore.get(store) || 0) + n);
  }
  return counts;
}

// One answer of Yadore for one word, kept for an hour in this data centre's cache (the page itself is kept 5 minutes).
// Returns { json, at } or null. Never throws: a slow or failing Yadore means no box, never a broken page.
export async function askYadore(env, ctx, { market, keyword, placement, origin, at }) {
  const key = yadoreKey(env);
  if (!key) return null;
  const api = new URL(YADORE_API);
  api.searchParams.set('market', market);
  api.searchParams.set('keyword', keyword);
  api.searchParams.set('precision', 'fuzzy');
  api.searchParams.set('sort', 'rel_desc');
  api.searchParams.set('limit', String(YADORE_ASK));
  api.searchParams.set('placementId', placement);
  // The copy is kept under this site's own address (never served: /api/ answers only its own paths).
  const cacheUrl = `${origin}/api/yadore-cache?${new URLSearchParams({ m: market, k: keyword, p: placement, n: String(YADORE_ASK) })}`;
  let cache = null;
  try { cache = typeof caches !== 'undefined' && caches.default && env.EDGE_CACHE !== 'off' ? caches.default : null; } catch { cache = null; }
  if (cache) {
    try {
      const hit = await cache.match(new Request(cacheUrl));
      if (hit) {
        const when = Number(hit.headers.get('X-GW-Fetched')) || at;
        return { json: await hit.json(), at: when };
      }
    } catch { /* the cache is only a help */ }
  }
  const doFetch = env.YADORE_FETCH || fetch;
  let json = null;
  const timer = new AbortController();
  const stop = setTimeout(() => timer.abort(), YADORE_TIMEOUT_MS);
  try {
    const res = await doFetch(api.toString(), { headers: { 'API-Key': key, Accept: 'application/json' }, signal: timer.signal });
    if (!res || !res.ok) { console.warn('yadore', market, placement, res ? res.status : 'no answer'); return null; }
    json = await res.json();
  } catch (err) {
    console.warn('yadore', market, placement, err && err.name === 'AbortError' ? 'timeout' : 'failed');
    return null;
  } finally {
    clearTimeout(stop);
  }
  if (!json || !Array.isArray(json.offers)) return null;
  // The time of the request (the engine's clock: the real time on the live site, the fixed day in the tests).
  const fetched = at;
  if (cache) {
    const copy = new Response(JSON.stringify({ offers: json.offers }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${YADORE_CACHE_SECONDS}`, 'X-GW-Fetched': String(fetched) } });
    const put = cache.put(new Request(cacheUrl), copy).catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
  }
  return { json, at: fetched };
}

// The box of a category page: { market, checked: 'YYYY-MM-DD', offers: [{ title, store, price, currency, image, href }] },
// or null. own: the products of the page (for the "same product of the same store" rule).
export async function yadoreBox(env, ctx, { site, cat, market, own, at, origin }) {
  const cap = capsFor(at);
  if (!cap) return null;
  const placement = placementId(site, market, cat);
  const answers = await Promise.all(categoryWords(site, cat, market).map(keyword => askYadore(env, ctx, { market, keyword, placement, origin, at })));
  const lists = answers.filter(Boolean).map(a => readOffers(a.json, env, market));
  if (!lists.some(l => l.length)) return null;
  let counts;
  try { counts = await clicksToday(env.DB, at); } catch (err) { console.warn('yadore clicks', err && err.message); return null; }
  const deduped = dedupe(lists.flat(), own);
  const allowed = new Set(deduped);
  const picked = pickOffers(lists.map(l => l.filter(o => allowed.has(o))), counts, cap);
  if (!picked.length) return null;
  const fetchedAt = Math.min(...answers.filter(Boolean).map(a => a.at));
  const signKey = await linkKey(env, site);
  const offers = [];
  for (const o of picked) {
    const token = await signLink(signKey, { u: o.click, m: o.store, c: cat.slug, k: market, t: Math.floor(fetchedAt / 1000) });
    offers.push({ title: o.title, store: o.store, price: o.price, currency: o.currency, image: o.image, href: `/out/y/${token}` });
  }
  return { market, checked: new Date(fetchedAt).toISOString().slice(0, 10), offers };
}

// Clicks of one visitor in the box (independent review of L232: one person could use a site's clicks of the day, or click
// the same offer twice). A one-way hash of the IP address, the site and the UTC day, kept only in this data centre's
// cache until the end of that day (the privacy page says so): at most YADORE_PER_VISITOR clicks, and one per offer link.
// Returns { ok, reason, save }: save() writes the new count after the click is recorded. Without a cache: no limit
// here (the caps of the day still hold).
// An IPv6 address counts by its /64 (one home or phone gets a whole /64 and can change the rest at will).
export function visitorAddress(ip) {
  const a = String(ip || '').trim().toLowerCase();
  if (!a.includes(':')) return a;
  const [head, tail = ''] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = a.includes('::') ? (tail ? tail.split(':') : []) : [];
  const full = a.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
export async function visitorGate({ origin, site, ip, token, at, cache, secret = '' }) {
  const ok = { ok: true, reason: '', save: async () => {} };
  if (!cache || !ip) return ok;
  const day = new Date(at).toISOString().slice(0, 10);
  // Keyed with the API key, so the hash cannot be turned back into an address by trying all IPv4 addresses.
  const hex = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${secret}|${text}`)))].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  const who = await hex(`gw-yadore-visitor|${day}|${String(site.code).toLowerCase()}|${visitorAddress(ip)}`);
  const link = (await hex(`gw-yadore-token|${token}`)).slice(0, 16);
  const key = new Request(`${origin}/api/yadore-seen?v=${who}`);
  let seen = { n: 0, links: [] };
  try {
    const hit = await cache.match(key);
    if (hit) seen = await hit.json();
  } catch { seen = { n: 0, links: [] }; }
  const links = Array.isArray(seen.links) ? seen.links : [];
  if (links.includes(link)) return { ok: false, reason: 'again', save: ok.save };
  if ((Number(seen.n) || 0) >= YADORE_PER_VISITOR) return { ok: false, reason: 'visitor', save: ok.save };
  const end = Date.parse(`${day}T00:00:00Z`) + 86400000;
  const seconds = Math.max(60, Math.ceil((end - at) / 1000));
  return {
    ok: true,
    reason: '',
    save: async () => {
      const body = JSON.stringify({ n: (Number(seen.n) || 0) + 1, links: [...links, link].slice(-20) });
      try { await cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` } })); } catch { /* best effort */ }
    }
  };
}
// A request that a browser makes on its own or that does not come from a click on our page: prefetch or prerender, or
// a page of another site (Sec-Fetch-Site other than same-origin, when the browser sends it).
export function notAClick(headers) {
  const h = name => String(headers.get(name) || '').toLowerCase();
  if (/prefetch|prerender/.test(h('sec-purpose')) || /prefetch|prerender/.test(h('purpose')) || h('x-moz') === 'prefetch') return 'prefetch';
  const site = h('sec-fetch-site');
  if (site && site !== 'same-origin') return 'not from our page';
  return '';
}

// ---- The /out/y/<token> links. The token carries Yadore's click address and the store, signed with a key made from
// the API key (HMAC-SHA-256), so this site's address never sends anyone to a place it did not list.
const enc = new TextEncoder();
function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(text) {
  const s = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
// One key per site (a link of one site never works on another) made from the API key.
export async function linkKey(env, site) {
  const k = yadoreKey(env);
  if (!k) return null;
  const code = String((site && site.code) || '').toLowerCase();
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`gw-yadore-link-v1|${code}|${k}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function mac(key, body) {
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`v1.${body}`))).slice(0, 24));
}
export async function signLink(key, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await mac(key, body)}`;
}
export const TOKEN_RE = /^([A-Za-z0-9_-]{20,3000})\.([A-Za-z0-9_-]{32})$/;
// The payload of a token signed by this site, or null (wrong signature, not ours, damaged).
export async function readLink(key, token) {
  const m = TOKEN_RE.exec(String(token || ''));
  if (!key || !m) return null;
  const want = await mac(key, m[1]);
  if (!timingSafeSame(want, m[2])) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64url(m[1])));
    if (!p || typeof p !== 'object' || typeof p.u !== 'string' || typeof p.m !== 'string' || typeof p.k !== 'string' || !Number.isFinite(p.t)) return null;
    const u = httpsUrl(p.u);
    if (!u || !/(^|\.)yadore\.com$/i.test(u.hostname)) return null;
    return { url: u.toString(), store: p.m, category: typeof p.c === 'string' ? p.c : '', market: p.k, at: p.t * 1000 };
  } catch { return null; }
}
function timingSafeSame(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Where a /out/y/ click goes. { to, log } : to = the store through Yadore, or back to the page; log = the click row to
// keep (only for a click that goes to Yadore). Never to Yadore for a bot, a test address, another country's visitor, an
// old link, a store no longer on the list, or once the day's clicks are used up.
export async function yadoreClick({ env, site, token, country, bot, preview, at, categories }) {
  const key = await linkKey(env, site);
  const link = key ? await readLink(key, token) : null;
  const back = link && link.category && categories.has(link.category) ? categoryPath(link.category) : '/';
  const no = reason => ({ to: back, log: null, reason });
  if (!link) return { to: '/', log: null, reason: 'link' };
  if (preview) return no('test address');
  if (bot) return no('bot');
  if (!(at >= YADORE_FROM)) return no('not yet');
  if (YADORE_MARKETS[String(country || '').toUpperCase()] !== link.market) return no('country');
  if (!(at - link.at <= YADORE_LINK_HOURS * 3600 * 1000) || link.at > at + 600000) return no('old link');
  if (!storeAllowed(env, link.market, link.store)) return no('store');
  const cap = capsFor(at);
  let counts;
  try { counts = await clicksToday(env.DB, at); } catch { return no('database'); }
  if (!cap || counts.total >= cap.site || (counts.byStore.get(storeKey(link.store)) || 0) >= cap.store) return no('cap');
  const cat = categories.get(link.category);
  return {
    to: link.url,
    reason: '',
    log: {
      product_id: 0,
      awin_advertiser_id: 0,
      awin_product_id: '',
      retailer: `${CLICK_PREFIX}${storeKey(link.store)}`.slice(0, 120),
      brand: '',
      category_slug: link.category,
      site_category: cat ? cat.name : '',
      product_name: `${YADORE_NAME} ${link.market}`,
      source: 'yadore_click',
      click_ref: `${String(site.code).toLowerCase()}-yd-${link.market}-${link.category}`.slice(0, 80)
    }
  };
}
