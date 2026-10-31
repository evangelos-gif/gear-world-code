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

// Second version (31 Oct 2026, after the first scan on the owner's PC): the first rules took the shop category
// "PC Components" and "Peripherals" as a gaming word, so printer rollers, barcode readers and power cords of the
// wholesale catalogue (PCHUB, PcNova, GamingKit) were counted; and model names alone ("Huntsman", "Barracuda", "K100",
// "Gold Edition", "Cockpit") matched knives, saws, drills, riveters and car sprays. Now: a model name counts only with
// its brand, generic words only with a real gaming word, and the shop category counts only when it says gaming.

// Words that say "this is for gaming". Not "switch" alone (network and light switches), "steam" (cleaners), "rgb"
// (lamps), "legion", "omen", "predator", "astro" or "shark" alone (other things), "games" alone ("Toys & Games").
export const GAMING_CTX = words(['gaming', 'gamers?', "gamer's", 'e-?sports?', 'playstation(?: ?[45])?', 'ps[345]', 'xbox(?: series [xs]| one)?', 'nintendo(?: switch(?: 2| oled| lite)?)?',
  'switch (?:2|oled|lite)', 'steam deck', 'razer', 'steelseries', 'hyperx', 'corsair', 'logitech g(?: ?pro|\\d{3})?', 'roccat', 'turtle beach', 'alienware', 'asus rog', 'rog (?:strix|zephyrus|flow|ally|swift|azoth|harpe|gladius|keris|delta|cetra|falchion|claymore)',
  'tuf gaming', 'lenovo legion', 'hp omen', 'acer predator', 'acer nitro', 'gravastar', 'elgato', 'secretlab', 'noblechairs', '8bitdo', 'thrustmaster', 'fanatec', 'nacon', 'powera', 'astro a\\d{2}',
  'glorious', 'endgame gear', 'zowie', 'cooler master', 'nzxt', 'trust gxt', 'arozzi', 'dxracer', 'gtplayer', 'gtracing', 'live ?stream(?:ing|ers?)?', 'streamers?', 'twitch', 'podcast(?:ing|ers?)?', 'content creators?',
  'dualsense', 'dualshock', 'joy-?cons?', 'game ?pads?', 'fps', 'mmo', 'rpg']);
// A shop category that says gaming. Not "PC Components", "Peripherals" or "Computers" (whole wholesale catalogues).
export const GAMING_SHOP = words(['gaming', 'gamers?', 'video ?games?', 'video game (?:software|consoles?|accessories)', 'pc games?', 'console games?', 'games consoles?', 'game consoles?', 'e-?sports?',
  'playstation', 'xbox', 'nintendo']);

