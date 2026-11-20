// bol.com NL (Partnerprogramma, site ID 1559450, lessons L154, L204): where each product of the bol.com feed files goes.
// tools/bol-feed-download.ps1 writes <archive>\BOL_<category>_NL.csv.gz (the most popular products of 12 categories) and
// BOL_0_NL-<search>.csv.gz (2 searches), with the Awin column names plus language, bol_category_id, bol_rating and bol_gpc
// (bol.com's GS1 product classification, top level first, " > " between levels). The names are Dutch.
//
// 1. ROUTE: the bol.com category (or the search) decides the site (BOL_SOURCES, in the order of the commission, 8% > 7% >
//    6%; the download keeps a product, EAN, only in the first category it comes in). Nothing else ever goes to a site.
// 2. BANNED: never a product that is banned network-wide (BANNED: ammunition and weapons, CD keys and gift cards, pet
//    prescription medicines, adult costumes, erotic, tobacco and vapes, alcohol, medicines), Dutch and English words.
// 3. PLACE: the site's own category and subcategory (PLACES), from the GS1 path, deepest level first, then from the head
//    of the name (before " - ", ",", "|" or "("), which the dry run lists under CHECK. Dutch glues words together
//    ("accuschroefboormachine", "hondenmand"), so the Dutch lists are word ENDINGS; short words that end other words
//    ("tas", "rok", "pet", "ring") are whole words. A product that no rule places is LEFT OUT, never put in a wrong
//    category ("not sure where it goes"). Home Gear World uses lib/home-eu.mjs (the Dutch home words of Wave 3).
// 4. CARD: no brand and no "was" price (lessons L178, L107): the cards of bol.com have none. Products with the same name
//    in different sizes ("... - Maat 42", "..., maat XL") are ONE card (bolBaseName), at the lowest price.
// The table is written from bol.com's category names before the first real profile of the files (Sunday 22 Nov 2026):
// add words to PLACES (and a test row to tests/worker/bol-import.test.mjs) as the profile shows them.
// The first real download (20 Nov 2026, 12,816 products in 14 files; Manager): merchant_category is only bol.com's top
// category, so the NAME places a product (every part of it: "Skechers KEEPSAKES COZY - COZY MINI Dames Instappers -
// Taupe" is shoes); clearly gendered clothing goes to the fashion site its words say (bolPlace); sizes of one name are
// one card; veterinary diets, knives, party items in Tuin and what is not DIY in Klussen stay out (Klussen's home
// products, such as bath mats, go to Home Gear World when they fit a Home category).
import { homePlaceEu, headOf } from './home-eu.mjs';
import { BOL_CATEGORIES, BOL_SEARCHES as BOL_SEARCH_TERMS, BOL_RETAILER } from '../../../src/lib/bol-lists.js';
import { ean13 } from '../../../src/lib/bol-catalog.js';

// The categories and searches: the ONE list of src/lib/bol-lists.js (the download and the daily refresh read it too,
// lessons L205). Here only which Gear World each of them goes to; a test checks that every entry of the list has one.
export { BOL_RETAILER };
// The download's files: BOL_<category>_NL.csv.gz and BOL_0_NL-<search>.csv.gz (src/lib/bol-catalog.js jobsOf).
export const BOL_FILE = /^BOL_(\d{1,12})_NL(?:-([a-z0-9-]{1,30}))?\.csv(?:\.gz)?$/i;

// The Gear World of each bol.com category (Manager, 20 Nov 2026), in the order of the list (the commission, highest first).
export const SITE_OF_CATEGORY = {
  43646: 'agw', // Auto & Motor
  11764: 'hgw', // Koken & Tafelen
  12001: 'hgw', // Huishouden
  15270: 'vgw', // Kamperen & Outdoor
  14648: 'sgw', // Sport
  14035: 'hgw', // Wonen
  13155: 'cgw', // Klussen
  12974: 'ggw', // Tuin
  12748: 'zgw', // Dieren
  46673: 'wgw', // Damesmode
  47024: 'mgw', // Herenmode
  16947: 'kgw' // Kindermode
};
export const BOL_SOURCES = BOL_CATEGORIES.map(c => ({ id: String(c.id), name: c.name, site: SITE_OF_CATEGORY[c.id] || '' }));
// The searches (no category): perfume to Women's, clearly men's perfume to Men's; work shoes to Construction.
export const SITE_OF_SEARCH = { parfum: { site: 'wgw', men: 'mgw' }, werkschoenen: { site: 'cgw' } };
export const BOL_SEARCHES = BOL_SEARCH_TERMS.map(term => ({ term, ...(SITE_OF_SEARCH[term] || { site: '' }) }));
export const BOL_SITES = [...new Set([...BOL_SOURCES.map(s => s.site), ...BOL_SEARCHES.flatMap(s => [s.site, s.men].filter(Boolean))])].filter(Boolean);
// The EAN as the daily refresh finds it (13 digits where possible, src/lib/bol-catalog.js ean13; Manager's contract L205).
export function bolEan(v) {
  const d = String(v ?? '').trim();
  return ean13(d) || d;
}
export const LEGACY_SITES = ['hgw', 'cgw', 'ggw', 'wgw', 'mgw', 'kgw'];
export const NEW_SITES = ['agw', 'vgw', 'sgw', 'zgw'];

const END = list => new RegExp('(?:^|[^\\p{L}\\d])[\\p{L}\\d-]*?(?:' + list.join('|') + ')(?=$|[^\\p{L}\\d])', 'iu');
const WORD = list => new RegExp('(?<![\\p{L}\\d])(?:' + list.join('|') + ')(?![\\p{L}\\d])', 'iu');
// A rule's words: Dutch endings (end) and whole words (word: short Dutch words and English GS1 names).
function m({ end = [], word = [] }) {
  const a = end.length ? END(end) : null;
  const b = word.length ? WORD(word) : null;
  return { test: t => Boolean((a && a.test(t)) || (b && b.test(t))) };
}

// ---- 2. Never on any Gear World site ----
export const BANNED = [
  ['ammunition or a weapon', m({ end: ['munitie', 'luchtbuks', 'luchtbuksen', 'luchtdrukgeweer', 'luchtdrukpistool', 'boksbeugel', 'pepperspray', 'stroomstootwapen',
    'wapenstok', 'vlindermes', 'werpmes', 'kruisboog', 'katapult', 'nunchaku'], word: ['kogels', 'hagelpatronen', 'co2[- ]patronen', 'ammunition', 'ammo', 'airsoft(?:geweer|pistool)?', 'wapens?'] })],
  ['CD key, gift card or code', m({ end: ['cadeaukaart', 'cadeaubon', 'giftcard', 'tegoedbon', 'waardebon', 'downloadcode', 'activatiecode', 'licentiecode'],
    word: ['cd[- ]?keys?', 'game ?keys?', 'digitale code', 'prepaid', 'steam wallet', 'psn', 'xbox live', 'nintendo eshop', 'gift ?cards?', 'vouchers?', 'tegoed'] })],
  ['pet prescription medicine', m({ end: ['diergeneesmiddel', 'diergeneesmiddelen', 'receptplichtig'], word: ['op recept', 'prescription', 'pom-?v', 'antibiotica'] })],
  // Veterinary diets count as pet prescription products (Manager, first real profile: "Royal Canin S/O Moderate Calorie").
  ['pet prescription medicine', { test: t => VET_DIET.test(t) || (/hypoallergen/iu.test(t) && /(?:voer|brok|food|diet|dieet|kibble)/iu.test(t)) }],
  // Knives as weapons: pocket, folding, survival and hunting knives (kitchen knives and a DIY utility knife are not these).
  ['knife', m({ end: ['zakmes', 'zakmessen', 'vouwmes', 'vouwmessen', 'survivalmes', 'survivalmessen', 'jachtmes', 'jachtmessen', 'gevechtsmes', 'springmes', 'outdoormes',
    'overlevingsmes', 'machete', 'machetes', 'dolk', 'dolken'], word: ['survival mes', 'survival messen', 'outdoor mes', 'tactisch mes', 'tactical knife', 'pocket knife',
    'folding knife', 'hunting knife', 'survival knife', 'balisong', 'karambit', 'bowie(?: mes| knife)?'] })],
  // "Kostuum" is also a man's suit in Dutch: only carnival and dressing-up words count.
  ['adult costume', { test: t => /(?:verkleed|carnaval|halloween|costume|cosplay|feestkostuum|themakostuum)/iu.test(t) && /(?<![\p{L}])(?:volwassen\p{L}*|dames|heren|adult|sexy)(?![\p{L}])/iu.test(t) }],
  ['erotic or adult product', m({ end: ['erotiek', 'erotisch', 'erotische', 'seksspeeltje', 'seksspeeltjes', 'vibrator', 'vibrators', 'dildo', 'dildo\'s', 'glijmiddel', 'condooms'],
    word: ['sex', 'seks', 'erotic', 'adult toys?'] })],
  ['tobacco or vape', m({ end: ['sigaret', 'sigaretten', 'tabak', 'waterpijp', 'shisha'], word: ['vape', 'vapes', 'e-sigaret', 'e-liquid'] })],
  ['alcohol', m({ word: ['bier', 'wijn', 'whisky', 'whiskey', 'wodka', 'vodka', 'gin', 'rum', 'likeur', 'jenever', 'champagne', 'prosecco'] })],
  ['medicine or supplement', m({ end: ['geneesmiddel', 'geneesmiddelen', 'medicijn', 'medicijnen', 'voedingssupplement', 'voedingssupplementen'],
    word: ['paracetamol', 'ibuprofen', 'cbd', 'melatonine'] })],
  ['service, warranty or insurance', m({ end: ['garantieverlenging', 'verzekering', 'installatieservice'], word: ['warranty', 'insurance'] })]
];
const VET_DIET = /(?<![\p{L}\d])(?:veterinary(?: diet)?|vet[- ]?diet|renal|urinary|s\/o|gastro[- ]?intestinal|hepatic|dieetvoer\p{L}*|dieetvoeding)(?![\p{L}\d])/iu;
export function bannedReason(text) {
  const t = String(text || '');
  for (const [why, re] of BANNED) if (re.test(t)) return `banned on every Gear World site (${why})`;
  return '';
}

