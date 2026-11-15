// Import rules for LOOMY Home (Awin advertiser 90515, feed 106640, loomyhome.com, US dollars) on Home Gear World (mass
// import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 807 rows (one per size), 165 pages, all "Rug":
// jute, wool and shaggy rugs named like "Sweet Knot-Thing", "Blue Striped Jute"; rug pads too. Shown only to the US.
export const RULES = {
  key: 'loomy-us',
  advertiserId: 90515,
  retailer: 'LOOMY Home',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?loomyhome\.com\//i,
  sites: ['hgw'],
  maxPrice: 6000,
  minPrice: 20
};

export function displayBrand() { return 'LOOMY'; }

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|rug pad|\bpad\b|sample|swatch/i.test(n)) return { reject: 'gift card, rug pad or sample' };
  return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Rug', name: /\brug\b/i.test(n) ? n : `${n} Rug` };
}