// Not gaming products, even with a gaming word (L42, L63, L64): office and printer supplies, servers, licences and
// services, repair parts, cables and adapters, tools and other things that share a model name, and gambling.
export const NO = words(['toners?', 'ink(?: cartridges?)?', 'toner cartridges?', 'drum units?', 'fusers?', 'fusing', 'ribbons?', 'rollers?', 'staples', 'labels?', 'bar ?code', 'barcode', 'printers?', 'scanners?',
  'printer/scanner', 'spare parts?', 'pos', 'receipt', 'xeon', 'epyc', 'servers?', 'rack ?mount(?:ed)?', 'racks?', 'raid', 'sas', 'nas', 'san', 'hba', 'warrant(?:y|ies)', 'care ?packs?', 'support services?',
  'extended service', 'licen[cs]es?', 'office 365', 'microsoft 365', 'csp', 'eos \\d', 'end of sale', 'replacement (?:keyboards?|screens?|batter(?:y|ies)|fans?|hinges?|lcd|panels?|parts?)',
  'laptop (?:batter(?:y|ies)|hinges?|lcd)', 'kbd belg', 'replaces', 'compatible (?:with|replacement)', 'oem', 'cables?', 'cords?', 'leads?', 'adapt[oe]rs?', 'converters?', 'splitters?', 'extenders?',
  'wall plates?', 'faceplates? (?!for (?:ps5|xbox|switch))', 'patch panels?', 'kvm', 'conference', 'conferencing', 'meeting rooms?', 'business (?:webcams?|headsets?)', 'call cent(?:er|re)',
  'casino', 'bingo', 'poker', 'slots?', 'betting', 'lottery', 'lotto', 'gambling', 'free gift only', 'die ?cast', 'scale models?', 'greeting cards?', 'birthday cards?', 'phone cases?', 'iphone', 'back glass',
  'cufflinks?', 'knives', 'knife', 'swiss army', 'umbrellas?', 'sunglasses', 'saws?', 'drills?', 'drill sets?', 'riveters?', 'rivet', 'sprays?', 'cleaning', 'cleaners?', 'polish', 'shears', 'hedge', 'swim',
  'squishy', 'hockey', 'golf', 'utv', 'sewer', 'rioolcamera', 'inspection cameras?', 'light switch(?:es)?', 'plate/switch covers?', '(?:wall|light) switch covers?', 'perfumes?', 'eau de', 'travel case gold', 'festool', 'bahco', 'gesipa', 'fiskars', 'victorinox',
  'karcher', 'kärcher', 'ddr[23]', 'ecc', 'rdimm', 'lrdimm', 'registered', 'fully buffered', 'thin clients?', 'workstation', 'quadro', 'tesla', 'industrial', 'lab equipment']);

// Monitor refresh rate: 144 Hz and more is a gaming screen (the TGW rules use 170 Hz for TVs; monitors start lower).
export function refreshHz(name) {
  let best = 0;
  for (const m of String(name || '').matchAll(/(\d{2,3})\s?hz/gi)) best = Math.max(best, Number(m[1]));
  return best;
}
const MONITOR = words(['monitors?', 'gaming displays?', 'lcd monitors?', 'led monitors?', 'oled monitors?']);
const TV = words(['tvs?', 'televisions?', 'smart tv', 'projectors?']);

