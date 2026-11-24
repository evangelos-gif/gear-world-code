// Import rules for W. Hamond (Rakuten Advertising MID 54390 "W. Hamond", whamond.com, pounds; the Whitby jet jeweller of
// the C.W. Sellors group) on Women's Gear World and Men's Gear World. Wave 1 UK of the massive import (chat 7 sheet
// «Εγκρίσεις» row 545, 22-24 Nov 2026, lessons L224). Catalogue of 22 Nov 2026: 14,753 rows on 9,426 pages, all in stock:
// rings 6,782 (one row per size, " - K"), necklaces 2,738, earrings 1,756, watches 1,463 (Doxa, Ball, Junghans, Seiko,
// Luminox ...), bracelets and bangles 868, charms, brooches, pendants, chains, lockets, jewellery sets, cufflinks and tie
// slides, and gift and home items (Montegrappa pens, Moorcroft vases, trays and jars, Georg Jensen homeware, bronze
// figurines, keyrings, baubles, gift cards).
// C.W. Sellors (MID 54389, row 544) sells the same catalogue on cwsellors.co.uk (5,916 of its 8,123 names are the same):
// only W. Hamond is imported, so the sites do not show every piece twice.
//  - Jewellery to WGW Women's Jewellery (Rings, Necklaces, Earrings, Bracelets; charms, brooches and sets to Jewellery);
//    a piece "for men" or "gents" to MGW Men's Jewellery.
//  - Cufflinks, tie slides and tie pins to MGW Men's Jewellery > Cufflinks.
//  - Watches: "ladies"/"women's" to WGW Watches; the rest to MGW Watches ("Men's Watches" when the name says so).
//  - Pens, vases, homeware, figurines, keyrings, watch straps, cleaning products, baubles and gift cards stay out.
import { withoutOption } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'whamond-uk',
  network: 'rakuten',
  advertiserId: 54390,
  retailer: 'W. Hamond',
  currency: 'GBP',
  shop: /^https?:\/\/(www\.)?whamond\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 25000,
  minPrice: 15,
  commonVariantName: true
};

export function displayBrand(brand) { return String(brand || '').trim(); }
export const displayName = withoutOption;

const MEN = /\b(men'?s|mens|gents?|gentleman'?s|for him)\b/i;
const WOMEN = /\b(ladies|lady'?s|women'?s|womens|for her)\b/i;

export function jewelleryPlace(name, category = '') {
  const n = withoutOption(name);
  const c = String(category || '').toLowerCase();
  const t = `${n} | ${c}`;
  if (!n) return { reject: 'no name' };
  if (/gift ?card|bauble|keyrings?|key ?chain|bookmark|\bpens?\b|ballpen|rollerball|fountain pen|vase|\btray\b|\bjar\b|plaque|\bbowl\b|\bjug\b|\bmug\b|tea ?light|candle|figurine|art in bronze|cake knife|wine (carafe|coaster|glass|cooler|stopper)|carafe|coaster|cocktail|dog tag|pet accessor|watch winder|watch strap|watch accessor|polishing cloth|polishes|cleaning|sparkle dip|travel case|clock|inkwell|tree topper/i.test(t)) {
    return { reject: 'a gift, home or care item, not jewellery or a watch' };
  }
  // A strap on its own ("Garmin Watch Band 22mm", "Garmin Strap QuickFit 20") is not a watch; "Leather Strap Watch" is.
  if (/\bstraps?\b|watch bands?/i.test(n) && !/\bwatch\b/i.test(n.replace(/watch (bands?|straps?)/gi, ''))) return { reject: 'a watch strap, not a watch' };
  if (/\bwatch(es)?\b/i.test(t) && !/watch (strap|band|winder|box)/i.test(t)) {
    if (WOMEN.test(n)) return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches', name: n };
    return { site: 'mgw', siteCategory: 'Watches', subcategory: MEN.test(n) ? "Men's Watches" : 'Watches', name: n };
  }
  if (/cufflinks?|tie (slide|pin|clip|bar)|button studs?/i.test(t)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Cufflinks', name: n };
  const sub = /\brings?\b|wedding band|eternity/i.test(t) ? 'Rings'
    : /earrings?|studs?\b|hoops?\b|huggies/i.test(t) ? 'Earrings'
      : /bracelets?|bangles?|cuff\b/i.test(t) ? 'Bracelets'
        : /necklaces?|pendants?|chains?\b|lockets?|choker/i.test(t) ? 'Necklaces'
          : /charms?|brooch(es)?|lapel pin|\bset\b|jewellery|jewelry/i.test(t) ? 'Jewellery' : '';
  if (!sub) return { reject: 'not jewellery or a watch' };
  if (MEN.test(n) && !WOMEN.test(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub, name: n };
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub, name: n };
}

export function classify({ name, feedCategory = '' }) {
  return jewelleryPlace(name, feedCategory);
}
