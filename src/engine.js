// Gear World shared Worker engine. A site's worker.js does: export default createWorker(siteConfig).
import { htmlResponse, jsonResponse, textResponse, redirect, withEdgeCache, secureHeaders } from './lib/http.js';
import { verifyTurnstile, rateLimit, isBot, safeEqual } from './lib/security.js';
import { productPath } from './lib/text.js';
import * as db from './db.js';
import { homePage } from './pages/home.js';
import { categoryPage, searchPage, dealsPage, readListingParams, hasFilters } from './pages/listing.js';
import { productPage } from './pages/product.js';
import { comparePage, parseCompareIds } from './pages/compare.js';
import { cartPage, parseCartItems } from './pages/cart.js';
import { exchangeRates } from './lib/fx.js';
import { translationsFor } from './lib/hub.js';
import { offersIndexPage, retailerOffersPage, OFFERS_PATH } from './pages/offers.js';
import { findPromo } from './lib/promos.js';
import { infoPage, infoPaths, notFoundPage, errorPage } from './pages/info.js';
import { useSiteAssets, useRates } from './pages/layout.js';
import { sitemapIndex, sitemapStatic, sitemapProducts, robotsTxt, SITEMAP_CHUNK } from './seo.js';

const PER_PAGE = 24;

export function createWorker(site) {
  const categories = new Map(site.categories.map(c => [c.slug, c]));
  // Older Gear World sites keep their database exactly as it is (lessons L28).
  db.useLayout(site);

  async function handle(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // One canonical host (lessons L11): www and any other host redirect to the apex domain.
    const host = url.hostname.toLowerCase();
    if (host === `www.${site.domain}`) {
      url.hostname = site.domain;
      return redirect(url.toString(), 301);
    }

    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
      return textResponse('Method not allowed', { status: 405, cache: 'none' });
    }

    const path = url.pathname;

    // POST endpoints
    if (method === 'POST') {
      if (path === '/api/newsletter' && !db.isLegacy()) return newsletter(request, env, url);
      if (path === '/api/csp-report') return cspReport(request);
      return textResponse('Not found', { status: 404, cache: 'none' });
    }

    // Lower-case and trailing-slash normalisation for page paths.
    if (/^\/(category|product|discount-codes)\/[^?]*[^/]$/.test(path) || path === '/discount-codes' || (infoPaths().includes(path + '/')) || path === '/deals') {
      url.pathname = path + '/';
      return redirect(url.toString(), 301);
    }

    // Gear World Hub search links use the older sites' format /?search=<q>&highlight=<id> (lessons L22).
    if (path === '/' && (url.searchParams.has('highlight') || url.searchParams.has('search'))) {
      const id = Number.parseInt(url.searchParams.get('highlight') || '', 10);
      if (Number.isSafeInteger(id) && id > 0) {
        const product = await db.getProduct(env.DB, id);
        if (product) return redirect(new URL(productPath(product), url.origin).toString(), 302);
      }
      const q = (url.searchParams.get('search') || '').normalize('NFKC').trim().slice(0, 80);
      return redirect(new URL(q ? `/search?q=${encodeURIComponent(q)}` : '/', url.origin).toString(), 302);
    }

    if (path === '/') {
      return cached(request, env, ctx, async () => {
        const data = await db.homeData(env.DB, site.categories.map(c => c.slug));
        return htmlResponse(homePage(site, data), { method });
      });
    }

    let m = path.match(/^\/category\/([a-z0-9-]+)\/$/);
    if (m) {
      const cat = categories.get(m[1]);
      if (!cat) return notFound(path, method);
      return cached(request, env, ctx, async () => {
        const p = readListingParams(url);
        const [result, facets] = await Promise.all([
          db.listProducts(env.DB, { ...p, category: cat.slug }, { sort: p.sort, page: p.page, perPage: PER_PAGE }),
          db.facets(env.DB, cat.slug)
        ]);
        if (p.page > 1 && p.page > result.pages && !hasFilters(p)) return notFound(path, method);
        return htmlResponse(categoryPage(site, cat, p, result, facets), { method });
      });
    }

    m = path.match(/^\/product\/([a-z0-9-]*)-(\d+)\/$/);
    if (m) {
      return cached(request, env, ctx, async () => {
        const product = await db.getProduct(env.DB, Number(m[2]));
        if (!product) {
          const alt = await db.activeVariantOf(env.DB, Number(m[2]));
          return alt ? redirect(new URL(productPath(alt), url.origin).toString(), 301) : notFound(path, method);
        }
        const canonical = productPath(product);
        if (canonical !== path) return redirect(new URL(canonical, url.origin).toString(), 301);
        const [similar, offers] = await Promise.all([db.similarProducts(env.DB, product, 8), db.offersFor(env.DB, product)]);
        return htmlResponse(productPage(site, product, categories.get(product.category_slug), similar, offers), { method });
      });
    }

    if (path === '/compare/' || path === '/compare') {
      if (path === '/compare') return redirect(new URL('/compare/' + url.search, url.origin).toString(), 301);
      const ids = parseCompareIds(url);
      const products = await db.getProductsByIds(env.DB, ids);
      return htmlResponse(comparePage(site, products, ids), { method, cache: 'short' });
    }

    if (site.cart && (path === '/cart/' || path === '/cart')) {
      if (path === '/cart') return redirect(new URL('/cart/' + url.search, url.origin).toString(), 301);
      const items = parseCartItems(url, site.cart);
      const products = await db.getProductsByIds(env.DB, items.map(x => x.id));
      return htmlResponse(cartPage(site, products, items), { method, cache: 'short' });
    }

    if (path === '/search') {
      const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().slice(0, 80);
      const p = readListingParams(url);
      const found = q
        ? await searchWithTranslation(env, { ...p, search: q }, { sort: p.sort, page: p.page, perPage: PER_PAGE })
        : { result: { products: [], total: 0, page: 1, pages: 0 }, used: '' };
      return htmlResponse(searchPage(site, q, p, found.result, found.used), { method, cache: 'short' });
    }

    if (path === '/deals/') {
      return cached(request, env, ctx, async () => {
        const p = readListingParams(url);
        const result = await db.listProducts(env.DB, { onSale: true, inStock: true }, { sort: 'saving', page: p.page, perPage: PER_PAGE });
        if (p.page > 1 && p.page > result.pages) return notFound(path, method);
        return htmlResponse(dealsPage(site, p, result), { method });
      });
    }

    if (infoPaths().includes(path)) {
      return htmlResponse(infoPage(site, path), { method, cache: 'page' });
    }

    if (path === OFFERS_PATH) return htmlResponse(offersIndexPage(site), { method, cache: 'page' });
    m = path.match(/^\/discount-codes\/([a-z0-9-]{1,40})\/$/);
    if (m) {
      const html = retailerOffersPage(site, m[1]);
      return html ? htmlResponse(html, { method, cache: 'page' }) : notFound(path, method);
    }
    m = path.match(/^\/go\/([a-z0-9-]{1,60})\/?$/);
    if (m) return promoOut(request, env, ctx, url, m[1]);

    m = path.match(/^\/out\/(\d+)\/?$/);
    if (m) return outbound(request, env, ctx, url, Number(m[1]));

    if (path === '/robots.txt') return textResponse(robotsTxt(site), { method });
    if (path === '/sitemap.xml') {
      const total = await db.sitemapCount(env.DB);
      return textResponse(sitemapIndex(site, total), { type: 'application/xml', method });
    }
    if (path === '/sitemap-static.xml') {
      const counts = await db.categoryCounts(env.DB);
      return textResponse(sitemapStatic(site, counts), { type: 'application/xml', method });
    }
    m = path.match(/^\/sitemap-products-(\d+)\.xml$/);
    if (m) {
      const n = Number(m[1]);
      const rows = n >= 1 ? await db.sitemapChunk(env.DB, (n - 1) * SITEMAP_CHUNK, SITEMAP_CHUNK) : [];
      if (!rows.length) return textResponse('Not found', { status: 404, cache: 'none' });
      return textResponse(sitemapProducts(site, rows), { type: 'application/xml', method });
    }

    if (path === '/api/stats') return jsonResponse(await db.stats(env.DB), { cache: 'short' });
    if (path === '/api/fx') return jsonResponse(await exchangeRates(site, ctx), { cache: 'hour' });
    if (path === '/api/products') return apiProducts(env, url);
    if (path === '/api/admin/clicks') return adminClicks(request, env, url);

    // Static assets (public/) are served by Cloudflare before the Worker runs; anything else is a 404.
    if (env.ASSETS && /^\/(assets\/|favicon\.ico$)/.test(path)) return env.ASSETS.fetch(request);
    return notFound(path, method);
  }

  // A search that finds nothing on page 1 is tried once more with the Hub's English words (src/lib/hub.js).
  async function searchWithTranslation(env, filters, opts) {
    const result = await db.listProducts(env.DB, filters, opts);
    if (!filters.search || result.total > 0 || opts.page > 1) return { result, used: '' };
    for await (const candidate of translationsFor(env, filters.search)) {
      const second = await db.listProducts(env.DB, { ...filters, search: candidate }, opts);
      if (second.total > 0) return { result: second, used: candidate };
    }
    return { result, used: '' };
  }

  function cached(request, env, ctx, produce) {
    return withEdgeCache(request, ctx, produce, env);
  }

  function notFound(path, method) {
    return htmlResponse(notFoundPage(site, path), { status: 404, cache: 'short', method });
  }

  async function outbound(request, env, ctx, url, id) {
    const product = await db.getProductForRedirect(env.DB, id);
    if (!product) return redirect('/', 302);
    // clickref lets the Awin reports show which site and product produced a click or sale (lessons L15).
    const clickRef = `${site.code.toLowerCase()}-${id}`;
    const target = affiliateTarget(product.affiliate_url, product.retailer, site.awin, clickRef);
    if (!target) return redirect('/', 302);
    // CLICK_LOG = "off" on a preview Worker that shares a live database: test clicks are not recorded.
    if (request.method === 'GET' && !isBot(request) && env.CLICK_LOG !== 'off') {
      let pagePath = '';
      try {
        const ref = new URL(request.headers.get('referer') || '');
        if (ref.hostname === url.hostname) pagePath = ref.pathname.slice(0, 300);
      } catch { /* no referer */ }
      const row = {
        product_id: product.id,
        awin_advertiser_id: product.awin_advertiser_id,
        awin_product_id: product.awin_product_id,
        retailer: product.retailer,
        brand: product.brand,
        category_slug: product.category_slug,
        site_category: product.site_category,
        product_name: String(product.product_name || '').slice(0, 300),
        page_path: pagePath,
        country_code: String((request.cf && request.cf.country) || '').slice(0, 2).toUpperCase(),
        click_ref: clickRef
      };
      const write = db.logClick(env.DB, row).catch(err => console.error('click log failed', err));
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(write); else await write;
    }
    return redirect(target.toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  // /go/<promo id>: a discount code or sale goes to the retailer as an Awin deep link with our clickref.
  async function promoOut(request, env, ctx, url, id) {
    const promo = findPromo(site, id);
    if (!promo) return notFound(url.pathname, request.method);
    const clickRef = `${site.code.toLowerCase()}-promo-${promo.id}`.slice(0, 50);
    const awin = { publisherId: site.awinPublisherId, advertisers: { [promo.retailer]: promo.awinMid } };
    const target = affiliateTarget(promo.url, promo.retailer, awin, clickRef);
    if (!target) return redirect(OFFERS_PATH, 302);
    if (request.method === 'GET' && !isBot(request) && env.CLICK_LOG !== 'off') {
      let pagePath = '';
      try {
        const ref = new URL(request.headers.get('referer') || '');
        if (ref.hostname === url.hostname) pagePath = ref.pathname.slice(0, 300);
      } catch { /* no referer */ }
      const row = {
        product_id: 0,
        awin_advertiser_id: promo.awinMid,
        awin_product_id: '',
        retailer: promo.retailer,
        brand: '',
        category_slug: 'discount-codes',
        site_category: 'Discount codes',
        product_name: `${promo.retailer} ${promo.code || promo.campaign}`.slice(0, 300),
        page_path: pagePath,
        country_code: String((request.cf && request.cf.country) || '').slice(0, 2).toUpperCase(),
        click_ref: clickRef
      };
      const write = db.logClick(env.DB, row).catch(err => console.error('click log failed', err));
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(write); else await write;
    }
    return redirect(target.toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  async function apiProducts(env, url) {
    const p = readListingParams(url);
    const limit = Math.min(60, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '24', 10) || 24));
    const catParam = url.searchParams.get('category') || '';
    const cat = categories.get(catParam) || site.categories.find(c => c.name === catParam);
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').slice(0, 80);
    const { result } = await searchWithTranslation(env, { ...p, category: cat ? cat.slug : '', search }, { sort: p.sort, page: p.page, perPage: limit });
    const origin = `https://${site.domain}`;
    return jsonResponse({
      ok: true,
      products: result.products.map(x => ({
        id: x.id,
        product_name: x.product_name,
        brand: x.brand,
        retailer: x.retailer,
        site_category: x.site_category || (categories.get(x.category_slug) || {}).name || x.category_slug,
        category_slug: x.category_slug,
        subcategory: x.subcategory || '',
        merchant_category: x.merchant_category || '',
        price: x.price,
        was_price: x.was_price,
        currency: x.currency,
        stock_status: Number(x.in_stock) === 1 ? 'in_stock' : 'out_of_stock',
        offers: Number(x.offer_count) || 1,
        image_url: x.image_url,
        product_url: origin + productPath(x),
        affiliate_url: `${origin}/out/${x.id}`
      })),
      pagination: { page: result.page, limit, total: result.total, has_more: result.page < result.pages }
    }, { cache: 'short' });
  }

  async function newsletter(request, env, url) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return jsonResponse({ ok: false, error: 'This form only works on this website.' }, { status: 403 });
    if (!(request.headers.get('content-type') || '').includes('application/json')) {
      return jsonResponse({ ok: false, error: 'Send the form as JSON.' }, { status: 415 });
    }
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const allowed = await rateLimit(env.DB, { route: 'newsletter', client: ip, limit: 5, windowSeconds: 3600 });
    if (!allowed) return jsonResponse({ ok: false, error: 'Too many attempts. Try again in an hour.' }, { status: 429 });
    let data;
    try { data = await request.json(); } catch { return jsonResponse({ ok: false, error: 'The form data could not be read.' }, { status: 400 }); }
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email)) {
      return jsonResponse({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (data.consent !== true) return jsonResponse({ ok: false, error: 'Tick the box to agree to receive the newsletter.' }, { status: 400 });
    const human = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!human) return jsonResponse({ ok: false, error: 'The security check failed. Reload the page and try again.' }, { status: 403 });
    await db.addNewsletter(env.DB, {
      email,
      consentText: `Newsletter from ${site.name}. Unsubscribe any time.`,
      sourcePath: String(data.page || '').slice(0, 200)
    });
    // Same answer whether or not the address was already registered, so the form does not reveal who signed up.
    return jsonResponse({ ok: true, message: 'Thanks. You are signed up.' }, { status: 200 });
  }

  async function cspReport(request) {
    try {
      const text = (await request.text()).slice(0, 2000);
      console.warn('csp-report', text);
    } catch { /* ignore */ }
    return new Response(null, { status: 204, headers: secureHeaders({ 'Cache-Control': 'no-store' }) });
  }

  async function adminClicks(request, env, url) {
    const auth = request.headers.get('authorization') || '';
    if (!env.ADMIN_TOKEN || !safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const days = Math.min(400, Math.max(1, Number.parseInt(url.searchParams.get('days') || '30', 10) || 30));
    const [byRetailer, byDay] = await env.DB.batch([
      env.DB.prepare(`SELECT retailer, COUNT(*) AS clicks FROM affiliate_clicks WHERE clicked_at >= datetime('now', ?) GROUP BY retailer ORDER BY clicks DESC`).bind(`-${days} days`),
      env.DB.prepare(`SELECT date(clicked_at) AS day, COUNT(*) AS clicks FROM affiliate_clicks WHERE clicked_at >= datetime('now', ?) GROUP BY day ORDER BY day`).bind(`-${days} days`)
    ]);
    return jsonResponse({ ok: true, days, by_retailer: byRetailer.results || [], by_day: byDay.results || [] });
  }

  async function scheduled(event, env) {
    db.useLayout(site);
    // Older sites' databases are not cleaned by this Worker (it has no schedule there and must not change them).
    if (db.isLegacy()) return;
    // Retention (privacy policy): clicks 26 months, rate-limit rows after expiry.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM affiliate_clicks WHERE clicked_at < datetime('now', '-26 months')"),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Math.floor(Date.now() / 1000))
    ]);
  }

  return {
    async fetch(request, env, ctx) {
      const host = new URL(request.url).hostname.toLowerCase();
      // Preview addresses (e.g. *.workers.dev) must never be indexed: only the real domain is (lessons L11).
      const preview = isPreviewHost(host, site.domain);
      if (preview && new URL(request.url).pathname === '/robots.txt') {
        return textResponse('User-agent: *\nDisallow: /\n', { cache: 'none', method: request.method });
      }
      db.useLayout(site);
      useSiteAssets(site);
      // Sites with prices in more than one currency (CGW: Reidl and Vevor NL in euros) show "≈ £…" next to them,
      // from the same shared rates as /api/fx. No rates: the price shows in its own currency only.
      if (site.convertForeignPrices) {
        try { useRates(await exchangeRates(site, ctx, env.FX_FETCH || fetch)); } catch { useRates(null); }
      }
      let response;
      try {
        response = await handle(request, env, ctx);
      } catch (err) {
        console.error('request failed', err && err.stack ? err.stack : err);
        response = htmlResponse(errorPage(site), { status: 500, cache: 'none' });
      }
      if (!preview) return response;
      const h = new Headers(response.headers);
      h.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
    },
    scheduled
  };
}

