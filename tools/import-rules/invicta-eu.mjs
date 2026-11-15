// Import rules for Invicta Stores Europe (Daisycon programme 18836 "Invicta Watch Europe", invictastores.eu, euros) on
// Men's and Women's Gear World (massive import round 3, 15 Nov 2026, lessons L145, L147). Feed facts (15 Nov 2026 download): 2,530
// products in English, updated daily, Daisycon "gender_target" male 1,708 / female 671 / unisex 44 / none 107; names such
// as "Invicta Bolt 46037 Men's Watch - Quartz Movement - Stainless Steel with Black Dial - 50 mm"; brands Invicta,
// TechnoMarine, Montres Prestige. A real page checked by hand (15 Nov 2026): the feed's price (EUR 149) is the shop's.
// Delivery (invictastores.eu "Delivery Time", read 15 Nov 2026): most of Europe and the UK, NOT Spain, Portugal or the
// United States; the shop is "not responsible for any customs duties or taxes" outside the EU. So the site configs show it
// in the EU, Swiss, Norwegian and Icelandic views only, not in the UK one (a UK buyer could pay import VAT and duty on
// delivery, lessons L147).
//  - men's and unisex watches -> MGW Watches > Men's Watches / Unisex Watches; women's watches -> WGW Watches (first held
//    back for the 8-view limit; the live view rules since L151 have no per-country groups, so they go in too);
//  - sunglasses, caps, boxes, gift packaging, clocks, cards, bottles, cleaners and other accessories are left out.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'invicta-eu',
  network: 'daisycon',
  advertiserId: 18836,
  retailer: 'Invicta Stores',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?invictastores\.eu\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 5000,
  minPrice: 20
};

export const SHOP_URL = 'https://www.invictastores.eu/';
export const field = daisyconField(SHOP_URL);
export const productKey = pageKey;

// The watch's own name: up to its "Watch" before " - " or the end. Some model names have a " - " of their own ("Invicta
// Pro Diver - SCUBA 22227 Men's Watch - Quartz Movement - ...", "Invicta Subaqua - Poseidon 48554 Men's Watch - ...").
const WATCH_HEAD = /^(.*?\b(?:men'?s|women'?s|unisex|ladies)?\s*(?:smart)?watch)(?=\s+-\s+|\s*$)/i;

// "Invicta Bolt 46037 Men's Watch - Quartz Movement - Stainless Steel with Black Dial - 50 mm"
//   -> "Invicta Bolt 46037 Watch, Quartz, Black Dial, 50 mm"
export function displayName(name) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const m = WATCH_HEAD.exec(n);
  const headRaw = m ? m[1] : n.split(/\s+-\s+/)[0];
  const head = headRaw.replace(/\s+-\s+/g, ' ').replace(/\b(?:Men's|Women's|Mens|Womens|Unisex)\s+/gi, '').replace(/\s{2,}/g, ' ').trim();
  const rest = n.slice(headRaw.length).split(/\s+-\s+/).map(x => x.trim()).filter(Boolean);
  const movement = (rest.find(p => /\bmovement$/i.test(p)) || '').replace(/\s*movement$/i, '').trim();
  const dial = ((rest.find(p => /\bdial$/i.test(p)) || '').match(/\bwith\s+(.+\bdial)$/i) || [])[1] || '';
  const size = rest.find(p => /^\d+(?:[.,]\d+)?\s*mm$/i.test(p)) || '';
  return [head, movement, dial, size].filter(Boolean).join(', ');
}

export function displayBrand(brand) {
  const b = String(brand || '').trim();
  return /^technomarine$/i.test(b) ? 'TechnoMarine' : b;
}

const NOT_A_WATCH = /\b(sunglasses|cap|hat|beanie|box|packaging|case|travel ?case|clock|cards?|filter|toolkit|tool kit|strap|band|winder|pen|wallet|bag|keychain|cufflinks|bracelet|ring|necklace|bottle|cleaner|cloth|spray)\b/i;

export function classify({ name, awinCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  // A watch's own name ends in "<Men's|Women's|Unisex> Watch" before " - "; "Invicta Watch Box IPM547X" or "Invicta Pro
  // Diver Wall Clock 70040" do not.
  const m = WATCH_HEAD.exec(n);
  const isWatch = m && (/\b(?:men'?s|women'?s|unisex|ladies)\s+watch$/i.test(m[1]) || !NOT_A_WATCH.test(m[1]));
  if (!isWatch) return { reject: 'not a watch (accessory)' };
  const gender = String(awinCategory || '').toLowerCase();
  const women = gender === 'female' || /\bwomen'?s\b|\bladies\b/i.test(n);
  const men = gender === 'male' || /\bmen'?s\b/i.test(n);
  if (women && !men) return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' };
  if (men) return { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" };
  return { site: 'mgw', siteCategory: 'Watches', subcategory: 'Unisex Watches' };
}
