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
//   - resold trainers (Air Jordan) from www.remixd.store and "My Store": cannot check they are genuine;
//   - sports products (padel, kayaks, surf, gym flooring, judo mats, tents): they belong on Sporty Gear World, whose
//     own import tool loads them; motorcycle helmets and parts (Daytona): Car Gear World, its own tool;
//   - spare parts, office supplies, phone cases, pets, toys, cards, pre-orders, children's items.
// First dry run (29 Oct 2026, 35,848 GBP rows -> 8,083 products -> 4,658): fixes below are marked "dry run 29 Oct 2026".
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
  [/^(aixo|circle one surf|central sports uk|sprung gym flooring|fatyak kayaks)$/, 'sports product: for Sporty Gear World (its own import tool)'],
  [/^daytona helmets( uk)?$/, 'motorcycle and car products (helmets, visors, car scents): for Car Gear World (its own import tool)']
];
const ARMY_REASON = BRAND_OUT[0][1], SPORTS_REASON = BRAND_OUT[1][1], MOTOR_REASON = BRAND_OUT[2][1];
// The same merch with another brand name: "ENGLAND - Unisex Hoodie", "Christian Nation - Tough Case".
const ARMY_NAME = /^(irish army|english army|england|ireland|northern ireland|christian nation)\s+-\s/i;
// Resold trainers (www.remixd.store and "My Store" sell Air Jordans): cannot check they are genuine. Their other
// products (Vissla, Amuse Society, Sisstrevolution ...) go through the rules like any other (dry run 29 Oct 2026).
const RESOLD_SELLER = /^(www\.remixd\.store|my store)$/;
const RESOLD_TRAINERS = words(['jordan', 'air jordan', 'nike', 'yeezy', 'dunk', 'dunks', 'air force', 'air max', 'new balance', 'travis scott', 'off-white', 'trainer', 'trainers',
  'sneaker', 'sneakers', 'retro']);
