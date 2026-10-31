// Biker Gear World: which feed products belong on this site, and in which category (lessons L14, L65).
//
// The owner (29 Oct 2026): motorbikes and scooters, kids' kick scooters too. Bicycles and e-bikes stay on Sporty Gear
// World. The first rules follow the motorbike feed scan of 31 Oct 2026 (tools/moto-feed-scan.mjs): most of its 2,681
// matches were look-alikes ("Moto G06" phones, "MX" mice, screen protectors, "Schutzhelm" hard hats, "ATV" power supplies,
// "Video Scooter" MP3 players), so a product needs a real motorbike or scooter signal here.
//
// How a product is classified (by tools/bgw-import-plan.mjs):
//   1. The SHOP decides first (sites/bgw/sources.json, "allowPaths"): only products from a shop's motorbike or scooter
//      sections come in (Tooled Up "Cycle & Motorcycle > Motorcycle", Joybuy "Riding Scooters"). Its "Cycle" sections stay out.
//   2. DENY rules on the PRODUCT NAME send things to the right Gear World or leave them out: bicycles and e-bikes (Sporty),
//      car-only products (Car), fashion biker jackets and boots (Men's / Women's), kids' ride-on toys (Kids'), hard hats and
//      work tools (Construction), phones and computer parts (Technology), horse riding, mobility and sea scooters, gifts and
//      models. Some DENY rules give way when the name says motorbike or scooter ("Car & Motorcycle Battery Charger").
//   3. The FIRST rule whose `include` matches the NAME and whose `exclude` does not wins. Order matters: protection, helmets
//      and clothing first, then the e-scooter and kick scooter rules (their own parts go with them), the vehicles, then
//      intercoms, luggage and parts. General words ("gloves", "stand", "oil", "lock") count only with a motorbike or
//      scooter word in the name or a motorbike section of the shop (ctx).
//   4. Second chance: the shop's own motorbike section names the category ("Motorcycle Lifts & Stands").
//   5. No match: rejected as "not motorbike or scooter".

import { fixMojibake } from '../../src/db.js';

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// A shop section about motorbikes or scooters. "Cycle & Motorcycle" is the parent of Tooled Up's bicycle sections too,
// so it is taken out of the path before this test.
const MOTO_FEED = /motor ?cycle|motor ?bike|riding scooters?|kick scooters?|electric scooters?|mopeds?|motocross|powersports/i;
const BOTH_FEED = /cycle (?:&|and) motor ?cycle/gi;

// Words in a NAME that say motorbike or scooter. "MX", "Moto" and "ATV" alone are not here (phones, mice, power supplies).
const MOTO_STRICT = words(['motor ?bikes?', 'motor ?cycles?', 'motor ?cycling', 'motocross', 'moto ?cross', 'motorfiets\\w*', 'motorrad\\w*',
  'scooters?', 'e[- ]?scooters?', 'mopeds?', 'paddock', 'pit ?bikes?', 'dirt ?bikes?', 'quad ?bikes?', 'superbikes?', 'enduro',
  'ninebot', 'segway', 'vespa', 'lambretta', 'ducati', 'kawasaki', 'ktm', 'harley(?:-davidson)?',
  'alpinestars', 'dainese', 'richa', 'shoei', 'arai', 'hjc', 'agv', 'ls2', 'caberg', 'nolan', 'tcx', 'furygan', 'rst', 'spada',
  'frank thomas', 'weise', 'knox', 'forcefield', 'kriega', 'givi', 'shad', 'sw-motech', 'cardo', 'sena', 'interphone',
  'optimate', 'motul', 'putoline', 'silkolene', 'scottoiler', 'tutoro', 'pinlock', 'loboo', 'oxford (?:products|monster|boss|hd|rainseal)']);
const BIKER = words(['bikers?']);

// Kids' ride-on toys (Kids' Gear World). Kids' helmets, gloves and kick scooters are BGW products (owner, 29 Oct 2026).
const KIDS = words(['kids?', "kid'?s", 'children', "children'?s", 'child', 'toddlers?', 'boys?', 'girls?', 'junior', 'youth']);
const RIDE_ON = words(['quads?', 'quad ?bikes?', 'atvs?', 'motor ?bikes?', 'motor ?cycles?', 'dirt ?bikes?', 'cars?', 'jeeps?', 'tractors?', 'trucks?', 'go[- ]?karts?']);
const KIT = words(['helmets?', 'gloves?', 'boots?', 'jackets?', 'trousers', 'pants', 'goggles', 'protectors?', 'armou?r', 'body ?guards?', 'jerseys?', 'kits?']);

