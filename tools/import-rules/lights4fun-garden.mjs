// Import rules for Lights4fun (Awin advertiser 1531) garden lighting on Garden Gear World.
// Lights4fun is new on every site. Its feed is mostly fairy lights and seasonal decorations; this plan takes only the
// OUTDOOR lighting for GGW "Outdoor Lighting & Garden Electrical" (festoon and string lights, solar lights, lanterns,
// path and wall lights, parasol lights). Christmas and Halloween decorations and indoor lights are left out (a later
// plan can place them on Home Gear World).
// Feed facts (gw-feed-gaps 23 Oct 2026): 2,628 rows, merchant_category is a number ("594", "2608", "2956"), the Awin
// category_name is "Lighting" (2,352) or "Garden & Leisure" (276), no currency column (programme in GBP).
// Mistakes in the gw-feed-gaps scan that this file avoids: "Leyburn Dual LED Rattan Set of 4 Light Up Reindeer Family"
// counted as rattan furniture, "80 Warm White LED Battery Operated Parasol Lights" as a parasol, "Pre Lit Winter Log
// Cabin Wooden House Scene" as a garden building.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { GARDEN_CATEGORIES } from './lib/garden.mjs';

export const RULES = {
  key: 'lights4fun-garden',
  advertiserId: 1531,
  retailer: 'Lights4fun',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?lights4fun\.co\.uk\//i,
  sites: ['ggw'],
  maxPrice: 2000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

const SEASONAL = words(['christmas', 'xmas', 'santa', 'reindeer', 'stag', 'snowman', 'snowmen', 'snowflake', 'snowflakes', 'elf', 'elves', 'nativity', 'advent',
  'halloween', 'pumpkin', 'pumpkins', 'skeleton', 'ghost', 'witch', 'spider', 'wreath', 'wreaths', 'garland', 'garlands', 'bauble', 'baubles', 'tree topper',
  'star', 'stars', 'angel', 'angels', 'penguin', 'polar bear', 'gingerbread', 'candy cane', 'present', 'presents', 'easter', 'valentine', 'valentines', 'festive',
  'winter', 'village', 'scene', 'figure', 'figures', 'decoration', 'decorations', 'nutcracker', 'robin', 'holly', 'mistletoe', 'poinsettia']);
const INDOOR = words(['indoor', 'bedroom', 'nursery', 'kids', 'table lamp', 'desk lamp', 'ceiling', 'pendant', 'lampshade', 'bottle', 'bottles', 'jar', 'jars',
  'window', 'curtain', 'canvas', 'mirror', 'cake', 'book', 'neon', 'headboard', 'shelf', 'cabinet', 'room fragrance', 'fragrance', 'candle', 'candles', 'wax',
  'usb', 'type c', 'type-c', 'smart plug', 'plug-in', 'plug in']);
const LIGHT = words(['light', 'lights', 'lighting', 'lantern', 'lanterns', 'festoon', 'lamp', 'lamps', 'bulb', 'bulbs', 'spotlight', 'spotlights', 'floodlight',
  'floodlights', 'uplighter', 'uplighters', 'downlighter', 'torch', 'torches', 'fairy lights', 'string lights']);
const OUTSIDE = words(['outdoor', 'outdoors', 'outside', 'garden', 'patio', 'solar', 'festoon', 'parasol', 'path', 'pathway', 'stake', 'stakes', 'spike', 'spikes',
  'fence', 'decking', 'deck', 'balcony', 'pergola', 'gazebo', 'umbrella', 'ip44', 'ip65', 'ip66', 'ip67', 'waterproof', 'weatherproof', 'tree lights', 'hedge', 'driveway']);
// Parts for an outdoor lighting system (poles, extension cables, timers) count when the name says festoon or outdoor.
const ACCESSORY = words(['pole', 'poles', 'cable', 'cables', 'extension', 'connector', 'connectors', 'splitter', 'timer', 'transformer', 'clip', 'clips', 'hook',
  'hooks', 'kit', 'stand', 'wire', 'remote control']);

const SUBS = [
  ['Lighting accessories', words(['pole', 'poles', 'cable', 'cables', 'extension', 'connector', 'connectors', 'splitter', 'timer', 'transformer', 'clip', 'clips', 'hook', 'hooks', 'remote control'])],
  ['Solar lights', words(['solar'])],
  ['Floodlights & security lights', words(['floodlight', 'floodlights', 'flood light', 'security light', 'security lights', 'pir'])],
  ['String & festoon lights', words(['festoon', 'string lights', 'string light', 'fairy lights', 'connectable', 'connect', 'parasol lights', 'tree lights', 'net lights', 'icicle'])],
  ['Lanterns', words(['lantern', 'lanterns'])],
  ['Path & spike lights', words(['path', 'pathway', 'stake', 'stakes', 'spike', 'spikes', 'bollard', 'post light'])],
  ['Wall lights', words(['wall light', 'wall lights', 'wall lantern', 'up and down', 'uplighter'])]
];

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, awinCategory = '' }) {
  const n = String(name || '');
  if (SEASONAL.test(n)) return { reject: 'Christmas, Halloween or other seasonal decoration (not for the garden site)' };
  if (INDOOR.test(n)) return { reject: 'indoor light or not a light (fragrance, plug, candle)' };
  const outside = OUTSIDE.test(n) || /garden/i.test(String(awinCategory || ''));
  if (!outside) return { reject: 'light without an outdoor word in the name' };
  if (!LIGHT.test(n) && !ACCESSORY.test(n)) return { reject: 'outdoor product but not a light or a lighting part' };
  // "Festoon Lights ... Black Cable" is a light; "Set of 5 Festoon Poles" is a part.
  const isLight = /\b(lights?|lighting|lanterns?|lamps?|bulbs?|spotlights?|floodlights?)\b/i.test(n);
  let sub = 'Outdoor lights';
  for (const [label, re] of SUBS) if ((label !== 'Lighting accessories' || !isLight) && re.test(n)) { sub = label; break; }
  return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.lighting, subcategory: sub };
}
