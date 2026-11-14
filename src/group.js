// Company page for retailers and affiliate networks: who runs the sites, which sites, how we promote.
// One page, no cookies, no database. Live product counts come from each site's public /api/stats.
import { html, toString } from './lib/html.js';
import { htmlResponse, textResponse, redirect } from './lib/http.js';
import { COUNTRY_NAMES, WORLDWIDE } from './lib/delivery.js';
import { listCovers, cleanCountry } from './lib/visibility.js';

const STATS_TTL = 3600;

// Where the group page shows countries (lessons L130): every country the sites' deliversTo can name (src/lib/delivery.js),
// by continent. A retailer that delivers worldwide counts in every country, and also on the "worldwide" line.
export const CONTINENTS = [
  ['Europe', ['GB', 'IE', 'FR', 'DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'IT', 'ES', 'PT', 'GR', 'CY', 'MT', 'PL', 'CZ', 'SK', 'HU',
    'RO', 'BG', 'HR', 'SI', 'AL', 'DK', 'SE', 'NO', 'FI', 'IS', 'LI', 'EE', 'LV', 'LT']],
  ['North America', ['US', 'CA', 'MX']],
  ['Asia', ['JP']],
  ['Oceania', ['AU', 'NZ']]
];
export const COUNTRY_CODES = CONTINENTS.flatMap(([, list]) => list);

const retailerKey = n => String(n).replace(/\s+UK$/i, '').trim().toLowerCase();

// Adds up the sites' /api/stats. A site that does not answer within 4 seconds is left out of the sum.
// products: every listed product (all countries); ukProducts: the UK view; countries: per country the products, the
// retailers and each site's share, from the retailers' delivery countries. A site that still answers the older
// /api/stats (no "delivery") counts its UK numbers for the UK only.
export async function networkStats(site, fetcher = fetch) {
  const results = await Promise.all(site.sites.filter(s => s.stats).map(async s => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetcher(new URL('/api/stats', s.url).toString(), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (!r.ok) return null;
      const d = await r.json();
      const products = Number(d && d.products);
      if (!Number.isFinite(products) || products <= 0) return null;
      const names = Array.isArray(d.retailer_names) ? d.retailer_names.map(String) : [];
      const delivery = Array.isArray(d.delivery)
        ? d.delivery.map(x => ({ retailer: String(x && x.retailer || ''), products: Math.max(0, Number(x && x.products) || 0),
          countries: Array.isArray(x && x.countries) ? x.countries.map(String) : [] })).filter(x => x.retailer && x.products > 0)
        : names.length ? [{ retailer: names[0], products, countries: ['GB'], names }] : [];
      const all = Number(d.all_products);
      return { site: s, products, all: Number.isFinite(all) && all >= products ? all : products, names, delivery };
    } catch {
      return null;
    }
  }));
  const ok = results.filter(Boolean);
  const allNames = new Set();
  const ukNames = new Set();
  const countries = Object.fromEntries(COUNTRY_CODES.map(cc => [cc, { products: 0, retailers: new Set(), sites: [] }]));
  const worldwide = { products: 0, retailers: new Set() };
  for (const r of ok) {
    for (const n of r.names) ukNames.add(retailerKey(n));
    const perCountry = {};
    for (const x of r.delivery) {
      const keys = (x.names || [x.retailer]).map(retailerKey);
      keys.forEach(k => allNames.add(k));
      if (x.countries.includes(WORLDWIDE)) { worldwide.products += x.products; keys.forEach(k => worldwide.retailers.add(k)); }
      for (const cc of COUNTRY_CODES) {
        if (!listCovers(x.countries, cc)) continue;
        countries[cc].products += x.products;
        keys.forEach(k => countries[cc].retailers.add(k));
        perCountry[cc] = (perCountry[cc] || 0) + x.products;
      }
    }
    for (const [cc, n] of Object.entries(perCountry)) countries[cc].sites.push([r.site.name, r.site.url, n]);
  }
  const plain = Object.fromEntries(Object.entries(countries).map(([cc, c]) => [cc, { products: c.products, retailers: c.retailers.size,
    sites: c.sites.sort((a, b) => b[2] - a[2]) }]));
  return {
    products: ok.reduce((t, x) => t + x.all, 0),
    ukProducts: ok.reduce((t, x) => t + x.products, 0),
    retailers: allNames.size || ukNames.size,
    sitesCounted: ok.length,
    countries: plain,
    worldwide: { products: worldwide.products, retailers: worldwide.retailers.size }
  };
}

