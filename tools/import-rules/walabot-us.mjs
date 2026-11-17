// Import rules for Walabot (Awin advertiser 69986, shop.walabot.com, US dollars) on Construction Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 14 rows, 12 pages: the Walabot DIY wall
// scanners (stud, pipe and wire finders for a phone) and their bundles, plus cables, cases and accessory packs (left
// out). CGW Hand Tools holds more than 20,000 products: the scanners go to Site Equipment. Shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'walabot-us',
  advertiserId: 69986,
  retailer: 'Walabot',
  currency: 'USD',
  shop: /^https:\/\/shop\.walabot\.com\//i,
  sites: ['cgw'],
  maxPrice: 400,
  minPrice: 30
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/cable|case\b|accessory|adapter|mount|piece/i.test(n) && !/bundle/i.test(n)) return { reject: 'cable, case or accessory' };
  if (/walabot/i.test(n)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Site Equipment', name: /wall scanner/i.test(n) ? n : `${n} Wall Scanner` };
  return { reject: 'not a wall scanner' };
}
