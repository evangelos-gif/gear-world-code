#!/usr/bin/env node
// Gaming feed scan. READ-ONLY: reads the Awin feed files on this PC (and, if given, a copy of the Awin feed list)
// and writes a report. It imports nothing and changes no file.
// For the planned Gaming Gear World site (gaminggearworld.com, code PGW, "Play Gear World": GGW is Garden).
// Owner (31 Oct 2026): consoles, gaming PCs and laptops, gaming monitors, mice and keyboards, headsets, chairs and
// desks, controllers, games and gift cards, streaming (cameras, microphones, lights) and PC components.
// Technology Gear World (TGW) keeps everyday laptops, phones and office gear; gaming goes to the new site.
//
// 1. Feeds on this PC, in one or more folders (AWIN_<advertiserId>_<feedId>.csv[.gz] and Google Shopping files
//    "<advertiserId>-<name>.csv[.gz]"). When the same file is in two folders, the newest copy counts (L41).
//    Per retailer: how many DIFFERENT gaming products (Google files: all sizes of a product are one product, L34),
//    per proposed category, in stock (a quantity of 0 is out of stock, L64), currencies, shop categories, samples.
// 2. Products that belong to another Gear World site are counted apart (L14): toys and board games (KGW), gaming
//    merchandise such as T-shirts, mugs and posters. Gaming products that also fit the real TGW rules stay PGW
//    products and are flagged: that number is the TGW/PGW boundary.
// 3. Awin feed list (optional, --list <csv>): which programmes look like gaming retailers, joined or not, with the
//    link to apply. Gambling ("gaming" also means casinos in the UK), loans and subscriptions are left out.
//
// Usage: node tools/gaming-feed-scan.mjs --archive <dir>[;<dir>...] --out <dir> [--list <feed list csv>] [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, googleBaseName } from './tgw-import-plan.mjs';
import * as TGW_RULES from '../sites/tgw/category-rules.js';