// ---- 4. One card for every size ----
const SIZE = '(?:x{0,3}s|s|m|l|x{1,4}l|\\d?xl|\\d{1,3}(?:[.,]5)?(?:\\s?(?:eu|cm|jr|jaar|mnd|maanden))?|\\d{2,3}\\s?[-/]\\s?\\d{2,3}(?:\\s?(?:eu|cm|jr|jaar))?|one size|onesize)';
const LETTER = '(?:x{0,3}s|m|l|x{1,4}l|\\dxl)';
const SIZE_TAILS = [
  new RegExp(`\\s*[-–,|(]?\\s*\\(?\\s*(?:maat|mt\\.?|size|taille|schoenmaat|confectiemaat)\\s*:?\\s*${SIZE}(?:\\s*/\\s*${SIZE})?\\s*\\)?\\s*$`, 'iu'),
  new RegExp(`\\s+[-–|]\\s+${SIZE}\\s*$`, 'iu'),
  new RegExp(`\\s*,\\s*${SIZE}\\s*$`, 'iu'),
  // "Thermo Panty L/XL": two letter sizes at the end, with no "maat" (never numbers: "Kraan 1/2" is a product).
  new RegExp(`\\s+${LETTER}\\s*/\\s*${LETTER}\\s*$`, 'iu')
];
export function bolBaseName(name) {
  let n = String(name || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const before = n;
    for (const re of SIZE_TAILS) n = n.replace(re, '').trim();
    if (n === before) break;
  }
  return n.replace(/\s*[-–,|(]\s*$/, '').trim() || String(name || '').trim();
}

// ---- 5. Fresh files only (Manager, independent review of L205, 20 Nov 2026) ----
// A bol.com row carries the time of ITS download (the feed's last_updated, written by the download), never the time of
// the plan or the import, so the daily refresh (src/bol-refresh.js) hides it 24 hours after bol.com last confirmed it.
// A file older than BOL_MAX_AGE_HOURS is refused by the import: run the download again first.
export const BOL_MAX_AGE_HOURS = 12;
// 'YYYY-MM-DD HH:MM:SS' UTC (how the sites and the refresh store it), from the row's last_updated, else the file's time.
export function bolStamp(lastUpdated, fileMs = NaN) {
  const t = Date.parse(String(lastUpdated || ''));
  const ms = Number.isFinite(t) ? t : Number(fileMs);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 19).replace('T', ' ') : '';
}
export function bolTooOld(stamp, now = new Date(), hours = BOL_MAX_AGE_HOURS) {
  const t = Date.parse(`${String(stamp || '').replace(' ', 'T')}Z`);
  return !Number.isFinite(t) || now.getTime() - t > hours * 3600000;
}
export function oldFileMessage(file, stamp, hours = BOL_MAX_AGE_HOURS) {
  return `Το αρχείο του bol.com ${file} είναι ${stamp ? `από ${stamp} UTC` : 'χωρίς ώρα λήψης'}, παλιότερο από ${hours} ώρες: ` +
    'τρέξε πρώτα ξανά τη λήψη (tools/bol-feed-download.ps1 -Step download) και μετά την εισαγωγή. Δεν φορτώθηκε τίποτα.';
}

// ---- 1. Route ----
export function sourceOf(categoryId) {
  return BOL_SOURCES.find(s => s.id === String(categoryId || '').trim()) || null;
}
// The perfume search: "Herenparfum", "for Men" -> Men's; "Damesparfum", "for Women" -> Women's (Manager, first real profile).
export const MEN_PERFUME = /(?<![\p{L}])(?:heren\p{L}*|men|man|homme|pour homme|for him|uomo|hombre|mannen)(?![\p{L}])/iu;
export const WOMEN_PERFUME = /(?<![\p{L}])(?:dames\p{L}*|women|woman|femme|pour femme|for her|donna|mujer|vrouwen)(?![\p{L}])/iu;
// The site of one product: { site, source } or { reject }.
export function routeOf({ categoryId = '', search = '', name = '' }) {
  const s = String(search || '').toLowerCase();
  if (s) {
    const q = BOL_SEARCHES.find(x => x.term === s);
    if (!q) return { reject: `bol.com search "${s}" has no Gear World` };
    return { site: q.men && MEN_PERFUME.test(name) && !WOMEN_PERFUME.test(name) ? q.men : q.site, source: { id: '0', name: `search "${q.term}"`, search: q.term } };
  }
  const src = sourceOf(categoryId);
  if (!src) return { reject: `bol.com category ${categoryId || '(none)'} has no Gear World` };
  return { site: src.site, source: src };
}

// ---- 3. Place ----
// The GS1 path, deepest level first ("Auto & Motor > Auto-accessoires > Automatten" -> Automatten, Auto-accessoires, ...).
export function gpcParts(gpc) {
  return String(gpc || '').split(/\s*[>|]\s*/).map(s => s.trim()).filter(Boolean).reverse();
}

