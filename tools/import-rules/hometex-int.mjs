// Import rules for HOME-TEX (Daisycon programme 21120 "HOME-TEX (INT)", home-tex.com, euros) on Home Gear World
// (massive import round 3, 15 Nov 2026, lessons L145, L147). A Danish shop of bed linen, duvets, pillows, towels and
// home textiles (brands Nordstrand Home, Borg Living, By Borg, By Night, In Style). Feed facts (15 Nov 2026 download): 7,405
// rows in English, 7,156 in stock, prices in euros; no shop categories, so the rules sort by the name. Every size has a
// page and a price of its own ("2111-2" Silk bedding 140x220 cm EUR 272.49, "2111-6" 240x220 cm EUR 448.99), and one more
// row per family is the shop's "-master" page, which shows one of those sizes again: one card per size page (its own price
// and link), the "-master" rows are left out so nothing shows twice. A real page checked by hand (15 Nov 2026): the feed's price (EUR 272.49) is the shop's.
// Delivery (home-tex.com "Fast delivery", read 15 Nov 2026): Austria, Belgium, Bulgaria, Czech Republic, Estonia,
// Finland, France, Germany, Hungary, Italy, Latvia, Lithuania, Luxembourg, the Netherlands, Poland, Romania, Slovakia,
// Spain and Switzerland; Denmark, Norway and Sweden have shops of their own; "We do not ship to Greenland, Iceland, the
// UK, and the Faroe Islands". So the site config shows it only in those 19 views, never in the UK one (lessons L107).
//  - Bedding & Bath: bed linen, duvets, pillows, sheets, mattress toppers and protectors, towels, bath mats, bathrobes;
//  - Home Decor: throws and blankets, rugs, cushions, curtains; Kitchen & Dining: tablecloths and wax cloths;
//  - suitcases (not a home product), gift cards and anything the name does not tell are left out.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'hometex-int',
  network: 'daisycon',
  advertiserId: 21120,
  retailer: 'HOME-TEX',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?home-tex\.com\/shop\//i,
  sites: ['hgw'],
  maxPrice: 3000,
  minPrice: 5
};

export const SHOP_URL = 'https://www.home-tex.com/';
const base = daisyconField(SHOP_URL);
// category_name tells the rules which rows are the "-master" pages (not stored).
export function field(c, column) {
  if (c === 'category_name') return /-master$/i.test(column('merchant_product_id')) ? 'master' : '';
  return base(c, column);
}
export const productKey = pageKey;

export function displayBrand(brand) { return String(brand || '').trim(); }

// The size stays in the name (each card is one size page); only a dangling " -" goes.
export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').replace(/\s*-\s*$/, '').trim();
}

const RULES_BY_NAME = [
  [/\b(suitcase|luggage|trolley|cabin bag|travel bag)\b/i, null, 'suitcase or luggage (not a home product)'],
  [/\bgift ?card\b/i, null, 'gift card'],
  [/\bpillow ?cases?\b|\bpillowslips?\b/i, 'Bedding & Bath', 'Bed Linen'],
  [/\b(fitted sheets?|stretch sheets?|bed sheets?|sheets?|jersey sheet|top sheet)\b/i, 'Bedding & Bath', 'Bed Sheet'],
  [/\bmattress protectors?\b|\bprotector\b/i, 'Bedding & Bath', 'Mattress Protector'],
  [/\b(mattress toppers?|toppers?)\b/i, 'Bedding & Bath', 'Mattress Topper'],
  [/\bmattress(es)?\b/i, 'Furniture', 'Mattress'],
  [/\b(bedding|bed linen|duvet covers?|bedspreads?|bed sets?)\b/i, 'Bedding & Bath', 'Bed Linen'],
  [/\b(duvets?|quilts?|weighted blankets?|weighted duvet)\b/i, 'Bedding & Bath', 'Duvet'],
  [/\bpillows?\b/i, 'Bedding & Bath', 'Pillow'],
  [/\b(bath ?mats?|bathroom mats?|shower mats?)\b/i, 'Bedding & Bath', 'Bath Mat'],
  [/\b(bathrobes?|dressing gowns?|robes?)\b/i, 'Bedding & Bath', 'Bathrobe'],
  [/\b(towels?|hand towel|guest towel|beach towel|washcloths?)\b/i, 'Bedding & Bath', 'Towel'],
  [/\b(table ?cloths?|wax ?cloth|oil ?cloth|table runners?|place ?mats?|napkins?|tea towels?)\b/i, 'Kitchen & Dining', 'Table Linen'],
  [/\b(throws?|blankets?|plaids?)\b/i, 'Home Decor', 'Throw'],
  [/\b(rugs?|carpets?|runners?)\b/i, 'Home Decor', 'Rug'],
  [/\b(cushions?|cushion covers?)\b/i, 'Home Decor', 'Cushion'],
  [/\b(curtains?)\b/i, 'Home Decor', 'Curtain']
];

export function classify({ name, awinCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (awinCategory === 'master') return { reject: 'the shop\'s "-master" page (the same as one of its size pages)' };
  // The first part of the name says what it is ("Bamboo towel - ... - Bath sheet 100x150 cm", "Gabby's Dollhouse Towel -
  // ... Pillow Cat"); only when it says nothing the whole name is read.
  for (const text of [n.split(/\s+-\s+/)[0], n]) {
    for (const [re, cat, sub] of RULES_BY_NAME) {
      if (!re.test(text)) continue;
      if (!cat) return { reject: sub };
      return { site: 'hgw', siteCategory: cat, subcategory: sub };
    }
  }
  return { reject: 'the name does not tell what it is' };
}