// A list of regex fragments -> one regex with word edges (L42: "gin" must not match "Original").
const words = list => new RegExp(`(?<![a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Words that say "this is for gaming". The shop's own category counts too. Not "switch" alone (network switches),
// not "games" alone in a shop category ("Toys & Games" is board games).
export const GAMING_CTX = words(['gaming', 'gamers?', "gamer's", 'e-?sports?', 'playstation(?: ?[45])?', 'ps[345]', 'xbox(?: series [xs]| one)?', 'nintendo',
  'nintendo switch(?: 2| oled| lite)?', 'switch (?:2|oled|lite)', 'steam deck', 'steam', 'rgb', 'razer', 'steelseries', 'hyperx', 'corsair', 'logitech g(?: ?pro|\\d{3})?',
  'roccat', 'turtle beach', 'alienware', 'rog', 'tuf gaming', 'legion', 'omen', 'predator', 'msi', 'gravastar', 'elgato', 'secretlab', 'noblechairs', '8bitdo',
  'thrustmaster', 'fanatec', 'nacon', 'powera', 'pdp', 'astro', 'glorious', 'endgame gear', 'zowie', 'cooler master', 'nzxt', 'sharkoon', 'trust gxt']);
export const GAMING_SHOP = words(['gaming', 'gamers?', 'video ?games?', 'pc games?', 'console games?', 'consoles?', 'e-?sports?', 'playstation', 'xbox', 'nintendo',
  'pc components?', 'graphics cards?', 'peripherals?', 'streaming']);

// Not gaming products, even with a gaming word (L42, L63, L64): printer supplies, servers, licences and services,
// parts for repairing one laptop model, and gambling.
export const NO = words(['toners?', 'ink(?: cartridges?)?', 'toner cartridges?', 'drums? units?', 'xeon', 'epyc', 'servers?', 'rack ?mount(?:ed)?', 'raid controllers?',
  'warrant(?:y|ies)', 'care ?packs?', 'support services?', 'extended service', 'licen[cs]es?', 'office 365', 'microsoft 365', 'csp', 'eos \\d', 'end of sale',
  'replacement (?:keyboards?|screens?|batter(?:y|ies)|fans?|hinges?|lcd|panels?)', 'laptop (?:batter(?:y|ies)|hinges?|lcd)', 'kbd belg', 'casino', 'bingo', 'poker',
  'slots?', 'betting', 'lottery', 'lotto', 'gambling', 'free gift only', 'die ?cast', 'scale models?', 'greeting cards?', 'birthday cards?', 'phone cases?', 'iphone cases?']);

// Monitor refresh rate: 144 Hz and more is a gaming screen (the TGW rules use 170 Hz for TVs; monitors start lower).
export function refreshHz(name) {
  let best = 0;
  for (const m of String(name || '').matchAll(/(\d{2,3})\s?hz/gi)) best = Math.max(best, Number(m[1]));
  return best;
}
const SCREEN = words(['monitors?', 'displays?', 'screens?', 'oled', 'qd-?oled', 'ips', 'va', 'curved', 'ultrawide', 'qhd', 'wqhd', 'uhd', '4k', '1440p', '1080p']);
const TV = words(['tvs?', 'televisions?', 'smart tv', 'projectors?']);

// Proposed PGW categories (first match wins; "ctx" words count only with a gaming word or a gaming shop category).
// Games and gift cards come first ("Mario Kart World (Nintendo Switch 2)" is a game, not a console); controllers come
// before consoles ("Nintendo Switch Pro Controller").
export const CATEGORIES = [
  {
    key: 'games-cards', label: 'Games & gift cards',
    sure: words(['(?:ps5|ps4|playstation ?[45]|xbox(?: series [xs]| one)?|nintendo switch(?: 2)?|switch 2|pc|steam) games?', 'video games?', 'games? for (?:ps5|ps4|xbox|nintendo switch|switch|pc)',
      '\\((?:ps5|ps4|xbox series x|xbox one|nintendo switch 2?|switch 2?|pc)\\)', '(?:psn|playstation|playstation store|xbox|nintendo eshop|eshop|steam|roblox|fortnite|ea ?play) (?:gift |wallet |store )?(?:cards?|credit|vouchers?|codes?|top-?ups?)',
      'v-?bucks', 'robux', 'game ?pass(?: ultimate| core)?', 'playstation plus', 'ps plus', 'nintendo switch online', 'pegi ?(?:3|7|12|16|18)', 'digital (?:code|download) (?:for )?(?:ps5|ps4|xbox|switch|pc)',
      '(?:standard|deluxe|gold|ultimate|collector\'?s|game of the year|goty) edition']),
    ctx: words(['games?', 'gift cards?', 'vouchers?', 'codes?']),
    shop: words(['video ?games?', 'pc games?', 'console games?', 'digital games?', 'gift cards?'])
  },
  {
    key: 'controllers', label: 'Controllers, wheels & sticks',
    sure: words(['game ?pads?', 'game controllers?', 'gaming controllers?', '(?:ps5|ps4|playstation|xbox|switch|nintendo switch|pc|wireless|wired) (?:pro )?controllers?', 'pro controllers?', 'dualsense(?: edge)?', 'dualshock',
      'joy-?cons?', 'racing wheels?', 'steering wheels? (?:for|and pedals?)', 'wheel (?:and|&) pedals?', 'pedal sets?', 'shifters?', 'flight sticks?', 'hotas', 'joysticks?', 'arcade sticks?', 'fight ?sticks?',
      'thrustmaster', 'fanatec', '8bitdo', 'nacon revolution', 'wolverine', 'controller (?:charging (?:stations?|docks?)|chargers?|grips?|skins?|thumb ?grips?|batter(?:y|ies)|paddles?)', 'charging (?:stations?|docks?) for (?:ps5|dualsense|xbox|controllers?)']),
    ctx: words(['controllers?', 'wheels?', 'pedals?', 'sticks?', 'paddles?']),
    shop: words(['controllers?', 'gamepads?', 'wheels?', 'joysticks?'])
  },
  {
    key: 'consoles', label: 'Consoles & handhelds',
    sure: words(['(?:ps5|ps4|playstation ?5|playstation ?4) (?:pro |slim |digital (?:edition )?)?(?:consoles?|bundles?|slim|pro|digital edition)', 'xbox series [xs](?: console| bundle)?', 'xbox one (?:s|x)(?: console)?',
      'nintendo switch(?: 2| oled| lite)? (?:console|bundle|oled model|lite)', 'switch (?:2|oled|lite) (?:console|bundle)', 'steam deck(?: oled| lcd)?', 'rog ally(?: x)?', 'legion go(?: s)?', 'msi claw', 'playstation portal',
      'retro (?:game )?consoles?', 'game consoles?', 'games consoles?', '(?:portable|handheld) (?:game |gaming )?consoles?', 'mini consoles?', 'retroid', 'anbernic', 'ayaneo', 'evercade', 'meta quest ?\\d?', 'playstation vr ?2?', 'psvr ?2?', 'vr headsets?',
      'console (?:stands?|covers?|faceplates?|cooling fans?|storage|carry cases?|cases?)', '(?:ps5|xbox|switch|steam deck) (?:carry |travel )?(?:cases?|stands?|docks?|covers?|cooling fans?|screen protectors?)']),
    ctx: words(['consoles?', 'handhelds?', 'docks?', 'vr']),
    shop: words(['consoles?', 'handhelds?', 'virtual reality', 'vr'])
  },
  {
    key: 'pcs-laptops', label: 'Gaming PCs & laptops',
    sure: words(['gaming (?:pcs?|laptops?|notebooks?|desktops?|computers?|towers?|systems?|mini pcs?)', 'alienware (?:m|x|aurora|area|\\d)', 'rog (?:strix|zephyrus|flow)(?! (?:b|x|z)\\d{3})', 'tuf gaming [af]\\d{2}',
      'legion (?:pro |slim |tower |t)?\\d', 'omen (?:\\d|transcend|max|\\d{2}l)', 'victus', 'predator (?:helios|orion|triton)', 'nitro (?:v|\\d{1,2})(?! ?\\d{3,})', 'msi (?:katana|raider|stealth|titan|cyborg|thin gf|sword|vector|crosshair|pulse|aegis|infinite|trident|codex)',
      'razer blade', 'aorus (?:\\d+|elite|master) (?:laptop|\\d)', 'rtx \\d{4} (?:gaming )?(?:laptop|pc|desktop)', '(?:laptop|pc|desktop) (?:with )?(?:geforce )?rtx \\d{4}']),
    ctx: words(['laptops?', 'notebooks?', 'desktops?', 'pcs?', 'towers?', 'computers?', 'mini pcs?']),
    shop: words(['gaming (?:laptops?|pcs?|desktops?)', 'laptops?', 'desktops?'])
  },
  {
    key: 'monitors', label: 'Gaming monitors',
    sure: words(['gaming monitors?', 'gaming displays?', 'odyssey (?:g|oled g|ark)\\d*', 'ultragear', 'rog swift', 'rog strix (?:xg|xg\\d+)', 'predator (?:x|xb|xv)\\d+', 'nitro (?:xv|vg|xz|kg)\\d+', 'alienware aw\\d+',
      'msi (?:mag|mpg|g)\\s?\\d{3}', 'aoc (?:agon|c?\\d{2}g\\d)', 'zowie xl\\d+', 'benq mobiuz', 'gigabyte (?:m|g|fo|ao)\\d{2}']),
    ctx: words(['monitors?', 'displays?', 'screens?', 'monitor (?:arms?|mounts?|stands?)', 'monitor light ?bars?']),
    shop: words(['monitors?', 'displays?'])
  },
  {
    key: 'mice-keyboards', label: 'Mice, keyboards & mouse pads',
    sure: words(['gaming (?:mouse|mice|keyboards?|keypads?|mouse ?pads?|mouse ?mats?|desk ?mats?|keyboard and mouse(?: combo| set)?)', 'mechanical (?:gaming )?keyboards?', 'keycaps?(?: sets?)?', 'hot-?swappable keyboards?',
      'deathadder', 'viper (?:v\\d|mini|ultimate|8k)', 'basilisk', 'naga', 'huntsman', 'blackwidow', 'ornata', 'cynosa', 'g ?pro x(?: superlight)?', 'g50[2-9]', 'g30[3-5]', 'g203', 'g915', 'g815', 'g715', 'g213',
      'apex (?:pro|\\d)', 'rival \\d+', 'aerox', 'prime (?:wireless|mini|\\+)', 'k70', 'k100', 'k65', 'k55', 'dark core', 'm65', 'harpoon', 'ironclaw', 'scimitar', 'model [od]-?(?: wireless| minus)?', 'pulsefire', 'alloy (?:origins|fps|core|elite|rise)',
      'wooting', 'ducky', 'keychron', 'mercury m1', 'g-?pro', 'superlight']),
    ctx: words(['mouse', 'mice', 'keyboards?', 'keypads?', 'mouse ?pads?', 'mouse ?mats?', 'desk ?mats?', 'wrist rests?', 'mouse bungees?']),
    shop: words(['mice', 'mouse', 'keyboards?', 'peripherals?'])
  },
  {
    key: 'headsets', label: 'Headsets & gaming audio',
    sure: words(['gaming (?:headsets?|headphones?|earbuds?|earphones?|speakers?|soundbars?|sound ?bars?)', 'arctis(?: nova)?', 'kraken', 'barracuda', 'blackshark', 'cloud (?:ii|iii|alpha|stinger|flight|mix|orbit)', 'turtle beach',
      'stealth (?:\\d{3}|pro)', 'recon \\d+', 'pulse (?:3d|elite|explore)', 'astro a\\d{2}', 'virtuoso', 'hs\\d{2}(?: pro| max| rgb)?', 'void (?:rgb|elite)', 'g ?pro x headsets?', 'g435', 'g535', 'g733', 'astro a50',
      'headset (?:stands?|holders?|hangers?|amps?)', '(?:ps5|xbox|playstation) (?:headsets?|earbuds?|headphones?)']),
    ctx: words(['headsets?', 'headphones?', 'earbuds?', 'earphones?', 'speakers?', 'sound ?bars?', 'dacs?', 'amps?']),
    shop: words(['headsets?', 'headphones?', 'audio'])
  },
  {
    key: 'chairs-desks', label: 'Gaming chairs & desks',
    sure: words(['gaming (?:chairs?|desks?|tables?|stools?|sofas?|beds?|bean ?bags?|recliners?|rockers?|floor chairs?|footrests?|setups?)', 'racing (?:style )?(?:office |computer |gaming )?chairs?', 'secretlab', 'noblechairs',
      'dxracer', 'gtplayer', 'gtracing', 'vertagear', 'andaseat', 'akracing', 'corsair tc\\d+', 'titan evo', 'l-?shaped (?:gaming )?desks?', 'esports chairs?', 'cockpits?', 'racing (?:sim |simulator )?(?:seats?|rigs?|cockpits?)', 'sim rigs?']),
    ctx: words(['chairs?', 'desks?', 'stools?', 'footrests?', 'cockpits?', 'rigs?']),
    shop: words(['chairs?', 'desks?', 'furniture', 'seating'])
  },
  {
    key: 'streaming', label: 'Streaming: cameras, microphones & lights',
    sure: words(['stream ?decks?', 'capture cards?', 'game capture', 'elgato', 'key ?lights?', 'ring lights?', 'green ?screens?', 'streaming (?:kits?|lights?|cameras?|microphones?|mics?|bundles?)', 'streamer (?:kits?|bundles?)',
      '(?:usb|streaming|podcast|podcasting|condenser|xlr|gaming|dynamic) (?:microphones?|mics?)', 'shure mv7', 'shure sm7b', 'rode (?:podmic|nt-?usb|psa1|procaster)', 'blue yeti', 'yeti (?:x|nano|gx)', 'quadcast', 'solocast', 'razer (?:kiyo|seiren)',
      'facecam', 'webcams?', 'web cams?', 'boom arms?', 'mic (?:arms?|stands?|booms?)', 'microphone (?:arms?|stands?|booms?)', 'pop filters?', 'shock mounts?', 'audio interfaces?', 'go ?xlr', 'wave ?xlr', 'rodecaster', 'video lights?', 'light panels?']),
    ctx: words(['microphones?', 'mics?', 'cameras?', 'lights?', 'lighting']),
    shop: words(['streaming', 'webcams?', 'microphones?', 'content creat(?:ion|ors?)'])
  },
  {
    key: 'components', label: 'PC components',
    sure: words(['graphics cards?', 'video cards?', '(?:geforce|nvidia) (?:rtx|gtx) ?\\d{3,4}(?: ti| super)?', 'rtx ?\\d{4}(?: ti| super)?', 'radeon (?:rx ?)?\\d{3,4}(?: xt| xtx)?', 'rx ?[5-9]\\d{3}(?: xt| xtx)?', 'arc (?:a|b)\\d{3}',
      'ryzen [3579] \\d{4}[a-z]{0,3}', 'ryzen threadripper', 'core (?:i[3579]|ultra [579])[ -]\\d{3,5}[a-z]{0,3}', 'motherboards?', '(?:am[45]|lga ?1[78]\\d{2}|b[4-8]\\d0|x[56]\\d0e?|z[6-8]\\d0) (?:atx|matx|micro ?atx|mini ?itx|motherboards?)',
      'ddr[45](?:-?\\d{4})? (?:ram|memory|desktop memory|kits?|\\d+ ?gb)', '\\d+ ?gb (?:\\(\\d ?x ?\\d+ ?gb\\) )?ddr[45]', '(?:nvme|m\\.2|pcie (?:gen ?)?[345]\\.0) (?:ssds?|solid state drives?)', 'cpu coolers?', '(?:aio|all-?in-?one) (?:liquid |water )?coolers?',
      'liquid coolers?', 'pc cases?', 'computer cases?', '(?:atx|mid[- ]tower|full[- ]tower|micro ?atx|mini ?itx) (?:pc )?cases?', 'power supply units?', '(?:\\d{3,4} ?w) (?:atx )?(?:psu|power supply)', 'psus?', 'case fans?',
      'thermal (?:paste|compound|pads?)']),
    ctx: null,
    shop: words(['pc components?', 'graphics cards?', 'motherboards?', 'processors?', 'memory', 'cooling', 'power supplies', 'cases'])
  }
];
export const OTHER = { key: 'other-gaming', label: 'Other gaming products' };

// Products that go to another Gear World site. Checked before the gaming category, only with a gaming word.
export const OVERLAPS = [
  { key: 'kids', label: 'Toys, figures & board games (Kids\' Gear World, KGW)', re: words(['toys?', 'plush(?:ies)?', 'soft toys?', 'figures?', 'figurines?', 'funko', 'amiibo', 'lego', 'playmobil', 'board games?',
    'card games?', 'jigsaws?', 'puzzles?', 'trading cards?', 'colouring', 'kids? (?:tablets?|smart ?watch(?:es)?|cameras?)', 'toddler', 'baby']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'chairs?', 'game ?pads?']) },
  { key: 'merch', label: 'Gaming merchandise: clothing, mugs, posters, lamps (Men\'s, Women\'s, Home)', re: words(['t-?shirts?', 'tees?', 'hoodies?', 'sweatshirts?', 'jumpers?', 'socks', 'caps?', 'beanies?', 'pyjamas', 'mugs?',
    'glasses', 'bottles?', 'posters?', 'wall art', 'prints?', 'canvas', 'lamps?', 'night lights?', 'bedding', 'duvet(?: covers?)?', 'cushions?', 'rugs?', 'backpacks?', 'wallets?', 'keyrings?', 'key chains?', 'books?', 'calendars?', 'costumes?']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'keyboards?', 'mouse', 'ring lights?', 'key ?lights?', 'gaming backpacks?', 'laptop backpacks?']) }
];
// Checked with the real TGW rules, only for products that matched a PGW category: these are the TGW/PGW boundary.
export const SITE_RULES = [
  { key: 'tgw', label: 'Also matches the Technology Gear World rules (TGW)', rules: TGW_RULES }
];
const OVERLAP_KEYS = OVERLAPS.map(o => o.key);
const ALSO_KEYS = SITE_RULES.map(s => s.key);
const overlapLabel = k => (OVERLAPS.find(o => o.key === k) || SITE_RULES.find(s => s.key === k) || { label: k }).label;

// Words in a programme's name that point to a gaming retailer (for the Awin list).
export const PROGRAMME_WORDS = words(['gaming', 'gamers?', 'games?', 'consoles?', 'e-?sports?', 'playstation', 'xbox', 'nintendo', 'steam', 'scan(?: computers)?', 'overclockers', 'box\\.co\\.uk', 'box uk',
  'laptops direct', 'ebuyer', 'currys', 'cdkeys', 'cd keys', 'zavvi', 'game collection', 'shopto', 'razer', 'steelseries', 'corsair', 'logitech', 'hyperx', 'turtle beach', 'secretlab', 'noblechairs', 'elgato', '8bitdo',
  'alienware', 'msi', 'asus', 'rog', 'acer', 'predator', 'lenovo', 'legion', 'omen', 'chillblast', 'pc ?specialist', 'cyberpower', 'novatech', 'ccl', 'gamingkit', 'pc ?nova', 'pc ?hub', 'back ?market', 'music ?magpie', 'cex',
  'green man', 'humble', 'fanatical', 'eneba', 'gamivo', 'kinguin', 'thrustmaster', 'fanatec', 'nacon', 'gtplayer', 'dxracer', 'andaseat']);
// Programmes that are gambling, finance, subscriptions or services, not products: left out of the list.
export const PROGRAMME_NO = words(['casino', 'bingo', 'poker', 'slots?', 'bet\\d*', 'betting', 'bets', 'betway', 'betfair', 'betfred', 'paddy ?power', 'william hill', 'ladbrokes',
  'coral', 'sky (?:vegas|bet|casino|poker)', 'grosvenor', 'mecca', 'unibet', 'jackpotjoy', '888', 'virgin games', 'tombola', 'gala', 'sportsbook', 'lottery', 'lotto', 'gambling', 'jackpot', 'spins?', 'insurance', 'loans?', 'finance', 'credit', 'broadband',
  'mobile (?:plans?|contracts?|sim)', 'sim only', 'vpn', 'dating', 'hosting', 'courses?', 'training', 'tickets?', 'events?', 'magazines?', 'hotels?', 'holidays?', 'lingerie', 'fashion']);

export function isGamingProgramme(name, vertical = '') {
  const t = String(name || '');
  if (PROGRAMME_NO.test(t)) return false;
  return PROGRAMME_WORDS.test(t) || /video ?games|gaming/i.test(String(vertical || ''));
}

const low = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[’`]/g, "'").replace(/[ \s]+/g, ' ').trim();