async function cachedStats(site, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://${site.domain}/__stats-cache-2`); // -2: the numbers per country (L130)
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }
  const stats = await networkStats(site);
  if (cache && stats.sitesCounted) {
    const put = cache.put(key, new Response(JSON.stringify(stats), { headers: { 'Cache-Control': `max-age=${STATS_TTL}` } }));
    if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return stats;
}

const fmt = n => new Intl.NumberFormat('en-GB').format(n);
const asset = (site, p) => `/assets/${p}?v=${encodeURIComponent(site.assetVersion)}`;

// Legal pages (lessons L17). They describe this company page only: one page, no forms, no cookies of its own.
// Each Gear World site has its own legal pages. NOTE: a starting point that needs review by a qualified adviser (T31).
const LEGAL_UPDATED = '26 October 2026';
const FOOTER_LINKS = [
  ['/how-we-make-money/', 'How we make money'],
  ['/privacy/', 'Privacy policy'],
  ['/cookies/', 'Cookies'],
  ['/terms/', 'Terms of use']
];

const mail = site => (site.contactEmail ? html`<a href="mailto:${site.contactEmail}">${site.contactEmail}</a>` : 'the contact address on our home page');

const LEGAL = {
  '/how-we-make-money/': site => ({
    title: 'How we make money',
    description: `How the ${site.name} sites earn money through affiliate links.`,
    content: html`
<p>The Gear World sites are free to use. We earn money through affiliate links.</p>
<h2>What an affiliate link is</h2>
<p>When a shopper selects a "View at" button on one of our sites, they go to the retailer through an affiliate network such as Awin. If they then buy something, the retailer may pay us a commission. The shopper pays the same price as they would if they went to the retailer directly.</p>
<h2>How this affects what shoppers see</h2>
<p>We do not rank products by commission, and a retailer cannot pay to change a price or a product's position on our sites. Each site explains this on its own "How we make money" page.</p>
<h2>This page</h2>
<p>This company page has no affiliate links. It links only to the Gear World sites.</p>`
  }),

  '/privacy/': site => ({
    title: 'Privacy policy',
    description: `How ${site.name} (${site.domain}) handles personal data.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>This policy covers ${site.domain}, the company page of ${site.name}, and explains your rights under UK data protection law (UK GDPR and the Data Protection Act 2018). Each Gear World site has its own privacy policy, linked in its footer.</p>
<h2>Who is responsible</h2>
<p>The data controller is ${site.operatorName}. Contact: ${mail(site)}.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Visiting this page.</strong> This page has no forms, no accounts and no analytics. We do not record your visit.</li>
<li><strong>Email.</strong> If you email us, we keep your message and email address to reply and to keep a record of our business contacts (legitimate interests). We delete them when they are no longer needed.</li>
<li><strong>Hosting.</strong> The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.</li>
</ul>
<h2>Cookies</h2>
<p>This page sets no cookies of its own. See the <a href="/cookies/">cookies page</a>.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service provider (Cloudflare) may process data outside the UK with appropriate safeguards.</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, and ask for a copy. Email ${mail(site)}. You can also complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>`
  }),

  '/cookies/': site => ({
    title: 'Cookies',
    description: `Which cookies ${site.domain} uses.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>${site.domain} sets no advertising, analytics or tracking cookies and stores nothing on your device, so there is no cookie banner.</p>
<h2>Strictly necessary</h2>
<p>Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. They are needed for the site to work safely and do not track you across sites.</p>
<h2>Our other sites</h2>
<p>Each Gear World site explains its own cookies on its cookies page.</p>`
  }),

  '/terms/': site => ({
    title: 'Terms of use',
    description: `The terms for using ${site.domain}.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>These terms apply when you use ${site.domain}, operated by ${site.operatorName}. By using the site you accept them.</p>
<h2>What the site does</h2>
<p>This page gives retailers and affiliate networks information about ${site.name} and its sites. It does not sell anything. The product and retailer numbers come from the sites' public statistics, are updated every hour and are approximate.</p>
<h2>Links to other websites</h2>
<p>We are not responsible for the content of websites we link to. Each Gear World site has its own terms of use.</p>
<h2>Liability</h2>
<p>Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of this site.</p>
<h2>Law</h2>
<p>These terms are governed by the law of England and Wales.</p>
<h2>Contact</h2>
<p>${mail(site)}</p>`
  })
};

