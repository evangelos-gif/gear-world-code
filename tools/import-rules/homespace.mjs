// Import rules for Homespace Direct (Awin advertiser 129637, homespacedirect.com) on Home Gear World, plus its soft toys
// on Kids' Gear World (12 Nov 2026, lessons L117). New on every site. The feed comes only in the Google format
// (129637-retail-en_GB.csv.gz, Awin feed F4557): 2,921 rows = one row per size or colour, 1,683 in stock, prices in pounds.
// Bedding, curtains, rugs, towels, cushions, throws, candles, clocks, lamps, vases, mugs and gifts (brands Homespace Direct,
// Hill Interiors, Gordon John, Catherine Lansfield, Cath Kidston, Country Living ...). Over half the rows have no Google
// category, so the name decides; names are "<product> - <size> / <colour>".
//  - One card per product page, at the lowest in-stock price; the card name is what all options share.
//  - Soft toys and baby comforters go to KGW Toys & Games > Stuffed Animals & Cuddly Toys (the site's own name, L56). Enamel pins, keyrings, cufflink boxes and hip
//    flasks are gifts, not home gear: left out.
import { googleFeedFiles, googleField, stripOption } from './lib/google-feed.mjs';

export const RULES = {
  key: 'homespace',
  advertiserId: 129637,
  retailer: 'Homespace Direct',
  currency: 'GBP',
  shop: /^https:\/\/(checkout\.|www\.)?homespacedirect\.com\//i,
  sites: ['hgw', 'kgw'],
  maxPrice: 1500,
  minPrice: 4,
  commonVariantName: true
};

export const feedFiles = googleFeedFiles(RULES.advertiserId);
export const field = googleField;

// "Homespace Direct", "HomeSpace Direct" and the shop's placeholder "Your Brand" are the shop's own range.
export function displayBrand(brand) {
  const b = String(brand || '').replace(/[®™]/g, '').replace(/\s{2,}/g, ' ').trim();
  if (!b || /^(your brand|home ?space direct)$/i.test(b)) return 'Homespace Direct';
  return b;
}

