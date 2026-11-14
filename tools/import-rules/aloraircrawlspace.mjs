// Import rules for AlorAir Crawlspace (Awin advertiser 104549, feed 116153, aloraircrawlspace.com) on Home Gear World.
// Approved 12 Nov 2026. Feed facts (13 Nov 2026): 184 rows in USD (164 pages): crawl-space and basement dehumidifiers,
// air movers, air filtration systems, filters, ducts; also "Wholesale Packs ... (pack of 5/30)" for trade buyers.
// Shipping page (aloraircrawlspace.com/policies/shipping-policy, read 14 Nov 2026): "our transactions are only made
// within the USA" (not Hawaii or Alaska): deliversTo US on HGW (round 2b, lessons L107).
export const RULES = {
  key: 'aloraircrawlspace',
  advertiserId: 104549,
  retailer: 'AlorAir',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?aloraircrawlspace\.com\//i,
  sites: ['hgw'],
  maxPrice: 6000,
  minPrice: 20
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'AlorAir'; }
export function displayName(name) { return String(name || '').replace(/^ALORAIR\s+/i, 'AlorAir ').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/wholesale|pack of \d+|\(\d+ ?pack\)/i.test(n)) return { reject: 'wholesale pack for trade buyers' };
  if (/filters?\b|duct|damper|hose|drain|pump kit|bracket|replacement|insulation|vapor barrier|tape|sealing/i.test(n) && !/dehumidifier with/i.test(n)) return { reject: 'filter, duct or building material (not an appliance)' };
  const a = sub => ({ site: 'hgw', siteCategory: 'Home Appliances', subcategory: sub });
  if (/dehumidifier/i.test(n)) return a('Dehumidifier');
  if (/air (?:filtration|purifier|scrubber)|purecare/i.test(n)) return a('Air Purifier');
  if (/fan|air mover|ventirpro/i.test(n)) return a('Fan');
  if (/humidifier/i.test(n)) return a('Humidifier');
  return { reject: 'not a home appliance' };
}
