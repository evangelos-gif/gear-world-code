// Import rules for MOVA (CJ Affiliate advertiser 7906138 "MOVA North America", us.mova.tech, US dollars) on Home Gear
// World and Garden Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 285
// rows, the US shop in dollars (158) and the Canadian one in Canadian dollars (127, left out by the shop address):
// robot and wet-and-dry vacuums (HGW), string trimmers, blowers and robot mowers (GGW), and many mop pads, filters,
// bags and batteries (left out). US plugs: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'mova-us',
  network: 'cj',
  advertiserId: 7906138,
  retailer: 'MOVA',
  currency: 'USD',
  shop: /^https:\/\/us\.mova\.tech\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 3500,
  minPrice: 50
};

export function classify({ name, feedCategory = '' }) {
  const n = clean(name).replace(/（/g, ' (').replace(/）/g, ') ');
  if (!n) return { reject: 'no name' };
  if (/mop pads?|filter|bags?\b|battery|charger|brush|replacement|accessor|kit only|cleaning solution|detergent|cloth|blade|spool|line\b|merch|t-?shirt|hat\b|cap\b/i.test(n) && !/(vacuum|mower|trimmer|blower)\b(?!.*(pads?|filter|bags?))/i.test(n)) {
    return { reject: 'accessory, spare part or merchandise' };
  }
  if (/robot (?:vacuum|cleaner)|robotic vacuum|vacuum|wet and dry|wet & dry|floor cleaner/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Vacuum Cleaner', name: n };
  const g = sub => ({ site: 'ggw', siteCategory: 'Power Garden Tools', subcategory: sub, name: n });
  if (/trimmer/i.test(n)) return g(/hedge/i.test(n) ? 'Hedge Trimmers' : 'Grass Trimmers');
  if (/blower/i.test(n)) return g('Garden Blowers');
  if (/mower/i.test(n)) return g('Outdoor Power Tools');
  if (/chainsaw/i.test(n)) return g('Chainsaws & Accessories');
  return { reject: `not a vacuum or garden tool (${feedCategory || 'no group'})` };
}
