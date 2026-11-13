// Import rules for Otra Eyewear (Awin advertiser 96299, otraeyewear.com) on Men's and Women's Gear World (13 Nov 2026,
// lessons L117, L120). New on every site. The feed comes only in the Google format (96299-retail-en_GB.csv.gz, Awin feed
// F3393): 204 rows on 13 Nov 2026. The shop's shipping page (13 Nov 2026): no shipping restrictions, about 200 countries
// (the UK by FedEx in 2-5 working days, duties paid by the buyer), prices in US dollars on every store.
//  - Sunglasses: "Bags & Accessories > Sunglasses" (the sites' own name, L56). The feed's gender decides the site: male ->
//    MGW; female, unisex or none -> WGW (a brand sold mostly to women), unless the name says men's.
//  - Optical and blue-light frames, cases and chains: "Bags & Accessories > Accessories", listed in the report for checking.
//  - Names: "Kent - Black / Smoke" -> "Kent Sunglasses" (one card per product, the colours are its options).
//  - Left out: gift cards, lens replacements and anything that is not eyewear.
import { googleFeedFiles, googleField, stripOption } from './lib/google-feed.mjs';

export const RULES = {
  key: 'otra',
  advertiserId: 96299,
  retailer: 'Otra Eyewear',
  currency: 'USD',
  shop: /^https:\/\/([a-z-]+\.)?otraeyewear\.com\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 500,
  minPrice: 10,
  commonVariantName: true
};

export const feedFiles = googleFeedFiles(RULES.advertiserId);

// The Google category with the feed's gender after it ("... > Sunglasses | female"): classify reads both.
export function field(name, column) {
  if (name === 'category_name') return [googleField('category_name', column), column('gender')].filter(Boolean).join(' | ');
  return googleField(name, column);
}

export function displayBrand() {
  return 'Otra Eyewear';
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const SUNGLASSES = W(['sunglass(?:es)?', 'sunnies', 'shades', 'polari[sz]ed', 'aviators?', 'cat ?eye', 'cateye', 'sun']);
const OPTICAL = W(['optical', 'blue ?light', 'frames?', 'computer glasses', 'reading glasses', 'clear lens(?:es)?', 'rx']);
const EXTRAS = W(['cases?', 'chains?', 'straps?', 'cords?', 'cleaning cloths?', 'cloths?', 'pouch(?:es)?']);
const MEN = W(["men'?s", 'mens', 'male', 'for him']);
const WOMEN = W(["women'?s", 'womens', 'ladies', 'female', 'for her']);

const titleCase = s => s.replace(/\b([A-Za-z])([A-Za-z']*)\b/g, (m, a, b) => a.toUpperCase() + b.toLowerCase());

export function displayName(name) {
  // A one-colour option ("Hazel - Black") is cut off too: the colours are the card's options.
  let s = stripOption(String(name || '').replace(/[®™]/g, '')).replace(/^otra(?: eyewear)?\s*[-|:]?\s*/i, '')
    .replace(/\s+-\s+[^-]{1,30}$/, '').replace(/\s{2,}/g, ' ').trim();
  // Names written in capitals ("KENT - BLACK / SMOKE") read better in title case.
  if (s && s === s.toUpperCase() && /[A-Z]{3}/.test(s)) s = titleCase(s);
  return s;
}

export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher|e-?gift/i.test(n)) return { reject: 'gift card' };
  if (/replacement lens|lens replacement|prescription lens|insurance|warranty/i.test(n)) return { reject: 'lens or service, not a product to list' };
  const [gpc = '', gender = ''] = String(awinCategory).split(' | ');
  const all = `${n} | ${feedCategory} | ${gpc}`;
  const men = /^male$/i.test(gender.trim()) || (MEN.test(n) && !WOMEN.test(n));
  const site = men ? 'mgw' : 'wgw';
  if (OPTICAL.test(all) && !/sunglass/i.test(all)) return { site, siteCategory: 'Bags & Accessories', subcategory: 'Accessories', name: n, doubt: true };
  if (EXTRAS.test(n) && !SUNGLASSES.test(n)) return { site, siteCategory: 'Bags & Accessories', subcategory: 'Accessories', name: n, doubt: true };
  if (SUNGLASSES.test(all) || /eyewear|glasses/i.test(all) || !feedCategory) {
    return { site, siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: /sunglass/i.test(n) ? n : `${n} Sunglasses` };
  }
  return { reject: 'not eyewear' };
}
