// Import rules for Macian (Awin advertiser 113756) on Women's Gear World "Shoes" (owner, 8 Nov 2026: "check email and
// download new feeds and import with one go"; WGW had almost no smart women's shoes). New on every site. Feed facts
// (feed-profile 8 Nov 2026): two feeds with the same 166 rows, one in US dollars (112141) and one in pounds (112237),
// category "Women's Footwear", brand Macian, shop maciancollection.com, handmade in England, GBP 495 to 550. One row per
// size, so one card per product page. Only the pound feed is used: the dollar rows get their own key and are left out
// by the currency check (the planner keeps the first file's currency for a product, and the dollar feed sorts first).
export const RULES = {
  key: 'macian',
  advertiserId: 113756,
  retailer: 'Macian',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?maciancollection\.com\//i,
  sites: ['wgw'],
  maxPrice: 1500,
  keepQuery: true
};

export function productKey(get) {
  let path = '';
  try { path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, ''); } catch { path = ''; }
  if (!/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) path = String(get('merchant_product_id') || '').trim();
  const cur = String(get('currency') || '').trim().toUpperCase();
  return cur && cur !== 'GBP' ? `${cur.toLowerCase()}-${path}` : path;
}

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|shoe care|polish|shoe trees?|laces/i.test(n)) return { reject: 'gift card or shoe care, not shoes' };
  if (feedCategory && !/footwear|shoes?/i.test(feedCategory)) return { reject: 'not footwear' };
  // Owner (8 Nov 2026): women's heels were missing on WGW, so heels get their own subcategory.
  const sub = /\b(boots?|booties|chelsea)\b/i.test(n) ? 'Boots'
    : /\b(sandals?|mules?|slides?)\b/i.test(n) ? 'Sandals'
      : /\b(heels?|heeled|courts?|stilettos?|pumps?|kitten)\b/i.test(n) ? 'Heels'
        : 'Shoes';
  return { site: 'wgw', siteCategory: 'Shoes', subcategory: sub };
}
