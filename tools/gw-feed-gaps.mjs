#!/usr/bin/env node
// Gear World - FEED GAPS scan. READ-ONLY: reads the Awin feed files that are already on this PC and writes one report.
//
// Question it answers: "Can the feeds we already have fill the empty categories of our sites?"
// For every AWIN_<advertiserId>_<feedId>.csv(.gz) in the Awin archive it counts the products that
//   1. pass basic quality checks (name, GBP price, https image, Awin link, not out of stock), and
//   2. match one of the thin categories of a Gear World site (GAPS below, yes-list and no-list, lessons L14).
// A product from any retailer counts for any site: one Awin approval covers every promotional space of the account.
// Products already on a site are not known here, so the numbers are CANDIDATES, not new products.
// Technology Gear World uses its own category rules (sites/tgw/category-rules.js); its current sources are skipped.
// Nothing is imported, nothing is sent anywhere, no file in the archive is changed.
//
// Usage: node tools/gw-feed-gaps.mjs --archive <dir> --out <report.txt>
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify, cleanProductName } from '../sites/tgw/category-rules.js';
import { readCsvRecords, parsePrice, cleanText } from './tgw-import-plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const VERSION = 'gw-feed-gaps v1';
const SAMPLES_PER_RETAILER = 4;
const SAMPLES_PER_GAP = 12;
const RETAILERS_PER_GAP = 12;

const words = list => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

// ---------- Context words ----------
const KIDS = words(['kids?', 'children', 'childrens', 'child', 'junior', 'juniors', 'toddlers?', 'baby', 'babies', 'infants?', 'boys?', 'girls?',
  'ages? \\d+', '\\d+-\\d+ ?(?:years|yrs)', 'paw patrol', 'peppa', 'bluey', 'cocomelon', 'spider-?man', 'pokemon', 'minecraft', 'unicorns?', 'dinosaurs?']);
const ADULT = words(['women', 'womens', 'womenswear', 'woman', 'men', 'mens', 'menswear', 'ladies', 'adults?', 'baker boy', 'toy boy', 'bad boy', 'boyfriend', '(?:18|21|30|40|50|60)(?:st|th)']);
const TOYS = words(['dolls?', 'barbie', 'lego', 'playsets?', 'playmobil', 'sylvanian', 'action figures?', 'figurines?', 'costumes?', 'fancy dress', 'dress up']);
const MEN = words(['men', 'mens', 'menswear', 'for him', 'pour homme', 'homme', 'gents?', 'male']);
const NOT_MEN = words(['women', 'womens', 'womenswear', 'female', 'ladies', 'lady', 'for her', 'pour femme', 'femme', 'girls?', 'kids?', 'children', 'child', 'baby', 'toddlers?', 'junior']);
const MINIATURE = words(['toys?', 'dolls?', 'lego', 'playmobil', 'sylvanian', 'miniature', 'fairy garden', 'model kit', 'ornaments?', 'cake toppers?', 'stickers?', 'jigsaw']);
const BABY_GEAR = words(['baby', 'babies', 'infants?', 'toddlers?', 'kids?', 'children', 'pushchairs?', 'prams?', 'strollers?', 'buggies', 'buggy', 'nappy', 'nappies', 'cotbed', 'cot']);
// Tool and spare-part words: products from tool feeds that only share a word with a thin category ("shrub shears", "sanding belt").
const TOOLISH = words(['tools?', 'cordless', 'batter(?:y|ies)', 'chargers?', 'li-ion', '\\d+v', 'shears?', 'spreaders?', 'trimmers?', 'blowers?', 'sprayers?', 'sanding', 'sanders?',
  'abrasives?', 'compressors?', 'blades?', 'saws?', 'drills?', 'staples?', 'staplers?', 'spades?', 'pliers', 'clamps?', 'flex cables?', 'replacement parts?', 'spare parts?']);
// Clothing that shares a word with a category ("BBQ Hood (Blue) | XS | Stan Ray"): clothing words, or a size between | marks.
const DRESSWEAR = new RegExp(`${words(['crew', 'hoodie', 't-?shirts?', 'tees?', 'sweatshirts?', 'shirts?', 'jackets?', 'coats?', 'cardigans?', 'dress(?:es)?']).source}|\\|\\s*(?:xxs|xs|s|m|l|xl|xxl|\\dxl)\\s*\\|`, 'i');
const JEWELLERY = words(['bracelets?', 'necklaces?', 'earrings?', 'pendants?', 'jewellery', 'charms?', 'rings?']);
const anyOf = (...res) => new RegExp(res.map(r => r.source).join('|'), 'i');

