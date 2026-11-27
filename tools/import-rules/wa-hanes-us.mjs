// Import rules for Hanes.com US (Rakuten Advertising MID 24366) — Priority A of «Λείπουν 25-11» (row 114), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 11,097 rows, 1,139 pages of Hanes basics for men, women and children (T-shirts, underwear, socks, sweats, scrubs). Only the men's products (the women's come through onehanesplace.com on WGW). One card a page; the name is what all its sizes and colours share (L117).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, audience, mgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-hanes-us', network: 'rakuten', advertiserId: 24366, retailer: 'Hanes.com US', currency: 'USD',
  shop: shopOf('hanes.com'), sites: ['mgw'], minPrice: 5, maxPrice: 150, commonVariantName: true });

export const displayName = name => noSale(name);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  const who = audience(n);
  if (who !== 'men' && !(who === '' && /\bmen\b/i.test(feedCategory))) return { reject: "not men's (women's and children's are on other lines)" };
  if (/\bbras?\b|panties|hosiery/i.test(`${n} ${feedCategory}`)) return { reject: "not men's" };
  const p = mgwFashion(n, feedCategory);
  if (!p) return { reject: "not men's clothing the site lists" };
  return { site: 'mgw', ...p, name: n };
}
