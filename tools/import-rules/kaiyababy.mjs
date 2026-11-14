// Import rules for Kaiya Baby (CJ Affiliate advertiser 8022425, kaiyababy.com) on Kids' Gear World. Joined 13 Nov 2026.
// Feed facts (13 Nov 2026): 425 rows in USD = colour and size options of about 130 pages (merino, organic cotton and camel
// wool sleep sacks, bodysuits, rompers), USD 7-85, no categories. Delivery: the United States (L62 check of 13 Nov 2026):
// deliversTo US on KGW (massive import round 2b, lessons L107).
export const RULES = {
  key: 'kaiyababy',
  network: 'cj',
  advertiserId: 8022425,
  retailer: 'Kaiya Baby',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?kaiyababy\.com\//i,
  sites: ['kgw'],
  maxPrice: 300,
  minPrice: 5,
  commonVariantName: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Kaiya Baby'; }
// "All Season Long Sleeve Sleep Sack 1.0 TOG - Organic Cotton & Camel Wool - Cream - 6-18 Months" keeps the words all options share.
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift card|shipping protection|embroidery|-service\b|\bservice$/i.test(n)) return { reject: 'gift card, protection or a service (embroidery)' };
  // Its page now opens another swaddle at $39 (checked 14 Nov 2026): the feed row ($6.90) is old.
  if (/front opening zip up swaddle/i.test(n)) return { reject: 'old feed row: the page now shows another product' };
  if (/sleep ?(sack|bag)|sleep suit sack|suit sack|sleeper|pajamas?|pyjamas?|sleepsuit/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby & Toddler Sleepwear' };
  if (/swaddle/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Swaddling Blankets' };
  if (/blanket/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Receiving Blankets' };
  if (/bodysuit|romper|onesie|leggings?|pants|top|tee|cardigan|hat|beanie|socks?/i.test(n)) return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Clothing' };
  return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby & Toddler' };
}
