// Import rules for Baker Ross IE (Awin advertiser 6154) — Priority A of «Λείπουν 25-11» (row 91), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 21 Nov 2026: 3,772 rows (euros), craft kits for children, art supplies, stickers, seasonal crafts, pocket money toys. Names end with the pack size and the shop's own tail ("(Pack of 3) Wood Craft Kits For Kids"): the card stops after the pack size.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, CHARACTER } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-bakerross-ie', advertiserId: 6154, retailer: 'Baker Ross IE', currency: 'EUR',
  shop: shopOf('bakerross.ie'), sites: ['kgw'], minPrice: 3, maxPrice: 80, maxPerSubcategory: 400 });

// "Wooden Stand-up Castles (Pack of 6) Wood Craft Kits For Kids" -> "Wooden Stand-up Castles (Pack of 6)".
export const displayName = name => noSale(String(name || '').replace(/(\((?:pack|box|set|bag|tub|roll)s? of [^)]*\)).*$/i, '$1'));

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (CHARACTER.test(n)) return { reject: 'licensed character product' };
  const t = `${n} | ${feedCategory}`;
  const place = sub => ({ site: 'kgw', siteCategory: 'Toys & Games', subcategory: sub, name: n });
  if (/putty|slime|dough|clay/i.test(t)) return place('Play Dough & Putty');
  if (/jigsaw|puzzle/i.test(t)) return place('Jigsaw Puzzles');
  if (/pocket money|party bag|toys/i.test(feedCategory) && !/craft/i.test(feedCategory)) return place('Toys & Games');
  if (/stickers?|art supplies|paints?|pens?|pencils?|crayons?|chalks?|markers?|glue|scissors|paper|card ?stock|display rolls?|stationery|brushes/i.test(t) && !/kits?/i.test(n))
    return { site: 'kgw', siteCategory: 'School & Backpacks', subcategory: 'Stationery & Art Supplies', name: n };
  return { ...place('Toy Craft Kits'), ...(/craft|kit/i.test(t) ? {} : { doubt: true }) };
}
