// Gaming Gear World (PGW, gaminggearworld.com): which feed products belong on this site, and in which category
// (lessons L14, L65). One set of rules for the gaming feed scan (tools/gaming-feed-scan.mjs) and the import plan
// (tools/pgw-import-plan.mjs), so the dry run sorts products exactly as the scan counted them.
//
// The owner (31 Oct 2026): consoles, gaming PCs and laptops, gaming monitors, mice and keyboards, headsets, chairs and
// desks, controllers, games and gift cards, streaming (cameras, microphones, lights) and PC components. Technology Gear
// World keeps everyday laptops, phones and office gear; the gaming products are copied here first and move from TGW
// after the holidays (owner, 31 Oct 2026).
//
// Third version (31 Oct 2026, after the second scan on the owner's PC: 21,986 matches, most of them real): console
// accessories need a console name ("Cooler Master Case TD500" is a PC case), "Handheld" in Icecat names is not a console
// ("Corsair HS80 ... Wired Handheld"), "Gaming PC Case" is a case, repair parts (BAQ, ReplaceBase), batteries "for" a
// laptop, laptop bags and backpacks stay out, and components from OEM part catalogues (Dell, HP, Lenovo PSUs and fans,
// "Replacement" fans) stay out: a component comes in only from a retail brand.
//
// How a product is classified (classify, used by tools/pgw-import-plan.mjs):
//   1. The SHOP decides first (sites/pgw/sources.json): consumer brands and folders only, as on TGW (lessons L45-L54).
//   2. NO: office and printer supplies, servers, licences, repair parts, cables, gambling, and look-alike model names.
//   3. Toys and figures (Kids' Gear World) and merchandise (clothing, mugs, posters) go to other sites.
//   4. A clear gaming name, unless the name says another category's product word ("ROG Strix Scope keyboard" is a keyboard);
//      then a game named by its platform ("Death Howl-PS5"); a console accessory with a console name; a 144 Hz+ monitor;
//      then a product word with a gaming word ("Corsair ... mouse").
//   5. No match: "not gaming".

import { fixMojibake } from '../../src/db.js';
import { cleanProductName as tgwCleanName, notUkHint as tgwNotUkHint } from '../tgw/category-rules.js';

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
  'karcher', 'kärcher', 'hockeytafel', 'baq', 'replacebase', 'redriver', 'replacement', 'compatible batter(?:y|ies)', 'batter(?:y|ies) for', 'case parts?', 'computer case part', 'hdd cages?', 'caddies', 'caddy',
  'laptop (?:bags?|backpacks?|sleeves?)', 'backpacks?', 'sleeves?', 'translator', 'translation', 'ddr[23]', 'ecc', 'rdimm', 'lrdimm', 'registered', 'fully buffered', 'thin clients?', 'workstation', 'quadro', 'tesla', 'industrial', 'lab equipment']);

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
      'xbox game ?pass(?: ultimate| core)?', 'playstation plus', 'ps plus (?:essential|extra|premium|\\d+)', 'nintendo switch online', 'amiibo',
      // Icecat names of games: "Warner Bros Mortal Kombat 11 Ultimate English Xbox One", "Outright Games ... Standard Multilingual PlayStation 4".
      '(?:standard|deluxe|ultimate|gold|collector\'?s|goty|definitive|complete|premium|special|launch)(?: edition)? (?:english|multilingual|german|french|italian|spanish|dutch|polish|portuguese|simplified chinese|traditional chinese|uk english)', 'pegi ?(?:3|7|12|16|18)']),
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
      'retroid', 'anbernic', 'ayaneo', 'evercade', 'meta quest ?\\d?', 'playstation vr ?2?', 'psvr ?2?', 'game drive(?: for (?:playstation|xbox))?', 'storage expansion cards? for xbox', 'seagate storage expansion card']),
    ctx: words(['consoles?', 'handheld (?:game |gaming )?consoles?', 'vr headsets?']),
    type: words(['consoles?(?! (?:case|cover|skin|stand|grip)s?)'])
  },
  {
    key: 'pcs-laptops', label: 'Gaming PCs & laptops',
    sure: words(['gaming (?:pcs?(?! cases?)|laptops?|notebooks?|desktops?|computers?|systems?|mini pcs?)', 'alienware (?:m\\d+|x\\d+|aurora|area|\\d{2})', 'rog (?:strix (?:g|scar)|zephyrus|flow)\\s?[a-z]?\\d', 'tuf gaming [af]\\d{2}',
      'legion (?:pro |slim |tower |t)?\\d', 'omen (?:\\d{2}|transcend|max|\\d{2}l)', 'hp victus', 'predator (?:helios|orion|triton)', 'nitro (?:v ?\\d{2}|5|1[67])', 'msi (?:katana|raider|stealth|titan|cyborg|thin gf|sword|vector|crosshair|pulse|aegis|infinite|trident|codex)',
      'razer blade', 'aorus \\d{2}', '(?:laptop|notebook|pc|desktop) (?:with )?(?:nvidia )?(?:geforce )?rtx ?\\d{4}', 'rtx ?\\d{4}(?: ti)? (?:gaming )?(?:laptop|notebook|pc|desktop)']),
    ctx: words(['laptops?', 'notebooks?', 'desktops?(?! (?:microphones?|speakers?|stands?))', 'gaming pcs?', 'mini pcs?']),
    type: words(['laptops?(?! (?:bags?|backpacks?|stands?|sleeves?|batter(?:y|ies)))', 'notebooks?', 'desktop pcs?', 'gaming pcs?(?! cases?)', 'mini pcs?'])
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
    sure: words(['gaming (?:chairs?|desks?|tables?|stools?|sofas?|beds?|bean ?bags?|recliners?|rockers?|floor chairs?|footrests?)', 'video game chairs?', 'gaming armchairs?', 'razer iskur', 'rog (?:chariot|destrier|courser)', 'racing (?:style )?(?:office |computer |gaming )?chairs?',
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
      'case fans?', 'rgb fans?', 'thermal (?:paste|compound)',
      '(?:cooler master|fractal(?: design)?|nzxt|lian li|phanteks|thermaltake|montech|jonsbo|deepcool|antec|hyte|be quiet!?|corsair|sharkoon|kolink|aerocool) (?:[a-z0-9.+-]+ ){0,3}?(?:case|chassis)']),
    ctx: null,
    type: words(['graphics cards?', 'motherboards?', 'processors?', 'cpu coolers?', 'liquid coolers?', '(?:pc|computer|atx|tower) cases?', 'power supply units?', 'psus?'])
  }
];
export const OTHER = { key: 'other-gaming', label: 'Other gaming products' };

