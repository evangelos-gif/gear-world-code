// Gear World shared Worker engine. A site's worker.js does: export default createWorker(siteConfig).
import { htmlResponse, jsonResponse, textResponse, redirect, withEdgeCache, secureHeaders } from './lib/http.js';
import { verifyTurnstile, rateLimit, isBot, safeEqual } from './lib/security.js';
import { productPath } from './lib/text.js';
import * as db from './db.js';
import { homePage } from './pages/home.js';
import { categoryPage, searchPage, dealsPage, readListingParams, hasFilters } from './pages/listing.js';
import { productPage } from './pages/product.js';
import { infoPage, infoPaths, notFoundPage, errorPage } from './pages/info.js';
import { sitemapIndex, sitemapStatic, sitemapProducts, robotsTxt, SITEMAP_CHUNK } from './seo.js';

const PER_PAGE = 24;

export function createWorker(site) {
  const categories = new Map(site.categories.map(c => [c.slug, c]));

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
      if (path === '/api/newsletter') return newsletter(request, env, url);
      if (path === '/api/csp-report') return cspReport(request);
      return textResponse('Not found', { status: 404, cache: 'none' });
    }

    // Lower-case and trailing-slash normalisation for page paths.
    if (/^\/(category|product)\/[^?]*[^/]$/.test(path) || (infoPaths().includes(path + '/')) || path === '/deals') {
      url.pathname = path + '/';
      return redirect(url.toString(), 301);
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
        if (!product) return notFound(path, method);
        const canonical = productPath(product);
        if (canonical !== path) return redirect(new URL(canonical, url.origin).toString(), 301);
        const similar = await db.similarProducts(env.DB, product, 8);
        return htmlResponse(productPage(site, product, categories.get(product.category_slug), similar), { method });
      });
    }

    if (path === '/search') {
      const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().slice(0, 80);
      const p = readListingParams(url);
      const result = q
        ? await db.listProducts(env.DB, { ...p, search: q }, { sort: p.sort, page: p.page, perPage: PER_PAGE })
        : { products: [], total: 0, page: 1, pages: 0 };
      return htmlResponse(searchPage(site, q, p, result), { method, cache: 'short' });
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
      return htmlResponse(infoPage(site, path), { method, cache: 'hour' });
    }

    m = path.match(/^\/out\/(\d+)\/?$/);
    if (m) return outbound(request, env, ctx, url, Number(m[1]));

    if (path === '/robots.txt') return textResponse(robotsTxt(site), { method });
    if (path === '/sitemap.xml') {
      const total = await db.sitemapCount(env.DB);
      return textResponse(sitemapIndex(site, total), { type: 'application/xml', method });
    }
    if (path === '/sitemap-static.xml') return textResponse(sitemapStatic(site), { type: 'application/xml', method });
    m = path.match(/^\/sitemap-products-(\d+)\.xml$/);
    if (m) {
      const n = Number(m[1]);
      const rows = n >= 1 ? await db.sitemapChunk(env.DB, (n - 1) * SITEMAP_CHUNK, SITEMAP_CHUNK) : [];
      if (!rows.length) return textResponse('Not found', { status: 404, cache: 'none' });
      return textResponse(sitemapProducts(site, rows), { type: 'application/xml', method });
    }

    if (path === '/api/stats') return jsonResponse(await db.stats(env.DB), { cache: 'short' });
    if (path === '/api/products') return apiProducts(env, url);
    if (path === '/api/admin/clicks') return adminClicks(request, env, url);

    // Static assets (public/) are served by Cloudflare before the Worker runs; anything else is a 404.
    if (env.ASSETS && /^\/(assets\/|favicon\.ico$)/.test(path)) return env.ASSETS.fetch(request);
    return notFound(path, method);
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
    let target;
    try { target = new URL(product.affiliate_url); } catch { return redirect('/', 302); }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return redirect('/', 302);
    // clickref lets the Awin reports show which site and product produced a click or sale (lessons L15).
    const clickRef = `${site.code.toLowerCase()}-${id}`;
    if (/(^|\.)awin1\.com$/i.test(target.hostname) && !target.searchParams.has('clickref')) {
      target.searchParams.set('clickref', clickRef);
    }
    if (request.method === 'GET' && !isBot(request)) {
      let pagePath = '';
      try {
        const ref = new URL(request.headers.get('referer') || '');
        if (ref.hostname === url.hostname) pagePath = ref.pathname.slice(0, 300);
      } catch { /* no referer */ }
      const row = {
        product_id: product.id,
        awin_advertiser_id: product.awin_advertiser_id,
        retailer: product.retailer,
        category_slug: product.category_slug,
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
    const result = await db.listProducts(env.DB, { ...p, category: cat ? cat.slug : '', search }, { sort: p.sort, page: p.page, perPage: limit });
    const origin = `https://${site.domain}`;
    return jsonResponse({
      ok: true,
      products: result.products.map(x => ({
        id: x.id,
        product_name: x.product_name,
        brand: x.brand,
        retailer: x.retailer,
        site_category: (categories.get(x.category_slug) || {}).name || x.category_slug,
        category_slug: x.category_slug,
        price: x.price,
        was_price: x.was_price,
        currency: x.currency,
        stock_status: Number(x.in_stock) === 1 ? 'in_stock' : 'out_of_stock',
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

// Hosts that are not the real site: preview and test addresses. Local development (localhost) is not a
// preview, so the QA gate sees the same pages and headers as the real domain.
export function isPreviewHost(host, domain) {
  const h = String(host || '').toLowerCase();
  if (h === domain || h === `www.${domain}`) return false;
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return false;
  return true;
}
