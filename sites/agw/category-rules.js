// Car Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by tools/agw-import-plan.mjs):
//   1. DENY rules on the PRODUCT NAME reject things that only look like car products: toys ("Monster Jam",
//      die-cast), children's car seats (Kids' site), clothes and gifts, motorbike and bicycle parts, garden
//      machines, plain screws ("M 4x4").
//   2. "Car context": the name or the shop's category says car / vehicle / automotive (or the Dutch and German
//      words, for VEVOR NL and Reidl). Generic words such as "wax", "jack" or "charger" count only with it.
//   3. The FIRST rule whose `include` matches and whose `exclude` does not wins. Order matters:
//      EV charging before electronics ("EV charger" is not a phone charger), parts before roof ("roof box gas
//      strut" is a part), and anything in a tool shop's "Automotive Tools" section that is not a battery,
//      tyre, care or EV product ends up in Garage Tools.
//   4. No match: rejected as "not car" (shown apart when the shop category itself says car, so missing
//      rules are easy to spot in the dry-run report).
// Based on the car feed scan of 21 Oct 2026 (Tooled Up, My Tool Shed, SGS Engineering, Joybuy UK, VEVOR NL).

import { fixMojibake } from '../../src/db.js';

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Shop categories that make a product a car product (top part before ">" or anywhere in the path).
const CAR_FEED = /automotive|pneus?|banden|reifen|jantes|velgen|felgen|vehicles? (?:parts|repairs|accessories)|vehicles & parts|car (?:parts|accessories|care|electronics|audio|cleaning)|motoring|automobiel|autozubeh|kfz|gas strut applications > (?:cars|vans|caravans|motorhomes)/i;
const CAR_WORDS = words(['cars?', 'vehicles?', 'automotive', 'motoring', 'auto', 'van', 'vans', '4x4 vehicle', 'suv', 'campervan', 'motorhome', 'caravan',
  'tyres?', 'tires?', 'dash ?cams?', 'obd2?', 'obdii', 'windscreen', 'windshield', 'number plate', 'tow ?bar', 'tow ball', 'roof box', 'roof bars',
  'ev', 'carplay', 'android auto', 'sat ?nav', 'jump starter', 'jump leads', 'wiper blades?', 'brake (?:pads|discs)',
  'trolley jack', 'axle stands?', 'tailgate', 'bonnet', 'boot', 'dashboard', 'headlights?', 'bumper', 'alloy wheels?',
  // Dutch / German (VEVOR NL, Reidl)
  'autos', 'personenauto', 'laadkabel', 'fietsendrager', 'bandenpomp', 'acculader', 'startbooster', 'krik', 'fahrzeug', 'kfz', 'pkw', 'wagenheber', 'starthilfe']);

// Head torches are sold as "LED Headlight 300 lumens": a light for the head, not a car headlight.
const HEAD_TORCH = /(?=.*(?:^|[^a-z])headlights?(?![a-z]))(?=.*(?:^|[^a-z])(?:lumens?|beanie|hat|helmet|sensor|head ?torch|rechargeable|waterproof headlight)(?![a-z]))/i;

