#!/usr/bin/env node
// Gear World Hub - Christmas gift guides (owner, 27/10/2026 and the Manager, 4/11/2026).
// The 5 guides live as data in sites/gwh/guides/guides.json; this script turns them into static pages of the Hub:
//   sites/gwh/public/guides/index.html            the list of guides
//   sites/gwh/public/guides/<slug>/index.html     one page per guide
// Gear World is the hero: every product links to its page on a Gear World site (never /out/ or /go/), the retailer is
// only in the small print, prices carry "Prices checked <dates>, may change", and nobody claims to have tested anything.
// Lessons L107 (Google Ads compliance, 9 Nov 2026): no struck-through "previous" price and no "N% below" or "biggest
// saving": a feed's RRP shows as "RRP £x" (item.rrp), and the check dates are the days each product was last checked on
// its site (item.checked, from the site's database), not one date for the whole page.
//
// Usage:
//   node tools/gwh-guides.mjs build                  writes the pages from guides.json (nothing goes online)
//   node tools/gwh-guides.mjs check [--out <file>]   READ-ONLY: opens every product page (GET) and compares price,
//                                                    stock and RRP with guides.json
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_FILE = fileURLToPath(new URL('../sites/gwh/guides/guides.json', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../sites/gwh/public/', import.meta.url));
const ORIGIN = 'https://gearworldhub.com';
// The same versions as the rest of the Hub (lessons L31: a new ?v= whenever a file changes).
export const ASSETS = { legalCss: '/legal/legal.css?v=20261022', guidesCss: '/guides/guides.css?v=20261109-1', legalJs: '/legal/legal.js?v=20261103', analyticsJs: '/analytics.js?v=20261103-ads2' };

export const SITES = {
  cgw: { name: 'Construction Gear World', domain: 'constructiongearworld.com' },
  mgw: { name: "Men's Gear World", domain: 'mensgearworld.com' },
  wgw: { name: "Women's Gear World", domain: 'womensgearworld.com' },
  kgw: { name: "Kids' Gear World", domain: 'kidsgearworld.com' },
  hgw: { name: 'Home Gear World', domain: 'homegearworld.com' },
  ggw: { name: 'Garden Gear World', domain: 'gardengearworld.com' },
  tgw: { name: 'Technology Gear World', domain: 'technologygearworld.com' },
  agw: { name: 'Car Gear World', domain: 'cargearworld.com' },
  vgw: { name: 'Travel Gear World', domain: 'travelgearworld.com' },
  sgw: { name: 'Sporty Gear World', domain: 'sportygearworld.com' },
  bgw: { name: 'Biker Gear World', domain: 'bikergearworld.com' },
  pgw: { name: 'Gaming Gear World', domain: 'gaminggearworld.com' },
  zgw: { name: 'Pets Gear World', domain: 'petsgearworld.com' }
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Lessons L107: no "previous price", no struck-through price (<s>) and no saving badge (gd-save) anywhere in the Hub
// files. Used by the QA gate and the Hub page check; returns "file: words" for each hit.
export const SAVING_CLAIM = /previous price|<s>|<s\s[^>]*>|gd-save|biggest saving/i;
export function savingClaims(dir = PUBLIC_DIR) {
  const hits = [];
  const walk = d => {
    for (const name of readdirSync(d)) {
      const file = join(d, name);
      if (statSync(file).isDirectory()) { walk(file); continue; }
      if (!['.html', '.js', '.json', '.css', '.txt', '.xml'].includes(extname(name))) continue;
      const m = readFileSync(file, 'utf8').match(SAVING_CLAIM);
      if (m) hits.push(`${relative(dir, file).replace(/\\/g, '/')}: ${m[0]}`);
    }
  };
  walk(dir);
  return hits;
}

export function loadData(file = DATA_FILE) { return JSON.parse(readFileSync(file, 'utf8')); }
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const money = n => '£' + Number(n).toFixed(2);
export function dateLabel(iso) { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }
// "Prices checked 24 Oct 2026" or "Prices checked between 24 Oct and 26 Oct 2026": the oldest and newest day the
// products of a guide (or of all guides) were last checked on their sites.
export function checkedText(items) {
  const days = items.map(it => it.checked).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();
  if (!days.length) throw new Error('every guide item needs its checked day');
  const lo = days[0];
  const hi = days[days.length - 1];
  return lo === hi ? dateLabel(lo) : `between ${dateLabel(lo)} and ${dateLabel(hi)}`;
}

// The groups of a guide, in the order they first appear (budgets or ages).
function groupsOf(items) {
  const out = [];
  for (const it of items) {
    let g = out.find(x => x.label === it.group);
    if (!g) { g = { label: it.group, items: [] }; out.push(g); }
    g.items.push(it);
  }
  return out;
}

function priceLine(it) {
  if (it.offers && it.offers.length > 1) {
    const [a, b] = it.offers;
    const other = a.price === b.price ? `Same price at ${esc(b.retailer)}` : `${money(b.price)} at ${esc(b.retailer)}`;
    return `<p class="gd-price"><strong>${money(a.price)}</strong> at ${esc(a.retailer)}</p>\n          <p class="gd-other">${other}</p>`;
  }
  const rrp = it.rrp && it.rrp > it.price ? ` <span class="gd-rrp">RRP ${money(it.rrp)}</span>` : '';
  return `<p class="gd-price"><strong>${money(it.price)}</strong>${rrp}</p>\n          <p class="gd-other">Retailer: ${esc(it.retailer)}</p>`;
}

function card(it, site) {
  return `      <li class="gd-item">
        <a class="gd-img" href="${esc(it.url)}" tabindex="-1" aria-hidden="true"><img src="${esc(it.image)}" alt="" width="160" height="160" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
        <div class="gd-body">
          <h3><a href="${esc(it.url)}">${esc(it.name)}</a></h3>
          <p class="gd-why">${esc(it.why)}</p>
          ${priceLine(it)}
          <a class="gd-btn" href="${esc(it.url)}">See it on ${esc(site.name)}</a>
        </div>
      </li>`;
}

function shell({ title, description, canonical, crumbs, body, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="article">
<link rel="stylesheet" href="${ASSETS.legalCss}">
<link rel="stylesheet" href="${ASSETS.guidesCss}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="lg-header">
  <div class="lg-wrap"><a class="lg-brand" href="/">Gear <span>World</span> Hub</a></div>
</header>
<main class="lg-wrap lg-main gd-main">
  <nav class="lg-crumbs" aria-label="Breadcrumb">${crumbs}</nav>
${body}
</main>
<footer class="lg-footer">
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
<script src="${ASSETS.legalJs}" defer></script>
<script src="${ASSETS.analyticsJs}"></script>
</body>
</html>
`;
}

export function renderGuide(data, guide) {
  const site = SITES[guide.site];
  if (!site) throw new Error(`unknown site ${guide.site}`);
  const checked = checkedText(guide.items);
  const canonical = `${ORIGIN}/guides/${guide.slug}/`;
  const others = data.guides.filter(g => g.slug !== guide.slug)
    .map(g => `<li><a href="/guides/${esc(g.slug)}/">${esc(g.title)}</a></li>`).join('\n      ');
  const groups = groupsOf(guide.items).map(g => `    <section class="gd-group">
      <h2>${esc(g.label)}</h2>
      <ul class="gd-list">
${g.items.map(it => card(it, site)).join('\n')}
      </ul>
    </section>`).join('\n');
  const tips = (guide.tips || []).map(t => `    <p class="gd-tip"><strong>${esc(t.label)}</strong> ${t.html ? t.html : esc(t.text)}</p>`).join('\n');
  const body = `  <article class="gd-article">
    <h1>${esc(guide.title)}</h1>
    <p class="gd-lead">${esc(guide.intro)}</p>
    <p class="gd-checked">Prices checked ${checked}, may change. Each product opens its page on ${esc(site.name)}, part of Gear World, which shows the retailer that sells it.</p>
${groups}
    <aside class="gd-tips" aria-label="Tips">
${tips}
    </aside>
    <p class="gd-note">Prices and stock come from ${esc(site.name)} and were last checked ${checked}. They may change at any time, so check the final price on the retailer's website before you buy. Gear World may earn a commission if you buy through our sites, at no extra cost to you: see our <a href="/affiliate-disclosure/">affiliate disclosure</a>.</p>
    <nav class="gd-more" aria-label="More gift guides">
      <h2>More gift guides</h2>
      <ul>
      ${others}
      </ul>
      <p><a class="gd-btn gd-btn-ghost" href="/#gifts">Use the gift finder</a></p>
    </nav>
  </article>`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: guide.title, url: canonical, numberOfItems: guide.items.length,
    itemListElement: guide.items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: it.url, name: it.name.slice(0, 150) }))
  };
  const crumbs = `<a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/guides/">Gift guides</a> <span aria-hidden="true">/</span> <span>${esc(guide.short)}</span>`;
  return shell({ title: guide.metaTitle, description: guide.description, canonical, crumbs, body, jsonLd });
}

export function renderIndex(data) {
  const checked = checkedText(data.guides.flatMap(g => g.items));
  const canonical = `${ORIGIN}/guides/`;
  const cards = data.guides.map(g => {
    const it = g.items[0];
    return `      <li class="gd-item gd-guide">
        <a class="gd-img" href="/guides/${esc(g.slug)}/" tabindex="-1" aria-hidden="true"><img src="${esc(it.image)}" alt="" width="160" height="160" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
        <div class="gd-body">
          <h3><a href="/guides/${esc(g.slug)}/">${esc(g.title)}</a></h3>
          <p class="gd-why">${esc(g.items.length)} ideas from ${esc(SITES[g.site].name)}</p>
          <a class="gd-btn" href="/guides/${esc(g.slug)}/">Open the guide</a>
        </div>
      </li>`;
  }).join('\n');
  const body = `  <article class="gd-article">
    <h1>Christmas gift guides</h1>
    <p class="gd-lead">Five short gift guides with real products and prices from the Gear World sites: for him, for her, for kids, for DIY lovers and for travellers. We have not tested these products; we picked them on brand, materials and price.</p>
    <p class="gd-checked">Prices checked ${checked}, may change.</p>
    <ul class="gd-list">
${cards}
    </ul>
    <p class="gd-note">Not what you are looking for? <a href="/#gifts">Use the gift finder</a> to search every Gear World by who the gift is for and your budget.</p>
  </article>`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Christmas gift guides', url: canonical, numberOfItems: data.guides.length,
    itemListElement: data.guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/guides/${g.slug}/`, name: g.title }))
  };
  return shell({
    title: 'Christmas Gift Guides: Ideas for Everyone | Gear World Hub',
    description: 'Five Christmas gift guides from Gear World: gifts for him, for her, for kids, for DIY lovers and for travellers, with prices from the Gear World sites.',
    canonical, crumbs: '<a href="/">Home</a> <span aria-hidden="true">/</span> <span>Gift guides</span>', body, jsonLd
  });
}

// path (relative to sites/gwh/public) -> page
export function buildPages(data) {
  const pages = { 'guides/index.html': renderIndex(data) };
  for (const g of data.guides) pages[`guides/${g.slug}/index.html`] = renderGuide(data, g);
  return pages;
}

// ---------- check (read-only) ----------
const UA = 'GearWorldQA-bot/1.0 (+read-only check)';
// The price and stock of THIS product at its retailer: from the page itself (the shelf price and "Stock at <retailer>"),
// because since 7 Nov 2026 the structured data is an AggregateOffer with the range of all retailers (lessons L101).
// Older pages (a plain Offer in the structured data) still read.
export function readProductPage(html) {
  const out = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    for (const o of (Array.isArray(j) ? j : (j['@graph'] || [j]))) {
      if (!o || o['@type'] !== 'Product') continue;
      const of = Array.isArray(o.offers) ? o.offers[0] : (o.offers || {});
      out.price = Number(of.price || of.lowPrice);
      out.inStock = /InStock/.test(String(of.availability || ''));
    }
  }
  const shelf = html.match(/<p class="shelf-price"><span class="price" data-price="([0-9]+(?:\.[0-9]{1,2})?)"/);
  if (shelf) out.price = Number(shelf[1]);
  const stock = html.match(/<dd class="(ok|warn)">(In stock|Out of stock)<\/dd>/);
  if (stock) out.inStock = stock[2] === 'In stock';
  // The feed's RRP ("RRP £x", lessons L107); older pages had a struck-through "was" price.
  const rrp = html.match(/<span class="rrp"><span data-i18n="RRP \{0\}" data-i18n-0="£([0-9][0-9,]*\.[0-9]{2})"/) || html.match(/<s class="was">\s*£\s?([0-9][0-9,]*\.[0-9]{2})/);
  out.rrp = rrp ? Number(rrp[1].replace(/,/g, '')) : null;
  return out;
}

async function check(outFile) {
  const data = loadData();
  const lines = [`Gear World Hub gift guides - price check (read-only, GET only, never /out/) - ${new Date().toISOString()}`, `guides.json says: Prices checked ${checkedText(data.guides.flatMap(g => g.items))}`];
  let problems = 0;
  for (const g of data.guides) {
    lines.push('', `== ${g.title}`);
    for (const it of g.items) {
      if (/\/(out|go)\//.test(it.url)) { lines.push(`PROBLEM ${it.name}: the link is an /out/ or /go/ link`); problems++; continue; }
      let res;
      try { res = await fetch(it.url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); } catch (e) { lines.push(`PROBLEM ${it.name}: ${e.message}`); problems++; continue; }
      if (res.status !== 200) { lines.push(`PROBLEM ${it.name}: the page answers ${res.status}`); problems++; continue; }
      const p = readProductPage(await res.text());
      const moved = res.url !== it.url ? ` (moved to ${res.url})` : '';
      const notes = [];
      if (!p.inStock) notes.push('out of stock');
      if (p.price !== it.price) notes.push(`price ${money(it.price)} -> ${money(p.price)}`);
      if (it.rrp != null && p.rrp !== it.rrp) notes.push(`RRP ${money(it.rrp)} -> ${p.rrp == null ? '-' : money(p.rrp)}`);
      if (notes.length || moved) { problems++; lines.push(`CHANGED ${it.name}: ${notes.join(', ')}${moved}`); }
      else lines.push(`OK ${it.name}: ${money(p.price)}, in stock`);
      await new Promise(r => setTimeout(r, 300));
    }
  }
  lines.push('', problems ? `${problems} product(s) to update in guides.json, then: node tools/gwh-guides.mjs build` : 'All prices and stock as in guides.json.');
  const text = lines.join('\n') + '\n';
  if (outFile) writeFileSync(outFile, text);
  process.stdout.write(text);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd] = process.argv.slice(2);
  const outIdx = process.argv.indexOf('--out');
  if (cmd === 'build') {
    const pages = buildPages(loadData());
    for (const [rel, html] of Object.entries(pages)) {
      const file = PUBLIC_DIR + rel;
      mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
      writeFileSync(file, html);
      console.log('wrote sites/gwh/public/' + rel);
    }
  } else if (cmd === 'check') {
    await check(outIdx > 0 ? process.argv[outIdx + 1] : '');
  } else {
    console.log('Usage: node tools/gwh-guides.mjs build | check [--out <file>]');
    process.exitCode = 2;
  }
}
