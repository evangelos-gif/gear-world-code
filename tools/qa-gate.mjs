#!/usr/bin/env node
// Gear World QA gate. READ-ONLY: only GET requests.
// Checks a running site against the rules in docs/LESSONS.md and exits 1 if any rule fails.
//
// Usage:
//   node tools/qa-gate.mjs <baseUrl> --site sites/tgw [--prelaunch] [--live] [--out report.txt]
//   node tools/qa-gate.mjs https://mensgearworld.com --config-free --domain mensgearworld.com   (audit an older site)
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeGtin } from '../src/lib/gtin.js';

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8787').replace(/\/$/, '');
const opt = name => args.includes(`--${name}`);
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };

const siteDir = val('site');
let site = null;
if (siteDir) site = (await import(pathToFileURL(resolve(siteDir, 'site.config.js')).href)).default;
const domain = val('domain') || (site ? site.domain : new URL(base).hostname);
const canonicalOrigin = `https://${domain}`;

const results = [];
function check(lesson, ok, name, detail = '') {
  results.push({ lesson, ok: Boolean(ok), name, detail });
}

async function get(path, { redirect = 'manual', method = 'GET' } = {}) {
  const url = path.startsWith('http') ? path : base + path;
  // "bot" in the user agent: our Worker never records a click from this checker.
  const r = await fetch(url, { method, redirect, headers: { 'User-Agent': 'GearWorldQA-bot/1.0 (+read-only check)' } });
  const body = r.status === 204 ? '' : await r.text();
  return { status: r.status, headers: r.headers, body, url };
}

