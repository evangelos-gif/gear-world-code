// Import rules for AMIclubwear US (CJ Affiliate advertiser 3011689) — Priority A of «Λείπουν 25-11» (row 196), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 1,930 rows of women's club fashion: dresses, jumpsuits, swimwear, shoes, bags, costumes. Costumes, lingerie, masks and body stickers stay out, and so do rows named only by a style code ("BEAU-601").
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, COSTUME, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-amiclubwear-us', network: 'cj', advertiserId: 3011689, retailer: 'AMIclubwear US', currency: 'USD',
  shop: shopOf('amiclubwear.com'), sites: ['wgw'], minPrice: 8, maxPrice: 300 });

// "6766 - 2PC Embossed Velvet Tie-Side Bikini Set" -> "2PC Embossed Velvet Tie-Side Bikini Set".
export const displayName = name => noSale(String(name || '').replace(/^\d{3,5}[A-Z]?\s*-\s*/, ''));

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (!/\s/.test(n) || /^[A-Z]+-?\d+[A-Z]?$/i.test(n)) return { reject: 'named only by a style code' };
  if (COSTUME.test(n) || /costume|lingerie/i.test(feedCategory)) return { reject: 'costume, lingerie or mask' };
  if (/stickers?|pasties|garter|body chain|boot cuffs?/i.test(n)) return { reject: 'body accessory' };
  if (/\bmen'?s\b/i.test(n)) return { reject: "men's" };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's fashion the site lists" };
  return { site: 'wgw', ...p, name: n };
}