// ---------- Thin categories (21 Oct 2026 count from each site's /api/products) ----------
// A product matches a gap when one rule matches: `include` on name + feed category, `needs` (if set) on name + feed category,
// and `exclude` must not match name + feed category. Several gaps can match one product (e.g. a smart plug: Home and TGW).
// Tuned on a sample of 9,000 live products of the 7 sites (21 Oct 2026). The numbers are an estimate for planning;
// each import still gets its own plan with samples (L14).
export const GAPS = [
  { site: 'GGW', siteName: 'Garden Gear World', key: 'furniture-outdoor-living', label: 'Furniture and outdoor living', rules: [{
    include: words(['garden furniture', 'patio (?:sets?|furniture|chairs?|tables?|heaters?|umbrellas?)', 'bistro sets?', 'rattan (?:sofas?|sets?|furniture|chairs?|corner|dining|daybeds?|egg)',
      'egg chairs?', 'swing (?:seats?|chairs?)', 'garden (?:benches|bench|chairs?|tables?|sofas?|swings?|parasols?|cushions?|loveseats?|dining sets?|recliners?)',
      'outdoor (?:furniture|sofas?|chairs?|tables?|dining|rugs?|cushions?|seating|loungers?|heaters?)', 'sun ?loungers?', 'loungers?', 'deck ?chairs?', 'picnic (?:benches|bench|tables?)',
      'parasols?', 'gazebos?', 'hammocks?', 'fire pits?', 'firepits?', 'chimineas?', 'chimeneas?', 'patio heaters?', 'pergolas?', 'awnings?', 'zero gravity chairs?']),
    exclude: anyOf(MINIATURE, BABY_GEAR, words(['cocktail', 'pet', 'cat', 'dog', 'hamster', 'guinea', 'ferret', 'rat', 'parrot', 'bird']))
  }] },
  { site: 'GGW', siteName: 'Garden Gear World', key: 'bbq', label: 'BBQ and outdoor cooking', rules: [{
    include: words(['bbqs?', 'barbecues?', 'barbeques?', 'pizza ovens?', 'kamado', '(?:charcoal|gas|pellet|kettle|outdoor|portable|camping) grills?', '(?:bbq|pellet|offset) smokers?',
      'grill (?:covers?|tools|brushes|brush|mats?|grates?)', 'planchas?', 'outdoor griddles?', '(?:lumpwood|bbq|restaurant grade) charcoal', 'charcoal briquettes', 'briquettes', 'rotisserie kits?']),
    exclude: anyOf(MINIATURE, DRESSWEAR, words(['sauces?', 'rubs?', 'marinades?', 'seasonings?', 'crisps', 'flavou?rs?', 'snacks?', 'george foreman', 'health grill', 'contact grill', 'grill pans?',
      'toastie', 'air fryers?', 'microwaves?', 'play kitchen', 'socks', 'mugs?', 'tableware']))
  }] },
  { site: 'GGW', siteName: 'Garden Gear World', key: 'buildings-fencing', label: 'Sheds, storage and fencing', rules: [{
    include: words(['sheds?', 'garden (?:storage|stores?|buildings?|rooms?|offices?|gates?|arches|arch|arbours?|screens?|screening)', 'log (?:stores?|cabins?)', 'greenhouses?',
      'cold frames?', 'summer ?houses?', 'fence panels?', 'fencing', 'fence posts?', 'trellis(?:es)?', 'arbours?', 'bike (?:stores?|sheds?)', 'bin stores?', 'wheelie bin stores?',
      '(?:garden|outdoor) storage (?:boxes|box|benches|bench|units?|chests?)', 'lean-?to', 'playhouses?', 'wendy house', '(?:bamboo|willow|reed|privacy) screening', 'privacy screens?']),
    exclude: anyOf(MINIATURE, words(['deshedding', 'shedding', 'hair', 'fur', 'staples?', 'staplers?', 'spades?', 'fencing bars?', 'pliers', 'wire', 'shelving']))
  }] },
  { site: 'GGW', siteName: 'Garden Gear World', key: 'garden-lighting', label: 'Garden lighting', rules: [{
    include: words(['solar (?:lights?|lanterns?|lamps?|string lights?|fairy lights?|spotlights?|stake lights?|path lights?|post lights?|wall lights?|festoon)', 'outdoor (?:lights?|lighting|lanterns?|wall lights?|spotlights?|festoon|string lights?|fairy lights?)',
      'garden (?:lights?|lighting|lanterns?|spotlights?)', 'festoon(?: lights?)?', 'path lights?', 'post lights?', 'bollard lights?', 'deck lights?', 'decking lights?', 'floodlights?',
      'flood lights?', 'security lights?', 'pir (?:lights?|floodlights?)', 'lamp posts?', 'lanterns?']),
    exclude: anyOf(MINIATURE, words(['work lights?', 'site lights?', 'cordless', 'chargers?', '110v', 'bike', 'bicycle', 'cycling', 'head ?torch(?:es)?', 'torch(?:es)?', 'cars?', 'vehicle', 'aquarium', 'fish tank', 'grow lights?', 'camping lanterns?']))
  }] },
  { site: 'GGW', siteName: 'Garden Gear World', key: 'plants-seeds', label: 'Plants, seeds and growing', rules: [{
    include: words(['seeds?', 'flower bulbs?', '(?:tulip|daffodil|allium|crocus|hyacinth|lily|lilies|dahlia|gladioli|snowdrop|iris|narcissus|anemone|ranunculus)s? bulbs?', 'bulbs? (?:for planting|mix|collection)',
      'spring bulbs?', 'plug plants?', 'bedding plants?', 'perennials?', 'shrubs?', 'hedging', 'hedge plants?', 'fruit trees?', 'climbing (?:plants?|roses?)', '(?:shrub|bush|patio|standard|rambling|hybrid tea) roses?',
      'rose (?:bush|plant)s?', 'live plants?', 'house ?plants?', 'indoor plants?', 'potted plants?', 'seedlings?', 'compost', 'potting (?:mix|soil|compost)', 'top ?soil', 'fertili[sz]ers?',
      'plant (?:food|feed)', 'tomato feed', 'grow ?bags?', 'propagators?', 'seed trays?', 'peat-?free', 'wildflowers?']),
    exclude: anyOf(MINIATURE, TOOLISH, words(['artificial', 'fake', 'faux', 'silk', 'plastic plants?', 'light ?bulbs?', 'led', 'e27', 'e14', 'b22', 'gu10', 'chia', 'sesame', 'flax', 'linseed',
      'seed beads?', 'beads', 'bird ?seed', 'wild bird', 'roasted', 'salted', 'bread', 'oil', 'snacks?', 'seed (?:butter|oil)', 'salt']))
  }] },
  { site: 'KGW', siteName: "Kids' Gear World", key: 'school-bags', label: 'School bags', rules: [
    { include: words(['school (?:bags?|backpacks?|rucksacks?)', 'schoolbags?', 'book bags?', 'lunch (?:bags?|box(?:es)?)', 'lunchbox(?:es)?', 'pencil cases?', 'pe bags?']),
      exclude: anyOf(TOYS, ADULT, words(['drinks?', 'juice', 'pouches', '\\d+ ?ml', 'snacks?', 'yogh?urts?', 'crisps'])) },
    { include: words(['backpacks?', 'rucksacks?', 'gym bags?', 'trolley bags?', 'satchels?']), needs: KIDS, exclude: anyOf(TOYS, ADULT, words(['changing bags?', 'nappy', 'baby carriers?'])) }
  ] },
  { site: 'KGW', siteName: "Kids' Gear World", key: 'kids-shoes', label: 'Shoes', rules: [
    { include: words(['shoes?', 'trainers', 'sneakers?', 'boots?', 'wellies', 'wellingtons?', 'sandals?', 'slippers?', 'plimsolls?', 'clogs?', 'crocs', 'mary janes?', 'flip ?flops?', 'school shoes?']),
      needs: KIDS, exclude: anyOf(TOYS, ADULT, JEWELLERY, words(['old school', 'shoe (?:racks?|polish|cleaner|storage)', 'car boot', 'socks?', 'sippy', 'cups?', 'potty', 'sleep', 'hampers?', 'gift cards?'])) }
  ] },
  { site: 'KGW', siteName: "Kids' Gear World", key: 'kids-tech', label: 'Kids tech', rules: [
    { include: words(['(?:kids?|children|childrens|child) (?:digital |instant |print |mini )?(?:tablets?|cameras?|smart ?watch(?:es)?|headphones?|earbuds?|e-?readers?|laptops?|projectors?|speakers?)',
      '(?:tablets?|cameras?|smart ?watch(?:es)?|headphones?|earbuds?|e-?readers?|projectors?|speakers?) for (?:kids|children)', 'instant (?:print )?cameras?', 'smart ?watch(?:es)?', 'headphones?', 'walkie[ -]talkies?', 'karaoke']),
      needs: KIDS, exclude: anyOf(ADULT, words(['baby monitors?', 'monitors?', 'cases?', 'covers?', 'screen protectors?', 'straps?', 'lcd screen', 'replacement'])) },
    { include: words(['vtech', 'leapfrog', 'kidizoom', 'toniebox', 'tonies', 'yoto', 'kids edition']),
      exclude: words(['baby monitors?', 'monitors?', 'rattles?', 'soothers?', 'comforters?', 'nursery']) }
  ] },
  { site: 'KGW', siteName: "Kids' Gear World", key: 'kids-accessories', label: 'Accessories', rules: [
    { include: words(['hats?', 'beanies?', 'caps?', 'gloves', 'mittens', 'scarf', 'scarves', 'snoods?', 'hair (?:clips?|bows?|bands?|accessories|ties)', 'headbands?', 'scrunchies', 'water bottles?',
      'drinks? bottles?', 'umbrellas?', 'sunglasses', 'watches?', 'purses?', 'wallets?', 'jewellery', 'necklaces?', 'bracelets?', 'earrings?', 'bum bags?', 'keyrings?', 'key ?chains?']),
      needs: KIDS, exclude: anyOf(TOYS, ADULT, words(['pushchairs?', 'prams?', 'strollers?', 'buggies']),
        words(['bikes?', 'ride on', 'rocking', 'parachute', 'socks', 'tights', 'hampers?', 'diffuser', 'straps?', 'lcd screen', 'nappy', 'toys?', 'craft', 'kits?', 'looms?', 'making'])) }
  ] },
  { site: 'WGW', siteName: "Women's Gear World", key: 'beauty-fragrance', label: 'Beauty and fragrance', rules: [{
    include: words(['perfumes?', 'eau de (?:parfum|toilette)', 'edp', 'edt', 'parfum', 'fragrances?', 'body mists?', 'lipsticks?', 'lip (?:gloss|balm|liner|oil|stain|tint|kit)s?', 'mascaras?', 'concealers?',
      'eye ?shadows?', 'eye ?shadow palettes?', 'eyeliners?', 'blushers?', 'blush (?:palettes?|sticks?|powder|duo)', '(?:cream|powder|liquid) blush', 'bronzers?',
      '(?:liquid|matte|dewy|serum|stick|powder|cushion|make-?up|tinted) foundations?', 'foundation (?:spf|\\d+ ?ml|shade|stick|brush)',
      '(?:face|make-?up|eye|lip|pore|blurring) primers?', 'setting (?:spray|powder)', 'nail (?:polish|varnish|lacquer|kit|art)', 'gel polish', 'serums?', 'moisturi[sz]ers?', 'face (?:masks?|creams?|oils?|wash|mists?|scrubs?|serums?)',
      'skin ?care', '(?:night|day|eye|hand) creams?', 'body (?:lotions?|butters?|washes|wash|oils?|scrubs?|creams?)', 'shampoos?', 'conditioners?', 'hair (?:masks?|oils?|serums?|sprays?|mousse|treatments?)',
      'make-?up(?: (?:bags?|brushes?|sets?|kits?|palettes?|remover))?', 'beauty (?:gift sets?|boxes?|advent calendars?|sets?)', 'hair (?:dryers?|straighteners?|stylers?|curlers?|wavers?)', 'curling (?:wands?|tongs?|irons?)',
      'airwrap', 'hot brush', 'false (?:lashes|eyelashes)', 'eyelash(?:es)?']),
    exclude: anyOf(MEN, TOYS, BABY_GEAR, words(['toys?', 'aftershave', 'beard', 'girls?', 'cars?', 'carpet', 'dog', 'pet', 'cat', 'upholstery', 'fabric conditioner', 'air conditioners?', 'paint', 'wood',
      'drain', 'oven', 'toilet', 'patio', 'deck', 'candles?', 'diffusers?', 'wax melts?', 'reeds?', 'room sprays?', 'home fragrance', 'fragrance[- ]free', 'washing', 'laundry', 'mattress', 'desk',
      'stool', 'drawers', 'wall mounted', 'dressing table']))
  }] },
  { site: 'MGW', siteName: "Men's Gear World", key: 'everyday-carry', label: 'Everyday carry', rules: [{
    include: words(['wallets?', 'card ?holders?', 'cardholders?', 'card cases?', 'money clips?', 'key ?rings?', 'keyrings?', 'key ?chains?', 'key (?:holders?|organi[sz]ers?)',
      '(?:edc|pocket|keychain|keyring|key ?ring|tactical|mini|compact) (?:led )?(?:torch|torches|flashlights?)', 'keychain flashlights?', 'everyday carry',
      '(?:fountain|ballpoint|rollerball|luxury) pens?', 'passport (?:holders?|covers?|wallets?)', 'tech (?:pouch|organi[sz]er)s?', 'cable organi[sz]ers?']),
    exclude: anyOf(NOT_MEN, TOOLISH, words(['handbags?', 'purses?', 'nappy', 'dog', 'cat', 'pet', 'knife', 'knives', 'phones?', 'radio', 'earphones?', 'speakers?', 'lamps?', 'wall art', 'framed',
      'headlamps?', 'headlights?', 'bicycle', 'diving', 'toys?', 'led light bulb']))
  }] },
  { site: 'MGW', siteName: "Men's Gear World", key: 'grooming-fragrance', label: 'Grooming and fragrance', rules: [
    { include: words(['aftershaves?', 'after shave', 'beard(?: (?:oils?|balms?|trimmers?|kits?|care|wash|brush|comb))?', 'shavers?', 'razors?', 'razor blades', 'shaving (?:cream|foam|gel|brush|bowl|soap|kit|set|oil)',
      'pre-?shave', '(?:beard|body|hair|nose|ear|stubble) trimmers?', 'hair clippers?', 'grooming (?:kits?|sets?)', 'moustache wax']),
      exclude: anyOf(NOT_MEN, words(['venus', 'bikini', 'hedge', 'grass', 'strimmers?', 'line trimmers?', 'lawn', 'garden', 'dog', 'pet', 'cat', 'horse', 'scooters?', 'ice'])) },
    { include: words(['eau de (?:toilette|parfum|cologne)', 'edt', 'edp', 'parfum', 'perfumes?', 'colognes?', 'fragrances?', 'deodorants?', 'anti-?perspirants?', 'body sprays?', 'moisturi[sz]ers?',
      'face (?:wash|scrub|cream)', 'skin ?care', 'shower gels?', 'body wash', '(?:fragrance|aftershave|skincare|skin care|toiletries|toiletry|bath) gift sets?', 'hair (?:wax|clay|pomade|gel)', 'pomade']),
      needs: MEN, exclude: anyOf(NOT_MEN, words(['dog', 'pet', 'cat'])) }
  ] },
  { site: 'HGW', siteName: 'Home Gear World', key: 'smart-home', label: 'Smart home', rules: [{
    include: words(['smart (?:plugs?|bulbs?|lights?|lighting|thermostats?|speakers?|displays?|locks?|hubs?|sensors?|switch(?:es)?|radiator valves?|blinds?|curtains?|kettles?|heaters?|fans?|doorbells?|alarms?|smoke alarms?|scales|home)',
      'video doorbells?', 'doorbell cameras?', '(?:indoor|outdoor|home|wi-?fi|wireless) (?:security )?cameras?', 'security cameras?', '(?:amazon|with|works with) alexa', 'alexa (?:built-in|enabled|compatible|voice)', 'echo (?:dot|show|pop|studio)', 'google (?:nest|home)',
      'nest (?:hub|cam|doorbell|thermostat|mini)', 'ring (?:doorbell|camera|alarm|stick up cam|spotlight cam)', 'hive (?:thermostat|active)', 'tado', 'philips hue', 'hue (?:bulbs?|lightstrips?|bridge)', 'lightstrips?',
      'wi-?fi (?:plugs?|bulbs?|cameras?|switch(?:es)?)', 'eufy (?:security|cam|doorbell)', 'arlo', 'blink (?:outdoor|indoor|mini|video)', 'switchbot', 'meross', 'govee']),
    exclude: words(['smart ?tvs?', 'smartphones?', 'smart ?watch(?:es)?', 'cases?', 'covers?', 'screen protectors?', 'toys?', 'baby monitors?', 'brackets?', 'mounts?', 'hangers?', 'accessory', 'replacement'])
  }] },
  { site: 'HGW', siteName: 'Home Gear World', key: 'cleaning', label: 'Cleaning and laundry', rules: [{
    include: words(['vacuum cleaners?', 'vacuums?', 'hoovers?', 'robot (?:vacuums?|hoovers?|mops?)', '(?:stick|handheld|cordless|upright|cylinder|wet (?:and|&) dry) vac(?:uum)?s?', 'steam (?:mops?|cleaners?)',
      'carpet (?:cleaners?|washers?)', 'spot cleaners?', 'window (?:vacs?|vacuums?|cleaners?)', 'mops?', 'mop buckets?', 'dusters?', 'squeegees?', 'microfibre cloths?',
      'cleaning (?:sprays?|products?|cloths?|kits?|brushes?|wipes|tablets|solution|paste|caddy)', 'multi-?purpose cleaners?', '(?:bathroom|kitchen|oven|glass|limescale) cleaners?', 'disinfectants?', 'bleach',
      'laundry (?:baskets?|bags?|hampers?|detergents?|capsules|pods|liquid|sorters?)', 'clothes airers?', 'airers?', 'washing (?:up liquid|powder|pods|capsules)', 'fabric conditioners?', 'dishwasher tablets?',
      'steam irons?', 'clothes irons?', 'steam generators?', 'ironing boards?', '(?:garment|clothes|handheld) steamers?', '(?:pedal|kitchen|recycling|touch|sensor) bins?', 'bin bags?']),
    exclude: anyOf(JEWELLERY, words(['flasks?', 'vacuum (?:flasks?|insulated|sealers?|seal|storage|bags?|pumps?|cups?|mugs?|tumblers?|bottles?)', 'insulated', 'toys?', 'pressure washers?', 'pools?', 'car wash',
      'cars?', 'autocare', 'leaf', 'garden', 'gutters?', 'hair', 'coats?', 'jackets?', 'cardigans?', 'dress(?:es)?', 'test kits?', 'drug', 'polishing', 'dust bags?', 'replacement parts?', '110v']))
  }] }
];

