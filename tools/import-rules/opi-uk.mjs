// Import rules for OPI UK (Rakuten Advertising MID 47972 "OPI UK", opi.com/en-GB, pounds) on Women's Gear World. Wave 1
// UK of the massive import (chat 7 sheet «Εγκρίσεις» row 146, 22-24 Nov 2026, lessons L224). Catalogue of 22 Nov 2026:
// 239 rows, all in stock: nail lacquers (Nail Lacquer, Infinite Shine, RapiDry, Nature Strong) 191, treatments and
// strengtheners 12, top and base coats 9, press-on nails (xPRESS/ON) 10, removers, drying drops, gift sets, and hand and
// foot care ("Hands & Feet") 10. Each name ends with the shop's category ("... Nail Polish Nail Lacquer Classics"):
// the card name stops before it.
//  - Everything for nails to WGW Beauty & Fragrances > Nails; gift sets to Gift sets; hand and foot creams, scrubs and
//    soaks to Bath & body (cuticle oils and serums are nails).
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'opi-uk',
  network: 'rakuten',
  advertiserId: 47972,
  retailer: 'OPI UK',
  currency: 'GBP',
  shop: /^https?:\/\/(www\.)?opi\.com\/en-gb\//i,
  sites: ['wgw'],
  maxPrice: 100,
  minPrice: 4
};

export function displayBrand() { return 'OPI'; }

// Each name is "<product> <shop category> <collection>" ("OPI Berlin There Done That Nail Polish Nail Lacquer Classics",
// "OPI Repair Mode Bond Building Nail Serum Treatments & Strengtheners Treatments & Strengtheners"): the card name stops at
// the first place where the shop's category follows at least 3 words. RapiDry names lose the word with the category, so
// they get "RapiDry Nail Polish" back.
export function cardName(name, category = '') {
  const n = clean(name).replace(/™/g, '');
  const cat = String(category || '').replace(/™/g, '').trim();
  if (!cat) return n;
  const low = n.toLowerCase(), c = cat.toLowerCase();
  for (let i = low.indexOf(c); i > 0; i = low.indexOf(c, i + 1)) {
    const before = n.slice(0, i).replace(/[\s\-–|,]+$/, '').trim();
    if (before.split(/\s+/).length >= 3) return /^rapidry$/i.test(cat) ? `${before} RapiDry Nail Polish` : before;
  }
  return n;
}

export function classify({ name, feedCategory = '' }) {
  const n = cardName(name, feedCategory);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|\bsample\b|\btester\b/i.test(n)) return { reject: 'gift card or sample' };
  const b = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n });
  if (/gift set|\d-piece|\bset\b|\bkit\b|\btrio\b|\bduo\b/i.test(n) || /gift sets/i.test(feedCategory)) return b('Gift sets');
  if (/hand (&|and) foot|hand cream|foot cream|\bscrub\b|pedi soak|\blotion\b/i.test(n) && !/cuticle|nail/i.test(n)) return b('Bath & body');
  return b('Nails');
}
