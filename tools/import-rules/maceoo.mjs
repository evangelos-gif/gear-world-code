// Import rules for Maceoo (CJ Affiliate advertiser 5504360, maceoo.com) on Men's Gear World. Joined 13 Nov 2026. Feed
// facts (14 Nov 2026): 5,174 rows in USD (4,707 out of stock) = sizes of about 680 pages, USD 68-598; sections "Dress
// Shirt LS", "Polo SS", "Jacket", "Athleisure", "Dress Shirt SS", "Blazer", "Swim", "Shoes", "V-neck SS", "Bottom".
// Delivery: the United States (L62 check of 13 Nov 2026): deliversTo US on MGW (round 2b, lessons L107).
export const RULES = {
  key: 'maceoo',
  network: 'cj',
  advertiserId: 5504360,
  retailer: 'Maceoo',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?maceoo\.com\//i,
  sites: ['mgw'],
  maxPrice: 1500,
  minPrice: 20
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Maceoo'; }
// "Maceoo - Men's Luxury Designer Einstein Micro Check Blue Long Sleeve Shirt" -> "Einstein Micro Check Blue Long Sleeve Shirt";
// "Maceoo Galileo Daisyspring White Short Sleeve Shirt | Men's Short Sleeve Dress Shirt | ..." -> the part before " | ".
export function displayName(name) {
  return String(name || '').split(' | ')[0].replace(/^Maceoo\s*-?\s*/i, '').replace(/^Men'?s Luxury Designer\s+/i, '').replace(/\s{2,}/g, ' ').trim();
}

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  const c = String(feedCategory || '').split(':')[0].trim().toLowerCase();
  if (!n) return { reject: 'no name' };
  if (/gift card|shipping protection/i.test(n)) return { reject: 'gift card or protection' };
  const cl = sub => ({ site: 'mgw', siteCategory: 'Clothing', subcategory: sub });
  if (/^dress shirt/.test(c)) return cl('Shirts');
  if (/^(polo|v-neck)/.test(c)) return cl('T-Shirts');
  if (/^(jacket|blazer)/.test(c)) return cl('Jackets');
  if (/^swim/.test(c)) return cl('Shorts');
  if (/^bottom/.test(c)) return cl(/shorts/i.test(n) ? 'Shorts' : 'Trousers');
  if (/^underwear/.test(c)) return cl('Underwear');
  // "Crewneck T-Shirt" and "Long Sleeve T-Shirt" are T-shirts; a "Crewneck Sweater" or "Sweatshirt" a sweatshirt (dry run of 14 Nov 2026).
  if (/^athleisure/.test(c)) return cl(/hood/i.test(n) ? 'Hoodies' : /t-?shirt|\btee\b/i.test(n) ? 'T-Shirts' : /sweat|crew/i.test(n) ? 'Sweatshirts' : /shorts/i.test(n) ? 'Shorts' : /pants?|trousers|jogger/i.test(n) ? 'Trousers' : 'Clothing');
  if (/^shoes/.test(c)) return { site: 'mgw', siteCategory: 'Shoes', subcategory: /sneaker|trainer/i.test(n) ? 'Trainers' : /boot/i.test(n) ? 'Boots' : 'Shoes' };
  if (/^accessor/.test(c)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: /belt/i.test(n) ? 'Belts' : /tie\b/i.test(n) ? 'Ties' : 'Accessories' };
  return { reject: `Maceoo section "${c || 'none'}" not used on MGW` };
}
