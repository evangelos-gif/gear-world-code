// Response helpers. Every response from the engine passes through secureHeaders() (lessons L05, L06).

// The same value is in sites/*/public/_headers (static files under /assets/).
export const HSTS = 'max-age=31536000; includeSubDomains';

const CSP = [
  "default-src 'self'",
  // Google Ads (lessons L93): these addresses are only reached after the visitor allows cookies in the banner.
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
  "style-src 'self'",
  "img-src 'self' data: https:",
  // The seasonal banner videos come from the Hub (one copy for all 11 sites, src/lib/seasons.js).
  "media-src 'self' https://gearworldhub.com",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com https://www.googletagmanager.com https://www.google.com https://google.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
  'frame-src https://challenges.cloudflare.com https://td.doubleclick.net https://www.googletagmanager.com',
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  'report-uri /api/csp-report'
].join('; ');

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Microphone only for this site's own pages (voice search). Camera stays off until camera search exists.
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // HSTS (lessons L06 / T23): one day while the sites were new; one year with the subdomains since the security
  // fixes of 8/11/2026 (F08, lessons L106). No "preload" yet: that list is hard to leave, so it is a later decision.
  'Strict-Transport-Security': HSTS,
  'Content-Security-Policy': CSP
};

export function secureHeaders(headers) {
  const h = new Headers(headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!h.has(k)) h.set(k, v);
  return h;
}

export function htmlResponse(body, { status = 200, cache = 'page', headers = {}, method = 'GET' } = {}) {
  const h = secureHeaders(headers);
  h.set('Content-Type', 'text/html; charset=utf-8');
  h.set('Cache-Control', cacheControl(cache));
  return new Response(method === 'HEAD' ? null : body, { status, headers: h });
}

export function jsonResponse(data, { status = 200, cache = 'none', headers = {} } = {}) {
  const h = secureHeaders(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', cacheControl(cache));
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function textResponse(body, { status = 200, type = 'text/plain', cache = 'hour', method = 'GET' } = {}) {
  const h = secureHeaders({});
  h.set('Content-Type', `${type}; charset=utf-8`);
  h.set('Cache-Control', cacheControl(cache));
  return new Response(method === 'HEAD' ? null : body, { status, headers: h });
}

export function redirect(location, status = 301, extra = {}) {
  const h = secureHeaders(extra);
  h.set('Location', location);
  h.set('Cache-Control', status === 301 ? 'public, max-age=3600' : 'no-store');
  return new Response(null, { status, headers: h });
}

function cacheControl(kind) {
  switch (kind) {
    case 'page': return 'public, max-age=60, s-maxage=300';
    case 'hour': return 'public, max-age=3600';
    case 'short': return 'public, max-age=60';
    // A page that depends on who asks (the group page's "your country" box): never kept by a shared cache.
    case 'private': return 'private, max-age=60';
    default: return 'no-store';
  }
}

// Edge cache for anonymous GET pages: lowers D1 reads and speeds up pages. keyUrl: the address the copy is kept under
// (the page address plus the visitor's country group, lessons L107); the page address alone without one.
export async function withEdgeCache(request, ctx, produce, env, keyUrl = request.url) {
  if (request.method !== 'GET' || typeof caches === 'undefined') return produce();
  if (env && env.EDGE_CACHE === 'off') return produce();
  const cache = caches.default;
  const key = new Request(keyUrl, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await produce();
  if (response.status === 200 && ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(key, response.clone()));
  }
  return response;
}

// A longer edge cache for one public answer that changes slowly (L106: /api/stats, about 1 hour). The key is the path
// alone, so a query string (?x=1) never skips the cache and never fills it with copies. The visitor gets exactly the
// answer and the headers of a fresh one: the longer life is only on the copy kept in this data centre's cache.
const KEEP_HEADER = 'X-GW-Client-Cache-Control';
export async function withPathCache(request, ctx, keyUrl, seconds, produce, env) {
  if (request.method !== 'GET' || (env && env.EDGE_CACHE === 'off')) return produce();
  let cache = null;
  try { cache = typeof caches !== 'undefined' && caches.default ? caches.default : null; } catch { cache = null; }
  if (!cache) return produce();
  const key = new Request(keyUrl, { method: 'GET' });
  try {
    const hit = await cache.match(key);
    if (hit) {
      const h = new Headers(hit.headers);
      const original = h.get(KEEP_HEADER);
      h.delete(KEEP_HEADER);
      if (original) h.set('Cache-Control', original); else h.delete('Cache-Control');
      return new Response(hit.body, { status: hit.status, headers: h });
    }
  } catch { /* the cache is only a help */ }
  const response = await produce();
  if (response.status !== 200) return response;
  const copy = new Response(response.clone().body, response);
  copy.headers.set(KEEP_HEADER, response.headers.get('Cache-Control') || '');
  copy.headers.set('Cache-Control', `public, max-age=${seconds}`);
  const put = cache.put(key, copy).catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
  return response;
}