export const DENY = [
  { label: 'head torch, not a car light', re: HEAD_TORCH },
  { label: 'toy or model', re: words(['toys?', 'monster jam', 'hot wheels', 'die-?cast', 'scale model', 'model cars?', 'rc', 'remote control', 'lego', 'ride-?on', 'playmat', 'puzzle', 'jigsaw', 'kids', "children'?s", 'baby', 'toddler', 'infant']) },
  { label: 'child car seat (Kids\' Gear World)', re: words(['child seat', 'booster seat', 'isofix', 'i-size', 'pushchair', 'pram', 'stroller', 'travel system', 'carrycot', 'car seats? (?!covers?|protectors?|organi[sz]ers?|cushions?|gap)']) },
  { label: 'clothes, gift or home item', re: words(['t-?shirts?', 'hoodie', 'sweatshirt', 'jackets?', '(?:rain|winter|wool|puffer|parka|trench) coats?', 'dress(?:es)?', 'socks', 'pyjamas', 'mugs?', 'posters?', 'art prints?', 'books?', '(?:greeting|birthday|christmas|gift|playing) cards?', 'costume', 'bedding', 'duvet', 'pillowcase', 'hoeslaken', 'cake', 'necklace', 'cufflinks', 'keyrings?', 'diffuser', 'candle', 'cosmetic\\w*', 'cosmetica\\w*', 'make-?up', 'camping mattress', 'sleeping pads?', '(?:electric|heated) blankets?', 'double size', 'pet (?:car )?(?:safety )?belts?', 'dog (?:car )?(?:safety )?belts?']) },
  { label: 'motorbike or bicycle', re: words(['(?:folding|electric|mountain|road|kids|e-) ?bikes?', 'motorbikes?', 'motorcycles?', 'motocross', 'scooters?', 'mopeds?', 'quad bike', 'atv', 'bicycle', 'mtb', 'bike tyres?', 'inner tubes?', '700c', 'golf cart', 'club car']) },
  { label: 'garden or farm machine', re: words(['lawn ?mowers?', 'mowers?', 'strimmers?', 'chainsaws?', 'wheelbarrows?', 'tractors?', 'farm jack', 'horse', 'feed bucket', 'sack trucks?', '[24][ -]?stroke', 'pressure sprayer', 'platform trolley', 'trolley truck']) },
  { label: 'fixings, not a car product', re: words(['din \\d+', 'iso \\d+', 'gewindestifte', 'set screws?', 'grub screws?', 'gehörschutz', 'ear plugs?', 'säbelsägeblatt', 'saw blades?']) },
  { label: 'not allowed', re: words(['radar detectors?', 'laser jammers?', 'speed camera detector', 'spy camera', 'hidden camera', 'knife', 'knives', 'vape']) }
];

