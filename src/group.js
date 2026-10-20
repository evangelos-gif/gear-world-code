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

export function groupPage(site, stats) {
  const year = new Date().getUTCFullYear();
  const facts = [
    stats.products ? `${fmt(stats.products)} products listed` : '',
    stats.retailers ? `${fmt(stats.retailers)}+ retailers` : '',
    `${site.sites.length} themed sites and a search hub`,
    '11 languages'
  ].filter(Boolean);
  const doc = html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${site.name} | Independent price comparison sites</title>
<meta name="description" content="${site.name} runs ${site.sites.length} independent price comparison sites and a shared search hub. Information for retailers and affiliate networks.">
<link rel="canonical" href="https://${site.domain}/">
<meta property="og:title" content="${site.name}">
<meta property="og:description" content="Independent price comparison sites for UK shoppers.">
<meta property="og:url" content="https://${site.domain}/">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(site, 'group.css')}">
</head>
<body>
<header class="top"><div class="wrap top-row">
  <a class="brand" href="/"><img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40"><span>${site.name}</span></a>
  <a class="top-link" href="#contact">Contact</a>
</div></header>
<main id="main">
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
</section>
</main>
<footer class="foot"><div class="wrap">
  <p>This page uses no cookies and no tracking. Product numbers come from the sites' public statistics and are updated every hour.</p>
  <p>&copy; ${year} ${site.operatorName}</p>
</div></footer>
</body>
</html>`;
  return toString(doc);
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
      if (env && env.ASSETS && url.pathname.startsWith('/assets/')) return env.ASSETS.fetch(request);
      return redirect(`https://${site.domain}/`, 302);
    }
  };
}
