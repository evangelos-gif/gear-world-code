// Exchange rates for showing "≈ €…" next to a price (lessons L25). Retailers charge in the site currency,
// so a converted price is only a guide. The Worker asks Frankfurter (free, no key, European Central Bank and
// other central bank rates) at most once every 6 hours and shares the answer with every visitor, so browsers
// never call a third party and the Content-Security-Policy stays 'self'.
// If the rates cannot be fetched, the answer is { ok: false } and the pages show the site currency only.

const SOURCE = 'https://api.frankfurter.dev/v2/rates';
const TTL_SECONDS = 6 * 60 * 60;
let memory = null; // { at, data } for this Worker instance

export function parseRates(base, quotes, rows) {
  const rates = {};
  let date = '';
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const q = String((r && r.quote) || '').toUpperCase();
      const rate = Number(r && r.rate);
      if (quotes.includes(q) && String(r.base || '').toUpperCase() === base && Number.isFinite(rate) && rate > 0 && rate < 1e6) {
        rates[q] = rate;
        if (r.date && String(r.date) > date) date = String(r.date).slice(0, 10);
      }
    }
  }
  return { rates, date };
}

// The visitor's display currencies, and site.foreignCurrencies: currencies some retailers sell in (CGW: GRABO in US dollars),
// so their prices get "≈ £…" too (lessons L63).
export function rateQuotes(site) {
  const base = String(site.currency || 'GBP').toUpperCase();
  const all = [...(site.displayCurrencies || []), ...(site.foreignCurrencies || [])].map(c => String(c).toUpperCase());
  return [...new Set(all)].filter(c => c !== base && /^[A-Z]{3}$/.test(c));
}

export async function exchangeRates(site, ctx, fetcher = fetch) {
  const base = String(site.currency || 'GBP').toUpperCase();
  const quotes = rateQuotes(site);
  if (!quotes.length) return { ok: true, base, date: '', rates: {} };
  const now = Date.now();
  if (memory && now - memory.at < TTL_SECONDS * 1000) return memory.data;

  const url = `${SOURCE}?base=${encodeURIComponent(base)}&quotes=${quotes.map(encodeURIComponent).join(',')}`;
  const cacheKey = new Request(url);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  try {
    if (cache) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const data = await hit.json();
        memory = { at: now, data };
        return data;
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let res;
    try {
      res = await fetcher(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`rates HTTP ${res.status}`);
    const { rates, date } = parseRates(base, quotes, await res.json());
    const data = { ok: Object.keys(rates).length > 0, base, date, rates, source: 'Frankfurter' };
    if (data.ok) {
      memory = { at: now, data };
      if (cache) {
        const put = cache.put(cacheKey, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL_SECONDS}` }
        }));
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
      }
    }
    return data;
  } catch (err) {
    console.warn('exchange rates unavailable', err && err.message ? err.message : err);
    return { ok: false, base, date: '', rates: {} };
  }
}

export function _resetForTests() {
  memory = null;
}
