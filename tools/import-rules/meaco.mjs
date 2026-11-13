// Import rules for Meaco UK (Awin advertiser 31711) on Home Gear World (3 Nov 2026, lessons L126).
// Accepted us on 2 Nov 2026. Two feeds (76815: 130 rows, 83874: 91 rows, the same Shopify shop meaco.com, GBP); the shop's
// folders are "Dehumidifiers", "Dehumidifiers, Air Purifiers", "Dehumidifiers, Air Conditioner, Heater", "Humidifiers",
// "Fans", "Cooling, Fans", "Filters, Spares", "Spares" (feed sample 3 Nov 2026).
// HGW Home Appliances already has Dehumidifier and Air Purifier (L56). Fans, heaters, humidifiers and air conditioners have
// no place yet: they get their own names in the same style (Fan, Heater, Humidifier, Air Conditioner), none of which is a
// near-copy of an existing name.
//  - In: dehumidifiers, air purifiers, fans and air circulators, heaters, humidifiers, air conditioners, their filters.
//  - Out: spare parts, brackets, window plates and storage bags sold alone.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'meaco',
  advertiserId: 31711,
  retailer: 'Meaco UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?meaco\.(com|co\.uk)\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  keepQuery: true
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const SPARE = words(['storage bag', 'wall mounting bracket', 'wall mounting brackets', 'bracket', 'brackets', 'window plate', 'window kit', 'hose', 'drain hose',
  'replacement', 'spare', 'spares', 'remote control', 'castor', 'castors', 'float', 'gift card', 'warranty']);
const FILTER = words(['filter', 'filters', 'filter pack', 'hepa']);
const DEHUM = words(['dehumidifier', 'dehumidifiers', 'dd8l']);
const PURIFIER = words(['air purifier', 'air purifiers', 'purifier']);
const FAN = words(['fan', 'fans', 'meacofan', 'air circulator', 'circulator', 'pedestal fan', 'desk fan', 'tower fan']);
const HEATER = words(['heater', 'heaters', 'meacoheat']);
const HUMID = words(['humidifier', 'humidifiers']);
const AIRCON = words(['air conditioner', 'air conditioners', 'meacocool', 'portable air conditioning']);

// The shop's names are long ("Meaco 12L Low Energy Dehumidifier and Air Purifier 2 in 1- Dehumidifier For Medium to Large
// Size Homes - Controls ..."): the card shows the part before the first " - " that starts a selling line.
export function displayName(name) {
  const n = String(name || '').trim();
  const cut = n.split(/\s?-\s+(?=[A-Z])/)[0].trim();
  return cut.length >= 12 ? cut : n;
}

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  const H = subcategory => ({ site: 'hgw', siteCategory: 'Home Appliances', subcategory, name: displayName(n) });
  if (FILTER.test(n)) {
    if (PURIFIER.test(n) && !DEHUM.test(n)) return H('Air Purifier');
    if (HUMID.test(n)) return H('Humidifier');
    return H('Dehumidifier');
  }
  // The shop's own test products ("Dummy Sub Test (DO NOT PUBLISH PEASE)", first dry run 3 Nov 2026).
  if (/\bdummy\b|do not publish|\btest product\b|dev test/i.test(n)) return { reject: 'test product of the shop' };
  // "MeacoFan Sefte 10\" Pedestal Air Circulator with Storage Bag" is the fan with a bag; a bag alone stays out.
  const withBag = /\bwith storage bag\b/i.test(n) && FAN.test(n.replace(/\bwith storage bag\b/ig, ' '));
  if (!withBag && (SPARE.test(n) || /^spares$/i.test(cat.trim()))) return { reject: 'spare part, bracket or storage bag sold alone' };
  if (AIRCON.test(n)) return H('Air Conditioner');
  if (DEHUM.test(n)) return H('Dehumidifier');
  if (HUMID.test(n)) return H('Humidifier');
  if (PURIFIER.test(n)) return H('Air Purifier');
  if (HEATER.test(n)) return H('Heater');
  if (FAN.test(n)) return H('Fan');
  if (/dehumidif/i.test(cat)) return { ...H('Dehumidifier'), doubt: true };
  if (/fans|cooling/i.test(cat)) return { ...H('Fan'), doubt: true };
  return { reject: 'not sure what it is (no dehumidifier, purifier, fan, heater or humidifier word)' };
}
