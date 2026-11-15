// Import rules for Airdog (Awin advertiser 54965 "Silicon Valley Air Expert Inc.", feed 104351, airdogusa.com, US dollars)
// on Home Gear World (mass import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 82 rows, 31 pages: air
// purifiers (Airdog X3/X5/X8, FitAir, Aircap) and many spare parts, filters, protection plans, one blender. US plugs:
// shown only to the US.
export const RULES = {
  key: 'airdog-us',
  advertiserId: 54965,
  retailer: 'Airdog',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?airdogusa\.com\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  minPrice: 60
};

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/replacement|parts?\b|filter|screen|plate|frame|remote|protection plan|warranty|catalyst|blender|bundle|gift ?card/i.test(n)) return { reject: 'spare part, filter, plan or another product' };
  if (/purifier|fitair|airdog x\d|aircap/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Air Purifier', name: /purifier/i.test(n) ? n : `${n} Air Purifier` };
  return { reject: 'not an air purifier' };
}