// ---------- HTML helpers (regex based; pages are generated, so this is predictable) ----------
const stripNetwork = h => h.replace(/<section data-gw-network[\s\S]*?<\/section>/g, '');
const all = (h, re) => [...h.matchAll(re)];
const textOf = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const title = h => textOf((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
const canonical = h => (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
const robots = h => (h.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || 'index,follow';
const jsonLd = h => all(h, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map(m => {
  try { return JSON.parse(m[1]); } catch { return { __invalid: true }; }
});

const pageTitles = new Map();

function htmlChecks(path, res, { expectStatus = 200, indexable = true } = {}) {
  const h = res.body;
  const ct = res.headers.get('content-type') || '';
  check('L05', res.status === expectStatus, `${path}: status ${expectStatus}`, `got ${res.status}`);
  check('L05', /text\/html/i.test(ct) && /charset=utf-8/i.test(ct), `${path}: Content-Type has charset=utf-8`, ct);
  for (const hname of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'content-security-policy']) {
    check('L06', res.headers.has(hname), `${path}: header ${hname}`);
  }
  const kb = Buffer.byteLength(h) / 1024;
  check('L02', kb < 100, `${path}: HTML under 100 KB`, `${kb.toFixed(1)} KB`);
  const styleTags = all(h, /<style\b/g).length;
  const inlineScripts = all(h, /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g).length;
  const styleAttrs = all(h, /\sstyle="/g).length;
  check('L02', styleTags === 0 && inlineScripts === 0 && styleAttrs === 0, `${path}: no inline <style>, <script> or style=""`,
    `style tags ${styleTags}, inline scripts ${inlineScripts}, style attributes ${styleAttrs}`);
  const h1 = all(h, /<h1\b/g).length;
  check('L03', h1 === 1, `${path}: exactly one <h1>`, `found ${h1}`);
  const h2s = all(h, /<h2[^>]*>([\s\S]*?)<\/h2>/g).map(m => textOf(m[1]));
  const dupH2 = h2s.filter((x, i) => h2s.indexOf(x) !== i && !/^(Categories|About this site|Gear World network)$/.test(x));
  check('L03', dupH2.length === 0, `${path}: no repeated section headings`, dupH2.join(', '));
  const t = title(h);
  check('L10', t.length >= 10 && t.length <= 110, `${path}: <title> present (10-110 chars)`, t);
  if (indexable && expectStatus === 200 && robots(h).startsWith('index')) {
    const want = canonicalOrigin + path;
    check('L11', canonical(h) === want, `${path}: canonical points to itself`, `${canonical(h)} vs ${want}`);
    if (pageTitles.has(t)) check('L10', false, `${path}: unique <title>`, `same as ${pageTitles.get(t)}`);
    else pageTitles.set(t, path);
  }
  if (site) {
    const body = stripNetwork(h);
    const found = site.foreignMarkers.filter(mk => (/^[A-Z]{3}$/.test(mk) ? new RegExp(`\\b${mk}\\b`) : new RegExp(mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).test(body));
    check('L01', found.length === 0, `${path}: no names or text from other sites`, found.join(', '));
  }
  for (const link of ['/privacy/', '/terms/', '/cookies/', '/how-we-make-money/', '/contact/']) {
    check('L17', h.includes(`href="${link}"`), `${path}: footer links to ${link}`);
  }
  check('L17', h.includes(`&copy; ${new Date().getUTCFullYear()}`), `${path}: footer shows the current year`);
  for (const ld of jsonLd(h)) check('L12', !ld.__invalid, `${path}: JSON-LD is valid JSON`);
}

// ---------- run ----------
const stats = await get('/api/stats');
let total = 0;
try { total = JSON.parse(stats.body).products || 0; } catch { /* old sites */ }
check('L09', stats.status === 200, '/api/stats answers', `status ${stats.status}`);

// Home
const home = await get('/');
htmlChecks('/', home);
const fmtTotal = new Intl.NumberFormat('en-GB').format(total);
check('L09', total === 0 || home.body.includes(fmtTotal), '/: real product count is in the HTML (not filled in later by JavaScript)', `expected ${fmtTotal}`);
check('L09', !/>\s*0\s*(products|PRODUCTS)/.test(home.body) || total === 0, '/: no "0 products" placeholder');

// Categories
const categoryPaths = site ? site.categories.map(c => `/category/${c.slug}/`) : all(home.body, /href="(\/category\/[^"?#]+\/)"/g).map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
let productPaths = [];
for (const p of categoryPaths) {
  const r = await get(p);
  htmlChecks(p, r);
  const cards = all(r.body, /href="(\/product\/[^"]+\/)"/g).map(m => m[1]);
  check('L10', total === 0 || cards.length > 0 || r.body.includes('No products match'), `${p}: products are in the HTML`, `${cards.length} product links`);
  productPaths.push(...cards.slice(0, 1));
}

// Product pages
productPaths = [...new Set(productPaths)].slice(0, 6);
for (const p of productPaths) {
  const r = await get(p);
  htmlChecks(p, r);
  const out = r.body.match(/<a class="btn btn-deal[^"]*" href="(\/out\/\d+)" rel="([^"]+)"/);
  check('L20', Boolean(out), `${p}: has a button to the retailer (/out/<id>)`);
  if (out) check('L20', /sponsored/.test(out[2]) && /nofollow/.test(out[2]), `${p}: retailer link is rel="sponsored nofollow"`, out[2]);
  const prod = jsonLd(r.body).find(x => x['@type'] === 'Product');
  check('L12', Boolean(prod), `${p}: Product structured data present`);
  if (prod) {
    const gtinKeys = Object.keys(prod).filter(k => /^gtin/.test(k));
    for (const k of gtinKeys) check('L12', normalizeGtin(prod[k]) === String(prod[k]), `${p}: ${k} passes the GS1 check digit`, String(prod[k]));
    check('L12', prod.offers && Number(prod.offers.price) > 0, `${p}: offer has a price`);
  }
  // Only on sites built from this repo: older sites might record a click even for a check, so they are skipped.
  if (out && site) {
    const o = await get(out[1], { method: 'HEAD' });
    const loc = o.headers.get('location') || '';
    check('L15', o.status === 302 && /^https?:\/\//.test(loc), `${out[1]}: redirects to the retailer`, `${o.status} ${loc.slice(0, 80)}`);
    check('L15', /noindex/i.test(o.headers.get('x-robots-tag') || ''), `${out[1]}: X-Robots-Tag noindex`);
    if (/awin1\.com/.test(loc)) check('L15', /[?&]clickref=/.test(loc), `${out[1]}: Awin link carries a clickref`);
  }
}

// Deals, info, search, 404
for (const p of ['/deals/', '/about/', '/how-we-make-money/', '/contact/', '/privacy/', '/cookies/', '/terms/']) {
  const r = await get(p);
  htmlChecks(p, r);
  if (opt('prelaunch')) check('L17', !r.body.includes('To be completed before launch'), `${p}: no placeholder text`);
}
const search = await get('/search?q=usb');
htmlChecks('/search?q=usb', search, { indexable: false });
check('L10', /noindex/.test(robots(search.body)), '/search: noindex');
const missing = await get('/this-page-does-not-exist-qa');
htmlChecks('/this-page-does-not-exist-qa', missing, { expectStatus: 404, indexable: false });

// robots and sitemaps
const rb = await get('/robots.txt');
check('L10', rb.status === 200 && /Sitemap: https:\/\//.test(rb.body), '/robots.txt lists the sitemap');
check('L15', /Disallow: \/out\//.test(rb.body), '/robots.txt blocks /out/');
const sm = await get('/sitemap.xml');
const maps = all(sm.body, /<loc>([^<]+)<\/loc>/g).map(m => m[1]);
check('L10', sm.status === 200 && maps.length >= 1, '/sitemap.xml is a sitemap index', `${maps.length} sitemaps`);
let productUrls = 0;
let staticUrls = [];
for (const m of maps) {
  const path = new URL(m).pathname;
  const r = await get(path);
  const locs = all(r.body, /<loc>([^<]+)<\/loc>/g).map(x => x[1]);
  if (/sitemap-static/.test(path)) staticUrls = locs;
  else productUrls += locs.length;
  check('L11', locs.every(l => l.startsWith(canonicalOrigin + '/')), `${path}: every URL uses ${canonicalOrigin}`);
}
check('L10', productUrls === total, 'sitemaps list every active product', `${productUrls} URLs, ${total} products`);
for (const p of categoryPaths) check('L10', staticUrls.includes(canonicalOrigin + p), `sitemap-static lists ${p}`);

// public/ allowlist (lessons L04)
if (siteDir) {
  const pubDir = join(siteDir, 'public');
  const allow = readFileSync(join(siteDir, 'public-allowlist.txt'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const toRe = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
  const walk = d => readdirSync(d).flatMap(n => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
  const files = existsSync(pubDir) ? walk(pubDir).map(f => relative(pubDir, f).split('\\').join('/')) : [];
  const extra = files.filter(f => !allow.some(a => toRe(a).test(f)));
  check('L04', extra.length === 0, 'public/ only has allowed files', extra.join(', '));
}

// Gear World Hub search (lessons L22): the hub reads /api/products and links to /?search=<q>&highlight=<id>
if (site) {
  const api = await get('/api/products?search=a&page=1&limit=8');
  let first = null;
  try { first = (JSON.parse(api.body).products || [])[0] || null; } catch { first = null; }
  const need = ['id', 'product_name', 'brand', 'retailer', 'site_category', 'price', 'currency', 'stock_status', 'image_url'];
  check('L22', api.status === 200 && (total === 0 || (first && need.every(k => k in first))), '/api/products: has the fields the hub search reads', first ? Object.keys(first).join(',') : String(api.status));
  if (first) {
    const h = await get(`/?search=x&highlight=${first.id}`);
    const loc = h.headers.get('location') || '';
    check('L22', h.status === 302 && new RegExp(`-${first.id}/$`).test(loc), '/?highlight=<id> (hub link) opens that product', `${h.status} ${loc}`);
  }
  const s = await get('/?search=laptop');
  check('L22', s.status === 302 && /\/search\?q=laptop$/.test(s.headers.get('location') || ''), '/?search=<q> (hub link) opens the search page', `${s.status} ${s.headers.get('location')}`);
}

// Compare 2-4 products (lessons L23): the site says "compare", so the tool must exist and be honest.
if (site) {
  check('L23', /data-compare="\d+"/.test(home.body), '/: product cards have a Compare button');
  const cat = site.categories[0] ? site.categories[0].slug : '';
  const list = await get(`/api/products?category=${cat}&limit=3`);
  let ps = [];
  try { ps = JSON.parse(list.body).products || []; } catch { ps = []; }
  if (ps.length >= 2) {
    const c = await get(`/compare/?ids=${ps[0].id},${ps[1].id}`);
    check('L23', c.status === 200, '/compare/: opens with 2 products', String(c.status));
    check('L23', /<meta name="robots" content="noindex/.test(c.body), '/compare/: noindex (address changes with the products)');
    check('L23', (c.body.match(/href="\/out\/\d+" rel="sponsored nofollow/g) || []).length >= 2, '/compare/: a retailer button for every product');
    check('L23', c.body.includes('Our pick') || c.body.includes('we do not pick one'), '/compare/: our pick, or why there is none');
    check('L23', c.body.includes('How we pick:'), '/compare/: the pick rule is shown');
  }
  const bad = await get('/compare/?ids=abc,0,-1');
  check('L23', bad.status === 200 && bad.body.includes('Choose 2 to'), '/compare/: bad ids show the help text');
}

// Languages (lessons L24): the same 11 as the hub, one small dictionary file per language.
if (site && (site.languages || []).length > 1) {
  const sel = (home.body.match(/<select data-pref="lang"[\s\S]*?<\/select>/) || [''])[0];
  const codes = all(sel, /<option value="([^"]+)"/g).map(m => m[1]);
  check('L24', codes.length === site.languages.length, `/: language picker lists ${site.languages.length} languages`, codes.join(','));
  check('L24', /<html lang="en-GB"/.test(home.body), '/: pages are written in English by the server (one canonical page per address)');
  for (const l of site.languages.filter(x => x.code !== 'en-GB')) {
    const r = await get(`/assets/i18n/${l.code}.json?v=${encodeURIComponent(site.assetVersion)}`, { redirect: 'follow' });
    let n = 0;
    try { n = Object.keys(JSON.parse(r.body)).length; } catch { n = 0; }
    check('L24', r.status === 200 && n > 0, `/assets/i18n/${l.code}.json loads`, `${r.status}, ${n} texts`);
  }
  check('L24', /translate="no"/.test(home.body), '/: product names, brands and retailers are marked translate="no"');
}

// Currencies (lessons L25): prices stay in the retailer's currency, with "≈" in the visitor's currency.
if (site && (site.displayCurrencies || []).length > 1) {
  const sel = (home.body.match(/<select data-pref="currency"[\s\S]*?<\/select>/) || [''])[0];
  const codes = all(sel, /<option value="([^"]+)"/g).map(m => m[1]);
  check('L25', codes.join(',') === site.displayCurrencies.join(','), `/: currency picker lists ${site.displayCurrencies.join(', ')}`, codes.join(','));
  check('L25', /data-price="\d+\.\d{2}" data-currency="[A-Z]{3}"/.test(home.body), '/: prices carry data-price for the converted price');
  const fx = await get('/api/fx');
  let d = null;
  try { d = JSON.parse(fx.body); } catch { d = null; }
  check('L25', fx.status === 200 && d && d.base === site.currency && typeof d.rates === 'object', '/api/fx answers with the site currency as base', fx.body.slice(0, 120));
  if (d && d.ok) {
    const others = site.displayCurrencies.filter(c => c !== site.currency);
    check('L25', others.every(c => Number(d.rates[c]) > 0), '/api/fx has a rate for every display currency', JSON.stringify(d.rates));
  }
}

// Gear Cart (lessons L26): a list in the browser; every buy button goes through /out/<id>.
if (site && site.cart) {
  check('L26', /data-cart="\d+"/.test(home.body), '/: product cards have a + Cart button');
  check('L26', /href="\/cart\/"[^>]*data-cart-link/.test(home.body), '/: header links to the cart');
  const cat = site.categories[0] ? site.categories[0].slug : '';
  const list = await get(`/api/products?category=${cat}&limit=2`);
  let ps = [];
  try { ps = JSON.parse(list.body).products || []; } catch { ps = []; }
  if (ps.length) {
    const c = await get(`/cart/?items=${ps.map((p, i) => `${p.id}:${i + 2}`).join(',')},abc,0:5`);
    htmlChecks('/cart/?items=…', c, { indexable: false });
    check('L26', /<meta name="robots" content="noindex/.test(c.body), '/cart/: noindex');
    const outs = (c.body.match(/href="\/out\/\d+" rel="sponsored nofollow/g) || []).length;
    check('L26', outs === ps.length, '/cart/: a retailer button through /out/ for every item', `${outs} buttons, ${ps.length} items`);
    check('L26', !/awin1\.com/.test(c.body), '/cart/: no direct affiliate links (clicks must go through /out/)');
    check('L26', c.body.includes(`data-cart-items="${ps.map((p, i) => `${p.id}:${i + 2}`).join(',')}"`), '/cart/: bad items are dropped, good ones kept with their quantity');
  }
  const empty = await get('/cart/');
  check('L26', empty.status === 200 && /is empty/.test(empty.body), '/cart/: empty cart explains what to do');
  check('L26', /Disallow: \/cart\//.test(rb.body), '/robots.txt blocks /cart/');
}

// Voice search: the microphone is allowed for this site's own pages only.
if (site && site.voiceSearch) {
  check('L06', /microphone=\(self\)/.test(home.headers.get('permissions-policy') || ''), 'Permissions-Policy allows the microphone for this site only', home.headers.get('permissions-policy'));
  check('L06', /camera=\(\)/.test(home.headers.get('permissions-policy') || ''), 'Permissions-Policy keeps the camera off until camera search exists');
  check('L22', /data-voice/.test(home.body), '/: search boxes have a microphone button');
}

// Launch readiness
if (opt('prelaunch') && site) {
  for (const k of ['contactEmail', 'operatorName']) check('L17', Boolean(site[k]), `config: ${k} is filled in`);
  // The newsletter form is shown only when Turnstile is set up; launching without it is allowed.
  check('L17', !/id="news-h"/.test(home.body) || Boolean(site.turnstileSiteKey), '/: newsletter form only with Turnstile');
}

// Live-only checks: one canonical host with a single redirect (lessons L11)
if (opt('live')) {
  const www = await fetch(`https://www.${domain}/`, { redirect: 'manual' });
  check('L11', www.status === 301 && (www.headers.get('location') || '').startsWith(`${canonicalOrigin}/`), `www.${domain} redirects 301 to ${canonicalOrigin}`, `${www.status} ${www.headers.get('location')}`);
  const http = await fetch(`http://${domain}/`, { redirect: 'manual' });
  check('L11', [301, 308].includes(http.status), `http://${domain} redirects to https`, String(http.status));
}

// ---------- report ----------
const failed = results.filter(r => !r.ok);
const lines = [
  `GEAR WORLD QA GATE (read-only) ${new Date().toISOString()}`,
  `Base: ${base} | Domain: ${domain} | Checks: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`,
  ''
];
const byLesson = {};
for (const r of results) (byLesson[r.lesson] = byLesson[r.lesson] || []).push(r);
for (const lesson of Object.keys(byLesson).sort()) {
  const rs = byLesson[lesson];
  const bad = rs.filter(r => !r.ok);
  lines.push(`${bad.length ? 'FAIL' : 'PASS'} ${lesson} (${rs.length - bad.length}/${rs.length})`);
  for (const r of bad) lines.push(`   x ${r.name}${r.detail ? ` [${r.detail}]` : ''}`);
}
const report = lines.join('\n') + '\n';
process.stdout.write(report);
if (val('out')) writeFileSync(val('out'), report);
process.exit(failed.length ? 1 : 0);
