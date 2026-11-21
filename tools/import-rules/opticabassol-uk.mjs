// Import rules for Optica Bassol (Daisycon programme 19032 "Optica Bassol (INT)", opticabassol.com/en-gb, pounds) on
// Women's and Men's Gear World (phase 1 of the mass import, chat 7 sheet «Λείπουν 20-11», 21 Nov 2026, lessons L207).
// A Barcelona optician that sells designer eyewear online with "Fast shipping worldwide" (its UK pages, read 21 Nov 2026:
// https://www.opticabassol.com/en-gb). Feed facts (20 Nov 2026 download): 17,376 rows, all in stock, all in pounds, no shop
// categories; brands Ray-Ban 3,934, Oakley 1,865, ProDesign 1,380, Guess, Carrera, Tommy Hilfiger, Ralph Lauren ...; the
// name is only the model code ("Ray-Ban RB3528 029/9A 61", "Guess GU50238 020 53"), the description says what it is
// ("... a sunglass with a shield design", "... the Guess GU50238 optical glasses"), and Daisycon's gender_target is
// female 8,590, unisex 5,055, male 3,731. Every row is one model, colour and lens size with its own page and price.
//  - Sunglasses (the description or name says sunglasses, or a Ray-Ban RB / Oakley OO code): women's and unisex to WGW,
//    men's to MGW, Bags & Accessories > Sunglasses (both sites already have it, live databases 21 Nov 2026).
//  - Optical frames (optical, prescription, eyeglasses, or a Ray-Ban RX / Oakley OX code): women's and unisex to WGW
//    Bags & Accessories > Eyeglasses (709 there already); MGW has no Eyeglasses subcategory and none is made (L56), so
//    men's frames stay out.
//  - Children's eyewear (Junior, Kids, Ray-Ban RJ) and anything the texts do not tell stay out.
//  - The card name is the model code with what it is ("Ray-Ban RB3528 029/9A 61 Sunglasses"); the brand as the shop
//    writes it on its pages ("Ray-ban" in the feed is "Ray-Ban").
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'opticabassol-uk',
  network: 'daisycon',
  advertiserId: 19032,
  retailer: 'Optica Bassol',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?opticabassol\.com\/en-gb\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 1500,
  minPrice: 15
};

export const SHOP_URL = 'https://www.opticabassol.com/';
const base = daisyconField(SHOP_URL);

const SUN = /\bsun ?glass(es)?\b|\bsunnies\b/i;
const OPTICAL = /\b(optical|prescription|eyeglass(es)?|spectacles|reading glasses|optical frames?)\b/i;
const KIDS = /\b(junior|kids?|children'?s?|child|boys?|girls?)\b|\bRJ ?\d/i;

// What the row is, read once from its texts: 'kids', 'sunglasses', 'optical' or ''.
export function kindOf(name, description = '') {
  const n = String(name || ''), t = `${n} ${description || ''}`;
  if (KIDS.test(n) || /\bfor (kids|children)\b/i.test(description || '')) return 'kids';
  if (/\b(RB|OO)\s?\d{3,5}/.test(n)) return 'sunglasses';
  if (/\b(RX|OX)\s?\d{3,5}/.test(n)) return 'optical';
  if (SUN.test(t)) return 'sunglasses';
  if (OPTICAL.test(t)) return 'optical';
  return '';
}

// merchant_category carries the kind (the feed has no categories), category_name Daisycon's gender (daisyconField).
export function field(c, column) {
  if (c === 'merchant_category') return kindOf(column('product_name'), column('description'));
  return base(c, column);
}
export const productKey = pageKey;

const KEEP_CASE = /^(ProDesign|Max&Co|MAX&Co|DKNY|BOSS|HUGO|Mr\.?)$/;
export function displayBrand(brand) {
  return String(brand || '').trim().split(/(\s+|-)/).map(w => (KEEP_CASE.test(w) || !/^[a-z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join('');
}

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').trim();
}

const WORD = { sunglasses: 'Sunglasses', optical: 'Glasses' };

export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const kind = feedCategory || kindOf(n);
  const who = String(awinCategory || '').toLowerCase();
  if (kind === 'kids') return { reject: "children's eyewear" };
  if (!kind) return { reject: 'the texts do not say sunglasses or glasses' };
  const card = `${n} ${WORD[kind]}`;
  if (kind === 'sunglasses') {
    if (who === 'male') return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: card };
    return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: card };
  }
  if (who === 'male') return { reject: "men's optical frames (Men's Gear World has no Eyeglasses subcategory, L56)" };
  return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: card };
}
