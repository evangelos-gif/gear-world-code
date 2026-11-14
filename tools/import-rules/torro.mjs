// Import rules for TORRO (Awin advertiser 24751, torro.co.uk, British leather goods) on Men's Gear World (14 Nov 2026).
// Joined 13 Nov 2026, feed 59811: 432 rows ("<product> - <colour>"), pounds, all in stock. Most rows (about 320) are
// leather cases for phones, tablets and Kindles: they belong on Technology Gear World, which has its own import (next
// round), so they stay out here. MGW takes the leather accessories:
//  - wallets, card holders, money clips, coin purses -> Bags & Accessories > Wallets & Purses (MGW's own names, L56)
//  - bags, backpacks, laptop bags, duffles, suit carriers, wash bags -> Bags & Accessories > Bags
//  - passport holders, travel wallets, watch straps, golf scorecard and tee holders -> Bags & Accessories > Accessories
//  - keyrings (also AirTag keyrings) -> Everyday Carry / EDC
//  - Out: device cases and screen protectors (TGW), desk mats, coasters, folders, notebooks, care kits and cloths.
export const RULES = {
  key: 'torro',
  advertiserId: 24751,
  retailer: 'TORRO',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?torro\.co\.uk\//i,
  sites: ['mgw'],
  maxPrice: 400,
  minPrice: 10,
  commonVariantName: true
};

export function displayBrand() { return 'TORRO'; }
// "Slim Leather Card Holder - Black with Red Detail" (one colour only): the colour is an option, not the product name.
const COLOUR = /\s+-\s+(?:(?:Black|Dark Brown|Navy Blue|Tan|Red|Blue|Grey|Brown|Green|Burgundy)(?: with (?:Red|Brown|Blue) Detail)?|Default Title)\s*$/i;
export function displayName(name) { return String(name || '').replace(COLOUR, '').replace(/\s{2,}/g, ' ').trim(); }

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const DEVICE = W(['cases?', 'covers?', 'sleeves?', 'folios?', 'screen protectors?', 'iphone', 'ipad', 'galaxy', 'pixel', 'kindle', 'macbook', 'airpods']);
const OUT = W(['desk mats?', 'desk pads?', 'coasters?', 'folders?', 'portfolios?', 'notebooks?', 'refills?', 'care kit', 'wipes', 'cleaning cloth', 'gift cards?']);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const acc = { site: 'mgw', siteCategory: 'Bags & Accessories' };
  // Golf first: "Leather Golf Scorecard Holder and Yardage Book Cover" is not a device cover (dry run 14 Nov 2026, L132).
  if (W(['golf']).test(n)) return { ...acc, subcategory: 'Accessories' };
  // "iPhone 17 Leather Wallet Case" is a phone case (first plan, 14 Nov 2026: 8 went to Wallets).
  if (DEVICE.test(n) && W(['cases?', 'covers?', 'screen protectors?', 'sleeves?', 'folios?']).test(n)) return { reject: 'case or screen protector for a device (Technology Gear World next)' };
  if (W(['watch straps?', 'watch bands?', 'strap']).test(n) && /watch/i.test(n)) return { ...acc, subcategory: 'Accessories' };
  if (W(['keyrings?', 'key rings?', 'keychains?', 'key holders?']).test(n)) return { site: 'mgw', siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC' };
  if (W(['passport', 'travel wallet', 'travel document']).test(n)) return { ...acc, subcategory: 'Accessories' };
  if (W(['wallets?', 'card holders?', 'money clips?', 'coin purses?', 'cardholders?']).test(n)) return { ...acc, subcategory: 'Wallets & Purses' };
  if (W(['bags?', 'backpacks?', 'duffle', 'duffel', 'holdall', 'suit carrier', 'briefcase', 'messenger']).test(n) && !W(['phone case']).test(n)) return { ...acc, subcategory: 'Bags' };
  if (DEVICE.test(n) || /phone|tablet|e-book|screen protector/i.test(feedCategory)) return { reject: 'case or screen protector for a device (Technology Gear World next)' };
  if (OUT.test(n)) return { reject: 'desk, office or care item (not a men\'s accessory)' };
  return { reject: 'not sure what it is' };
}
