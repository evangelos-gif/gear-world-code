#!/usr/bin/env node
// Gear World Hub - Stores (owner's option B, 16 Nov 2026, lessons L166).
// One page per big retailer and a list of them, inside the Hub (no new site, no new domain):
//   sites/gwh/public/stores/index.html          the list, by the country the retailers deliver to
//   sites/gwh/public/stores/<slug>/index.html   one page per retailer: where it delivers, its codes and sales with
//                                                  their end dates, and the Gear World sites that list its products
// The data is sites/gwh/stores/stores.json. Like the gift guides, the Hub links only to Gear World sites: the
// search of a site filtered by the retailer (/search?q=<name>&retailer=<name>) and the site's /discount-codes/<slug>/
// page. Never /out/, /go/ or a retailer's own address, so the Hub still has no affiliate link of its own (L103).
// The visitor's country: a retailer that delivers only outside the UK gets links with ?for=<cc> (L160), so the site
// opens in that country's view (in the UK view the products would not be listed).
// Codes, sales and banners carry their end date; /stores/stores.js hides any whose day has passed, so a page
// never shows an expired code even before it is built again. A banner (none yet) is a picture checked by the Manager,
// marked "Ad", that links to a Gear World page only.
//
// Usage:
//   node tools/gwh-stores.mjs build                  writes the pages from stores.json (nothing goes online)
//   node tools/gwh-stores.mjs validate               OFFLINE: is stores.json still valid today (UK day)? Exit 20
//                                                      when an offer or banner has ended: the Hub tool refuses the live
//                                                      step then, because the titles and counts would still name it
//   node tools/gwh-stores.mjs check [--out <file>]   READ-ONLY: GET of every site link (still 20+ products of that
//                                                      retailer in its country's view) and every code or sale (still on
//                                                      the site's page, with the same end date)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA_FILE = fileURLToPath(new URL('../sites/gwh/stores/stores.json', import.meta.url));
export const PUBLIC_DIR = fileURLToPath(new URL('../sites/gwh/public/', import.meta.url));
const ORIGIN = 'https://gearworldhub.com';
// The same versions as the rest of the Hub (lessons L31: a new ?v= whenever a file changes).
export const ASSETS = {
  legalCss: '/legal/legal.css?v=20261022',
  guidesCss: '/guides/guides.css?v=20261109-1',
  retailersCss: '/stores/stores.css?v=20261116-1',
  retailersJs: '/stores/stores.js?v=20261116-1',
  legalJs: '/legal/legal.js?v=20261103',
  analyticsJs: '/analytics.js?v=20261103-ads2'
};

