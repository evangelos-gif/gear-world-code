// Import rules for CAT Footwear UK (Awin advertiser 125736, catfootwear.co.uk) on Men's and Women's Gear World (12 Nov
// 2026, lessons L117). New on every site. Feed 114759 (12 Nov 2026): 629 rows = one row per size, 84 product pages, all in
// stock, prices in pounds (from £12.50 to £110), shop categories Boots 494, Shoes 112, Sandals 14, Backpacks 9; names such
// as "Colorado 2.0 P726503 Icon Mens Black Boots - 8" and "Rewrite Harness  P312299 Womens Leather Nuthatch Boots - 8".
//  - One card per product page (all sizes), at the lowest size price; the card name is what all sizes share, without the
//    style number ("P726503") and without "Mens"/"Womens"/"Unisex" (the site says it already).
//  - Women's ("Womens" in the name) go to WGW, every other shoe (men's and unisex) to MGW: Shoes > Boots, Trainers,
//    Sandals or Shoes. The CAT backpack goes to MGW Bags & Accessories > Bags.
//  - These are CAT's casual and outdoor boots, not safety boots (no toe cap or S1/S3 rating in the feed), so not CGW.
export const RULES = {
  key: 'catfootwear',
  advertiserId: 125736,
  retailer: 'CAT Footwear',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?catfootwear\.co\.uk\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 400,
  minPrice: 10,
  commonVariantName: true
};

export function displayBrand() { return 'CAT'; }

export function displayName(name) {
  let s = String(name || '')
    .replace(/\s*-\s*[^-]*\/\s*[\d.]+\s*$/, '')          // "- Yam / 11" when one size only
    .replace(/\s+-\s+(?:UK\s*)?\d{1,2}(?:\.5)?\s*$/i, '') // "- 8" when one size only
    .replace(/\s*-\s*UK EXCLUSIVE\b/i, '')
    .replace(/\bP\d{5,6}\b/g, ' ')                         // style number
    .replace(/\b(?:Mens|Men's|Womens|Women's|Unisex)\b/gi, ' ')
    .replace(/\bWaterProof\b/g, 'Waterproof')
    .replace(/\bSuedeP/g, 'Suede ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // "Colorado 2.0 Dark Beige Boots - Dark Beige": the colour once is enough.
  const m = /^(.*\S)\s+-\s+([^-]+)$/.exec(s);
  if (m && m[1].toLowerCase().includes(m[2].trim().toLowerCase())) s = m[1];
  // "CAT BLACK PLOWING BACKPACK" -> "CAT Black Plowing Backpack"
  if (s === s.toUpperCase() && /[A-Z]{4}/.test(s)) s = s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bCat\b/g, 'CAT');
  return s;
}

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher/i.test(n)) return { reject: 'gift card' };
  if (/backpack|crossbody|\bbag\b|holdall|wallet/i.test(n) || /backpack/i.test(feedCategory)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
  if (/\b(socks?|laces?|insoles?|cleaner|protector)\b/i.test(n)) return { reject: 'not a shoe' };
  const site = /\bwomen'?s\b|\bwomens\b|\bladies\b/i.test(n) ? 'wgw' : 'mgw';
  const sub = /\b(sandals?|slides?|flip.?flops?|mules?|clogs?)\b/i.test(n) || /sandal/i.test(feedCategory) ? 'Sandals'
    : /\btrainers?\b|\bsneakers?\b/i.test(n) ? 'Trainers'
      : /\bboots?\b/i.test(n) || /^boots$/i.test(feedCategory) ? 'Boots' : 'Shoes';
  return { site, siteCategory: 'Shoes', subcategory: sub };
}
