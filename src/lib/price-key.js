// The key of a store's product page for the prices of Mega Stores (lessons L227), the same in the Worker
// (src/marketplace-guides.js) and on the PC (tools/ogw-prices.mjs): FNV-1a (8 hex digits) of the page's address
// without "https://", "www.", the #part, a last "/" and tracking parameters (utm_*, gclid, fbclid), the other
// parameters in alphabetical order. Only http and https addresses have a key.
export const PRICE_MAX_AGE_MS = 24 * 3600 * 1000;
const TRACKING = /^(utm_.*|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga)$/i;
export function pageKey(page) {
  let u;
  try { u = new URL(String(page || '').trim()); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const params = [...u.searchParams].filter(([k]) => !TRACKING.test(k)).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '';
  const query = params.length ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';
  return `${u.hostname.toLowerCase().replace(/^www\./, '')}${path}${query}`;
}
export function priceKey(page) {
  const s = pageKey(page);
  if (!s) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
