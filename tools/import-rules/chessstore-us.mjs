// Import rules for The Chess Store (Awin advertiser 88289, thechessstore.com, US dollars) on Kids Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 2,308 products: chess sets, boards,
// pieces, clocks, boxes and bags, some collector sets up to $2,900. KGW keeps chess in Toys & Games > Board Games; only
// sets, boards, pieces and clocks up to RULES.maxPrice, at most RULES.maxPerSubcategory of them (lessons L164).
// US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'chessstore-us',
  advertiserId: 88289,
  retailer: 'The Chess Store',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?thechessstore\.com\//i,
  sites: ['kgw'],
  maxPrice: 400,
  minPrice: 8,
  maxPerSubcategory: 150
};

// The feed's links are http://: the card links to the https page.
export function field(c, column) {
  const v = column(c);
  return c === 'merchant_deep_link' ? String(v || '').replace(/^http:\/\//i, 'https://') : v;
}

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/\bbox\b|bag\b|case\b|gift ?card|book\b|dvd|software|replacement|extra queens? only|polish|felt/i.test(n) && !/chess set|with .* (case|box)/i.test(n)) return { reject: 'box, bag, book or spare piece' };
  if (/chess|checkers|draughts|backgammon|go set|clock/i.test(n)) return { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Board Games', name: n };
  return { reject: 'not a chess set, board or clock' };
}
