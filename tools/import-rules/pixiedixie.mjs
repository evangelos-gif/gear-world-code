// Import rules for Pixie Dixie (Awin advertiser 120435, pixiedixie.co.uk) on Kids' Gear World (12 Nov 2026, lessons L117).
// New on every site. The feed comes only in the Google format (120435-retail-en_GB.csv.gz, Awin feed F1662): 133 rows =
// one row per age, 127 in stock, prices in pounds (£20-£30); children's cotton pyjamas, nightdresses and baby sleepsuits,
// names "<product> - <age> / <print> / <colour>" ("Animal Sleepsuit - 0-3mths / Animal / White").
//  - One card per product page (all ages), at the lowest in-stock price; the card name is what all ages share.
//  - Baby sleepsuits and rompers: Baby & Toddler > Baby & Toddler Sleepwear. Pyjamas and nightdresses: Clothing >
//    Nightwear & Loungewear. Cotton baby blankets: Baby & Toddler > Receiving Blankets.
import { googleFeedFiles, googleField, stripOption } from './lib/google-feed.mjs';

export const RULES = {
  key: 'pixiedixie',
  advertiserId: 120435,
  retailer: 'Pixie Dixie',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?pixiedixie\.co\.uk\//i,
  sites: ['kgw'],
  maxPrice: 200,
  minPrice: 5,
  commonVariantName: true
};

export const feedFiles = googleFeedFiles(RULES.advertiserId);
export const field = googleField;

export function displayBrand() { return 'Pixie Dixie'; }

export function displayName(name) {
  return stripOption(name);
}

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher/i.test(n)) return { reject: 'gift card' };
  if (/\b(sleepsuit|romper|babygrow|sleeping bag|bodysuit)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby & Toddler Sleepwear' };
  if (/\b(blankets?|comforter)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Receiving Blankets' };
  if (/\b(pyjamas?|pajamas?|nightdress|nightie|nightshirt|dressing gown|robe|lounge)\b/i.test(n)) return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Nightwear & Loungewear' };
  return { reject: 'no clear place on Kids\' Gear World' };
}
