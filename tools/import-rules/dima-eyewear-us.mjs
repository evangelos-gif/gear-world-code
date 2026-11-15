// Import rules for Dima Eyewear (US) (Awin advertiser 128033, feed 116083, dimaeyewear.com, US dollars) on Women's Gear
// World (mass import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 514 rows, 453 pages, Shopify, every
// row in stock, folders "Sunglasses" 284 and "Eyeglasses" 207; frames are named with women's first names ("Aggie",
// "Dina", "Sundra"). A US programme: the site settings show it only to the US (deliversTo 'Dima Eyewear': ['US']).
//  - sunglasses -> Bags & Accessories > Sunglasses; eyeglass frames -> Bags & Accessories > Eyeglasses;
//  - lenses, cases, cloths, gift cards and anything else stay out.
export const RULES = {
  key: 'dima-eyewear-us',
  advertiserId: 128033,
  retailer: 'Dima Eyewear',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?dimaeyewear\.com\//i,
  sites: ['wgw'],
  maxPrice: 600,
  minPrice: 20
};

export function displayBrand() { return 'DIMA'; }

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|lens(es)?\b|case\b|cloth|cleaner|warranty|insurance|shipping/i.test(n)) return { reject: 'gift card, lenses, case or another accessory' };
  const c = String(feedCategory || '').toLowerCase();
  if (c === 'sunglasses') return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: `${n} Sunglasses` };
  if (c === 'eyeglasses') return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: `${n} Glasses Frames` };
  return { reject: 'not said to be sunglasses or glasses' };
}