const HD = 'Home Decor';
// [category (older sites: the site_category name; newer sites: the category slug), subcategory, words, when?]
// The first rule that matches wins, so the narrow words come before the broad ones.
export const PLACES = {
  agw: [
    ['ev-charging', 'Charging Cables', m({ end: ['laadkabel type 2', 'laadpaal', 'laadpalen', 'thuislader', 'wallbox'], word: ['type 2 laadkabel', 'ev charger', 'mode 3'] })],
    ['safety-winter', 'Snow Chains & Socks', m({ end: ['sneeuwketting', 'sneeuwkettingen', 'sneeuwsokken'] })],
    ['safety-winter', 'Ice Scrapers & Snow Brushes', m({ end: ['ijskrabber', 'ijskrabbers', 'sneeuwborstel', 'sneeuwborstels', 'ruitenontdooier', 'antivries'] })],
    ['safety-winter', 'Safety Kits', m({ end: ['gevarendriehoek', 'veiligheidshesje', 'veiligheidshesjes', 'verbanddoos', 'ehbo-kit', 'brandblusser', 'noodhamer'] })],
    ['diagnostics-battery', 'Jump Starters', m({ end: ['starthulp', 'jumpstarter', 'startkabel', 'startkabels', 'accubooster'] })],
    ['diagnostics-battery', 'Battery Chargers', m({ end: ['acculader', 'druppellader', 'accutester'] })],
    ['diagnostics-battery', 'Diagnostic Tools', m({ end: ['diagnosetool', 'diagnoseapparaat', 'uitleesapparaat'], word: ['obd2?', 'obd-ii'] })],
    ['car-electronics', 'Dash Cams', m({ end: ['dashcam', 'dashcams', 'autocamera'] })],
    ['car-electronics', 'Parking Sensors & Cameras', m({ end: ['parkeersensor', 'parkeersensoren', 'achteruitrijcamera'] })],
    ['car-electronics', 'Car Audio & CarPlay', m({ end: ['autoradio', 'carkit', 'fm-transmitter', 'carplay'] })],
    ['car-electronics', 'Sat Navs', m({ end: ['navigatiesysteem', 'autonavigatie'], word: ['navigatie'] })],
    ['interior-comfort', 'Phone Holders & Mounts', m({ end: ['telefoonhouder', 'telefoonhouders', 'gsm-houder'] })],
    ['interior-comfort', 'Car Mats', m({ end: ['automat', 'automatten', 'kofferbakmat', 'kofferbakmatten', 'rubbermatten'] })],
    ['interior-comfort', 'Seat Covers & Cushions', m({ end: ['stoelhoes', 'stoelhoezen', 'autostoelhoes', 'zitkussen'] })],
    ['interior-comfort', 'Organisers', m({ end: ['kofferbakorganizer', 'autoorganizer', 'auto-organizer', 'achterbankorganizer'] })],
    ['interior-comfort', 'Air Fresheners', m({ end: ['luchtverfrisser', 'luchtverfrissers', 'autoparfum', 'geurverfrisser'] })],
    ['interior-comfort', 'Sun Shades', m({ end: ['zonnescherm', 'zonneschermen', 'zonwering'] })],
    ['roof-towing-exterior', 'Roof Boxes & Racks', m({ end: ['dakkoffer', 'dakkoffers', 'dakdrager', 'dakdragers', 'dakbox', 'imperiaal'] })],
    ['roof-towing-exterior', 'Bike Carriers', m({ end: ['fietsdrager', 'fietsdragers'] })],
    ['roof-towing-exterior', 'Towing', m({ end: ['trekhaak', 'trekhaken', 'sleepkabel', 'sleepkabels', 'sleeptouw', 'spanband', 'spanbanden'] })],
    ['roof-towing-exterior', 'Car Covers', m({ end: ['autohoes', 'autohoezen'] })],
    ['car-care-detailing', 'Pressure Washers', m({ end: ['hogedrukreiniger', 'hogedrukreinigers'] })],
    ['car-care-detailing', 'Car Cleaning', m({ end: ['autoshampoo', 'autowas', 'poetsmiddel', 'poetsdoek', 'poetsdoeken', 'microvezeldoek', 'microvezeldoeken', 'velgenreiniger',
      'insectenverwijderaar', 'lakreiniger', 'polijstmiddel', 'polijstmachine', 'autowax', 'zeem', 'droogdoek', 'interieurreiniger'] })],
    ['tyres-wheels', 'Tyre Inflators & Gauges', m({ end: ['bandenpomp', 'bandenpompen', 'bandenspanningsmeter', 'bandenreparatieset'] })],
    ['tyres-wheels', 'Wheel Trims', m({ end: ['wieldop', 'wieldoppen'] })],
    ['garage-tools-equipment', 'Jacks & Stands', m({ end: ['krik', 'garagekrik', 'krikken', 'assteun', 'assteunen'] })],
    ['garage-tools-equipment', 'Work Lights', m({ end: ['werklamp', 'werklampen', 'inspectielamp'] })],
    ['garage-tools-equipment', 'Compressors', m({ end: ['compressor', 'compressoren'] })],
    ['garage-tools-equipment', 'Wrenches & Tools', m({ end: ['momentsleutel', 'wielmoersleutel', 'kruissleutel', 'doppenset', 'dopsleutelset'] })],
    ['parts-maintenance', 'Wiper Blades', m({ end: ['ruitenwisser', 'ruitenwissers', 'ruitenwisserblad', 'ruitenwisserbladen', 'wisserbladen'] })],
    ['parts-maintenance', 'Oils & Fluids', m({ end: ['motorolie', 'koelvloeistof', 'remvloeistof', 'ruitensproeiervloeistof', 'ruitenvloeistof'] })],
    ['parts-maintenance', 'Lights & Bulbs', m({ end: ['autolamp', 'autolampen', 'koplamp', 'koplampen'], word: ['h[147]', 'h11', 'led autolampen?'] })]
  ],
  vgw: [
    ['luggage-suitcases', 'Suitcases', m({ end: ['koffer', 'koffers', 'kofferset', 'trolley', 'trolleys', 'handbagagekoffer'] })],
    ['travel-bags-backpacks', 'Backpacks', m({ end: ['rugzak', 'rugzakken', 'backpack', 'backpacks', 'dagrugzak', 'wandelrugzak'] })],
    ['travel-bags-backpacks', 'Travel Bags', m({ end: ['reistas', 'reistassen', 'weekendtas', 'duffeltas', 'heuptas', 'schoudertas'] })],
    ['comfort-sleep', 'Travel Pillows', m({ end: ['nekkussen', 'reiskussen', 'oogmasker'] })],
    ['beach-holiday', 'Beach', m({ end: ['strandstoel', 'strandstoelen', 'strandlaken', 'strandtent', 'strandtas', 'windscherm', 'windschermen', 'strandparasol'] })],
    ['travel-tech', 'Power & Lights', m({ end: ['powerbank', 'powerbanks', 'zonnepaneel', 'reisadapter', 'wereldstekker'] })],
    ['camping-outdoor', 'Tents', m({ end: ['tent', 'tenten', 'koepeltent', 'tunneltent', 'werptent', 'daktent', 'partytent'] })],
    ['camping-outdoor', 'Sleeping Bags & Mats', m({ end: ['slaapzak', 'slaapzakken', 'slaapmat', 'slaapmatten', 'luchtbed', 'luchtbedden', 'veldbed', 'zelfopblazende mat'] })],
    ['camping-outdoor', 'Camping Furniture', m({ end: ['kampeerstoel', 'kampeerstoelen', 'campingstoel', 'kampeertafel', 'campingtafel', 'vouwstoel', 'klapstoel'] })],
    ['camping-outdoor', 'Camping Kitchen', m({ end: ['koelbox', 'koelboxen', 'koeltas', 'campingkooker', 'kooktoestel', 'gasbrander', 'pannenset', 'campingservies', 'waterzak', 'jerrycan'] })],
    ['camping-outdoor', 'Torches & Lanterns', m({ end: ['hoofdlamp', 'hoofdlampen', 'zaklamp', 'zaklampen', 'kampeerlamp', 'lantaarn', 'campinglamp'] })],
    ['camping-outdoor', 'Hammocks', m({ end: ['hangmat', 'hangmatten'] })],
    ['camping-outdoor', 'Outdoor Gear', m({ end: ['kompas', 'multitool', 'survivalkit', 'waterfilter', 'drinkfles', 'thermosfles', 'veldfles'] })]
  ],
  sgw: [
    ['racket-sports', 'Rackets', m({ end: ['tennisracket', 'padelracket', 'badmintonracket', 'squashracket', 'tafeltennisbat', 'shuttles', 'tennisballen', 'padelballen'] })],
    ['football-team-sports', 'Football', m({ end: ['voetbal', 'voetballen', 'voetbaldoel', 'voetbalschoenen', 'scheenbeschermers', 'keepershandschoenen'] })],
    ['football-team-sports', 'Team Sports', m({ end: ['basketbal', 'basketbalring', 'volleybal', 'hockeystick', 'handbal'] })],
    ['water-sports', 'Swimming', m({ end: ['zwembril', 'zwembrillen', 'zwemvliezen', 'badmuts', 'zwemplankje', 'snorkelset', 'duikbril'] })],
    ['water-sports', 'Water Sports', m({ end: ['supboard', 'sup-board', 'wetsuit', 'zwemvest', 'kajak', 'peddel'] })],
    ['hiking-climbing-winter', 'Hiking', m({ end: ['wandelstok', 'wandelstokken', 'nordic walking'] })],
    ['hiking-climbing-winter', 'Winter Sports', m({ end: ['ski', 'skihelm', 'skibril', 'snowboard', 'skihandschoenen', 'sneeuwschoenen'] })],
    ['hiking-climbing-winter', 'Climbing', m({ end: ['klimgordel', 'klimtouw', 'karabiner', 'pofzak'] })],
    ['cycling', 'Cycling', m({ end: ['fietshelm', 'fietsverlichting', 'fietslamp', 'fietspomp', 'fietsslot', 'fietstas', 'fietshandschoenen', 'fietsbril', 'fietscomputer', 'wielrenbroek'] })],
    ['nutrition-hydration', 'Bottles & Shakers', m({ end: ['bidon', 'bidons', 'shakebeker', 'shaker', 'sportfles'] })],
    ['golf-skate-more', 'Golf', m({ end: ['golfbal', 'golfballen', 'golfclub', 'golfclubs', 'golftas', 'putter'] })],
    ['golf-skate-more', 'Boxing & Martial Arts', m({ end: ['bokshandschoenen', 'bokszak', 'bokszakken', 'bandages', 'kickpads'] })],
    ['golf-skate-more', 'Skate & Darts', m({ end: ['skateboard', 'skateboards', 'longboard', 'dartbord', 'dartpijlen', 'skeelers', 'inline skates'] })],
    ['running', 'Running', m({ end: ['hardloopschoenen', 'hardloopshirt', 'hardloopbroek', 'hardlooplegging', 'hardloopjas', 'hardloopvest', 'hardloopriem'] })],
    ['fitness-gym', 'Weights', m({ end: ['dumbbell', 'dumbbells', 'halter', 'halters', 'kettlebell', 'kettlebells', 'halterschijf', 'halterschijven', 'gewichten', 'enkelgewichten'] })],
    ['fitness-gym', 'Fitness Machines', m({ end: ['loopband', 'loopbanden', 'hometrainer', 'crosstrainer', 'roeitrainer', 'spinningfiets', 'fitnessbank', 'halterbank', 'powerrack'] })],
    ['fitness-gym', 'Yoga & Mats', m({ end: ['yogamat', 'yogamatten', 'fitnessmat', 'fitnessmatten', 'sportmat', 'foamroller', 'yogablok'] })],
    ['fitness-gym', 'Fitness Accessories', m({ end: ['weerstandsband', 'weerstandsbanden', 'fitnesselastiek', 'springtouw', 'buikspiertrainer', 'optrekstang', 'pull-up bar'] })],
    ['sportswear-shoes-bags', 'Sports Bags', m({ end: ['sporttas', 'sporttassen'] })],
    ['sportswear-shoes-bags', 'Sportswear', m({ end: ['sportlegging', 'sportbeha', 'sportshirt', 'sportbroek', 'sportsokken', 'sportjas', 'trainingspak', 'sportschoenen', 'sporthemd'] })]
  ],
  zgw: [
    ['horse', 'Horse & Riding', m({ end: ['paardendeken', 'zadel', 'zadeldek', 'rijlaarzen', 'rijbroek', 'hoofdstel', 'paardensnoepjes', 'paardenborstel'], word: ['paard', 'paarden'] })],
    ['birds', 'Chickens & Poultry', m({ end: ['kippenhok', 'kippenren', 'kippenvoer', 'legmeel', 'pluimvee'] })],
    ['birds', 'Budgies & Parrots', m({ end: ['papegaaienkooi', 'parkietenkooi', 'papegaaienvoer', 'parkietenvoer'] })],
    ['birds', 'Canaries & Finches', m({ end: ['kanariezaad', 'kanarievoer'] })],
    ['birds', 'Other Cage Birds', m({ end: ['vogelkooi', 'vogelkooien', 'vogelzitstok', 'vogelspeelgoed'] })],
    ['small-pets', 'Fish & Aquariums', m({ end: ['aquarium', 'aquariums', 'aquariumpomp', 'aquariumfilter', 'visvoer'] })],
    ['small-pets', 'Reptiles', m({ end: ['terrarium', 'terrariums', 'warmtelamp'] })],
    ['small-pets', 'Small Pets', m({ end: ['konijnenhok', 'knaagdierkooi', 'hamsterkooi', 'cavia', 'konijnenvoer', 'knaagdiervoer', 'hooiruif', 'knaagdierbodembedekking'] })],
    ['cats', 'Cat Litter & Trays', m({ end: ['kattenbak', 'kattenbakken', 'kattenbakvulling', 'kattengrit'] })],
    ['cats', 'Cat Trees & Scratchers', m({ end: ['krabpaal', 'krabpalen', 'krabplank', 'krabton', 'kattenkrabpaal'] })],
    ['travel', 'Carriers & Car', m({ end: ['transportbox', 'transportbench', 'reismand', 'hondentas', 'draagtas', 'hondenautostoel', 'autogordel voor honden', 'hondenrek'] })],
    ['beds-crates', 'Beds & Crates', m({ end: ['hondenmand', 'hondenmanden', 'kattenmand', 'kattenmanden', 'hondenkussen', 'hondenbed', 'hondenbench', 'bench', 'benches', 'kattenhuis', 'hondenhok'] })],
    ['walking', 'Leads, Collars & Harnesses', m({ end: ['hondenriem', 'hondenlijn', 'looplijn', 'rollijn', 'halsband', 'halsbanden', 'hondentuig', 'tuigje', 'hondenjas', 'hondenjasje', 'hondenschoenen'] })],
    ['feeding', 'Bowls & Feeders', m({ end: ['voerbak', 'voerbakken', 'drinkbak', 'waterbak', 'drinkfontein', 'voerautomaat', 'voerbakje', 'likmat', 'slow feeder'] })],
    ['grooming', 'Grooming', m({ end: ['hondenborstel', 'kattenborstel', 'vachtborstel', 'ontwolborstel', 'hondenshampoo', 'nagelknipper', 'trimmer', 'tekentang', 'vlooienkam'] })],
    ['food', 'Treats', m({ end: ['hondensnack', 'hondensnacks', 'kattensnack', 'kattensnacks', 'kauwbot', 'kauwstaaf', 'hondenkoekjes', 'snoepjes'] })],
    ['food', 'Food', m({ end: ['hondenvoer', 'kattenvoer', 'hondenbrokken', 'kattenbrokken', 'natvoer', 'brokken'] })],
    ['toys', 'Toys & Training', m({ end: ['hondenspeelgoed', 'kattenspeelgoed', 'hondenbal', 'kattenhengel', 'snuffelmat', 'trainingsclicker', 'apporteerspeelgoed', 'speeltje'] })]
  ],
  cgw: [
    ['Safety Boots', 'Safety Boots', m({ end: ['werkschoenen hoog', 'werklaarzen', 'werklaars', 'veiligheidslaarzen', 'veiligheidslaars'] })],
    ['Safety Boots', 'Wellingtons', m({ end: ['werkklompen', 'werkregenlaarzen', 's5 laarzen'] })],
    ['Safety Boots', 'Safety Shoes', m({ end: ['werkschoen', 'werkschoenen', 'veiligheidsschoen', 'veiligheidsschoenen'], word: ['s1p?', 's3', 'sb', 's1-p'] }), /werk|veilig|safety|s1|s3/i],
    ['Workwear', 'Work Trousers', m({ end: ['werkbroek', 'werkbroeken', 'amerikaanse overall'] })],
    ['Workwear', 'Work Shorts', m({ end: ['werkshort', 'werkshorts', 'korte werkbroek'] })],
    ['Workwear', 'Coveralls & Overalls', m({ end: ['overall', 'overalls', 'werkoverall', 'wegwerpoverall'] })],
    ['Workwear', 'Hi-Vis', m({ end: ['signaalvest', 'signaaljas', 'veiligheidsvest', 'reflectievest'], word: ['hi-vis', 'rws'] })],
    ['Workwear', 'Bodywarmers & Gilets', m({ end: ['bodywarmer', 'bodywarmers'] })],
    ['Workwear', 'Jackets & Coats', m({ end: ['werkjas', 'werkjassen', 'werkjack'] })],
    ['PPE', 'Work Gloves', m({ end: ['werkhandschoenen', 'werkhandschoen', 'montagehandschoenen', 'snijbestendige handschoenen'] })],
    ['PPE', 'Eye & Face Protection', m({ end: ['veiligheidsbril', 'veiligheidsbrillen', 'gelaatsscherm', 'lasmasker', 'lashelm'] })],
    ['PPE', 'Hearing Protection', m({ end: ['gehoorbescherming', 'oorkappen', 'oordopjes'] })],
    ['PPE', 'Respiratory Protection', m({ end: ['stofmasker', 'stofmaskers', 'adembescherming', 'halfgelaatsmasker'], word: ['ffp[123]'] })],
    ['PPE', 'Knee Protection', m({ end: ['kniebeschermers', 'kniebeschermer', 'kniestukken'] })],
    ['PPE', 'Head Protection', m({ end: ['veiligheidshelm', 'bouwhelm', 'stootpet'] })],
    ['Power Tools', 'Batteries & Chargers', m({ end: ['accupack', 'gereedschapsaccu', 'snellader'] }), /accu|lader|ah/i],
    ['Power Tools', 'Drills & Drivers', m({ end: ['boormachine', 'boormachines', 'schroefmachine', 'schroefmachines', 'boorhamer', 'klopboormachine', 'slagschroevendraaier', 'accuboormachine',
      'boorschroefmachine', 'schroevendraaier elektrisch'] })],
    ['Power Tools', 'Grinders', m({ end: ['haakse slijper', 'slijptol', 'slijpmachine', 'bankslijpmachine'] })],
    ['Power Tools', 'Saws', m({ end: ['cirkelzaag', 'decoupeerzaag', 'reciprozaag', 'afkortzaag', 'invalzaag', 'tafelzaag', 'zaagmachine', 'figuurzaag'] })],
    ['Power Tools', 'Sanders', m({ end: ['schuurmachine', 'schuurmachines', 'excentrische schuurmachine', 'deltaschuurmachine', 'bandschuurmachine'] })],
    ['Power Tools', 'Multi-Tools', m({ end: ['multitool', 'multitools', 'multifunctionele gereedschap'] }), /accu|elektr|watt|\d+\s?w\b|\d+\s?v\b/i],
    ['Power Tools', 'Power Tools', m({ end: ['heteluchtpistool', 'freesmachine', 'bovenfrees', 'lijmpistool', 'nietmachine elektrisch', 'tacker elektrisch', 'soldeerbout', 'breekhamer', 'sloophamer'] })],
    ['Site Equipment', 'Ladders', m({ end: ['ladder', 'ladders', 'trapladder', 'huishoudtrap', 'telescoopladder', 'steiger', 'rolsteiger'] })],
    ['Site Equipment', 'Lighting', m({ end: ['bouwlamp', 'bouwlampen', 'werklamp', 'werklampen', 'bouwstraler'] })],
    ['Site Equipment', 'Vacuum Cleaners', m({ end: ['bouwstofzuiger', 'alleszuiger', 'nat- en droogzuiger', 'werkplaatsstofzuiger'] })],
    ['Site Equipment', 'Mixing Tubs & Buckets', m({ end: ['speciekuip', 'mortelkuip', 'bouwemmer', 'specieemmer'] })],
    ['Site Equipment', 'Site Equipment', m({ end: ['werkbank', 'werkbanken', 'gereedschapskist', 'gereedschapskoffer', 'gereedschapswagen', 'zaagbok', 'zaagbokken', 'bouwradio'] })],
    ['Hand Tools', 'Tool Sets', m({ end: ['gereedschapsset', 'gereedschapssets', 'bitset', 'bitsets', 'boorset', 'borenset', 'doppenset', 'dopsleutelset', 'ratelset'] })],
    ['Hand Tools', 'Measuring Tools', m({ end: ['waterpas', 'rolmaat', 'duimstok', 'afstandsmeter', 'laserwaterpas', 'kruislijnlaser', 'meetlint', 'schuifmaat'] })],
    ['Hand Tools', 'Hammers', m({ end: ['hamer', 'hamers', 'klauwhamer', 'moker', 'rubberhamer'] })],
    ['Hand Tools', 'Screwdrivers', m({ end: ['schroevendraaier', 'schroevendraaiers', 'schroevendraaierset'] })],
    ['Hand Tools', 'Pliers & Cutters', m({ end: ['tang', 'tangen', 'combinatietang', 'waterpomptang', 'kniptang', 'striptang', 'betonschaar', 'kabelschaar'] })],
    ['Hand Tools', 'Spanners & Wrenches', m({ end: ['steeksleutel', 'ringsleutel', 'steekringsleutel', 'inbussleutel', 'inbussleutelset', 'ratelsleutel', 'verstelbare sleutel', 'moersleutel'] })],
    ['Hand Tools', 'Saws & Knives', m({ end: ['handzaag', 'ijzerzaag', 'afbreekmes', 'stanleymes', 'uitschuifmes', 'japanse zaag'] })],
    ['Hand Tools', 'Chisels & Files', m({ end: ['beitel', 'beitels', 'beitelset', 'vijl', 'vijlen', 'rasp'] })]
  ],
  ggw: [
    ['Power Garden Tools', 'Lawn Mowers', m({ end: ['grasmaaier', 'grasmaaiers', 'robotmaaier', 'robotmaaiers', 'cirkelmaaier', 'kooimaaier', 'zitmaaier'] })],
    ['Power Garden Tools', 'Trimmers', m({ end: ['grastrimmer', 'grastrimmers', 'bosmaaier', 'kantenmaaier'] })],
    ['Power Garden Tools', 'Hedge Trimmers', m({ end: ['heggenschaar', 'heggenscharen', 'heggentrimmer'] }), /accu|elektr|\d+\s?v\b|\d+\s?w\b|benzine/i],
    ['Power Garden Tools', 'Leaf Blowers', m({ end: ['bladblazer', 'bladblazers', 'bladzuiger'] })],
    ['Power Garden Tools', 'Chainsaws', m({ end: ['kettingzaag', 'kettingzagen', 'snoeizaag elektrisch', 'stokzaag'] })],
    ['Power Garden Tools', 'Pressure Washers', m({ end: ['hogedrukreiniger', 'hogedrukreinigers', 'terrasreiniger'] })],
    ['Power Garden Tools', 'Shredders & Scarifiers', m({ end: ['hakselaar', 'versnipperaar', 'verticuteermachine', 'verticuteerder'] })],
    ['BBQ & Outdoor Cooking', 'Pizza ovens', m({ end: ['pizzaoven', 'pizzaovens'] })],
    ['BBQ & Outdoor Cooking', 'Smokers & grills', m({ end: ['kamado', 'rookoven', 'smoker', 'gasbarbecue', 'houtskoolbarbecue', 'barbecue', 'barbecues', 'bbq', 'grill'] })],
    ['BBQ & Outdoor Cooking', 'BBQ accessories', m({ end: ['barbecuehoes', 'bbq-hoes', 'grillrooster', 'barbecuetang', 'aansteekblokjes', 'houtskool', 'briketten', 'grillborstel'] })],
    ['Garden Furniture & Outdoor Living', 'Fire pits & heaters', m({ end: ['vuurkorf', 'vuurkorven', 'vuurschaal', 'terrasverwarmer', 'terrasverwarming'] })],
    ['Garden Furniture & Outdoor Living', 'Loungers', m({ end: ['ligbed', 'ligbedden', 'zonnebed', 'strandbed'] })],
    ['Garden Furniture & Outdoor Living', 'Hammocks & swing seats', m({ end: ['hangmat', 'hangmatten', 'hangstoel', 'schommelbank'] })],
    ['Garden Furniture & Outdoor Living', 'Parasols', m({ end: ['parasol', 'parasols', 'zweefparasol', 'parasolvoet', 'schaduwdoek'] })],
    ['Garden Furniture & Outdoor Living', 'Lounge & corner sets', m({ end: ['loungeset', 'loungesets', 'hoekbank tuin', 'tuinbank'] })],
    ['Garden Furniture & Outdoor Living', 'Dining sets', m({ end: ['tuinset', 'tuinsets', 'diningset', 'bistroset'] })],
    ['Garden Furniture & Outdoor Living', 'Chairs & benches', m({ end: ['tuinstoel', 'tuinstoelen', 'stapelstoel', 'tuinbankje'] })],
    ['Garden Furniture & Outdoor Living', 'Tables', m({ end: ['tuintafel', 'tuintafels', 'bijzettafel buiten'] })],
    ['Garden Furniture & Outdoor Living', 'Cushions & rugs', m({ end: ['tuinkussen', 'tuinkussens', 'loungekussen', 'loungekussens', 'buitenkleed', 'buitenkleden'] })],
    ['Garden Furniture & Outdoor Living', 'Furniture covers', m({ end: ['tuinmeubelhoes', 'beschermhoes tuinset', 'loungesethoes'] })],
    ['Garden Buildings, Fencing & Storage', 'Greenhouses', m({ end: ['kas', 'broeikas', 'tuinkas', 'kweekkas'] })],
    ['Garden Buildings, Fencing & Storage', 'Sheds', m({ end: ['tuinhuis', 'tuinhuisje', 'berging', 'schuur', 'tuinschuur'] })],
    ['Garden Buildings, Fencing & Storage', 'Storage', m({ end: ['kussenbox', 'tuinkist', 'opbergbox tuin', 'containerberging'] })],
    ['Garden Buildings, Fencing & Storage', 'Fencing & screening', m({ end: ['schutting', 'tuinscherm', 'tuinschermen', 'tuinhek', 'balkonscherm', 'windscherm', 'gaas'] })],
    ['Watering & Irrigation', 'Hoses & reels', m({ end: ['tuinslang', 'tuinslangen', 'slanghaspel', 'slangwagen', 'spuitpistool', 'druppelslang'] })],
    ['Watering & Irrigation', 'Sprinklers & water butts', m({ end: ['sproeier', 'sproeiers', 'regenton', 'regentonnen', 'gieter', 'gieters', 'irrigatieset', 'beregeningscomputer'] })],
    ['Outdoor Lighting & Garden Electrical', 'Solar lights', m({ end: ['solarlamp', 'solarlampen', 'solar tuinverlichting', 'solarlichtsnoer'] })],
    ['Outdoor Lighting & Garden Electrical', 'String & festoon lights', m({ end: ['lichtsnoer', 'lichtsnoeren', 'prikkabel'] })],
    ['Outdoor Lighting & Garden Electrical', 'Outdoor lights', m({ end: ['tuinverlichting', 'buitenlamp', 'buitenlampen', 'tuinlamp', 'tuinspot', 'prikspot', 'wandlamp buiten'] })],
    ['Plants, Growing & Garden Care', 'Seeds & bulbs', m({ end: ['zaden', 'zaadjes', 'bloembollen', 'bollen', 'graszaad'] })],
    ['Plants, Growing & Garden Care', 'Compost & feed', m({ end: ['potgrond', 'tuinaarde', 'meststof', 'mest', 'compost', 'kalk', 'gazonmest', 'plantenvoeding'] })],
    ['Plants, Growing & Garden Care', 'Pots & planters', m({ end: ['plantenbak', 'plantenbakken', 'bloembak', 'bloembakken', 'kweekbak', 'kweekset', 'moestuinbak'] })],
    ['Garden Tools', 'Pruning', m({ end: ['snoeischaar', 'snoeischaren', 'takkenschaar', 'snoeizaag', 'heggenschaar', 'grasschaar'] })],
    ['Garden Tools', 'Digging & raking', m({ end: ['schop', 'schoppen', 'spade', 'spades', 'hark', 'harken', 'schoffel', 'grondboor', 'plantschep', 'bladhark'] })],
    ['Garden Tools', 'Wheelbarrows', m({ end: ['kruiwagen', 'kruiwagens', 'tuinkar'] })],
    ['Garden Tools', 'Gloves & kneelers', m({ end: ['tuinhandschoenen', 'tuinhandschoen', 'knielkussen'] })]
  ],
  // Fashion (Damesmode, Herenmode, Kindermode and the perfume search). WGW/MGW/KGW category names, then the subcategory.
  fashion: [
    // Gloves first: "handschoenen" ends with "schoenen" (shoes).
    ['Bags & Accessories', 'Gloves', m({ end: ['handschoenen', 'wanten'] })],
    ['Shoes', 'Trainers', m({ end: ['sneaker', 'sneakers', 'gympen', 'gymschoenen'] })],
    ['Shoes', 'Boots', m({ end: ['laars', 'laarzen', 'laarsjes', 'enkellaarsjes', 'enkellaarzen', 'boots', 'chelsea boots', 'snowboots'] })],
    ['Shoes', 'Sandals', m({ end: ['sandaal', 'sandalen', 'slippers', 'teenslippers', 'badslippers'] })],
    ['Shoes', 'Slippers', m({ end: ['pantoffel', 'pantoffels', 'sloffen'] })],
    ['Shoes', 'Shoes', m({ end: ['pumps', 'instappers', 'veterschoenen', 'loafers', 'ballerina', 'ballerina\'s', 'mocassins', 'schoenen', 'schoen'] })],
    ['Bags & Accessories', 'Wallets & Purses', m({ end: ['portemonnee', 'portemonnees', 'pasjeshouder', 'kaarthouder'] })],
    ['Bags & Accessories', 'Bags', m({ end: ['handtas', 'handtassen', 'schoudertas', 'schoudertassen', 'crossbodytas', 'shopper', 'rugzak', 'rugzakken', 'heuptas', 'clutch', 'laptoptas'], word: ['tas', 'tassen', 'tasje'] })],
    ['Bags & Accessories', 'Belts', m({ end: ['riem', 'riemen', 'broekriem', 'ceintuur'] })],
    ['Bags & Accessories', 'Scarves', m({ end: ['sjaal', 'sjaals', 'omslagdoek', 'colsjaal'] })],
    ['Bags & Accessories', 'Hats', m({ end: ['muts', 'mutsen', 'beanie', 'hoed', 'hoeden', 'bucket hat'], word: ['pet', 'petten', 'cap'] })],
    ['Bags & Accessories', 'Sunglasses', m({ end: ['zonnebril', 'zonnebrillen'] })],
    ['Bags & Accessories', 'Ties', m({ end: ['stropdas', 'stropdassen', 'vlinderdas', 'vlinderstrik'] })],
    ['Bags & Accessories', 'Umbrellas', m({ end: ['paraplu', 'paraplus', 'paraplu\'s'] })],
    ['Watches', 'Watches', m({ end: ['horloge', 'horloges', 'polshorloge'] })],
    ['Jewellery', 'Necklaces', m({ end: ['ketting', 'kettingen', 'collier', 'hanger'] })],
    ['Jewellery', 'Bracelets', m({ end: ['armband', 'armbanden', 'bangle'] })],
    ['Jewellery', 'Earrings', m({ end: ['oorbellen', 'oorbel', 'oorknopjes', 'creolen'] })],
    ['Jewellery', 'Rings', m({ word: ['ring', 'ringen', 'ringset'] })],
    ['Clothing', 'Swimwear', m({ end: ['bikini', 'bikini\'s', 'badpak', 'badpakken', 'zwembroek', 'zwembroeken', 'zwemshort', 'zwemshorts', 'tankini'] })],
    ['Clothing', 'Nightwear', m({ end: ['pyjama', 'pyjama\'s', 'nachthemd', 'nachthemden', 'nachtjapon', 'badjas', 'badjassen', 'ochtendjas', 'onesie'] })],
    ['Clothing', 'Underwear', m({ end: ['onderbroek', 'onderbroeken', 'boxershort', 'boxershorts', 'boxer', 'slip', 'slips', 'string', 'ondergoed', 'onderhemd', 'beha', "bh's"], word: ['bh'] })],
    ['Clothing', 'Socks', m({ end: ['sok', 'sokken', 'kousen', 'panty', 'panty\'s', 'maillot'] })],
    ['Clothing', 'Dresses', m({ end: ['jurk', 'jurken', 'jurkje', 'jurkjes'] })],
    ['Clothing', 'Skirts', m({ end: ['rokje', 'rokjes'], word: ['rok', 'rokken', 'minirok', 'maxirok'] })],
    ['Clothing', 'Jeans', m({ end: ['jeans', 'spijkerbroek', 'spijkerbroeken'] })],
    ['Clothing', 'Shorts', m({ end: ['korte broek', 'shorts', 'short', 'bermuda'] })],
    ['Clothing', 'Trousers', m({ end: ['broek', 'broeken', 'pantalon', 'chino', 'chinos', 'legging', 'leggings', 'joggingbroek', 'cargobroek', 'jogger'] })],
    ['Clothing', 'Jackets & Coats', m({ end: ['regenjas', 'winterjas', 'jas', 'jassen', 'jack', 'jacket', 'jackets', 'parka', 'parka\'s', 'blazer', 'blazers', 'colbert', 'mantel', 'trenchcoat', 'gilet', 'bodywarmer'] })],
    ['Clothing', 'Hoodies', m({ end: ['hoodie', 'hoodies', 'hooded sweater'] })],
    ['Clothing', 'Sweatshirts', m({ end: ['sweater', 'sweaters', 'sweatshirt', 'sweatshirts'] })],
    ['Clothing', 'Knitwear', m({ end: ['trui', 'truien', 'coltrui', 'vest', 'vesten', 'cardigan', 'pullover'] })],
    ['Clothing', 'Shirts', m({ end: ['overhemd', 'overhemden', 'blouse', 'blouses', 'tuniek'] })],
    ['Clothing', 'Polo Shirts', m({ end: ['polo', 'polo\'s', 'poloshirt', 'poloshirts'] })],
    ['Clothing', 'T-Shirts', m({ end: ['t-shirt', 't-shirts', 'tshirt', 'tanktop', 'top', 'tops', 'longsleeve', 'shirt', 'shirts'] })],
    ['Clothing', 'Suits', m({ end: ['maatpak', 'driedelig pak', 'tweedelig pak', 'kostuumbroek'] })],
    ['Clothing', 'Sets', m({ end: ['kledingset', 'kledingsetje', 'joggingpak', 'huispak', 'boxpakje', 'rompertje', 'rompers', 'romper', 'babypakje'] })]
  ],
  // The perfume search. The site decides the category name.
  perfume: [
    ['Fragrance', 'Gift sets', m({ end: ['geschenkset', 'giftset', 'cadeauset', 'parfumset'] })],
    ['Fragrance', 'Fragrance', m({ end: ['parfum', 'eau de parfum', 'eau de toilette', 'eau de cologne', 'aftershave', 'bodymist', 'body mist', 'geurtje'] })]
  ]
};