// The 13 Gear World sites, with the words of their cards on the Hub home page.
export const SITES = {
  cgw: { name: 'Construction Gear World', domain: 'constructiongearworld.com', about: 'Tools, workwear and site equipment.' },
  mgw: { name: "Men's Gear World", domain: 'mensgearworld.com', about: 'Clothing, footwear and accessories.' },
  wgw: { name: "Women's Gear World", domain: 'womensgearworld.com', about: 'Fashion, footwear and accessories.' },
  kgw: { name: "Kids' Gear World", domain: 'kidsgearworld.com', about: 'Clothing, footwear and everyday essentials.' },
  hgw: { name: 'Home Gear World', domain: 'homegearworld.com', about: 'Furniture, lighting and home accessories.' },
  ggw: { name: 'Garden Gear World', domain: 'gardengearworld.com', about: 'Garden tools and outdoor essentials.' },
  tgw: { name: 'Technology Gear World', domain: 'technologygearworld.com', about: 'Laptops, phones, audio and gaming tech.' },
  agw: { name: 'Car Gear World', domain: 'cargearworld.com', about: 'Garage tools, parts, car care and dash cams.' },
  vgw: { name: 'Travel Gear World', domain: 'travelgearworld.com', about: 'Luggage, travel bags, accessories and camping gear.' },
  sgw: { name: 'Sporty Gear World', domain: 'sportygearworld.com', about: 'Fitness, running, cycling, team sports and nutrition.' },
  bgw: { name: 'Biker Gear World', domain: 'bikergearworld.com', about: 'Helmets, riding gear, parts, scooters and e-motorbikes.' },
  pgw: { name: 'Gaming Gear World', domain: 'gaminggearworld.com', about: 'Consoles, gaming PCs, monitors, headsets and chairs.' },
  zgw: { name: 'Pets Gear World', domain: 'petsgearworld.com', about: 'Food, beds, leads, toys and cat trees for pets.' }
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Lessons L103 and L107 for the words of these pages: no shop, partner or sponsor words, no "our retailers", no
// "official", no saving or urgency claims (percentages, previous prices, "hurry").
export const BAD_WORDS = /\bshops?\b|shopping|\bpartners?\b|partnership|sponsor|our retailers|our stores?|trusted|official|authori[sz]ed|buy now|free (delivery|shipping)|we (deliver|ship)\b|\d+\s?%|previous price|<s>|was £|hurry|last chance|ends soon/i;

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const day = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
// The retailer's name is never translated (L103). Inside a button (inline-flex) the words around it sit in one more
// span, or the spaces next to the name are dropped ("SeeTooled Upproducts").
const name = r => `<span translate="no">${esc(r.name)}</span>`;

export function loadData(file = DATA_FILE) { return JSON.parse(readFileSync(file, 'utf8')); }

// Today in the UK (yyyy-mm-dd). GW_STORES_TODAY fixes the day for tests/run-tests.ps1 only.
export function londonToday() {
  if (/^\d{4}-\d{2}-\d{2}$/.test(process.env.GW_STORES_TODAY || '')) return process.env.GW_STORES_TODAY;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const MIN_PRODUCTS = 20;

// The Gear World page with this retailer's products on a site, in the view of the country it delivers to.
export function siteLink(r, code) {
  const site = SITES[code];
  const u = new URL(`https://${site.domain}/search`);
  u.searchParams.set('q', r.name);
  u.searchParams.set('retailer', r.name);
  if (!r.deliversTo.includes('GB')) u.searchParams.set('for', r.deliversTo[0].toLowerCase());
  return u.toString();
}
export const codesLink = (r, code) => `https://${SITES[code].domain}/discount-codes/${r.slug}/`;
const isGearWorld = href => /^https:\/\/([a-z]+gearworld\.com|gearworldhub\.com)\//.test(href) && !/\/(out|go)\//.test(href);

// Everything a page may hold, checked before a page is written: returns the problems (empty = fine).
// today: the day the offers must still run on (the build and the Hub tool give the UK day; the tests the data's own day).
export function validate(data, today = data.checked) {
  const problems = [];
  if (data.checked && today < data.checked) today = data.checked;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || '')) problems.push('checked: a date like 2026-11-16');
  const slugs = new Set();
  for (const r of data.retailers || []) {
    const at = r.slug || '(no slug)';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug || '')) problems.push(`${at}: slug of small letters, digits and dashes`);
    if (slugs.has(r.slug)) problems.push(`${at}: the same slug twice`);
    slugs.add(r.slug);
    if (!r.name || !r.about) problems.push(`${at}: name and about`);
    if (!Array.isArray(r.deliversTo) || !r.deliversTo.length || r.deliversTo.some(c => !data.countries[c])) problems.push(`${at}: deliversTo with countries of the "countries" list`);
    if (!Array.isArray(r.sites) || !r.sites.length || r.sites.some(s => !SITES[s]) || new Set(r.sites).size !== r.sites.length) problems.push(`${at}: sites, each a Gear World site once`);
    for (const o of r.offers || []) {
      if (!['code', 'sale'].includes(o.kind)) problems.push(`${at}: an offer is a code or a sale`);
      if (o.kind === 'code' && !/^[A-Z0-9-]{3,30}$/.test(o.code || '')) problems.push(`${at}: a code of capital letters and digits`);
      if (!o.title || !SITES[o.site] || !(r.sites || []).includes(o.site)) problems.push(`${at}: an offer has a title and the site that shows it`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.end || '')) problems.push(`${at}: an offer has an end date like 2026-12-06`);
      else if (o.end < today) problems.push(`${at}: the offer "${o.code || o.title}" ended on ${o.end} (take it out of stores.json and build again)`);
    }
    const b = r.banner;
    if (b) {
      if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(b.image || '') || !existsSync(`${PUBLIC_DIR}stores/banners/${b.image}`)) problems.push(`${at}: the banner picture is a file in public/stores/banners/`);
      if (!b.alt || !Number.isInteger(b.width) || !Number.isInteger(b.height)) problems.push(`${at}: the banner has alt, width and height`);
      if (!isGearWorld(b.href || '')) problems.push(`${at}: the banner links to a Gear World page only (never /out/, /go/ or the retailer)`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.end || '')) problems.push(`${at}: the banner has an end date like 2026-12-06`);
      else if (b.end < today) problems.push(`${at}: the banner ended on ${b.end} (take it out of stores.json and build again)`);
      if (!/^Manager \d{4}-\d{2}-\d{2}$/.test(b.checked || '')) problems.push(`${at}: the banner was checked by the Manager (checked: "Manager <date>")`);
      if (BAD_WORDS.test(b.alt || '')) problems.push(`${at}: the banner text has words of L103/L107`);
    }
    const words = [r.name, r.about, ...(r.offers || []).map(o => o.title)].join(' ');
    const bad = words.match(BAD_WORDS);
    if (bad) problems.push(`${at}: "${bad[0]}" (L103/L107)`);
  }
  return problems;
}

