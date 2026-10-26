// Company page for retailers and affiliate networks: who runs the sites, which sites, how we promote.
// One page, no cookies, no database. Live product counts come from each site's public /api/stats.
import { html, toString } from './lib/html.js';
import { htmlResponse, textResponse, redirect } from './lib/http.js';

const STATS_TTL = 3600;

// Adds up the sites' /api/stats. A site that does not answer within 4 seconds is left out of the sum.
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
      return { products, names: Array.isArray(d.retailer_names) ? d.retailer_names.map(String) : [] };
    } catch {
      return null;
    }
  }));
  const ok = results.filter(Boolean);
  const names = new Set(ok.flatMap(x => x.names.map(n => n.replace(/\s+UK$/i, '').trim().toLowerCase())));
  return { products: ok.reduce((t, x) => t + x.products, 0), retailers: names.size, sitesCounted: ok.length };
}

async function cachedStats(site, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(`https://${site.domain}/__stats-cache`);
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
function shell(site, { title, description, path, body }) {
  const year = new Date().getUTCFullYear();
  return toString(html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://${site.domain}${path}">
<meta property="og:title" content="${site.name}">
<meta property="og:description" content="Independent price comparison sites for UK shoppers.">
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
  <p>&copy; ${year} ${site.operatorName}</p>
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

export function groupPage(site, stats) {
  const facts = [
    stats.products ? `${fmt(stats.products)} products listed` : '',
    stats.retailers ? `${fmt(stats.retailers)}+ retailers` : '',
    `${site.sites.length} themed sites and a search hub`,
    '11 languages'
  ].filter(Boolean);
  const body = html`
<section class="hero"><div class="wrap">
  <p class="eyebrow">For retailers and affiliate networks</p>
  <h1>Independent price comparison sites for UK shoppers</h1>
  <p class="lede">${site.name} runs ${site.sites.length} themed price comparison sites and a shared search hub. We list retailers' products from their affiliate product feeds, so shoppers can compare prices in one place and then buy direct from the retailer.</p>
  <ul class="facts">${facts.map(f => html`<li>${f}</li>`)}</ul>
</div></section>

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
      <li>Your official promotions and voucher codes, only as you provide them, always with their end dates. Expired codes are removed automatically.</li>
      <li>Pages in 11 languages, with prices in GBP and an approximate price in the shopper's currency.</li>
      <li>Every retailer link goes through the affiliate network with a click reference per site and product, so you can see where each sale came from.</li>
      <li>Product pages with structured data (price, stock, GTIN) for search engines.</li>
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
        const res = htmlResponse(groupPage(site, stats), { method: request.method, cache: 'page' });
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      }
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