export function displayName(name) {
  return stripOption(String(name || '').replace(/[®™]/g, '')).replace(/\bpcase\b/gi, 'Pillowcase').replace(/\bH\/W\b/g, 'Housewife')
    .replace(/\s{2,}/g, ' ').replace(/\s+[-,]\s*$/, '').trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
// [category, subcategory, words in the name] - the first match wins, so the order matters.
const PLACES = [
  ['reject', 'garden furniture (for Garden Gear World)', '', W(['outdoor', 'bistro', 'garden furniture', 'sun loungers?', 'corner set', 'parasol'])],
  ['reject', 'gifts, not home gear', '', W(['enamel pin', 'pin badge', 'keyrings?', 'cufflinks?', 'cufflink box', 'hip flask', 'wallet', 'money clip', 'greeting card', 'gift card', 'voucher'])],
  ['hgw', 'Home Decor', 'Christmas', W(['bauble', 'wreath', 'christmas tree', 'advent', 'nativity', 'stocking', 'tree topper'])],
  ['hgw', 'Bedding & Bath', 'Mattress Topper', W(['mattress topper', 'topper'])],
  ['hgw', 'Bedding & Bath', 'Pillow', W(['pillows?(?! ?cases?)', 'pillow pair'])],
  ['hgw', 'Bedding & Bath', 'Duvet', W(['duvet(?! cover| set)', 'quilt(?! cover)', 'tog'])],
  ['hgw', 'Bedding & Bath', 'Bed Sheet', W(['fitted sheets?', 'flat sheets?', '(?<!bath )sheets?', 'valances?'])],
  ['hgw', 'Bedding & Bath', 'Bed Linen', W(['duvet covers?', 'duvet sets?', 'quilt covers?', 'bedding sets?', 'bed sets?', 'pillowcases?', 'pillow cases?', 'bedspreads?', 'coverlets?'])],
  ['hgw', 'Bedding & Bath', 'Bath Mat', W(['bath mats?', 'pedestal mats?', 'bath rugs?'])],
  ['hgw', 'Bedding & Bath', 'Towel', W(['towels?', 'towel bale', 'face cloths?', 'bath sheets?', 'flannels?'])],
  ['hgw', 'Bedding & Bath', 'Bathroom Accessories', W(['soap dispenser', 'toothbrush holder', 'toilet brush', 'shower curtain'])],
  ['hgw', 'Home Decor', 'Curtain', W(['curtains?', 'voiles?', 'tiebacks?', 'curtain pole'])],
  ['hgw', 'Home Decor', 'Blinds', W(['blinds?'])],
  ['hgw', 'Home Decor', 'Rug', W(['rugs?', 'runner rug', 'door ?mats?'])],
  ['hgw', 'Home Decor', 'Cushion', W(['cushions?', 'cushion covers?'])],
  ['hgw', 'Home Decor', 'Throw', W(['throws?', 'blankets?', 'fleece throw'])],
  ['kgw', 'Toys & Games', 'Stuffed Animals & Cuddly Toys', W(['teddy', 'teddy bear', 'plush', 'soft toy', 'comforter', 'cuddly'])],
  ['hgw', 'Home Decor', 'Clock', W(['clocks?', 'alarm clock', 'mantel clock', 'wall clock'])],
  ['hgw', 'Home Decor', 'Mirror', W(['mirrors?'])],
  ['hgw', 'Home Decor', 'Wall Art', W(['wall art', '(?:art|framed|wall|canvas) prints?', 'posters?', 'canvas', 'plaques?', 'signs?', 'hanging heart'])],
  ['hgw', 'Home Decor', 'Home Fragrance', W(['candles?', 'diffusers?', 'room spray', 'wax melts?', 'room spray', 'linen spray', 'fragrance oil'])],
  ['hgw', 'Home Decor', 'Vase', W(['vases?'])],
  ['hgw', 'Lighting', 'Lampshade', W(['lampshades?', 'lamp shades?', 'shades?'])],
  ['hgw', 'Lighting', 'Floor Lamp', W(['floor lamps?'])],
  ['hgw', 'Lighting', 'Table Lamp', W(['table lamps?', 'lamps?', 'lamp base'])],
  ['hgw', 'Home Decor', 'Ornament', W(['ornaments?', 'figurines?', 'sculptures?', 'lanterns?', 'candle holders?', 'tea light holders?', 'photo frames?', 'picture frames?', 'frames?', 'doorstops?', 'statues?', 'trinket', 'plant pots?', 'planters?', 'pots?'])],
  ['hgw', 'Kitchen & Dining', 'Bar Accessories', W(['wine glasses', 'champagne flutes?', 'decanters?', 'cocktail', 'ice bucket'])],
  ['hgw', 'Kitchen & Dining', 'Glassware', W(['glass(?:es)?', 'tumblers?'])],
  ['hgw', 'Kitchen & Dining', 'Drinkware', W(['mugs?', 'cups?', 'teapots?', 'jugs?'])],
  ['hgw', 'Kitchen & Dining', 'Tableware', W(['bowls?', 'plates?', 'dish', 'butter dish', 'cake stand', 'serving', 'trays?', 'coasters?', 'placemats?', 'platter'])],
  ['hgw', 'Storage & Organisation', 'Storage Basket', W(['baskets?', 'hampers?'])],
  ['hgw', 'Storage & Organisation', 'Storage Box', W(['storage box', 'storage', 'boxes', 'box'])]
];

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  for (const [site, cat, sub, re] of PLACES) {
    if (!re.test(n)) continue;
    if (site === 'reject') return { reject: cat };
    return { site, siteCategory: cat, subcategory: sub };
  }
  // No clear word in the name: the Google category, when it says plainly what the product is.
  for (const [re, cat, sub] of BY_GOOGLE) if (re.test(feedCategory)) return { site: 'hgw', siteCategory: cat, subcategory: sub, doubt: true };
  return { reject: 'no clear place on Home Gear World' };
}

const BY_GOOGLE = [
  [/>\s*Rugs$/i, 'Home Decor', 'Rug'],
  [/Curtains/i, 'Home Decor', 'Curtain'],
  [/Bath Mats/i, 'Bedding & Bath', 'Bath Mat'],
  [/Duvet Covers|Bedding$/i, 'Bedding & Bath', 'Bed Linen'],
  [/Quilts & Duvets/i, 'Bedding & Bath', 'Duvet'],
  [/Towels/i, 'Bedding & Bath', 'Towel'],
  [/Throw Pillows/i, 'Home Decor', 'Cushion'],
  [/Clocks/i, 'Home Decor', 'Clock'],
  [/Posters, Prints|Artwork/i, 'Home Decor', 'Wall Art'],
  [/Picture Frames/i, 'Home Decor', 'Ornament'],
  [/Lighting > Lamps/i, 'Lighting', 'Table Lamp']
];