// Proposed PGW categories. Every category has:
//   sure  - a name that is always this kind of gaming product ("gaming mouse", "DualSense", "Razer DeathAdder");
//   ctx   - a product word that counts only with a gaming word ("mouse" in "Corsair ... mouse");
//   type  - the product word itself: a product whose name says another category's type is not this one
//           ("ASUS ROG Strix Scope II keyboard" is a keyboard, not a laptop, even though "ROG Strix" is a laptop name).
// First match wins. Games and gift cards come first ("Mario Kart World (Nintendo Switch 2)" is a game, not a console);
// controllers come before consoles ("Nintendo Switch Pro Controller").
export const CATEGORIES = [
  {
    key: 'games-cards', label: 'Games & gift cards',
    sure: words(['(?:ps5|ps4|playstation ?[45]|xbox(?: series [xs]| one)?|nintendo switch(?: 2)?|switch 2|pc) (?:video )?games?(?! (?:drives?|consoles?|controllers?|chairs?|desks?|headsets?|mouse|keyboards?|monitors?|laptops?|pcs?))',
      'video games?(?! (?:chairs?|consoles?|controllers?|accessories))', '(?:-|–|\\(|for )\\s?(?:ps5|ps4|xbox series x\\|?s?|xbox one|nintendo switch 2?|switch 2?)\\)?$',
      '(?:psn|playstation|playstation store|xbox|nintendo eshop|eshop|steam|roblox|fortnite|ea ?play) (?:gift |wallet |store )?(?:cards?|credit|vouchers?|codes?|top-?ups?)', 'v-?bucks', 'robux',
      'xbox game ?pass(?: ultimate| core)?', 'playstation plus', 'ps plus', 'nintendo switch online', 'pegi ?(?:3|7|12|16|18)']),
    ctx: words(['games?', 'gift cards?', '(?:standard|deluxe|gold|ultimate|collector\'?s|game of the year|goty|day one|launch) edition']),
    type: words(['video games?(?! (?:chairs?|consoles?|controllers?|accessories|drives?))', 'gift cards?', 'game ?pass'])
  },
  {
    key: 'controllers', label: 'Controllers, wheels & sticks',
    sure: words(['game ?pads?', 'game controllers?', 'gaming controllers?', '(?:ps5|ps4|playstation|xbox|switch|nintendo switch|pc|wireless|wired) (?:pro )?controllers?(?! cards?)', 'pro controllers?', 'dualsense(?: edge)?', 'dualshock',
      'joy-?cons?', 'racing wheels?', 'sim racing', 'racing simulators?', 'flight sticks?', 'hotas', 'arcade sticks?', 'fight ?sticks?', 'thrustmaster', 'fanatec', '8bitdo', 'razer (?:wolverine|kishi|raiju)',
      'controller (?:charging (?:stations?|docks?)|chargers?|grips?|skins?|thumb ?grips?|paddles?)', 'charging (?:stations?|docks?) for (?:ps5|dualsense|xbox|controllers?)', 'thumb ?grips? for']),
    ctx: words(['controllers?', '(?:steering )?wheels?', 'pedals?', 'joysticks?', 'paddles?', 'shifters?']),
    type: words(['controllers?(?! cards?)', 'gamepads?', 'game ?pads?', 'joysticks?', 'racing wheels?'])
  },
  {
    key: 'consoles', label: 'Consoles & handhelds',
    sure: words(['(?:ps5|ps4|playstation ?5|playstation ?4) (?:pro |slim |digital (?:edition )?)?(?:consoles?|bundles?|slim|pro|digital edition)', 'playstation 5 console', 'xbox series [xs](?: console| bundle)?',
      'xbox one (?:s|x)(?: console)?', 'nintendo switch(?: 2| oled| lite)? (?:console|bundle|oled model)', 'switch (?:2|oled|lite) (?:console|bundle)', 'nintendo switch lite', 'steam deck(?: oled| lcd)?', 'rog ally(?: x)?',
      'lenovo legion go(?: s)?', 'legion go(?: s)?', 'msi claw', 'playstation portal', 'retro (?:game )?consoles?', 'game consoles?', 'games consoles?', '(?:portable|handheld|hand held) (?:game |gaming )?consoles?',
      'retroid', 'anbernic', 'ayaneo', 'evercade', 'meta quest ?\\d?', 'playstation vr ?2?', 'psvr ?2?', 'game drive for (?:playstation|xbox)']),
    ctx: words(['consoles?', 'handhelds?', 'docks?', 'vr headsets?', '(?:carry |travel |protective )?cases?', 'covers?', 'stands?', 'skins?', 'cooling fans?', 'screen protectors?', 'chargers?', 'storage', 'expansion cards?']),
    type: words(['consoles?', 'handhelds?'])
  },
  {
    key: 'pcs-laptops', label: 'Gaming PCs & laptops',
    sure: words(['gaming (?:pcs?|laptops?|notebooks?|desktops?|computers?|systems?|mini pcs?)', 'alienware (?:m\\d+|x\\d+|aurora|area|\\d{2})', 'rog (?:strix (?:g|scar)|zephyrus|flow)\\s?[a-z]?\\d', 'tuf gaming [af]\\d{2}',
      'legion (?:pro |slim |tower |t)?\\d', 'omen (?:\\d{2}|transcend|max|\\d{2}l)', 'hp victus', 'predator (?:helios|orion|triton)', 'nitro (?:v ?\\d{2}|5|1[67])', 'msi (?:katana|raider|stealth|titan|cyborg|thin gf|sword|vector|crosshair|pulse|aegis|infinite|trident|codex)',
      'razer blade', 'aorus \\d{2}', '(?:laptop|notebook|pc|desktop) (?:with )?(?:nvidia )?(?:geforce )?rtx ?\\d{4}', 'rtx ?\\d{4}(?: ti)? (?:gaming )?(?:laptop|notebook|pc|desktop)']),
    ctx: words(['laptops?', 'notebooks?', 'desktops?(?! (?:microphones?|speakers?|stands?))', 'gaming pcs?', 'mini pcs?']),
    type: words(['laptops?', 'notebooks?', 'desktop pcs?', 'gaming pcs?', 'mini pcs?'])
  },
  {
    key: 'monitors', label: 'Gaming monitors',
    sure: words(['gaming monitors?', 'odyssey (?:g|oled g|ark)\\s?\\d*', 'ultragear', 'rog swift', 'rog strix xg\\d+', 'acer predator (?:x|xb|xv)\\d+', 'acer nitro (?:xv|vg|xz|kg)\\d+', 'alienware aw\\d+',
      'msi (?:mag|mpg|g)\\s?\\d{3}[a-z]*', 'aoc agon', 'zowie xl\\d+', 'benq mobiuz']),
    ctx: words(['monitors?']),
    type: words(['monitors?'])
  },
  {
    key: 'mice-keyboards', label: 'Mice, keyboards & mouse pads',
    sure: words(['gaming (?:mouse|mice|keyboards?|keypads?|mouse ?pads?|mouse ?mats?|desk ?mats?|keyboard and mouse(?: combo| set)?)', 'mechanical gaming keyboards?', 'keycaps?(?: sets?)?', 'hot-?swap(?:pable)? keyboards?', 'magnetic switch keyboards?',
      'razer (?:deathadder|viper|basilisk|naga|huntsman|blackwidow|ornata|cynosa|orochi|cobra|pro click|gigantus|goliathus|strider)', 'logitech g ?(?:pro x|pro|50[2-9]|30[3-5]|203|915|815|715|713|213|413|512|613|703|903|705|309|240|440|640)',
      'steelseries (?:apex|rival|aerox|prime|sensei|qck)', 'corsair (?:k\\d{2,3}|m\\d{2}|dark core|harpoon|ironclaw|scimitar|katar|sabre|nightsabre|mm\\d{3})', 'hyperx (?:pulsefire|alloy)', 'glorious (?:model|gmmk)',
      'wooting', 'ducky (?:one|shine)', 'keychron', 'gravastar mercury', 'royalaxe', 'roccat (?:kone|vulcan|burst|pyro)', 'asus rog (?:azoth|harpe|gladius|keris|falchion|claymore|strix scope|strix impact|spatha)']),
    ctx: words(['mouse', 'mice', 'keyboards?', 'keypads?', 'mouse ?pads?', 'mouse ?mats?', 'desk ?mats?', 'wrist rests?', 'mouse bungees?']),
    type: words(['mouse', 'mice', 'keyboards?', 'keypads?', 'mouse ?pads?', 'mouse ?mats?'])
  },
  {
    key: 'headsets', label: 'Headsets & gaming audio',
    sure: words(['gaming (?:headsets?|headphones?|earbuds?|earphones?|speakers?|soundbars?|sound ?bars?)', 'steelseries arctis', 'arctis nova', 'razer (?:kraken|barracuda|blackshark|nari|hammerhead)', 'hyperx cloud',
      'turtle beach', 'astro a\\d{2}', 'corsair (?:virtuoso|hs\\d{2}|void)', 'logitech g ?(?:pro x headset|435|535|733|335|935)', 'pulse (?:3d|elite|explore)', 'playstation pulse', '(?:ps5|ps4|xbox|playstation) (?:headsets?|earbuds?|headphones?)',
      'headset (?:stands?|holders?|hangers?)']),
    ctx: words(['headsets?', 'headphones?', 'earbuds?', 'earphones?', 'speakers?', 'sound ?bars?', 'dacs?']),
    type: words(['headsets?', 'headphones?', 'earbuds?', 'earphones?'])
  },
  {
    key: 'chairs-desks', label: 'Gaming chairs & desks',
    sure: words(['gaming (?:chairs?|desks?|tables?|stools?|sofas?|beds?|bean ?bags?|recliners?|rockers?|floor chairs?|footrests?)', 'video game chairs?', 'racing (?:style )?(?:office |computer |gaming )?chairs?',
      'secretlab', 'noblechairs', 'dxracer', 'gtplayer', 'gtracing', 'vertagear', 'andaseat', 'akracing', 'corsair tc\\d+', 'arozzi (?:arena|verona|torretta|vernazza)', 'l-?shaped gaming desks?', 'e-?sports chairs?',
      'racing (?:sim |simulator )?(?:seats?|rigs?|cockpits?)', 'racing cockpits?', 'sim rigs?', 'wheel stands?', 'stuurwielstandaard', 'racesimulator']),
    ctx: words(['chairs?', 'desks?', 'stools?', 'footrests?']),
    type: words(['chairs?', 'desks?'])
  },
  {
    key: 'streaming', label: 'Streaming: cameras, microphones & lights',
    sure: words(['stream ?decks?', 'capture cards?', 'game capture', 'elgato', 'key ?lights?', 'ring lights?', 'green ?screens?', 'streaming (?:kits?|lights?|cameras?|microphones?|mics?|bundles?|webcams?)', 'streamer (?:kits?|bundles?)',
      '(?:usb|streaming|podcast|podcasting|condenser|xlr|gaming) (?:microphones?|mics?)', 'shure (?:mv7|sm7b)', 'rode (?:podmic|nt-?usb|psa1|procaster)', 'blue yeti', 'yeti (?:x|nano|gx)', 'hyperx (?:quadcast|solocast|duocast)',
      'razer (?:kiyo|seiren)', 'facecam', 'mic (?:arms?|stands?|booms?)', 'microphone (?:arms?|stands?|booms?)', 'go ?xlr', 'wave ?xlr', 'rodecaster', 'live ?streaming (?:cameras?|webcams?|microphones?|mics?|lights?)']),
    ctx: words(['microphones?', 'mics?', 'webcams?', 'web cams?', 'cameras?', '(?:led |video )?lights?', 'light ?panels?', 'pop filters?', 'boom arms?', 'audio interfaces?']),
    type: words(['microphones?', 'webcams?', 'web cams?', 'capture cards?', 'ring lights?', 'key ?lights?'])
  },
  {
    key: 'components', label: 'PC components',
    sure: words(['graphics cards?', 'video cards?', '(?:geforce|nvidia) (?:rtx|gtx) ?\\d{3,4}(?: ti| super)?', 'geforce rtx', 'radeon (?:rx ?)?\\d{3,4}(?: xt| xtx)?', 'radeon rx', 'intel arc [ab]\\d{3}',
      'ryzen [3579] \\d{4}[a-z]{0,3}', 'ryzen threadripper', 'core (?:i[3579]|ultra [579])[ -]\\d{4,5}[a-z]{0,3} (?:processor|cpu|desktop|boxed|box|tray)', '(?:processor|cpu) (?:amd|intel)',
      '(?:am[45]|lga ?1[78]\\d{2}|socket am[45]|[abxz][4-9]\\d0e?) (?:atx|matx|micro ?atx|mini ?itx|e-?atx)', 'ddr[45](?:-?\\d{4})? (?:ram|memory|desktop memory|kits?|\\d+ ?gb)', '\\d+ ?gb (?:\\(\\d ?x ?\\d+ ?gb\\) )?ddr[45]',
      '(?:nvme|m\\.2|pcie (?:gen ?)?[345]\\.0) (?:ssds?|solid state drives?)', 'cpu coolers?', 'cpu (?:air|liquid) coolers?', '(?:aio|all-?in-?one) (?:liquid |water )?(?:cpu )?coolers?', 'liquid coolers?', 'pc cases?', 'computer cases?',
      '(?:atx|micro ?atx|mini ?itx) (?:pc )?cases?', '(?:midi|mid|full)[- ]?tower(?: cases?| (?:black|white|grey))?', 'gaming(?:-| )behuizing', 'power supply units?', '\\d{3,4} ?w (?:atx )?(?:psu|power supply)', '\\d{3,4} ?w 80\\+',
      'case fans?', 'rgb fans?', 'thermal (?:paste|compound)']),
    ctx: null,
    type: words(['graphics cards?', 'motherboards?', 'processors?', 'cpu coolers?', 'liquid coolers?', '(?:pc|computer|atx|tower) cases?', 'power supply units?', 'psus?'])
  }
];
export const OTHER = { key: 'other-gaming', label: 'Other gaming products' };