// head() and FOOT are shared with tools/gwh-black-friday.mjs (the /black-friday/ page, lessons L188).
export function head({ title, description, path, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${ORIGIN}${path}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${path}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${ASSETS.legalCss}">
<link rel="stylesheet" href="${ASSETS.guidesCss}">
<link rel="stylesheet" href="${ASSETS.retailersCss}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="lg-header">
  <div class="lg-wrap"><a class="lg-brand" href="/">Gear <span>World</span> Hub</a></div>
</header>`;
}

export const FOOT = `<footer class="lg-footer">
  <div class="lg-wrap">
    <nav class="lg-legal" aria-label="Legal">
      <a href="/about/">About</a>
      <a href="/privacy/">Privacy</a>
      <a href="/cookies/">Cookies</a>
      <a href="/terms/">Terms</a>
      <a href="/affiliate-disclosure/">Affiliate disclosure</a>
      <a href="/contact/">Contact</a>
    </nav>
    <p><a href="mailto:contact@gearworldhub.com">contact@gearworldhub.com</a></p>
    <p>&copy; <span id="lgYear">2026</span> Gear World · Run by Evangelos Kalogerakis, United Kingdom · We don't sell products: we link to retailers and may earn a commission.</p>
  </div>
</footer>
<script src="${ASSETS.retailersJs}" defer></script>
<script src="${ASSETS.legalJs}" defer></script>
<script src="${ASSETS.analyticsJs}"></script>
</body>
</html>
`;

const countryOf = (data, r) => r.deliversTo.map(c => data.countries[c]).join(', ');
// Each Gear World site lists only what delivers to the visitor's country (L151, L160).
const viewNote = (data, r) => (r.deliversTo.includes('GB')
  ? `Each Gear World site lists only the products that deliver to your country: outside ${esc(countryOf(data, r))}, these links may show none.`
  : `The links open each Gear World site in its ${esc(data.countries[r.deliversTo[0]])} view, with only the products that deliver there.`);
const offerCount = r => {
  const codes = r.offers.filter(o => o.kind === 'code').length;
  const sales = r.offers.length - codes;
  const parts = [];
  if (codes) parts.push(`${codes} discount code${codes > 1 ? 's' : ''}`);
  if (sales) parts.push(`${sales} sale${sales > 1 ? 's' : ''}`);
  return parts.join(' and ');
};
const onSites = r => `On ${r.sites.length} Gear World site${r.sites.length > 1 ? 's' : ''}`;
// " · discount codes until 6 Dec 2026" / " · sales until 31 Dec 2026": each with the last end date of its kind, so
// stores.js hides it when that kind has ended (no count that could stay after an offer ended).
const offerTags = r => ['code', 'sale'].map(kind => {
  const ends = r.offers.filter(o => o.kind === kind).map(o => o.end).sort();
  if (!ends.length) return '';
  const last = ends[ends.length - 1];
  return `<span data-end="${last}"> · ${kind === 'code' ? 'discount codes' : 'sales'} until ${day(last)}</span>`;
}).join('');
// "12 Gear World sites list its products" / "1 Gear World site lists its products"
const sitesList = r => (r.sites.length > 1 ? `${r.sites.length} Gear World sites list` : '1 Gear World site lists');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const offersTitle = r => {
  const codes = r.offers.some(o => o.kind === 'code');
  const sales = r.offers.some(o => o.kind === 'sale');
  return codes && sales ? 'Discount codes and sales' : codes ? 'Discount codes' : 'Sales';
};

function offerItem(r, o) {
  const what = o.kind === 'code'
    ? `Code <strong class="rt-code" translate="no">${esc(o.code)}</strong>: ${esc(o.title)}`
    : `Sale: ${esc(o.title)}`;
  const how = o.kind === 'code' ? 'Copy the code on the site page' : 'No code needed';
  return `      <li class="gd-item rt-item rt-offer" data-end="${o.end}">
        <div class="gd-body">
          <h3>${what}</h3>
          <p class="gd-why">Valid until ${day(o.end)} · ${how}</p>
          <a class="gd-btn" href="${esc(codesLink(r, o.site))}">See it on ${esc(SITES[o.site].name)}</a>
        </div>
      </li>`;
}

function siteItem(r, code) {
  const s = SITES[code];
  const href = esc(siteLink(r, code));
  return `      <li class="gd-item rt-item rt-site">
        <div class="gd-body">
          <h3><a href="${href}">${esc(s.name)}</a></h3>
          <p class="gd-why">${esc(s.about)}</p>
          <a class="gd-btn gd-btn-ghost" href="${href}"><span>See ${name(r)} products</span></a>
        </div>
      </li>`;
}

function bannerBlock(r) {
  const b = r.banner;
  if (!b) return '';
  return `
    <aside class="rt-banner" data-end="${b.end}" aria-label="Advertisement">
      <span class="rt-ad">Ad</span>
      <a href="${esc(b.href)}"><img src="/stores/banners/${esc(b.image)}" alt="${esc(b.alt)}" width="${b.width}" height="${b.height}" loading="lazy" decoding="async"></a>
      <p class="rt-banner-end">Until ${day(b.end)}</p>
    </aside>`;
}

export function retailerPage(data, r) {
  const where = countryOf(data, r);
  const title = r.offers.length
    ? `${r.name}: ${offersTitle(r).toLowerCase()} and products on Gear World | Gear World Hub`
    : `${r.name} products on Gear World: where to find them | Gear World Hub`;
  const description = `${r.name} delivers to ${where}. ${sitesList(r)} its products, with prices and stock checked on each site.`
    + (r.offers.length ? ` ${cap(offerCount(r))} with end dates.` : '');
  const path = `/stores/${r.slug}/`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Stores', item: `${ORIGIN}/stores/` },
      { '@type': 'ListItem', position: 3, name: r.name, item: `${ORIGIN}${path}` }
    ]
  };
  const offerBlock = r.offers.length ? `
    <section class="gd-group rt-offers" aria-labelledby="rt-offers-h">
      <h2 id="rt-offers-h">${offersTitle(r)}</h2>
      <ul class="gd-list">
${r.offers.map(o => offerItem(r, o)).join('\n')}
      </ul>
      <p class="gd-note rt-none" hidden>Nothing running right now. Check back soon.</p>
      <p class="gd-note">Published by ${name(r)} through its affiliate programme. ${name(r)} sets the final terms, so check the discount before you pay.</p>
    </section>` : '';
  const body = `
<main class="lg-wrap lg-main gd-main">
  <nav class="lg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/stores/">Stores</a> <span aria-hidden="true">/</span> <span translate="no">${esc(r.name)}</span></nav>
  <article class="gd-article">
    <h1>${name(r)} on Gear World</h1>
    <p class="gd-lead">${esc(r.about)} ${name(r)} delivers to ${esc(where)}. ${sitesList(r)} its products, with the price and stock each site last checked.</p>
    <p class="gd-checked">Delivers to: ${esc(where.replace(/^the /, ''))}</p>${bannerBlock(r)}${offerBlock}
    <section class="gd-group" aria-labelledby="rt-sites-h">
      <h2 id="rt-sites-h">Where to find ${name(r)} products</h2>
      <p class="gd-note">${viewNote(data, r)}</p>
      <ul class="gd-list">
${r.sites.map(code => siteItem(r, code)).join('\n')}
      </ul>
    </section>
    <div class="gd-tips">
      <p class="gd-tip"><strong>How it works:</strong> Gear World does not sell anything. Each Gear World site shows the price and stock it last checked, and its button takes you to ${name(r)}, where you check the final price and delivery before you buy.</p>
    </div>
    <p class="gd-note"><a href="/stores/">All stores on Gear World</a></p>
  </article>
</main>
`;
  return `${head({ title, description, path, jsonLd })}${body}${FOOT}`;
}

export function indexPage(data) {
  const byCountry = new Map();
  for (const r of data.retailers) {
    const c = r.deliversTo.includes('GB') ? 'GB' : r.deliversTo[0];
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c).push(r);
  }
  const order = [...byCountry.keys()].sort((a, b) => (a === 'GB' ? -1 : b === 'GB' ? 1 : a.localeCompare(b)));
  const names = data.retailers.slice(0, 3).map(r => r.name).join(', ');
  const title = `Stores on Gear World: ${names} and more | Gear World Hub`;
  const description = `${names} and other stores on the 13 Gear World sites: where each delivers, its codes and sales, and where to find its products.`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Stores on Gear World', url: `${ORIGIN}/stores/`,
    numberOfItems: data.retailers.length,
    itemListElement: data.retailers.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/stores/${r.slug}/`, name: r.name }))
  };
  const item = r => `      <li class="gd-item rt-item">
        <div class="gd-body">
          <h3><a href="/stores/${r.slug}/">${name(r)}</a></h3>
          <p class="gd-why">${esc(r.about)}</p>
          <p class="rt-meta">${onSites(r)}${offerTags(r)}</p>
          <a class="gd-btn" href="/stores/${r.slug}/"><span>See ${name(r)}</span></a>
        </div>
      </li>`;
  const groups = order.map(c => `
    <section class="gd-group" aria-labelledby="rt-${c.toLowerCase()}-h">
      <h2 id="rt-${c.toLowerCase()}-h">Stores that deliver to ${esc(data.countries[c])}</h2>
      <ul class="gd-list">
${byCountry.get(c).map(item).join('\n')}
      </ul>
    </section>`).join('');
  const body = `
<main class="lg-wrap lg-main gd-main">
  <nav class="lg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span>Stores</span></nav>
  <article class="gd-article">
    <h1>Stores on Gear World</h1>
    <p class="gd-lead">Big stores listed across the 13 Gear World sites: where each one delivers, its discount codes and sales with their end dates, and which Gear World sites list its products.</p>
    <p class="gd-checked">Checked ${day(data.checked)}.</p>${groups}
    <p class="gd-note">Looking for something else? <a href="/">Search every Gear World</a> from the home page.</p>
  </article>
</main>
`;
  return `${head({ title, description, path: '/stores/', jsonLd })}${body}${FOOT}`;
}