const SPORTS_CATEGORY = /^(Badminton|Outdoor Adventure|Cycling|Winter Sports|Extreme Sports|Leash|Leine|Laisse|Correa|Yoga ?Mat|Yogamatte|Women's Sportswear)$/i;
const SPORTS_NAME = words(['padel', 'pickleball', 'racket', 'racquet', 'kayak', 'kayaks', 'paddle', 'paddles', 'surfboard', 'surfboards', 'skimboard', 'skimboards', 'bodyboard',
  'bodyboards', 'wetsuit', 'wetsuits', 'changing robe', 'changing poncho', 'surf poncho', 'gym flooring', 'judo', 'tatami', 'yoga mat', 'exercise mat', 'gym mat',
  'tent', 'tents', 'sleeping bag', 'sleeping pad', 'air bed', 'snow pants', 'ski', 'skis', 'snowboard', 'dumbbell', 'dumbbells', 'kettlebell', 'kettlebells', 'barbell',
  'weight plate', 'weight plates', 'resistance band', 'resistance bands', 'boxing gloves', 'surf wax', 'swim fins', 'leash', 'gym', 'workout', 'kelty', 'sierra designs',
  'court system', 'overgrip', 'skates', 'deflow', 'c-skins', 'shorty', 'fins', 'fin bolt', 'longboard fin', 'surf wax', 'traction pad']);
// Rad Wax makes surf wax ("Cool Wax", "Base Coat") and, as Rad Spa, soaps and room sprays.
const SURF_WAX = /^(cool|cold|warm|tropical|base coat)\b|\bwax comb\b|^rad wax\b/i;
const MOTOR_CATEGORY = /^(Vehicle Security|Auto Care|Contact Lenses|Bluetooth Adapters|Visor|Visier|Visière|Visera|Car Parts)$/i;
const MOTOR_NAME = words(['helmet', 'helmets', 'visor', 'visors', 'pinlock', 'motorcycle', 'motorbike', 'car diffuser', 'car air freshener', 'car freshener', 'mx goggle']);
const NOT_SITES_CATEGORY = /^(Appliance Spares|Office Supplies|Mobile Phone Accessories|Headsets|Pets|Juicers|Games, Puzzles & Learning|Greeting Card|Grußkarte|Carte de vœux|Tarjeta de felicitación|Action Figures|Sports Memorabilia|Adult Gifts)$/i;
// Children's items by NAME only: the feed's "Children's Footwear" and "Baby Clothes" also hold women's loafers and
// silk pyjamas (dry run 29 Oct 2026).
const KIDS = words(['baby', 'babies', 'infant', 'infants', 'toddler', 'toddlers', 'kids', 'kid', "kid's", 'children', "children's", 'childrens', 'child', 'junior',
  'newborn', 'boys', "boy's", 'girls', "girl's", 'youth', 'nursery']);
const PRE_ORDER = words(['pre-sell', 'pre sell', 'presell', 'pre-order', 'pre order', 'preorder']);
const NOT_PRODUCT = words(['gift card', 'gift voucher', 'e-gift card', 'voucher', 'gift box', 'gift boxes', 'gift bag', 'gift pouch', 'gift wrap', 'gift wrapping',
  'shipping protection', 'insurance', 'phone case', 'iphone', 'airpods', 'samsung', 'yard sign', 'greeting card', 'sticker', 'stickers', 'pet', 'pets', 'dog collar',
  'dog lead', 'dog bowl', 'dog bed', 'pet bowl', 'pet bed', 'cat collar', 'bandana collar', 'polishing cloth', 'jewellery cleaner', 'jewelry cleaner', 'tissue box',
  'tissue boxes', 'eco box', 'fridge magnet', 'fridge magnets', 'dice', 'paint', 'pen', 'pens', 'sponge stamp', 'kennel']);
// "Bride To Be Box", "Will you be my Maid of Honor box": a gift box, not a piece of jewellery.
const ENDS_IN_BOX = /\bbox(es)?\s*$/i;
const SPARE = /^spare\b|\bspare parts?\b|\breplacement (parts?|shield|lens|visor|pads?)\b/i;

// ---------- Home (HGW) ----------
// Home phrases that hold a jewellery or clothing word ("pendant light", "ring dish"): checked before fashion.
const HOME_STRONG = words(['pendant light', 'pendant lights', 'pendant lamp', 'pendant lamps', 'ceiling pendant', 'ring dish', 'trinket dish', 'trinket tray', 'jewellery dish',
  'jewelry dish', 'jewellery box', 'jewelry box', 'jewellery stand', 'trinket box', 'candle holder', 'candle holders', 'tealight holder', 'tea light holder', 'duvet cover',
  'pillow case', 'pillowcase', 'pillowcases', 'wax melt', 'wax melts', 'reed diffuser', 'room spray', 'pillow spray', 'art print', 'art prints', 'wall art', 'ceiling light',
  'table lamp', 'floor lamp', 'wall light', 'wall lamp', 'bath mat', 'scented candle', 'soy candle', 'soy wax candle', 'candle', 'candles', 'suncatcher', 'suncatchers',
  'sun catcher', 'sun catchers', 'napkin ring', 'napkin rings', 'jewelry stand', 'jewellery holder', 'jewelry holder', 'earring holder', 'ring holder', 'necklace holder',
  'jewellery tree', 'jewellery organiser', 'jewelry organizer', 'mug tree', 'tapestry', 'tapestries', 'fleece blanket', 'shirt art', 'shirt history', 'shirts art',
  'football shirt art', 'limited edition print', 'limited edition prints', 'giclee', 'giclée', 'screen print']);
const HOME_STRONG_ALL = new RegExp(HOME_STRONG.source, 'gi');
const WALL_ART = words(['art print', 'art prints', 'print', 'prints', 'giclee', 'giclée', 'canvas', 'canvas print', 'framed', 'poster', 'posters', 'painting', 'paintings',
  'original artwork', 'artwork', 'linocut', 'lino print', 'etching', 'screen print', 'screenprint', 'wall art', 'watercolour', 'watercolor', 'lithograph', 'drawing',
  'drawings', 'sketch', 'portrait', 'illustration', 'original', 'tapestry', 'tapestries', 'wall hanging', 'wall sculpture', 'metal sign', 'wall sign', 'sign', 'shirt art']);
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
  [words(['table lamp', 'table lamps', 'desk lamp', 'bedside lamp', 'lamp', 'lamps', 'led light', 'globe light', 'night light', 'mood light']), 'Lighting', 'Table Lamp'],
  [words(['duvet cover', 'duvet covers', 'duvet set', 'duvet', 'quilt cover', 'bedding set', 'bedding', 'comforter']), 'Bedding & Bath', 'Duvet'],
  [words(['pillow case', 'pillowcase', 'pillowcases', 'pillow', 'pillows']), 'Bedding & Bath', 'Pillow'],
  [words(['fitted sheet', 'flat sheet', 'bed sheet', 'bed sheets']), 'Bedding & Bath', 'Bed Sheet'],
  // A throw or fleece blanket: HGW's own "Bed Linen" (2 products there on 29 Oct 2026; lessons L56).
  [words(['blanket', 'blankets', 'fleece blanket', 'throw', 'throws', 'sherpa blanket']), 'Bedding & Bath', 'Bed Linen'],
  [/(?<![a-z0-9])(?<!tea )(towel|towels|bath sheet|bath sheets)(?![a-z0-9])/i, 'Bedding & Bath', 'Towel'],
  [words(['bath mat', 'bath mats']), 'Bedding & Bath', 'Bath Mat'],
  [words(['cushion', 'cushions', 'cushion cover', 'cushion covers']), 'Home Decor', 'Cushion'],
  [words(['rug', 'rugs']), 'Home Decor', 'Rug'],
  [words(['curtain', 'curtains']), 'Home Decor', 'Curtain'],
  [words(['clock', 'clocks']), 'Home Decor', 'Clock'],
  [words(['vase', 'vases']), 'Home Decor', 'Vase'],
  [words(['jewellery box', 'jewelry box', 'trinket box', 'keepsake box', 'storage box', 'storage boxes']), 'Storage & Organisation', 'Storage Box'],
  [words(['jewellery stand', 'jewelry stand', 'jewellery holder', 'jewelry holder', 'earring holder', 'ring holder', 'necklace holder', 'jewellery tree', 'jewellery organiser',
    'jewelry organizer', 'wall hook', 'wall hooks', 'spice rack']), 'Storage & Organisation', 'Storage Rack'],
  [words(['shelving', 'shelving display', 'display shelf', 'wall shelf', 'shelf', 'shelves']), 'Storage & Organisation', 'Shelving Unit'],
  [words(['napkin ring', 'napkin rings']), 'Kitchen & Dining', 'Tableware'],
  [words(['mirror', 'mirrors']), 'Home Decor', 'Mirror'],
  // "Bauhaus Wall Art - Geometric Wall Sculpture", "Countryside Tapestry", "Garage Rules Metal Sign": pictures for a wall.
  [words(['wall art', 'wall sculpture', 'wall hanging', 'tapestry', 'tapestries', 'metal sign', 'wall sign', 'shirt art', 'shirt history', 'limited edition print',
    'limited edition prints']), 'Home Decor', 'Wall Art'],
  [words(['ornament', 'ornaments', 'figurine', 'figurines', 'sculpture', 'sculptures', 'statue', 'statues', 'suncatcher', 'suncatchers', 'sun catcher', 'sun catchers',
    'light catcher', 'hanging decoration', 'decoration', 'decorations', 'decorative', 'trinket dish', 'trinket tray', 'ring dish', 'jewellery dish', 'jewelry dish',
    'wind chime', 'wind chimes', 'wind spinner', 'dreamcatcher', 'dream catcher', 'bookend', 'bookends', 'prism', 'crystal ball', 'plaque', 'potion bottle', 'christmas',
    'crystal skull', 'skull']),
    'Home Decor', 'Ornament'],
  [words(['shot glass', 'shot glasses', 'wine glass', 'wine glasses', 'glasses', 'stemless glass', 'drinking glass', 'gin glass', 'whisky glass', 'whiskey glass', 'pint glass',
    'beer glass', 'cocktail glass', 'martini glass', 'highball', 'highballs', 'champagne flute', 'champagne flutes', 'flutes', 'coupe', 'coupes', 'rocks glass', 'glassware',
    'carafe', 'goblet', 'goblets']), 'Kitchen & Dining', 'Glassware'],
  [words(['hip flask', 'hip flasks', 'cocktail shaker', 'bottle opener', 'ice bucket', 'decanter', 'wine stopper', 'coaster', 'coasters', 'bar set', 'jigger']), 'Kitchen & Dining', 'Bar Accessories'],
  // A mug wins over its spoon ("Mug & Spoon Set"); spoons win over a cup that is only the design ("Tea Spoon Set, Hang-on Cup Design").
  [/(?<![a-z0-9])(mug|mugs|mug\d+|travel mug|tankard|tankards)(?![a-z])/i, 'Kitchen & Dining', 'Drinkware'],
  [words(['spoon', 'spoons', 'teaspoon', 'teaspoons', 'tea spoon', 'tea spoons', 'cutlery', 'fork', 'forks', 'knife', 'knives']), 'Kitchen & Dining', 'Cutlery'],
  [words(['seasoning', 'spice', 'salt and pepper', 'jar', 'jars', 'coffee set', 'egg cup', 'egg cups', 'saucer']), 'Kitchen & Dining', 'Tableware'],
  [words(['cup', 'cups', 'tumbler', 'tumblers', 'water bottle', 'bottle', 'bottles', 'flask', 'flasks', 'teapot', 'tea pot', 'tea set', 'teacup', 'tea cup', 'coffee cup',
    'beaker', 'beakers', 'mug tree']), 'Kitchen & Dining', 'Drinkware'],
  [words(['chopping board', 'cutting board', 'serving board', 'cheese board']), 'Kitchen & Dining', 'Chopping Board'],
  [words(['plate', 'plates', 'bowl', 'bowls', 'dish', 'dishes', 'platter', 'platters', 'cake stand', 'tray', 'trays', 'napkin', 'napkins', 'placemat', 'placemats',
    'table runner', 'butter dish', 'jug', 'jugs', 'egg cup', 'egg cups']), 'Kitchen & Dining', 'Tableware'],
  [words(['coffee table', 'side table']), 'Furniture', 'Coffee Table'],
  [words(['dining table']), 'Furniture', 'Dining Table'],
  [words(['bookcase', 'bookcases', 'bookshelf', 'bookshelves']), 'Furniture', 'Bookcase'],
  [words(['sideboard', 'sideboards']), 'Furniture', 'Sideboard'],
  [words(['armchair', 'armchairs']), 'Furniture', 'Armchair'],
  // Last: "print" is also a pattern ("Floral Print Mug" is a mug).
  [WALL_ART, 'Home Decor', 'Wall Art']
];
const HOME_CATEGORY = /^(Art|Living Room|Beds|Crockery|Drinkware|Glassware|Cookware & Utensils|Kitchen Units|Furniture Accessories|Decorations|Home Textiles|House Accessories|Cakes, Snacks & Sweets|Tables|Bespoke Kitchens|Alcoholic Drinks|Arts & Crafts)$/i;
// Artists and print shops: their products are pictures for a wall ("Eliza with towel - Giclée Screen Print",
// "Lady Wearing Glasses, a portrait", "Embleton Beach 7, Northumberland").
const ART_BRAND = /^(the artist's house gallery|terry kneeshaw art|rhia janta-cooper fine art|resbeam studio|printworks)$/i;
const STRONG_ART = /\b(giclee|giclée|screen ?print|limited edition|art prints?|a[1-5]|portrait|drawing|sketch|painting|canvas|framed|original|tapestry|wall art|illustration|lithograph|etching|linocut)\b/i;
const CANDLE_BRAND = /^(parks candles|interlude candles|the stirling candle company|bro candle)$/i;

export function homePlace(name) {
  const n = String(name || '');
  for (const [re, cat, sub] of HOME_PLACES) if (re.test(n)) return { site: 'hgw', siteCategory: cat, subcategory: sub };
  return null;
}

// ---------- Garden (GGW) ----------
// Yorkshire Bonsai also sells furniture ("Tamarind and Resin Coffee Table"): only bonsai things go to the garden site.
const BONSAI_THING = words(['bonsai', 'tree', 'trees', 'juniper', 'elm', 'maple', 'ficus', 'azalea', 'pine', 'olive', 'cotoneaster', 'pot', 'pots', 'tray', 'trays', 'soil',
  'akadama', 'compost', 'feed', 'fertiliser', 'fertilizer', 'grit', 'kanuma', 'pumice', 'wire', 'wires', 'scissors', 'shears', 'cutter', 'cutters', 'pliers', 'tweezers']);
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
// "RAD-ARONDACK CHAIR", "Adirondack Table": garden furniture.
const ADIRONDACK = /\b(adirondack|arondack)\b/i;

// ---------- Fashion (WGW, MGW) ----------
const MEN = words(['men', "men's", 'mens', 'male', 'for him', 'gents', 'gentleman', "gentleman's", 'his']);
const WOMEN = words(['women', "women's", 'womens', 'ladies', "ladies'", 'lady', 'female', 'for her', 'wmns', 'hers']);
// Jewellery words. Strong ones say jewellery for sure; weak ones ("chain", "charm", "pearl", "hoop") only when nothing
// else in the name is a garment ("Pearl Button Cardigan" is a cardigan, "Ring Spun Cotton Tee" a T-shirt).
const STRONG_JEWELLERY = words(['earring', 'earrings', 'necklace', 'necklaces', 'bracelet', 'bracelets', 'bangle', 'bangles', 'anklet', 'anklets', 'choker', 'chokers',
  'pendant', 'pendants', 'locket', 'lockets', 'brooch', 'brooches', 'cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins',
  'ear cuff', 'ear cuffs', 'ear climber', 'ear climbers', 'ear jacket', 'ear jackets', 'huggie', 'huggies', 'threader', 'threaders', 'body chain', 'nose ring', 'nose stud',
  'septum', 'signet', 'jewellery', 'jewelry', 'ring', 'rings', 'charm bracelet', 'dress studs', 'shirt studs', 'birthstone', 'ankle cuff', 'ankle cuffs', 'wristband',
  'wristbands', 'droppers', 'bead clip', 'hand harness', 'eternity band', 'eternity bands']);
const WEAK_JEWELLERY = words(['chain', 'chains', 'charm', 'charms', 'pearl', 'pearls', 'stud', 'studs', 'hoop', 'hoops', 'cuff', 'cuffs', 'gemstone', 'gemstones', 'band', 'bands',
  'collar', 'pin']);
const JEWELLERY_ALL = new RegExp(`${STRONG_JEWELLERY.source}|${WEAK_JEWELLERY.source}`, 'gi');
// The last part of a name says what it is: "Mortar Board Graduation Cap Personalised Silver Charm" is a charm,
// "Lilac Cape Amethyst Gemstone Bracelet" a bracelet, "... Brooch / Stock Tie Pin" a pin.
const JEWELLERY_END = /(?<![a-z0-9])(charm|charms|pendant|pendants|necklace|necklaces|ring|rings|earring|earrings|bracelet|bracelets|bangle|bangles|brooch|brooches|cufflinks|anklet|anklets|choker|chokers|studs|hoops|band|bands|cuffs|tie pin|pin)\s*$/i;
// Jewellery names that hold a garment word ("Ear Jacket", "Dress Studs"): not clothing.
const JEWELLERY_PHRASES = new RegExp(words(['ear jacket', 'ear jackets', 'ear cuff', 'ear cuffs', 'dress studs', 'shirt studs', 'tie clip', 'tie clips', 'tie bar', 'tie bars',
  'tie pin', 'tie pins', 'hat pin', 'hat pins', 'scarf ring', 'scarf clip', 'collar tips', 'collar bar', 'body chain', 'sweater chain', 'cardigan clip', 'shoe clips',
  'hand harness', 'ankle cuffs', 'ankle cuff']).source, 'gi');
const GARMENT = words(['t-shirt', 't-shirts', 't shirt', 'tee', 'tees', 'shirt', 'shirts', 'top', 'tops', 'hoodie', 'hoodies', 'hoody', 'sweatshirt', 'sweatshirts', 'sweater',
  'jumper', 'jumpers', 'cardigan', 'cardigans', 'dress', 'dresses', 'skirt', 'skirts', 'skort', 'blouse', 'blouses', 'trousers', 'pants', 'jeans', 'leggings', 'shorts', 'jacket',
  'jackets', 'coat', 'coats', 'blazer', 'blazers', 'kimono', 'kimonos', 'kaftan', 'tunic', 'smock', 'gilet', 'vest', 'cami', 'camisole', 'corset', 'corsets', 'bodysuit',
  'jumpsuit', 'playsuit', 'romper', 'bikini', 'swimsuit', 'swimwear', 'swimshorts', 'one piece', 'bra', 'bralette', 'knickers', 'briefs', 'boxer', 'boxers', 'thong',
  'lingerie', 'stockings', 'tights', 'socks', 'garter', 'garters', 'harness', 'robe', 'gown', 'pyjamas', 'pyjama', 'pyjama set', 'lounge wear', 'loungewear',
  'nightwear', 'sleepwear', 'nightdress', 'cape', 'capelet', 'bolero', 'shawl', 'poncho',
  'bag', 'bags', 'handbag', 'backpack', 'rucksack', 'tote', 'purse', 'wallet', 'clutch', 'satchel', 'pouch', 'scarf', 'scarves', 'beanie', 'hat', 'hats', 'cap', 'caps',
  'beret', 'gloves', 'mittens', 'belt', 'belts', 'shoes', 'boots', 'trainers', 'sneakers', 'sandals', 'heels', 'slippers', 'loafers', 'sunglasses', 'umbrella', 'parasol',
  'polo', 'fleece', 'parka', 'bomber', 'worker', 'longsleeve', 'turnup sleeve', 'tuxedo', 'waistcoat', 'sunga', 'swimbrief', 'swim brief', 'shrug', 'overskirt', 'cincher',
  'bloomers', 'cloak', 'flats', 'mary jane', 'espadrilles', 'back pack']);
const HAIR = words(['hair clip', 'hair clips', 'claw clip', 'claw clips', 'hair slide', 'hair slides', 'hair pin', 'hair pins', 'hairpin', 'hairpins', 'bobby pin', 'bobby pins',
  'hair comb', 'scrunchie', 'scrunchies', 'headband', 'headbands', 'hair band', 'hair bands', 'hair bow', 'hair bows', 'hair accessory', 'hair accessories', 'barrette', 'barrettes']);
const SMALL_ACCESSORY = words(['keyring', 'key ring', 'keyrings', 'key chain', 'keychain', 'bag charm', 'phone charm', 'lanyard', 'pin badge', 'enamel pin', 'fan', 'hand fan',
  'lace fan', 'silk fan', 'parasol', 'card holder', 'cardholder', 'arm warmers', 'arm sleeves', 'fishnet sleeves', 'crown', 'tiara']);
// Ties, pocket squares and cravats are for men unless the name says women ("Rust Luxury Silk Pocket Square and tie").
const MEN_ITEM = /\b(neck ?ties?|bow ?ties?|pocket squares?|cravats?)\b|\bties?\s*($|[,'"‘’(&]|and\b|set\b|gift\b|in\b)|\bsilk ties?\b/i;
const WATCH = words(['watch', 'watches', 'wristwatch', 'chronograph']);
const NOT_A_WATCH = words(['watch strap', 'watch straps', 'watch box', 'watch winder', 'watch cap', 'watch roll']);
// Words that make a name clearly fashion: then home words in it are a print or a shape ("Candle Skull T-Shirt").
const FASHION = new RegExp(`${GARMENT.source}|${STRONG_JEWELLERY.source}|${WATCH.source}`, 'i');
const WOMEN_CATEGORY = /^(Women's (Jewellery|Tops|Outerwear|Swimwear|Accessories)|Maternity|Bodies|Haircare Appliances|Cosmetics)$/i;
const MEN_CATEGORY = /^Men's (Jewellery|Watches)$/i;
const BEAUTY_CATEGORY = /^(Cosmetics|Haircare Products|Haircare Appliances|Bodycare Appliances)$/i;
// Brands that sell (almost) only for women or only for men; a "Men's"/"Women's" in the name still wins. The feed's
// "Men's Outerwear" holds Kate's Clothing's women's coats and robes, so it says nothing (dry run 29 Oct 2026).
const WOMEN_BRAND = /^(má \+ lin.*|ma \+ lin.*|macke swimwear|alice acreman silks|made here with love|gecko jewellery retail|scarlett jewellery|vianne jewellery|we are lunarium|savaé design|savae design|serene jewellery|vurchoo ethical jewellery|luxe tones|kate's clothing|no more nobody|8th sin)$/i;
const MEN_BRAND = /^(pamoni|bdxy studios|swole panda)$/i;
const MEN_LINE = /^fred bennett\b/i; // Fred Bennett is a men's jewellery and gifts line (sold by Gecko Jewellery).
// Spiral Direct: a T-shirt, hoody or vest without "Ladies" is its unisex (men's) cut; tops with a women's cut have
// their own names ("Boat Neck Bat Sleeve Top", "Fish Tail Hoody", "Acid Wash Turnup Sleeve").
const SPIRAL_WOMEN_CUT = words(['dress', 'skirt', 'leggings', 'corset', 'tunic', 'smock', 'bat sleeve', 'cap sleeve', 'boat neck', 'boatneck', 'goth sleeve', 'turnup sleeve',
  'top', 'tops', 'ripped hoody', 'large hood', 'fish tail', 'cami', 'bodycon', 'skater', 'maxi', 'crop', 'bikini', 'swimsuit', 'gathered', 'slant', 'racer', 'pyjama set']);
const SPIRAL_MEN_CUT = words(['t-shirt', 'tee', 'hoody', 'hoodie', 'longsleeve', 'long sleeve', 'vest', 'worker', 'joggers', 'shirt', 'sweatshirt', 'jacket', 'shorts', 'cargo']);
// Garments that are for women whatever the shop ("AFENDS Blair Mini Dress", "Sisstrevolution Matira Pant" has none).
const WOMEN_GARMENT = words(['dress', 'dresses', 'skirt', 'skirts', 'skort', 'overskirt', 'blouse', 'bikini', 'swimsuit', 'one piece', 'bra', 'bralette', 'jumpsuit', 'playsuit',
  'corset', 'camisole', 'cami', 'knickers', 'bodysuit', 'bloomers', 'cincher', 'mary jane', 'heels', 'flats', 'maternity']);
// Shop names at the start of the product name (www.remixd.store sells surf brands): Vissla is men's, Amuse Society and
// Sisstrevolution women's.
const NAME_BRAND_MEN = /^vissla\b/i;
const NAME_BRAND_WOMEN = /^(amuse society|sisstrevolution)\b/i;
// Hugs & Co.: shoes without "Women's" are its men's shoes ("Busby Men's Winter Chelsea Boot", "Tyre Sole Driving Loafers").
const SHOE = words(['shoe', 'shoes', 'loafers', 'loafer', 'brogues', 'boots', 'boot', 'sneakers', 'slippers', 'espadrilles', 'sandals', 'trainers']);
const BEAUTY_BRAND_NAME = /^(rad spa|radioactive unicorn|manic panic|amplified manic panic)\b|\|\s*manic panic$/i;

function menJewellerySub(n) {
  if (words(['brooch', 'brooches']).test(n)) return 'Jewellery';
  if (words(['cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins', 'dress studs', 'shirt studs']).test(n)) return 'Cufflinks';
  if (words(['bracelet', 'bracelets', 'bangle', 'bangles', 'cuff', 'wristband', 'wristbands']).test(n)) return 'Bracelets';
  if (words(['necklace', 'necklaces', 'pendant', 'pendants', 'chain', 'chains', 'dog tag']).test(n)) return 'Necklaces';
  return 'Jewellery';
}

// WGW subcategory of a piece of women's jewellery (the Angel Barocco words, plus bands, ankle cuffs and droppers).
function womenJewellerySub(n) {
  if (words(['ankle cuff', 'ankle cuffs', 'wristband', 'wristbands']).test(n)) return 'Bracelets';
  if (words(['droppers', 'dropper']).test(n)) return 'Earrings';
  const sub = jewellerySub(n);
  if (sub === 'Jewellery' && words(['band', 'bands', 'eternity band', 'signet']).test(n)) return 'Rings';
  return sub;
}

export function genderHint(n, url, feedCategory, brand) {
  const handle = String(url || '').replace(/^https?:\/\/[^/]+\/products\//i, '').replace(/[?#].*$/, '').replace(/[-_]+/g, ' ');
  const w = WOMEN.test(n) || WOMEN.test(handle), m = MEN.test(n) || MEN.test(handle);
  if (m && !w) return 'M';
  if (w && !m) return 'W';
  if (MEN_LINE.test(n) || MEN_BRAND.test(brand) || NAME_BRAND_MEN.test(n)) return 'M';
  if (WOMEN_BRAND.test(brand) || NAME_BRAND_WOMEN.test(n)) return 'W';
  if (/^hugs & co\.?$/i.test(brand)) return SHOE.test(n) ? 'M' : 'W';
  if (/^spiral direct$/i.test(brand)) {
    // Spiral names are "DESIGN - Garment Colour": the design ("TOP DOG") says nothing about the cut.
    const parts = segments(n);
    const garmentText = parts.length > 1 ? parts.slice(1).join(' ') : n;
    if (SPIRAL_WOMEN_CUT.test(garmentText)) return 'W';
    if (SPIRAL_MEN_CUT.test(garmentText)) return 'M';
    return 'W';
  }
  if (WOMEN_GARMENT.test(n)) return 'W';
  if (MEN_CATEGORY.test(feedCategory)) return 'M';
  if (WOMEN_CATEGORY.test(feedCategory)) return 'W';
  return '';
}

// The parts of a name, without "with ..."/"in ..." add-ons: "Peridot Halo Stud Earrings with Jackets in 18k Gold".
const segments = n => String(n || '').replace(/\([^)]*\)/g, ' ').split(/\s[-–|/]\s|\s\/|\/\s/).map(s => s.replace(/\s(with|in)\s.*$/i, '').trim()).filter(Boolean);

function fashion({ n, url, feedCategory, brand, b }) {
  let g = genderHint(n, url, feedCategory, brand);
  if (MEN_ITEM.test(n) && !WOMEN.test(n)) g = 'M';
  const parts = segments(n);
  const last = parts.length ? parts[parts.length - 1] : n;
  const garment = parts.some(s => GARMENT.test(s.replace(JEWELLERY_PHRASES, ' ')));
  const jewelleryWord = STRONG_JEWELLERY.test(n) || WEAK_JEWELLERY.test(n);
  const jewelleryEnd = JEWELLERY_END.test(last) && !/\b(hair|hat|safety|clothes|bobby|head|rubber|elastic|watch|key|napkin)\s+(pin|band|bands|ring)\s*$/i.test(last);
  if (!jewelleryEnd && !(STRONG_JEWELLERY.test(n) && !HAIR.test(n)) && (HAIR.test(n) || SMALL_ACCESSORY.test(n))) {
    return { site: g === 'M' ? 'mgw' : 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' };
  }
  if (!garment && WATCH.test(n) && !NOT_A_WATCH.test(n) && !STRONG_JEWELLERY.test(n)) {
    return g === 'W' ? { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' } : { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" };
  }
  if (jewelleryEnd || (!garment && (jewelleryWord || /^(Women's|Men's) Jewellery$/i.test(feedCategory)))) {
    if (ENDS_IN_BOX.test(n)) return { reject: 'not for these sites (office, phone cases, pets, toys, cards, gift boxes)' };
    // Placed only because of the feed category (no jewellery word in the name): listed in the report for checking.
    const doubt = !jewelleryWord;
    if (g === 'M' || words(['cufflink', 'cufflinks', 'tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins']).test(n)) {
      return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: menJewellerySub(n), doubt };
    }
    return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: womenJewellerySub(n), doubt };
  }
  if (FRAGRANCE_NAME.test(n)) {
    return g === 'M' ? { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Fragrance' } : { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' };
  }
  // Beauty: hair dye, lipstick, nail polish, soaps (Manic Panic, Radioactive Unicorn, Rad Spa).
  if (!garment && g !== 'M' && (BEAUTY_CATEGORY.test(feedCategory) || BEAUTY_BRAND_NAME.test(n))) {
    const hit = NAME_SUBS.find(([re]) => re.test(n));
    if (hit) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: hit[1] };
    if (BEAUTY_BRAND_NAME.test(n) || BEAUTY_WORDS.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Beauty & Fragrances' };
  }
  // Clothing, shoes, bags and accessories: the tested Coes rules, with WGW's and MGW's own subcategory names (L56).
  // Only the parts of the name that say the garment go to them: "TOP DOG - T-Shirt Black" is a T-shirt, not a dog;
  // "Freya Linen Cropped Blouse - Chocolate" a blouse, not chocolate. A garment's jewellery words are a print or a
  // detail ("Ring Spun Cotton Tee"). Words the Coes lists do not know get a known word next to them.
  const hint = g === 'M' ? 'Menswear' : (g === 'W' ? 'Womenswear' : '');
  const garmentParts = parts.filter(s => GARMENT.test(s));
  // The last part that names a garment: "TOP DOG - T-Shirt Black" -> "T-Shirt Black" (the first part is the design).
  let clothName = garmentParts.length ? garmentParts[garmentParts.length - 1] : n;
  // "Shawl Collar Tuxedo" is a tuxedo, "jump suit" a jumpsuit (database check after the import, 29 Oct 2026).
  clothName = clothName.replace(/\bshawl (collar|lapels?)\b/gi, '$1').replace(/\bjump ?suit\b/gi, 'jumpsuit');
  if (garment) clothName = clothName.replace(JEWELLERY_ALL, ' ');
  clothName = clothName.replace(/\bworker\b/gi, 'worker vest').replace(/\bbolero\b/gi, 'bolero jacket').replace(/\btuxedo\b(?!\s+(blazer|jacket))/gi, 'tuxedo suit')
    .replace(/\bturnup sleeve\b/gi, 'turnup sleeve top').replace(/\bskort\b/gi, 'skort skirt').replace(/\bcapelet\b|\bcape\b/gi, 'cape jacket')
    .replace(/\bone[\s-]piece\b/gi, 'swimsuit').replace(/\bloafers\b/gi, 'loafers shoes').replace(/\bv[\s-]?neck\b(?=.*\b(top|tee|t-shirt|dress)\b)/gi, ' ')
    .replace(/\bboot[\s-]?cut\b/gi, 'bootcut').replace(/\b(garter|handkerchief)\b(?=.*\b(shorts|skirt|dress|top|hem)\b)/gi, ' ')
    .replace(/\b(sunga|swim ?brief)\b/gi, 'swimwear').replace(/\bshrug\b/gi, 'shrug cardigan').replace(/\boverskirt\b/gi, 'overskirt skirt')
    .replace(/\bcincher\b/gi, 'cincher corset').replace(/\bbloomers\b/gi, 'bloomers knickers').replace(/\bcloak\b/gi, 'cloak coat')
    .replace(/\b(mary jane|flats|heels)\b/gi, '$1 shoes').replace(/\bback pack\b/gi, 'backpack').replace(/\s+/g, ' ').trim();
  // Words the Coes "not clothing" list knows are only a print or a name on a garment ("Marble Ball Print Shirt",
  // "Spicy Sports Spray Jacket", "TOP DOG - T-Shirt").
  if (garment) clothName = clothName.replace(/\b(ball|balls|game|dog|chocolate|pen|spray|tape|grips?|stick|book|cleaning|polish|protector)\b/gi, ' ').replace(/\s+/g, ' ').trim();
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
  if (ARMY_NAME.test(n)) return { reject: ARMY_REASON };
  if (RESOLD_SELLER.test(bn) && (RESOLD_TRAINERS.test(n) || /^Children's Footwear$/i.test(cat))) {
    return { reject: 'resold trainers (www.remixd.store, My Store): cannot check they are genuine' };
  }
  // The feed's sports categories also hold jewellery ("Beginnings Trace Chain Necklace" under "Cycling", dry run 29 Oct 2026).
  if ((SPORTS_CATEGORY.test(cat) && !STRONG_JEWELLERY.test(n)) || SPORTS_NAME.test(n) || (/^rad wax$/.test(bn) && SURF_WAX.test(n))) return { reject: SPORTS_REASON };
  if (MOTOR_CATEGORY.test(cat) || MOTOR_NAME.test(n)) return { reject: MOTOR_REASON };
  if (PRE_ORDER.test(n)) return { reject: 'pre-order: not in stock yet' };
  if (SPARE.test(n) || /^Appliance Spares$/i.test(cat)) return { reject: 'spare part' };
  if (NOT_SITES_CATEGORY.test(cat) || NOT_PRODUCT.test(n)) return { reject: 'not for these sites (office, phone cases, pets, toys, cards, gift boxes)' };
  if (KIDS.test(n)) return { reject: "children's item (for Kids' Gear World later)" };
  // Garden: bonsai trees, their pots, soil, tools and wire; Adirondack garden chairs and tables.
  if ((/^yorkshire bonsai$/.test(bn) && BONSAI_THING.test(n)) || (/\bbonsai\b/i.test(n) && !FASHION.test(n))) return bonsaiPlace(n);
  if (ADIRONDACK.test(n) && /\b(chair|chairs|table|tables)\b/i.test(n)) {
    return { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: /\btables?\b/i.test(n) ? 'Tables' : 'Chairs & benches' };
  }
  const artBrand = ART_BRAND.test(bn);
  // Artists: everything is a picture for the wall ("Embleton Beach 7, Northumberland"), unless it is clearly something
  // else (a mug, a cushion, a lamp) and not a picture of it ("Eliza with towel - Giclée Screen Print").
  if (artBrand && (!FASHION.test(n.replace(HOME_STRONG_ALL, ' ')) || /\b(a[1-5]|print|prints|art|framed|canvas|drawing|painting|original|portrait)\b/i.test(n))) {
    const h = homePlace(n);
    if (h && !STRONG_ART.test(n)) return h;
    return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Wall Art' };
  }
  // Home phrases that hold a fashion word ("Pendant Light", "Ring Dish") are home, unless the rest is fashion.
  if (HOME_STRONG.test(n) && !FASHION.test(n.replace(HOME_STRONG_ALL, ' '))) {
    const h = homePlace(n);
    if (h) return h;
  }
  // Beauty brands ("Radioactive Unicorn Pumpkin Spice Liquid Eye Shadow") and small accessories ("silk folding hand fan
  // with ... painted artwork") are fashion even with a home word in the name.
  if (BEAUTY_BRAND_NAME.test(n) || ((SMALL_ACCESSORY.test(n) || HAIR.test(n)) && !STRONG_JEWELLERY.test(n) && !/\b(ceiling|desk|electric|pedestal) fans?\b/i.test(n))) {
    return fashion({ n, url, feedCategory: cat, brand: bn, b });
  }
  const homeContext = HOME_CATEGORY.test(cat);
  if (!FASHION.test(n) || homeContext) {
    const h = homePlace(n);
    if (h) return h;
    if (CANDLE_BRAND.test(bn)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Home Fragrance' };
    // "Dark in Love Belladonna Embroidered Folding Parasol" is a fashion parasol, not a garden one.
    const garden = SMALL_ACCESSORY.test(n) ? null : gardenPlace(n, '');
    if (garden) {
      const pot = /\b(pots?|planters?)\b/i.test(n) && garden.subcategory === 'Plants';
      return { site: 'ggw', ...garden, subcategory: pot ? 'Growing' : garden.subcategory };
    }
    if (homeContext && !FASHION.test(n) && !WEAK_JEWELLERY.test(n) && !BEAUTY_BRAND_NAME.test(n) && !SMALL_ACCESSORY.test(n)) return { reject: `not sure what it is (${b})` };
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
