// Import rules for Kixies (Awin advertiser 93483, feed 106729, kixies.com, US dollars) on Women's Gear World (mass
// import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 96 rows, 81 pages: thigh-high stockings and tights,
// "petite to plus size", named "Danielle: Back in Black", "Ally: 1940s Polka Dot Flashback". Shown only to the US.
export const RULES = {
  key: 'kixies-us',
  advertiserId: 93483,
  retailer: 'Kixies',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?kixies\.com\//i,
  sites: ['wgw'],
  maxPrice: 150,
  minPrice: 8
};

// "Ally: 1940s Polka Dot Flashback. Petite to Plus Size" -> "Ally 1940s Polka Dot Flashback Stockings"
export function displayName(name) {
  const n = String(name || '').split(/\.\s/)[0].replace(/:\s*/, ' ').replace(/\s{2,}/g, ' ').trim();
  return /stocking|tights|thigh/i.test(n) ? n : `${n} Stockings`;
}

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|garter|bundle|mystery/i.test(n)) return { reject: 'gift card, garter or bundle' };
  return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Tights & Stockings', name: displayName(n) };
}