// HGW: the appliances and cleaning of "Huishouden" first (lib/home-eu.mjs has the furniture, decor, bedding and kitchen words).
export const HGW_FIRST = [
  ['Home Appliances', 'Coffee Machine', m({ end: ['koffiezetapparaat', 'koffiezetapparaten', 'koffiemachine', 'koffiemachines', 'espressomachine', 'espressoapparaat', 'koffiepadmachine', 'cupmachine', 'melkopschuimer'] })],
  ['Home Appliances', 'Kettle', m({ end: ['waterkoker', 'waterkokers'] })],
  ['Home Appliances', 'Toaster', m({ end: ['broodrooster', 'broodroosters', 'tosti-ijzer', 'tostiapparaat'] })],
  ['Home Appliances', 'Air Fryer', m({ end: ['airfryer', 'airfryers', 'heteluchtfriteuse', 'friteuse', 'frituurpan'] })],
  ['Home Appliances', 'Blender', m({ end: ['blender', 'blenders', 'staafmixer', 'staafmixers', 'smoothiemaker'] })],
  ['Home Appliances', 'Food Processor', m({ end: ['keukenmachine', 'keukenmachines', 'foodprocessor', 'hakmolen', 'mixer', 'handmixer', 'sapcentrifuge', 'slowjuicer'] })],
  ['Home Appliances', 'Microwave', m({ end: ['magnetron', 'magnetrons', 'combimagnetron', 'heteluchtoven', 'mini-oven'] })],
  ['Home Appliances', 'Small Appliances', m({ end: ['rijstkoker', 'gourmetstel', 'grillplaat', 'contactgrill', 'wafelijzer', 'stoomkoker', 'slowcooker', 'multicooker', 'snelkookpan elektrisch', 'eierkoker'] })],
  ['Home Appliances', 'Fan', m({ end: ['ventilator', 'ventilatoren', 'torenventilator', 'statiefventilator'] })],
  ['Home Appliances', 'Heater', m({ end: ['kachel', 'elektrische kachel', 'heater', 'oliegevulde radiator', 'kachels'] })],
  ['Home Appliances', 'Air Purifier', m({ end: ['luchtreiniger', 'luchtreinigers', 'luchtzuiveraar'] })],
  ['Home Appliances', 'Dehumidifier', m({ end: ['luchtontvochtiger', 'luchtontvochtigers', 'vochtvreter'] })],
  ['Home Appliances', 'Humidifier', m({ end: ['luchtbevochtiger', 'luchtbevochtigers'] })],
  ['Home Appliances', 'Vacuum Cleaner', m({ end: ['stofzuiger', 'stofzuigers', 'steelstofzuiger', 'robotstofzuiger', 'kruimeldief', 'handstofzuiger'] })],
  ['Cleaning & Laundry', 'Steam Cleaner', m({ end: ['stoomreiniger', 'stoomreinigers', 'stoomzuiger'] })],
  ['Cleaning & Laundry', 'Vacuum Accessories', m({ end: ['stofzuigerzakken', 'stofzuigerzak', 'stofzuigerfilter', 'stofzuigermond'] })],
  ['Cleaning & Laundry', 'Ironing & Clothes Care', m({ end: ['strijkijzer', 'strijkijzers', 'stoomstrijkijzer', 'strijkplank', 'strijkplanken', 'kledingstomer', 'stoomgenerator', 'pluizentondeuse'] })],
  ['Cleaning & Laundry', 'Clothes Airer', m({ end: ['droogrek', 'droogrekken', 'wasrek', 'wasrekken', 'droogmolen'] })],
  ['Cleaning & Laundry', 'Mop', m({ end: ['dweil', 'dweilen', 'vloerwisser', 'mop', 'mops', 'dweilsysteem', 'raamwisser', 'ramenwasser'] })],
  ['Cleaning & Laundry', 'Cleaning Products', m({ end: ['schoonmaakmiddel', 'allesreiniger', 'ontkalker', 'vaatwastabletten', 'wasmiddel', 'wasverzachter', 'afwasmiddel', 'schoonmaakdoekjes'] })],
  ['Storage & Organisation', 'Laundry Basket', m({ end: ['wasmand', 'wasmanden', 'wasbox'] })]
];

