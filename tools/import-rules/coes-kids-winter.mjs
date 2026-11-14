// Import rules for Coes (Awin advertiser 30645) children's winter boots and wellies on Kids' Gear World: the new
// subcategory Shoes > Winter Boots (Manager, plan of 14 Nov 2026 17:10: "no boys' boots on Kids and it is winter").
// Coes is already on KGW (coes-kids.mjs, 50 shoes in Shoes > Shoes, most of them football, rugby, hockey and cricket boots).
// This plan is ADD-ONLY: it moves only the winter boots and wellies (Olang BMX, Olang Patty, Dunlop JR and 16247
// wellingtons in the feed of 14 Nov 2026) to Winter Boots, with the same product key as coes-kids, and leaves every other
// Coes product on KGW as it is. Sports boots stay where they are.
export const RULES = {
  key: 'coes-kids-winter',
  advertiserId: 30645,
  retailer: 'Coes',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?coes\.co\.uk\//i,
  sites: ['kgw'],
  maxPrice: 500,
  addOnly: true
};

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
export const KIDS = W(['junior', 'juniors', 'jnr', 'jr', 'kids', "kid's", 'kid', 'boys', "boy's", 'girls', "girl's", 'child', 'children', "children's", 'youth',
  'infant', 'infants', 'toddler', 'toddlers']);
export const WINTER_BOOTS = W(['boots?', 'booties', 'wellies', 'welly', 'wellie', 'wellingtons?', 'snow ?boots?']);
// Boots for a sport are not winter boots: football (FG, MG, AG, SG, turf, astros), rugby, cricket, hockey, golf.
export const SPORT = W(['football', 'rugby', 'cricket', 'hockey', 'golf', 'fg', 'mg', 'ag', 'sg', 'tf', 'turf', 'astros?', "astro's", 'firm ground', 'soft ground',
  'multi-ground', 'artificial grass', 'spikes?', 'predator', 'copa', 'f50', 'furion', 'tekela', 'stampede', 'phoenix', 'speed infinite']);
const ADULT = W(["women'?s", 'womens', 'ladies', "men'?s", 'mens']);

export function classify({ name, brand = '' }) {
  let n = String(name || '');
  const b = String(brand || '').trim();
  if (b.length >= 3 && n.toLowerCase().startsWith(b.toLowerCase() + ' ')) n = n.slice(b.length + 1);
  if (!KIDS.test(n) || ADULT.test(n)) return { reject: 'not a children\'s product (add-only plan: only kids\' winter boots and wellies)' };
  if (!WINTER_BOOTS.test(n)) return { reject: 'not a boot or welly (add-only plan: the rest of Coes on KGW stays as it is)' };
  if (SPORT.test(n)) return { reject: 'a sports boot (football, rugby, cricket, hockey): it stays in Shoes' };
  return { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' };
}
