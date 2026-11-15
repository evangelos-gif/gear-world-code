// Import rules for Super Area Rugs (Awin advertiser 88509, feed 107031, superarearugs.com, US dollars) on Home Gear
// World (mass import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 2,254 rows (one per size and shape),
// 172 pages: braided wool and cotton rugs, runners and faux fur shag rugs. Shown only to the US.
export const RULES = {
  key: 'superarearugs-us',
  advertiserId: 88509,
  retailer: 'Super Area Rugs',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?superarearugs\.com\//i,
  sites: ['hgw'],
  maxPrice: 3000,
  minPrice: 15
};

// "Confetti Bright & Bold 5-Carrier Braided Rug in Brilliant Red - 2' X 3' Oval" -> the part before the size.
export function displayName(name) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  return n.split(/\s+-\s+(?=\d|[A-Z][a-z]+\s*\/\s*\d)/)[0].trim();
}

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|rug pad|sample|swatch|cleaner/i.test(n)) return { reject: 'gift card, pad or sample' };
  if (/\brugs?\b|runner|\bmat\b/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Rug', name: displayName(n) };
  return { reject: 'not a rug' };
}
