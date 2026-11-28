// Import rules for Cashmere Boutique US (CJ Affiliate advertiser 1989180) — Priority A of «Λείπουν 25-11» (row 204), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 1,018 rows of cashmere: sweaters and cardigans, scarves and pashminas, coats, robes, throws. Names end with the colour and size in brackets: the card stops before them. The men's pages (/shop/men/) and the home throws stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-cashmereboutique-us', network: 'cj', advertiserId: 1989180, retailer: 'Cashmere Boutique US', currency: 'USD',
  shop: shopOf('cashmereboutique.com'), sites: ['wgw'], minPrice: 20, maxPrice: 800 });

// "Women's Falbala Pure Cashmere Sweater (Charcoal, Small)" -> "Women's Falbala Pure Cashmere Sweater".
export const displayName = name => noSale(String(name || '').replace(/\s*\([^)]*\)\s*$/, ''));

export function classify({ name, feedCategory = '', url = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/\/shop\/(?:men|kids|baby|home)\//i.test(url) || /\bmen'?s\b|for men\b/i.test(n.replace(/women/gi, ''))) return { reject: "men's, children's or home" };
  if (/throws?|blankets?|eye mask/i.test(n)) return { reject: 'home product (not WGW)' };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's fashion the site lists" };
  return { site: 'wgw', ...p, name: n };
}
