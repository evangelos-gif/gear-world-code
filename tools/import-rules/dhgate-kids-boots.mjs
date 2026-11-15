// Import rules for DHgate (CJ Affiliate advertiser 3992613, dhgate.com) on Kids' Gear World: ONLY children's snow and
// winter boots and wellies, from the CJ keyword search "kids-winter-boots" (tools/cj-feed-download.ps1 -Search, lessons
// L161), into Shoes > Winter Boots (the subcategory of Coes' winter boots, 14 Nov 2026).
// Manager, 15 Nov 2026: kids' winter boots for UK visitors are the first priority (the UK view had 17); DHgate only with
// UK delivery, no famous brand names (a marketplace: such names there are copies), and a real pound price.
// DHgate has 6 million products in CJ, mostly in dollars; the search file holds only products priced in pounds.
import { join } from 'node:path';

export const SEARCH_FILE = 'CJ_3992613_kids-winter-boots.csv.gz';

export const RULES = {
  key: 'dhgate-kids-boots',
  network: 'cj',
  advertiserId: 3992613,
  retailer: 'DHgate',
  currency: 'GBP',
  shop: /^https?:\/\/(www\.|m\.|uk\.)?dhgate\.com\/product\//i,
  sites: ['kgw'],
  // A pair of children's boots: under £5 is a sample or a doll's shoe, over £120 is not a child's boot from a marketplace.
  maxPrice: 120,
  minPrice: 5,
  // The same boot from several sellers under one name: only the cheapest card (L161).
  sameNameCheapest: true
};

// Only the search file, never a whole DHgate catalogue.
export function feedFiles(archive) { return [join(archive, SEARCH_FILE)]; }