// TGW: thin categories, plus every other TGW category (a second retailer allows real price comparison).
export const TGW_GAPS = ['smart-home-wifi', 'tv-home-cinema', 'cameras-drones'];
const TGW_LABELS = {
  'smart-home-wifi': 'Smart home and Wi-Fi', 'tv-home-cinema': 'TV and home cinema', 'cameras-drones': 'Cameras and drones',
  'laptops-computing': 'Laptops and computing', 'phones-smartwatches': 'Phones and smartwatches', audio: 'Audio', gaming: 'Gaming', 'accessories-storage': 'Accessories and storage'
};

// Tool feeds (CGW/GGW retailers) share words with tech ("No Batteries No Charger" is a drill, not a charger): not TGW candidates.
const TOOL_FEED_CATEGORY = /\b(?:power tools?|hand tools?|garden tools?|tool accessories|power tool accessories|workwear|abrasives|fixings|plumbing|site equipment)\b/i;
const TOOL_NAME = /\b(?:no batteries|no battery|no charger|body only|bare unit|bare tool|naked|li-ion battery charger|\d+(?:\.\d+)?ah)\b/i;
export function tgwCandidate(name, merchantCategory = '', awinCategory = '') {
  if (TOOL_FEED_CATEGORY.test(`${merchantCategory} ${awinCategory}`) || TOOL_NAME.test(name)) return { ok: false, reason: 'tool feed' };
  return classify(name, `${merchantCategory || awinCategory} ${merchantCategory ? awinCategory : ''}`.trim());
}

