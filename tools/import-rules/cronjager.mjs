// Import rules for Cronjager (Awin advertiser 98661), a UK marketplace (cronjager.com) that sells the products of
// about 50 small brands: jewellery, clothing, art prints, candles, lights, bedding, drinkware, bonsai trees (29 Oct 2026).
// Feed facts (feed sample 29 Oct 2026): 10 feeds, one per currency (GBP, EUR x5, USD, AUD, CAD, CHF), each with the same
// products (about 35,900 rows, one row per option). The same product page is in every feed, so ONLY the GBP feed is read:
// otherwise one card would mix pounds, euros and dollars. The GBP feed is found by reading the start of each file
// (feedFiles below), so a new feed number from Awin needs no change here.
// stock_quantity is empty and in_stock is 1 on every row.
// Places use each site's own subcategory names (lessons L56). Lessons L14: a "yes" list and a "no" list per place,
// a read-only plan with samples first, an import only with the owner's phrase.
// Left out on purpose:
//   - Irish Army / English.Army: print-on-demand slogan merch (flags, "Christian Nation") at prices far above normal
//     (a mug for CAD 132, a hoodie for CAD 228-296);
//   - www.remixd.store / My Store: resold Air Jordan trainers and an unnamed seller (cannot check they are genuine);
//   - sports products (padel, kayaks, surf, gym flooring, judo mats, tents): they belong on Sporty Gear World, whose
//     own import tool loads them; motorcycle helmets and parts (Daytona): Car Gear World, its own tool;
//   - spare parts, office supplies, phone cases, pets, toys, cards, pre-orders, children's items.
import { closeSync, existsSync, openSync, readdirSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { constants, gunzipSync } from 'node:zlib';
import { classify as fashionPlace } from './coes.mjs';
import { jewellerySub } from './angelbarocco.mjs';
import { FRAGRANCE_NAME, NAME_SUBS, BEAUTY_WORDS } from './joybuy.mjs';
import { gardenPlace } from './lib/garden.mjs';

export const RULES = {
  key: 'cronjager',
  advertiserId: 98661,
  retailer: 'Cronjager',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?cronjager\.com\/products\//i,
  sites: ['wgw', 'mgw', 'hgw', 'ggw'],
  maxPrice: 2500
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

// ---------- Which feed file is the GBP one ----------
// Reads the first rows of a feed file (only the start of the file) and returns the currency most rows have ('' if unsure).
export function feedCurrency(file) {
  let fd = null;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(512 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, n);
    const text = /\.gz$/i.test(file) ? gunzipSync(head, { finishFlush: constants.Z_SYNC_FLUSH }).toString('utf8') : head.toString('utf8');
    return currencyOfCsv(text);
  } catch {
    return '';
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

// The currency of most of the first rows of a CSV text (header row first, a "currency" column).
export function currencyOfCsv(text, maxRows = 300) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length && rows.length <= maxRows; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (rows.length < 2) return '';
  const head = rows[0].map(h => String(h).trim().toLowerCase().replace(/^﻿/, ''));
  const col = head.indexOf('currency');
  if (col < 0) return '';
  const counts = {};
  for (const r of rows.slice(1)) {
    if (r.length !== head.length) continue; // the last row may be cut in half
    const c = String(r[col] || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) counts[c] = (counts[c] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(counts).reduce((a, v) => a + v, 0);
  return best && best[1] >= Math.max(1, total * 0.9) ? best[0] : '';
}

export function feedFiles(archive) {
  if (!archive || !existsSync(archive)) return [];
  return readdirSync(archive)
    .filter(f => new RegExp(`^AWIN_${RULES.advertiserId}_\\d+\\.csv(\\.gz)?$`, 'i').test(f))
    .map(f => join(archive, f))
    .filter(f => feedCurrency(f) === RULES.currency);
}

// ---------- What is left out ----------
const norm = s => String(s || '').trim().toLowerCase();
const BRAND_OUT = [
  [/^(irish army|english\.?\s?army)$/, 'print-on-demand slogan merch (Irish Army, English.Army): prices far above normal'],
  [/^(www\.remixd\.store|my store)$/, 'resold trainers and an unnamed seller (www.remixd.store, My Store): cannot check they are genuine'],
  [/^(aixo|circle one surf|central sports uk|swole panda|sprung gym flooring|fatyak kayaks)$/, 'sports product: for Sporty Gear World (its own import tool)'],
  [/^daytona helmets( uk)?$/, 'motorcycle and car products (helmets, visors, car scents): for Car Gear World (its own import tool)']
];
// The same merch with another brand name: "ENGLAND - Unisex Hoodie", "Christian Nation - Tough Case".
const ARMY_NAME = /^(irish army|english army|england|ireland|northern ireland|christian nation)\s+-\s/i;
const SPORTS_CATEGORY = /^(Badminton|Outdoor Adventure|Cycling|Winter Sports|Extreme Sports|Leash|Leine|Laisse|Correa|Yoga ?Mat|Yogamatte|Women's Sportswear|Swimming Accessories)$/i;
const SPORTS_NAME = words(['padel', 'racket', 'racquet', 'kayak', 'kayaks', 'paddle', 'paddles', 'surfboard', 'surfboards', 'skimboard', 'skimboards', 'bodyboard',
  'bodyboards', 'wetsuit', 'wetsuits', 'changing robe', 'changing poncho', 'surf poncho', 'gym flooring', 'judo', 'tatami', 'yoga mat', 'exercise mat', 'gym mat',
  'tent', 'tents', 'sleeping bag', 'snow pants', 'ski', 'skis', 'snowboard', 'dumbbell', 'dumbbells', 'kettlebell', 'kettlebells', 'barbell', 'weight plate',
  'weight plates', 'resistance band', 'resistance bands', 'boxing gloves', 'surf wax', 'swim fins', 'leash', 'gym', 'workout']);
const MOTOR_CATEGORY = /^(Vehicle Security|Auto Care|Contact Lenses|Bluetooth Adapters|Visor|Visier|Visière|Visera|Car Parts)$/i;
const MOTOR_NAME = words(['helmet', 'helmets', 'visor', 'visors', 'pinlock', 'motorcycle', 'motorbike', 'car diffuser', 'car air freshener', 'car freshener']);
const NOT_SITES_CATEGORY = /^(Appliance Spares|Office Supplies|Mobile Phone Accessories|Headsets|Pets|Juicers|Games, Puzzles & Learning|Greeting Card|Grußkarte|Carte de vœux|Tarjeta de felicitación|Action Figures|Sports Memorabilia|Adult Gifts)$/i;
const KIDS_CATEGORY = /^(Baby Clothes|Baby Products|Children's Footwear)$/i;
const KIDS = words(['baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'kids', 'kid', "kid's", 'children', "children's", 'childrens', 'child', 'junior',
  'newborn', 'boys', "boy's", 'girls', "girl's", 'youth']);
const PRE_ORDER = words(['pre-sell', 'pre sell', 'presell', 'pre-order', 'pre order', 'preorder']);
const NOT_PRODUCT = words(['gift card', 'gift voucher', 'e-gift card', 'voucher', 'gift box', 'gift boxes', 'gift bag', 'gift wrap', 'gift wrapping', 'shipping protection',
  'insurance', 'phone case', 'iphone', 'airpods', 'samsung', 'yard sign', 'greeting card', 'sticker', 'stickers', 'pet', 'pets', 'dog collar', 'dog lead', 'dog bowl', 'dog bed',
  'pet bowl', 'pet bed', 'cat collar', 'bandana collar', 'polishing cloth', 'jewellery cleaner', 'jewelry cleaner']);
const SPARE = /^spare\b|\bspare parts?\b|\breplacement (parts?|shield|lens|visor|pads?)\b/i;

// ---------- Home (HGW) ----------
// Home phrases that hold a jewellery or clothing word ("pendant light", "ring dish"): checked before fashion.
const HOME_STRONG = words(['pendant light', 'pendant lights', 'pendant lamp', 'pendant lamps', 'ceiling pendant', 'ring dish', 'trinket dish', 'jewellery dish', 'jewelry dish',
  'jewellery box', 'jewelry box', 'jewellery stand', 'trinket box', 'candle holder', 'candle holders', 'tealight holder', 'tea light holder', 'duvet cover', 'pillow case',
  'pillowcase', 'pillowcases', 'wax melt', 'wax melts', 'reed diffuser', 'room spray', 'pillow spray', 'art print', 'art prints', 'wall art', 'ceiling light', 'table lamp',
  'floor lamp', 'wall light', 'bath mat', 'scented candle', 'soy candle', 'soy wax candle', 'candle', 'candles', 'suncatcher', 'suncatchers', 'sun catcher', 'sun catchers',
  'napkin ring', 'napkin rings', 'jewellery stand', 'jewelry stand', 'jewellery holder', 'jewelry holder', 'earring holder', 'ring holder', 'necklace holder', 'jewellery tree',
  'jewellery organiser', 'jewelry organizer', 'mug tree']);
const HOME_STRONG_ALL = new RegExp(HOME_STRONG.source, 'gi');
const HOME_PLACES = [
  // Scents first: "Glass Jar Soy Wax Candle" is a candle, "Room & Pillow Spray" is a room scent.
  [words(['candle holder', 'candle holders', 'candlestick', 'candlesticks', 'tealight holder', 'tea light holder', 'candle snuffer']), 'Home Decor', 'Ornament'],
  [words(['candle', 'candles', 'wax melt', 'wax melts', 'melts', 'reed diffuser', 'diffuser', 'diffusers', 'room spray', 'pillow spray', 'linen spray', 'home fragrance',
    'incense', 'oil burner', 'wax burner', 'melt burner', 'fragrance oil', 'room mist']), 'Home Decor', 'Home Fragrance'],
  [words(['pendant light', 'pendant lights', 'pendant lamp', 'pendant lamps', 'ceiling pendant']), 'Lighting', 'Pendant Light'],
  [words(['chandelier', 'chandeliers']), 'Lighting', 'Chandelier'],
  [words(['ceiling light', 'ceiling lights', 'flush light', 'semi flush', 'flush mount']), 'Lighting', 'Ceiling Light'],
  [words(['floor lamp', 'floor lamps', 'standing lamp']), 'Lighting', 'Floor Lamp'],
  [words(['wall light', 'wall lights', 'wall lamp', 'wall lamps', 'sconce', 'sconces']), 'Lighting', 'Wall Light'],
  [words(['lampshade', 'lampshades', 'lamp shade', 'lamp shades', 'light shade', 'light shades']), 'Lighting', 'Lampshade'],
  [words(['table lamp', 'table lamps', 'desk lamp', 'bedside lamp', 'lamp', 'lamps']), 'Lighting', 'Table Lamp'],
  [words(['duvet cover', 'duvet covers', 'duvet set', 'duvet', 'quilt cover', 'bedding set', 'bedding', 'comforter']), 'Bedding & Bath', 'Duvet'],
  [words(['pillow case', 'pillowcase', 'pillowcases', 'pillow', 'pillows']), 'Bedding & Bath', 'Pillow'],
  [words(['fitted sheet', 'flat sheet', 'bed sheet', 'bed sheets']), 'Bedding & Bath', 'Bed Sheet'],
  [/(?<![a-z0-9])(?<!tea )(towel|towels|bath sheet|bath sheets)(?![a-z0-9])/i, 'Bedding & Bath', 'Towel'],
  [words(['bath mat', 'bath mats']), 'Bedding & Bath', 'Bath Mat'],
  [words(['cushion', 'cushions', 'cushion cover', 'cushion covers']), 'Home Decor', 'Cushion'],
  [words(['rug', 'rugs']), 'Home Decor', 'Rug'],
  [words(['curtain', 'curtains']), 'Home Decor', 'Curtain'],
  [words(['clock', 'clocks']), 'Home Decor', 'Clock'],
  [words(['vase', 'vases']), 'Home Decor', 'Vase'],
  [words(['jewellery box', 'jewelry box', 'trinket box', 'keepsake box', 'storage box', 'storage boxes']), 'Storage & Organisation', 'Storage Box'],
  [words(['jewellery stand', 'jewelry stand', 'jewellery holder', 'jewelry holder', 'earring holder', 'ring holder', 'necklace holder', 'jewellery tree', 'jewellery organiser',
    'jewelry organizer']), 'Storage & Organisation', 'Storage Rack'],
  [words(['napkin ring', 'napkin rings']), 'Kitchen & Dining', 'Tableware'],
  [words(['ornament', 'ornaments', 'figurine', 'figurines', 'sculpture', 'sculptures', 'statue', 'statues', 'suncatcher', 'suncatchers', 'sun catcher', 'sun catchers',
    'light catcher', 'hanging decoration', 'decoration', 'decorations', 'trinket dish', 'ring dish', 'jewellery dish', 'jewelry dish', 'wind chime', 'wind chimes',
    'dreamcatcher', 'dream catcher', 'bookend', 'bookends', 'prism', 'crystal ball', 'plaque', 'wall hanging']), 'Home Decor', 'Ornament'],
  [words(['mirror', 'mirrors']), 'Home Decor', 'Mirror'],
  [words(['shot glass', 'shot glasses', 'wine glass', 'wine glasses', 'glasses', 'stemless glass', 'drinking glass', 'gin glass', 'whisky glass', 'whiskey glass', 'pint glass',
    'beer glass', 'cocktail glass', 'martini glass', 'highball', 'highballs', 'champagne flute', 'champagne flutes', 'flutes', 'coupe', 'coupes', 'rocks glass', 'glassware',
    'carafe']), 'Kitchen & Dining', 'Glassware'],
  [words(['hip flask', 'hip flasks', 'cocktail shaker', 'bottle opener', 'ice bucket', 'decanter', 'wine stopper', 'coaster', 'coasters', 'bar set', 'jigger']), 'Kitchen & Dining', 'Bar Accessories'],
  // Spoons before cups: "Tea Spoon Set, Hang-on Cup Design" is cutlery.
  [words(['spoon', 'spoons', 'teaspoon', 'teaspoons', 'tea spoon', 'tea spoons', 'cutlery', 'fork', 'forks', 'knife', 'knives']), 'Kitchen & Dining', 'Cutlery'],
  [words(['mug', 'mugs', 'cup', 'cups', 'travel mug', 'tumbler', 'tumblers', 'water bottle', 'bottle', 'bottles', 'flask', 'flasks', 'teapot', 'tea pot', 'tea set',
    'teacup', 'tea cup', 'coffee cup', 'beaker', 'beakers', 'mug tree']), 'Kitchen & Dining', 'Drinkware'],
  [words(['chopping board', 'cutting board', 'serving board', 'cheese board']), 'Kitchen & Dining', 'Chopping Board'],
  [words(['plate', 'plates', 'bowl', 'bowls', 'dish', 'dishes', 'platter', 'platters', 'cake stand', 'tray', 'trays', 'napkin', 'napkins', 'placemat', 'placemats',
    'table runner', 'butter dish', 'jug', 'jugs', 'egg cup', 'egg cups', 'salt and pepper']), 'Kitchen & Dining', 'Tableware'],
  [words(['coffee table', 'side table']), 'Furniture', 'Coffee Table'],
  [words(['dining table']), 'Furniture', 'Dining Table'],
  [words(['bookcase', 'bookcases', 'bookshelf', 'bookshelves']), 'Furniture', 'Bookcase'],
  [words(['sideboard', 'sideboards']), 'Furniture', 'Sideboard'],
  [words(['armchair', 'armchairs']), 'Furniture', 'Armchair'],
  // Last: "print" is also a pattern ("Floral Print Mug" is a mug).
  [words(['art print', 'art prints', 'print', 'prints', 'giclee', 'giclée', 'canvas', 'canvas print', 'framed', 'poster', 'posters', 'painting', 'paintings',
    'original artwork', 'artwork', 'linocut', 'lino print', 'etching', 'screen print', 'screenprint', 'wall art', 'watercolour', 'watercolor', 'lithograph']), 'Home Decor', 'Wall Art']
];
const HOME_CATEGORY = /^(Art|Living Room|Beds|Crockery|Drinkware|Glassware|Cookware & Utensils|Kitchen Units|Furniture Accessories|Decorations|Home Textiles|House Accessories|Cakes, Snacks & Sweets|Tables|Bespoke Kitchens|Alcoholic Drinks|Arts & Crafts)$/i;
const ART_BRAND = /^(the artist's house gallery|terry kneeshaw art|rhia janta-cooper fine art)$/i;

export function homePlace(name) {
  const n = String(name || '');
  for (const [re, cat, sub] of HOME_PLACES) if (re.test(n)) return { site: 'hgw', siteCategory: cat, subcategory: sub };
  return null;
}

// ---------- Garden (GGW): Yorkshire Bonsai ----------
const BONSAI_GROWING = words(['pot', 'pots', 'tray', 'trays', 'soil', 'akadama', 'compost', 'feed', 'fertiliser', 'fertilizer', 'grit', 'kanuma', 'pumice', 'mix']);
const BONSAI_WIRE = words(['wire', 'wires', 'wiring']);
const BONSAI_TOOL = words(['tool', 'tools', 'scissors', 'shears', 'cutter', 'cutters', 'pliers', 'tweezers', 'rake', 'knife', 'saw', 'kit']);
export function bonsaiPlace(name) {
  const n = String(name || '');
  const cat = 'Plants, Growing & Garden Care';
  if (BONSAI_WIRE.test(n)) return { site: 'ggw', siteCategory: cat, subcategory: 'Ties & Wire' };
  if (BONSAI_GROWING.test(n) || BONSAI_TOOL.test(n)) return { site: 'ggw', siteCategory: cat, subcategory: 'Growing' };
  return { site: 'ggw', siteCategory: cat, subcategory: 'Plants' };
}

// ---------- Fashion (WGW, MGW) ----------
const MEN = words(['men', "men's", 'mens', 'male', 'for him', 'gents', 'gentleman', "gentleman's"]);
const WOMEN = words(['women', "women's", 'womens', 'ladies', "ladies'", 'lady', 'female', 'for her', 'wmns']);
// Jewellery words. Strong ones say jewellery for sure; weak ones ("chain", "charm", "pearl", "hoop") only when nothing
// else in the name is a garment ("Pearl Button Cardigan" is a cardigan, "Ring Spun Cotton Tee" a T-shirt).
const STRONG_JEWELLERY = words(['earring', 'earrings', 'necklace', 'necklaces', 'bracelet', 'bracelets', 'bangle', 'bangles', 'anklet', 'anklets', 'choker', 'chokers',
  'pendant', 'pendants', 'locket', 'lockets', 'brooch', 'brooches', 'cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins',
  'ear cuff', 'ear cuffs', 'ear climber', 'ear climbers', 'ear jacket', 'ear jackets', 'huggie', 'huggies', 'threader', 'threaders', 'body chain', 'nose ring', 'nose stud',
  'septum', 'signet', 'jewellery', 'jewelry', 'ring', 'rings', 'charm bracelet', 'dress studs', 'shirt studs', 'birthstone']);
const WEAK_JEWELLERY = words(['chain', 'chains', 'charm', 'charms', 'pearl', 'pearls', 'stud', 'studs', 'hoop', 'hoops', 'cuff', 'gemstone', 'gemstones']);
const JEWELLERY_ALL = new RegExp(`${STRONG_JEWELLERY.source}|${WEAK_JEWELLERY.source}`, 'gi');
// Jewellery names that hold a garment word ("Ear Jacket", "Dress Studs"): not clothing.
const JEWELLERY_PHRASES = new RegExp(words(['ear jacket', 'ear jackets', 'ear cuff', 'ear cuffs', 'dress studs', 'shirt studs', 'tie clip', 'tie clips', 'tie bar', 'tie bars',
  'tie pin', 'tie pins', 'hat pin', 'hat pins', 'scarf ring', 'scarf clip', 'collar tips', 'collar bar', 'body chain', 'sweater chain', 'cardigan clip', 'shoe clips']).source, 'gi');
const GARMENT = words(['t-shirt', 't-shirts', 't shirt', 'tee', 'tees', 'shirt', 'shirts', 'top', 'tops', 'hoodie', 'hoodies', 'hoody', 'sweatshirt', 'sweatshirts', 'sweater',
  'jumper', 'jumpers', 'cardigan', 'cardigans', 'dress', 'dresses', 'skirt', 'skirts', 'blouse', 'blouses', 'trousers', 'pants', 'jeans', 'leggings', 'shorts', 'jacket',
  'jackets', 'coat', 'coats', 'blazer', 'blazers', 'kimono', 'kimonos', 'kaftan', 'tunic', 'gilet', 'vest', 'cami', 'camisole', 'corset', 'corsets', 'bodysuit', 'jumpsuit',
  'playsuit', 'romper', 'bikini', 'swimsuit', 'swimwear', 'bra', 'bralette', 'knickers', 'briefs', 'thong', 'lingerie', 'stockings', 'tights', 'socks', 'garter', 'garters',
  'harness', 'robe', 'gown', 'pyjamas', 'nightdress', 'cape', 'capelet', 'shawl', 'poncho', 'bag', 'bags', 'handbag', 'backpack', 'rucksack', 'tote', 'purse', 'wallet',
  'clutch', 'satchel', 'pouch', 'scarf', 'scarves', 'beanie', 'hat', 'hats', 'cap', 'caps', 'beret', 'gloves', 'mittens', 'belt', 'belts', 'shoes', 'boots', 'trainers',
  'sneakers', 'sandals', 'heels', 'slippers', 'sunglasses', 'umbrella', 'polo', 'fleece', 'parka', 'bomber']);
const HAIR = words(['hair clip', 'hair clips', 'claw clip', 'claw clips', 'hair slide', 'hair slides', 'hair pin', 'hair pins', 'hairpin', 'hairpins', 'bobby pin', 'bobby pins',
  'hair comb', 'scrunchie', 'scrunchies', 'headband', 'headbands', 'hair bow', 'hair bows', 'hair accessory', 'hair accessories', 'barrette', 'barrettes']);
const SMALL_ACCESSORY = words(['keyring', 'key ring', 'keyrings', 'key chain', 'keychain', 'bag charm', 'phone charm', 'lanyard', 'pin badge', 'enamel pin']);
const WATCH = words(['watch', 'watches', 'wristwatch', 'chronograph']);
const NOT_A_WATCH = words(['watch strap', 'watch straps', 'watch box', 'watch winder', 'watch cap', 'watch roll']);
// Words that make a name clearly fashion: then home words in it are a print or a shape ("Candle Skull T-Shirt").
const FASHION = new RegExp(`${GARMENT.source}|${STRONG_JEWELLERY.source}|${WATCH.source}`, 'i');
const WOMEN_CATEGORY = /^(Women's (Jewellery|Tops|Outerwear|Swimwear|Accessories)|Maternity|Bodies|Haircare Appliances|Cosmetics)$/i;
const MEN_CATEGORY = /^Men's (Jewellery|Watches|Outerwear)$/i;
const BEAUTY_CATEGORY = /^(Cosmetics|Haircare Products|Bodycare Appliances)$/i;
// Brands that sell only for women (their jewellery and clothing go to Women's Gear World).
const WOMEN_BRAND = /^(má \+ lin.*|ma \+ lin.*|macke swimwear|alice acreman silks|made here with love|gecko jewellery retail|scarlett jewellery|vianne jewellery|hugs & co\.?|we are lunarium|savaé design|savae design|serene jewellery|vurchoo ethical jewellery|luxe tones)$/i;

function menJewellerySub(n) {
  if (words(['cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins', 'dress studs', 'shirt studs']).test(n)) return 'Cufflinks';
  if (words(['bracelet', 'bracelets', 'bangle', 'bangles', 'cuff']).test(n)) return 'Bracelets';
  if (words(['necklace', 'necklaces', 'pendant', 'pendants', 'chain', 'chains', 'dog tag']).test(n)) return 'Necklaces';
  return 'Jewellery';
}

export function genderHint(n, url, feedCategory, brand) {
  const handle = String(url || '').replace(/^https?:\/\/[^/]+\/products\//i, '').replace(/[?#].*$/, '').replace(/[-_]+/g, ' ');
  const w = WOMEN.test(n) || WOMEN.test(handle), m = MEN.test(n) || MEN.test(handle);
  if (m && !w) return 'M';
  if (w && !m) return 'W';
  if (MEN_CATEGORY.test(feedCategory)) return 'M';
  if (WOMEN_CATEGORY.test(feedCategory) || WOMEN_BRAND.test(brand)) return 'W';
  return '';
}

function fashion({ n, url, feedCategory, brand, b }) {
  const g = genderHint(n, url, feedCategory, brand);
  if (HAIR.test(n) || SMALL_ACCESSORY.test(n)) {
    return { site: g === 'M' ? 'mgw' : 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' };
  }
  const garment = GARMENT.test(n.replace(JEWELLERY_PHRASES, ' '));
  const jewelleryWord = STRONG_JEWELLERY.test(n) || WEAK_JEWELLERY.test(n);
  if (!garment && WATCH.test(n) && !NOT_A_WATCH.test(n) && !STRONG_JEWELLERY.test(n)) {
    return g === 'W' ? { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' } : { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" };
  }
  if (!garment && (jewelleryWord || /^(Women's|Men's) Jewellery$/i.test(feedCategory))) {
    // Placed only because of the feed category (no jewellery word in the name): listed in the report for checking.
    const doubt = !jewelleryWord;
    if (g === 'M' || words(['cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins']).test(n)) {
      return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: menJewellerySub(n), doubt };
    }
    return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: jewellerySub(n), doubt };
  }
  if (FRAGRANCE_NAME.test(n)) {
    return g === 'M' ? { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Fragrance' } : { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' };
  }
  if (BEAUTY_CATEGORY.test(feedCategory) && BEAUTY_WORDS.test(n) && g !== 'M') {
    const hit = NAME_SUBS.find(([re]) => re.test(n));
    if (hit) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: hit[1] };
  }
  // Clothing, shoes, bags and accessories: the tested Coes rules, with WGW's and MGW's own subcategory names (L56).
  // A garment's jewellery words are a print or a detail ("Ring Spun Cotton Tee", "Charm Print Dress").
  const hint = g === 'M' ? 'Menswear' : (g === 'W' ? 'Womenswear' : '');
  const clothName = garment ? n.replace(JEWELLERY_ALL, ' ').replace(/\s+/g, ' ').trim() : n;
  const c = fashionPlace({ name: clothName, feedCategory: hint, url, brand: '' });
  if (c.reject && /no men\/women/.test(c.reject)) return { reject: `no men/women in the name (${b})` };
  if (c.reject && /not sure/.test(c.reject)) return { reject: `not sure what it is (${b})` };
  return c;
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '', url = '', brand = '' }) {
  // "Dog Tooth" and "Hound's Tooth" are cloth patterns, not pets.
  const n = String(name || '').replace(/\bdog[\s-]?tooth\b/gi, 'dogtooth').replace(/\bhound'?s[\s-]?tooth\b/gi, 'houndstooth').replace(/\s+/g, ' ').trim();
  const cat = String(feedCategory || '').trim();
  const bn = norm(brand);
  const b = String(brand || '').trim() || 'no brand';
  for (const [re, why] of BRAND_OUT) if (re.test(bn)) return { reject: why };
  if (ARMY_NAME.test(n)) return { reject: BRAND_OUT[0][1] };
  if (SPORTS_CATEGORY.test(cat) || SPORTS_NAME.test(n)) return { reject: BRAND_OUT[2][1] };
  if (MOTOR_CATEGORY.test(cat) || MOTOR_NAME.test(n)) return { reject: BRAND_OUT[3][1] };
  if (PRE_ORDER.test(n)) return { reject: 'pre-order: not in stock yet' };
  if (SPARE.test(n) || /^Appliance Spares$/i.test(cat)) return { reject: 'spare part' };
  if (NOT_SITES_CATEGORY.test(cat) || NOT_PRODUCT.test(n)) return { reject: 'not for these sites (office, phone cases, pets, toys, cards, gift boxes)' };
  if (KIDS_CATEGORY.test(cat) || KIDS.test(n)) return { reject: "children's item (for Kids' Gear World later)" };
  // Garden: bonsai trees, their pots, soil, tools and wire.
  if (/^yorkshire bonsai$/.test(bn) || (/\bbonsai\b/i.test(n) && !FASHION.test(n))) return bonsaiPlace(n);
  // Home phrases that hold a fashion word ("Pendant Light", "Ring Dish") are home, unless the rest is fashion.
  if (HOME_STRONG.test(n) && !FASHION.test(n.replace(HOME_STRONG_ALL, ' '))) {
    const h = homePlace(n);
    if (h) return h;
  }
  const homeContext = HOME_CATEGORY.test(cat) || ART_BRAND.test(bn);
  if (!FASHION.test(n) || homeContext) {
    const h = homePlace(n);
    if (h) return h;
    const garden = gardenPlace(n, '');
    if (garden) return { site: 'ggw', ...garden };
    if (homeContext && !FASHION.test(n)) return { reject: `not sure what it is (${b})` };
  }
  return fashion({ n, url, feedCategory: cat, brand: bn, b });
}

// The brand as the site shows it ("Má + Lin_online" -> "Má + Lin").
export function displayBrand(brand) {
  return String(brand || '').replace(/_online$/i, '').replace(/\s+/g, ' ').trim();
}

// The card name: one space between words, no " | " shop prefix ("Rad Spa | Room & Pillow Spray" -> "Rad Spa Room & Pillow Spray").
export function displayName(name) {
  return String(name || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