export function legalPaths() {
  return Object.keys(LEGAL);
}

// The same header and footer on every page; the footer always links to the legal pages (L17).
function shell(site, { title, description, path, body, robots = '' }) {
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
<meta property="og:title" content="${site.name}">
<meta property="og:description" content="Independent product search and price-comparison sites. Each product shows the retailer that sells it and where that retailer delivers.">
<meta property="og:url" content="https://${site.domain}${path}">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(site, 'group.css')}">
</head>
<body>
<header class="top"><div class="wrap top-row">
  <a class="brand" href="/"><img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40"><span>${site.name}</span></a>
  <a class="top-link" href="${path === '/' ? '#contact' : '/#contact'}">Contact</a>
</div></header>
<main id="main">${body}</main>
<footer class="foot"><div class="wrap">
  <nav aria-label="Legal"><ul class="foot-links">${FOOTER_LINKS.map(([href, label]) => html`<li><a href="${href}">${label}</a></li>`)}</ul></nav>
  <p>This site sets no cookies of its own and does no tracking. Product numbers come from the sites' public statistics and are updated every hour.</p>
  <p>&copy; ${year} ${site.name} · Run by ${site.operatorName} · We don't sell products: we link to retailers and may earn a commission.</p>
</div></footer>
</body>
</html>`);
}

export function legalPage(site, path) {
  const make = LEGAL[path];
  if (!make) return null;
  const p = make(site);
  return shell(site, {
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

// The name of a country in English: the delivery list's own name, else the browser's (Intl), else the code.
const THE = ['GB', 'US', 'NL'];
const inName = cc => (THE.includes(cc) ? `the ${countryName(cc)}` : countryName(cc));

export function countryName(cc) {
  if (COUNTRY_NAMES[cc] && cc !== 'EU') return COUNTRY_NAMES[cc];
  try { return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(cc) || cc; } catch { return cc; }
}

const countryPath = cc => `/countries/${cc.toLowerCase()}/`;
const coming = (site, cc) => Array.isArray(site.coming) && site.coming.includes(cc);
const COMING_TEXT = 'More retailers coming: approved, products being added';
const nums = c => html`${fmt(c.products)} products</span>
  <span class="cnum">${fmt(c.retailers)} ${c.retailers === 1 ? 'retailer' : 'retailers'}`;

// "Where the retailers deliver": every continent and its countries, each a link to the country's own page.
function countryList(site, stats, current = '') {
  const cs = stats.countries || {};
  return html`
${CONTINENTS.map(([name, list]) => html`<h3 class="continent">${name}</h3>
<ul class="countries">${list.map(cc => {
    const c = cs[cc] || { products: 0, retailers: 0 };
    return html`<li${cc === current ? html` class="here"` : ''}><a href="${countryPath(cc)}"${cc === current ? html` aria-current="page"` : ''}><span class="cn">${countryName(cc)}</span>
  <span class="cnum">${c.products ? nums(c) : coming(site, cc) ? 'Coming soon' : 'No retailers yet'}</span>${coming(site, cc) ? html`<span class="tag">More coming</span>` : ''}</a></li>`;
  })}</ul>`)}
${stats.worldwide && stats.worldwide.products ? html`<p class="worldwide">Every other country: ${fmt(stats.worldwide.products)} products from ${fmt(stats.worldwide.retailers)} ${stats.worldwide.retailers === 1 ? 'retailer that delivers' : 'retailers that deliver'} worldwide.</p>` : ''}
<p class="note">Updated every hour from the sites' own numbers. A product counts in every country its retailer delivers to.</p>`;
}

// The visitor's own country (Cloudflare), at the top of the home page. Added per request: the home page is never kept
// by a shared cache (cache 'private').
function yourCountry(site, stats, country) {
  const cc = cleanCountry(country);
  if (!cc) return '';
  const c = stats.countries && stats.countries[cc];
  if (!c) {
    const w = stats.worldwide || { products: 0, retailers: 0 };
    return html`<aside class="yours" aria-label="Your country"><p><strong>Visiting from ${countryName(cc)}?</strong>
${w.products ? `${fmt(w.products)} products from retailers that deliver worldwide.` : ''}</p>
<p><a href="#countries">See where the retailers deliver</a></p></aside>`;
  }
  return html`<aside class="yours" aria-label="Your country"><p><strong>From ${inName(cc)}?</strong>
${c.products ? `${fmt(c.products)} products from ${fmt(c.retailers)} ${c.retailers === 1 ? 'retailer delivers' : 'retailers deliver'} to ${inName(cc)}.` : ''}
${coming(site, cc) ? COMING_TEXT + '.' : ''}</p>
<p class="yours-links"><a href="${countryPath(cc)}">See ${inName(cc)}</a> <a href="#countries">See other countries</a></p></aside>`;
}