// name: product name; shopCat: the shop's category and Awin's category. Returns
//   { sport: true, cat }                         a product for PGW ("sport" keeps the shared report code)
//   { sport: true, cat, also: 'tgw' }            a product for PGW that also fits the TGW rules (the boundary)
//   { sport: false, overlap, cat }               a product that belongs to another site
//   { sport: false }                             not a PGW product
export function classify(name, shopCat = '') {
  const n = low(name), c = low(shopCat);
  if (!n || NO.test(n)) return { sport: false, why: 'no-list' };
  const gamingShop = GAMING_SHOP.test(c);
  const ctx = GAMING_CTX.test(n) || gamingShop;
  const hz = refreshHz(n);
  const fastScreen = hz >= 144 && SCREEN.test(n) && !TV.test(n);
  if (ctx || fastScreen) {
    for (const o of OVERLAPS) {
      if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
        let cat = null;
        for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
        return { sport: false, overlap: o.key, cat };
      }
    }
  }
  // First the clear names of every category, then a fast monitor, then the general words with a gaming word.
  let cat = null;
  for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
  if (cat === 'monitors' && TV.test(n)) cat = null;
  if (!cat && fastScreen) cat = 'monitors';
  if (!cat && ctx) for (const k of CATEGORIES) if (k.ctx && k.ctx.test(n)) { cat = k.key; break; }
  // Second chance: the shop's own gaming category says which one ("Gaming > Headsets").
  if (!cat && gamingShop) for (const k of CATEGORIES) if (k.shop && k.shop.test(c)) { cat = k.key; break; }
  if (!cat && gamingShop && GAMING_CTX.test(n)) cat = OTHER.key;
  if (!cat) return { sport: false };
  for (const s of SITE_RULES) {
    let ok = false;
    try { ok = !!s.rules.classify(name, shopCat, shopCat).ok; } catch { ok = false; }
    if (ok) return { sport: true, cat, also: s.key };
  }
  return { sport: true, cat };
}

