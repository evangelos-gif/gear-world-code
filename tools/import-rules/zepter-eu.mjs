// Import rules for Zepter (CJ Affiliate advertiser 7341377 "Zepter Europe", shop.zepter.com, euros) on Home Gear World.
// Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 4,782 products from many country
// shops (zepter.ro in lei, zepter.rs in dinars, zepter.pl in zloty, German, Czech, Polish names ...). Only the English
// European shop (shop.zepter.com, 404 products in euros) goes in, and from it only cookware, knives, tableware, glasses
// and cutlery (Kitchen & Dining); beauty, coffee capsules, therapy lamps and water filters left out.
// Shown in the EU (deliversTo Zepter: ['EU'], the group HGW already has for SwitchBot and Narwal EU, lessons L169).
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'zepter-eu',
  network: 'cj',
  advertiserId: 7341377,
  retailer: 'Zepter',
  currency: 'EUR',
  shop: /^https:\/\/shop\.zepter\.com\//i,
  sites: ['hgw'],
  maxPrice: 3000,
  minPrice: 10
};

// The feed's names are often in capitals ("ZEPTER MULTI-TOOL WITH GIFT BOX").
export function displayName(name) {
  const n = clean(name);
  return n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : n;
}
export function displayBrand() { return 'Zepter'; }

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const cat = String(feedCategory || '');
  if (/beauty|bioptron|therapy|hyperlight|aqueena|water|coffee|caps?ule|detergent|cleansy|filter|charger|cream|serum|spare|replacement/i.test(`${n} ${cat}`)) return { reject: 'beauty, therapy, coffee or water product (not Kitchen & Dining)' };
  const k = sub => ({ site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: sub, name: /zepter/i.test(n) ? n : `Zepter ${n}` });
  if (/knife|knives|multi-?tool|scissors|felix/i.test(`${n} ${cat}`)) return k('Kitchen Knives');
  if (/frying pan|\bpan\b|wok|skillet/i.test(n)) return k('Frying Pan');
  if (/pot\b|pots\b|casserole|saucepan|cookware|pressure|cooking set|steam/i.test(n)) return k('Cookware');
  if (/glass(es)?\b|flutes?|carafe|decanter/i.test(n)) return k('Glassware');
  if (/cutlery|spoons?|forks?\b/i.test(n)) return k('Cutlery');
  if (/plate|bowl|cup\b|cups\b|mug|creamer|sugar|teapot|tea set|coffee set|dinner|dessert|platter|tray|table art|porcelain/i.test(`${n} ${cat}`)) return k('Tableware');
  if (/container|vacsy|lid\b|lids\b/i.test(n)) return k('Kitchen Utensil');
  return { reject: 'not cookware or tableware' };
}