export function groupPage(site, stats, country = '') {
  const uk = stats.countries && stats.countries.GB ? stats.ukProducts : 0;
  const facts = [
    stats.products ? `${fmt(stats.products)} products listed` : '',
    uk && uk !== stats.products ? `${fmt(uk)} deliver to the UK` : '',
    stats.retailers ? `${fmt(stats.retailers)}+ retailers` : '',
    `${site.sites.length} themed sites and a search hub`,
    '11 languages'
  ].filter(Boolean);
  const body = html`
<section class="hero"><div class="wrap">
  <p class="eyebrow">For retailers and affiliate networks</p>
  <h1>Independent product search and price-comparison sites</h1>
  <p class="lede">Each product shows the retailer that sells it and where that retailer delivers.</p>
  <p class="lede">${site.name} runs ${site.sites.length} themed price comparison sites and a shared search hub. We list retailers' products from their affiliate product feeds, so shoppers can compare prices in one place and then buy direct from the retailer.</p>
  <ul class="facts">${facts.map(f => html`<li>${f}</li>`)}</ul>
  ${stats.countries ? yourCountry(site, stats, country) : ''}
</div></section>

${stats.countries ? html`<section class="wrap section" id="countries" aria-labelledby="countries-h">
  <h2 id="countries-h">Where the retailers deliver</h2>
  ${countryList(site, stats)}
</section>` : ''}

<section class="wrap section" aria-labelledby="sites-h">
  <h2 id="sites-h">Our sites</h2>
  <ul class="cards">
    <li class="card card-hub"><h3><a href="${site.hub.url}">${site.hub.name}</a></h3><p>${site.hub.text}</p><p class="domain">${new URL(site.hub.url).hostname}</p></li>
    ${site.sites.map(s => html`<li class="card"><h3><a href="${s.url}">${s.name}</a></h3><p>${s.text}</p><p class="domain">${new URL(s.url).hostname}</p></li>`)}
  </ul>
</section>

<section class="wrap section two" aria-labelledby="how-h">
  <div>
    <h2 id="how-h">How we promote retailers</h2>
    <ul class="ticks">
      <li>Product listings from your affiliate feed: price, stock and a "View at" button on every product page, category page and in our side-by-side compare tool.</li>
      <li>Price comparison: when several retailers sell the same product (same EAN), shoppers see every price in one table.</li>
      <li>Your own promotions and voucher codes, only as you provide them, always with their end dates. Expired codes are removed automatically.</li>
      <li>Pages in 11 languages, with prices in GBP and an approximate price in the shopper's currency.</li>
      <li>Every retailer link goes through the affiliate network with a click reference per site and product, so you can see where each sale came from.</li>
      <li>Product pages with structured data for search engines: the lowest and highest price across retailers, the number of retailers, and the GTIN when the feed has one.</li>
    </ul>
  </div>
  <div>
    <h2 id="not-h">What we do not do</h2>
    <ul class="crosses">
      <li>No paid search bidding on your brand name.</li>
      <li>No cashback, reward or other incentive traffic.</li>
      <li>No unapproved, leaked or expired voucher codes.</li>
      <li>No toolbars, pop-ups or cookie stuffing.</li>
      <li>No fake reviews: we compare prices and stock from the retailers' feeds. We do not claim to test products.</li>
    </ul>
  </div>
</section>

<section class="wrap section" id="contact" aria-labelledby="contact-h">
  <h2 id="contact-h">Contact</h2>
  <dl class="contact">
    ${site.contactEmail ? html`<div><dt>Email</dt><dd><a href="mailto:${site.contactEmail}">${site.contactEmail}</a></dd></div>` : ''}
    <div><dt>Awin publisher ID</dt><dd>${String(site.awinPublisherId)}</dd></div>
    <div><dt>Operator</dt><dd>${site.operatorName}</dd></div>
  </dl>
</section>`;
  return shell(site, {
    title: `${site.name} | Independent price comparison sites`,
    description: `${site.name} runs ${site.sites.length} independent price comparison sites and a shared search hub. Information for retailers and affiliate networks.`,
    path: '/',
    body
  });
}

