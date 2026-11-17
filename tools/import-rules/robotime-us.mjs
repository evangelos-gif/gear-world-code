// Import rules for Robotime (Awin advertiser 93543 "Robotimeonline", robotimeonline.com, US dollars) on Kids Gear World.
// Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 525 rows, 376 pages: Rolife DIY
// miniature houses and 3D wooden puzzles (Toy Craft Kits), ROBUD wooden play kitchens, doll furniture and toddler toys,
// and laser-cutting plywood sheets (left out). US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'robotime-us',
  advertiserId: 93543,
  retailer: 'Robotime',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?robotimeonline\.com\//i,
  sites: ['kgw'],
  maxPrice: 400,
  minPrice: 8
};

export function displayName(name) { return clean(name).replace(/\s*[一-鿿]+\s*/g, ' 1 ').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const t = sub => ({ site: 'kgw', siteCategory: 'Toys & Games', subcategory: sub, name: n });
  if (/plywood|display box|storage box|dust cover|sheets? for laser|glue|paint set only|replacement|gift ?card|led kit only|dust cover/i.test(n)) return { reject: 'craft material or spare part' };
  if (/kitchen|play food|tea set|cooking/i.test(n)) return t('Toy Kitchens & Play Food');
  if (/doll/i.test(n)) return t('Dolls');
  if (/puzzle/i.test(n)) return t('Jigsaw Puzzles');
  if (/tool bench|workbench|tool set/i.test(n)) return t('Toy Tools');
  if (/miniature|dollhouse|doll house|diy|model kit|music box|marble run|mechanical|3d wooden|book nook|kit\b|series\b/i.test(n)) return t('Toy Craft Kits');
  if (/baby|toddler|stacking|rocking|walker|activity/i.test(n)) return { site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: 'Baby Activity Toys', name: n };
  return { reject: 'not a toy or craft kit the site lists' };
}
