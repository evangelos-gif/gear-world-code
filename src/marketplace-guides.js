// Gift-guide site that links to the big marketplaces and to the Gear World sites (Mega Stores Gear World, OGW).
// No database, no cookies, no forms, no scripts. Owner's decision, 17 Nov 2026: no price tracking, price history or
// price alerts here (Amazon Associates Operating Agreement 6(y)); no Amazon prices or photos (no Product Advertising
// API yet); Amazon links go straight to the marketplace with the Associates ID, never through a redirect of ours.
// Amazon links appear only when the Worker has AMAZON_LINKS=on (set by tools/ogw-site.ps1 after the owner's phrase
// that the site is in his Associates account); AMAZON_LINKS=preview (the test Worker) links without the ID.
import { html, toString } from './lib/html.js';
import { htmlResponse, textResponse, redirect } from './lib/http.js';
import { versionResponse } from './lib/version.js';
import { GEAR_WORLDS } from '../promos/network.js';
import { promosFor } from '../promos/promos.js';
import { activePromos } from './lib/promos.js';

export const AMAZON_STATEMENT = 'As an Amazon Associate I earn from qualifying purchases.';
const AMAZON_TRADEMARK = 'Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.';
// The legal texts last changed on this day (UK and EU GDPR wording as approved for the Gear World sites on 17 Nov 2026).
const LEGAL_UPDATED = '18 November 2026';

const asset = (site, p) => `/assets/${p}?v=${encodeURIComponent(site.assetVersion)}`;

// 'on' (the live site, after the owner's phrase), 'preview' (the test Worker: links without the Associates ID) or
// 'off' (no Amazon links at all).
export function amazonMode(env) {
  const v = env && typeof env.AMAZON_LINKS === 'string' ? env.AMAZON_LINKS.trim().toLowerCase() : '';
  return v === 'on' || v === 'preview' ? v : 'off';
}

// Are there marketplace buttons on the pages? On the live site with AMAZON_LINKS=on, and on the test Worker (links
// without the Associates ID). With "off" every text speaks only of the Gear World sites: a page must never say it
// links to marketplaces when it does not (claims that are not true, lessons L107).
const withMarkets = mode => mode === 'on' || mode === 'preview';

// A search on amazon.co.uk for one idea. Only the host and the Associates ID of the site config, and the idea's search
// words, so the link always goes to the marketplace named on the button.
export function amazonUrl(site, q, mode) {
  if (mode !== 'on' && mode !== 'preview') return '';
  const a = site.amazon || {};
  if (!a.host || (mode === 'on' && !/^[a-z0-9-]+-21$/.test(String(a.tag || '')))) return '';
  const u = new URL(`https://${a.host}/s`);
  u.searchParams.set('k', String(q));
  if (mode === 'on') u.searchParams.set('tag', a.tag);
  return u.toString();
}

// The Gear World site of an idea (its code in promos/network.js) and its category page for the same kind of product.
// A category page always lists products; a site search for several words often finds none (checked 17 Nov 2026).
export function gearWorldFor(code) {
  return GEAR_WORLDS.find(w => w.code === String(code || '').toUpperCase()) || null;
}

export function gearWorldUrl(code, cat) {
  const w = gearWorldFor(code);
  if (!w || !/^[a-z0-9-]+$/.test(String(cat || ''))) return '';
  return new URL(`/category/${cat}/`, w.url).toString();
}

// The UK date (YYYY-MM-DD) of a moment: the countdown changes at midnight in London.
export function ukDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// "27 Nov" for 2026-11-27.
const shortDate = day => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

// The line above the guides: days to Black Friday, the Black Friday weekend, then days to Christmas. A date, never a
// promise of discounts (lessons L107). Empty after Christmas Day.
export function countdown(site, now = new Date()) {
  const today = ukDay(now);
  const bf = site.blackFriday;
  const xmas = site.christmas;
  if (bf) {
    const d = daysBetween(today, bf);
    const day = shortDate(bf);
    if (d > 1) return `Black Friday: ${day} · ${d} days to go`;
    if (d === 1) return `Black Friday: ${day} · 1 day to go`;
    if (d <= 0 && d >= -3) return `Black Friday and Cyber Monday: ${day} to ${shortDate(addDays(bf, 3))}`;
  }
  if (xmas) {
    const d = daysBetween(today, xmas);
    if (d > 1) return `Christmas: ${d} days to go`;
    if (d === 1) return 'Christmas: 1 day to go';
    if (d === 0) return 'Happy Christmas';
  }
  return '';
}

const FOOTER_LINKS = [
  ['/about/', 'About'],
  ['/how-we-make-money/', 'How we make money'],
  ['/privacy/', 'Privacy policy'],
  ['/cookies/', 'Cookies'],
  ['/terms/', 'Terms of use']
];

