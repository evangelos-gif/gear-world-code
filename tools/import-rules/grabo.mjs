// Import rules for GRABO (Awin advertiser 129497) on Construction Gear World (25 Oct 2026, lessons L63). New on every site.
// The shop is order.grabo.com (GRABO LLC, Las Vegas): prices in US DOLLARS, "Worldwide Shipping, fulfilled by our authorized
// dealers" (deliversTo in sites/cgw/site.config.js, lessons L62). Two feeds: 118332 (58 rows, GRABO) and 118395 (117 rows,
// Nemo Power Tools, the same maker).
//  - GRABO battery suction lifters ("Suction Gripsters", for tiles, glass, stone and doors) with their batteries, chargers
//    and attachments (lifting strap, core drill mount, tile vibrator, carry case): Site Equipment.
//  - Nemo cordless tools (drills, impact wrenches, grinders, saws, work lights; many are waterproof) with their batteries
//    and chargers: Power Tools.
//  - Left out: repair kits ("Kits for Nemo Hammer Drill - Balance Pressure Assembly", "V3 Nemo Flood Light Replacement &
//    Accessories - Upper Body"), single spare parts ("OTTOVAC AA Battery Compartment with Switch"), and boat-hull cleaning
//    (not construction gear).
//  - In, after the first dry run (25 Oct 2026; owner: as many as possible, if safe): everything on GRABO's own accessory
//    shelf ("Suction Gripster Accessories"): seals and suction plates for brick, pavers, plank tile and textured stone (each
//    with the load it holds), the ERGUO extension arms and the VAC-Plate workholding kit. They are sold on their own to fit a
//    lifter, like a blade for a saw. So is "GRABO V2 (1 Battery, 1 Seal)", the lifter itself with its battery and seal.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'grabo',
  advertiserId: 129497,
  retailer: 'GRABO',
  currency: 'USD',
  shop: /^https:\/\/order\.grabo\.com\//i,
  sites: ['cgw'],
  maxPrice: 3000,
  keepQuery: true
};

// The product page's own name ("/product/lifting-strap/" -> "lifting-strap"): one per product, readable in the database.
export function productKey(get) {
  try {
    const m = /\/product\/([a-z0-9][a-z0-9-]{1,150})\/?$/i.exec(new URL(get('merchant_deep_link')).pathname);
    if (m) return m[1].toLowerCase();
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const REPAIR = /^\s*kits? for\b|\breplacement\b.*\b(?:upper|lower|body|head|housing|assembly)\b|\b(?:assembly|o-ring|gasket|switch|spring|gear set|armature|carbon brush(?:es)?|motor housing|trigger|battery compartment)\b/i;
const NOT_CONSTRUCTION = words(['hull', 'watercraft', 'boat', 'antifouling', 'barnacle']);
const LIFTER = words(['gripster', 'suction', 'vacuum lifter', 'lifter', 'grabo']);
const LIFTER_EXTRA = words(['lifting strap', 'sling', 'bore mount', 'core drill holder', 'tile vibration', 'vibrator', 'carry case', 'case', 'bag', 'battery', 'charger', 'seal']);
const TOOL = words(['drill', 'driver', 'impact wrench', 'wrench', 'grinder', 'saw', 'reciprocating', 'flood light', 'work light', 'light', 'lamp', 'battery', 'charger', 'bits', 'drill bits', 'tool leash']);

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  if (NOT_CONSTRUCTION.test(n) || /watercraft|vehicle/i.test(cat)) return { reject: 'boat or vehicle care, not construction gear' };
  if (REPAIR.test(n)) return { reject: 'repair kit or spare part' };
  const SITE = { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Site Equipment' };
  // GRABO's own shelves ("Suction Gripsters", "Suction Gripster Accessories / Batteries / Chargers"): the lifters and what
  // is sold to fit them (seals and plates with their load, ERGUO arms, jigs, mounts, remotes).
  if (/gripster/i.test(cat)) return SITE;
  const grabo = /grabo|gripster|suction/i.test(n);
  if (grabo && (LIFTER.test(n) || LIFTER_EXTRA.test(n))) return SITE;
  if (TOOL.test(n) || /hardware > tools|power tool/i.test(cat)) return { site: 'cgw', siteCategory: 'Power Tools', subcategory: 'Power Tools' };
  return { reject: 'not a GRABO lifter or a Nemo tool' };
}