// Where a /out/<id> click goes. An Awin link gets our clickref. A plain retailer address earns no commission,
// so for a retailer we have an Awin programme with it becomes an Awin deep link (lessons L29):
//   https://www.awin1.com/cread.php?awinmid=<advertiser>&awinaffid=<publisher>&clickref=<ref>&ued=<address>
// awin = { publisherId, advertisers: { 'Retailer name': advertiserId } } from the site config.
export function affiliateTarget(address, retailer, awin, clickRef) {
  let target;
  try { target = new URL(String(address || '')); } catch { return null; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
  if (/(^|\.)awin1\.com$/i.test(target.hostname)) {
    if (!target.searchParams.has('clickref')) target.searchParams.set('clickref', clickRef);
    return target;
  }
  const mid = awin && awin.advertisers ? Number(awin.advertisers[String(retailer || '')]) : 0;
  const aff = awin ? Number(awin.publisherId) : 0;
  if (!(mid > 0) || !(aff > 0)) return target;
  const deep = new URL('https://www.awin1.com/cread.php');
  deep.searchParams.set('awinmid', String(mid));
  deep.searchParams.set('awinaffid', String(aff));
  deep.searchParams.set('clickref', clickRef);
  deep.searchParams.set('ued', target.toString());
  return deep;
}

// Hosts that are not the real site: preview and test addresses. Local development (localhost) is not a
// preview, so the QA gate sees the same pages and headers as the real domain.
export function isPreviewHost(host, domain) {
  const h = String(host || '').toLowerCase();
  if (h === domain || h === `www.${domain}`) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return false;
  return true;
}