export const DENY = [
  { label: 'bicycle or e-bike (Sporty Gear World)', unlessMoto: true, re: words(['bicycles?', 'cycling', 'cyclists?', 'cycle (?:helmets?|lights?|locks?|computers?|racks?|pumps?|gloves?|jackets?|shorts|shoes)',
    'e-?bikes?', 'electric (?:bikes?|bicycles?)', '(?:mountain|road|gravel|hybrid|folding|trekking|city|commuter|balance|fat ?tyre|bmx) bikes?', 'mtb', 'bmx',
    'derailleurs?', 'chainrings?', 'cranksets?', 'shimano', 'sram', 'pedals?', 'bottom brackets?', 'bike (?:lights?|bells?|computers?|pumps?|baskets?|bottle cages?|saddles?|stands? for (?:bicycles?|cycles?))',
    'fietsen?\\w*', 'fahrrad\\w*']) },
  // "Bike" alone, with no motorbike word, is a bicycle ("Bike Lights Set USB", "Bike Lock D Lock").
  { label: 'bicycle or e-bike (Sporty Gear World)', unlessMoto: true, re: /(?:^|[^a-z0-9])bikes?(?![a-z0-9])/i },
  { label: 'car product (Car Gear World)', unlessMoto: true, re: words(['cars?', 'car (?:seats?|boot|roof|wash|tyres?|batter(?:y|ies)|chargers?)', 'vans?', 'suvs?', 'trucks?', 'lorr(?:y|ies)', 'vrachtwagens?', 'automobiel', 'caravans?', 'motorhomes?', 'tow ?bars?', 'towbars?', 'trailer hitch\\w*', 'roof (?:bars?|racks?|boxes?)']) },
  { label: 'fashion biker jacket or boots (Men\'s / Women\'s Gear World)', unlessMoto: true, re: words(['biker (?:jackets?|boots?|bags?|vests?|gilets?|jeans|style)', 'chelsea boots?', 'ankle boots?', 'heeled', 'heels?', 'faux leather', 'pu leather', 'vegan leather', 'womens? leather jackets?', 'cropped', 'fashion']) },
  { label: 'kids\' ride-on toy (Kids\' Gear World)', re: words(['ride[- ]?ons?', 'toys?', 'toy (?:motor ?bikes?|motorcycles?|scooters?)', 'play vehicles?', 'push ?alongs?', 'rocking (?:horses?|motor ?bikes?)', 'foot to floor', 'sit[- ]on', 'balance bikes?', 'trikes?', 'tricycles?', 'kinder\\w*']) },
  { label: 'work helmet, hard hat or tool (Construction Gear World)', re: words(['hard ?hats?', 'safety helmets?', 'schutzhelm\\w*', 'bump caps?', 'ear defenders?', 'climbing helmets?', 'deburring', 'bolsters?', 'chisels?', 'welders?', 'welding', 'angle grinders?', 'winkelschleifer', 'hi-?vis (?:workwear|coveralls?|trousers|polo)', 'safety (?:boots?|shoes?|trainers?)', 'work (?:boots?|gloves?|wear|trousers)', 'workwear', 'steel toe\\w*']) },
  { label: 'phone or computer part (Technology Gear World)', re: words(['motorola', 'moto (?:g|e|x|z)\\d*\\w*', 'moto edge', 'screen protectors?', 'mobile phone (?:screen|back)\\w*', 'keyboards?', 'keycaps?', 'mouse', 'mice', 'thermal paste', 'mp3', 'psu', 'power supply', 'printers?', 'scanners?', 'laptops?', 'notebook', 'tablets?', 'ethernet', 'sfp\\+?', 'transceivers?', 'apfc', 'spare part/accessory', 'graphics cards?', 'motherboards?', 'ssd', 'hdd', 'smart ?watch(?:es)?', 'earbuds', 'head ?phones?']) },
  { label: 'horse riding (not motorbike)', unlessMoto: true, re: words(['equestrian', 'horses?', 'horse riding', 'jodhpurs?', 'riding (?:hats?|helmets?|boots?|tights|breeches|gloves?|crops?)', 'saddles?(?! ?bags?)', 'bridles?', 'stirrups?', 'girths?', 'numnahs?', 'hoof\\w*', 'ponies', 'pony', 'paddock boots?', 'jockey']) },
  { label: 'mobility, sea or video scooter (not a riding scooter)', re: words(['mobility (?:scooters?|aids?)', 'mobility', 'scootmobiel\\w*', 'sea scooters?', 'underwater scooters?', 'dive scooters?', 'water scooters?', 'knee (?:scooters?|walkers?)', 'video scooter', 'wheelchairs?', 'rollators?', 'hoverboards?', 'skateboards?', 'snow scooters?', 'scooter (?:boards?|mp3)']) },
  { label: 'gift, model or clothing print', re: words(['die[- ]?cast', 'scale models?', 'models? (?:motor ?bikes?|motorcycles?|kits?|scooters?)', '1:\\d{1,2}', 'cufflinks?', 'birthday', 'greeting cards?', 'gift cards?', 'vouchers?', 'posters?', 'wall art', 'canvas prints?', 'stickers?', 'decals?', 'mugs?', 'keyrings?', 'key ?chains?', 'fridge magnets?',
    't-?shirts?', 'tees?', 'hoodies?', 'sweatshirts?', 'baseball caps?', 'snapbacks?', 'beanies?', 'jewell?ery', 'necklaces?', 'pendants?', 'bracelets?', 'earrings?', 'watch(?:es)?', 'lingerie', 'bras?', 'underwear', 'pyjamas?',
    'books?', 'jigsaws?', 'puzzles?', 'lego', 'playmobil', 'christmas', 'novelty', 'costumes?', 'fancy dress', 'figurines?', 'ornaments?', 'cake toppers?', 'party']) },
  { label: 'service, insurance or not allowed', re: words(['warranty', 'installation', 'insurance', 'training course', 'lessons?', 'cbt', 'hire', 'rental', 'subscription', 'knife', 'knives', 'machete', 'air (?:rifles?|pistols?|guns?)', 'bb guns?', 'pepper spray', 'stun gun', 'taser', 'vape', 'e-?cig\\w*', 'unrestricted', 'derestrict\\w*', 'de-?restrict\\w*', 'speed (?:limiter )?(?:removal|unlock)\\w*']) },
  { label: 'not new (no "Used" label on the site)', re: words(['\\(used\\)', 'used - (?:like new|very good|good|acceptable)', 'pre-?owned', 'second-?hand', 'refurb(?:ished)?', 'renewed', 'open[- ]box', 'ex[- ]display', 'b-?grade', 'preloved']) }
];

