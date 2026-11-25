// Gear World shared Worker engine. A site's worker.js does: export default createWorker(siteConfig).
import { htmlResponse, jsonResponse, textResponse, redirect, withEdgeCache, withPathCache, secureHeaders, isDbBusy } from './lib/http.js';
import { edgeMemo, memoAllowed } from './lib/memo.js';
import { versionResponse } from './lib/version.js';
import { verifyTurnstile, rateLimit, isBot, safeEqual } from './lib/security.js';
import { productPath } from './lib/text.js';
import * as db from './db.js';
import { homePage } from './pages/home.js';
import { categoryPage, searchPage, dealsPage, readListingParams, hasFilters } from './pages/listing.js';
import { productPage, hiddenProductPage } from './pages/product.js';
import { comparePage, parseCompareIds } from './pages/compare.js';
import { cartPage, parseCartItems, cartQuery, SAVED_PATH } from './pages/cart.js';
import { exchangeRates } from './lib/fx.js';
import { translationsFor } from './lib/hub.js';
import { offersIndexPage, retailerOffersPage, OFFERS_PATH } from './pages/offers.js';
import { findPromo, promoViewSite } from './lib/promos.js';
import { campaignRefs } from './lib/ads.js';
import { infoPage, infoPaths, notFoundPage, errorPage, dealUpdatesPage } from './pages/info.js';
import { useSiteAssets, useRates, ukBarHtml, browseBarHtml, appBarHtml } from './pages/layout.js';
import { appBarWanted } from './lib/app.js';
import { sitemapIndex, sitemapStatic, sitemapProducts, robotsTxt, SITEMAP_CHUNK } from './seo.js';
import { posterScan } from './lib/poster-scan.js';
import { guidePage, guidesIndexPage, findGuide, guideProductIds, listedGuides, allGuideProductIds, GUIDES_PATH } from './pages/guides.js';
import { viewFor, hubViewFor, browseView, homeView, hiddenReason, needsCheck, cacheKeyUrl, needsUkBar, retailerInView, cleanCountry, now as clockNow } from './lib/visibility.js';
import { deliveryCountries } from './lib/delivery.js';
import { remindProbe, REMIND_UNTIL, REMIND_URL, REMIND_PATH } from './lib/remind.js';
import { noAlerts } from './lib/retailer-terms.js';
import { COUNTRY_LANGUAGES, MULTI_LANGUAGE_COUNTRIES } from './lib/country-language.js';
import { yadoreMarket, yadoreBox, yadoreClick, visitorGate, notAClick, capsFor, yadoreKey, CLICK_PREFIX, YADORE_GAP_SECONDS } from './lib/yadore.js';

