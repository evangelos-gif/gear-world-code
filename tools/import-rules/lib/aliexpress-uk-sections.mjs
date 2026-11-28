// AliExpress UK (Awin 7035) on the newer sites' engine (tools/tgw-import-plan.mjs): owner, 28 Nov 2026 00:10
// ("AliExpress θέλω για όλες τις κατηγορίες αύριο"), lessons L241. sources.json: "sections": "aliexpress-uk".
// The first wave (tools/import-rules/aliexpress-uk.mjs, L239) put the shop on WGW, MGW, KGW and HGW; this one places
// the rest of the same three fresh feeds (103140, 103143, 115677: never the old ones of L238) on TGW, AGW, SGW, BGW,
// PGW, ZGW and VGW by the shop's own English sections ("Automobiles, Parts & Accessories , Car Electronics , Car DVR"),
// in the categories (slugs) and subcategories AliExpress PL already uses there (lib/aliexpress-sections.mjs, L157).
//
// What stays out, on top of the first wave's NEVER list (adult, smoking, weapons, medical, replicas, costumes):
// - well-known brands and licensed characters (a marketplace listing is often an imitation), except a device named as
//   what an accessory FITS ("Case for iPhone 17", "Grip for Nintendo Switch 2", "Mats for BMW X5");
// - things that are unsafe or not legal in the UK from a marketplace listing: LED headlight conversions, brake parts,
//   tyres and wheel rims, EV chargers, helmets without the ECE mark, e-bikes and whole motorbikes, shock collars
//   (banned in England), radios that need a licence, jammers, key programmers, number plates, gun accessories, knives;
// - copies: game consoles with preloaded games, game cartridges, TV boxes, big-brand memory, fake capacities.
import { NEVER, KNOWN, hiddenName, displayName, displayBrand } from '../aliexpress-uk.mjs';
import { W, clean } from './wave-a.mjs';

const ok = (slug, sub) => ({ ok: true, slug, sub });
const no = reason => ({ ok: false, reason });

// Never on these sites either (UK law, safety, crime): checked on the whole name.
const TOOL_GUN = '(?<!(?:heat|glue|spray|grease|caulking|caulk|massage|nail|staple|water|foam|soldering|air|blow|blower|paint|rivet|sealant|silicone|screw|wash|washer|cleaning|bubble|snow|dust|lube|oil|tyre|tire|inflator|melt|riveter|label|price|temperature|thermometer|infrared|ir|radar|wax|polishing|tattoo|fascia|percussion|muscle|cupping|hair|sand|sandblasting|blasting|pressure|grout|caulk|squirt|toy|bubble|candy|grease)\\s)';
export const NEVER_MORE = W(['jammers?', 'signal blockers?', 'gps blockers?', 'key programm(?:er|ers|ing)', 'key clon\\w*', 'key copier', 'immobili[sz]er (?:bypass|emulators?|off)', 'immo off',
  'mileage (?:correction|blockers?|stoppers?|adjust\\w*)', 'odometer (?:correction|adjust\\w*)', 'relay attack', 'lock ?picks?', 'lock ?picking', 'bump keys?',
  'number plates?(?! ?(?:lights?|lamps?|bulbs?|led|brackets?|holders?|clips?|screws?|bolts?|fixings?|mounts?))', 'licen[cs]e plates?(?! ?(?:lights?|lamps?|bulbs?|led|brackets?|holders?|clips?|screws?|bolts?|fixings?|mounts?))', '(?:number|licen[cs]e|reg) plate (?:frames?|covers?)', 'red dot', 'rifle ?scopes?', 'riflescopes?', 'scope mounts?', 'picatinny', 'weaver rail',
  'm-?lok', 'keymod', TOOL_GUN + 'guns?', 'firearms?', 'bullet ?proof', 'bullet (?:casings?|shells?|moulds?|molds?|heads?)', 'cartridges? (?:belt|holder)',
  'magazine pouch\\w*', '(?:rifle|gun|pistol|air ?gun|airgun) (?:suppressors?|silencers?|moderators?)', 'solvent traps?', 'muzzle brakes?',
  'trigger (?:guards?|kits?|assembl\\w*)', 'bipods?', 'laser sights?', 'laser pointers?', 'high power lasers?', 'batons?', 'knife', 'knives', 'axe', 'hatchets?',
  'tomahawks?', 'compound bows?', 'recurve bows?', 'longbows?', 'bow and arrows?', 'archery', 'arrow ?(?:heads?|shafts?|tips?)', 'broadheads?',
  '(?:game|retro|console|arcade) emulators?', '\\d+\\s*\\+?\\s*emulators?', 'emulators? (?:for|games?)', 'game roms?', 'roms? (?:games?|packs?)', 'pre-?loaded', 'pre-?installed games?', 'built-?in \\d+ games?',
  '\\d{2,}\\s*\\+?\\s*(?:classic |retro )?games', 'retro game', 'game sticks?', 'iptv', 'free channels?', 'kodi', 'jailbreak\\w*', 'mod ?chips?', 'crypto', 'bitcoin',
  'crypto miners?', 'asic miners?', 'shock collars?', 'e-?collars?', 'electric collars?', 'static collars?', 'anti-?bark', 'bark (?:collars?|control)', 'prong collars?',
  'choke chains?', 'drugs?', 'weed (?:grinders?|pipes?|stash)', 'cannabis', 'cbd', 'kratom', 'nitrous', 'cream chargers?', 'police', 'military',
  // Copied software and dealer data (sold as "full activated", "keygen", "unlimited").
  'keygen', 'full(?:y)? activated', 'activated (?:licen[cs]e|software|version)', 'cracked (?:software|version|licen[cs]e)', 'crack(?:ed)? software', 'unlimited (?:licen[cs]e|tokens?|keygen)', 'chip ?tuning',
  'ecu (?:tuning|programm\\w*|remap\\w*|flash\\w*)', 'dtc remover', 'egr (?:off|delete|remover)', 'dpf (?:off|delete|remover)', 'adblue (?:emulators?|remover|off|delete)',
  'kess', 'ktag', 'haynes', 'autodata', 'alldata', 'xentry', 'odis', 'software (?:dvd|cd|usb|download)', 'dvd software', 'r134a', 'r1234yf', 'refrigerants?',
  'vcds', 'vag ?com', 'hex v2', 'jlr sdd', 'sdd v\\d+', 'autocom', 'remote install\\w*', 'online programming', 'without password',
  // Hidden trackers and recorders (covert tracking of people).
  'hidden (?:gps|trackers?|locators?|microphones?|recorders?|voice recorders?)', 'covert', 'disguised', 'secret (?:recorders?|cameras?|trackers?)',
  'smallest (?:voice )?recorders?', 'cloning', 'clone (?:codes?|remotes?|keys?)', 'duplicators?', 'auto copy',
  // Medical claims and veterinary or medical supplies.
  'blood (?:sugar|glucose|pressure|lipids?)', 'glucose', 'uric acid', 'non-?invasive', 'sutures?', 'veterinary', 'surgical', 'scalpels?', 'ostomy',
  'stoma', 'colostomy', 'hernia', 'varicose', 'pain relief', 'arthritis', 'posture correct\\w*', 'orthop(?:a)?edic', 'scoliosis', 'plantar fasciitis',
  'bunions?', 'therap(?:y|eutic)', 'rehabilitation', 'injury', 'heidelberg', 'komori', 'offset print\\w*']);

