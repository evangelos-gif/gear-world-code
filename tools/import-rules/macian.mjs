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

// Several colours of one shoe have the same feed name ("Ludo Penny Loafer" twice, dry run 8 Nov 2026): the card name takes
// the colour from the product address ("/products/ludo-penny-loafer-black-calf" -> "Ludo Penny Loafer - Black Calf").
const slug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function cardName(name, url = '') {
  const n = String(name || '').trim();
  let handle = '';
  try { handle = (new URL(url).pathname.match(/\/products\/([a-z0-9-]+)/i) || [])[1] || ''; } catch { handle = ''; }
  handle = handle.toLowerCase();
  const base = slug(n);
  if (!handle || !base || !handle.startsWith(base + '-')) return n;
  const extra = handle.slice(base.length + 1).split('-').filter(w => w && !/^\d+$/.test(w));
  if (!extra.length || extra.length > 4) return n;
  return `${n} - ${extra.map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}`;
}

export function classify({ name, feedCategory = '', url = '' }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|shoe care|polish|shoe trees?|laces/i.test(n)) return { reject: 'gift card or shoe care, not shoes' };
  if (feedCategory && !/footwear|shoes?/i.test(feedCategory)) return { reject: 'not footwear' };
  // Owner (8 Nov 2026): women's heels were missing on WGW, so heels get their own subcategory.
  const sub = /\b(boots?|booties|chelsea)\b/i.test(n) ? 'Boots'
    : /\b(sandals?|mules?|slides?)\b/i.test(n) ? 'Sandals'
      : /\b(heels?|heeled|courts?|stilettos?|pumps?|kitten)\b/i.test(n) ? 'Heels'
        : 'Shoes';
  return { site: 'wgw', siteCategory: 'Shoes', subcategory: sub, name: cardName(n, url) };
}