// Products that go to another Gear World site. Checked before the gaming category, only with a gaming word.
export const OVERLAPS = [
  { key: 'kids', label: 'Toys, figures & board games (Kids\' Gear World, KGW)', re: words(['toys?', 'plush(?:ies)?', 'soft toys?', 'figures?(?! (?:8|of 8))', 'figurines?', 'funko', 'amiibo', 'lego', 'playmobil', 'board games?',
    'card games?', 'jigsaws?', 'puzzles?', 'trading cards?', 'colouring', 'building blocks?', 'kids? (?:tablets?|smart ?watch(?:es)?|cameras?)', 'toddler', 'baby']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'chairs?', 'game ?pads?']) },
  { key: 'merch', label: 'Gaming merchandise: clothing, mugs, posters, lamps (Men\'s, Women\'s, Home)', re: words(['t-?shirts?', 'tees?', 'hoodies?', 'hoody', 'sudadera', 'longsleeve', 'sweatshirts?', 'jumpers?', 'socks', 'caps?(?! for)', 'beanies?',
    'pyjamas', 'mugs?', 'drinking glasses', 'bottles?', 'posters?', 'wall art', 'canvas', 'lamps?', 'night lights?', 'bedding', 'duvet(?: covers?)?', 'cushions?', 'rugs?', 'wallets?', 'keyrings?', 'key chains?',
    'books?', 'calendars?', 'costumes?']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'keyboards?', 'mouse', 'ring lights?', 'key ?lights?', 'protective', 'thumb ?stick']) }
];
// Checked with the real TGW rules, only for products that matched a PGW category: these are the TGW/PGW boundary.
export const SITE_RULES = [
  { key: 'tgw', label: 'Also matches the Technology Gear World rules (TGW)', rules: TGW_RULES }
];
const OVERLAP_KEYS = OVERLAPS.map(o => o.key);
const ALSO_KEYS = SITE_RULES.map(s => s.key);
const overlapLabel = k => (OVERLAPS.find(o => o.key === k) || SITE_RULES.find(s => s.key === k) || { label: k }).label;