// The sub-categories that the WGW, MGW and KGW category names stand for (site_category of the older databases).
const FASHION_CATEGORY = {
  wgw: { Clothing: 'Clothing', Shoes: 'Shoes', 'Bags & Accessories': 'Bags & Accessories', Watches: 'Watches', Jewellery: "Women's Jewellery", Fragrance: 'Beauty & Fragrances' },
  mgw: { Clothing: 'Clothing', Shoes: 'Shoes', 'Bags & Accessories': 'Bags & Accessories', Watches: 'Watches', Jewellery: "Men's Jewellery", Fragrance: 'Grooming & Fragrances' },
  kgw: { Clothing: 'Clothing', Shoes: 'Shoes', 'Bags & Accessories': 'Accessories', Watches: 'Accessories', Jewellery: 'Accessories' }
};
// A product of Damesmode that says it is for men (or the other way round) is not placed by these rules.
const MEN = /(?<![\p{L}])(?:heren|mannen|man|men|jongens?)(?![\p{L}])/iu;
const WOMEN = /(?<![\p{L}])(?:dames|vrouwen|vrouw|women|meisjes?)(?![\p{L}])/iu;
const ADULT = /(?<![\p{L}])(?:dames|heren|volwassenen|vrouwen|mannen)(?![\p{L}])/iu;