const mail = site => html`<a href="mailto:${site.contactEmail}">${site.contactEmail}</a>`;

// The note at the top of every guide (and the home page): what the links are, before the reader meets one.
function disclosure(site, mode) {
  if (!withMarkets(mode)) {
    return html`<div class="note" role="note">
  <p>The buttons on this page open categories of the Gear World sites. Those sites link to retailers and may earn a commission, at no extra cost to you.</p>
  <p>Prices, stock and delivery are on the page you open. We do not sell anything and we do not track prices.</p>
</div>`;
  }
  return html`<div class="note" role="note">
  <p><strong>#ad</strong> · The buttons on this page are links to marketplaces and to the Gear World sites. If you choose something after following one, we may earn a commission, at no extra cost to you. ${mode === 'on' ? AMAZON_STATEMENT : ''}</p>
  <p>Prices, stock and delivery are on the marketplace's own page. We do not sell anything and we do not track prices.</p>
</div>`;
}

// The same header and footer on every page; the footer links to the legal pages (lessons L17) and says who runs the
// site (L101). The Amazon statement and trademark notice only where Amazon links are shown.
function shell(site, env, { title, description, path, body, robots = '' }) {
  const mode = amazonMode(env);
  const year = new Date().getUTCFullYear();
  return toString(html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://${site.domain}${path}">
${robots ? html`<meta name="robots" content="${robots}">` : ''}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://${site.domain}${path}">
<meta property="og:type" content="website">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(site, 'ogw.css')}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap top-row">
  <a class="brand" href="/"><img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40"><span>${site.name}</span></a>
  <nav class="top-nav" aria-label="Main"><a class="top-link" href="/#stores">Stores</a><a class="top-link" href="/#guides">Gift guides</a></nav>
</div></header>
<main id="main">${body}</main>
<footer class="foot"><div class="wrap">
  <nav aria-label="Legal"><ul class="foot-links">${FOOTER_LINKS.map(([href, label]) => html`<li><a href="${href}">${label}</a></li>`)}</ul></nav>
  ${mode === 'on' ? html`<p>${AMAZON_STATEMENT} ${AMAZON_TRADEMARK}</p>` : ''}
  <p>This site sets no cookies of its own and does no tracking. Prices and stock are on the page each button opens.</p>
  <p>&copy; ${year} ${site.name} · Run by ${site.operatorName} · We don't sell products: ${withMarkets(mode) ? 'we link to marketplaces and to the Gear World sites, and may earn a commission' : 'we link to the Gear World sites, which link to retailers and may earn a commission'}.</p>
</div></footer>
</body>
</html>`);
}

function ideaButtons(site, idea, mode) {
  const amazon = amazonUrl(site, idea.q, mode);
  const gw = gearWorldFor(idea.gw);
  const gwUrl = gearWorldUrl(idea.gw, idea.cat);
  return html`<p class="buttons">
    ${amazon ? html`<a class="btn btn-market" href="${amazon}" rel="sponsored nofollow noopener" target="_blank">See prices on Amazon</a>` : ''}
    ${gwUrl ? html`<a class="btn btn-gw" href="${gwUrl}" rel="noopener" target="_blank">Browse on ${gw.name}</a>` : ''}
  </p>`;
}

// ---------------- Stores (owner, 18 Nov 2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L191) ----------------
// One page per store at /stores/<slug>/ with real product photos read live from the Gear World sites' /api/products
// (the store's first 6 sites, 4 seconds each, kept 1 hour in the Worker's cache). Only the photo, the name, the brand
// and the Gear World product page are kept: never a price, a was_price or an affiliate_url (Amazon Associates 6(y),
// lessons L103, L107), never an /out/ or /go/ link (a visit from here would count as a click on a retailer link).
// Nothing is written to the repo (no Awin feed data). Amazon has its own page (/stores/amazon/) with the gift ideas and
// the Amazon buttons, only with AMAZON_LINKS on or preview.
// Who asks the Gear World sites: "MegaStoresGearWorld/1.0 (+https://megastoresgearworld.com)" from the site config.
export const storeUserAgent = site => `${String(site.name).replace(/[^A-Za-z0-9]/g, '')}/1.0 (+https://${site.domain})`;
const STORE_SITES_READ = 6;
const STORE_PER_SITE = 8;
const STORE_KEEP = 24;
const STORE_TIMEOUT_MS = 4000;
// A product whose name or brand holds a price, a percentage, a word of a shop or of a discount, or Amazon's name is
// left out: those words never appear on this site (L101, L103, L107), and with AMAZON_LINKS off no page names Amazon.
const UNSHOWN_WORDS = /[£$€%]|\b(sale|sales|deals?|save|saving|savings|shop|shopping|buy|cart|basket|official|partners?|discounts?|offers?|free delivery|lowest price|best price|cheapest|clearance|bargains?|coupons?|vouchers?|promo|black friday)\b|amazon/i;

export function awinStores(site) {
  return (site.stores || []).filter(s => !s.amazon && Array.isArray(s.sites) && s.sites.length);
}

// The stores shown with this mode, in the config's order: Amazon only with Amazon links (on or preview).
export function shownStores(site, mode) {
  return (site.stores || []).filter(s => (s.amazon ? withMarkets(mode) : Array.isArray(s.sites) && s.sites.length));
}

export function storeCacheKey(site, store) {
  return `https://${site.domain}/__cache/stores/${store.slug}?v=${encodeURIComponent(site.assetVersion)}`;
}

const SITE_HOST = w => new URL(w.url).hostname;

// One product of a site's /api/products answer as this site may show it, or null: an https photo, a product page on
// that same Gear World site, the store's own products, delivered to the UK, not out of stock, a clean name.
export function cleanStoreProduct(p, store, w) {
  if (!p || typeof p !== 'object') return null;
  if (String(p.retailer || '').trim().toLowerCase() !== store.name.toLowerCase()) return null;
  const name = String(p.product_name || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const brand = String(p.brand || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name || UNSHOWN_WORDS.test(name) || UNSHOWN_WORDS.test(brand)) return null;
  if (p.stock_status === 'out_of_stock') return null;
  const to = Array.isArray(p.delivers_to) ? p.delivers_to.map(c => String(c).toUpperCase()) : [];
  if (!to.includes('GB') && !to.includes('WORLD')) return null;
  let image;
  let page;
  try {
    image = new URL(String(p.image_url || ''));
    page = new URL(String(p.product_url || ''));
  } catch { return null; }
  if (image.protocol !== 'https:' || page.protocol !== 'https:') return null;
  if (page.hostname !== SITE_HOST(w) || !page.pathname.startsWith('/product/') || /\/(out|go)\//.test(page.pathname)) return null;
  page.hash = '';
  return { name, brand, image: image.toString(), url: page.toString(), site: w.code };
}

// The store's products from one Gear World site: [] when it answers nothing usable, an error when it fails or is slow.
async function readSiteProducts(store, w, deps) {
  const u = new URL('/api/products', w.url);
  u.searchParams.set('retailer', store.name);
  u.searchParams.set('deliver_to', 'GB');
  u.searchParams.set('badges', '1');
  u.searchParams.set('limit', String(STORE_PER_SITE));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs || STORE_TIMEOUT_MS);
  try {
    const res = await deps.fetch(u.toString(), { headers: { 'User-Agent': deps.userAgent, Accept: 'application/json' }, signal: ac.signal, redirect: 'manual' });
    if (!res || res.status !== 200) throw new Error(`HTTP ${res && res.status}`);
    const data = await res.json();
    const rows = data && Array.isArray(data.products) ? data.products : [];
    return rows.map(p => cleanStoreProduct(p, store, w)).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

// The sites one after another (round-robin), one product name once, up to 24.
export function mixStoreProducts(lists, keep = STORE_KEEP) {
  const out = [];
  const seen = new Set();
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest && out.length < keep; i++) {
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      const k = p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= keep) break;
    }
  }
  return out;
}

// The store's products: from the cache, or read from its first 6 Gear World sites at once (Promise.allSettled, so a
// slow or failing site never breaks the page). Kept 1 hour when every site answered, 10 minutes when one failed, and
// 1 minute when nothing came back (the page then says so and still links to every site).
export async function storeProducts(site, store, deps = {}, ctx = null) {
  const cache = deps.cache || null;
  const key = storeCacheKey(site, store);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        if (data && Array.isArray(data.products)) return { products: data.products, cached: true };
      }
    } catch { /* a broken copy is read again from the sites */ }
  }
  const sites = store.sites.map(gearWorldFor).filter(Boolean).slice(0, STORE_SITES_READ);
  const fetcher = deps.fetch || ((...a) => fetch(...a));
  const results = await Promise.allSettled(sites.map(w => readSiteProducts(store, w, { ...deps, fetch: fetcher, userAgent: storeUserAgent(site) })));
  const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
  const failed = results.some(r => r.status !== 'fulfilled');
  const products = mixStoreProducts(lists);
  const ttl = !products.length ? 60 : failed ? 600 : 3600;
  if (cache) {
    const res = new Response(JSON.stringify({ products }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
    const put = Promise.resolve().then(() => cache.put(key, res)).catch(() => { /* the next visit reads the sites again */ });
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
  }
  return { products, cached: false };
}

const storeLogo = (site, store, cls) => {
  if (!store.logo || store.amazon || !/^logos\/[a-z0-9-]+\.(png|jpg|svg|webp)$/.test(store.logo)) return '';
  const [w, h] = Array.isArray(store.logoSize) ? store.logoSize : [168, 168];
  return html`<span class="${cls}"><img src="${asset(site, store.logo)}" alt="${store.name}" width="${w}" height="${h}" decoding="async"></span>`;
};

// The name as a clean text badge (no logo of our own making), or the store's own logo on a white tile.
const storeMark = (site, store) => storeLogo(site, store, 'store-logo') || html`<span class="store-badge" translate="no">${store.name}</span>`;

const siteCount = n => `On ${n} Gear World site${n === 1 ? '' : 's'}`;

function storeCard(site, store, products) {
  const thumbs = (products || []).slice(0, 3);
  if (store.amazon) {
    return html`<li class="store-card">
  <div class="store-mark"><span class="store-badge" translate="no">${store.name}</span></div>
  <h3><a class="store-link" href="/stores/${store.slug}/"><span translate="no">${store.name}</span></a></h3>
  <p>${store.line}</p>
  <p class="store-meta">${site.guides.length} gift guides</p>
</li>`;
  }
  return html`<li class="store-card">
  <div class="store-mark">${storeMark(site, store)}</div>
  <h3><a class="store-link" href="/stores/${store.slug}/"><span translate="no">${store.name}</span></a></h3>
  <p>${store.line}</p>
  ${thumbs.length ? html`<ul class="store-thumbs">${thumbs.map(p => html`<li><img src="${p.image}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></li>`)}</ul>` : ''}
  <p class="store-meta">${siteCount(store.sites.length)}</p>
</li>`;
}

function storesSection(site, mode, data) {
  const stores = shownStores(site, mode);
  if (!stores.length) return '';
  return html`<section class="wrap section" id="stores">
  <h2>Stores</h2>
  <p class="section-lede">${withMarkets(mode)
    ? 'One page per store: product photos from the Gear World sites, and gift ideas to search on Amazon. Prices, stock and delivery are on the page each button opens.'
    : 'One page per store, with product photos from the Gear World sites. Prices, stock and delivery are on the product page each button opens.'}</p>
  <ul class="stores">${stores.map(s => storeCard(site, s, (data && data[s.slug]) || []))}</ul>
</section>`;
}

// The note at the top of a store page: its buttons open Gear World product pages (no affiliate link of our own here).
function storeDisclosure() {
  return html`<div class="note" role="note">
  <p>The buttons on this page open product pages of the Gear World sites. Those sites link to retailers and may earn a commission, at no extra cost to you.</p>
  <p>Prices, stock and delivery are on the page you open. We do not sell anything and we do not track prices.</p>
</div>`;
}

// Codes from promos/promos.js that run today on a Gear World site for this store (kind "code" only: a sale or a
// coupon is not a code to type, lessons L107, L114).
function storeHasCodes(store, code, now) {
  return activePromos({ promos: promosFor(code) }, now).some(p => p.kind === 'code' && p.slug === store.slug);
}

export function storeSearchUrl(store, w) {
  const u = new URL('/search', w.url);
  u.searchParams.set('q', store.name);
  u.searchParams.set('retailer', store.name);
  return u.toString();
}

export function storePage(site, env, store, products, now = Date.now()) {
  const worlds = store.sites.map(gearWorldFor).filter(Boolean);
  return shell(site, env, {
    title: `${store.name} on ${site.name}`,
    description: `${store.line} Product photos from the Gear World sites, each with its Gear World product page.`,
    path: `/stores/${store.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#stores">Stores</a></p>
  <div class="store-title">${storeLogo(site, store, 'store-logo store-logo-lg')}<h1><span translate="no">${store.name}</span> on ${site.name}</h1></div>
  <p class="lede">${store.line} Each product opens its page on a Gear World site, which shows the price, the stock and where <span translate="no">${store.name}</span> delivers.</p>
</div></section>
<section class="wrap section">${storeDisclosure()}</section>
<section class="wrap section" aria-label="Products">
  ${products.length
    ? html`<ul class="pcards">${products.map(p => {
      const w = gearWorldFor(p.site);
      return html`<li class="pcard">
    <a class="pcard-photo" href="${p.url}" rel="noopener" target="_blank"><img src="${p.image}" alt="${p.name}" width="240" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <h2 class="pcard-name" translate="no">${p.name}</h2>
    ${p.brand ? html`<p class="pcard-brand" translate="no">${p.brand}</p>` : ''}
    <p class="pcard-site">On ${w.name}</p>
    <a class="btn btn-gw pcard-btn" href="${p.url}" rel="noopener" target="_blank">See it on ${w.name}</a>
  </li>`;
    })}</ul>`
    : html`<p class="empty">Products could not be loaded just now. The links below open <span translate="no">${store.name}</span> on each Gear World site.</p>`}
</section>
<section class="wrap section">
  <h2><span translate="no">${store.name}</span> on the Gear World sites</h2>
  <ul class="site-links">${worlds.map(w => html`<li>
    <a href="${storeSearchUrl(store, w)}">All <span translate="no">${store.name}</span> products on ${w.name}</a>
    ${storeHasCodes(store, w.code, now) ? html`<a href="${new URL(`/discount-codes/${store.slug}/`, w.url).toString()}"><span translate="no">${store.name}</span> voucher codes on ${w.name}</a>` : ''}
  </li>`)}</ul>
  <p><a href="/#stores">All stores</a> · <a href="/#guides">Gift guides</a></p>
</section>`
  });
}

// The main Gear World site of a guide: the site most of its ideas link to (the first one on a tie), for its photo.
export function guideWorld(guide) {
  const n = new Map();
  for (const i of guide.ideas || []) n.set(i.gw, (n.get(i.gw) || 0) + 1);
  let best = '';
  for (const [code, c] of n) if (!best || c > n.get(best)) best = code;
  return guide.world || best;
}

export const guideImage = guide => `worlds/${String(guideWorld(guide)).toLowerCase()}.jpg`;

// The Amazon page: the gift ideas, guide by guide, with the Amazon buttons. Our own photos of the Gear Worlds, never an
// Amazon product photo (no Product Advertising API). The Amazon image, when Amazon supplies one, only here, next to
// the Amazon buttons and only with the Associates ID (Trademark Guidelines).
export function amazonStorePage(site, env, store) {
  const mode = amazonMode(env);
  const mark = site.amazon && /^[a-z0-9/-]+\.(png|jpg|svg|gif)$/.test(String(site.amazon.linkImage || '')) && mode === 'on'
    ? html`<p class="amz-mark"><img src="${asset(site, site.amazon.linkImage)}" alt="Amazon" decoding="async"></p>` : '';
  return shell(site, env, {
    title: `Gift ideas to search on Amazon | ${site.name}`,
    description: 'The ideas of our gift guides, each with a search on amazon.co.uk. Compare models, sellers and prices before you choose.',
    path: `/stores/${store.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#stores">Stores</a></p>
  <h1>Gift ideas to search on Amazon</h1>
  <p class="lede">${store.line} Each button opens a search on amazon.co.uk, which shows the current models, sellers and prices.</p>
</div></section>
<section class="wrap section">${disclosure(site, mode)}</section>
<section class="wrap section">
  <ul class="amz-guides">${site.guides.map(g => html`<li class="amz-guide">
    <img class="amz-photo" src="${asset(site, guideImage(g))}" alt="" width="700" height="420" loading="lazy" decoding="async">
    <div class="amz-body">
      <h2><a href="/guides/${g.slug}/">${g.title}</a></h2>
      <p>${g.teaser}</p>
      ${mark}
      <ul class="amz-ideas">${g.ideas.map(i => {
        const href = amazonUrl(site, i.q, mode);
        return html`<li><span class="amz-idea">${i.name}</span>${href ? html`<a class="btn btn-market btn-sm" href="${href}" rel="sponsored nofollow noopener" target="_blank" aria-label="${i.name}: see prices on Amazon">See prices on Amazon</a>` : ''}</li>`;
      })}</ul>
    </div>
  </li>`)}</ul>
  <p><a href="/#stores">All stores</a> · <a href="/#guides">Gift guides</a></p>
</section>`
  });
}

export function homePage(site, env, now = new Date(), storeData = {}) {
  const mode = amazonMode(env);
  const count = countdown(site, now);
  const all = [...site.guides, site.checks].filter(Boolean);
  return shell(site, env, {
    title: `Stores and gift guides | ${site.name}`,
    description: withMarkets(mode)
      ? 'Store pages with product photos from the Gear World sites, and Christmas gift ideas with searches on the big marketplaces. Compare models, sellers and prices before you choose.'
      : 'Store pages with product photos from the Gear World sites, and Christmas gift ideas with the matching categories. Compare models, retailers and prices before you choose.',
    path: '/',
    body: html`
<section class="hero"><div class="wrap">
  <p class="eyebrow">Stores and gift guides</p>
  <h1>${withMarkets(mode) ? 'Gift ideas first. Then compare on the big marketplaces.' : 'Gift ideas first. Then compare.'}</h1>
  <p class="lede">${withMarkets(mode)
    ? 'Short gift guides for Christmas and the winter. Every idea opens a search on a big marketplace and the matching category of a Gear World site, so you can compare models, sellers and prices before you choose.'
    : 'Short gift guides for Christmas and the winter. Every idea opens the matching category of a Gear World site, where each product shows the retailer that sells it, its price and where it delivers.'}</p>
  ${count ? html`<p class="count">${count}</p>` : ''}
</div></section>
<section class="wrap section">${disclosure(site, mode)}</section>
${storesSection(site, mode, storeData)}
<section class="wrap section" id="guides">
  <h2>Gift guides</h2>
  <ul class="cards">${all.map(g => html`<li class="card"><h3><a href="/guides/${g.slug}/">${g.title}</a></h3><p>${g.teaser}</p></li>`)}</ul>
</section>
<section class="wrap section">
  <h2>How this site works</h2>
  <ul class="ticks">
    <li>We write short lists of gift ideas. An idea is a kind of product, not a product we claim to have tested.</li>
    <li>${withMarkets(mode) ? 'Each idea opens a search on a marketplace and the matching category of a Gear World site.' : 'Each idea opens the matching category of a Gear World site.'} Those pages show the products, the seller, the price and delivery.</li>
    <li>We do not sell anything, we do not track prices and we do not set cookies.</li>
  </ul>
</section>
<section class="wrap section">
  <h2>The Gear World sites</h2>
  <p>Independent product search and price-comparison sites. Each product shows the retailer that sells it and where that retailer delivers. <a href="https://gearworldhub.com/">Gear World Hub</a> searches all of them at once.</p>
  <ul class="gw-list">${GEAR_WORLDS.map(w => html`<li><a href="${w.url}">${w.name}</a></li>`)}</ul>
</section>`
  });
}

export function guidePage(site, env, guide) {
  const mode = amazonMode(env);
  return shell(site, env, {
    title: `${guide.title} | ${site.name}`,
    description: `${guide.teaser} ${withMarkets(mode) ? 'Ideas with searches on the big marketplaces and the Gear World sites.' : 'Ideas with the matching categories of the Gear World sites.'}`,
    path: `/guides/${guide.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#guides">Gift guides</a></p>
  <h1>${guide.title}</h1>
  <p class="lede">${guide.intro}</p>
</div></section>
<section class="wrap section">${disclosure(site, mode)}</section>
<section class="wrap section">
  <ol class="ideas">${guide.ideas.map(i => html`<li class="idea">
    <h2>${i.name}</h2>
    <p>${i.why}</p>
    ${ideaButtons(site, i, mode)}
  </li>`)}</ol>
</section>
<section class="wrap section">
  <p><a href="/guides/${site.checks.slug}/">${site.checks.title}</a> · <a href="/#guides">All gift guides</a></p>
</section>`
  });
}

export function checksPage(site, env) {
  const c = site.checks;
  const mode = amazonMode(env);
  return shell(site, env, {
    title: `${c.title} | ${site.name}`,
    description: `${c.teaser} Seven checks that take a few minutes.`,
    path: `/guides/${c.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#guides">Gift guides</a></p>
  <h1>${c.title}</h1>
  <p class="lede">${c.intro}</p>
</div></section>
<section class="wrap section prose">
  <ol class="steps">${c.steps.map(s => html`<li><h2>${s.name}</h2><p>${s.text}</p></li>`)}</ol>
</section>
<section class="wrap section">${disclosure(site, mode)}<p><a href="/#guides">All gift guides</a></p></section>`
  });
}

// Legal pages (lessons L17). They describe this site only: no forms, no accounts, no cookies of its own.
// NOTE: a starting point that needs review by a qualified adviser (T31), like the other Gear World sites.
const LEGAL = {
  '/about/': (site, mode) => ({
    title: 'About',
    description: `Who runs ${site.name} and how to contact us.`,
    content: html`
<p>${site.name} (${site.domain}) is a small site of gift guides. ${withMarkets(mode) ? 'Each idea links to a search on a big marketplace and to the matching category of one of the Gear World sites' : 'Each idea links to the matching category of one of the Gear World sites'}, so you can compare models, sellers and prices yourself.</p>
<p>It is part of the Gear World sites, a group of independent product search and price-comparison sites.</p>
<p>Run by ${site.operatorName}. Contact: ${mail(site)}.</p>
<h2>What we do not do</h2>
<ul>
<li>We do not sell anything and we do not take payments.</li>
<li>We do not track prices or send price alerts.</li>
<li>We do not show prices: they are on the page each button opens, where they are up to date.</li>
<li>The store pages show product photos, names and brands from the Gear World sites, each with its Gear World product page.</li>
</ul>
${mode === 'on' ? html`<p>${AMAZON_STATEMENT}</p>` : ''}`
  }),

  '/how-we-make-money/': (site, mode) => ({
    title: 'How we make money',
    description: `How ${site.name} earns money through affiliate links.`,
    content: html`
<p>${site.name} is free to use. We earn money through affiliate links.</p>
<h2>What an affiliate link is</h2>
${withMarkets(mode)
  ? html`<p>Some buttons on this site are affiliate links to marketplaces. If you follow one and then buy something, the marketplace may pay us a commission. You pay the same price as you would if you went to the marketplace directly.</p>`
  : html`<p>At the moment this site has no affiliate links of its own: its buttons open categories of the Gear World sites. Those sites link to retailers through affiliate networks and may earn a commission; you pay the same price.</p>`}
${mode === 'on' ? html`<h2>Amazon</h2><p>${AMAZON_STATEMENT}</p><p>${AMAZON_TRADEMARK}</p>` : ''}
<h2>The Gear World sites</h2>
<p>The "Browse on" buttons open a category of a Gear World site, and the "See it on" buttons of the store pages open a product page of a Gear World site. Those sites have their own affiliate links and explain them on their own "How we make money" page.</p>
<h2>How this affects what you see</h2>
<p>The ideas are not ranked by commission, and nobody pays to be in a guide. We do not show prices: the page each button opens has the current price.</p>`
  }),

  '/privacy/': site => ({
    title: 'Privacy policy',
    description: `How ${site.name} (${site.domain}) handles personal data.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>This policy explains what personal data ${site.name} (${site.domain}) uses, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018) and, if you are in the European Union or the European Economic Area, under the EU General Data Protection Regulation (GDPR).</p>
<h2>Who is responsible</h2>
<p>The data controller is ${site.operatorName}. Contact: ${mail(site)}.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Visiting the site.</strong> The site has no forms, no accounts, no analytics and no advertising tags. We do not record your visit.</li>
<li><strong>Email.</strong> If you email us, we keep your message and email address to reply (legitimate interests) and delete them when they are no longer needed.</li>
<li><strong>Hosting.</strong> The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.</li>
<li><strong>Product photos.</strong> The photos on the store pages load from the retailers' image servers, which receive technical data such as your IP address to send the image. We tell them nothing about the page you are on.</li>
</ul>
<h2>When you follow a link</h2>
<p>When you follow a link to another site, that site's own privacy policy applies. The site you open may set its own cookies to know where you came from, so it can pay a commission.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service provider (Cloudflare) may process data outside the UK and the European Economic Area with appropriate safeguards.</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, object, and ask for a copy. Email ${mail(site)}. You can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>. If you are in the European Union or the European Economic Area, you can also complain to the data protection authority of the country where you live.</p>`
  }),

  '/cookies/': site => ({
    title: 'Cookies',
    description: `Which cookies ${site.domain} uses.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>${site.domain} sets no advertising, analytics or tracking cookies and stores nothing on your device, so there is no cookie banner.</p>
<h2>Strictly necessary</h2>
<p>Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. They are needed for the site to work safely and do not track you across sites.</p>
<h2>Other sites</h2>
<p>When you follow a link to another site, that site may set its own cookies, which its own cookies page explains.</p>`
  }),

  '/terms/': site => ({
    title: 'Terms of use',
    description: `The terms for using ${site.domain}.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>These terms apply when you use ${site.domain}, operated by ${site.operatorName}. By using the site you accept them.</p>
<h2>What the site does</h2>
<p>The site publishes gift ideas with links to other sites. It does not sell anything. Any purchase is between you and the seller, under the terms of the seller and of the site where you buy.</p>
<h2>The ideas</h2>
<p>The ideas are general suggestions, not advice about a particular product. Check the product page, the age and safety marks, the seller and the returns policy before you choose.</p>
<h2>Links to other websites</h2>
<p>We are not responsible for the content, prices or availability on websites we link to.</p>
<h2>Liability</h2>
<p>Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of this site.</p>
<h2>Law</h2>
<p>These terms are governed by the law of England and Wales. If you are a consumer living in the European Union, you also keep the protection of the mandatory consumer laws of the country where you live.</p>
<h2>Contact</h2>
<p>${mail(site)}</p>`
  })
};

export function legalPaths() {
  return Object.keys(LEGAL);
}

export function legalPage(site, env, path) {
  const make = LEGAL[path];
  if (!make) return null;
  const p = make(site, amazonMode(env));
  return shell(site, env, {
    title: `${p.title} | ${site.name}`,
    description: p.description,
    path,
    body: html`
<section class="wrap section prose">
  <h1>${p.title}</h1>
  ${p.content}
</section>`
  });
}

function notFoundPage(site, env, path) {
  return shell(site, env, {
    title: `Page not found | ${site.name}`,
    description: 'This page does not exist.',
    path,
    robots: 'noindex',
    body: html`
<section class="wrap section prose">
  <h1>Page not found</h1>
  <p>This page does not exist. <a href="/#guides">See all gift guides</a>.</p>
</section>`
  });
}

// Every page address, for the sitemap. The Amazon page only when the Amazon links are live (mode "on").
export function pagePaths(site, mode = 'off') {
  const stores = (site.stores || []).filter(s => (s.amazon ? mode === 'on' : Array.isArray(s.sites) && s.sites.length)).map(s => `/stores/${s.slug}/`);
  return ['/', ...stores, ...site.guides.map(g => `/guides/${g.slug}/`), `/guides/${site.checks.slug}/`, ...Object.keys(LEGAL)];
}

// deps (tests): fetch, cache (match/put, like caches.default), now (a function giving ms) and timeoutMs.
export function createGuidesWorker(site, deps = {}) {
  const guides = new Map(site.guides.map(g => [g.slug, g]));
  const stores = new Map((site.stores || []).map(s => [s.slug, s]));
  const runtime = () => ({
    fetch: deps.fetch,
    cache: deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' && caches.default ? caches.default : null),
    timeoutMs: deps.timeoutMs
  });
  const nowMs = () => (typeof deps.now === 'function' ? deps.now() : Date.now());
  // Every store's products for the home page cards (from the cache, or read now); never breaks the page.
  async function allStoreData(ctx) {
    const list = awinStores(site);
    const r = await Promise.allSettled(list.map(s => storeProducts(site, s, runtime(), ctx)));
    const out = {};
    list.forEach((s, i) => { out[s.slug] = r[i].status === 'fulfilled' ? r[i].value.products : []; });
    return out;
  }
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname === `www.${site.domain}`) {
        url.hostname = site.domain;
        return redirect(url.toString(), 301);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('Method not allowed', { status: 405, cache: 'none' });
      // The test Worker (*.workers.dev) is never indexed.
      const preview = url.hostname !== site.domain && !['localhost', '127.0.0.1'].includes(url.hostname);
      const page = (body, status = 200) => {
        const res = htmlResponse(body, { status, method: request.method, cache: 'page' });
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      };
      // Which code version is live, for the deploy tool's check (lessons L156).
      if (url.pathname === '/api/version') return versionResponse(env);
      if (url.pathname === '/robots.txt') {
        return textResponse(preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: https://${site.domain}/sitemap.xml\n`, { method: request.method });
      }
      if (url.pathname === '/sitemap.xml') {
        const urls = pagePaths(site, amazonMode(env)).map(p => `<url><loc>https://${site.domain}${p}</loc></url>`).join('\n');
        return textResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { type: 'application/xml', method: request.method });
      }
      if (url.pathname === '/' || url.pathname === '/index.html') return page(homePage(site, env, new Date(nowMs()), await allStoreData(ctx)));
      if (url.pathname === '/guides' || url.pathname === '/guides/') return redirect(`https://${site.domain}/#guides`, 302);
      if (url.pathname === '/stores' || url.pathname === '/stores/') return redirect(`https://${site.domain}/#stores`, 302);
      const sm = url.pathname.match(/^\/stores\/([a-z0-9-]+)\/?$/);
      if (sm && stores.has(sm[1])) {
        const store = stores.get(sm[1]);
        // Amazon only with Amazon links (on or preview); otherwise the page does not exist.
        const shown = store.amazon ? withMarkets(amazonMode(env)) : Array.isArray(store.sites) && store.sites.length > 0;
        if (shown && !url.pathname.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
        if (shown && store.amazon) return page(amazonStorePage(site, env, store));
        if (shown) {
          let products = [];
          try { products = (await storeProducts(site, store, runtime(), ctx)).products; } catch { products = []; }
          return page(storePage(site, env, store, products, nowMs()));
        }
        // The Amazon page with Amazon links off: 404 without the word Amazon (not even in the canonical address).
        return page(notFoundPage(site, env, '/stores/'), 404);
      }
      const gm = url.pathname.match(/^\/guides\/([a-z0-9-]+)\/?$/);
      if (gm) {
        const slug = gm[1];
        const known = guides.has(slug) || slug === site.checks.slug;
        if (known && !url.pathname.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
        if (guides.has(slug)) return page(guidePage(site, env, guides.get(slug)));
        if (slug === site.checks.slug) return page(checksPage(site, env));
      }
      // Legal pages; the address without the final slash goes to the one with it.
      if (!url.pathname.endsWith('/') && LEGAL[`${url.pathname}/`]) {
        url.pathname = `${url.pathname}/`;
        return redirect(url.toString(), 301);
      }
      if (LEGAL[url.pathname]) return page(legalPage(site, env, url.pathname));
      if (env && env.ASSETS && url.pathname.startsWith('/assets/')) return env.ASSETS.fetch(request);
      return page(notFoundPage(site, env, url.pathname), 404);
    }
  };
}