// Products that go to another Gear World site. Checked before the gaming category, only with a gaming word.
export const OVERLAPS = [
  { key: 'kids', label: 'Toys, figures & board games (Kids\' Gear World, KGW)', re: words(['toys?', 'plush(?:ies)?', 'soft toys?', 'figures?(?! (?:8|of 8))', 'figurines?', 'funko', 'lego', 'tomy', 'hasbro', 'mattel', 'pop up pirate', 'playmobil', 'board games?',
    'card games?', 'jigsaws?', 'puzzles?', 'trading cards?', 'colouring', 'building blocks?', 'kids? (?:tablets?|smart ?watch(?:es)?|cameras?)', 'toddler', 'baby']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'chairs?', 'game ?pads?', 'amiibo']) },
  { key: 'merch', label: 'Gaming merchandise: clothing, mugs, posters, lamps (Men\'s, Women\'s, Home)', re: words(['t-?shirts?', 'tees?', 'hoodies?', 'hoody', 'sudadera', 'longsleeve', 'sweatshirts?', 'jumpers?', 'socks', 'caps?(?! for)', 'beanies?',
    'pyjamas', 'mugs?', 'drinking glasses', 'bottles?', 'posters?', 'wall art', 'canvas', 'lamps?', 'night lights?', 'bedding', 'duvet(?: covers?)?', 'cushions?', 'rugs?', 'wallets?', 'keyrings?', 'key chains?',
    'books?', 'calendars?', 'costumes?']),
    unless: words(['controllers?', 'headsets?', 'consoles?', 'keyboards?', 'mouse', 'ring lights?', 'key ?lights?', 'protective', 'thumb ?stick']) }
];
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

// A console named in the name: its accessories (cases, covers, stands, grips, chargers, cooling fans) are PGW products.
const CONSOLE_NAME = words(['ps5', 'ps4', 'playstation ?[45]?', 'dualsense', 'dualshock', 'xbox(?: series [xs]| one)?', 'nintendo switch(?: 2| oled| lite)?', 'switch (?:2|oled|lite)', 'joy-?cons?', 'steam deck', 'rog ally', 'legion go']);
const CONSOLE_ACCESSORY = words(['(?:carry(?:ing)? |travel |protective |hard ?shell |grip |silicone )?cases?', 'covers?', 'stands?', 'skins?', 'grips?', 'docks?', 'docking stations?', 'cooling fans?', 'coolers?', 'screen protectors?',
  'chargers?', 'charging (?:stations?|docks?|cables?)', 'starter kits?', 'accessor(?:y|ies) (?:kits?|packs?|bundles?)', 'storage', 'expansion cards?', 'carry bags?', 'travel bags?']);
