// Import rules for Giuseppe Zanotti US (Rakuten Advertising MID 41342) — Priority A of «Λείπουν 25-11» (row 210), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 3,830 rows, 440 pages of designer shoes (sandals, pumps, mules, boots, sneakers) and a few accessories. The feed does not say who a shoe is for: a shoe is listed only when it is a women's by its heel height in the name ("Sandal 105") or its description (heel, stiletto, wedge, platform); the other sneakers and slides stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, wgwFashion, shoeSub } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-zanotti-us', network: 'rakuten', advertiserId: 41342, retailer: 'Giuseppe Zanotti US', currency: 'USD',
  shop: shopOf('giuseppezanotti.com'), sites: ['wgw'], minPrice: 100, maxPrice: 3000 });

export const displayName = name => noSale(name);
// The description says what the shoe is ("... and stiletto heel").
export const rowInfo = get => ({ about: String(get('description') || '').slice(0, 400) });

export function classify({ name, feedCategory = '', info = null }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  const about = (info && info.about) || '';
  if (/\bmen'?s\b|for men\b/i.test(`${n} ${about}`.replace(/women/gi, ''))) return { reject: "men's" };
  const womens = /\b\d{2,3}\b/.test(n) || /heel|stiletto|wedge|platform|women/i.test(about);
  if (/shoes/i.test(feedCategory) || /sandal|pump|mule|boot|sneaker|slide|loafer|ballerina/i.test(n)) {
    if (!womens) return { reject: "not known to be a women's shoe (no heel in the name or description)" };
    return { site: 'wgw', siteCategory: 'Shoes', subcategory: shoeSub(n, 'wgw'), name: n };
  }
  const p = wgwFashion(n, feedCategory);
  if (!p || !womens) return { reject: "not known to be women's" };
  return { site: 'wgw', ...p, name: n };
}