// The first text (GS1 levels deepest first, then the head of the name) that a rule matches; a rule with a fourth part
// matches only when the whole name has that word too (an electric hedge trimmer is a power tool, the shears are not).
function placeIn(rules, texts, whole, fromName = texts.length - 1) {
  for (const [i, text] of texts.entries()) {
    for (const [cat, sub, re, when] of rules) {
      if (re.test(text) && (!when || when.test(whole))) return { cat, sub, doubt: i >= fromName ? true : undefined };
    }
  }
  return null;
}
// The parts of a name: its head first, then the other parts ("Skechers KEEPSAKES COZY - COZY MINI Dames Instappers -
// Taupe": the shoe word is in the second part), then the whole name.
export function nameParts(n) {
  const parts = String(n || '').split(/\s*[|,]\s*|\s+[-–]\s+/).map(s => s.trim()).filter(Boolean);
  return [...new Set([headOf(n), ...parts, String(n || '').trim()])].filter(Boolean);
}

const BRAND_NOISE = /(?:jack\s*(?:&|and|en)\s*jones|jack\s+wolfskin|tommy\s+jeans|calvin\s+klein\s+jeans|pepe\s+jeans|lee\s+cooper|u\.?\s?s\.?\s+polo(?:\s+assn\.?)?|polo\s+ralph\s+lauren)/giu;
// { cat, sub } (cat: the site_category of an older site, the category slug of a newer one) or { reject }.
// texts: the GS1 levels (deepest first), then the head of the name (a place found only there is "doubt").
export function placeBol(site, { name, gpc = '', search = '' }) {
  const n = bolBaseName(name);
  const parts = gpcParts(gpc);
  const banned = bannedReason(`${n} | ${gpc}`);
  if (banned) return { reject: banned };
  // Brand names that look like a product word ("JACK&JONES ... Heren Trui" is a jumper, not a jacket) do not place it.
  const names = nameParts(n.replace(BRAND_NOISE, ' ').replace(/\s+/g, ' ').trim() || n);
  const texts = [...parts, ...names];
  const fromName = parts.length;
  if (search === 'parfum') {
    const p = placeIn(PLACES.perfume, names, n);
    if (!p) return { reject: 'bol.com perfume search: not a perfume' };
    return { cat: FASHION_CATEGORY[site].Fragrance, sub: p.sub };
  }
  if (site === 'hgw') {
    if (HOME_ENERGY.test(n)) return { reject: 'a home battery or energy storage (not a Gear World product)' };
    const first = placeIn(HGW_FIRST, texts, n, fromName);
    if (first) return { cat: first.cat, sub: first.sub, ...(first.doubt ? { doubt: true } : {}) };
    // lib/home-eu.mjs reads "a|b|c" deepest LAST; the name head is its fallback (and its "doubt"). A name whose head is
    // only the brand ("Tefal - ...") is tried again with its other parts.
    let p = homePlaceEu({ name: n, feedCategory: parts.slice().reverse().join('|'), lang: 'nl' });
    for (const part of names.slice(1)) {
      if (!p.reject || !/not sure|not a home product/.test(p.reject)) break;
      const q = homePlaceEu({ name: part, feedCategory: parts.slice().reverse().join('|'), lang: 'nl' });
      if (!q.reject) p = { ...q, doubt: true };
    }
    if (p.reject) return { reject: p.reject.replace('of HGW', 'of Home Gear World') };
    return { cat: p.siteCategory, sub: p.subcategory, ...(p.doubt ? { doubt: true } : {}) };
  }
  if (site === 'wgw' || site === 'mgw' || site === 'kgw') {
    if (site === 'wgw' && MEN.test(n) && !WOMEN.test(n)) return { reject: "a men's or boys' product in Damesmode" };
    if (site === 'mgw' && WOMEN.test(n) && !MEN.test(n)) return { reject: "a women's or girls' product in Herenmode" };
    if (site === 'kgw' && ADULT.test(n)) return { reject: 'an adult product in Kindermode (not for a children\'s site)' };
    const p = placeIn(PLACES.fashion, texts, n, fromName);
    if (!p) return { reject: 'not a fashion product of the site, or not sure where it goes' };
    const cat = FASHION_CATEGORY[site][p.cat];
    if (!cat) return { reject: 'not a fashion product of the site, or not sure where it goes' };
    return { cat, sub: p.sub, ...(p.doubt ? { doubt: true } : {}) };
  }
  const rules = PLACES[site];
  if (!rules) return { reject: `site ${site} has no bol.com rules` };
  if (site === 'ggw' && PARTY.test(n)) return { reject: 'a party item (not a garden product)' };
  if (site === 'cgw' && HOME_ENERGY.test(n)) return { reject: 'a home battery or energy storage (not a DIY tool)' };
  if (site === 'cgw' && NOT_DIY.test(n)) return { reject: 'not a DIY tool or hardware (Klussen)' };
  const p = placeIn(rules, texts, n, fromName);
  if (!p) return { reject: 'not sure where it goes on the site (left out)' };
  return { cat: p.cat, sub: p.sub, ...(p.doubt ? { doubt: true } : {}) };
}

