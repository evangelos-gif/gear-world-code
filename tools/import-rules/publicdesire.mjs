// Import rules for Public Desire (Awin advertiser 6343, feed 66917) on Women's Gear World. The owner asked on 7 Nov 2026
// for women's heels (WGW had almost none; Public Desire was one of the shops he applied to for that) and it was approved
// on 9 Nov 2026. Feed facts (checked 9 Nov 2026 on the downloaded feed): 2,265 rows = one row per size of 574 product
// pages (one page per colour), GBP 1 to 65, Shopify shop publicdesire.com, brands "Public Desire UK" / "Public Desire".
// Shop sections: Dresses 113, Tops & Bralets 111, High heels 78, Skirts 52, Accessories 48 (jewellery), Mid heels 38,
// Trousers 32, Knee high boots 30, Shorts 15, Swimwear 13, Flat sandals 7, Bags 7, Jumpsuits & Playsuits 7, Ankle Boots 6,
// Outerwear & Jackets 5, Joggers & Leggings 5, Sweatshirts & Hoodies 4, Slippers 2, Over the knee boots 1.
// The sections follow the owner's choice for Luxefashion (8 Nov 2026, "Επιλεγμένα"): shoes, bags & accessories, dresses,
// jackets & coats, skirts (and jewellery to Women's Jewellery like Natkina); tops, trousers, shorts, swimwear, jumpsuits,
// joggers and hoodies stay out.
export const RULES = {
  key: 'publicdesire',
  advertiserId: 6343,
  retailer: 'Public Desire',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?publicdesire\.com\//i,
  sites: ['wgw'],
  maxPrice: 500,
  minPrice: 3,
  keepQuery: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim().replace(/\s+\S+$/, '');
}

export function displayBrand() {
  return 'Public Desire';
}

const OUT = /^(tops & bralets|trousers|swimwear|shorts|jumpsuits & playsuits|joggers & leggings|sweatshirts & hoodies)$/i;

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const c = String(feedCategory || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|e-?gift/i.test(n)) return { reject: 'gift card' };
  if (OUT.test(c)) return { reject: 'section not chosen for WGW (tops, trousers, shorts, swimwear, jumpsuits, joggers, hoodies)' };
  if (/boots?/i.test(c) || (/heels/i.test(c) && /\bboots?\b/i.test(n))) return { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Boots' };
  if (/heels/i.test(c)) return { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Heels' };
  if (/sandals/i.test(c)) return { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Sandals' };
  if (/slippers/i.test(c)) return { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Slippers' };
  if (/^bags$/i.test(c)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
  if (/outerwear|jackets/i.test(c)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Jackets & Coats' };
  if (/^dresses$/i.test(c)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Dresses' };
  if (/^skirts$/i.test(c)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Skirts' };
  if (/^accessories$/i.test(c)) {
    // The shop's "Accessories" are jewellery (rings, earrings, necklaces, bracelets, body chains): like Natkina.
    const sub = /\brings?\b/i.test(n) ? 'Rings'
      : /\bearrings?\b/i.test(n) ? 'Earrings'
        : /\b(necklaces?|chokers?|pendants?)\b/i.test(n) ? 'Necklaces'
          : /\b(bracelets?|bangles?|cuffs?|anklets?)\b/i.test(n) ? 'Bracelets'
            : /\b(body chains?|charms?|brooch(?:es)?)\b/i.test(n) ? 'Jewellery' : '';
    if (sub) return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub };
    return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' };
  }
  return { reject: `shop section "${c || 'none'}" not used on WGW` };
}