// ---------- Reading the feeds ----------

const AWIN_COLS = {
  merchant: ['merchant_name'], name: ['product_name'], desc: ['product_short_description'],
  price: ['search_price', 'store_price', 'display_price', 'price'], currency: ['currency'],
  qty: ['stock_quantity'], flag: ['in_stock', 'is_for_sale', 'stock_status'],
  shopCat: ['merchant_category', 'merchant_product_category_path'], awinCat: ['category_name'], brand: ['brand_name']
};
const GOOGLE_COLS = {
  merchant: [], name: ['title'], desc: ['description'], price: ['sale_price', 'price'], currency: [], qty: [], flag: ['availability'],
  shopCat: ['product_type'], awinCat: ['google_product_category'], brand: ['brand']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const google = !h.includes('product_name') && h.includes('title') && (h.includes('link') || h.includes('id'));
  const cols = google ? GOOGLE_COLS : AWIN_COLS;
  return { google, ...Object.fromEntries(Object.entries(cols).map(([k, names]) => [k, names.map(x => h.indexOf(x)).filter(i => i >= 0)])) };
}
const pick = (rec, idxs) => { for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); } return ''; };

// In stock: a quantity number wins (L64: "in stock" with quantity 0 is out of stock), else the flag (L37).
export function inStock(qty, flag) {
  const q = String(qty || '').trim();
  if (/^\d+(\.0+)?$/.test(q)) return Number(q) > 0;
  const s = String(flag || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in_stock|instock|available|available_to_order|limited_stock|preorder|backorder)$/.test(s)) return true;
  return false;
}

