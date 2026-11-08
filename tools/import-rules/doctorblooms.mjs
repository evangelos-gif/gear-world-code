// Import rules for Doctor Blooms (Awin advertiser 26643, feed 66241) on Garden Gear World "Plants, Growing & Garden Care"
// (owner, 8 Nov 2026: "check email and download new feeds and import with one go"). New on every site. Feed facts
// (feed-profile 8 Nov 2026): 1,773 indoor-growing and hydroponics products, all in stock, GBP 0.10 to 13,999.99, shop
// doctorblooms.co.uk, categories Nutrients (577), Grow System (313), Accessories (98), Ducting (64), Carbon Filter (42),
// Propagation Media (28), Grow Tent (26), Water Pump (26), Growing Media (24), Ventilation (23), Environment Control (22),
// brands Alien Hydroponics, Autopot, G.A.S., Dutchpro, Grotek, HydroGarden. A garden visitor compares grow tents, grow
// lights, hydroponic kits, propagators, plant food and growing media; ducting, filters, fans, controllers and loose
// fittings (elbows, drippers, tape) are spare parts for growers who already have a set-up, so they stay out.
// Dry run 8 Nov 2026: "Plant Magic Old Timer Organic Bloom" is a feed (not a timer), "Athena Fade" is in "Fertiliser",
// "CO2 Solenoid" and "LUMATEK LED DRIVER 5m EXTENSION CABLES" are parts.
import { GARDEN_CATEGORIES } from './lib/garden.mjs';

export const RULES = {
  key: 'doctorblooms',
  advertiserId: 26643,
  retailer: 'Doctor Blooms',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?doctorblooms\.co\.uk\//i,
  sites: ['ggw'],
  maxPrice: 2500,
  minPrice: 3,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const PART = words(['ducting', 'duct', 'carbon filters?', 'filters?', 'inline fans?', 'fans?', 'mixed-flow', 'silencers?', 'controllers?', 'thermostats?',
  'digital timers?', 'timer (?:switch|socket|box)(?:es)?', 'contactors?', 'ballasts?', 'reflectors?', 'elbows?', 'drippers?', 'dripper', 'fittings?', 'connectors?',
  'joiners?', 'grommets?', 'tape', 'solenoids?', 'drivers?', 'extension(?: cables?)?', 'cables?', 'leads?', 'control panels?',
  'clips?', 'clamps?', 'hose', 'tubing', 'pipe', 'valves?', 'spares?', 'replacement', 'adapters?', 'ph pens?', 'ec meters?', 'meters?', 'probes?',
  'calibration', 'hangers?', 'rope ratchets?', 'yo-?yos?', 'ozone', 'odour', 'odor', 'neutraliser', 'scissors', 'trimmers?', 'gloves?', 'bags? only']);
const SUBS = [
  ['Grow tents', words(['grow tents?', 'tents?', 'grow rooms?', 'grow box(?:es)?'])],
  ['Grow lights', words(['grow lights?', 'led grow', 'grow lamps?', 'lights?', 'led', 'lamps?', 'cmh', 'hps'])],
  ['Hydroponics', words(['hydroponics?', 'hydro', 'autopot', 'grow systems?', 'wilma', 'ebb (?:and|&) flow', 'nft', 'dwc', 'aeroponic', 'pots? system', 'kits?'])],
  ['Propagation', words(['propagators?', 'propagation', 'heat mats?', 'seed trays?', 'cloning', 'cloner', 'rooting', 'root riot', 'plugs?', 'jiffy', 'rockwool cubes?', 'cubes?'])],
  ['Growing media', words(['coco', 'coir', 'soil', 'compost', 'perlite', 'vermiculite', 'clay pebbles', 'hydroton', 'rockwool', 'growing media', 'substrate', 'potting mix'])],
  ['Plant feed', words(['nutrients?', 'feeds?', 'fertili[sz]ers?', 'boosters?', 'additives?', 'bloom', 'grow a', 'grow b', 'part a', 'part b', 'enzymes?',
    'stimulants?', 'silica', 'cal-?mag', 'pk ?13', 'root', 'roots', 'ph down', 'ph up', 'tonic', 'supplements?', 'bio'])],
  ['Pots & planters', words(['pots?', 'planters?', 'saucers?', 'fabric pots?', 'air pots?', 'trays?', 'containers?'])]
];
const BY_FEED = [
  [/grow tent/i, 'Grow tents'], [/light|lamp|led/i, 'Grow lights'], [/grow system|hydroponic/i, 'Hydroponics'], [/propagat/i, 'Propagation'],
  [/growing media|propagation media|substrate|coco|soil/i, 'Growing media'], [/nutrient|additive|feed|fertili[sz]er/i, 'Plant feed'], [/pots?|planters?/i, 'Pots & planters']
];
const PART_FEED = /ducting|carbon filter|ventilation|environment control|water pump|fans?|meters?|irrigation fittings?|spares?/i;

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|e-?gift/i.test(n)) return { reject: 'gift card, not a product' };
  // A grow tent kit or a hydroponic kit names its parts after "with" or "+": the head says what it is.
  const head = n.split(/\s+(?:with|w\/|incl\.?|including|plus)\s+|\s*[+|(]\s*/i)[0] || n;
  // "CO2 Solenoid - CO2 Kit (Solenoid Only)": a part sold alone is not a kit.
  const kit = /\b(kit|system|complete|bundle|package)\b/i.test(head) && !/\b\w+ only\)/i.test(n);
  if (!kit && (PART.test(head) || PART_FEED.test(feedCategory))) return { reject: 'spare part for an existing grow set-up (ducting, filter, fan, fitting)' };
  let sub = '';
  for (const [label, re] of SUBS) if (re.test(head)) { sub = label; break; }
  if (!sub) for (const [re, label] of BY_FEED) if (re.test(feedCategory)) { sub = label; break; }
  if (!sub) return { reject: 'no growing type in the name or the shop category' };
  return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.plants, subcategory: sub, name: n };
}