// relative path under public/ -> file text
export function buildPages(data) {
  const problems = validate(data);
  if (problems.length) throw new Error('stores.json: ' + problems.join('; '));
  const pages = { 'stores/index.html': indexPage(data) };
  for (const r of data.retailers) pages[`stores/${r.slug}/index.html`] = retailerPage(data, r);
  return pages;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'GearWorldQA-bot/1.0 (+read-only check)', ...headers } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
async function getText(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'GearWorldQA-bot/1.0 (+read-only check)', ...headers } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

// READ-ONLY: every site still lists the retailer in the view of its country, every code is still on its site page.
export async function check(outFile = '', data = loadData()) {
  const lines = [`Stores of the Hub, live check (GET only) of ${data.retailers.length} retailers, data of ${data.checked}`];
  let problems = 0;
  for (const r of data.retailers) {
    const cc = r.deliversTo.includes('GB') ? 'GB' : r.deliversTo[0];
    for (const code of r.sites) {
      const u = `https://${SITES[code].domain}/api/products?retailer=${encodeURIComponent(r.name)}&deliver_to=${cc}&limit=1`;
      try {
        const j = await getJson(u, { 'X-GW-QA-Country': cc });
        const n = (j.pagination && j.pagination.total) || 0;
        if (n >= MIN_PRODUCTS) lines.push(`OK ${r.name} ${code.toUpperCase()}: ${n} products in the ${cc} view`);
        else { problems++; lines.push(`FEW ${r.name} ${code.toUpperCase()}: ${n} products in the ${cc} view, under ${MIN_PRODUCTS} (take the site out of stores.json)`); }
      } catch (e) { problems++; lines.push(`ERROR ${r.name} ${code.toUpperCase()}: ${e.message}`); }
    }
    for (const o of r.offers) {
      const what = o.kind === 'code' ? `code ${o.code}` : `sale ${o.title}`;
      try {
        const html = await getText(codesLink(r, o.site), { 'X-GW-QA-Country': cc });
        const there = o.kind === 'code' ? html.includes(o.code) : html.includes(esc(o.title));
        const until = html.includes(`Valid until ${day(o.end)}`);
        if (there && until) lines.push(`OK ${r.name} ${what} on ${o.site.toUpperCase()}, until ${day(o.end)}`);
        else if (there) { problems++; lines.push(`DATE ${r.name} ${what}: the site page has no "Valid until ${day(o.end)}"`); }
        else { problems++; lines.push(`GONE ${r.name} ${what}: not on ${codesLink(r, o.site)} any more`); }
      } catch (e) { problems++; lines.push(`ERROR ${r.name} ${what}: ${e.message}`); }
    }
  }
  lines.push('', problems ? `${problems} problem(s): update stores.json, then node tools/gwh-stores.mjs build` : 'Every link and code as in stores.json.');
  const text = lines.join('\n') + '\n';
  if (outFile) writeFileSync(outFile, text);
  process.stdout.write(text);
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd] = process.argv.slice(2);
  const outIdx = process.argv.indexOf('--out');
  if (cmd === 'build') {
    const data = loadData();
    const stale = validate(data, londonToday());
    if (stale.length) { console.log('stores.json: ' + stale.join('; ')); process.exit(20); }
    const pages = buildPages(data);
    // A retailer taken out of stores.json loses its page too.
    const dir = PUBLIC_DIR + 'stores/';
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'banners' && !data.retailers.some(r => r.slug === entry.name)) {
          rmSync(dir + entry.name, { recursive: true });
          console.log('removed sites/gwh/public/stores/' + entry.name + '/');
        }
      }
    }
    for (const [rel, html] of Object.entries(pages)) {
      const file = PUBLIC_DIR + rel;
      mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
      writeFileSync(file, html);
      console.log('wrote sites/gwh/public/' + rel);
    }
  } else if (cmd === 'validate') {
    const today = londonToday();
    const problems = validate(loadData(), today);
    if (problems.length) { for (const p of problems) console.log('ENDED ' + p); process.exitCode = 20; }
    else console.log(`OK stores.json is valid on ${today}`);
  } else if (cmd === 'check') {
    const n = await check(outIdx > 0 ? process.argv[outIdx + 1] : '');
    process.exitCode = n ? 20 : 0;
  } else {
    console.log('Usage: node tools/gwh-stores.mjs build | validate | check [--out <file>]');
    process.exitCode = 2;
  }
}