export function matchGaps(name, feedCategory = '') {
  const text = `${String(name || '')} ${String(feedCategory || '')}`;
  const hits = [];
  for (const g of GAPS) {
    for (const r of g.rules) {
      if (r.include.test(text) && (!r.needs || r.needs.test(text)) && !(r.exclude && r.exclude.test(text))) { hits.push(`${g.site}:${g.key}`); break; }
    }
  }
  return hits;
}

// ---------- Columns ----------
const COLUMNS = {
  name: ['product_name'],
  merchant: ['merchant_name'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  currency: ['currency'],
  displayPrice: ['display_price'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  images: ['large_image', 'merchant_image_url', 'alternate_image', 'aw_image_url', 'merchant_thumb_url'],
  link: ['aw_deep_link'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path'],
  awinCategory: ['category_name']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const map = {};
  for (const [key, names] of Object.entries(COLUMNS)) map[key] = names.map(n => h.indexOf(n)).filter(i => i >= 0);
  return map;
}
const pick = (rec, idxs) => {
  for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); }
  return '';
};
function inStockValue(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(no|n|false|out of stock|out_of_stock|outofstock|discontinued)$/.test(s)) return false;
  return true;
}
function currencyOf(rec, map) {
  const c = pick(rec, map.currency).toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  const dp = pick(rec, map.displayPrice);
  if (/£|GBP/i.test(dp)) return 'GBP';
  if (/€|EUR/i.test(dp)) return 'EUR';
  if (/\$|USD/i.test(dp)) return 'USD';
  return '';
}
const FEED_RE = /^AWIN_(\d+)_(\d+)\.csv(\.gz)?$/i;

