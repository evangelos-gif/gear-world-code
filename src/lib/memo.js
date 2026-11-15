// Numbers that change only when an import runs, kept for a while in this data centre's cache (lessons L159): the counts of
// a list, the filters of a category, the census of the site (src/db.js memo()). The key is the site's own address under a
// path no page has (/__gw-memo/), with a hash of the question; the answer is JSON with its own lifetime. A failure of the
// cache never fails the page: the numbers are then read from D1, as before.
export const MEMO_VERSION = 'l159-1';

async function hashOf(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Only in the Worker itself (Cloudflare's runtime) and with its page cache on: never in the Node tests or the local checks
// (EDGE_CACHE=off), so they always read the database they just changed.
export function memoAllowed(env) {
  if (env && env.EDGE_CACHE === 'off') return false;
  if (typeof caches === 'undefined' || !caches || !caches.default) return false;
  return typeof navigator !== 'undefined' && navigator && navigator.userAgent === 'Cloudflare-Workers';
}

// cache: a Cache (caches.default in the Worker; tests pass their own). domain: the site's domain.
export function edgeMemo(domain, cache) {
  return async (name, args, seconds, compute) => {
    let key = null;
    try {
      key = new Request(`https://${domain}/__gw-memo/${name}/${await hashOf(JSON.stringify(args))}?v=${MEMO_VERSION}`, { method: 'GET' });
      const hit = await cache.match(key);
      if (hit) return await hit.json();
    } catch { /* read it from D1 below */ }
    const value = await compute();
    if (key) {
      try {
        await cache.put(key, new Response(JSON.stringify(value), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${Math.max(1, Math.round(seconds))}` }
        }));
      } catch { /* not kept this time */ }
    }
    return value;
  };
}
