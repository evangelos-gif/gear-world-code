// Response helpers. Every response from the engine passes through secureHeaders() (lessons L05, L06).

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  'frame-src https://challenges.cloudflare.com',
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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // Short HSTS first (lessons L06 / T23). Raise to one year after three clean weeks.
  'Strict-Transport-Security': 'max-age=86400',
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
    default: return 'no-store';
  }
}

// Edge cache for anonymous GET pages: lowers D1 reads and speeds up pages.
export async function withEdgeCache(request, ctx, produce, env) {
  if (request.method !== 'GET' || typeof caches === 'undefined') return produce();
  if (env && env.EDGE_CACHE === 'off') return produce();
  const cache = caches.default;
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await produce();
  if (response.status === 200 && ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(key, response.clone()));
  }
  return response;
}
