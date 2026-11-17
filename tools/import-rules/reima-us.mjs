// Import rules for Reima (Awin advertiser 92285, us.reima.com, US dollars) on Kids Gear World. Wave 3 (approvals file of
// chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 6,626 rows (one per size and colour), 244 pages of Finnish
// children's outdoor clothing: snowsuits, winter jackets, ski pants, rain and UV clothing, swimwear, base layers, hats,
// mittens and winter boots. Shown only to the US (the US shop).
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'reima-us',
  advertiserId: 92285,
  retailer: 'Reima',
  currency: 'USD',
  shop: /^https:\/\/us\.reima\.com\//i,
  sites: ['kgw'],
  maxPrice: 400,
  minPrice: 8
};

export function displayBrand() { return 'Reima'; }

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|reflector|laces?|insoles?|spare|replacement|wash|detergent/i.test(n)) return { reject: 'gift card or small accessory' };
  if (/boots?|shoes?|sneakers?|sandals?|wellies|rubber boots?/i.test(n)) return { site: 'kgw', siteCategory: 'Shoes', subcategory: /winter|snow|insulated|tec/i.test(n) ? 'Winter Boots' : 'Shoes', name: n };
  if (/socks?/i.test(n)) return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Socks', name: n };
  if (/hat\b|beanie|balaclava|mittens?|gloves?|scarf|neck warmer|cap\b/i.test(n)) return { site: 'kgw', siteCategory: 'Accessories', subcategory: 'Accessories', name: n };
  return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Clothing', name: n };
}