// Every feed file in the folders. The same file name in two folders: the newest copy counts (L41).
export function listFeedFiles(archives) {
  const best = new Map();
  for (const dir of archives) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const f of names) {
      const awin = f.match(/^AWIN_(\d+)_(\d+)\.csv(\.gz)?$/i);
      const google = !awin && f.match(/^(\d{2,7})-[^\\/]*\.csv(\.gz)?$/i);
      if (!awin && !google) continue;
      const full = join(dir, f);
      let mtime = 0;
      try { const st = statSync(full); if (!st.isFile()) continue; mtime = st.mtimeMs; } catch { continue; }
      const key = f.toLowerCase().replace(/\.gz$/, '');
      const had = best.get(key);
      if (!had || mtime > had.mtime) best.set(key, { file: f, path: full, dir, mtime, advertiserId: Number((awin || google)[1]), kind: awin ? 'awin' : 'google' });
    }
  }
  return [...best.values()].sort((a, b) => a.advertiserId - b.advertiserId || a.file.localeCompare(b.file));
}

export async function scanArchive({ archives, maxRows = Infinity, log = () => {}, now = Date.now() }) {
  const all = listFeedFiles(archives);
  const files = [];
  const byAdv = new Map();
  let i = 0;
  for (const fi of all) {
    i++;
    const a = byAdv.get(fi.advertiserId) || { advertiserId: fi.advertiserId, merchant: '', files: [], rows: 0, products: 0, sport: 0, sportInStock: 0,
      cats: {}, also: {}, alsoSamples: {}, overlaps: {}, overlapSamples: {}, shopCats: {}, currencies: {}, samples: {}, ageDays: 9999, google: false, error: '', seen: new Set(), seenAll: new Set() };
    let map = null;
    try {
      const raw = createReadStream(fi.path);
      const stream = /\.gz$/i.test(fi.file) ? raw.pipe(createGunzip()) : raw;
      let n = 0;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) {
          map = mapHeader(rec);
          // Not a product feed (another CSV that starts with a number): skip it, and do not list its name.
          if (!map.name.length) break;
          if (map.google) a.google = true;
          continue;
        }
        if (rec.length < 3) continue;
        n++; a.rows++;
        if (!a.merchant && map.merchant.length) a.merchant = pick(rec, map.merchant);
        let name = pick(rec, map.name);
        if (map.google) name = googleBaseName(name);
        const key = low(name);
        if (!key) continue;
        const brand = pick(rec, map.brand);
        const shopCat = [pick(rec, map.shopCat), pick(rec, map.awinCat)].filter(Boolean).join(' | ');
        const prodKey = `${low(brand)}|${key}`;
        if (!a.seenAll.has(prodKey)) { a.seenAll.add(prodKey); a.products++; }
        const r = classify(name, shopCat);
        if (!r.sport && !r.overlap) { if (n >= maxRows) break; continue; }
        const bucket = r.sport ? `cat:${r.cat}` : `ov:${r.overlap}`;
        if (a.seen.has(`${bucket}|${prodKey}`)) { if (n >= maxRows) break; continue; }
        a.seen.add(`${bucket}|${prodKey}`);
        const priceText = pick(rec, map.price);
        const cur = (pick(rec, map.currency) || (priceText.match(/\b([A-Z]{3})\b/) || [])[1] || '?').toUpperCase();
        const price = (priceText.match(/\d+(?:[.,]\d+)?/) || [''])[0];
        if (r.sport) {
          a.sport++;
          if (inStock(pick(rec, map.qty), pick(rec, map.flag)) !== false) a.sportInStock++;
          a.cats[r.cat] = (a.cats[r.cat] || 0) + 1;
          if (r.also) {
            a.also[r.also] = (a.also[r.also] || 0) + 1;
            const al = (a.alsoSamples[r.also] ||= []);
            if (al.length < 2 && (a.also[r.also] % 17 === 1)) al.push(`${name.slice(0, 70)} | ${price} ${cur}`);
          }
          const sc = pick(rec, map.shopCat) || pick(rec, map.awinCat) || '(no category)';
          a.shopCats[sc] = (a.shopCats[sc] || 0) + 1;
          a.currencies[cur] = (a.currencies[cur] || 0) + 1;
          const list = (a.samples[r.cat] ||= []);
          if (list.length < 3 && (a.cats[r.cat] % 23 === 1)) list.push(`${name.slice(0, 80)} | ${price} ${cur}`);
        } else {
          a.overlaps[r.overlap] = (a.overlaps[r.overlap] || 0) + 1;
          const list = (a.overlapSamples[r.overlap] ||= []);
          if (list.length < 2 && (a.overlaps[r.overlap] % 17 === 1)) list.push(`${name.slice(0, 70)} | ${price} ${cur}`);
        }
        if (n >= maxRows) break;
      }
    } catch (e) {
      if (!map && fi.kind !== 'awin') { log(`${i}/${all.length} skipped`); continue; }
      a.error = String(e && e.message || e).slice(0, 160);
    }
    if (fi.kind !== 'awin' && !(map && map.name.length)) { log(`${i}/${all.length} skipped`); continue; }
    a.files.push(`${fi.file} (${new Date(fi.mtime).toISOString().slice(0, 10)})`);
    a.ageDays = Math.min(a.ageDays, Math.floor((now - fi.mtime) / 86400000));
    files.push(fi);
    byAdv.set(fi.advertiserId, a);
    log(`${i}/${all.length} ${fi.file}`);
  }
  const advs = [...byAdv.values()];
  for (const a of advs) { delete a.seen; delete a.seenAll; }
  return { advs, files };
}

