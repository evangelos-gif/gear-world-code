// Import rules for Garvee (Awin advertiser 52725 "Garvee Innovation Inc", garvee.com, US dollars) on Home Gear World
// and Garden Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 89,995
// rows, 49,336 pages, a marketplace-size catalogue: rugs and floor mats (17,971), furniture (8,398), garden (4,706),
// car and truck parts, tools, toys, pets, fitness, farm and industrial equipment. Only the home and garden groups,
// placed by the shared HGW and GGW words (read on the head of the name), and at most RULES.maxPerSubcategory cards in
// each subcategory (lessons L164), the same ones at every refresh, so Garvee does not bury the other shops. US shop
// (US plugs and sizes): shown only to the US.
import { homePlace, homeName, notHome, OUTDOOR } from './lib/hgw-home.mjs';
import { gardenPlace } from './lib/garden.mjs';
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'garvee-us',
  advertiserId: 52725,
  retailer: 'Garvee',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?garvee\.com\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 3000,
  minPrice: 10,
  maxPerSubcategory: 60
};

const HOME_GROUPS = /^(Furniture(?! > Outdoor)|Home Accessories|Home Textiles|Lighting|Bathrooms & Accessories|Flooring & Carpeting|Home & Garden > (Decor|Linens & Bedding))/i;
const GARDEN_GROUPS = /^(Garden|Home & Garden > (Lawn & Garden|Parasols)|Furniture > Outdoor Furniture)/i;
// A marketplace's long names carry many words ("Outdoor Light Blue & White 9x12 Rug", "Two Piece Toilet ... Light"): the
// place is read on the head of the name (before the first comma or dash), and these words keep a product out whatever
// its group (first dry run, 17 Nov 2026: toilets under Ceiling Light, a sheet sander under Bed Linen, a forklift cage
// under Storage Basket, hunting blinds under Blinds, car bulbs under Light Bulb).
const NOT_OURS = new RegExp('(?<![a-z0-9])(' + ['commercial', 'industrial', 'restaurant', 'garage', 'truck', 'trailer', 'tractor', 'atv', 'utv', 'car', 'cars', 'jeep',
  'vehicle', 'motorcycle', 'boat', 'marine', 'kayak', 'tool box', 'tool chest', 'work ?bench', 'workbench', 'work table', 'saw', 'sander', 'drill', 'welding', 'welder',
  'lift', 'lifting', 'jack', 'hoist', 'forklift', 'heat press', 'sublimation', 'roofing', 'tarp', 'chicken', 'coop', 'incubator', 'livestock', 'hunting', 'deer',
  'treadmill', 'weight plate', 'yoga', 'tanning', 'salon', 'spa', 'massage', 'dog', 'dogs', 'cat', 'cats', 'pet', 'pets', 'kids?', 'toddler', 'baby', 'nursery',
  'toilet', 'bidet', 'sink', 'faucet', 'commode', 'wheelchair', 'medical', 'camping', 'tent', 'cargo', 'headlights?', 'fog lights?', 'bulbs? kit'].join('|') + ')(?![a-z0-9])', 'i');
const headOfName = n => n.split(/\s*[,–|:]\s*|\s+-\s+/)[0];

export function displayName(name) { return homeName(clean(name).replace(/^Garvee\s+/i, '')); }
export function displayBrand() { return 'Garvee'; }

export function classify({ name, feedCategory = '' }) {
  const full = clean(name).replace(/^Garvee\s+/i, '');
  const n = displayName(full);
  if (!n) return { reject: 'no name' };
  const cat = String(feedCategory || '').trim();
  if (NOT_OURS.test(full)) return { reject: 'car, tools, farm, pet, children, bathroom fitting or commercial product (not our home or garden groups)' };
  const head = headOfName(full);
  if (/replacement|spare|table ?skirt|tablecloth|mantel scarf|halloween scarf/i.test(head)) return { reject: 'replacement part or party cloth' };
  if (/vanity lights?|light fixtures?/i.test(head)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Wall Light', name: n };
  if (GARDEN_GROUPS.test(cat) || OUTDOOR.test(head)) {
    if (/\brugs?\b|\bmats?\b/i.test(head)) return { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Cushions & rugs', name: n };
    if (/adirondack|\bchairs?\b/i.test(head) && !/cushion|cover/i.test(head)) return { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Chairs & benches', name: n };
  }
  if (GARDEN_GROUPS.test(cat)) {
    if (/\brugs?\b|\bmats?\b/i.test(head)) return { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Cushions & rugs', name: n };
    const g = gardenPlace(head, cat);
    return g ? { site: 'ggw', ...g, name: n } : { reject: 'no garden place for this name' };
  }
  if (!HOME_GROUPS.test(cat)) return { reject: `Garvee group "${cat || 'none'}" is not one our sites show` };
  if (/floor mat|garage mat|anti-?fatigue|door ?mat|carpet tiles?|flooring|vinyl plank/i.test(full)) return { reject: 'floor mat or flooring' };
  if (OUTDOOR.test(head)) { const g = gardenPlace(head, cat); return g ? { site: 'ggw', ...g, name: n } : { reject: 'outdoor product with no garden place' }; }
  if (notHome(head)) return { reject: 'not a home product' };
  const p = homePlace(head);
  return p ? { site: 'hgw', ...p, name: n } : { reject: 'no home place for this name' };
}
