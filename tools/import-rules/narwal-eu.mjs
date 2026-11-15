// Import rules for Narwal EU (Awin advertiser 131578, feeds 119140 and 119292, eu.narwal.com, euros) on Home Gear World
// (mass import round 2, 15 Nov 2026). Feed: 30 + 29 rows in English: robot vacuum and mop stations (Freo, Flow) and
// cordless vacuums (V50), plus spare parts, warranties and gift cards. The EU shop: shown only in the EU views
// (deliversTo 'Narwal EU': ['EU']), never to the UK (euros, EU plugs).
export const RULES = {
  key: 'narwal-eu',
  advertiserId: 131578,
  retailer: 'Narwal EU',
  currency: 'EUR',
  shop: /^https:\/\/eu\.narwal\.com\//i,
  sites: ['hgw'],
  maxPrice: 2500,
  minPrice: 100
};

export function displayBrand() { return 'Narwal'; }

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/compatible with|brush|roller|filter|mop pad|bag\b|warranty|gift card|kit\b|replacement|accessor/i.test(n)) return { reject: 'spare part, warranty or gift card' };
  if (/robot vacuum|cordless vacuum|vacuum/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Vacuum Cleaner', name: n.replace(/^NARWAL\b/, 'Narwal') };
  return { reject: 'not a vacuum cleaner' };
}