// Things that are a part or an accessory, not the vehicle itself (a moped cover is Luggage, not a moped).
const ACCESSORY = ['covers?', 'helmets?', 'stands?', 'batter(?:y|ies)', 'chargers?', 'tyres?', 'tires?', 'inner tubes?', 'locks?', 'alarms?',
  'mirrors?', 'parts?', 'mounts?', 'holders?', 'bags?', 'boxes', 'box', 'grips?', 'lights?', 'lamps?', 'bulbs?', 'brakes?', 'pads?', 'chains?', 'sprockets?',
  'oils?', 'filters?', 'plugs?', 'cables?', 'levers?', 'seats?', 'screens?', 'gloves?', 'jackets?', 'boots?', 'ramps?', 'lifts?', 'jacks?'];

// A vehicle word, and an accessory word right after it ("moped cover", "pit bike tyres") or "for a moped". A vehicle's own
// specs do not count ("Electric Motorcycle, 2800W Motor, 72V 30Ah Battery").
const VEHICLE = '(?:motor ?bikes?|motor ?cycles?|mopeds?|scooters?|pit ?bikes?|dirt ?bikes?|quad ?bikes?|quads?|atvs?)';

// ctx: true = only with a motorbike or scooter word in the name or a motorbike section of the shop.
export const RULES = [
  {
    slug: 'protection',
    include: words(['back protectors?', 'chest protectors?', 'spine protectors?', 'body ?armou?r', 'armou?r (?:inserts?|vests?|shirts?|jackets?)', 'airbag (?:vests?|jackets?|systems?)', 'knee sliders?', 'roost deflectors?', 'neck braces?', 'ce level [12]', 'level [12] (?:back|chest|armou?r)\\w*'])
  },
  {
    slug: 'protection',
    include: words(['(?:knee|elbow|shoulder|hip|shin) (?:guards?|pads?|protectors?|armou?r)', 'protective (?:vests?|shorts|shirts?|jackets?|gear)', 'hi-?vis\\w*', 'high visibility', 'reflective (?:vests?|bands?|belts?|sashes?|tape|stickers?)', 'pressure suits?', 'body ?guards?']),
    ctx: true
  },
  {
    slug: 'helmets',
    include: words(['(?:motor ?(?:bike|cycle)|moto ?cross|mx|scooter|moped|full[- ]face|flip[- ]?(?:front|up)|modular|open[- ]face|jet|adventure|dual[- ]sport|enduro|trials?|off[- ]road|retro|cafe racer|carbon) helmets?', 'helmet (?:visors?|peaks?|liners?|bags?|locks?|spoilers?)', 'pinlock\\w*', 'ece 22\\.0[56]'])
  },
  {
    slug: 'helmets',
    include: words(['helmets?', 'visors?', 'goggles', 'tear[- ]?offs?', 'roll[- ]?offs?']),
    exclude: words(['hard hats?', 'safety helmets?', 'welding', 'ski', 'snowboard', 'climbing']),
    ctx: true
  },
  {
    slug: 'jackets-trousers',
    include: words(['jackets?', 'trousers', 'jeans', 'pants', 'leathers', '(?:one|two|1|2)[- ]piece (?:suits?|leathers)', 'race suits?', 'over-?suits?', 'over-?trousers', 'rain ?suits?', 'waterproof (?:suits?|covers? for jackets?)', 'base ?layers?', 'thermal (?:tops?|leggings|vests?|layers?)', 'neck (?:warmers?|tubes?)', 'balaclavas?', 'snoods?', 'jerseys?', 'riding (?:suits?|shirts?)', 'kevlar (?:jeans|hoodies?|shirts?)', 'armou?red (?:jeans|hoodies?|shirts?|leggings)']),
    exclude: words(['jacket (?:hangers?|racks?)', 'airbag']),
    ctx: true
  },
  {
    slug: 'boots-gloves',
    include: words(['boots?', 'gloves?', 'gauntlets?', '(?:handlebar|hand) muffs?', 'muffs?', 'boot (?:covers?|bags?|liners?)', 'overboots?', 'glove (?:liners?|bags?)', 'heated (?:gloves?|insoles?|socks?)', 'riding (?:shoes?|socks?)', 'boot socks?']),
    exclude: words(['boot (?:racks?|lifts?|trays?|liners for cars?)', 'car boot']),
    ctx: true
  },
  {
    // E-scooters and their own parts (the category page says: "plus e-scooter tyres, chargers, locks and bags").
    slug: 'electric-scooters',
    include: words(['e[- ]?scooters?', 'electric (?:kick |folding |foldable |commuter |off[- ]road )?scooters?', 'elektrische (?:step|scooter)\\w*', 'ninebot', 'segway', 'escape ultra', 'pure (?:air|advance|escape|flex)\\w*', 'xiaomi (?:mi )?(?:electric )?scooter\\w*'])
  },
  {
    // Electric motorbikes, mopeds and small motorbikes (before kick scooters: a "125cc scooter" is a moped).
    slug: 'electric-motorbikes',
    include: words(['electric (?:motor ?bikes?|motor ?cycles?|mopeds?|dirt ?bikes?|pit ?bikes?|off[- ]road (?:bikes?|motor ?bikes?)|scooter mopeds?)', 'e-?(?:motor ?bikes?|motor ?cycles?|mopeds?)', 'mopeds?',
      '\\d{2,3} ?cc (?:scooters?|motor ?bikes?|motor ?cycles?|pit ?bikes?|dirt ?bikes?|quads?|atvs?)', 'pit ?bikes?', 'dirt ?bikes?', 'quad ?bikes?', 'super soco', 'yadea', 'lexmoto', 'sur-?ron', 'talaria', 'niu (?:nqi|mqi|uqi)\\w*', '\\d{3,5} ?w (?:electric )?(?:motor ?bikes?|motor ?cycles?)']),
    exclude: words([`(?:for|voor) (?:an? |your )?(?:electric )?${VEHICLE}`, `${VEHICLE}(?: \\w+)? (?:${ACCESSORY.join('|')})`])
  },
  {
    slug: 'kick-scooters',
    include: words(['kick ?scooters?', 'stunt scooters?', 'trick scooters?', 'pro scooters?', 'freestyle scooters?', '(?:2|3|two|three)[- ]wheel(?:ed)? scooters?', 'folding scooters?', 'foldable scooters?', 'adult scooters?', 'city scooters?', 'commuter scooters?', 'micro (?:maxi|mini|sprite|suspension|scooter)\\w*', 'globber', 'scooter (?:wheels?|grips?|decks?|bars?|clamps?|forks?|bearings?|brakes?|pegs?|headsets?|griptape|bells?|straps?|bags?|stands?)']),
    exclude: words(['electric', 'e-?scooters?', 'mopeds?', '\\d{2,3} ?cc'])
  },
  {
    // A scooter with nothing else said: a kick scooter ("Evo Move n Groove Scooter – Blue"). Its lock or cover is Luggage.
    slug: 'kick-scooters',
    include: words(['scooters?']),
    exclude: words(['electric', 'e-?scooters?', 'mopeds?', '\\d{2,3} ?cc', 'petrol', 'motor ?(?:bike|cycle)s?', 'locks?', 'covers?', 'alarms?', 'top ?box\\w*', 'chargers?', 'batter(?:y|ies)', 'mounts?', 'holders?', 'oils?', 'tyres?', 'mirrors?', 'stands? for (?:motor|mopeds?)'])
  },
  {
    slug: 'electronics',
    include: words(['intercoms?', 'cardo', 'sena (?:\\d+\\w*|smh\\w*|srl\\w*|spider\\w*|packtalk\\w*|outrush\\w*)', 'packtalk\\w*', 'interphone', 'quad ?lock', 'helmet (?:cam(?:era)?s?|speakers?|headsets?|communicators?)']),
  },
  {
    slug: 'electronics',
    include: words(['bluetooth (?:headsets?|communicators?|speakers?)', 'communication systems?', 'phone (?:mounts?|holders?|cradles?|cases? for (?:handlebars?|motor\\w*))', 'handlebar (?:mounts?|phone holders?)', 'sat ?navs?', 'gps (?:navigators?|trackers?|units?|mounts?)', 'navigat(?:ors?|ion)', 'dash ?cams?', 'action cam(?:era)?s?', 'camera mounts?', 'usb (?:chargers?|sockets?|ports?|outlets?)', 'wireless chargers?', 'tyre pressure (?:monitors?|sensors?|monitoring\\w*)', 'tpms', 'trackers?', 'carplay', 'android auto', 'radar detectors?']),
    ctx: true
  },
  {
    slug: 'luggage-security',
    include: words(['top ?box(?:es)?', 'top ?cases?', 'topcase\\w*', 'motorkoffer\\w*', 'panniers?', 'tank ?bags?', 'tail ?bags?', 'tail ?packs?', 'seat bags?', 'disc locks?', 'disc lock alarms?', 'ground anchors?', '(?:wall|floor) anchors?', 'security chains?', '(?:motor ?bike|motor ?cycle|scooter|moped) covers?', 'saddle ?bags?', 'saddlebags?']),
    exclude: words(['bicycles?'])
  },
  {
    slug: 'luggage-security',
    include: words(['luggage (?:racks?|systems?|plates?)', 'roll[- ]?(?:bags?|tops?)', 'dry ?bags?', 'backpacks?', 'rucksacks?', 'bags?', 'locks?', 'padlocks?', 'chain locks?', 'shackle locks?', 'cable locks?', 'u-?locks?', 'alarms?', 'immobili[sz]ers?', 'covers?', 'rain covers?', 'cargo nets?', 'bungee (?:cords?|nets?|straps?)', 'rear racks?', 'sissy bars?', 'mounting (?:plates?|kits?) for (?:top ?box\\w*|panniers?)']),
    exclude: words(['chain lube', 'seat covers? for cars?']),
    ctx: true
  },
  {
    slug: 'parts-maintenance',
    include: words(['paddock stands?', 'paddock stand (?:sets?|bobbins?)', 'bobbins', 'motor ?(?:bike|cycle) (?:lifts?|stands?|jacks?|ramps?|dollies?|wheel chocks?)', 'chain (?:lube|lubes|lubricants?|cleaners?|wax|oil|kits?|breakers?|riveters?|splitters?|alignment\\w*|brush(?:es)?)', 'chain (?:and|&) sprocket\\w*',
      'sprockets?', 'fork oil', '(?:2|4|two|four)[- ]?(?:t|stroke) (?:engine )?oils?', '1[05]w[- ]?[345]0', '20w[- ]?50', 'battery (?:chargers?|tenders?|optimi[sz]ers?|maintainers?)', 'optimate', 'scottoiler', 'tyre (?:levers?|changers?|inflators?|pumps?|repair kits?|warmers?)', 'tyre warmers?', 'crash (?:bungs?|bars?|protectors?)', 'frame sliders?', 'heated grips?']),
  },
  {
    slug: 'parts-maintenance',
    include: words(['stands?', 'lifts?', 'jacks?', 'wheel chocks?', 'chocks?', 'front wheel clamps?', 'wheel clamps?', 'oils?', 'lube\\w*', 'lubricants?', 'grease', 'brake (?:pads?|fluid|discs?|levers?|bleeders?|shoes)', 'batter(?:y|ies)', 'chargers?', 'tyres?', 'tires?', 'inner tubes?', 'puncture repair\\w*', 'tyre\\w*',
      'inflators?', '(?:foot|track|hand|stirrup) pumps?', 'air compressors?', 'compressors?', 'spark plugs?', '(?:air|oil|fuel) filters?', 'filters?', 'mirrors?', 'levers?', 'grips?', 'indicators?', 'headlights?', 'head ?lamps?', 'tail ?lights?', 'bulbs?', 'leds?', 'exhausts?', 'silencers?', 'windscreens?', 'wind ?shields?', 'screens?', 'hand ?guards?',
      'cleaners?', 'polish\\w*', 'degreasers?', 'protectants?', 'wash\\w*', 'sponges?', 'microfib(?:re|er)s?', 'tools?', 'tool (?:kits?|sets?|rolls?|boxes)', 'spanners?', 'wrench(?:es)?', 'sockets?', 'socket sets?', 'pullers?', 'extractors?', 'compressors?', 'gauges?', 'torque\\w*', 'ramps?', 'loading ramps?', 'trailers?', 'transport\\w*', 'tie[- ]?downs?', 'ratchet straps?', 'straps?', 'dollies?', 'dolly', 'creepers?', 'workshop\\w*', 'service (?:kits?|stands?)', 'carb(?:urett?ors?)?', 'cables?', 'clutch\\w*', 'gaskets?', 'pistons?', 'fuel (?:cans?|caddies?|tanks?|taps?|pumps?)', 'jerry cans?', 'spoke\\w*', 'valve\\w*', 'bearings?', 'seals?', 'fork\\w*', 'shocks?', 'suspension', 'chains?', 'pads?', 'drip trays?', 'shelters?', 'garages?', 'storage tents?', 'vices?', 'kits?']),
    ctx: true
  }
];

