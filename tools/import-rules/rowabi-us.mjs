// Import rules for Rowabi (Awin advertiser 46127, feed 102653, rowabi.com, US dollars) on Home Gear World (mass import
// round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 151 rows (one per size), 42 pages: rattan, bamboo, jute
// and seagrass pendant lights and lampshades. Shown only to the US (US wiring).
export const RULES = {
  key: 'rowabi-us',
  advertiserId: 46127,
  retailer: 'Rowabi',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?rowabi\.com\//i,
  sites: ['hgw'],
  maxPrice: 1500,
  minPrice: 20
};

// "Abandon Lace Rattan Light Pendant - Bamboo Pendant Light, Boho Lamp, ..." -> "Abandon Lace Rattan Light Pendant"
export function displayName(name) { return String(name || '').split(/\s+-\s+/)[0].trim(); }

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|cord kit|cord set|ceiling (rose|canopy)|bulb|hook/i.test(n)) return { reject: 'cord kit, bulb or fitting sold alone' };
  if (/lampshade|shade\b/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Lampshade', name: displayName(n) };
  if (/floor lamp/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Floor Lamp', name: displayName(n) };
  if (/table lamp/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Table Lamp', name: displayName(n) };
  if (/wall (light|lamp|sconce)|sconce/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Wall Light', name: displayName(n) };
  if (/chandelier/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Chandelier', name: displayName(n) };
  if (/pendant|light|lamp|lantern/i.test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Pendant Light', name: displayName(n) };
  return { reject: 'not a light' };
}
