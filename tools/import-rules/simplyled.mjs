// Import rules for Simply LED (Awin advertiser 5190, feed 48033) on Home Gear World "Lighting" and Garden Gear World
// "Outdoor Lighting & Garden Electrical" (owner, 8 Nov 2026: "feed download and import"). New on every site.
// Feed facts (feed-profile 8 Nov 2026): 3,289 products, all in stock, GBP, shop simplyled.co.uk, Google categories
// "Home & Garden > Lighting > Lighting Fixtures > Wall/Ceiling ...", "... > Light Bulbs > LED Light Bulbs",
// "... > In-Ground Lights", "... > Landscape Pathway Lighting", "... > Flood & Spot Lights", brands Crompton Lamps,
// Firstlight, Zink, Phoebe LED, Spa, Opus, Culina. Outdoor lights go to GGW (the same words as Lights4fun, lessons L14),
// indoor lights and bulbs to HGW, in the subcategories HGW already has (live HGW database 8 Nov 2026: Pendant Light,
// Table Lamp, Wall Light, Floor Lamp, Lampshade, Chandelier, Ceiling Light, Light Bulb). Commercial fittings (high bay,
// emergency, exit signs) and loose parts (drivers, switches, cables) are not home lights and stay out.
import { GARDEN_CATEGORIES } from './lib/garden.mjs';

export const RULES = {
  key: 'simplyled',
  advertiserId: 5190,
  retailer: 'Simply LED',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?simplyled\.co\.uk\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 1000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const SEASONAL = words(['christmas', 'xmas', 'santa', 'reindeer', 'snowman', 'snowflake', 'halloween', 'pumpkin', 'nativity', 'advent']);
const COMMERCIAL = words(['high bay', 'highbay', 'emergency', 'exit sign', 'exit', 'maintained', 'non-maintained', 'corn lamp', 'troffer']);
const PART = words(['driver', 'drivers', 'transformer', 'switch', 'switches', 'dimmer', 'cable', 'connector', 'connectors', 'junction box', 'mounting kit',
  'bracket', 'end cap', 'end caps', 'diffuser', 'clip', 'clips', 'remote control', 'sensor head', 'replacement glass', 'lens']);
const LIGHT = words(['light', 'lights', 'lighting', 'lamp', 'lamps', 'bulb', 'bulbs', 'downlight', 'downlights', 'spotlight', 'spotlights', 'floodlight',
  'floodlights', 'lantern', 'lanterns', 'chandelier', 'pendant', 'uplighter', 'uplighters', 'bollard', 'batten', 'panel', 'strip', 'tape', 'festoon', 'gu10',
  'gu5.3', 'mr16', 'b22', 'e27', 'e14', 'b15', 'g9', 'r7s', 'gls', 'candle', 'golfball', 'filament']);
const OUTSIDE = words(['outdoor', 'outdoors', 'outside', 'exterior', 'garden', 'patio', 'solar', 'festoon', 'path', 'pathway', 'driveway', 'decking', 'deck',
  'bollard', 'spike', 'stake', 'in-ground', 'inground', 'ground light', 'floodlight', 'floodlights', 'flood light', 'security light', 'pir', 'post light',
  'post top', 'lamp post', 'fence', 'porch', 'front door', 'wall lantern', 'ip65', 'ip66', 'ip67', 'ip68', 'ip44']);
// Indoor words win over IP ratings: a bathroom ceiling light is IP44/IP65 but stays inside.
const INSIDE = words(['bathroom', 'shower', 'kitchen', 'cabinet', 'under cabinet', 'undercabinet', 'cupboard', 'mirror', 'picture', 'bedroom', 'ceiling',
  'pendant', 'chandelier', 'table lamp', 'floor lamp', 'desk lamp', 'downlight', 'downlights', 'flush', 'semi-flush', 'track']);
const OUTDOOR_FEED = /in-ground|landscape|pathway|flood\s*&\s*spot|outdoor/i;
const BULB = /\b(bulbs?|gu10|gu5\.3|mr16|b22|e27|e14|b15|g9|r7s|gls|golfball|candle led|filament)\b/i;

const HGW_SUBS = [
  ['Light Bulb', re => BULB.test(re)],
  ['Lampshade', re => /\b(lamp ?shades?|shades?)\b/i.test(re) && !/\blight\b/i.test(re)],
  ['Chandelier', re => /\bchandeliers?\b/i.test(re)],
  ['Pendant Light', re => /\bpendants?\b/i.test(re)],
  ['Floor Lamp', re => /\bfloor lamps?\b/i.test(re)],
  ['Table Lamp', re => /\b(table|desk|bedside) lamps?\b/i.test(re)],
  ['Wall Light', re => /\b(wall lights?|wall lamps?|picture lights?|mirror lights?|sconces?|up and down)\b/i.test(re)],
  ['Ceiling Light', () => true]
];
const GGW_SUBS = [
  ['Solar lights', /\bsolar\b/i],
  ['Floodlights & security lights', /\b(floodlights?|flood lights?|security lights?|pir)\b/i],
  ['String & festoon lights', /\b(festoon|string lights?|fairy lights?)\b/i],
  ['Lanterns', /\blanterns?\b/i],
  ['Path & spike lights', /\b(path|pathway|spike|stake|bollard|post light|post top|lamp post|in-?ground|ground light|decking|deck)\b/i],
  ['Wall lights', /\b(wall lights?|up and down|wall lantern|porch|front door)\b/i]
];

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  if (!/lighting/i.test(cat) && !LIGHT.test(n)) return { reject: 'not a light (mirror, decor or other)' };
  if (SEASONAL.test(n)) return { reject: 'Christmas or other seasonal decoration' };
  if (COMMERCIAL.test(n)) return { reject: 'commercial fitting (high bay, emergency or exit light), not for a home' };
  if (PART.test(n) && !/\b(lights?|lamps?|bulbs?|downlights?|spotlights?|floodlights?)\b/i.test(n)) return { reject: 'part or accessory, not a light' };
  const outside = !INSIDE.test(n) && (OUTSIDE.test(n) || OUTDOOR_FEED.test(cat));
  // A bulb sold for garden festoons ("B22 1.5W IP65 Amber ... Garden Festoon") is a garden product.
  if (outside) {
    let sub = 'Outdoor lights';
    for (const [label, re] of GGW_SUBS) if (re.test(n)) { sub = label; break; }
    return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.lighting, subcategory: sub };
  }
  for (const [label, test] of HGW_SUBS) if (test(n)) return { site: 'hgw', siteCategory: 'Lighting', subcategory: label };
  return { reject: 'no lighting type' };
}