// Words in a programme's name that point to a gaming retailer (for the Awin list).
export const PROGRAMME_WORDS = words(['gaming', 'gamers?', 'video ?games?', 'consoles?', 'e-?sports?', 'playstation', 'xbox', 'nintendo', 'scan computers', 'overclockers', 'box\\.co\\.uk', 'laptops direct', 'ebuyer', 'currys',
  'cdkeys', 'cd keys', 'zavvi', 'game collection', 'shopto', 'razer', 'steelseries', 'corsair', 'logitech', 'hyperx', 'turtle beach', 'secretlab', 'noblechairs', 'elgato', '8bitdo', 'alienware', 'msi', 'asus', 'acer',
  'lenovo', 'chillblast', 'pc ?specialist', 'cyberpower', 'novatech', 'ccl', 'gamingkit', 'pc ?nova', 'pc ?hub', 'back ?market', 'music ?magpie', 'cex', 'green man', 'humble', 'fanatical', 'eneba', 'gamivo', 'kinguin',
  'thrustmaster', 'fanatec', 'nacon', 'gtplayer', 'dxracer', 'andaseat']);
// Programmes that are gambling, finance, subscriptions or services, not products: left out of the list.
export const PROGRAMME_NO = words(['casino', 'bingo', 'poker', 'slots?', 'bet\\d*', 'betting', 'bets', 'betway', 'betfair', 'betfred', 'paddy ?power', 'william hill', 'ladbrokes',
  'coral', 'sky (?:vegas|bet|casino|poker)', 'grosvenor', 'mecca', 'unibet', 'jackpotjoy', '888', 'virgin games', 'tombola', 'gala', 'jackpot', 'spins?', 'sportsbook', 'lottery', 'lotto', 'gambling', 'insurance', 'loans?', 'finance', 'credit',
  'broadband', 'mobile (?:plans?|contracts?|sim)', 'sim only', 'vpn', 'dating', 'hosting', 'courses?', 'training', 'tickets?', 'events?', 'magazines?', 'hotels?', 'holidays?', 'lingerie', 'fashion', '4x4', 'tyres?', 'motor']);