// Gear World Hub keeps the one list of members; sites reach it only through a service binding (lessons L92).
// The address is not public: requests from the internet never carry this host name.
export const HUB_SUBSCRIBE_URL = 'https://hub.internal/internal/subscribe';
// Newer sites bind it as HUB; the older sites already had GW_HUB (the same Worker, used for search translations).
export function hubBinding(env) {
  const b = env && (env.HUB || env.GW_HUB);
  return b && typeof b.fetch === 'function' ? b : null;
}
export function hubReady(env) {
  return Boolean(hubBinding(env));
}
// The public Turnstile sitekey of the "Get deal updates" box (security fixes F02, lessons L106). It is a Worker secret
// TURNSTILE_SITE_KEY, set on every site by tools/gw-security-fixes.ps1 -Step turnstile (a sitekey is public, but this way
// it needs no change in the code or the configs). The Hub checks the token with its own secret key. Without a valid
// sitekey the box is not shown, because the Hub would refuse every sign-up.
// How long one data centre keeps /api/stats (the visitor still gets the same answer and headers).
export const STATS_CACHE_SECONDS = 3600;
export const TURNSTILE_ACTION = 'deal-updates';
export function turnstileSiteKey(env) {
  const k = String((env && env.TURNSTILE_SITE_KEY) || '').trim();
  return /^[0-9]x[0-9A-Za-z_-]{10,64}$/.test(k) ? k : '';
}
// A one-way key for the visitor's IP address, so the Hub can limit attempts without ever seeing the address.
export async function clientKey(ip) {
  const bytes = new TextEncoder().encode('gw-deal-updates:' + String(ip || 'unknown'));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PER_PAGE = 24;

// The visitor's country for the view (lessons L107): Cloudflare's request.cf.country. Gear World Hub asks /api/products
// from its own Worker, so it passes its visitor's country as ?deliver_to=XX (only that endpoint reads it). A local test
// Worker (localhost, the checks) may set the day with the variable GW_TODAY=YYYY-MM-DD, never the live domain.
// Google's crawlers (Search, Ads, Merchant Center, URL inspection) count as UK visitors: the UK view, the one the
// sitemaps list, and no "adding retailers for your country" bar. A user agent that only claims to be one of them gets
// the same UK view as anyone, so it gains nothing.
export const GOOGLE_CRAWLER = /\b(Googlebot|AdsBot-Google(-Mobile)?|Google-InspectionTool|Storebot-Google|Mediapartners-Google|GoogleOther)\b/i;
// A local test Worker (wrangler dev on localhost, the checks) gets a made-up request.cf from Miniflare, with country
// "US": it counts as an unknown country (since L151 the all view with its bar), not as the US view of lessons L141.
// Only ?deliver_to= of /api/products and the crawler rule apply there.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// The network's own read-only checks (lessons L158, chat 2, 15 Nov 2026): they run in the cloud, where the address is
// in the US or unknown, so they saw the US or the all view ("does not deliver to your country", 0 products) instead of
// the page a UK visitor gets. A request named GearWorldQA-bot that also sends the header X-GW-QA-Country: GB (or any
// other 2-letter code) gets that country's view, pages and /api/products alike. Not a secret: the checks run in the
// cloud chats, where no key may be kept, and the view it opens is the public page of that country (a UK visitor sees
// it anyway). Not in the address either, so no link, no copy in Google and no cache entry of its own: the page cache
// keeps one copy per view group, the same one a visitor of that country gets. Without the header, or with any other
// name, nothing changes. ?deliver_to= of /api/products still comes first.
export const QA_BOT = /^GearWorldQA-bot\//;
export const QA_COUNTRY_HEADER = 'X-GW-QA-Country';
function requestCountry(request, url, apiProducts = false) {
  const ua = request.headers.get('user-agent') || '';
  if (GOOGLE_CRAWLER.test(ua)) return 'GB';
  const asked = apiProducts ? url.searchParams.get('deliver_to') : '';
  if (asked) return asked;
  const qa = QA_BOT.test(ua) ? cleanCountry(request.headers.get(QA_COUNTRY_HEADER)) : '';
  if (qa) return qa;
  if (LOCAL_HOSTS.has(String(url.hostname || '').toLowerCase())) return '';
  return (request.cf && request.cf.country) || '';
}
// Browsing as one country from the Group's country pages (owner, 15 Nov 2026, lessons L160). A link
// https://<site>/?for=de answers with a redirect to the same page without ?for= and a cookie gw_for=DE (one day, this
// site only, no tracking: it holds the country and nothing else). With the cookie every page and /api/products shows only
// what delivers to that country (src/lib/visibility.js browseView), with a bar on top that says so and links to
// ?for=off, which removes the cookie. Google's crawlers never browse that way (no cookie, and ?for= only redirects them),
// so Search keeps the UK view. The Hub's ?deliver_to= of /api/products comes first.
export const BROWSE_PARAM = 'for';
export const BROWSE_COOKIE = 'gw_for';
const BROWSE_SECONDS = 86400;
function browseCountry(request) {
  if (GOOGLE_CRAWLER.test(request.headers.get('user-agent') || '')) return '';
  const m = /(?:^|;\s*)gw_for=([A-Za-z]{2})(?=;|$)/.exec(request.headers.get('cookie') || '');
  return m ? cleanCountry(m[1]) : '';
}
function browseRedirect(request, url) {
  const asked = String(url.searchParams.get(BROWSE_PARAM) || '').trim();
  const cc = cleanCountry(asked);
  const clean = new URL(url.toString());
  clean.searchParams.delete(BROWSE_PARAM);
  const res = redirect(clean.toString(), 302);
  if (!GOOGLE_CRAWLER.test(request.headers.get('user-agent') || '')) {
    res.headers.append('Set-Cookie', cc
      ? `${BROWSE_COOKIE}=${cc}; Path=/; Max-Age=${BROWSE_SECONDS}; Secure; HttpOnly; SameSite=Lax`
      : `${BROWSE_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
  }
  return res;
}
function localDay(env, host) {
  const day = String((env && env.GW_TODAY) || '');
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return local && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T12:00:00Z`) : null;
}
// Marks the rows the visitor sees: checkRetailer = the price was last checked 14-30 days ago (no stock claim).
function marked(view, rows) {
  for (const r of rows || []) if (r) r.checkRetailer = needsCheck(view, r);
  return rows;
}

export function createWorker(site) {
  const categories = new Map(site.categories.map(c => [c.slug, c]));
  // Older Gear World sites keep their database exactly as it is (lessons L28).
  db.useLayout(site);
  // "Remind me on 27 Nov" (lessons L182): is the Hub's list open? Asked at most every few minutes.
  const remindOpen = remindProbe();

  async function handle(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const host = url.hostname.toLowerCase();
    // "Get deal updates" is on when this Worker can reach Gear World Hub (service binding HUB, lessons L92).
    site.dealUpdates = hubReady(env);
    // The box itself needs the Turnstile sitekey too (F02, L106); never on a test address (it is not one of the widget's
    // hostnames, and a test Worker must not sign anyone up).
    site.dealTurnstileKey = site.dealUpdates && !isPreviewHost(host, site.domain) ? turnstileSiteKey(env) : '';

    // One canonical host (lessons L11): www and any other host redirect to the apex domain.
    if (host === `www.${site.domain}`) {
      url.hostname = site.domain;
      return redirect(url.toString(), 301);
    }

    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
      return textResponse('Method not allowed', { status: 405, cache: 'none' });
    }

    const path = url.pathname;
    // Which code version is live, for the deploy tools' check (lessons L156). Before anything that reads the database.
    if (path === '/api/version' && method !== 'POST') return versionResponse(env);
    // A link from the Group's country page (?for=<cc>) or "Show what delivers to my country" (?for=off), lessons L160.
    if (method !== 'POST' && url.searchParams.has(BROWSE_PARAM)) return browseRedirect(request, url);
    // What this visitor may see (lessons L107): their country group, and prices checked in the last 30 days.
    const at = localDay(env, host) ?? clockNow();
    // Gear World Hub (?deliver_to= without &badges=1): the views of before L151 until its cards say where each retailer
    // delivers (src/lib/visibility.js hubViewFor).
    const hubAsk = path === '/api/products' && Boolean(url.searchParams.get('deliver_to')) && url.searchParams.get('badges') !== '1';
    const browsing = hubAsk || (path === '/api/products' && url.searchParams.get('deliver_to')) ? '' : browseCountry(request);
    const view = browsing ? browseView(site, browsing, at)
      : (hubAsk ? hubViewFor : viewFor)(site, requestCountry(request, url, path === '/api/products'), at);
    const ukView = homeView(site, at);
    // The pages of this answer: the site with the visitor's view, so the discount codes, their footer link, the top bar
    // and the seasonal banner above the codes follow the same retailers as the products (lessons L114). A copy for this
    // request only: the shared config is read by other requests at the same time. Cached pages keep one copy per view
    // group (cacheKeyUrl), so a code never shows in another group's copy.
    const shown = promoViewSite(site, view);

    // POST endpoints
    if (method === 'POST') {
      if (path === '/api/newsletter' && (hubReady(env) || !db.isLegacy())) return newsletter(request, env, url, shown);
      if (path === REMIND_PATH && hubReady(env)) return remind(request, env, url, shown, view, at);
      if (path === '/api/csp-report') return cspReport(request);
      return textResponse('Not found', { status: 404, cache: 'none' });
    }

    // Lower-case and trailing-slash normalisation for page paths.
    if (/^\/(category|product|discount-codes|guides)\/[^?]*[^/]$/.test(path) || path === '/discount-codes' || path === '/guides' || (infoPaths().includes(path + '/')) || path === '/deals') {
      url.pathname = path + '/';
      return redirect(url.toString(), 301);
    }

    // Gear World Hub search links use the older sites' format /?search=<q>&highlight=<id> (lessons L22).
    if (path === '/' && (url.searchParams.has('highlight') || url.searchParams.has('search'))) {
      // The language the visitor chose on the Hub (?lang=, lessons L174, L175) goes with the redirect, when the site has it.
      const askedLang = url.searchParams.get('lang') || '';
      const keepLang = (site.languages || []).some(l => l.code === askedLang) ? askedLang : '';
      const target = to => { if (keepLang) to.searchParams.set('lang', keepLang); return to.toString(); };
      const id = Number.parseInt(url.searchParams.get('highlight') || '', 10);
      if (Number.isSafeInteger(id) && id > 0) {
        // The product page itself says when the visitor's view does not list the product (lessons L107).
        const product = await db.getProduct(env.DB, id);
        if (product) return redirect(target(new URL(productPath(product), url.origin)), 302);
      }
      const q = (url.searchParams.get('search') || '').normalize('NFKC').trim().slice(0, 80);
      return redirect(target(new URL(q ? `/search?q=${encodeURIComponent(q)}` : '/', url.origin)), 302);
    }

    if (path === '/') {
      // Poster QR scans (lessons L76): counted in the background, the page does not wait for it. Not on a test address.
      posterScan(request, env, ctx, { site: site.code.toLowerCase(), domain: site.domain, off: env.CLICK_LOG === 'off' });
      return cached(request, env, ctx, async () => {
        const data = await db.homeData(env.DB, site.categories.map(c => c.slug), { view });
        marked(view, data.deals);
        marked(view, data.newest);
        return htmlResponse(homePage(shown, data), { method });
      }, view);
    }

    let m = path.match(/^\/category\/([a-z0-9-]+)\/$/);
    if (m) {
      const cat = categories.get(m[1]);
      if (!cat) return notFound(path, method, shown);
      // Yadore (lessons L235): the visitor's own country (never the Group's ?for= browsing), a Yadore market of ours, the
      // key set and the day come. Its page copy is kept apart (one per market), so no other country ever gets the box.
      // Only for a GET of a person (or the network's own read-only check, L158) on the real domain: Yadore is not asked
      // for a bot's, a HEAD's or a test address's copy.
      const ydPerson = method === 'GET' && (!isBot(request) || QA_BOT.test(request.headers.get('user-agent') || '')) && !isPreviewHost(host, site.domain);
      const ydMarket = ydPerson ? yadoreMarket(site, env, cat, browsing ? '' : requestCountry(request, url), at) : '';
      return cached(request, env, ctx, async () => {
        const p = readListingParams(url);
        // ?sub= only for a subcategory the site config lists for this category (ZGW birds); anything else is ignored.
        const sub = (Array.isArray(cat.subcategories) ? cat.subcategories : []).find(s => s.slug === p.sub);
        if (!sub) p.sub = '';
        // A subcategory with `match` is found by words in the product name (TGW Mini PCs, lessons L97).
        const subMatch = sub && sub.match ? { words: sub.match, not: sub.exclude || [] } : null;
        const [result, facets, subCounts] = await Promise.all([
          db.listProducts(env.DB, { ...p, category: cat.slug, subcategory: sub && !subMatch ? sub.name : '', subMatch, view }, { sort: p.sort, page: p.page, perPage: PER_PAGE }),
          db.facets(env.DB, cat.slug, subMatch, view),
          cat.subcategories && cat.subcategories.length ? db.subcategoryCounts(env.DB, cat.slug, cat.subcategories, view) : null
        ]);
        if (p.page > 1 && p.page > result.pages && !hasFilters(p)) return notFound(path, method, shown);
        marked(view, result.products);
        // The box of offers from other stores: page 1 without filters, in a category of the Manager's list (yadore-words.js).
        const yd = ydMarket && p.page === 1 && !hasFilters(p)
          ? await yadoreBox(env, ctx, { site, cat, market: ydMarket, own: result.products, at, origin: url.origin })
          : null;
        return htmlResponse(categoryPage(shown, cat, p, result, facets, subCounts, yd), { method });
      }, view, ydMarket ? `yd-${ydMarket}` : '');
    }

    m = path.match(/^\/product\/([a-z0-9-]*)-(\d+)\/$/);
    if (m) {
      return cached(request, env, ctx, async () => {
        // photos: the product's extra photos for the gallery (lessons L206), only on this page.
        const product = await db.getProduct(env.DB, Number(m[2]), { photos: true });
        if (!product) {
          const alt = await db.activeVariantOf(env.DB, Number(m[2]));
          return alt ? redirect(new URL(productPath(alt), url.origin).toString(), 301) : notFound(path, method, shown);
        }
        const canonical = productPath(product);
        if (canonical !== path) return redirect(new URL(canonical, url.origin).toString(), 301);
        // Not for this visitor (another country's retailer, or a price older than 30 days): the old link still opens,
        // with a notice, no price or button, noindex, and nothing else read (lessons L107).
        const reason = hiddenReason(view, product);
        if (reason) return htmlResponse(hiddenProductPage(shown, product, categories.get(product.category_slug), reason), { method });
        // "Remind me on 27 Nov" (lessons L182): only with the "Get deal updates" box (Hub link and Turnstile sitekey),
        // until 27 Nov 06:00 (London), and while the Hub's list is open; asked at the same time as the database.
        const askHub = Boolean(shown.dealTurnstileKey) && at <= REMIND_UNTIL;
        const [similar, offers, open] = await Promise.all([db.similarProducts(env.DB, product, 8, { view }), db.offersFor(env.DB, product, 12, { view }),
          askHub ? remindOpen(hubBinding(env), at) : false]);
        shown.remindOpen = open;
        marked(view, [product]);
        marked(view, similar);
        marked(view, offers);
        return htmlResponse(productPage(shown, product, categories.get(product.category_slug), similar, offers), { method });
      }, view);
    }

    if (path === '/compare/' || path === '/compare') {
      if (path === '/compare') return redirect(new URL('/compare/' + url.search, url.origin).toString(), 301);
      const ids = parseCompareIds(url);
      const products = marked(view, (await db.getProductsByIds(env.DB, ids)).filter(x => !hiddenReason(view, x)));
      return htmlResponse(comparePage(shown, products, ids), { method, cache: 'short' });
    }

    // The saved list (lessons L101). The older "Gear Cart" addresses (/cart/, also in bookmarks and old pages in a
    // browser) lead here, with the same items.
    if (site.cart && (path === '/cart/' || path === '/cart' || path === '/saved')) {
      const items = parseCartItems(url, site.cart);
      return redirect(new URL(cartQuery(items), url.origin).toString(), 301);
    }
    if (site.cart && path === SAVED_PATH) {
      const items = parseCartItems(url, site.cart);
      const products = marked(view, (await db.getProductsByIds(env.DB, items.map(x => x.id))).filter(x => !hiddenReason(view, x)));
      return htmlResponse(cartPage(shown, products, items), { method, cache: 'short' });
    }

    if (path === '/search') {
      const q = (url.searchParams.get('q') || '').normalize('NFKC').trim().slice(0, 80);
      const p = readListingParams(url);
      // The shops and brands of the search (lessons L98) are read at the same time as the products; when the words found
      // nothing and a translation did, they are read again for the translated words.
      const [found, firstFacets] = q
        ? await Promise.all([
          searchWithTranslation(env, { ...p, search: q, view }, { sort: p.sort, page: p.page, perPage: PER_PAGE }, translateOptions(request, url)),
          db.searchFacets(env.DB, q, view)
        ])
        : [{ result: { products: [], total: 0, page: 1, pages: 0 }, used: '' }, null];
      const searchFacets = q && found.used ? await db.searchFacets(env.DB, found.used, view) : firstFacets;
      marked(view, found.result.products);
      return htmlResponse(searchPage(shown, q, p, found.result, found.used, searchFacets), { method, cache: 'short' });
    }

    if (path === '/deals/') {
      return cached(request, env, ctx, async () => {
        const p = readListingParams(url);
        // Below their RRP, in stock, and checked in the last 14 days (lessons L107).
        const result = await db.listProducts(env.DB, { onSale: true, inStock: true, view, fresh: true }, { sort: 'saving', page: p.page, perPage: PER_PAGE });
        if (p.page > 1 && p.page > result.pages) return notFound(path, method, shown);
        marked(view, result.products);
        return htmlResponse(dealsPage(shown, p, result), { method });
      }, view);
    }

    // Buying guides (lessons L82): only on a site that has them (site.guides). Prices and stock come from the
    // database by product id (a few rows, primary key), so a guide never shows a price the site does not have.
    // The list shows only the guides with at least 3 products in the visitor's view (lessons L107).
    if (site.guides && site.guides.length && path === GUIDES_PATH) {
      return cached(request, env, ctx, async () => {
        const products = (await db.getGuideProducts(env.DB, allGuideProductIds(site))).filter(x => !hiddenReason(view, x));
        return htmlResponse(guidesIndexPage(shown, listedGuides(site, products)), { method });
      }, view);
    }
    m = path.match(/^\/guides\/([a-z0-9-]{1,80})\/$/);
    if (m) {
      const guide = findGuide(site, m[1]);
      if (!guide) return notFound(path, method, shown);
      return cached(request, env, ctx, async () => {
        // A product the visitor may not see counts as no longer listed: the guide hides its price and button (L107).
        const products = marked(view, (await db.getGuideProducts(env.DB, guideProductIds(guide))).filter(x => !hiddenReason(view, x)));
        return htmlResponse(guidePage(shown, guide, products), { method });
      }, view);
    }

    if (infoPaths().includes(path)) {
      return htmlResponse(infoPage(shown, path), { method, cache: 'page' });
    }

    if (path === OFFERS_PATH) return htmlResponse(offersIndexPage(shown), { method, cache: 'page' });
    m = path.match(/^\/discount-codes\/([a-z0-9-]{1,40})\/$/);
    if (m) {
      const html = retailerOffersPage(shown, m[1]);
      return html ? htmlResponse(html, { method, cache: 'page' }) : notFound(path, method, shown);
    }
    m = path.match(/^\/go\/([a-z0-9-]{1,60})\/?$/);
    if (m) return promoOut(request, env, ctx, url, m[1], view, shown);

    // A click in the box of offers from other stores (Yadore, lessons L235): the signed link of that box.
    m = path.match(/^\/out\/y\/([A-Za-z0-9_.-]{40,3100})\/?$/);
    if (m) return yadoreOut(request, env, url, m[1], at);
    m = path.match(/^\/out\/(\d+)\/?$/);
    if (m) return outbound(request, env, ctx, url, Number(m[1]), view);

    if (path === '/robots.txt') return textResponse(robotsTxt(site), { method });
    // The sitemaps are the UK view for everyone (lessons L107): no product or category that the UK view hides.
    if (path === '/sitemap.xml') {
      const chunks = Math.ceil((await db.sitemapMaxId(env.DB)) / SITEMAP_CHUNK);
      return textResponse(sitemapIndex(site, chunks), { type: 'application/xml', method });
    }
    if (path === '/sitemap-static.xml') {
      const counts = await db.categoryCounts(env.DB, ukView);
      const guides = site.guides && site.guides.length
        ? listedGuides(site, (await db.getGuideProducts(env.DB, allGuideProductIds(site))).filter(x => !hiddenReason(ukView, x)))
        : [];
      // The codes pages in the sitemap: the UK view, like everything else in it (lessons L114).
      return textResponse(sitemapStatic(promoViewSite(site, ukView), counts, guides), { type: 'application/xml', method });
    }
    m = path.match(/^\/sitemap-products-(\d+)\.xml$/);
    if (m) {
      const n = Number(m[1]);
      // A sitemap the index lists answers, also when its id range has no product shown now (an empty list, not a 404).
      const rows = n >= 1 && n <= 100000 ? await db.sitemapChunk(env.DB, n, SITEMAP_CHUNK, ukView) : [];
      if (!rows.length && !(n >= 1 && n <= Math.ceil((await db.sitemapMaxId(env.DB)) / SITEMAP_CHUNK))) return textResponse('Not found', { status: 404, cache: 'none' });
      return textResponse(sitemapProducts(site, rows), { type: 'application/xml', method });
    }

    // Product and retailer counts (the Hub and the group page read them): one D1 query per data centre and hour (L106).
    if (path === '/api/stats') {
      // The cache key names the answer's shape (L130: delivery per retailer), so a copy of the older shape is not used.
      return withPathCache(request, ctx, `${url.origin}/api/stats?shape=2`, STATS_CACHE_SECONDS,
        async () => jsonResponse(await db.stats(env.DB, ukView, site), { cache: 'short' }), env);
    }
    if (path === '/api/fx') return jsonResponse(await exchangeRates(site, ctx), { cache: 'hour' });
    if (path === '/api/products') return apiProducts(env, url, request, view);
    if (path === '/api/admin/clicks') return adminClicks(request, env, url);

    // Static assets (public/) are served by Cloudflare before the Worker runs; anything else is a 404.
    if (env.ASSETS && /^\/(assets\/|favicon\.ico$)/.test(path)) return env.ASSETS.fetch(request);
    return notFound(path, method, shown);
  }

  // When a model may translate a search (src/lib/hub.js, F03, lessons L106): never for a bot, and never when the Hub
  // sends translate=0 (it has translated the words already, so the site would only pay for the same work again).
  function translateOptions(request, url) {
    return {
      noAI: isBot(request) || url.searchParams.get('translate') === '0',
      site: site.code.toLowerCase(),
      origin: `https://${site.domain}`
    };
  }

  // A search that finds nothing on page 1 is tried once more with the Hub's English words (src/lib/hub.js).
  async function searchWithTranslation(env, filters, opts, translate = {}) {
    const result = await db.listProducts(env.DB, filters, opts);
    if (!filters.search || result.total > 0 || opts.page > 1) return { result, used: '', tried: [] };
    const tried = [];
    for await (const candidate of translationsFor(env, filters.search, translate)) {
      tried.push(candidate);
      const second = await db.listProducts(env.DB, { ...filters, search: candidate }, opts);
      if (second.total > 0) return { result: second, used: candidate, tried };
    }
    return { result, used: '', tried };
  }

  // One cached copy per page AND country group (lessons L107), so a visitor never gets another country's page.
  // extra: a part of the page that only some countries of the group get (the Yadore box of one market, L235).
  function cached(request, env, ctx, produce, view, extra = '') {
    if (extra) return withEdgeCache(request, ctx, produce, env, withExtra(cacheKeyUrl(request.url, view), extra));
    return withEdgeCache(request, ctx, produce, env, cacheKeyUrl(request.url, view));
  }
  function withExtra(keyUrl, extra) {
    const key = new URL(keyUrl);
    key.searchParams.set('gw-extra', extra);
    return key.toString();
  }

  function notFound(path, method, pageSite = site) {
    return htmlResponse(notFoundPage(pageSite, path), { status: 404, cache: 'short', method });
  }

  async function outbound(request, env, ctx, url, id, view) {
    const product = await db.getProductForRedirect(env.DB, id);
    if (!product) return redirect('/', 302);
    // A retailer that does not deliver to the visitor, or a price older than 30 days (lessons L107): no visit to the
    // retailer, the product page with its notice instead.
    if (hiddenReason(view, product)) {
      return redirect(new URL(productPath({ ...product, product_slug: db.productSlugOf(product) }), url.origin).toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
    }
    // clickref lets the Awin reports show which site and product produced a click or sale (lessons L15).
    const clickRef = `${site.code.toLowerCase()}-${id}`;
    // utm_campaign / utm_source of the visit (lessons L93) go to Awin as clickref2 / clickref3: clicks and sales per campaign.
    const target = affiliateTarget(product.affiliate_url, product.retailer, site.awin, clickRef, campaignRefs(url));
    if (!target) return redirect('/', 302);
    // CLICK_LOG = "off" on a preview Worker that shares a live database: test clicks are not recorded. A test address
    // (*.workers.dev, a preview URL) never records a click either: it is not behind the security rules of the real
    // domain, so its clicks would be fake Awin clicks (security fixes F04, lessons L106).
    if (request.method === 'GET' && !isBot(request) && env.CLICK_LOG !== 'off' && !isPreviewHost(url.hostname, site.domain)) {
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

  // /out/y/<token>: a click in the Yadore box (lessons L235). To the store through Yadore only for a person in that
  // market's country on the real domain, with a fresh link of a store still on the list and clicks of the day left;
  // anything else goes back to the category page, with nothing recorded. The click is recorded before the redirect, so
  // the count of the day is right for the next one.
  async function yadoreOut(request, env, url, token, at) {
    // A prefetch or prerender is no click: an answer the browser must not keep or reuse for the real click.
    if (notAClick(request.headers) === 'prefetch') return new Response(null, { status: 503, headers: secureHeaders({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }) });
    const r = await yadoreClick({
      env, site, token, at, categories,
      country: String((request.cf && request.cf.country) || ''),
      bot: request.method !== 'GET' || isBot(request) || GOOGLE_CRAWLER.test(request.headers.get('user-agent') || '') || Boolean(notAClick(request.headers)),
      preview: isPreviewHost(url.hostname, site.domain) || env.CLICK_LOG === 'off'
    });
    if (!r.log) return redirect(new URL(r.to, url.origin).toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
    // One person: at most YADORE_PER_VISITOR clicks a day on this site and one per offer link (a one-way hash, cache only).
    let cache = null;
    try { cache = typeof caches !== 'undefined' && caches.default && env.EDGE_CACHE !== 'off' ? caches.default : null; } catch { cache = null; }
    const gate = await visitorGate({ origin: url.origin, site, ip: request.headers.get('cf-connecting-ip') || '', token: `${r.log.retailer}|${r.to}`, at, cache, secret: yadoreKey(env) });
    const toPage = redirect(new URL(r.log.category_slug && categories.has(r.log.category_slug) ? `/category/${r.log.category_slug}/` : '/', url.origin).toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
    if (!gate.ok) return toPage;
    let pagePath = '';
    try {
      const ref = new URL(request.headers.get('referer') || '');
      if (ref.hostname === url.hostname) pagePath = ref.pathname.slice(0, 300);
    } catch { /* no referer */ }
    // Recorded in one statement with the caps of the day (src/db.js logYadoreClick). Not recorded (a cap reached at the
    // same moment, or the database failing) = not counted, so it does not go to Yadore either.
    const cap = capsFor(at);
    let written = 0;
    try {
      written = await db.logYadoreClick(env.DB, { ...r.log, page_path: pagePath, country_code: String((request.cf && request.cf.country) || '').slice(0, 2).toUpperCase() },
        { day: new Date(at).toISOString().slice(0, 10), site: cap ? cap.site : 0, store: cap ? cap.store : 0, prefix: CLICK_PREFIX, at, gap: YADORE_GAP_SECONDS });
    } catch (err) {
      console.error('yadore click log failed', err && err.message);
      return toPage;
    }
    if (!written) return toPage;
    // Counted for this visitor only once the click is recorded (a click sent back costs them nothing; clicks at the same
    // moment are already one at a time through the 10-second gap of the statement above).
    await gate.save();
    return redirect(r.to, 302, { 'X-Robots-Tag': 'noindex, nofollow' });
  }

  // /go/<promo id>: a discount code or sale goes to the retailer as an Awin deep link with our clickref.
  // A code whose retailer is not in the visitor's view goes to its codes page (which then shows no code), never to the
  // retailer, like /out/ for a product the visitor may not see (lessons L107, L114). No click is recorded.
  async function promoOut(request, env, ctx, url, id, view = null, pageSite = site) {
    const promo = findPromo(site, id);
    if (!promo) return notFound(url.pathname, request.method, pageSite);
    if (!retailerInView(view, promo.retailer)) return redirect(new URL(`${OFFERS_PATH}${promo.slug}/`, url.origin).toString(), 302, { 'X-Robots-Tag': 'noindex, nofollow' });
    const clickRef = `${site.code.toLowerCase()}-promo-${promo.id}`.slice(0, 50);
    const awin = { publisherId: site.awinPublisherId, advertisers: { [promo.retailer]: promo.awinMid } };
    const target = affiliateTarget(promo.url, promo.retailer, awin, clickRef, campaignRefs(url));
    if (!target) return redirect(OFFERS_PATH, 302);
    if (request.method === 'GET' && !isBot(request) && env.CLICK_LOG !== 'off' && !isPreviewHost(url.hostname, site.domain)) {
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

  // view: the visitor's (the Hub passes its visitor's country as ?deliver_to=XX): only products they may see, and a
  // price checked 14-30 days ago says stock_status "check_retailer" (no stock claim, lessons L107).
  async function apiProducts(env, url, request, view) {
    const p = readListingParams(url);
    const limit = Math.min(60, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '24', 10) || 24));
    const catParam = url.searchParams.get('category') || '';
    const cat = categories.get(catParam) || site.categories.find(c => c.name === catParam);
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').slice(0, 80);
    const { result, used, tried } = await searchWithTranslation(env, { ...p, category: cat ? cat.slug : '', search, view }, { sort: p.sort, page: p.page, perPage: limit }, translateOptions(request, url));
    marked(view, result.products);
    const origin = `https://${site.domain}`;
    // ?images=1 (the mobile app, lessons L206): each product that has extra photos also gets "images", an array of 0-4
    // https addresses (never the main image_url). One more read, by primary key, of only the listed rows; without the
    // parameter (the Hub search, whose cards keep one photo) the answer and the reads are exactly as before.
    const photos = url.searchParams.get('images') === '1' ? await db.imagesFor(env.DB, result.products) : null;
    return jsonResponse({
      ok: true,
      // Search in other languages: the English words used, and every translation tried (helps to see why a word finds nothing).
      ...(tried.length ? { search_used: used, search_tried: tried } : {}),
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
        stock_status: x.checkRetailer ? 'check_retailer' : Number(x.in_stock) === 1 ? 'in_stock' : 'out_of_stock',
        offers: Number(x.offer_count) || 1,
        image_url: x.image_url,
        // Where the retailer delivers (lessons L151): country codes, 'EU' or 'WORLD', as the site's own cards say it.
        delivers_to: deliveryCountries(site, x.retailer),
        product_url: origin + productPath(x),
        affiliate_url: `${origin}/out/${x.id}`,
        ...(photos && photos.has(Number(x.id)) ? { images: photos.get(Number(x.id)) } : {})
      })),
      pagination: { page: result.page, limit, total: result.total, has_more: result.page < result.pages }
    }, { cache: 'short' });
  }

  // Sign-up for deal updates. With the service binding HUB (lessons L92) the address goes to the one member list of
  // Gear World Hub, for every site, older ones included (their own databases do not change, L28). Without it, newer
  // sites keep their own newsletter table as before. Works as a plain form post (an HTML answer) or as JSON.
  async function newsletter(request, env, url, pageSite = site) {
    const ctype = (request.headers.get('content-type') || '').toLowerCase();
    const isForm = ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data');
    const answer = (ok, message, status) => (isForm
      ? htmlResponse(dealUpdatesPage(pageSite, ok, message), { status, cache: 'none' })
      : jsonResponse(ok ? { ok: true, message } : { ok: false, error: message }, { status }));
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return answer(false, 'This form only works on this website.', 403);
    if (!isForm && !ctype.includes('application/json')) return answer(false, 'Send the form as JSON.', 415);
    if (Number(request.headers.get('content-length') || 0) > 4096) return answer(false, 'The form is too large.', 413);
    let data;
    try {
      if (isForm) {
        const f = await request.formData();
        data = { email: f.get('email'), consent: f.get('consent') === 'yes' || f.get('consent') === 'on', page: f.get('page'), website: f.get('website'), turnstile_token: f.get('cf-turnstile-response') };
      } else {
        data = await request.json();
      }
    } catch { return answer(false, 'The form data could not be read.', 400); }
    if (!data || typeof data !== 'object') return answer(false, 'The form data could not be read.', 400);
    const thanks = 'Thanks. You are signed up for deal updates. Every email has an unsubscribe link.';
    // A filled hidden field means a bot: the same answer as a real sign-up, and nothing is kept.
    if (String(data.website || '').trim()) return answer(true, thanks, 200);
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email)) return answer(false, 'Enter a valid email address.', 400);
    if (data.consent !== true) return answer(false, 'Tick the box to agree to receive deal emails.', 400);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const page = /^\/[^/\\]/.test(String(data.page || '')) || data.page === '/' ? String(data.page).slice(0, 200) : '/';

    if (hubReady(env)) {
      // Turnstile (F02, lessons L07, L106): the widget's token goes to the Hub, which checks it with its secret key (it
      // knows which hostname and form the token was made for). Without a token nothing is sent.
      const token = String(data.turnstile_token || '').trim();
      // No token at all: the visitor's browser runs no JavaScript, so the check never started (L106).
      if (!token) return answer(false, 'This sign-up box needs JavaScript for its security check. Turn on JavaScript and try again.', 403);
      if (token.length > 2048) return answer(false, 'The security check failed. Reload the page and try again.', 403);
      let r;
      try {
        const res = await hubBinding(env).fetch(HUB_SUBSCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // form 'popup': the small sign-up window (lessons L182), counted apart by the Hub; anything else is the box.
          body: JSON.stringify({ email, consent: true, site: site.code.toLowerCase(), page, client: await clientKey(ip), turnstile_token: token, form: data.form === 'popup' ? 'popup' : 'box' })
        });
        r = await res.json().catch(() => ({ ok: false }));
        // The network's sign-ups of the day are full (F02): a friendly answer, try tomorrow.
        if (r && r.error === 'limit_day') return answer(false, 'Sign-ups are full for today. Please try again tomorrow.', 429);
        if (res.status === 429 || (r && r.error === 'too_many')) return answer(false, 'Too many attempts. Try again in an hour.', 429);
        if (r && (r.error === 'turnstile_failed' || r.error === 'turnstile_required')) return answer(false, 'The security check failed. Reload the page and try again.', 403);
      } catch {
        r = { ok: false };
      }
      if (!r || !r.ok) return answer(false, 'Sign-up is not working right now. Please try again later.', 503);
      // Same answer whether or not the address was already on the list, so the form does not reveal who signed up.
      return answer(true, thanks, 200);
    }

    // No Hub link: newer sites keep their own newsletter table (as before), with Turnstile.
    const allowed = await rateLimit(env.DB, { route: 'newsletter', client: ip, limit: 5, windowSeconds: 3600 });
    if (!allowed) return answer(false, 'Too many attempts. Try again in an hour.', 429);
    const human = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!human) return answer(false, 'The security check failed. Reload the page and try again.', 403);
    await db.addNewsletter(env.DB, {
      email,
      consentText: `Newsletter from ${site.name}. Unsubscribe any time.`,
      sourcePath: page
    });
    return answer(true, 'Thanks. You are signed up.', 200);
  }

  // "Remind me on 27 Nov" (lessons L182): one product, sent to the Hub's list through the service binding, like "Get deal
  // updates" (the same Turnstile widget, the IP only as a one-way key). The product must be one this visitor may see,
  // and the name and our own /product/ address go with it (never /out/ or /go/). Works as a form post or as JSON.
  async function remind(request, env, url, pageSite, view, at) {
    const ctype = (request.headers.get('content-type') || '').toLowerCase();
    const isForm = ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data');
    const answer = (ok, message, status) => (isForm
      ? htmlResponse(dealUpdatesPage(pageSite, ok, message, { path: REMIND_PATH, title: 'Remind me on 27 Nov', done: ok ? 'You will get a reminder' : 'No reminder yet' }), { status, cache: 'none' })
      : jsonResponse(ok ? { ok: true, message } : { ok: false, error: message }, { status }));
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return answer(false, 'This form only works on this website.', 403);
    if (!isForm && !ctype.includes('application/json')) return answer(false, 'Send the form as JSON.', 415);
    if (Number(request.headers.get('content-length') || 0) > 4096) return answer(false, 'The form is too large.', 413);
    let data;
    try {
      if (isForm) {
        const f = await request.formData();
        data = { email: f.get('email'), consent: f.get('consent') === 'yes' || f.get('consent') === 'on', product: f.get('product'), page: f.get('page'), website: f.get('website'), turnstile_token: f.get('cf-turnstile-response') };
      } else {
        data = await request.json();
      }
    } catch { return answer(false, 'The form data could not be read.', 400); }
    if (!data || typeof data !== 'object') return answer(false, 'The form data could not be read.', 400);
    if (!(at <= REMIND_UNTIL)) return answer(false, 'Reminders for 27 Nov are closed.', 410);
    const thanks = 'Thanks. We will email you once, on 27 Nov, with a link to this product.';
    if (String(data.website || '').trim()) return answer(true, thanks, 200);
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(email)) return answer(false, 'Enter a valid email address.', 400);
    if (data.consent !== true) return answer(false, 'Tick the box to get the reminder email.', 400);
    const id = /^\d{1,12}$/.test(String(data.product || '').trim()) ? Number(String(data.product).trim()) : 0;
    const product = id > 0 ? await db.getProduct(env.DB, id) : null;
    if (!product) return answer(false, 'This product is no longer listed.', 404);
    // Only a product this visitor may see (its retailer delivers to their country, a recent price; lessons L107).
    if (hiddenReason(view, product)) return answer(false, 'We cannot set a reminder for this product in your country.', 400);
    // bol.com's terms allow no alerts or reminders of any kind (lessons L204): its page never shows the box either.
    if (noAlerts(product)) return answer(false, 'Reminders are not available for this product.', 400);
    const token = String(data.turnstile_token || '').trim();
    if (!token) return answer(false, 'This sign-up box needs JavaScript for its security check. Turn on JavaScript and try again.', 403);
    if (token.length > 2048) return answer(false, 'The security check failed. Reload the page and try again.', 403);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    let r;
    try {
      const res = await hubBinding(env).fetch(REMIND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, consent: true, site: site.code.toLowerCase(), client: await clientKey(ip), turnstile_token: token,
          product: { id: Number(product.id), name: String(product.product_name || '').slice(0, 200), url: `https://${site.domain}${productPath(product)}` }
        })
      });
      r = await res.json().catch(() => ({ ok: false }));
      if (r && r.error === 'closed') return answer(false, 'Reminders for 27 Nov are closed.', 410);
      if (r && r.error === 'limit_day') return answer(false, 'Sign-ups are full for today. Please try again tomorrow.', 429);
      if (res.status === 429 || (r && r.error === 'too_many')) return answer(false, 'Too many attempts. Try again in an hour.', 429);
      if (r && (r.error === 'turnstile_failed' || r.error === 'turnstile_required')) return answer(false, 'The security check failed. Reload the page and try again.', 403);
    } catch {
      r = { ok: false };
    }
    if (!r || !r.ok) return answer(false, 'Sign-up is not working right now. Please try again later.', 503);
    return answer(true, thanks, 200);
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
    if (!env.ADMIN_TOKEN || !(await safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`))) {
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
      // Counts, filters and the census kept for a while in this data centre's cache (lessons L159); never in the tests.
      db.useMemo(memoAllowed(env) ? edgeMemo(site.domain, caches.default) : null);
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
        // The error page lists the codes of the visitor's view too (lessons L114).
        let pageSite = site;
        try { pageSite = promoViewSite(site, viewFor(site, requestCountry(request, new URL(request.url)))); } catch { pageSite = site; }
        // A busy database (an import running on it, or overloaded: lessons L159) passes in seconds or minutes: 503 with
        // Retry-After, which tells browsers and crawlers to come back, instead of 500.
        const busy = isDbBusy(err);
        response = htmlResponse(errorPage(pageSite), { status: busy ? 503 : 500, cache: 'none' });
        if (busy) response.headers.set('Retry-After', '60');
      }
      // A visitor gets the site in the language of their country unless they chose one (lessons L162 Poland, L175 every
      // country with a language of the sites): the page names it, after the page cache. Google's crawlers count as the UK
      // (English, as before).
      if (request.method === 'GET') response = await withCountryLanguage(response, readsEnglish(request) ? '' : countryLanguage(site, requestCountry(request, new URL(request.url)), request.headers.get('accept-language')));
      // The Gear World app on Google Play (owner, 22 Nov 2026, lessons L218): the badge under the hero buttons of the home
      // page, for a visitor from a country of the app and not on an iPhone or iPad. Added after the page cache, like the
      // country bar, so no cached copy carries it. Google's crawlers count as the UK, so they see it too.
      if (request.method === 'GET' && response.status === 200 && new URL(request.url).pathname === '/' &&
        appBarWanted(requestCountry(request, new URL(request.url)), request.headers.get('user-agent'))) response = await withAppBar(response, appBarHtml(site));
      // The bar for a visitor outside the UK who gets the UK view or the all view (lessons L107, owner's option A; L151):
      // added to the answer after the page cache, never into a cached copy, so it costs no D1 read and no extra cache copy.
      const browsing = browseCountry(request);
      if (request.method === 'GET' && browsing && !new URL(request.url).searchParams.get('deliver_to')) {
        // Browsing as one country (L160): its own bar instead of the UK bar, and the answer is this visitor's only.
        response = await withUkBar(response, browseBarHtml(browsing, new URL(request.url).pathname));
        response = withBrowseHeaders(response);
      } else {
        if (request.method === 'GET' && needsUkBar(site, requestCountry(request, new URL(request.url)))) response = await withUkBar(response);
        // A page kept by the browser must not come back after the visitor starts or stops browsing as a country (L160).
        if (request.method === 'GET') response = withVaryCookie(response);
      }
      if (!preview) return response;
      const h = new Headers(response.headers);
      h.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
    },
    scheduled
  };
}

// Puts the bar right above the page header of an HTML answer. In the Worker: HTMLRewriter, streaming, the body is never
// read whole. Elsewhere (the Node tests): the same insertion on the text. The copy with the bar is private (a shared
// cache must not give it to someone else); the cached copy stays without it.
const MASTHEAD = '<header class="masthead">';
export async function withUkBar(response, barHtml = null) {
  if (!response || !response.body || !/^text\/html/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  // As with the country language (L175): an answer that must not be kept (no-store, no-cache) stays so.
  if (!/no-store|no-cache/i.test(headers.get('Cache-Control') || '')) headers.set('Cache-Control', 'private, max-age=60');
  headers.delete('Content-Length');
  const bar = barHtml || ukBarHtml();
  if (typeof HTMLRewriter === 'function') {
    const out = new HTMLRewriter().on('header.masthead', { element(e) { e.before(bar, { html: true }); } }).transform(response);
    return new Response(out.body, { status: response.status, statusText: response.statusText, headers });
  }
  const text = await response.text();
  const i = text.indexOf(MASTHEAD);
  return new Response(i < 0 ? text : text.slice(0, i) + bar + text.slice(i), { status: response.status, statusText: response.statusText, headers });
}

// The app row of the home page (lessons L218): right after the hero buttons (<p class="hero-actions">), so on a phone the
// search box and "Browse by category" stay where they were (L30). In the Worker: HTMLRewriter, streaming. Elsewhere (the
// Node tests): the same insertion on the text. Like the country bar, the copy with the row is private.
const HERO_ACTIONS = '<p class="hero-actions">';
export async function withAppBar(response, barHtml) {
  if (!response || !response.body || !barHtml || !/^text\/html/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  if (!/no-store|no-cache/i.test(headers.get('Cache-Control') || '')) headers.set('Cache-Control', 'private, max-age=60');
  headers.delete('Content-Length');
  if (typeof HTMLRewriter === 'function') {
    const out = new HTMLRewriter().on('p.hero-actions', { element(e) { e.after(barHtml, { html: true }); } }).transform(response);
    return new Response(out.body, { status: response.status, statusText: response.statusText, headers });
  }
  const text = await response.text();
  const i = text.indexOf(HERO_ACTIONS);
  const end = i < 0 ? -1 : text.indexOf('</p>', i);
  return new Response(end < 0 ? text : text.slice(0, end + 4) + barHtml + text.slice(end + 4), { status: response.status, statusText: response.statusText, headers });
}

// Lessons L162 (Manager, 15 Nov 2026: Poland is open and the first country outside the UK to be promoted) and L175
// (owner, 17 Nov 2026, after Linkwise saw the Greek pages open in English: "every country opens in its own language"):
// a country whose language the site has gets it without a choice of their own. The visitor's own choice (menu or
// ?lang=) always comes first, and Google reads English as before. A country with several languages of the sites takes
// the first of the browser's languages that is one of them; English first, or none of them, keeps English.
// The lists are in src/lib/country-language.js, shared with the Group's country pages (L184).
export { COUNTRY_LANGUAGES, MULTI_LANGUAGE_COUNTRIES };
// Crawlers read English, Google's (they count as the UK) and every other one; the network's own checks (QA_BOT, L158)
// can still ask a country.
export const OTHER_CRAWLER = /(?<!cu)bot\b|bot\/|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly/i; // not Cubot phones
export function readsEnglish(request) {
  const ua = request.headers.get('user-agent') || '';
  return !QA_BOT.test(ua) && OTHER_CRAWLER.test(ua);
}
// The browser's languages by preference (q weights; q=0 means "not this one"), as base codes: "fr-BE,fr;q=0.9" -> fr.
export function browserLanguages(header) {
  return String(header || '').split(',').map((part, i) => {
    const [tag, ...params] = part.split(';').map(x => x.trim());
    const qp = params.find(p => /^q=/i.test(p));
    const q = qp ? Number(qp.slice(2)) : 1;
    return { base: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0, i };
  }).filter(l => l.base && l.base !== '*' && l.q > 0).sort((a, b) => b.q - a.q || a.i - b.i).map(l => l.base);
}
export function countryLanguage(site, country, acceptLanguage = '') {
  const cc = String(country || '').toUpperCase();
  const has = code => (site.languages || []).some(l => l.code === code);
  const several = MULTI_LANGUAGE_COUNTRIES[cc];
  if (several) {
    for (const base of browserLanguages(acceptLanguage)) {
      if (base === 'en') return '';
      const code = several.find(c => c.split('-')[0] === base);
      if (code) return has(code) ? code : '';
    }
    return '';
  }
  const code = COUNTRY_LANGUAGES[cc] || '';
  return code && has(code) ? code : '';
}
// <html data-country-lang="el-GR">: the site script reads it only when the visitor has no language of their own (menu or
// ?lang=). Added to the answer, never to the cached copy (one copy per view group for every visitor), so that answer is
// private, like the one with the UK bar. In the Worker: HTMLRewriter; in the Node tests: the same on the text.
export async function withCountryLanguage(response, code) {
  if (!code || !response || !response.body || !/^text\/html/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  // An answer that must not be kept (no-store, no-cache: error pages, form answers) stays so; any other becomes private.
  if (!/no-store|no-cache/i.test(headers.get('Cache-Control') || '')) headers.set('Cache-Control', 'private, max-age=60');
  headers.delete('Content-Length');
  if (typeof HTMLRewriter === 'function') {
    const out = new HTMLRewriter().on('html', { element(e) { e.setAttribute('data-country-lang', code); } }).transform(response);
    return new Response(out.body, { status: response.status, statusText: response.statusText, headers });
  }
  const text = await response.text();
  return new Response(text.replace(/<html\b/i, `<html data-country-lang="${code}"`), { status: response.status, statusText: response.statusText, headers });
}

// Lessons L160: an answer while browsing as one country is that visitor's only (never kept by a shared cache, and the
// browser asks again), and every page says that it depends on the cookie, so a browser does not reuse a copy from before.
function withBrowseHeaders(response) {
  if (!response || response.status !== 200 || !/^(text\/html|application\/json)/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-cache');
  headers.append('Vary', 'Cookie');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function withVaryCookie(response) {
  if (!response || response.status !== 200 || !/^(text\/html|application\/json)/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Cookie');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Where a /out/<id> click goes. An Awin link gets our clickref. A plain retailer address earns no commission,
// so for a retailer we have an Awin programme with it becomes an Awin deep link (lessons L29):
//   https://www.awin1.com/cread.php?awinmid=<advertiser>&awinaffid=<publisher>&clickref=<ref>&ued=<address>
// awin = { publisherId, advertisers: { 'Retailer name': advertiserId } } from the site config.
// extra = { clickref2, clickref3 }: the campaign of the visit (lessons L93), only on an Awin link, never over a value
// the link already has. A plain retailer address gets nothing added.
export function affiliateTarget(address, retailer, awin, clickRef, extra = {}) {
  const addExtra = t => {
    for (const k of ['clickref2', 'clickref3']) if (extra && extra[k] && !t.searchParams.has(k)) t.searchParams.set(k, extra[k]);
    return t;
  };
  let target;
  try { target = new URL(String(address || '')); } catch { return null; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
  if (/(^|\.)awin1\.com$/i.test(target.hostname)) {
    if (!target.searchParams.has('clickref')) target.searchParams.set('clickref', clickRef);
    return addExtra(target);
  }
  const mid = awin && awin.advertisers ? Number(awin.advertisers[String(retailer || '')]) : 0;
  const aff = awin ? Number(awin.publisherId) : 0;
  if (!(mid > 0) || !(aff > 0)) return target;
  const deep = new URL('https://www.awin1.com/cread.php');
  deep.searchParams.set('awinmid', String(mid));
  deep.searchParams.set('awinaffid', String(aff));
  deep.searchParams.set('clickref', clickRef);
  addExtra(deep);
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
