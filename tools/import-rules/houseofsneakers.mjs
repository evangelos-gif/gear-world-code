// Import rules for House of Sneakers (Awin advertiser 114336, "House-of-Sneakers DE") on Men's, Women's and Kids' Gear
// World. Joined 10 Nov 2026; the shop wrote on 10 Nov that it ships free worldwide, with no minimum order, and has prices
// in pounds for the UK (lessons L116). Feed facts (awin-feed-sample of 11 Nov 2026): 9 feeds, 309,539 rows = one row per
// size; EUR 242,658, USD 33,581, GBP 33,300 (the GBP feed is 118232); no shop categories at all; every row in stock;
// delivery 0; brands Nike 160,079, Air Jordan 109,933, Adidas 27,513, New Balance 7,355, Birkenstock 2,075, Timberland 939,
// On 520, ASICS 360, Vans 354, Maison Mihara Yasuhiro 204, Puma 117, Crocs 90. Names are English ("Air Jordan 1 Low SE
// Light Smoke Grey Gym Red"); colours are German ("Grau/Rot"); the page is house-of-sneakers.de/products/<handle>?variant=.
//   - Only the pound feed is read: the same page is in every currency feed, and a card mixing euro and pound rows would
//     be refused whole ("currency EUR, expected GBP").
//   - One card per page (all sizes), at the lowest size price, as every shoe shop.
//   - Women's shoes ("damen", "womens", "(W)", "Wmns" in the page or the name) go to WGW; children's sizes ("(GS)", "(PS)",
//     "(TD)", "kids", "kinder", "baby") to KGW; every other shoe (men's and unisex) to MGW. All in Shoes > Trainers, except
//     sandals, slides, clogs and boots by their own word.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const RULES = {
  key: 'houseofsneakers',
  advertiserId: 114336,
  retailer: 'House of Sneakers',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?house-of-sneakers\.[a-z.]{2,10}\//i,
  sites: ['mgw', 'wgw', 'kgw'],
  maxPrice: 3000,
  minPrice: 15
};

// The pound feed only (see above).
export const GBP_FEED_IDS = [118232];
export function feedFiles(archive) {
  const out = [];
  for (const id of GBP_FEED_IDS) {
    for (const ext of ['.csv.gz', '.csv']) {
      const f = join(archive, `AWIN_${RULES.advertiserId}_${id}${ext}`);
      if (existsSync(f)) { out.push(f); break; }
    }
  }
  return out;
}

const KIDS = /\((gs|ps|td|bp|kids?)\)|\b(gs|ps|td)\b\s*$|(^|[\s/_-])(kids?|kinder|toddlers?|infants?|baby|junior|youth|grade school|preschool)([\s/_-]|$)/i;
const WOMEN = /\((w|wmns|womens?)\)|(^|[\s/_-])(wmns|womens?|women's|damen|ladies)([\s/_-]|$)/i;

const pageOf = url => { try { return decodeURIComponent(new URL(url).pathname).toLowerCase(); } catch { return ''; } };

export function displayBrand(brand) {
  const b = String(brand || '').replace(/\s{2,}/g, ' ').trim();
  return /^adidas$/i.test(b) ? 'adidas' : b;
}

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').trim();
}

export function classify({ name, url = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|gutschein|voucher/i.test(n)) return { reject: 'gift card' };
  // Shoe care, laces and socks are not shoes; the shop sells shoes only, but keep the sites clean.
  // "Laces" (a pair of spare laces) is not a shoe, but "Nike Wmns Dunk Low Lace Pack" is (dry run of 12 Nov 2026).
  if (/\b(socks?|shoe ?laces|laces|shoe cleaner|cleaning kit|insoles?)\b/i.test(n)) return { reject: 'not a shoe' };
  const page = pageOf(url);
  const text = `${n} ${page.replace(/[-_/]+/g, ' ')}`;
  const site = KIDS.test(text) ? 'kgw' : (WOMEN.test(text) ? 'wgw' : 'mgw');
  const sub = /\b(slides?|sandals?|clogs?|mules?|flip.?flops?)\b/i.test(n) ? 'Sandals'
    : /\bboots?\b/i.test(n) ? 'Boots' : 'Trainers';
  return { site, siteCategory: 'Shoes', subcategory: sub };
}
