// Import rules for eFootwear (Awin advertiser 90809 "eFootwear.com", efootwear.com, US dollars) on Men's Gear World and
// Women's Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 1,186 shoes of
// known makers (Adidas, Asics, Hoka, Under Armour, Hey Dude ...) from an authorised US shoe shop, the audience in the
// name ("Men's", "Women's", "Mens"). Children's shoes and accessories left out. Shown only to the US (US sizes).
import { clean, audience, shoeSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'efootwear-us',
  advertiserId: 90809,
  retailer: 'eFootwear',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?efootwear\.com\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 400,
  minPrice: 15
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/socks?|laces?|insoles?|cleaner|spray|shoe care|gift ?card|bag\b|backpack|hat\b|cap\b/i.test(n)) return { reject: 'accessory' };
  const who = audience(n);
  if (who === 'kids') return { reject: "children's shoes" };
  const site = who === 'women' ? 'wgw' : (who === 'men' ? 'mgw' : null);
  if (!site) return { reject: "men's or women's? (not said)" };
  return { site, siteCategory: 'Shoes', subcategory: shoeSub(n, site), name: n };
}