// One card per DHgate item: the number at the end of its page (".../kids-snow-boots-winter/402230757.html").
export function productKey(get) {
  const m = /\/(\d{6,12})\.html(?:[?#]|$)/i.exec(String(get('merchant_deep_link') || ''));
  return m ? `dhgate-${m[1]}` : '';
}

// DHgate's pictures come as http://www.dhresource.com/... (fourth look, 15 Nov 2026: 16,780 of 19,264 left out as "no
// image"); the same address works over https (checked: 200, image/jpeg), and the sites show only https pictures.
export function field(c, column) {
  const v = column(c);
  if (/image/.test(c)) return String(v || '').replace(/^http:\/\/((?:[a-z0-9-]+\.)*dhresource\.com\/)/i, 'https://$1');
  return v;
}

// Where the product is sold and sent (columns of the search file).
export function rowInfo(get) {
  return { target: String(get('target_country') || '').toUpperCase(), areas: String(get('serviceable_areas') || '').toUpperCase(),
    shipsFrom: String(get('ships_from') || '').toUpperCase(), age: String(get('age_group') || '').toLowerCase() };
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
export const KIDS = W(['kids?', "kid's", 'boys?', "boy's", "boys'", 'girls?', "girl's", "girls'", 'child', 'children', "children's", 'childrens',
  'toddlers?', 'infants?', 'baby', 'babies', 'juniors?', 'youth', 'little kids?', 'big kids?']);
export const BOOTS = W(['boots?', 'booties', 'bootie', 'wellies', 'welly', 'wellingtons?', 'snowboots?', 'snow ?shoes?']);
// A winter or wet-weather boot, not a fashion or sports boot.
export const WINTER = W(['snow', 'winter', 'warm', 'warmth', 'fur', 'furry', 'faux fur', 'plush', 'fleece', 'fleece-?lined', 'thermal', 'insulated', 'lined',
  'cotton', 'waterproof', 'water-?proof', 'rain', 'wellies', 'welly', 'wellingtons?', 'puddle', 'cold', 'thick', 'velvet', 'wool', 'woolen', 'woollen']);
// For grown-ups (a family listing "men women kids" is not a child's boot) or not for people.
const ADULT = W(["women'?s", 'womens', 'women', 'woman', 'womans', 'ladies', 'lady', "men'?s", 'mens', 'men', 'man', 'mans', 'adults?', 'unisex adult', 'couples?', 'parent-?child', 'family']);
const NOT_A_BOOT = W(['punk', 'gothic', 'knight', 'catwalk', 'over ?knee', 'over-the-knee', 'thigh', 'stiletto', 'slippers?', 'slides?', 'motorcycle', 'work boots?', 'safety', 'steel toe', 'military', 'tactical', 'dolls?', 'doll shoes', 'reborn', 'barbie', 'pets?', 'dogs?', 'puppy', 'puppies', 'cats?', 'horse', 'covers?', 'shoe covers?', 'boot covers?',
  'socks?', 'leg warmers?', 'boot cuffs?', 'insoles?', 'laces?', 'shoelaces?', 'charms?', 'keychains?', 'key ?rings?', 'pendants?', 'necklaces?', 'earrings?',
  'stickers?', 'decals?', 'ornaments?', 'stockings?', 'christmas stocking', 'gift bags?', 'candy', 'mold', 'mould', 'cake', 'cookie', 'planter', 'vase',
  'brush', 'cleaner', 'dryer', 'tray', 'rack', 'stand', 'organizer', 'patterns?', 'crochet', 'knitting pattern', 'ski boots?', 'snowboard', 'ice skates?',
  'roller', 'football', 'soccer', 'cleats?', 'riding', 'equestrian', 'cowboys?', 'cowgirls?', 'heels?', 'high heels?', 'platform', 'stiletto', 'martin boots?']);
// Several pairs (a seller's lot) or a sample: not one child's pair at one price.
const LOT = W(['lots?', '\\d+ ?pairs?', '\\d+ ?pcs', 'wholesale ?lot', 'bulk', 'samples?', 'dropship', 'drop ?shipping', 'customi[sz]ed logo', 'oem', 'odm']);
// Famous brands and licensed characters: on a marketplace these are copies (Manager, 15 Nov 2026). Whole words.
export const BRANDS = W(['ugg', 'uggs', 'australia boots?', 'timberland', 'timberlands', 'the north face', 'north face', 'thenorthface', 'northface', 'tnf', 'lowmel', 'low mel', 'columbia', 'sorel', 'hunter', 'kamik',
  'moon ?boots?', 'bearpaw', 'emu', 'merrell', 'salomon', 'keen', 'geox', 'clarks', 'start-?rite', 'kickers', 'dr\\.? ?martens?', 'doc martens?', 'nike', 'jordan',
  'air ?max', 'adidas', 'yeezy', 'puma', 'reebok', 'new balance', 'asics', 'skechers', 'crocs', 'converse', 'vans', 'fila', 'champion', 'under armour', 'lacoste',
  'tommy hilfiger', 'calvin klein', 'ralph lauren', 'michael kors', 'kate spade', 'coach', 'gucci', 'louis vuitton', 'lv', 'chanel', 'dior', 'prada', 'fendi',
  'versace', 'burberry', 'balenciaga', 'hermes', 'moncler', 'canada goose', 'stone island', 'givenchy', 'valentino', 'ysl', 'saint laurent', 'bottega', 'celine',
  'off-?white', 'supreme', 'bape', 'stussy', 'golden goose', 'alexander mcqueen', 'mcqueen', 'ferragamo', 'loewe', 'miu miu', 'jimmy choo', 'christian louboutin',
  'tasman', 'tazz', 'ultra ?mini', 'australian', 'australia', 'aus', 'lexington', 'bailey', 'bailey bows?', 'classic button', 'mini classic', 'classic mini',
  'sheepskin', 'chestnut', 'martin', 'martins', 'u\\d{4}', '5825', '5815', '5854', '5281', '1873',
  'disney', 'frozen', 'elsa', 'olaf', 'mickey', 'minnie', 'marvel', 'spider-?man', 'spiderman', 'avengers', 'batman', 'superman', 'paw patrol', 'peppa',
  'peppa pig', 'bluey', 'cocomelon', 'hello kitty', 'kuromi', 'my melody', 'sanrio', 'pokemon', 'pikachu', 'sonic', 'mario', 'minecraft', 'roblox', 'barbie',
  'lol', 'lilo', 'cars', 'lightning mcqueen', 'unicorn academy', 'harry potter', 'star wars', 'transformers', 'lego', 'pj masks', 'gabby',
  'hey duggee', 'thomas the tank', 'moana', 'encanto', 'toy story', 'buzz lightyear', 'baby shark']);
// Words sellers use for copies of branded goods.
export const COPY = W(['luxury', 'replica', 'aaa', '1:1', 'top quality', 'original box', 'with box', 'with original box', 'designer', 'luxury brand', 'luxury designer', 'brand logo',
  'famous brand', 'mirror quality', 'inspired', 'dupe', 'authentic']);
// Words to take out of a card name: shop talk, not what the boot is.
const NOISE = /\b(?:hot sale|new arrival|newest|new|fashion|free shipping|free ship|drop ?shipping|wholesale|high quality|best quality|cheap|top sale|2\d{3})\b/gi;

export function displayName(name) {
  let n = unescape(name).replace(NOISE, ' ').replace(/[!?]+/g, ' ').replace(/\s*[,;|]+\s*/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  if (n.length > 100) { n = n.slice(0, 100); n = n.slice(0, Math.max(n.lastIndexOf(' '), 60)).replace(/[\s,.-]+$/, ''); }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// DHgate's brand column is a seller's name or empty: the card shows the shop.
export function displayBrand() { return 'DHgate'; }

const sendsToUk = info => {
  if (!info) return true;
  const where = `${info.target} ${info.areas}`.trim();
  if (!where) return true;
  return /(?:^|[^A-Z])(GB|UK)(?:[^A-Z]|$)/.test(where);
};

// DHgate titles keep HTML codes ("Men&#039;s"): read them as the letters they stand for.
export const unescape = t => String(t || '').replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').replace(/&#(\d{2,4});/g, (_, d) => String.fromCharCode(Number(d)));
// A DHgate page whose address is about something else (third look, 15 Nov 2026: "Toddler Snow Boot" on the page
// ".../lexington-chronograph-gold-tone-black-dial/409610975.html") is a re-used listing: it stays out.
const PAGE_WORDS = /boot|snow|shoe|welli|winter|warm|kid|child|toddler|baby|girl|boy|rain|fur|plush|fleece/i;
export function pageMatches(url) {
  const m = /\/product\/([^/]+)\/\d+\.html/i.exec(String(url || ''));
  return !m || PAGE_WORDS.test(m[1]);
}

export function classify({ name, brand = '', feedCategory = '', info = null, url = '' }) {
  const n = unescape(name);
  const t = `${n} | ${brand}`;
  if (BRANDS.test(t)) return { reject: 'a famous brand or character name on a marketplace (likely a copy)' };
  if (COPY.test(n)) return { reject: 'seller words for a copy of a branded product' };
  if (!sendsToUk(info)) return { reject: 'not sold or sent to the UK' };
  if (!pageMatches(url)) return { reject: 'the page address is about another product (a re-used listing)' };
  if (LOT.test(n)) return { reject: 'several pairs or a seller lot, not one pair' };
  if (NOT_A_BOOT.test(n)) return { reject: 'not a child\'s winter boot (accessory, doll, pet, sports or fashion boot)' };
  if (!BOOTS.test(n)) return { reject: 'not a boot' };
  if (!KIDS.test(n) && !/kid|child|baby|toddler/i.test(String(feedCategory || ''))) return { reject: 'not for children' };
  if (ADULT.test(n)) return { reject: 'also or only for grown-ups' };
  if (!WINTER.test(n)) return { reject: 'not a snow, winter or rain boot' };
  return { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' };
}