export function isGamingProgramme(name, vertical = '') {
  const t = String(name || '');
  if (PROGRAMME_NO.test(t)) return false;
  return PROGRAMME_WORDS.test(t) || /video ?games/i.test(String(vertical || ''));
}

// A game named by its platform at the end: "Death Howl-PS5", "NBA 2K21 Standard Xbox One", "... (Nintendo Switch 2)".
export const GAME_SUFFIX = /(?:\s-\s?|[a-z0-9]-|\s–\s|\(|\bfor\s|\b(?:standard|deluxe|gold|ultimate|collector'?s|goty|day one)(?: edition)?\s)(?:ps5|ps4|playstation [45]|xbox series x(?:\|s|\/s)?|xbox one|nintendo switch(?: 2)?|switch(?: 2)?)\)?\s*$/i;

const low = s => String(s || '').toLowerCase().replace(/&amp;/g, ' and ').replace(/&/g, ' and ').replace(/[’`]/g, "'").replace(/[™®]/g, ' ').replace(/[ \s]+/g, ' ').trim();

// Accessories named "... for PS5" are not games.
const NOT_GAME = words(['cases?', 'covers?', 'stands?', 'grips?', 'chargers?', 'charging', 'docks?', 'skins?', 'protectors?', 'cables?', 'bags?', 'caps', 'fans?', 'drives?', 'ssds?', 'storage', 'mounts?', 'holders?', 'controllers?', 'headsets?']);

// The category whose product word the name says (e.g. "keyboard"), or null.
function typeOf(n) {
  for (const k of CATEGORIES) if (k.type && k.type.test(n)) return k.key;
  return null;
}

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
  const fastScreen = refreshHz(n) >= 144 && MONITOR.test(n) && !TV.test(n);
  if (ctx || fastScreen) {
    for (const o of OVERLAPS) {
      if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
        let cat = null;
        for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
        return { sport: false, overlap: o.key, cat };
      }
    }
  }
  const type = typeOf(n);
  // 1. A clear name, unless the name says another category's product word.
  let cat = null;
  for (const k of CATEGORIES) if (k.sure.test(n) && (!type || type === k.key)) { cat = k.key; break; }
  if (!cat && (!type || type === 'games-cards') && GAME_SUFFIX.test(n) && !NOT_GAME.test(n)) cat = 'games-cards';
  // 2. A fast monitor (144 Hz and more).
  if (!cat && fastScreen) cat = 'monitors';
  // 3. The product word, with a gaming word ("Corsair ... mouse", "Turtle Beach ... headset").
  if (!cat && ctx && type) cat = type;
  if (!cat && ctx) for (const k of CATEGORIES) if (k.ctx && k.ctx.test(n)) { cat = k.key; break; }
  if (!cat && gamingShop && GAMING_CTX.test(n)) cat = OTHER.key;
  if (!cat) return { sport: false };
  if (cat === 'monitors' && TV.test(n)) return { sport: false };
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
  if (withSport.some(a => [124146, 125822].includes(a.advertiserId))) L.push('Note: PcNova (125822) and GamingKit (124146) send the same wholesale catalogue as PCHUB.UK (126641), lessons L63: the same products are counted up to three times.');
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
