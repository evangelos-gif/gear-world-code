// Import rules for Garden Chic (Adtraction programme 2039557167 "Garden Chic UK", gardenchic.co.uk, pounds) on Garden Gear
// World and Home Gear World. Massive import, wave 1 UK, Adtraction (chat 7 sheet «Εγκρίσεις», approved 23 Nov 2026, L225).
// Feed of 24 Nov 2026: 32,830 products, 24,977 in stock, from a few pounds to large log cabins; brands HOMCOM, Outsunny,
// Palram-Canopia, Forest Garden, Shire ... The shop category is a path ("Garden Buildings - Garden Sheds - Wooden Sheds",
// "Outdoor Living - Garden Furniture - Garden Seating", "House & Home - Indoor Furniture - Living Room Furniture").
//  - Garden Buildings, Landscaping & Design, Garden Care & Tools, Outdoor Living and Plants Seeds & Bulbs go to GGW, by the
//    shop category (the subcategories GGW already has, L56); garden furniture by its name (lib/garden.mjs furnitureSub).
//  - House & Home: indoor furniture, lighting, home accessories, rugs, bins, heaters and fires, fans, fireside accessories
//    and Christmas to HGW (lib/hgw-home.mjs by the name); outdoor lights and patio heaters filed there go to GGW.
//  - Simply Log Cabins (Adtraction 2039563757) is a part of this same catalogue (same products): not imported again.
//  - Left out: pet houses and pet accessories, children's toys and garden play (ride-on toys, bouncy castles, swings,
//    trampolines), camping, car and motorcycle, sport and leisure, DIY and tool storage, market stalls, wild bird care,
//    electrical appliances without a clear place, and anything without a clear place on either site.
import { furnitureSub, gardenPlace, OUTDOOR_HINT } from './lib/garden.mjs';
import { homePlace, homeName, notHome } from './lib/hgw-home.mjs';
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'gardenchic-uk',
  network: 'adtraction',
  advertiserId: 2039557167,
  retailer: 'Garden Chic',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?gardenchic\.co\.uk\//i,
  sites: ['ggw', 'hgw'],
  maxPrice: 25000,
  minPrice: 3
};

export function displayName(name) {
  return homeName(clean(name));
}

const BUILD = 'Garden Buildings, Fencing & Storage';
const FURN = 'Garden Furniture & Outdoor Living';
const BBQ = 'BBQ & Outdoor Cooking';
const LIGHT = 'Outdoor Lighting & Garden Electrical';
const PLANTS = 'Plants, Growing & Garden Care';
const TOOLS = 'Garden Tools';
const POWER = 'Power Garden Tools';
const WATER = 'Watering & Irrigation';
const G = (cat, sub) => ({ site: 'ggw', siteCategory: cat, subcategory: sub });
const H = (cat, sub) => ({ site: 'hgw', siteCategory: cat, subcategory: sub });
const OUT = why => ({ reject: why });
const FURNITURE = 'furniture';  // the subcategory comes from the name (furnitureSub)
const HOME = 'home';            // HGW, by the name (homePlace)
const SOFTS = 'softs';          // a cover or a cushion: covers and storage bags first ("Aerocover Table 160 x 100 x 70cm" is a cover)

