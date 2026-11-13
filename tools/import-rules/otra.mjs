// Import rules for Otra Eyewear (Awin advertiser 96299, otraeyewear.com) on Men's and Women's Gear World (13 Nov 2026,
// lessons L117, L120). New on every site. The feed comes only in the Google format (96299-retail-en_GB.csv.gz, Awin feed
// F3393): 204 rows on 13 Nov 2026. The shop's shipping page (13 Nov 2026): no shipping restrictions, about 200 countries
// (the UK by FedEx in 2-5 working days, duties paid by the buyer), prices in US dollars on every store.
//  - Sunglasses: "Bags & Accessories > Sunglasses" (the sites' own name, L56). The feed's gender decides the site: male ->
//    MGW; female, unisex or none -> WGW (a brand sold mostly to women), unless the name says men's.
//  - Optical and blue-light frames, cases and chains: "Bags & Accessories > Accessories", listed in the report for checking.
//  - Names (dry run 13 Nov 2026): "Kent - Black / Smoke" -> "Kent Sunglasses (Black / Smoke)", "BLUE LIGHT - Rosie" ->
//    "Rosie Blue Light Glasses"; a product with several colours keeps only the frame's name.
//  - The first dry run (13 Nov 2026) had no men's frames (gender female, unisex or empty): all 126 on WGW.
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
const OPTICAL = W(['optical', 'blue ?light', 'frames?', 'computer glasses', 'reading glasses', 'clear lens(?:es)?', 'rx', 'eyeglasses']);
const EXTRAS = W(['cases?', 'chains?', 'straps?', 'cords?', 'cleaning cloths?', 'cloths?', 'pouch(?:es)?']);
const MEN = W(["men'?s", 'mens', 'male', 'for him']);
const WOMEN = W(["women'?s", 'womens', 'ladies', 'female', 'for her']);

const titleCase = s => s.replace(/\b([A-Za-z])([A-Za-z']*)\b/g, (m, a, b) => a.toUpperCase() + b.toLowerCase());
// The feed's titles have parts split by " - " (dry run of 13 Nov 2026): "Kent - Black / Smoke", "BLUE LIGHT - Rosie",
// "Alba - Black - <option>". The kind of glasses can be one part; the first other part is the frame's name, the rest
// are its colour or lens.
const KIND_PART = /^(?:blue ?light(?: glasses)?|sunglass(?:es)?|optical|polari[sz]ed(?: lens(?:es)?)?|eyewear)$/i;

export function nameParts(name) {
  let s = String(name || '').replace(/[®™]/g, '').replace(/\s{2,}/g, ' ').trim().replace(/^otra(?: eyewear)?\s*[-|:]\s*/i, '');
  // Names written in capitals ("KENT - BLACK / SMOKE") read better in title case.
  if (s && s === s.toUpperCase() && /[A-Z]{3}/.test(s)) s = titleCase(s);
  const parts = s.split(/\s+[-–—]\s+/).map(x => x.trim()).filter(Boolean);
  const kinds = parts.filter(x => KIND_PART.test(x));
  const rest = parts.filter(x => !KIND_PART.test(x));
  const blue = /blue ?light/i.test(s);
  const polar = kinds.some(k => /polari/i.test(k));
  let model = (rest[0] || '').replace(/\s*\bblue ?light(?: glasses)?\b\s*/i, ' ').replace(/\s{2,}/g, ' ').trim();
  if (rest.length && rest[0] === rest[0].toUpperCase() && /[A-Z]{3}/.test(rest[0])) model = titleCase(model);
  return { model, extra: rest.slice(1), blue, polar };
}

// "Alba - Black - Polarised" -> "Alba Polarised Sunglasses (Black)"; "BLUE LIGHT - Rosie" -> "Rosie Blue Light Glasses".
export function cardName(name, kind) {
  const { model, extra, blue, polar } = nameParts(name);
  if (!model) return '';
  let n = model;
  if (blue) n += ' Blue Light Glasses';
  else if (kind === 'sunglasses') n += (polar && !/polari/i.test(n) ? ' Polarised' : '') + (/sunglass/i.test(n) ? '' : ' Sunglasses');
  return extra.length ? `${n} (${extra.join(', ')})` : n;
}

// The parts of the title that all colours of one frame share ("Kent - Black / Smoke", "Kent - Tort / Brown" -> "Kent"):
// the planner's own shared-words rule needs 6 letters, and frame names are short.
export function commonName(names) {
  const lists = names.map(n => String(n || '').split(/\s+[-\u2013\u2014]\s+/).map(x => x.trim().toLowerCase()));
  const first = String(names[0] || '').split(/\s+[-\u2013\u2014]\s+/).map(x => x.trim());
  const shared = first.filter((x, i) => lists.every(l => l.includes(x.toLowerCase())));
  return shared.length ? shared.join(' - ') : '';
}

export function displayName(name) {
  return cardName(name, '');
}

export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const raw = String(name || '').trim();
  if (!raw || !nameParts(raw).model) return { reject: 'no name' };
  if (/gift ?card|voucher|e-?gift|shipping protection/i.test(raw)) return { reject: 'gift card or service' };
  if (/replacement lens|lens replacement|prescription lens|insurance|warranty/i.test(raw)) return { reject: 'lens or service, not a product to list' };
  const [gpc = '', gender = ''] = String(awinCategory).split(' | ');
  const all = `${raw} | ${feedCategory} | ${gpc}`;
  const men = /^male$/i.test(gender.trim()) || (MEN.test(raw) && !WOMEN.test(raw));
  const site = men ? 'mgw' : 'wgw';
  if (OPTICAL.test(all) && !/sunglass/i.test(all)) return { site, siteCategory: 'Bags & Accessories', subcategory: 'Accessories', name: cardName(raw, 'optical'), doubt: true };
  if (EXTRAS.test(raw) && !SUNGLASSES.test(raw)) return { site, siteCategory: 'Bags & Accessories', subcategory: 'Accessories', name: cardName(raw, 'extra'), doubt: true };
  if (SUNGLASSES.test(all) || /eyewear|glasses/i.test(all) || !feedCategory) {
    return { site, siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: cardName(raw, 'sunglasses') };
  }
  return { reject: 'not eyewear' };
}