// ctx: true = only with car context (step 2). notInToolShop: skipped for a tool shop's "Automotive Tools"
// section (a "brake" product there is a brake TOOL, not a brake part).
export const RULES = [
  {
    slug: 'parts-maintenance', // gas struts first: "Roof Box Gas Strut", "Tailgate Gas Strut"
    include: words(['gas struts?', 'gas springs?', 'gas supports?', 'gas rams?', 'lifting rams?', '(?:boot|tailgate|bonnet|door|drop head|roof bed|spare wheel|floor|wheel mount) struts?', 'struts?']),
    exclude: words(['compressors?', 'tools?', 'kits?', 'removers?', 'installers?', 'wrench(?:es)?', 'sockets?']),
    ctx: true // a plain "Gas Strut 200N 300mm" is for furniture or machines; one for an Audi A6 tailgate is a car part
  },
  {
    slug: 'ev-charging',
    include: words(['ev chargers?', 'ev charging', 'ev cables?', 'wallbox(?:es)?', 'type ?2 (?:cable|charg\\w*|lead|socket|plug)s?', 'electric (?:vehicle|car) charg\\w+', 'ev laadkabel', 'laadkabel', 'laadpaal', 'ladestation', 'charging cable bag'])
  },
  {
    slug: 'diagnostics-battery',
    include: words(['obd ?(?:ii|2)?', 'diagnostic(?:s| tool| scanner| device)?', 'code readers?', 'fault code', 'scan tool', 'battery (?:chargers?|testers?|maintainers?|conditioners?|analy[sz]ers?)', 'smart chargers?', 'trickle chargers?',
      'jump starters?', 'jump leads', 'jump packs?', 'booster cables?', 'start(?:ing)? boosters?', 'power packs?', 'acculader', 'startbooster', 'starthilfe\\w*', 'circuit testers?', 'test lamps?', 'automotive analy[sz]ers?', 'automotive thermometers?', 'infrared thermometers?', 'car batter(?:y|ies)', 'battery terminals?', 'voltage (?:protector|stabili[sz]er)', 'bordnetz']),
    ctx: true,
    // Power tool batteries ("Bosch GAL 18V-160 Li-Ion Fast Battery Charger") are not car batteries.
    exclude: words(['laptop', 'phone', 'aa', 'aaa', 'drills?', 'cordless', 'li-?ion', 'lithium', '\\d+v li', 'impact drivers?', 'radios?', 'no batteries', 'trolleys?', 'torch(?:es)?'])
  },
  {
    slug: 'tyres-wheels',
    include: words(['tyres?', 'tires?', 'pneus?', 'banden', 'reifen', 'jantes?', 'velgen', 'felgen', 'rims?', 'tyre inflators?', 'tire inflators?', 'inflators?', 'tyre (?:pressure|tread|gauge)\\w*', 'tpms', 'puncture', 'alloy wheels?', 'wheel (?:nuts?|bolts?|braces?|trims?|chocks?|dolly|dollies|balancers?|spacers?|locks?)', 'locking wheel nuts', 'wheel nut', 'wheel socket', 'valve (?:caps?|cores?)', 'bandenpomp', 'bead (?:blaster|breaker|seater)']),
    exclude: words(['tyre shine', 'tire shine', 'tyre (?:dressing|gel|cleaner)', 'tire (?:dressing|gel|cleaner)', 'trolleys?', 'trucks?', 'wheelbarrows?', 'sack'])
  },
  {
    slug: 'car-care-detailing',
    include: words(['car wash', 'shampoo', 'snow foam', 'wax(?:es)?', 'polish(?:es|er|ers|ing)?', 'microfib(?:re|er)', 'valet(?:ing)?', 'detailing', 'clay bar', 'tyre (?:shine|dressing|gel)', 'tire (?:shine|dressing|gel)', 'glass cleaner', 'air fresheners?', 'scratch remov\\w+', 'ceramic coating', 'headlight restor\\w+', 'drying towels?', 'wash (?:mitt|brush|bucket|kit|set)s?', 'washing brush', 'interior cleaner', 'leather (?:cleaner|conditioner)', 'upholstery cleaner', 'pressure washer (?:brush|kit|set)', 'buffer polisher', 'buffing pads?', 'polishing pads?', 'chamois', 'vent cleaning brush']),
    ctx: true,
    exclude: words(['shoe polish', 'nail polish', 'floor polish', 'furniture polish', 'metal polish', 'dog shampoo', 'hair'])
  },
  {
    slug: 'car-electronics',
    include: words(['dash ?cams?', 'dashcam', 'carplay', 'android auto', 'sat ?navs?', 'gps navigat\\w+', 'car stereos?', 'head units?', 'car radios?', 'dab (?:adapter|radio)', 'reversing cameras?', 'rear ?view cameras?', 'backup cameras?', 'parking sensors?', 'parking (?:aid|assist)', 'car chargers?', 'usb car charger', 'phone (?:holders?|mounts?|cradles?)', 'fm transmitters?', 'car (?:speakers?|amplifiers?|subwoofers?)', 'subwoofers?', 'gps trackers?', 'car (?:led|lights?) strip', 'interior (?:led|light) strip', 'car inverters?', 'power inverters?', '12v (?:sockets?|splitters?|adapters?)']),
    ctx: true,
    // "12v Car Charger for 20v Lithium Ion Batteries" charges power tool batteries, not a phone in the car.
    exclude: words(['bumper cutter', 'cutter', 'drill', 'hole saw', 'power stations?', 'torch(?:es)?', 'batteries', 'power x-?change'])
  },
  {
    slug: 'safety-winter',
    include: words(['de-?icers?', 'ice scrapers?', 'snow (?:chains|socks|brush|shovel)', 'snow ?chains', 'warning triangles?', 'first aid', 'emergency (?:kit|hammer|tool|window breaker|opening kit)s?', 'window breakers?', 'seat ?belt cutters?', 'breakdown kits?', 'tow ropes?', 'tow straps?', 'hi-?vis (?:vests?|jackets?)', 'fire extinguishers?', 'breathalysers?', 'screen covers?', 'windscreen covers?', 'frost covers?', 'emergency fuel funnel']),
    ctx: true
  },
  {
    slug: 'roof-towing-exterior',
    include: words(['roof (?:box(?:es)?|bars?|racks?|rails?|carriers?|bags?)', 'bike (?:racks?|carriers?)', 'cycle carriers?', 'fietsendrager', 'tow ?bars?', 'tow balls?', 'towing (?:electrics?|mirrors?|kits?|sockets?|hitch(?:es)?)', 'tow hitch(?:es)?', 'hitch (?:locks?|covers?)', 'trailer (?:boards?|lights?|sockets?|locks?|plugs?)', 'trailers?', 'car covers?', 'half car cover', 'mud ?flaps?', 'number plates?', 'plate (?:holders?|screws?)', 'car awnings?', 'winch(?:es)?', 'ratchet power puller']),
    ctx: true
  },
  {
    slug: 'interior-comfort',
    include: words(['seat covers?', 'car seat covers?', 'seat (?:cushions?|protectors?|organi[sz]ers?|gap fillers?)', 'floor mats?', 'car mats?', 'boot (?:liners?|mats?|organi[sz]ers?|tidy)', 'organi[sz]ers?', 'sun ?shades?', 'sunshades?', 'steering wheel covers?', 'car vacuums?', 'handheld vacuum', 'dustbuster', 'cool ?box(?:es)?', 'car fridges?', 'heated seat (?:covers?|cushions?|pads?)', '12v (?:heated )?blankets?', 'headrest hooks?', 'cup holders?', 'back seat organi[sz]ers?', 'dog (?:guards?|seat covers?)', 'pet seat covers?']),
    ctx: true,
    exclude: words(['tool (?:rolls?|bags?)', 'bit (?:organi[sz]ers?|dispensers?)', 'boorbit\\w*', 'drill bits?', 'desks?', 'bureau\\w*', 'kantoor\\w*', 'office', 'component', 'cylinder head'])
  },
  {
    slug: 'parts-maintenance',
    include: words(['wiper blades?', 'windscreen wipers?', 'wipers?', 'bulbs?', 'h(?:1|3|4|7|11)', 'headlights?', 'tail ?lights?', 'oil filters?', 'air filters?', 'cabin filters?', 'pollen filters?', 'fuel filters?', 'engine oils?', 'motor oils?', '[05]w-?\\d{2}', 'brake (?:pads?|discs?|fluid|shoes?|calipers?)',
      'spark plugs?', 'glow plugs?', 'coolant', 'antifreeze', 'screen ?wash', 'timing belts?', 'shock absorbers?', 'suspension (?:springs?|arms?|kits?)', 'exhaust (?:pipes?|clamps?|silencers?|tips?)', 'alternators?', 'starter motors?', 'clutch(?:es| kits?)?', 'fuses?', 'gaskets?', 'radiators?', 'mirror (?:glass|covers?)', 'wing mirrors?', 'fuel additives?', 'oil additives?', 'ball joints?', 'track rod ends?', 'cv boots?', 'dust covers?', 'adblue', 'diesel exhaust fluid']),
    ctx: true,
    notInToolShop: true,
    exclude: words(['tools?', 'kits? for', 'sockets?', 'wrench(?:es)?', 'spanners?', 'pullers?', 'gauges?', 'testers?', 'removers?', 'installers?', 'clamps? tool', 'pliers', 'extractors?', 'cleaning brush', 'bleeders?', 'wind ?back', 'spreaders?', 'keys?', 'compressors?', 'lawnmower', 'garden', 'funnels?', 'splitters?', 'test caps?', 'adaptors?', 'couplers?', 'hooks?', 'checkers?'])
  },
  {
    slug: 'garage-tools-equipment',
    include: words(['trolley jacks?', 'car jacks?', 'bottle jacks?', 'scissor jacks?', 'axle stands?', 'creepers?', 'car ramps?', 'ramps?', 'engine (?:hoists?|cranes?|stands?|supports?)', 'transmission jacks?', 'wheel dolly', 'socket sets?', 'torque wrench(?:es)?', 'impact wrench(?:es)?', 'breaker bars?', 'oil (?:drainers?|drain pans?|extractors?|filter wrench(?:es)?)', 'grease guns?', 'workshop', 'garage', 'mechanics?', 'inspection lamps?', 'work lights?', 'tool (?:chests?|trolleys?|boxes?|kits?)', 'compressors?', 'spark plug sockets?', 'brake (?:tools?|bleeders?|piston)', 'pullers?', 'wagenheber', 'krik', 'funnels?', 'parts washers?', 'magnetic (?:trays?|holders?|hooks?)', 'gearbox support', 'splitters?', 'coolant pressure test\\w*', 'radiator (?:coupler|adaptor)\\w*', 'fuse (?:checker|puller|tester)s?']),
    ctx: true
  }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['garage-tools-equipment', 'diagnostics-battery', 'parts-maintenance', 'tyres-wheels', 'car-care-detailing', 'car-electronics', 'interior-comfort', 'roof-towing-exterior', 'ev-charging', 'safety-winter'];

// Minimum quality for any product to be imported (L14). Prices in pounds or euros (euro prices get "≈ £").
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 6000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

const TYRE_SIZE = /(?:^|[^0-9])\d{3}\s?\/\s?\d{2}\s?[ZVW]?R\s?F?\s?\d{2}(?:[.,]5)?C?(?![0-9])/i;
// "quad" only as a word: Kleber Quadraxer is a car all-season tyre (second Pneus.be dry run, 31 Oct 2026).
const TWO_WHEEL_FEED = /\bmoto\w*|motorbike|motorcycle|scooter|\bquads?\b|\bv[ée]lo|bicycle|\bbike|fiets|fahrrad|\bkart/i;
const GARDEN_FEED = /garden machinery|(?:^|\|)\s*garden tools\b/i;
const VEHICLE_FEED = /> motor vehicles >|snowmobiles|> vehicles > (?:motor|watercraft|aircraft)/i;
const VEHICLE_FEED_OK = words(['de-?icers?', 'ice scrapers?', 'screenwash', 'covers?']);
const TOOL_WORDS = words(['trays?', 'washers?', 'stands?', 'holders?', 'dispensers?', 'pliers', 'tools?', 'tool (?:kit|set)s?', 'kits?', 'sets?', 'wrench(?:es)?', 'spanners?', 'sockets?', 'removers?', 'pullers?', 'gauges?', 'testers?', 'clamps?', 'punch(?:es)?', 'installers?', 'extractors?', 'compressors?']);

// Tools that are only ever for cars, even without the word "car" (shops without car categories, e.g. GS Workwear):
// "Hydraulic Spring Compressor", "Spark Plug Socket", "Flywheel Puller", "Brake Pipe Flaring Tool".
const CAR_ONLY_TOOL = words(['coil spring compressors?', 'spring compressors?', 'spark plugs?', 'glow plugs?', 'flywheel', 'clutch', 'camshaft', 'crankshaft',
  'cylinder head', 'timing (?:tools?|kits?|belts?|chains?)', 'brake (?:pipes?|calipers?|pistons?|bleed\\w*|discs?|pads?|shoes?|fluid)', 'oil filter',
  'wheel (?:nuts?|bearings?|studs?)', 'hub (?:pullers?|grips?)', 'ball joints?', 'track rods?', 'tie rods?', 'cv joints?', 'gearbox', 'exhaust',
  'injectors?', 'fuel (?:pumps?|lines?)', 'steering (?:wheel|rack|lock)', 'suspension', 'shock absorbers?', 'battery terminals?', 'alternators?']);

// A tool shop's car section (Tooled Up, My Tool Shed: "Automotive Tools > ...").
const toolShop = cat => /(?:^|\|)\s*automotive tools\b/i.test(String(cat || ''));

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
export function classify(name, feedCategory = '', paths = '') {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`;
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  // A tyre size ("205/55 R16 91V", "235/45ZR18") is a car tyre even without the word "tyre": tyre shops such as
  // Pneus.be (Awin 82533) name tyres by brand, model and size only (31 Oct 2026, lessons L87). Motorbike, quad and
  // bicycle tyres stay out (Biker Gear World later).
  if (TYRE_SIZE.test(n)) {
    if (TWO_WHEEL_FEED.test(cat) || TWO_WHEEL_FEED.test(n)) return { ok: false, reason: 'motorbike or bicycle' };
    return { ok: true, slug: 'tyres-wheels' };
  }
  // Spark plugs and engine oil for lawnmowers, and whole vehicles (snowmobiles) listed under "Motor Vehicles".
  if (GARDEN_FEED.test(cat)) return { ok: false, reason: 'garden or farm machine' };
  if (VEHICLE_FEED.test(cat) && !VEHICLE_FEED_OK.test(n)) return { ok: false, reason: 'a vehicle, not gear' };
  const carFeed = CAR_FEED.test(cat);
  const ctx = carFeed || CAR_WORDS.test(n);
  const shop = toolShop(cat);
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    if (r.notInToolShop && shop) continue;
    // Rules are tested on the name; the shop category helps only inside a car section.
    const hit = r.include.test(n) || (carFeed && r.include.test(cat));
    if (hit && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  // Everything else in a tool shop's car section is a garage tool (pullers, brake tools, engine tools ...).
  if (shop) return { ok: true, slug: 'garage-tools-equipment' };
  // A tool that is only ever for cars ("Hydraulic Spring Compressor", "Spark Plug Socket") is a garage tool.
  if (CAR_ONLY_TOOL.test(n) && TOOL_WORDS.test(n)) return { ok: true, slug: 'garage-tools-equipment' };
  // A tool in a car category of the shop ("Trim Clip Removal Pliers", "Piston Ring Pliers") is a garage tool too.
  if (carFeed && TOOL_WORDS.test(n)) return { ok: true, slug: 'garage-tools-equipment' };
  return { ok: false, reason: carFeed ? 'not matched (shop says car)' : 'not car' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]".
export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