// [test on the shop category path, place] - the first match wins. Paths are read without "Black Friday - " (those rows
// are read by their name only).
const PLACES = [
  // Never on the two sites
  [/animal houses|pet accessories|^pet\b/i, OUT('pet houses and pet accessories (not garden or home gear)')],
  [/garden play(?! - play houses)|childrens toys|^play\b/i, OUT("children's toys and garden play")],
  [/camping|car & motorcycle|sport & leisure|market stalls|wild bird|house & home - diy|tool storage/i, OUT('camping, car, sport, DIY or trade items (not garden or home gear)')],
  // Garden buildings
  [/greenhouses - potting sheds|garden sheds/i, G(BUILD, 'Sheds')],
  [/greenhouses|cold frames|grow your own equipment - growhouses/i, G(BUILD, 'Greenhouses')],
  [/leisure buildings - gazebos|gazebos marquees|canopies & awnings|pergolas|bbq shelters|barbecue shelters|smoking shelters/i, G(FURN, 'Parasols, gazebos & shade')],
  [/leisure buildings - saunas|hot tubs|saunas|spas/i, G(FURN, 'Hot tubs & accessories')],
  [/log cabins|summer houses|garden offices|garden bars|glamping pods|shepherds huts|conservatories|leisure buildings$/i, G(BUILD, 'Summerhouses & log cabins')],
  [/garages & carports|workshops/i, G(BUILD, 'Garages & workshops')],
  [/log stores/i, G(BUILD, 'Log stores')],
  [/garden storage|cushion boxes/i, G(BUILD, 'Garden storage')],
  [/building bases/i, G(BUILD, 'Shed bases & accessories')],
  [/play houses/i, G(BUILD, 'Playhouses')],
  [/arches|arbours|fencing & trellis/i, G(BUILD, 'Fencing & screening')],
  [/landscaping & design - flooring|lawn edging/i, G(BUILD, 'Decking & landscaping')],
  [/statues & ornaments|water features/i, G(FURN, 'Garden Ornaments')],
  [/door mats|rugs and doormats/i, H('Home Decor', 'Rug')],
  [/composters/i, G(TOOLS, 'Composters')],
  [/compost soil/i, G(PLANTS, 'Growing media')],
  [/solar lighting/i, G(LIGHT, 'Solar lights')],
  [/garden lighting/i, G(LIGHT, 'Outdoor lights')],
  // Plants and growing
  [/pots ?(&|baskets &)? ?baskets? & planters|plant shelves|shelves & staging/i, G(PLANTS, 'Pots & planters')],
  [/raised beds|potting benches|grow your own/i, G(PLANTS, 'Growing')],
  [/fertilisers/i, G(PLANTS, 'Plant feed')],
  [/artificial plants/i, H('Home Decor', 'Artificial Plants')],
  [/seeds & bulbs - seeds/i, G(PLANTS, 'Seeds & bulbs')],
  [/^plants seeds & bulbs/i, G(PLANTS, 'Plants')],
  // Tools
  [/watering & irrigation/i, G(WATER, 'Watering Accessories')],
  [/wheelbarrows/i, G(TOOLS, 'Wheelbarrows')],
  [/garden hand tools/i, G(TOOLS, 'Other Garden Accessories')],
  [/blowervacs/i, G(POWER, 'Garden Blowers')],
  [/chainsaws/i, G(POWER, 'Chainsaws & Accessories')],
  [/grass trimmers/i, G(POWER, 'Grass Trimmers')],
  [/hedge trimmers/i, G(POWER, 'Hedge Trimmers')],
  [/log splitters/i, G(TOOLS, 'Log Splitters')],
  [/scarifiers/i, G(POWER, 'Lawn Rakers & Scarifiers')],
  [/lawnmowers/i, G(POWER, 'Lawnmowers & Accessories')],
  [/garden power tools/i, G(POWER, 'Outdoor Power Tools')],
  // Outdoor living
  [/pizza & outdoor ovens/i, G(BBQ, 'Pizza ovens')],
  [/bbq accessories/i, G(BBQ, 'BBQ accessories')],
  [/charcoal barbecues|gas barbecues|bbqs & outdoor ovens$/i, G(BBQ, 'BBQs')],
  [/fire pits|chimeneas|patio heaters|garden heating/i, G(FURN, 'Fire pits & heaters')],
  [/parasols/i, G(FURN, 'Parasols, gazebos & shade')],
  [/sun loungers/i, G(FURN, 'Loungers')],
  [/outdoor rugs/i, G(FURN, 'Cushions & rugs')],
  [/garden tables/i, G(FURN, 'Tables')],
  [/cushions & covers/i, SOFTS],
  [/garden furniture|outdoor living$/i, FURNITURE],
  // House & Home
  [/christmas/i, H('Home Decor', 'Christmas')],
  [/fireside accessories/i, H('Home Decor', 'Fireplaces')],
  [/fans & air conditioners/i, HOME],
  // The shop files dishwashers, lamps and kettle sets under "Heaters & Fires" too: the name decides there.
  [/heaters & fires|heating & cooling$/i, HOME],
  [/house & home - bins/i, H('Cleaning & Laundry', 'Bins & Bin Bags')],
  [/indoor furniture|home accessories|house & home - lighting|house & home$/i, HOME],
  [/electrical appliances/i, HOME]
];

// Home appliances a home shop files under "Electrical Appliances" or "Fans & Air Conditioners", by the name. Strict words:
// a "Coffee Table", a "Microwave Stand" and a "Fan Ceramic Table Lamp" are furniture and lighting (dry run 24 Nov 2026).
const APPLIANCES = [
  [/air conditioner|air cooler|portable ac\b/i, 'Air Conditioner'], [/dehumidifier/i, 'Dehumidifier'], [/air purifier/i, 'Air Purifier'],
  [/fan heater|\bheaters?\b|electric fire\b|electric fireplace|oil filled radiator/i, 'Heater'], [/\bfans?\b(?!.*\b(lamp|light)s?\b)/i, 'Fan'],
  [/\bkettles?\b/i, 'Kettle'], [/\btoasters?\b|toaster oven/i, 'Toaster'], [/air fryer/i, 'Air Fryer'],
  [/\bmicrowaves?\b(?! ?(stand|cart|cabinet|shelf|rack|trolley|cupboard))/i, 'Microwave'], [/\bblenders?\b/i, 'Blender'],
  [/coffee (machine|maker)|espresso machine/i, 'Coffee Machine'], [/vacuum cleaner|\bhoover\b/i, 'Vacuum Cleaner']
];
const appliance = n => { for (const [re, sub] of APPLIANCES) if (re.test(n)) return H('Home Appliances', sub); return null; };