// Brands and characters that are never fine, wherever they are in the name (the first wave's KNOWN list, without the
// words that mean something else on these sites: "film" is a screen or wrap film, "tour" a touring bike, "video game" a
// kind of product). The device brands are checked apart (DEVICE), so "for iPhone" stays fine.
const CHARACTERS = W(['disney', 'marvel', 'avengers', 'spider-?man', 'batman', 'superman', 'wonder woman', 'dc comics', 'barbie', 'hello kitty', 'sanrio',
  'kuromi', 'my melody', 'cinnamoroll', 'pochacco', 'paw patrol', 'minions?', 'peppa', 'pokemon', 'pokémon', 'pikachu', 'star wars', 'mandalorian',
  'harry potter', 'hogwarts', 'mickey', 'minnie', 'toy story', 'bluey', 'cocomelon', 'elsa', 'lilo', 'stitch', 'sonic', 'super mario', 'mario', 'luigi',
  'zelda', 'minecraft', 'fortnite', 'roblox', 'among us', 'squid game', 'naruto', 'one piece', 'luffy', 'dragon ball', 'demon slayer', 'jujutsu kaisen',
  'attack on titan', 'my hero academia', 'genshin', 'hatsune', 'miku', 'evangelion', 'labubu', 'pop mart', 'bandai', 'gundam', 'transformers', 'lego',
  'hot wheels', 'nerf', 'care bears', 'funko', 'anime', 'manga', 'kawaii cartoon', 'merch', 'fandom', 'for fans', 'fan art', 'moc', 'jedi', 'darth', 'yoda',
  'grogu', 'stormtroopers?', 'bearbrick', 'wednesday addams', 'stranger things', 'taylor swift', 'k-?pop', 'bts', 'blackpink', 'celebrit(?:y|ies)',
  'real madrid', 'barcelona', 'barca', 'manchester united', 'man utd', 'man city', 'liverpool', 'chelsea', 'arsenal', 'tottenham', 'juventus', 'psg',
  'bayern', 'nba', 'nfl', 'nhl', 'mlb', 'premier league', 'fifa', 'world cup', 'f1 team', 'formula 1', 'ferrari', 'lamborghini', 'porsche design', 'red bull',
  'monster energy', 'harley', 'harley-davidson', 'ducati corse', 'repsol', 'rossi', 'vr46', 'nike', 'adidas', 'jordan', 'air max', 'yeezy', 'puma',
  'new balance', 'converse', 'vans', 'reebok', 'asics', 'under armour', 'north face', 'moncler', 'canada goose', 'stone island', 'gucci', 'louis vuitton',
  'chanel', 'dior', 'prada', 'versace', 'balenciaga', 'burberry', 'fendi', 'herm[eè]s', 'supreme', 'lululemon', 'gymshark', 'salomon', 'hoka', 'on cloud',
  'oakley', 'ray-?ban', 'rolex', 'cartier', 'casio', 'g-?shock', 'swatch', 'stanley', 'yeti', 'owala', 'hydro ?flask', 'coleman', 'patagonia', 'arcteryx',
  "arc'?teryx", 'mammut', 'osprey', 'kong', 'ruffwear', 'furminator', 'flexi', 'samsonite', 'rimowa', 'tumi', 'delsey', 'american tourister', 'thor', 'fox racing', 'fox mx', 'alpinestars', 'dainese', "rev'?it", 'troy lee', 'fly racing', 'leatt', 'klim', 'shimano original', 'rapha', 'castelli', 'assos']);
// Brands that are fine only as what an accessory fits. Tech, games, tools, cars and bikes.
const DEVICE_LIST = ['apple', 'iphone', 'ipad', 'airpods?', 'macbook', 'imac', 'apple watch', 'magsafe', 'samsung', 'galaxy', 'sony', 'playstation', 'ps[2345]',
  'dualsense', 'dualshock', 'psp', 'ps vita', 'xbox', 'nintendo', 'switch ?2', 'joy-?cons?', 'steam deck', 'rog ally', 'legion go', 'meta quest', 'oculus', 'jbl',
  'bose', 'beats (?:by dre|studio|solo|flex|fit|pill)', 'powerbeats', 'sonos', 'marshall', 'dyson', 'gopro', 'insta360', 'dji', 'garmin', 'fitbit', 'logitech', 'razer', 'steelseries', 'corsair', 'hyperx',
  'kingston', 'sandisk', 'lexar', 'crucial', 'western digital', 'seagate', 'geforce', 'rtx ?\\d{4}', 'starlink', 'kindle',
  'fire tv', 'chromecast', 'google pixel', 'pixel \\d+\\w*', 'bmw', 'mercedes(?:-benz)?', 'benz', 'audi', 'vw', 'volkswagen', 'toyota', 'honda', 'nissan', 'ford',
  'vauxhall', 'opel', 'peugeot', 'citroen', 'renault', 'skoda', 'seat (?:leon|ibiza|ateca|arona|tarraco|alhambra)', 'cupra', 'mazda', 'hyundai', 'kia', 'volvo', 'land rover', 'range rover', 'jaguar',
  'mini cooper', 'bmw mini', 'fiat', 'abarth', 'alfa romeo', 'jeep', 'tesla', 'lexus', 'subaru', 'mitsubishi', 'suzuki', 'kawasaki', 'yamaha', 'ktm', 'triumph', 'bmw motorrad',
  'ducati', 'aprilia', 'husqvarna', 'vespa', 'piaggio', 'xiaomi scooter', 'ninebot', 'segway', 'shimano', 'sram', 'garmin edge', 'wahoo', 'makita', 'dewalt',
  'milwaukee', 'bosch', 'ryobi', 'einhell', 'metabo', 'hikoki', 'festool', 'worx', 'black ?\\+? ?decker', 'stihl', 'shark (?:helmets?|skwal|spartan|evo|race-?r|ridill|d-?skwal)', 'arai', 'shoei', 'agv',
  'yoshimu\\w*', 'akrapovi\\w*', 'brembo', 'ohlins', 'öhlins', 'rizoma'];