// Second chance (step 4): the shop's own motorbike section names the category. Checked in this order on the shop's path.
// Not for shops whose sub-sections are unreliable (sources.json "sectionHints": false, Joybuy, as on SGW).
export const SECTION_RULES = [
  { slug: 'helmets', re: /motor ?(?:cycle|bike) helmets?/i },
  { slug: 'boots-gloves', re: /motor ?(?:cycle|bike) (?:boots|gloves)/i },
  { slug: 'jackets-trousers', re: /motor ?(?:cycle|bike) (?:jackets|pants|trousers|suits|clothing)/i },
  { slug: 'protection', re: /motor ?(?:cycle|bike) (?:armou?r|protectors?|body protection)/i },
  { slug: 'luggage-security', re: /motor ?(?:cycle|bike) (?:bags|panniers|luggage|locks?|security|covers)/i },
  { slug: 'electronics', re: /motor ?(?:cycle|bike) (?:electronics|intercoms|communication|mounts)/i },
  { slug: 'electric-scooters', re: /electric scooters?/i },
  { slug: 'kick-scooters', re: /kick scooters?|riding scooters?/i },
  { slug: 'parts-maintenance', re: /motor ?(?:cycle|bike) (?:tools|lifts|stands|parts|maintenance|workshop|tyres|batter)/i }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['helmets', 'jackets-trousers', 'boots-gloves', 'parts-maintenance', 'luggage-security', 'electronics', 'electric-scooters', 'kick-scooters', 'electric-motorbikes', 'protection'];

// Minimum quality for any product to be imported (L14). Prices in pounds or euros (euro prices get "≈ £").
// An electric motorbike can cost a few thousand pounds.
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 8000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
export function classify(name, feedCategory = '', paths = '', source = null) {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`.replace(BOTH_FEED, ' ');
  const moto = MOTO_STRICT.test(n);
  for (const d of DENY) {
    if (d.unlessMoto && moto) continue;
    if (d.re.test(n)) return { ok: false, reason: d.label };
  }
  // "Biker" alone is fashion ("Leather Biker Jacket Women"); a real motorbike jacket names motorbike, a brand or armour.
  if (BIKER.test(n) && !moto && !/armou?r|\bce\b|protect|cordura|kevlar|aramid/i.test(n)) return { ok: false, reason: 'fashion biker jacket or boots (Men\'s / Women\'s Gear World)' };
  if (KIDS.test(n) && RIDE_ON.test(n) && !KIT.test(n)) return { ok: false, reason: 'kids\' ride-on toy (Kids\' Gear World)' };
  const motoFeed = MOTO_FEED.test(cat);
  const ctx = moto || motoFeed;
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    if (r.include.test(n) && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  const hints = !source || source.sectionHints !== false;
  if (hints && motoFeed) for (const s of SECTION_RULES) if (s.re.test(cat)) return { ok: true, slug: s.slug };
  return { ok: false, reason: motoFeed ? 'not matched (shop says motorbike)' : 'not motorbike or scooter' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]", and some end with the
// size the visitor picks on the shop's page ("... - Black | Size: S", "Helmet Matte Black M 57-58cm").
// Sizes are taken out, so every size is one card at its lowest price (owner's rule for duplicates, as on SGW).
// A lone S, M or L counts only after a colour or a helmet.
const COLOURS = '(?:black|white|gr[ae]y|blue|red|green|pink|orange|yellow|purple|brown|navy|khaki|beige|lilac|mint|camo|silver|gold|cream|ivory|olive|teal|maroon|burgundy|charcoal|coral|peach|tan|sand|stone|titan(?:ium)?|matte? \\w+|gloss \\w+|(?:dark|light|deep|sky|royal) \\w+)';
const SIZE_AFTER_COLOUR = new RegExp(`(\\b${COLOURS})\\s+(?:S|M|L)(?:\\s+\\d{2}-\\d{2}\\s?cm)?$`, 'i');
const SHOE = /\b(?:shoes?|boots?|trainers?|sneakers?)\b/i;

export function cleanProductName(name) {
  let n = fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s*\|\s*Size:\s*[^|]{1,20}$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^EU ?\d{2}(?:\.5| [12]\/3)?\s+/i, '');
  for (let i = 0; i < 2; i++) {
    n = n
      .replace(/[\s,]+(?:size:?\s*)?(?:XXS|XS|XXL|XXXL|[2-5]XL|XL)(?:\s+\d{2}-\d{2}\s?cm)?(?:\s+size)?$/i, '')
      .replace(/[\s,]+size:?\s*(?:S|M|L)$/i, '')
      .replace(/\s+(?:S|M|L)\s+size$/i, '')
      .replace(SIZE_AFTER_COLOUR, '$1')
      .replace(/\s+-\s+(?:EU\s?)?(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i, '')
      .replace(/(\b(?:helmets?|[A-Z]{1,4}-\d{2,4}[A-Z]?(?:-\d+)?))\s+(?:S|M|L)(?:\s+\d{2}-\d{2}\s?cm)?$/i, '$1')
      .replace(/\s*\((?:EU\s?)?\d{2}(?:\.5)?\)$/i, '')
      .replace(/\s+EU ?\d{2}(?:\.5| [12]\/3)?$/i, '');
    if (SHOE.test(n)) n = n.replace(/\s+(?:3[4-9]|4[0-9])(?:\.5)?$/, '');
  }
  return n.replace(/[\s,\-–]+$/, '').trim();
}
