// Import rules for Natkina (Awin advertiser 81625) on Women's Gear World "Women's Jewellery" (owner, 8 Nov 2026: "check
// email download and import new feeds"). New on every site. Feed facts (feed-profile 8 Nov 2026): four feeds with the
// same 3,154 products in CHF (118404), USD (118405), EUR (118406) and GBP (118407); only the pound feed is read (the
// planner keeps the first file's currency for a product, and the franc feed sorts first). Shop natkina.com, categories
// Rings (1,931), Earrings (487), Necklaces (447), Bracelets (231), Body Jewelry, Brooches, Pendants, one watch and one
// spray; brands NATKINA, Chedrik. Names carry the option after " - " ("Lucky Green Frog Ring - White Silver / Green / 52"):
// one card per product page, named without the option. Subcategories are the ones WGW already has.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const RULES = {
  key: 'natkina',
  advertiserId: 81625,
  retailer: 'Natkina',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?natkina\.com\//i,
  sites: ['wgw'],
  maxPrice: 5000,
  minPrice: 10,
  keepQuery: true
};

export function feedFiles(archive) {
  return ['AWIN_81625_118407.csv.gz', 'AWIN_81625_118407.csv'].map(f => join(archive, f)).filter(f => existsSync(f));
}

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand(brand) {
  const b = String(brand || '').trim();
  if (!b || /^natkina$/i.test(b)) return 'Natkina';
  return b[0].toUpperCase() + b.slice(1).toLowerCase();
}

const SUBS = [
  ['Rings', /\brings?\b/i], ['Earrings', /\b(earrings?|studs?|hoops?|ear cuffs?)\b/i], ['Necklaces', /\b(necklaces?|pendants?|chokers?|chains?)\b/i],
  ['Bracelets', /\b(bracelets?|bangles?|cuffs?|anklets?)\b/i]
];

export function classify({ name, feedCategory = '' }) {
  const full = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!full) return { reject: 'no name' };
  const n = full.split(/\s+-\s+/)[0].trim() || full;
  if (/\b(watch(es)?|spray|cleaner|cleaning|gift card|gift voucher|box only|packaging)\b/i.test(n) || /watches|spray/i.test(feedCategory)) {
    return { reject: 'watch, cleaner or gift card, not jewellery' };
  }
  if (/\b(men'?s|for men|mens)\b/i.test(n)) return { reject: "men's jewellery (Women's Gear World only)" };
  let sub = '';
  for (const [label, re] of SUBS) if (re.test(feedCategory) || re.test(n)) { sub = label; break; }
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub || 'Jewellery', name: n };
}