const DEVICE = W(DEVICE_LIST);
// "for / fits / compatible with" and what follows (up to 70 characters, before a full stop or a bracket): the devices
// named there are what the product fits.
const FITS = /\b(?:for|fits?|fit for|compatible with|suitable for|replacement for|replaces|works with|designed for)\b[^.;()\[\]]{0,70}/gi;
const DEVICE_G = new RegExp(DEVICE.source, 'gi');
// Sections of accessories and parts: a device named there is what it fits ("Samsung Galaxy Z Fold 8 Stand Case", "BMW
// E46 Door Handle"), unless the name claims to be the brand's own ("Original", "Genuine", "Official").
const ACCESSORY_PATH = /(?:Cases|Covers|Protective Film|Screen Protectors|Holders|Stands|Mobile Phone Parts|Mobile Phone Accessories|Phone Decorations|Photography Accessories|Tablet Accessories|Laptop Parts|Games & Accessories > (?:Accessories|Bags|Cases|Screen Protectors)|Earphone Accessories|Speaker Accessories|Camera & Photo > (?:Lenses|Flashes|Photo Studio|Tripod|Selfie|Sports & Action Video Cameras Accessories|Camera Drones & Accessories)|Accessories & Parts > (?:Camera Bags|Screen Protectors|Remote Control|Digital Cables|Cable Winder)|Computer Peripherals > (?:Computer Cables|Docking)|^Automobiles|^Motorcycle Equipments & Parts > (?!Motorcycle Equipments)|Cycling > Bicycle (?:Parts|Accessories)|Pet Products)/i;
const STRAP_WORDS = /\b(?:straps?|bands?|watchbands?|films?|protectors?|glass|cases?|covers?|bumpers?|chargers?|charging (?:cables?|docks?|stands?)|cables?|docks?|holders?)\b/i;
const OWN_CLAIM = /\b(?:original|orginal|genuine|official|authentic|oem quality)\b/i;
export function brandTrouble(name, path = '') {
  const n = clean(name);
  if (CHARACTERS.test(n)) return 'a well-known brand or licensed character (on a marketplace often an imitation)';
  if (hiddenName(name)) return 'a brand or title hidden by the seller';
  if (!DEVICE.test(n)) return '';
  if (OWN_CLAIM.test(n)) return 'a well-known brand\'s "original" product from a marketplace listing (often an imitation)';
  if (ACCESSORY_PATH.test(path) || (/Wearable/i.test(path) && STRAP_WORDS.test(n))) return '';
  const outside = n.replace(FITS, m => m.replace(DEVICE_G, ' '));
  if (DEVICE.test(outside)) return 'a well-known brand named as the product, not as what it fits (on a marketplace often an imitation)';
  return '';
}

const PLUG = /\beu\s*(?:\d{3}\s*v\s*)?(?:sockets?|outlets?)\b|european standard|\beu (?:standard|version|plug)\b|\b(?:eu|us|au|jp|kr|br|cn|eur?)\s*-?\s*plugs?\b|\b110\s*-?\s*1[12]0?\s*v\b|\b110\s*v\b|\bschuko\b/i;
const WIRED = /\b(?:plugs?|mains|ac\s*(?:100|110|220|230|240)|220\s*v|230\s*v|240\s*v|adapters?|chargers?|power supply|heaters?|electric)\b/i;

const has = (re, n) => re.test(n);
const sub = (re, n, yes, other) => (re.test(n) ? yes : other);