// Feed files in the archive (and up to 2 folder levels below). The newest copy of each advertiser/feed pair wins.
export function findFeeds(archive) {
  const found = new Map(), others = [];
  let older = 0;
  const walk = (dir, depth) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) { if (depth < 2) walk(full, depth + 1); continue; }
      const m = FEED_RE.exec(ent.name);
      const st = statSync(full);
      if (!m) { others.push({ path: relative(archive, full), size: st.size, mtime: st.mtime }); continue; }
      const key = `${m[1]}_${m[2]}`;
      const item = { path: full, rel: relative(archive, full), advertiserId: Number(m[1]), feedId: Number(m[2]), gz: !!m[3], size: st.size, mtime: st.mtime };
      const prev = found.get(key);
      if (!prev) found.set(key, item);
      else { older++; if (item.mtime > prev.mtime) found.set(key, item); }
    }
  };
  walk(archive, 0);
  return { feeds: [...found.values()].sort((a, b) => a.advertiserId - b.advertiserId || a.feedId - b.feedId), others, older };
}

// An Awin feed list (CSV with "Advertiser ID" and "Membership Status" columns), if one was saved in the archive.
async function readMembership(archive, others) {
  const status = new Map();
  for (const o of others) {
    if (!/\.csv$/i.test(o.path) || o.size > 50e6) continue;
    let map = null;
    for await (const rec of readCsvRecords(createReadStream(join(archive, o.path)))) {
      if (!map) {
        const h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
        map = { id: h.indexOf('advertiser id'), name: h.indexOf('advertiser name'), status: h.indexOf('membership status') };
        if (map.id < 0 || map.status < 0) break;
        continue;
      }
      const id = Number(rec[map.id]);
      if (id) status.set(id, { status: String(rec[map.status] || '').trim(), name: map.name >= 0 ? String(rec[map.name] || '').trim() : '' });
    }
  }
  return status;
}

