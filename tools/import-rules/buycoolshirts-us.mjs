// Import rules for Buycoolshirts (Awin advertiser 77304 "Buycoolshirts.com", buycoolshirts.com, US dollars) on Men's Gear
// World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 48,709 graphic tees in 210
// shop groups, most of them film, TV, band, comic and cartoon merchandise (Batman, Star Trek, AC/DC ...). Only the plain
// sport, yoga, fitness and tie-dye groups go in (no characters, artists or slogans), men's and unisex adult
// sizes only, and at most RULES.maxPerSubcategory cards per subcategory (lessons L164). Shown only to the US.
import { clean, audience, menClothSub, CHARACTER } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'buycoolshirts-us',
  advertiserId: 77304,
  retailer: 'Buycoolshirts',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?buycoolshirts\.com\//i,
  sites: ['mgw'],
  maxPrice: 120,
  minPrice: 10,
  maxPerSubcategory: 120
};

export const GROUPS = /^(Athletic Clothing|Yoga Shirts for Men|Fitness Shirts|Workout Clothing - Penguin Power T-shirts|Tie Dye T-shirts|Sports T-shirts)$/i;

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (!GROUPS.test(clean(feedCategory))) return { reject: 'film, TV, band, character or slogan merchandise (left out)' };
  if (CHARACTER.test(n)) return { reject: 'character merchandise' };
  const who = audience(n);
  if (who === 'kids' || who === 'women' || /juniors?|ladies|racerback|youth|toddler|infant|onesie|romper/i.test(n)) return { reject: "women's or children's size" };
  if (/\bhats?\b|\bcaps?\b|mugs?|stickers?|magnets?|socks?|bags?/i.test(n)) return { reject: 'not clothing' };
  const sub = menClothSub(n, null);
  if (!sub) return { reject: 'not clothing the site lists' };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub, name: n };
}
