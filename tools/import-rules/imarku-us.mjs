// Import rules for Imarku (Awin advertiser 78080, feed 108214, imarku.net, US dollars) on Home Gear World (mass import
// round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 127 rows, 106 pages, no folders; kitchen knives, knife
// sets, cast iron skillets and Dutch ovens, frying pans. Shown only to the US (deliversTo Imarku: ['US']).
export const RULES = {
  key: 'imarku-us',
  advertiserId: 78080,
  retailer: 'Imarku',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?imarku\.net\//i,
  sites: ['hgw'],
  maxPrice: 700,
  minPrice: 10
};

export function displayBrand() { return 'imarku'; }

export function classify({ name }) {
  const n = String(name || '').replace(/\s*\|\s*imarku\s*$/i, '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|cleaner|sharpen(er|ing) stone|whetstone|oil\b|warranty|apron/i.test(n)) return { reject: 'cleaner, sharpener or another accessory' };
  if (/\bknif(e|es)\b|cleaver|santoku|nakiri|gyuto|kiritsuke|boning|paring|bread knife|steak knives|knife set|shears/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Kitchen Knives', name: n };
  if (/frying pan|skillet|saute|wok\b/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Frying Pan', name: n };
  if (/dutch oven|pot\b|casserole|saucepan|cookware set|griddle/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Cookware', name: n };
  if (/cutting board|chopping board/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Chopping Board', name: n };
  return { reject: 'not a knife, pan or pot' };
}