// Wheels, tyres and their parts: never a tyre or a rim from a marketplace listing.
function wheel(n) {
  if (/\b(?:\d{3}\s*\/\s*\d{2}\s*z?r?\s*\d{2}|tyres?|tires?)\b/i.test(n) && !/\b(?:valve|caps?|repair|plugs?|inflators?|gauges?|pressure|tpms|sensors?|chains?|socks?|covers?|stickers?|letters?|shine|levers?|tools?|brush)\b/i.test(n)) return 'tyres from a marketplace listing (safety)';
  if (/\b(?:alloy wheels?|forged wheels?|wheel rims?|\d{2}\s*(?:inch|")\s*(?:wheels?|rims?))\b/i.test(n)) return 'wheel rims from a marketplace listing (safety)';
  if (/\b(?:tpms|pressure sensors?)\b/i.test(n)) return ['tyres-wheels', 'TPMS Sensors'];
  if (/\b(?:hub ?caps?|centre caps?|center caps?|wheel trims?|hubcaps?)\b/i.test(n)) return ['tyres-wheels', 'Wheel Trims & Centre Caps'];
  if (/\b(?:nuts?|bolts?|studs?|locking)\b/i.test(n)) return ['tyres-wheels', 'Wheel Nuts & Bolts'];
  if (/\b(?:spacers?|adapters?)\b/i.test(n)) return ['tyres-wheels', 'Spacers'];
  if (/\b(?:snow chains?|snow socks?|tyre chains?|tire chains?)\b/i.test(n)) return ['tyres-wheels', 'Snow Chains & Socks'];
  return ['tyres-wheels', 'Wheel Accessories'];
}
const BRAKE = /\bbrake (?:pads?|discs?|rotors?|calipers?|shoes?|lines?|hoses?|master cylinders?|pumps?|boosters?)\b|\bmaster cylinders?\b/i;
const TYRE = /\b(?:tyres?|tires?|inner tubes?)\b/i;
const TYRE_OK = /\b(?:valves?|valve caps?|caps?|repair|plugs?|inflators?|pumps?|gauges?|pressure|tpms|sensors?|chains?|socks?|covers?|stickers?|letters?|shine|levers?|tools?|brush|changers?|irons?|spoons?|kits? for|shoes|tire tread pattern)\b/i;
const LED_ROAD = /\b(?:fog|brake|stop|reverse|reversing|backup|turn signal|turning|indicators?|tail|drl|daytime running|headlights?|headlamps?|h[1-9]|h1[0-9]|9005|9006|9012|hb[2-5]|hir2|t20|1156|1157|3156|3157|7440|7443|w21w|p21w|py21w)\b/i;
// Computers, tablets and phones need a maker's name on the card (no-name ones often have fake parts and no licence).
const NO_NAME_DEVICE = ['Laptops', 'Mini PCs', 'Desktops', 'Tablets', 'Mobile Phones'];
const WHOLE_BIKE = /\b(?:\d{1,2}\s*-?\s*speeds?|\d{2}(?:\.\d)?\s*(?:inch|in|")\s*(?:wheels?)?|\d{3}c)\b/i;
const BIKE_PART = /\b(?:cassettes?|chains?|derailleurs?|shifters?|wheel ?sets?|rims?|tyres?|tires?|tubes?|frame ?bags?|covers?|stands?|racks?|cranks?|crankset|freewheels?|hubs?|spokes?|levers?|cables?|pedals?|seat ?posts?|saddles?|grips?|bags?|bottle|cages?|forks?|stems?|handlebars?|mudguards?|fenders?|lights?|bells?|locks?|pumps?|computers?|trainers?|tools?)\b/i;
// Very full subcategories keep one in k products, always the same ones (by the name).
const THIN = { 'Phone Cases': 3, 'Electronics & Maker Parts': 2 };
function fnv(t) {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
// Car keys: only shells and cases; blanks, remotes and transponder chips need programming (key cloning).
const KEY_SHELL = /\b(?:shells?|cases?|covers?|holders?|key ?rings?|keychains?|pouch(?:es)?|bags?|fob covers?|silicone)\b/i;
// E-scooters, e-bikes and their batteries and chargers: fire risk from marketplace listings; small parts are fine.
const E_POWER = /\b(?:batter(?:y|ies)|lithium|li-?ion|lifepo4|chargers?|controllers?|motors?|\d{3,5}\s*w(?:att)?s?|\d{2,3}\s*v\s*\d+\s*ah|km\/h|mph|range)\b/i;
const LOGO = /\b(?:emblems?|badges?|logos?|decals? (?:for|with logo)|letters? (?:sticker|badge))\b/i;

// [regex on "<first> > <second> > <third>", site, slug or function, sub] or [regex, site, reason]. First match wins.
const A = 'Automobiles, Parts & Accessories';
const M = 'Motorcycle Equipments & Parts';
const SECTIONS = [
  // ---- Car Gear World ----
  [/^Automobiles, Parts & Accessories > Wear Parts > Wheels Tires/i, 'AGW', (p, n) => wheel(n)],
  [/^Automobiles, Parts & Accessories > Wear Parts > Nuts & Bolts/i, 'AGW', (p, n) => (/\bwheel/i.test(n) ? ['tyres-wheels', 'Wheel Nuts & Bolts'] : ['parts-maintenance', 'Spare Parts'])],
  [/^Automobiles, Parts & Accessories > Wear Parts > Brake/i, 'AGW', 'brake parts from a marketplace listing (safety)'],
  [/^Automobiles, Parts & Accessories > Wear Parts/i, 'AGW', 'parts-maintenance', 'Spare Parts'],
  [/^Automobiles, Parts & Accessories > Car Electronics > Car DVR/i, 'AGW', 'car-electronics', 'Dash Cams'],
  [/^Automobiles, Parts & Accessories > Car Electronics > GPS/i, 'AGW', 'car-electronics', 'Sat Navs'],
  [/^Automobiles, Parts & Accessories > Car Electronics > (?:Car Intelligent System|Car AI box|Car Audio|Car Radio|Car Multimedia|Car MP3|Car Video)/i, 'AGW', 'car-electronics', 'Car Audio & CarPlay'],
  [/^Automobiles, Parts & Accessories > Car Electronics > Jump Starter/i, 'AGW', 'diagnostics-battery', 'Jump Starters'],
  [/^Automobiles, Parts & Accessories > Car Electronics > (?:Alarm|Car Alarm|Security)/i, 'AGW', 'car-electronics', 'Car Alarms'],
  [/^Automobiles, Parts & Accessories > Car Electronics > Alcohol/i, 'AGW', 'breathalysers (a safety device, not checked)'],
  [/^Automobiles, Parts & Accessories > Car Electronics/i, 'AGW', 'car-electronics', 'Car Electronics Accessories'],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Car Mat/i, 'AGW', 'interior-comfort', 'Car Mats'],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Seat/i, 'AGW', (p, n) => (/\b(?:child|baby|kids?|booster|isofix)\b/i.test(n) ? 'child car seats and their parts (safety)' : ['interior-comfort', 'Seat Covers & Cushions'])],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Car Interior Storage/i, 'AGW', 'interior-comfort', 'Organisers'],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Mounts/i, 'AGW', 'interior-comfort', 'Phone Holders & Mounts'],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Air Freshener/i, 'AGW', 'interior-comfort', 'Air Fresheners'],
  [/^Automobiles, Parts & Accessories > Interior Accessories > Steering Wheel/i, 'AGW', 'interior-comfort', 'Steering Wheel Covers'],
  [/^Automobiles, Parts & Accessories > Interior Accessories/i, 'AGW', 'interior-comfort', 'Interior Accessories'],
  [/^Automobiles, Parts & Accessories > Exterior Accessories > (?:Car Covers|Protective Covers?|Car Cover)/i, 'AGW', 'roof-towing-exterior', 'Car Covers'],
  [/^Automobiles, Parts & Accessories > Exterior Accessories > (?:Car Stickers|Car Body Film|Car Light Film)/i, 'AGW', 'roof-towing-exterior', 'Stickers & Wraps'],
  [/^Automobiles, Parts & Accessories > Exterior Accessories/i, 'AGW', 'roof-towing-exterior', 'Exterior Accessories'],
  [/^Automobiles, Parts & Accessories > Exterior Parts > Emblems/i, 'AGW', "car makers' logo stickers and badges"],
  [/^Automobiles, Parts & Accessories > Exterior Parts/i, 'AGW', 'roof-towing-exterior', 'Exterior Parts'],
  [/^Automobiles, Parts & Accessories > Car Lights > (?:Car Headlight|Projector Lens|Xenon|HID)/i, 'AGW', 'LED and HID headlight conversions are not road legal in the UK'],
  [/^Automobiles, Parts & Accessories > Car Lights > Light Bar/i, 'AGW', 'garage-tools-equipment', 'Work Lights'],
  [/^Automobiles, Parts & Accessories > Car Lights/i, 'AGW', 'parts-maintenance', 'Lights & Bulbs'],
  [/^Automobiles, Parts & Accessories > Engines/i, 'AGW', 'parts-maintenance', 'Engine & Exhaust'],
  [/^Automobiles, Parts & Accessories > Chassis Parts/i, 'AGW', 'parts-maintenance', 'Suspension & Steering'],
  [/^Automobiles, Parts & Accessories > Automotive Sensors/i, 'AGW', 'parts-maintenance', 'Sensors'],
  [/^Automobiles, Parts & Accessories > Car Lock System/i, 'AGW', (p, n) => (KEY_SHELL.test(n) && !/\b(?:chips?|transponders?|blanks?|uncut|blade|remote keys?|smart keys?|proximity|\d{3}\s*mhz)\b/i.test(n) ? ['parts-maintenance', 'Keys & Key Cases'] : 'car keys, blanks and transponder chips (need programming)')],
  [/^Automobiles, Parts & Accessories > Electrical Equipment > Charging/i, 'AGW', 'diagnostics-battery', 'Charging & Starting'],
  [/^Automobiles, Parts & Accessories > Electrical Equipment/i, 'AGW', 'parts-maintenance', 'Air Conditioning & Electrics'],
  [/^Automobiles, Parts & Accessories > Interior Parts/i, 'AGW', 'parts-maintenance', 'Interior Parts'],
  [/^Automobiles, Parts & Accessories > Car Maintenance Tools > Programming/i, 'AGW', 'key programming and tuning tools'],
  [/^Automobiles, Parts & Accessories > Car Maintenance Tools > Jack/i, 'AGW', 'garage-tools-equipment', 'Jacks & Lifting'],
  [/^Automobiles, Parts & Accessories > Car Maintenance Tools > Inspection/i, 'AGW', 'diagnostics-battery', 'Diagnostic Tools'],
  [/^Automobiles, Parts & Accessories > Car Maintenance Tools/i, 'AGW', 'garage-tools-equipment', 'Car Repair Tools'],
  [/^Automobiles, Parts & Accessories > Car Repair Tool/i, 'AGW', 'diagnostics-battery', 'Diagnostic Tools'],
  [/^Automobiles, Parts & Accessories > Car Wash & Maintenance > Scraper/i, 'AGW', (p, n) => (/\b(?:ice|snow|frost)\b/i.test(n) ? ['safety-winter', 'Ice Scrapers'] : ['car-care-detailing', 'Cleaning & Detailing'])],
  [/^Automobiles, Parts & Accessories > Car Wash & Maintenance > Polish/i, 'AGW', 'car-care-detailing', 'Polishers'],
  [/^Automobiles, Parts & Accessories > Car Wash & Maintenance/i, 'AGW', 'car-care-detailing', 'Cleaning & Detailing'],
  [/^Automobiles, Parts & Accessories > New Energy Vehicle Parts & Accessories > Electric Vehicle Parts/i, 'AGW', 'parts-maintenance', 'Spare Parts'],
  [/^Automobiles, Parts & Accessories > New Energy/i, 'AGW', 'EV chargers from a marketplace listing (electrical safety)'],
  [/^Automobiles, Parts & Accessories/i, 'AGW', 'camper, lorry and boat parts, or a car section without a place on Car Gear World'],

  // ---- Biker Gear World ----
  [/^Sports & Entertainment > Cycling > Scooters/i, 'BGW', (p, n) => (/\b(?:tyres?|tires?|tubes?|inner tubes?)\b/i.test(n) ? 'tyres from a marketplace listing (safety)'
    : E_POWER.test(n) ? 'whole e-scooters and their batteries, chargers and controllers (fire risk)'
      : /\belectric|e-?scooter|m365|ninebot|kugoo|segway/i.test(n) ? ['electric-scooters', 'E-scooter Parts & Accessories'] : ['kick-scooters', 'Kick Scooters'])],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts > Lighting/i, 'BGW', 'parts-maintenance', 'Lights & Indicators'],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts > Exhaust/i, 'BGW', 'parts-maintenance', 'Exhausts'],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts > Brakes/i, 'BGW', 'brake parts from a marketplace listing (safety)'],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts > Wheels/i, 'BGW', (p, n) => (/\b(?:tyres?|tires?|tubes?|rims?|wheels?)\b/i.test(n) && !/\b(?:stickers?|decals?|covers?|valve|caps?|stands?)\b/i.test(n) ? 'tyres and wheels from a marketplace listing (safety)' : ['parts-maintenance', 'Motorcycle Parts'])],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts > Handlebars/i, 'BGW', 'parts-maintenance', 'Handlebars & Levers'],
  [/^Motorcycle Equipments & Parts > Motorcycle Parts/i, 'BGW', 'parts-maintenance', 'Motorcycle Parts'],
  [/^Motorcycle Equipments & Parts > Modification&Protection > (?:Falling Protection|Bumpers)/i, 'BGW', 'protection', 'Crash Protection'],
  [/^Motorcycle Equipments & Parts > Modification&Protection/i, 'BGW', 'parts-maintenance', 'Styling & Modifications'],
  [/^Motorcycle Equipments & Parts > Ornamental & Cleaning > (?:Motorcycle Repair Tool|Tools|Stands)/i, 'BGW', 'parts-maintenance', 'Tools & Stands'],
  [/^Motorcycle Equipments & Parts > Ornamental & Cleaning > (?:Cleaning|Care)/i, 'BGW', 'parts-maintenance', 'Cleaning & Care'],
  [/^Motorcycle Equipments & Parts > Ornamental & Cleaning/i, 'BGW', 'parts-maintenance', 'Styling & Modifications'],
  [/^Motorcycle Equipments & Parts > Motorcycle Accessories > Electronics/i, 'BGW', 'electronics', 'Motorcycle Electronics'],
  [/^Motorcycle Equipments & Parts > Motorcycle Accessories > Luggage/i, 'BGW', 'luggage-security', 'Luggage'],
  [/^Motorcycle Equipments & Parts > Motorcycle Accessories > Weather/i, 'BGW', 'luggage-security', 'Covers'],
  [/^Motorcycle Equipments & Parts > Motorcycle Accessories/i, 'BGW', 'parts-maintenance', 'Tools & Stands'],
  // Helmets and visors protect a life: only with the European test mark in the name (ECE 22.05 / 22.06).
  [/^Motorcycle Equipments & Parts > Motorcycle Equipments > Helmets/i, 'BGW', (p, n) => (/\bECE\b|22[.,]0[56]/i.test(n) ? ['helmets', 'Helmets'] : 'helmet or visor without the ECE test mark in its name')],
  [/^Motorcycle Equipments & Parts > Motorcycle Equipments/i, 'BGW', (p, n) => (/\bgloves?\b/i.test(n) ? ['boots-gloves', 'Motorcycle Gloves'] : /\bboots?\b/i.test(n) ? ['boots-gloves', 'Motorcycle Boots'] : ['jackets-trousers', 'Motorcycle Clothing'])],
  [/^Motorcycle Equipments & Parts > Motorcycle & ATV > ATV/i, 'BGW', 'parts-maintenance', 'ATV & Quad Parts'],
  [/^Motorcycle Equipments & Parts > Motorcycle & ATV > (?:Electric Motorcycle Parts|Electric Motorcycle Accessories)/i, 'BGW', (p, n) => (E_POWER.test(n) ? 'whole e-motorbikes and their batteries, chargers and controllers (fire risk)' : ['electric-motorbikes', 'Electric Motorbike Parts'])],
  [/^Motorcycle Equipments & Parts > Motorcycle & ATV/i, 'BGW', 'whole motorbikes and quads from a marketplace listing'],
  [/^Motorcycle Equipments & Parts/i, 'BGW', 'boats, aircraft and other vehicles'],

  // ---- Gaming Gear World (PGW) ----
  [/^Consumer Electronics > Games & Accessories > Gamepads/i, 'PGW', 'controllers', 'Controllers'],
  // Consoles from a marketplace listing are emulation machines sold with copied games (the real ones are big brands).
  [/^Consumer Electronics > Games & Accessories > (?:Video Game Consoles|Handheld Game Players)/i, 'PGW', 'game consoles from a marketplace listing (usually sold with copied games)'],
  [/^Consumer Electronics > Games & Accessories > Memory Cards/i, 'PGW', 'game cartridges (copies)'],
  [/^Consumer Electronics > Games & Accessories/i, 'PGW', 'consoles', 'Console Accessories'],
  [/^Computer & Office > Computer Components > Demo Board/i, 'TGW', 'laptops-computing', 'Electronics & Dev Boards'],
  [/^Computer & Office > Computer Components > Laptop Motherboard/i, 'PGW', 'laptop motherboards (repair parts)'],
  [/^Computer & Office > Computer Components/i, 'PGW', 'components', 'PC Components'],
  [/^Computer & Office > Computer Peripherals > Monitors/i, 'PGW', 'monitors', 'Monitors'],

  // ---- Technology Gear World ----
  [/^Consumer Electronics > Accessories & Parts > Batteries/i, 'TGW', (p, n) => (/\b(?:makita|dewalt|milwaukee|ryobi|bosch|einhell|metabo|hikoki|worx|black ?\+? ?decker|bl18\d\d|dcb\d+)\b/i.test(n) ? 'replacement power tool batteries (fire risk)'
    : /\b(?:18650|21700|26650|14500|32700|li-?po|lipo|lifepo4|battery packs?|\d{2}\s*v\s*\d+\s*ah|e-?bike batter(?:y|ies)|scooter batter(?:y|ies))\b/i.test(n) ? 'lithium cells and battery packs from a marketplace listing (fire risk)' : ['accessories-storage', 'Batteries'])],
  [/^Consumer Electronics > Accessories & Parts > (?:Remote Control|TV Mounts?|Uchwyty)/i, 'TGW', 'tv-home-cinema', 'TV Accessories'],
  [/^Consumer Electronics > Accessories & Parts > (?:Chargers|Digital Cables|Battery Accessories|Battery Storage|Electrical Socket|Power Management|Cable Winder|Adapters?)/i, 'TGW', 'accessories-storage', 'Chargers & Cables'],
  [/^Consumer Electronics > Accessories & Parts/i, 'TGW', 'accessories-storage', 'Accessories'],
  [/^Consumer Electronics > Portable Audio & Video > (?:Earphones|Earphone Accessories|Headphone)/i, 'TGW', 'audio', 'Headphones & Earbuds'],
  [/^Consumer Electronics > Portable Audio & Video > Speaker/i, 'TGW', 'audio', 'Speakers'],
  [/^Consumer Electronics > Portable Audio & Video > Microphone/i, 'TGW', 'audio', 'Microphones'],
  [/^Consumer Electronics > Portable Audio & Video > Audio Amplifier/i, 'TGW', 'audio', 'Amplifiers & DACs'],
  [/^Consumer Electronics > Portable Audio & Video > (?:Audio & Video Replacement Parts|Replacement)/i, 'TGW', 'audio and video spare parts'],
  [/^Consumer Electronics > Portable Audio & Video > XR/i, 'TGW', 'accessories-storage', 'VR & AR Accessories'],
  [/^Consumer Electronics > Portable Audio & Video/i, 'TGW', 'audio', 'Audio Accessories'],
  [/^Consumer Electronics > Smart Electronics > Wearable/i, 'TGW', 'phones-smartwatches', 'Smartwatches & Wearables'],
  [/^Consumer Electronics > Smart Electronics/i, 'TGW', 'smart-home-wifi', 'Smart Home'],
  [/^Consumer Electronics > Camera & Photo > (?:Camera Drones|Drones)/i, 'TGW', 'cameras-drones', 'Drones'],
  [/^Consumer Electronics > Camera & Photo > Sports & Action/i, 'TGW', 'cameras-drones', 'Action Cameras'],
  [/^Consumer Electronics > Camera & Photo > (?:Tripod|Selfie Sticks)/i, 'TGW', 'cameras-drones', 'Tripods & Gimbals'],
  [/^Consumer Electronics > Camera & Photo > Photo Studio/i, 'TGW', 'cameras-drones', 'Photo Studio'],
  [/^Consumer Electronics > Camera & Photo > Camera Replacement Parts/i, 'TGW', 'camera spare parts'],
  [/^Consumer Electronics > Camera & Photo/i, 'TGW', 'cameras-drones', 'Cameras & Accessories'],
  [/^Consumer Electronics > Home Audio & Video > Projects/i, 'TGW', 'tv-home-cinema', 'Projectors'],
  [/^Consumer Electronics > Home Audio & Video > (?:Home Theater Amplifiers|Amplifiers)/i, 'TGW', 'audio', 'Amplifiers & DACs'],
  [/^Consumer Electronics > Home Audio & Video > TV Receivers/i, 'TGW', 'TV boxes (often sold for unlicensed streaming)'],
  [/^Consumer Electronics > Home Audio & Video/i, 'TGW', (p, n) => (/\b(?:tv (?:box|stick)|android tv|streaming (?:media )?player|set-?top box|iptv)\b/i.test(n) ? 'TV boxes (often sold for unlicensed streaming)' : ['tv-home-cinema', 'TV Accessories'])],
  [/^Consumer Electronics/i, 'TGW', 'electronics section without a place on Technology Gear World'],
  [/^Phones & Telecommunications Accessories > Mobile Phone Cases/i, 'TGW', 'phones-smartwatches', 'Phone Cases'],
  [/^Phones & Telecommunications Accessories > Mobile Phone Protective Film/i, 'TGW', 'phones-smartwatches', 'Screen Protectors'],
  [/^Phones & Telecommunications Accessories > Holders/i, 'TGW', 'phones-smartwatches', 'Phone Holders & Stands'],
  [/^Phones & Telecommunications Accessories > Mobile Phone Accessories/i, 'TGW', 'phones-smartwatches', 'Chargers & Cables'],
  [/^Phones & Telecommunications Accessories > Sim/i, 'TGW', 'SIM cards'],
  [/^Phones & Telecommunications Accessories/i, 'TGW', 'phones-smartwatches', 'Phone Accessories'],
  [/^Phones & Telecommunications > Mobile Phones/i, 'TGW', 'phones-smartwatches', 'Mobile Phones'],
  // Most walkie talkies need a licence in the UK: only PMR446 (licence-free) ones.
  [/^Phones & Telecommunications > Walkie Talkie/i, 'TGW', (p, n) => (/\bpmr\s*-?\s*446\b|\blicen[cs]e[- ]free\b/i.test(n) ? ['phones-smartwatches', 'Walkie Talkies'] : 'a radio that needs a licence in the UK (not PMR446)')],
  [/^Phones & Telecommunications > Mobile Phone Parts/i, 'TGW', 'phones-smartwatches', 'Phone Parts & Batteries'],
  [/^Phones & Telecommunications/i, 'TGW', 'refurbished phones, radio and telecom equipment (licences)'],
  [/^Computer & Office > Computer Peripherals/i, 'TGW', 'laptops-computing', 'Computer Accessories'],
  [/^Computer & Office > 3D Print/i, 'TGW', 'laptops-computing', '3D Printing'],
  [/^Computer & Office > Tablets/i, 'TGW', 'laptops-computing', 'Tablets'],
  [/^Computer & Office > Tablet Accessories/i, 'TGW', 'laptops-computing', 'Tablet Accessories'],
  [/^Computer & Office > Networking/i, 'TGW', 'smart-home-wifi', 'Networking'],
  [/^Computer & Office > Laptop Parts/i, 'TGW', 'laptops-computing', 'Laptop Accessories'],
  [/^Computer & Office > Office Electronics/i, 'TGW', 'laptops-computing', 'Printers & Scanners'],
  // Fake capacities and big-brand copies are common in marketplace memory.
  [/^Computer & Office > Storage Device/i, 'TGW', (p, n) => (/\b(?:samsung|sandisk|kingston|lexar|western digital|wd|seagate|crucial|toshiba|hp|lenovo|sony|pny|transcend)\b/i.test(n) ? 'big-brand memory from a marketplace listing (often fake)'
    : /\b(?:[1-9]\d*|0?\.\d+)\s*tb\b|\b(?:1024|2048)\s*gb\b/i.test(n) && /\b(?:usb|flash|pen ?drive|thumb|sd|micro ?sd|tf|memory card)\b/i.test(n) ? 'flash memory with a capacity that is usually fake'
      : ['accessories-storage', 'Storage & Memory'])],
  [/^Computer & Office > Barebone/i, 'TGW', 'laptops-computing', 'Mini PCs'],
  [/^Computer & Office > Laptops/i, 'TGW', 'laptops-computing', 'Laptops'],
  [/^Computer & Office > Desktops/i, 'TGW', 'laptops-computing', 'Desktops'],
  [/^Computer & Office/i, 'TGW', 'crypto miners, servers and industrial computers'],
  [/^Electronic Components/i, 'TGW', 'laptops-computing', 'Electronics & Maker Parts'],
  [/^Security & Protection > Video Surveillance/i, 'TGW', 'smart-home-wifi', 'Security Cameras'],
  [/^Security & Protection > Access Building Automation > (?:Intercom|Security Alarm|Access Control|IoT|Building Automation)/i, 'TGW', 'smart-home-wifi', 'Smart Home'],
  [/^Security & Protection/i, 'TGW', 'safety, survival and self-defence equipment'],
  [/^Home Improvement > Family Intelligence System/i, 'TGW', (p, n) => (/\b(?:sockets?|switch(?:es)?|plugs?|thermostats?)\b/i.test(n) && !/\buk\b|\bbs\s*1363\b|\b13\s*a\b|\bgb\b/i.test(n) ? 'mains sockets and switches not made for UK wiring' : ['smart-home-wifi', 'Smart Home'])],

  // ---- Sporty Gear World ----
  [/^Sports & Entertainment > (?:Hunting|Shooting|Musical Instruments)/i, 'SGW', 'hunting, shooting and musical instruments'],
  [/^Sports & Entertainment > Entertainment > Darts/i, 'SGW', 'golf-skate-more', 'Darts'],
  [/^Sports & Entertainment > Entertainment > (?:Snooker|Billiard)/i, 'SGW', 'golf-skate-more', 'Snooker & Pool'],
  [/^Sports & Entertainment > Entertainment > (?:Chess|Board Game)/i, 'SGW', 'board games (on Kids\' and Home Gear World)'],
  [/^Sports & Entertainment > Entertainment/i, 'SGW', 'gambling, coin games, go-karts and fairground'],
  [/^Sports & Entertainment > Cycling > Electric Bicycle/i, 'SGW', 'e-bikes and their batteries from a marketplace listing (UK rules and fire risk)'],
  [/^Sports & Entertainment > Cycling > Bicycle$/i, 'SGW', 'whole bikes from a marketplace listing (UK safety standard)'],
  [/^Sports & Entertainment > Cycling > (?:Bicycle Accessories|Cycling Equipment)/i, 'SGW', (p, n) => (/\bhelmets?\b/i.test(n) && !/\ben\s*1078\b/i.test(n) ? 'bike helmet without the EN 1078 test mark in its name' : ['cycling', 'Bike Accessories'])],
  [/^Sports & Entertainment > Cycling > Bicycle Parts/i, 'SGW', (p, n) => (/\bbrake (?:pads?|discs?|rotors?|calipers?)\b/i.test(n) ? 'brake parts from a marketplace listing (safety)' : ['cycling', 'Bike Parts'])],
  [/^Sports & Entertainment > Cycling/i, 'SGW', 'cycling', 'Bike Repair & Maintenance'],
  [/^Sports & Entertainment > Fishing/i, 'SGW', 'golf-skate-more', 'Fishing'],
  [/^Sports & Entertainment > Camping & Hiking > (?:Astronomical|Telescope)/i, 'SGW', 'hiking-climbing-winter', 'Telescopes & Binoculars'],
  [/^Sports & Entertainment > Camping & Hiking > Safety/i, 'SGW', 'first aid, tourniquets and survival kits (medical)'],
  [/^Sports & Entertainment > Camping & Hiking > Tents/i, 'SGW', 'hiking-climbing-winter', 'Tents'],
  [/^Sports & Entertainment > Camping & Hiking > Climbing/i, 'SGW', (p, n) => (/\b(?:harness(?:es)?|carabiners?|ropes?|belay\w*|descenders?|ascenders?)\b/i.test(n) ? 'climbing safety gear from a marketplace listing' : ['hiking-climbing-winter', 'Camping & Hiking'])],
  [/^Sports & Entertainment > Camping & Hiking/i, 'SGW', 'hiking-climbing-winter', 'Camping & Hiking'],
  [/^Sports & Entertainment > Fitness & Body Building > Boxing/i, 'SGW', 'fitness-gym', 'Boxing & Martial Arts'],
  [/^Sports & Entertainment > Fitness & Body Building > Yoga/i, 'SGW', 'fitness-gym', 'Yoga'],
  [/^Sports & Entertainment > Fitness & Body Building > Sports Safety/i, 'SGW', 'fitness-gym', 'Supports & Protection'],
  [/^Sports & Entertainment > Fitness & Body Building/i, 'SGW', 'fitness-gym', 'Fitness Equipment'],
  [/^Sports & Entertainment > Skiing/i, 'SGW', (p, n) => (/\bhelmets?\b/i.test(n) ? 'ski helmet from a marketplace listing (safety)' : ['hiking-climbing-winter', 'Ski & Snowboard'])],
  [/^Sports & Entertainment > Water Sports/i, 'SGW', (p, n) => (/\b(?:life ?jackets?|lifejackets?|life vests?|buoyancy|float(?:ation)? (?:vests?|aids?|belts?)|armbands?|swim(?:ming)? (?:training )?(?:vests?|rings?|belts?|floats?|aids?)|swimming rings?|kids? floats?|float waist)\b/i.test(n) ? 'buoyancy and swimming aids from a marketplace listing (safety)' : ['water-sports', 'Water Sports'])],
  [/^Sports & Entertainment > Racquet Sports > Table Tennis/i, 'SGW', 'racket-sports', 'Table Tennis'],
  [/^Sports & Entertainment > Racquet Sports > Badminton/i, 'SGW', 'racket-sports', 'Badminton'],
  [/^Sports & Entertainment > Racquet Sports > (?:Tennis|Pickleball|Padel|Squash)/i, 'SGW', 'racket-sports', 'Tennis & Padel'],
  [/^Sports & Entertainment > Racquet Sports/i, 'SGW', 'racket-sports', 'Racket Sports'],
  [/^Sports & Entertainment > Roller/i, 'SGW', 'golf-skate-more', 'Skate'],
  [/^Sports & Entertainment > Golf/i, 'SGW', 'golf-skate-more', 'Golf'],
  [/^Sports & Entertainment > (?:Team Sports|Basketball|Football|Soccer|Volleyball|Rugby)/i, 'SGW', 'football-team-sports', 'Team Sports'],
  [/^Sports & Entertainment > Horse Riding/i, 'SGW', (p, n) => (/\b(?:gel|cream|ointment|supplement|joint|muscle)\b/i.test(n) ? 'horse care products (medical)' : ['golf-skate-more', 'Horse Riding'])],
  [/^Sports & Entertainment/i, 'SGW', 'sport section without a place on Sporty Gear World'],
  [/^Sports Shoes,Clothing&Accessories > Sneakers > Running/i, 'SGW', 'running', 'Running Shoes'],
  [/^Sports Shoes,Clothing&Accessories > Sneakers/i, 'SGW', 'sportswear-shoes-bags', 'Sports Shoes'],
  [/^Sports Shoes,Clothing&Accessories > Sport Bags/i, 'SGW', 'sportswear-shoes-bags', 'Sports Bags'],
  [/^Sports Shoes,Clothing&Accessories > Sports Accessories/i, 'SGW', 'sportswear-shoes-bags', 'Sports Accessories'],
  [/^Sports Shoes,Clothing&Accessories > Children/i, 'SGW', 'children\'s sportswear (on Kids\' Gear World)'],
  [/^Sports Shoes,Clothing&Accessories/i, 'SGW', 'sportswear-shoes-bags', 'Sportswear'],

  // ---- Pets Gear World (ZGW) ----
  [/^Home & Garden > Pet Products > (?:Dog & Cat Food|Food|Pet Food|Treats)/i, 'ZGW', 'pet food from a marketplace'],
  [/^Home & Garden > Pet Products > Pet Health/i, 'ZGW', (p, n) => (/\b(?:towels?|wipes?|pads?|nappies|diapers?|poop|waste bags?)\b/i.test(n) ? ['grooming', 'Grooming'] : 'pet health products (medical)')],
  [/^Home & Garden > Pet Products > Dog & Cat Clothes/i, 'ZGW', (p, n) => (/\b(?:surgical|surgery|sterili[sz]ation|recovery|post-?op)\b/i.test(n) ? 'pet recovery suits (veterinary)' : ['walking', 'Coats & Clothes'])],
  [/^Home & Garden > Pet Products > Dog & Cat Toys/i, 'ZGW', 'toys', 'Toys'],
  [/^Home & Garden > Pet Products > Dog & Cat Beds/i, 'ZGW', 'beds-crates', 'Beds & Mats'],
  [/^Home & Garden > Pet Products > (?:Aquarium|Small Animals)/i, 'ZGW', 'small-pets', 'Small Pets & Aquarium'],
  [/^Home & Garden > Pet Products > (?:Dog & Cat Grooming|Dog & Cat Cleaning)/i, 'ZGW', 'grooming', 'Grooming'],
  [/^Home & Garden > Pet Products > Dog & Cat Feeders/i, 'ZGW', 'feeding', 'Bowls & Feeders'],
  [/^Home & Garden > Pet Products > Pet Furniture/i, 'ZGW', 'cats', 'Cat Trees & Furniture'],
  [/^Home & Garden > Pet Products > Bird/i, 'ZGW', 'birds', 'Birds'],
  [/^Home & Garden > Pet Products > Dog & Cat Outdoor/i, 'ZGW', (p, n) => (/\b(?:carriers?|crates?|cages?|kennels?)\b/i.test(n) ? ['beds-crates', 'Carriers & Crates'] : ['walking', 'Collars, Leads & Training'])],
  [/^Home & Garden > Pet Products/i, 'ZGW', 'walking', 'Collars, Leads & Training'],

  // ---- Travel Gear World ----
  [/^Luggage & Bags > Luggage/i, 'VGW', 'luggage-suitcases', 'Suitcases'],
  [/^Luggage & Bags > Travel Bags/i, 'VGW', 'travel-bags-backpacks', 'Travel Bags'],
  [/^Luggage & Bags > Backpack/i, 'VGW', 'travel-bags-backpacks', 'Backpacks'],
  [/^Luggage & Bags > Travel Accessories > Passport/i, 'VGW', 'documents-security', 'Passport Covers & Wallets'],
  [/^Luggage & Bags > Travel Accessories/i, 'VGW', 'travel-accessories', 'Travel Accessories']
];