// Components from a retail brand only (OEM part catalogues: Dell, HP and Lenovo power supplies and fans, 2-Power memory).
const OEM_PART = /^(?:dell|hp|hpe|hewlett|lenovo|fujitsu|ibm|cisco|startech(?:\.com)?|2-?power|origin storage|bti|microconnect|hypertec|axiom|v7|lindy|apc|supermicro)\b/i;

const TABLE_GAMES = /board games|poker|card games|puzzles|jigsaws|casino|party games|tabletop|dice games/i;

// The gaming classifier shared by the feed scan and the import plan. shopCat: the shop's category path (and Awin's).
//   { cat }                 a PGW product in that category
//   { overlap, cat }        a product of another Gear World site (toys and figures, merchandise)
//   { why: 'no-list' }      a product that is never PGW (office supplies, repair parts, look-alike names)
//   {}                      not gaming
export function classifyGaming(name, shopCat = '', opts = {}) {
  const n = low(name), c = low(shopCat);
  if (!n || NO.test(n)) return { why: 'no-list' };
  // Board games, poker sets and puzzles (Joybuy "Toys & Games > Games > Board Games", second scan) are not video games.
  if (TABLE_GAMES.test(c) && !CONSOLE_NAME.test(n)) return { why: 'no-list' };
  const gamingShop = GAMING_SHOP.test(c) || Boolean(opts.gamingShop);
  const ctx = GAMING_CTX.test(n) || gamingShop;
  const fastScreen = refreshHz(n) >= 144 && MONITOR.test(n) && !TV.test(n);
  if (ctx || fastScreen) {
    for (const o of OVERLAPS) {
      if (o.re.test(n) && !(o.unless && o.unless.test(n))) {
        let cat = null;
        for (const k of CATEGORIES) if (k.sure.test(n)) { cat = k.key; break; }
        return { overlap: o.key, cat };
      }
    }
  }
  const type = typeOf(n);
  let cat = null;
  // 1. A clear name, unless the name says another category's product word.
  for (const k of CATEGORIES) if (k.sure.test(n) && (!type || type === k.key)) { cat = k.key; break; }
  // 2. A game named by its platform at the end ("Death Howl-PS5").
  if (!cat && (!type || type === 'games-cards') && GAME_SUFFIX.test(n) && !NOT_GAME.test(n)) cat = 'games-cards';
  // 3. A console accessory that names its console ("Trust GXT 1253 grip case for Nintendo Switch 2").
  if (!cat && (!type || type === 'consoles') && CONSOLE_NAME.test(n) && CONSOLE_ACCESSORY.test(n)) cat = 'consoles';
  // 4. A fast monitor (144 Hz and more).
  if (!cat && fastScreen) cat = 'monitors';
  // 5. The product word, with a gaming word ("Corsair ... mouse", "Turtle Beach ... headset").
  if (!cat && ctx && type) cat = type;
  if (!cat && ctx) for (const k of CATEGORIES) if (k.ctx && k.ctx.test(n)) { cat = k.key; break; }
  if (!cat && gamingShop && GAMING_CTX.test(n)) cat = OTHER.key;
  if (!cat) return {};
  if (cat === 'monitors' && TV.test(n)) return {};
  if (cat === 'components' && OEM_PART.test(String(name || '').trim())) return { why: 'no-list' };
  return { cat };
}

// ---------- The import plan's interface (tools/tgw-import-plan.mjs planImport) ----------

export const CATEGORY_SLUGS = CATEGORIES.map(k => k.key);

export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 8000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

const OVERLAP_REASON = { kids: 'toy or figure (Kids\' Gear World)', merch: 'clothing, mug or poster (Men\'s / Women\'s / Home Gear World)' };

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// name: product name; feedCategory: the shop's category; paths: the shop's category path; source: its sources.json entry.
export function classify(name, feedCategory = '', paths = '', source = null) {
  const shopCat = [feedCategory, paths].filter(Boolean).join(' | ');
  const r = classifyGaming(name, shopCat, { gamingShop: Boolean(source && source.gamingShop) });
  if (r.cat && !r.overlap) {
    if (r.cat === OTHER.key) return { ok: false, reason: 'gaming, but no PGW category' };
    return { ok: true, slug: r.cat };
  }
  if (r.overlap) return { ok: false, reason: OVERLAP_REASON[r.overlap] || 'another Gear World site' };
  if (r.why === 'no-list') return { ok: false, reason: 'office, parts, cables or look-alike name (not gaming)' };
  return { ok: false, reason: 'not gaming' };
}

// The same name cleaning and "not for the UK" hints as Technology Gear World (the same shops).
export function cleanProductName(name) {
  return tgwCleanName(fixMojibake(String(name || '')));
}
export const notUkHint = tgwNotUkHint;