// The newer sites (tools/tgw-import-plan.mjs, sources.json "sections": "bol-nl"): { ok, slug, sub, name } or { ok: false, reason }.
export function bolSection(label, name, { categoryId = '', gpc = '', search = '' } = {}) {
  const site = String(label || '').toLowerCase();
  const p = bolPlace({ categoryId, search, name, rawName: name, gpc });
  if (p.reject) return { ok: false, reason: p.reject };
  if (p.site !== site) return { ok: false, reason: `bol.com ${p.source.name}: a product of ${p.site.toUpperCase()}, not this site` };
  return { ok: true, slug: p.cat, sub: p.sub, name: bolBaseName(name), ...(p.doubt ? { doubt: true } : {}) };
}

// ---- 6. Gender, Klussen, Tuin (Manager, first real profile of 20 Nov 2026) ----
// Clearly gendered clothing goes by its words: Heren/Mannen -> Men's, Dames/Vrouwen -> Women's, Kinder/Kids/Baby/Jongens/
// Meisjes or a children's size (maat 62 to 176) -> Kids'; both kinds of words, or none: the bol.com category decides.
const KIDS_WORDS = /(?<![\p{L}])(?:kinder\p{L}*|kind|kids|baby(?!blauw|roze|pink|blue)\p{L}*|babies|peuter\p{L}*|kleuter\p{L}*|jongens\p{L}*|meisjes\p{L}*|junior|girls|boys)(?![\p{L}])/iu;
const MEN_WORDS = /(?<![\p{L}])(?:heren\p{L}*|mannen|men|homme)(?![\p{L}])/iu;
const WOMEN_WORDS = /(?<![\p{L}])(?:dames\p{L}*|vrouwen|women|femme)(?![\p{L}])/iu;
export function kidsSize(rawName) {
  const m = /(?<![\p{L}\d])(?:maat|mt\.?|size)\s*:?\s*(\d{2,3})(?:\s*[-/]\s*(\d{2,3}))?(?![\d])/iu.exec(String(rawName || ''));
  if (!m) return false;
  const ok = v => v === undefined || (Number(v) >= 62 && Number(v) <= 176);
  return Number(m[1]) >= 62 && Number(m[1]) <= 176 && ok(m[2]);
}
export function genderSite(name, rawName = name) {
  const t = `${name} ${rawName}`;
  const kids = KIDS_WORDS.test(t) || kidsSize(rawName);
  const men = MEN_WORDS.test(t);
  const women = WOMEN_WORDS.test(t);
  if (kids) return men || women ? '' : 'kgw';
  if (men !== women) return men ? 'mgw' : 'wgw';
  return '';
}
export const FASHION_SITES = ['wgw', 'mgw', 'kgw'];
// Tuin: party items ("feest lampion", "Feestartikelen") are not garden products.
const PARTY = /(?:feest|lampion|ballon|slinger|confetti|verjaardag|carnaval|party(?!tent))/iu;
// Klussen: what is not a DIY tool or hardware; bath and shower mats or packing tape may be home products (HGW).
const NOT_DIY = /(?:badmat|douchemat|badkamermat|toiletmat|verpakkingstape|inpaktape|plakband|tape\b|deurmat)/iu;
// Home batteries and energy storage ("Anker Solarbank 7 kWh", over 1,000 euro): no Gear World site.
const HOME_ENERGY = /(?:thuisbatterij|thuisaccu|solarbank|energieopslag|home ?battery|thuisopslag|\d+(?:[.,]\d+)?\s?kwh)/iu;