export async function scanFeeds({ archive, tgwSourcesFile = join(here, '..', 'sites', 'tgw', 'sources.json'), now = new Date() }) {
  const tgwSourceRows = existsSync(tgwSourcesFile) ? JSON.parse(readFileSync(tgwSourcesFile, 'utf8')).sources.filter(s => s.approved) : [];
  const tgwSources = tgwSourceRows.map(s => s.advertiserId);
  const { feeds, others, older } = findFeeds(archive);
  const membership = await readMembership(archive, others);
  const retailers = new Map();                  // advertiserId -> name
  const feedRows = [];
  const gapData = new Map();                    // gapKey -> Map(advId -> { names:Set, samples:[] })
  const add = (gapKey, advId, name, sample) => {
    let g = gapData.get(gapKey); if (!g) gapData.set(gapKey, (g = new Map()));
    let r = g.get(advId); if (!r) g.set(advId, (r = { names: new Set(), samples: [] }));
    const k = name.toLowerCase();
    if (r.names.has(k)) return;
    r.names.add(k);
    if (r.samples.length < SAMPLES_PER_RETAILER) r.samples.push(sample);
  };

  for (const f of feeds) {
    const info = { file: f.rel, advertiserId: f.advertiserId, rows: 0, usable: 0, skipped: {}, date: f.mtime, missing: [] };
    let map = null;
    let stream = createReadStream(f.path);
    if (f.gz) stream = stream.pipe(createGunzip());
    try {
      for await (const rec of readCsvRecords(stream)) {
        if (!map) {
          map = mapHeader(rec);
          info.missing = ['name', 'price', 'link', 'images'].filter(k => !map[k].length);
          continue;
        }
        if (rec.length === 1 && rec[0] === '') continue;
        info.rows++;
        const merchant = cleanText(pick(rec, map.merchant));
        if (merchant && !retailers.has(f.advertiserId)) retailers.set(f.advertiserId, merchant);
        const skip = why => { info.skipped[why] = (info.skipped[why] || 0) + 1; };
        const name = cleanProductName(cleanText(pick(rec, map.name)));
        if (!name) { skip('no name'); continue; }
        const price = parsePrice(pick(rec, map.price));
        if (!Number.isFinite(price) || price < 1 || price > 10000) { skip('no price or out of range'); continue; }
        const cur = currencyOf(rec, map);
        if (cur && cur !== 'GBP') { skip(`currency ${cur}`); continue; }
        if (inStockValue(pick(rec, map.inStock)) === false) { skip('out of stock'); continue; }
        if (!map.images.some(i => /^https:\/\/\S+$/i.test(String(rec[i] || '').trim()))) { skip('no https image'); continue; }
        let host = '';
        try { host = new URL(pick(rec, map.link)).hostname.toLowerCase(); } catch { /* invalid link */ }
        if (host !== 'www.awin1.com' && host !== 'awin1.com') { skip('not an Awin link'); continue; }
        info.usable++;
        const merchantCategory = cleanText(pick(rec, map.merchantCategory));
        const awinCategory = cleanText(pick(rec, map.awinCategory));
        const feedCat = `${merchantCategory} ${awinCategory}`.trim();
        const sample = `${name.length > 80 ? name.slice(0, 79) + '…' : name} | £${price.toFixed(2)} | ${(merchantCategory || awinCategory || '-').slice(0, 50)}`;
        for (const key of matchGaps(name, feedCat)) add(key, f.advertiserId, name, sample);
        if (!tgwSources.includes(f.advertiserId)) {
          const c = tgwCandidate(name, merchantCategory, awinCategory);
          if (c.ok) add(`TGW:${c.slug}`, f.advertiserId, name, sample);
        }
      }
    } catch (e) {
      info.error = String(e && e.message || e).slice(0, 200);
    }
    feedRows.push(info);
    if (process.env.GW_QUIET !== '1') console.log(`  ${f.rel}: ${info.rows} rows, ${info.usable} usable`);
  }

  // ---------- Report ----------
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16);
  const day = d => d.toISOString().slice(0, 10);
  const age = d => Math.max(0, Math.round((now - d) / 86400000));
  const sourceName = id => { const s = tgwSourceRows.find(x => x.advertiserId === id); return s ? s.retailer : ''; };
  const nameOf = id => retailers.get(id) || (membership.get(id) && membership.get(id).name) || sourceName(id) || `Advertiser ${id}`;
  const L = [];
  L.push(`GEAR WORLD FEED GAPS (read-only, nothing imported) ${stamp} UTC | ${VERSION}`);
  L.push(`Archive: ${archive}`);
  L.push(`Feed files: ${feeds.length} (older copies skipped: ${older}) | retailers: ${new Set(feeds.map(f => f.advertiserId)).size}`);
  if (feeds.length) {
    const dates = feeds.map(f => f.mtime).sort((a, b) => a - b);
    L.push(`File dates: ${day(dates[0])} to ${day(dates[dates.length - 1])}`);
  }
  L.push(membership.size ? `Awin feed list found: membership status for ${membership.size} advertisers` : 'Awin feed list: not in the archive (check "Joined" in Awin > My Programmes before any import)');
  L.push(`TGW sources skipped for TGW (already on the site): ${tgwSources.map(id => `${nameOf(id)} (${id})`).join(', ') || '-'}`);
  L.push('Numbers = different product names that pass the quality checks. Some may already be on the site.');
  L.push('');
  L.push('== Summary: candidates per thin category ==');
  const gapList = [...GAPS.map(g => ({ key: `${g.site}:${g.key}`, title: `${g.siteName}: ${g.label}` })),
    ...Object.keys(TGW_LABELS).map(slug => ({ key: `TGW:${slug}`, title: `Technology Gear World: ${TGW_LABELS[slug]}${TGW_GAPS.includes(slug) ? '' : ' (not thin, 2nd retailer)'}` }))];
  const total = key => { const g = gapData.get(key); let n = 0; if (g) for (const r of g.values()) n += r.names.size; return n; };
  for (const g of gapList) {
    const m = gapData.get(g.key);
    L.push(`  ${String(total(g.key)).padStart(7)}  ${g.title}  [${m ? m.size : 0} retailer(s)]`);
  }
  L.push('');
  L.push('== Details: retailers and samples (name | price | feed category) ==');
  for (const g of gapList) {
    const m = gapData.get(g.key);
    if (!m || !m.size) continue;
    L.push(`-- ${g.title}: ${total(g.key)}`);
    const rs = [...m.entries()].sort((a, b) => b[1].names.size - a[1].names.size);
    for (const [id, r] of rs.slice(0, RETAILERS_PER_GAP)) {
      const ms = membership.get(id);
      L.push(`   ${String(r.names.size).padStart(6)}  ${nameOf(id)} (${id})${ms ? ` [${ms.status}]` : ''}`);
    }
    if (rs.length > RETAILERS_PER_GAP) L.push(`          ... and ${rs.length - RETAILERS_PER_GAP} more retailer(s)`);
    const samples = [];
    for (let i = 0; i < SAMPLES_PER_RETAILER && samples.length < SAMPLES_PER_GAP; i++) {
      for (const [id, r] of rs) { if (r.samples[i] && samples.length < SAMPLES_PER_GAP) samples.push(`${r.samples[i]} | ${nameOf(id)}`); }
    }
    for (const s of samples) L.push(`      · ${s}`);
  }
  L.push('');
  L.push('== Feeds (file | retailer | rows | usable | file date) ==');
  for (const f of feedRows) {
    const ms = membership.get(f.advertiserId);
    const skipped = Object.entries(f.skipped).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
    L.push(`  ${f.file} | ${nameOf(f.advertiserId)}${ms ? ` [${ms.status}]` : ''} | ${f.rows} | ${f.usable} | ${day(f.date)} (${age(f.date)} days)` +
      `${f.missing.length ? ` | MISSING COLUMNS: ${f.missing.join(', ')}` : ''}${f.error ? ` | ERROR: ${f.error}` : ''}${skipped ? ` | skipped: ${skipped}` : ''}`);
  }
  if (others.length) {
    L.push('');
    L.push(`== Other files in the archive (${others.length}, first 20) ==`);
    for (const o of others.slice(0, 20)) L.push(`  ${o.path} | ${Math.round(o.size / 1024)} KB | ${day(o.mtime)}`);
  }
  L.push('');
  L.push('Nothing was imported. No file in the archive was changed.');
  L.push('=== END ===');
  return { report: L.join('\r\n'), gapData, feeds: feedRows, membership };
}

// ---------- CLI ----------
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = val('archive');
  const out = val('out');
  if (!archive || !out) {
    console.error('usage: node tools/gw-feed-gaps.mjs --archive <dir> --out <report.txt>');
    process.exit(2);
  }
  if (!existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  if (existsSync(out)) { console.error(`Report already exists: ${out}. Use a new name.`); process.exit(2); }
  const { report, feeds } = await scanFeeds({ archive });
  writeFileSync(out, '﻿' + report);
  console.log(`feeds ${feeds.length} | report: ${out}`);
}