// Only the sites of this table read it; the first-wave sites (WGW, MGW, KGW, HGW) and GGW/CGW have their own rules.
export const SECTION_SITES = [...new Set(SECTIONS.map(s => s[1]))];

// One product for one site: { ok, slug, sub, name, brand } or { ok: false, reason }. site: the engine's label.
export function aliexpressUkSection(site, name, feedCategory, brand = '') {
  const raw = String(name || '').trim();
  if (!raw) return no('no product name');
  // A car's 12 V socket is still called a "cigarette lighter": that is not a smoking product.
  const plain = raw.replace(/cigarette lighters?/gi, '12V socket');
  if (NEVER.test(plain) || NEVER_MORE.test(plain)) return no('adult, smoking, weapon, medical or unlawful product');
  const parts = String(feedCategory || '').split(/\s+,\s+/).map(s => s.trim()).filter(Boolean);
  const path = parts.slice(0, 3).join(' > ');
  if (!path) return no('no section in the feed');
  for (const [re, owner, a, b] of SECTIONS) {
    if (!re.test(path)) continue;
    if (owner !== site) return no(`AliExpress UK section of ${owner}, not this site`);
    let place;
    if (typeof a === 'function') {
      const r = a(path, raw);
      if (!Array.isArray(r)) return no(r);
      place = ok(r[0], r[1]);
    } else if (b === undefined) return no(a);
    else place = ok(a, b);
    const trouble = brandTrouble(raw, path);
    if (trouble) return no(trouble);
    if ((site === 'AGW' || site === 'BGW') && LOGO.test(raw)) return no("car and motorbike makers' logo stickers and badges");
    if (PLUG.test(raw) && WIRED.test(raw)) return no('a plug or voltage of another country: not for a UK home');
    const n = displayName(raw);
    if (n.length < 12) return no('name says nothing about the product');
    if (BRAKE.test(raw)) return no('brake parts from a marketplace listing (safety)');
    const bn = clean(brand);
    const sellerBrand = bn && !(CHARACTERS.test(bn) || DEVICE.test(bn)) ? displayBrand(bn) : 'AliExpress';
    if (NO_NAME_DEVICE.includes(place.sub) && sellerBrand === 'AliExpress') return no('a computer, tablet or phone without a maker\'s name (marketplace listing)');
    if (place.sub === 'Mobile Phones' && /\b3g\b/i.test(raw) && !/\b(?:4g|5g|lte)\b/i.test(raw)) return no('a 3G-only phone (the UK 3G networks are switched off)');
    const mah = Math.max(0, ...[...raw.matchAll(/\b(\d{5,6})\s*mah\b/gi)].map(m => Number(m[1])));
    if (mah > 50000) return no('a power bank or battery with a capacity that is usually fake');
    if (place.slug === 'cycling' && WHOLE_BIKE.test(raw) && /\b(?:bikes?|bicycles?)\b/i.test(raw) && !BIKE_PART.test(raw)) return no('whole bikes from a marketplace listing (UK safety standard)');
    const k = THIN[place.sub];
    if (k && fnv(raw) % k !== 0) return no(`one in ${k} kept (a very full subcategory: ${place.sub})`);
    if ((site === 'AGW' || site === 'BGW') && TYRE.test(raw) && !TYRE_OK.test(raw)) return no('tyres from a marketplace listing (safety)');
    if (site === 'AGW' && LED_ROAD.test(raw) && /\b(?:led|canbus)\b/i.test(raw) && /\b(?:bulbs?|blubs?)\b/i.test(raw)) return no('LED replacement bulbs for road lamps are not road legal in the UK');
    return { ...place, name: n, brand: sellerBrand };
  }
  return no('AliExpress UK section of the first-wave sites (WGW, MGW, KGW, HGW), Garden or Construction, or none');
}

export { KNOWN, NEVER as NEVER_FIRST };