// One country's page (L130): what delivers there, from which sites, and every other country. Numbers only, so it is not
// for search engines (noindex, follow) and not in the sitemap; the home page links to it.
export function countryPage(site, stats, cc) {
  const c = (stats.countries && stats.countries[cc]) || { products: 0, retailers: 0, sites: [] };
  const name = countryName(cc);
  const body = html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#countries">Where the retailers deliver</a></p>
  <h1>Gear World in ${inName(cc)}</h1>
  <ul class="facts">
    <li>${c.products ? `${fmt(c.products)} products deliver to ${inName(cc)}` : coming(site, cc) ? 'Coming soon' : 'No retailers deliver here yet'}</li>
    ${c.retailers ? html`<li>${fmt(c.retailers)} ${c.retailers === 1 ? 'retailer' : 'retailers'}</li>` : ''}
    ${coming(site, cc) ? html`<li class="tag-li">${COMING_TEXT}</li>` : ''}
  </ul>
</div></section>
${c.sites && c.sites.length ? html`<section class="wrap section" aria-labelledby="by-site-h">
  <h2 id="by-site-h">By site</h2>
  <ul class="by-site">${c.sites.map(([n, url, k]) => html`<li><a href="${url}">${n}</a><span>${fmt(k)} products</span></li>`)}</ul>
</section>` : ''}
<section class="wrap section" id="countries" aria-labelledby="countries-h">
  <h2 id="countries-h">Other countries</h2>
  ${countryList(site, stats, cc)}
</section>`;
  return shell(site, {
    title: `Gear World in ${name} | ${site.name}`,
    description: `Products from the Gear World sites whose retailers deliver to ${inName(cc)}.`,
    path: countryPath(cc),
    robots: 'noindex, follow',
    body
  });
}

export function createGroupWorker(site) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname === `www.${site.domain}`) {
        url.hostname = site.domain;
        return redirect(url.toString(), 301);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('Method not allowed', { status: 405, cache: 'none' });
      const preview = url.hostname !== site.domain && !['localhost', '127.0.0.1'].includes(url.hostname);
      if (url.pathname === '/robots.txt') {
        return textResponse(preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: https://${site.domain}/sitemap.xml\n`, { method: request.method });
      }
      if (url.pathname === '/sitemap.xml') {
        return textResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://${site.domain}/</loc></url>\n</urlset>\n`, { type: 'application/xml', method: request.method });
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const stats = await cachedStats(site, ctx);
        // The "your country" box depends on who asks: never kept by a shared cache (L130).
        const country = request.cf && request.cf.country;
        const res = htmlResponse(groupPage(site, stats, country), { method: request.method, cache: 'private' });
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
      // A country's page: /countries/de/ (small letters, with the final slash); an unknown country goes to the list.
      const cm = url.pathname.match(/^\/countries\/([A-Za-z]{2})\/?$/);
      if (cm) {
        const cc = cm[1].toUpperCase();
        if (!COUNTRY_CODES.includes(cc)) return redirect(`https://${site.domain}/#countries`, 302);
        if (url.pathname !== countryPath(cc)) { url.pathname = countryPath(cc); return redirect(url.toString(), 301); }
        const stats = await cachedStats(site, ctx);
        const res = htmlResponse(countryPage(site, stats, cc), { method: request.method, cache: 'page' });
        res.headers.set('X-Robots-Tag', preview ? 'noindex, nofollow' : 'noindex, follow');
        return res;
      }
      if (url.pathname === '/countries/' || url.pathname === '/countries') return redirect(`https://${site.domain}/#countries`, 302);
      // Legal pages; the address without the final slash goes to the one with it.
      if (!url.pathname.endsWith('/') && LEGAL[`${url.pathname}/`]) {
        url.pathname = `${url.pathname}/`;
        return redirect(url.toString(), 301);
      }
      if (LEGAL[url.pathname]) {
        const res = htmlResponse(legalPage(site, url.pathname), { method: request.method, cache: 'page' });
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
      if (env && env.ASSETS && url.pathname.startsWith('/assets/')) return env.ASSETS.fetch(request);
      return redirect(`https://${site.domain}/`, 302);
    }
  };
}
