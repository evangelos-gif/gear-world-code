// Import rules for Buy Sheds Direct (Awin advertiser 25446, buyshedsdirect.co.uk) on Garden Gear World (12 Nov 2026,
// lessons L117). New on every site. Feed 63209 (12 Nov 2026): 1,491 products, all in stock, prices in pounds (from £4.99
// for a fixing kit to £17,799 for a large log cabin), brands Forest Garden 545, Palram Canopia 257, Shire 131, Palmako 113;
// about 100 shop categories ("Greenhouses", "Sheds", "Log Cabins", "Ship PTR Sheds", "Gazebos", "Shed Bases", "Fencing" ...).
//  - Sheds, workshops, garages, bike stores, greenhouses, summerhouses, log cabins, playhouses, storage, fencing, gates,
//    trellis, arches and decking go to "Garden Buildings, Fencing & Storage"; gazebos, canopies and patio covers to
//    "Garden Furniture & Outdoor Living > Parasols, gazebos & shade"; benches and picnic tables to garden furniture;
//    planters and raised beds to "Plants, Growing & Garden Care"; solar lighting kits to "Outdoor Lighting".
//  - Left out: kids' swings and slides and pet houses (not garden gear), and anything without a clear place.
//  - Garden buildings cost thousands: the price limit is £20,000 (a 4.7m x 5.7m log cabin is £6,899 on the shop).
export const RULES = {
  key: 'buysheds',
  advertiserId: 25446,
  retailer: 'Buy Sheds Direct',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?buyshedsdirect\.co\.uk\//i,
  sites: ['ggw'],
  maxPrice: 20000,
  minPrice: 5
};

const BUILD = 'Garden Buildings, Fencing & Storage';
const FURN = 'Garden Furniture & Outdoor Living';

// [category, subcategory, test on the shop category, test on the name] - the first match wins.
const PLACES = [
  ['reject', 'kids\' swings and pet houses are not garden gear', /swings|slides|pet house/i, /\b(swing|slide|kennel|dog house|cat house|hutch)\b/i],
  [FURN, 'Parasols, gazebos & shade', /gazebo|canopy|patio cover|carport/i, /\b(gazebo|canopy|patio cover|carport|pergola canopy)\b/i],
  [FURN, 'Chairs & benches', /bench|chairs?/i, /\b(bench|chair)\b/i],
  [FURN, 'Tables', /tables/i, /\b(picnic table|table)\b/i],
  ['Plants, Growing & Garden Care', 'Pots & planters', /planter|raised bed|grow your own/i, /\b(planter|raised bed|grow bed)\b/i],
  ['Garden Tools', 'Composters', /composter/i, /\bcompost(er)?\b/i],
  ['Outdoor Lighting & Garden Electrical', 'Solar lights', /solar/i, /\bsolar\b.*\b(light|lighting|kit)\b/i],
  [BUILD, 'Greenhouses', /greenhouse|cold frame/i, /\b(greenhouse|cold frame|growhouse|lean.to)\b/i],
  [BUILD, 'Garages & workshops', /garage|workshop/i, /\b(garage|workshop)\b/i],
  [BUILD, 'Summerhouses & log cabins', /log cabin(?! base)|summerhouse|garden office|sun room/i, /\b(log cabin|summerhouse|summer house|garden office|garden room|sun room)\b/i],
  [BUILD, 'Playhouses', /playhouse/i, /\bplayhouse\b/i],
  [BUILD, 'Shed bases & accessories', /base|shed accessor|log cabin accessor|accessories|door cover|brackets/i, /\b(base|base kit|shelving|shelf|floor|guttering|felt|anchor kit|window|door cover)\b/i],
  [BUILD, 'Garden storage', /bike|metal storage|garden storage|storage|tail_tp/i, /\b(bike|cycle|storage|store|chest|box|bin store|log store)\b/i],
  [BUILD, 'Sheds', /\bsheds?\b|ptr|corner shed/i, /\bshed\b/i],
  [BUILD, 'Decking & landscaping', /decking|deck tile|sleeper|edging/i, /\b(decking|deck tile|sleeper|lawn edging)\b/i],
  [BUILD, 'Fencing & screening', /fenc|lattice|trellis|gate|post|gravel board|arch|arbour|pergola|edging|sleeper|decking|deck tile|topper/i,
    /\b(fence|fencing|lattice|trellis|gate|post|gravel board|arch|arbour|pergola|edging|sleeper|decking|deck tile)\b/i]
];

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').trim();
}

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher|installation service|assembly service/i.test(n)) return { reject: 'service or gift card' };
  // The shop category first (most rows have one), then the name.
  for (const [cat, sub, byCategory] of PLACES) if (feedCategory && byCategory.test(feedCategory)) return cat === 'reject' ? { reject: sub } : { site: 'ggw', siteCategory: cat, subcategory: sub };
  for (const [cat, sub, , byName] of PLACES) if (byName.test(n)) return cat === 'reject' ? { reject: sub } : { site: 'ggw', siteCategory: cat, subcategory: sub, doubt: true };
  return { reject: 'no clear place on Garden Gear World' };
}
