// Import rules for UPPER Brand (Awin advertiser 97753, feeds 104800 and 117808, upperbags.com, US dollars) on Kids' Gear
// World (mass import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 141 + 8 rows, 78 pages: diaper (nappy)
// backpacks and bags, plus fanny packs, rings, pouches, stroller straps and gift cards. Shown only to the US.
//  - nappy backpacks and bags -> Baby & Toddler > Nappy Bags; stroller straps -> Baby Pushchair & Pram Accessories;
//  - rings, pouches, fanny packs, bundles and gift cards stay out.
export const RULES = {
  key: 'upper-us',
  advertiserId: 97753,
  retailer: 'UPPER',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?upperbags\.com\//i,
  sites: ['kgw'],
  maxPrice: 600,
  minPrice: 15
};

export function displayBrand() { return 'UPPER'; }

export function classify({ name }) {
  const n = String(name || '').replace(/™/g, '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|\bring\b|bundle|value set|fanny|pouch(?! &)|wallet/i.test(n)) return { reject: 'ring, pouch, fanny pack, bundle or gift card' };
  if (/stroller strap|pram/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby Pushchair & Pram Accessories', name: n };
  if (/diaper|nappy|baby bag|backpack|tote|bag\b/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Nappy Bags', name: n.replace(/\bdiaper\b/gi, 'Nappy') };
  return { reject: 'not a nappy bag' };
}