export async function readList(file) {
  const out = [];
  let head = null;
  for await (const rec of readCsvRecords(createReadStream(file))) {
    if (!head) { head = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    if (rec.length < 3) continue;
    const col = re => { const i = head.findIndex(h => re.test(h)); return i >= 0 ? String(rec[i] || '').trim() : ''; };
    out.push({ id: col(/^advertiser.?id$/), name: col(/^advertiser.?name$/), region: col(/region/), membership: col(/membership/),
      feedId: col(/^feed.?id$/), feedName: col(/^feed.?name$/), vertical: col(/vertical/), products: Number(col(/(no|number).?of.?products/)) || 0 });
  }
  return out;
}

const JOINED = /^(active|joined)$/i;

export function render({ advs, files = [], list = null, archives = [], generated = new Date() }) {
  const fmt = x => new Intl.NumberFormat('en-GB').format(x);
  const pct = (x, y) => (y ? `${Math.round((x / y) * 100)}%` : '-');
  const label = k => (CATEGORIES.find(c => c.key === k) || OTHER).label;
  const names = new Map();
  const joinedIds = new Set();
  if (list) for (const r of list) { if (r.id && r.name && !names.has(r.id)) names.set(r.id, r.name); if (JOINED.test(r.membership)) joinedIds.add(r.id); }
  const who = a => a.merchant || names.get(String(a.advertiserId)) || (a.google ? 'Google Shopping feed' : '?');
  const L = [];
  L.push(`GAMING FEED SCAN (read-only) - for Gaming Gear World (gaminggearworld.com, code PGW) ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  L.push(`Folders read: ${archives.join(' ; ') || '-'}`);
  L.push(`Feed files: ${files.length} (newest copy of each file name)`);
  const withSport = advs.filter(a => a.sport > 0).sort((x, y) => y.sport - x.sport);
  const totalSport = withSport.reduce((t, a) => t + a.sport, 0);
  const totalInStock = withSport.reduce((t, a) => t + a.sportInStock, 0);
  L.push(`Retailers in the feeds: ${advs.length} | with gaming products: ${withSport.length} | different gaming products: ${fmt(totalSport)} (in stock ${pct(totalInStock, totalSport)})`);
  const errs = advs.filter(a => a.error);
  if (errs.length) L.push(`Could not read: ${errs.map(a => `${a.advertiserId} (${a.error})`).join('; ')}`);
  L.push('');
  L.push('== GAMING PRODUCTS PER PROPOSED CATEGORY (all retailers) ==');
  const tot = {}, shops = {};
  for (const a of withSport) for (const [k, x] of Object.entries(a.cats)) { tot[k] = (tot[k] || 0) + x; shops[k] = (shops[k] || 0) + 1; }
  for (const c of [...CATEGORIES, OTHER]) {
    L.push(`  ${(c.label + (c.scan ? ' *' : '')).padEnd(46)} ${fmt(tot[c.key] || 0).padStart(8)}  from ${shops[c.key] || 0} retailer(s)`);
  }
  L.push('');
  L.push('== PGW PRODUCTS THAT ALSO FIT THE TGW RULES - counted above too (this is the TGW/PGW boundary) ==');
  const al = {}, alShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.also)) { al[k] = (al[k] || 0) + x; alShops[k] = (alShops[k] || 0) + 1; }
  for (const k of ALSO_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(al[k] || 0).padStart(8)}  from ${alShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== PRODUCTS THAT BELONG TO ANOTHER GEAR WORLD SITE - not counted above ==');
  const ov = {}, ovShops = {};
  for (const a of advs) for (const [k, x] of Object.entries(a.overlaps)) { ov[k] = (ov[k] || 0) + x; ovShops[k] = (ovShops[k] || 0) + 1; }
  for (const k of OVERLAP_KEYS) L.push(`  ${overlapLabel(k).padEnd(62)} ${fmt(ov[k] || 0).padStart(8)}  from ${ovShops[k] || 0} retailer(s)`);
  L.push('');
  L.push('== RETAILERS WITH GAMING PRODUCTS (most first) ==');
  for (const a of withSport) {
    const joined = list ? (joinedIds.has(String(a.advertiserId)) ? ' | Awin: JOINED' : ' | Awin: not joined or not in the list') : '';
    L.push(`-- ${a.advertiserId} ${who(a)}: ${fmt(a.sport)} gaming of ${fmt(a.products)} products (${pct(a.sport, a.products)}) | in stock ${pct(a.sportInStock, a.sport)} | ${Object.entries(a.currencies).map(([c, x]) => `${c} ${fmt(x)}`).join(', ')} | file ${a.ageDays}d old${a.google ? ' | Google format (sizes joined)' : ''}${joined}`);
    L.push(`   by category: ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, x]) => `${label(k)} ${fmt(x)}`).join(' | ')}`);
    const o = Object.entries(a.overlaps).sort((x, y) => y[1] - x[1]);
    if (o.length) L.push(`   other sites: ${o.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    const al2 = Object.entries(a.also).sort((x, y) => y[1] - x[1]);
    if (al2.length) L.push(`   also fit: ${al2.map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
    L.push(`   shop categories: ${Object.entries(a.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, x]) => `${c.slice(0, 50)} (${fmt(x)})`).join(' | ')}`);
    for (const [k, s] of Object.entries(a.samples)) for (const x of s.slice(0, 2)) L.push(`   e.g. [${label(k)}] ${x}`);
    for (const [k, s] of Object.entries(a.overlapSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. other site [${k}] ${x}`);
    for (const [k, s] of Object.entries(a.alsoSamples)) for (const x of s.slice(0, 1)) L.push(`   e.g. also fits [${k}] ${x}`);
  }
  const onlyOverlap = advs.filter(a => a.sport === 0 && Object.keys(a.overlaps).length);
  if (onlyOverlap.length) {
    L.push('');
    L.push('== RETAILERS WITH ONLY OTHER-SITE PRODUCTS (e.g. toys, merchandise) ==');
    for (const a of onlyOverlap) L.push(`  ${a.advertiserId} ${who(a)}: ${Object.entries(a.overlaps).map(([k, x]) => `${k} ${fmt(x)}`).join(' | ')}`);
  }
  const none = advs.filter(a => a.sport === 0 && !Object.keys(a.overlaps).length);
  L.push('');
  L.push(`== NO GAMING PRODUCTS (${none.length}) ==`);
  L.push('  ' + none.map(a => `${a.advertiserId} ${who(a)}`).join(', '));
  L.push('');
  L.push('== FEED FILES USED ==');
  for (const f of files) L.push(`  ${f.file}  (${new Date(f.mtime).toISOString().slice(0, 10)}, ${f.dir})`);
  if (list) {
    L.push('');
    const here = new Set(advs.map(a => String(a.advertiserId)));
    L.push(`== AWIN FEED LIST: ${list.length} feeds, ${list.filter(r => JOINED.test(r.membership)).length} from programmes you joined ==`);
    const sport = list.filter(r => isGamingProgramme(`${r.name} ${r.feedName}`, r.vertical));
    const byId = new Map();
    for (const r of sport) { const had = byId.get(r.id); if (!had) byId.set(r.id, { ...r }); else had.products += r.products; }
    const uniq = [...byId.values()].sort((x, y) => y.products - x.products);
    L.push('-- Gaming programmes you JOINED --');
    for (const r of uniq.filter(r => JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | file on this PC: ${here.has(r.id) ? 'yes' : 'NO'}`);
    }
    L.push('-- Gaming programmes NOT joined (apply later WITH gaminggearworld.com, after it is live: open the link, "Join programme") --');
    for (const r of uniq.filter(r => !JOINED.test(r.membership))) {
      L.push(`  ${r.id.padEnd(7)} ${r.name.slice(0, 40).padEnd(40)} ${r.region.padEnd(4)} ${fmt(r.products).padStart(9)} products | ${r.membership || '?'} | https://ui.awin.com/merchant-profile/${r.id}`);
    }
    L.push('Note: the list match is by name only; check each profile before applying.');
  } else {
    L.push('');
    L.push('Awin feed list: not read (no saved feed key on this PC).');
  }
  L.push('');
  L.push('Note: a first sort by keywords, products counted once per retailer (same brand and name). Before any import, each retailer');
  L.push('gets its own yes/no rules and a dry-run report with samples (L14). Nothing was imported and no file was changed.');
  return { text: L.join('\n') + '\n', withSport };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const keys = [...CATEGORIES.map(c => c.key), OTHER.key];
  const rows = [['advertiser_id', 'merchant', 'products', 'gaming_products', 'gaming_in_stock', ...keys, ...ALSO_KEYS.map(k => `also_fits_${k}`), ...OVERLAP_KEYS.map(k => `other_site_${k}`)]];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.products, a.sport, a.sportInStock, ...keys.map(k => a.cats[k] || 0), ...ALSO_KEYS.map(k => a.also[k] || 0), ...OVERLAP_KEYS.map(k => a.overlaps[k] || 0)]);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = x => { const i = args.indexOf(`--${x}`); return i >= 0 ? args[i + 1] : ''; };
  const archives = String(val('archive') || '').split(';').map(s => s.trim()).filter(Boolean).map(s => resolve(s));
  const found = archives.filter(d => existsSync(d));
  if (!found.length) { console.error(`Archive folder not found: ${archives.join(' ; ') || '(none given)'}`); process.exit(2); }
  const out = resolve(val('out') || 'gaming-feed-scan');
  mkdirSync(out, { recursive: true });
  const { advs, files } = await scanArchive({ archives: found, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90).slice(0, 90)) });
  process.stdout.write('\n');
  const list = val('list') && existsSync(val('list')) ? await readList(val('list')) : null;
  const { text } = render({ advs, files, list, archives: found });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs.sort((x, y) => y.sport - x.sport)));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