// HGW by the name: the furniture, lighting and decor words first (lib/hgw-home.mjs), then an appliance.
function homeByName(n, appliancesOnly = false) {
  if (appliancesOnly) return appliance(n);
  if (/\b(artificial|faux)\b.*\b(plants?|trees?|flowers?|topiary|hedges?|grass|succulents?)\b/i.test(n)) return H('Home Decor', 'Artificial Plants');
  if (/curtain lights?|fairy lights?|string lights?/i.test(n)) return H('Lighting', 'Party & Projector Lights');
  if (/\b(pedal|kitchen|recycling|sensor|dust|waste) ?bins?\b|\bdustbins?\b/i.test(n)) return H('Cleaning & Laundry', 'Bins & Bin Bags');
  if (notHome(n)) return null;
  const p = homePlace(n);
  if (p) return { site: 'hgw', ...p };
  return appliance(n);
}

// Never on these two sites, whatever the shop category (dry run 24 Nov 2026): children's furniture and toys, food hampers,
// radiator covers, massage and salon beds, gym equipment, mobility aids and paint sprayers.
const NEVER = [
  [/\b(kids?|children'?s?|toddlers?|baby|babies|nursery|play kitchen|pretend|toys?|ride[- ]on|trampolines?|bouncy castles?|sand ?pits?|see-?saws?|slides?|climbers?|basketball)\b/i,
    "children's furniture, toys or garden play (not this site)", /playhouse|play house|wendy house|summerhouse/i],
  [/\bhampers?\b/i, 'a food or gift hamper', /laundry/i],
  [/radiator covers?/i, 'a radiator cover (not a heater or furniture)'],
  [/massage table|beauty bed|salon|barber|tattoo|lash/i, 'salon or massage equipment'],
  [/bench press|barbell|\bgym\b|fitness|exercise|yoga|dumbbells?|weights?\b|punch(ing)? bags?/i, 'gym and fitness equipment'],
  [/bath chair|shower chair|shower stool|commode|mobility|rollator|walking (aid|frame)|toilet seat raiser/i, 'a mobility aid'],
  [/paint sprayer|spray gun|airless/i, 'a DIY tool, not a garden or home product']
];

// GGW subcategories that gardenPlace (lib/garden.mjs) can give but GGW does not have (L56): the nearest one it has.
const GGW_SUB = { 'Compost & feed': 'Plant feed', 'Garden electrical': 'Lighting accessories' };

// A few names say more than the shop category: covers, spreaders, tillers.
function byNameFirst(n) {
  if (/^aerocover\b/i.test(n)) return /barbecue|bbq|grill/i.test(n) ? G(BBQ, 'BBQ accessories') : G(FURN, 'Furniture covers');
  if (/\bspreaders?\b/i.test(n)) return G(PLANTS, 'Lawn Spreaders');
  if (/\btillers?\b/i.test(n)) return G(POWER, 'Tillers');
  return null;
}

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher|installation service|assembly service|\bsample\b/i.test(n)) return { reject: 'service, sample or gift card' };
  for (const [re, why, unless] of NEVER) if (re.test(n) && !(unless && unless.test(n))) return { reject: why };
  const path = String(feedCategory || '').replace(/^black friday\s*-\s*/i, '').trim();
  const fromName = !path || /^black friday/i.test(feedCategory) && path.split(/\s+-\s+/).length < 2;
  const place = p => ({ ...p, name: n });
  const first = byNameFirst(n);
  if (first) return place(first);
  // Lights and heaters for outside filed under House & Home go to GGW.
  const outsideHome = OUTDOOR_HINT.test(n) && /lighting|heat|electrical|home accessories/i.test(path);
  if (!fromName && !outsideHome) {
    for (const [re, to] of PLACES) {
      if (!re.test(path)) continue;
      if (to.reject) return to;
      if (to === FURNITURE) return place(G(FURN, furnitureSub(n)));
      if (to === SOFTS) return place(G(FURN, /cover|bag/i.test(n) ? 'Furniture covers' : 'Cushions & rugs'));
      if (to === HOME) {
        const h = homeByName(n, /electrical appliances|fans & air/i.test(path));
        return h ? place(h) : { reject: 'no clear place on Home Gear World' };
      }
      return place(to);
    }
  }
  // No shop category (or only "Black Friday - …", or an outdoor light or heater in House & Home): the name decides.
  if (/\b(kennel|hutch|coop|dog|cat|rabbit|pet|tent)\b/i.test(n)) return { reject: 'pet or camping item (by its name)' };
  const g = gardenPlace(n, feedCategory);
  if (g) {
    const sub = g.siteCategory === FURN ? furnitureSub(n) : (GGW_SUB[g.subcategory] || g.subcategory);
    return place({ site: 'ggw', siteCategory: g.siteCategory, subcategory: sub });
  }
  if (!OUTDOOR_HINT.test(n)) {
    const h = homeByName(n);
    if (h) return place(h);
  }
  return { reject: 'no clear place on Garden Gear World or Home Gear World' };
}