// The site and place of one bol.com product: { site, source, cat, sub, doubt? } or { reject }.
// 1. The perfume search: its words (MEN_PERFUME / WOMEN_PERFUME) choose Women's or Men's.
// 2. Fashion categories (Damesmode, Herenmode, Kindermode): the name's gender words choose the fashion site, else the
//    category's.
// 3. Other categories: the category's site first; clearly gendered clothing it does not place goes to the fashion site its
//    words say (e.g. a men's softshell jacket in Kamperen & Outdoor -> Men's); Klussen's home products (bath mats) to
//    Home Gear World when they fit a Home category. Anything not placed with certainty stays out.
export function bolPlace({ categoryId = '', search = '', name = '', rawName = '', gpc = '' }) {
  const r = routeOf({ categoryId, search, name });
  if (r.reject) return { reject: r.reject };
  const at = (site, extra = {}) => {
    const p = placeBol(site, { name, gpc, search: r.source.search || '' });
    return p.reject ? p : { site, source: r.source, ...p, ...extra };
  };
  if (r.source.search) return at(r.site);
  const n = bolBaseName(name);
  const banned = bannedReason(`${n} | ${gpc}`);
  if (banned) return { reject: banned };
  const g = genderSite(n, rawName || name);
  if (FASHION_SITES.includes(r.site)) {
    if (!g || g === r.site) return at(r.site);
    const p = at(g);
    return p.reject ? at(r.site) : p;
  }
  const own = at(r.site);
  if (!own.reject) return own;
  const notPlaced = /not sure|not a DIY tool/.test(own.reject);
  if (g && notPlaced) {
    const f = at(g);
    if (!f.reject) return f;
  }
  if (r.site === 'cgw' && notPlaced) {
    const h = at('hgw');
    if (!h.reject) return h;
  }
  return own;
}
