// Technology Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by the import tool):
//   1. The feed's top category (the part before the first ">") is checked first:
//      DENY_TOP rejects whole areas (food, clothing, beauty, vehicles, tools ...);
//      ONLY_TOP lets some areas in only for one category (e.g. "Toys & Games" only for gaming).
//   2. DENY rules are checked on the PRODUCT NAME only (not the feed category, which can be wrong:
//      Joybuy files smartwatches under "Electronics > Computers > Smart Glasses").
//   3. Then the FIRST rule whose `include` matches (name + feed categories) and whose `exclude` does not
//      match wins. Several rules can lead to the same category. Order matters.
//   4. No match: rejected as "not tech" (shown separately when the feed itself says Electronics,
//      so missing rules are easy to spot in the report).
// Tuned on the real Joybuy UK feed (dry-run report of 18 Oct 2026).

const words = list => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

// Top-level feed categories that never belong on TGW.
export const DENY_TOP = [
  'Health & Beauty', 'Food, Beverages & Tobacco', 'Apparel & Accessories', 'Vehicles & Parts', 'Furniture',
  'Animals & Pet Supplies', 'Hardware', 'Baby & Toddler', 'Luggage & Bags', 'Mature', 'Religious & Ceremonial',
  'Arts & Entertainment', 'Business & Industrial'
];

// Top-level feed categories that may only feed ONE TGW category (anything else from them is rejected).
export const ONLY_TOP = {
  'Toys & Games': ['gaming'],
  'Home & Garden': ['smart-home-wifi'],
  'Office Supplies': ['laptops-computing'],
  // e.g. a rowing machine "with LCD monitor" must not become a computer monitor
  'Sporting Goods': ['phones-smartwatches', 'audio', 'cameras-drones', 'accessories-storage']
};

// `except`: names that look like the word list but are tech (Back to the Office dry run, 23 Oct 2026): "ARCTIC Freezer 36
// ... Tower CPU Cooler" is a PC part, not a freezer; "ASUS Fragrance MD101 mouse" is a mouse.
export const DENY = [
  { label: 'woodworking or power tool', re: words(['wood router', 'plunge router', 'trim router', 'palm router', 'router bits?', 'router table', 'drill bits?', 'jigsaw', 'circular saw', 'angle grinder', 'sander', 'planer', 'chisel', 'welding', 'welder', 'impact driver', 'combi drill', 'drill driver', 'screwdrivers?']) },
  { label: 'vehicle part', re: words(['brake pads?', 'brake discs?', 'wiper blades?', 'windscreen wipers?', 'spark plugs?', 'tyres?', 'tire inflator', 'alloy wheels?', 'oil filter', 'headlight bulbs?', 'car seat covers?', 'car covers?', 'tow bar', 'roof rack', 'jump starter', 'motorcycle helmet']) },
  { label: 'clothing or beauty', re: words(['t-shirt', 'hoodie', 'dress', 'jacket', 'trousers', 'leggings', 'socks', 'shoes', 'trainers', 'lingerie', 'perfume', 'fragrance', 'lipstick', 'mascara', 'nail polish', 'wig', 'hair extensions?']),
    except: words(['mouse', 'mice', 'keyboards?']) },
  { label: 'personal care', re: words(['shavers?', 'epilators?', 'toothbrush(?:es)?', 'water flossers?', 'hair dryers?', 'straighteners?', 'massagers?']) },
  { label: 'not allowed', re: words(['vape', 'e-?cig(?:arette)?s?', 'airsoft', 'knife', 'knives', 'crossbow', 'erotic', 'spy camera', 'hidden camera']) },
  { label: 'sunglasses (not tech)', re: words(['sunglasses', 'cycling glasses']) },
  { label: 'home appliance (Home Gear World)', re: words(['robot vacuums?', 'robot hoovers?', 'vacuum cleaners?', 'stick vacuum', 'fridge', 'freezer', 'kettle', 'toaster', 'air fryer', 'microwave', 'dehumidifier', 'heater', 'pedestal fan', 'tower fan', 'tumble dryers?', 'washing machines?', 'washer dryers?', 'dishwashers?', 'ovens?', 'hobs?', 'cooker hoods?', 'air conditioners?', 'ice makers?']),
    // "ARCTIC Freezer P12 Pro - 120 mm PWM Fan" (second dry run, 24 Oct 2026) is a PC fan too.
    except: words(['cpu', 'pwm', 'a-?rgb']) },
  { label: 'spare part or service', re: words(['replacement part', 'spare part', 'repair kit', 'warranty extension', 'service plan', 'gift card', 'voucher']) },
  { label: 'consumable, not a gadget', re: words(['a{2,4} batteries', '(?:alkaline|lithium|rechargeable) batteries', 'batteries - (?:pack|value pack)', 'copier paper', 'printer paper', 'label paper', 'thermal paper', 'cleaning brush']) },
  { label: 'toy, not a gadget', re: words(['toy drones?', 'stunt (?:\\w+ )?drones?', 'kids drones?', 'jigsaw puzzles?', 'piggy bank', 'ride on car', 'ball machine']) }
];

// Several rules can lead to the same category; the first match wins. Accessories come first so
// "iPhone 15 case" is an accessory, and storage comes last so "laptop 512GB SSD" stays a laptop.
export const RULES = [
  {
    slug: 'accessories-storage',
    include: words([
      '(?:iphone|phone|galaxy|pixel|ipad|tablet|kindle|airpods|earbuds|watch|camera|laptop|macbook|switch)\\b[\\w\\s/()-]{0,40}?\\b(?:case|cover|folio|sleeve|skin|protector)s?',
      'chargers?', 'charging (?:cable|station|dock|pad|stand|holder)s?', 'wireless charg(?:er|ing)', 'fast charg(?:er|ing)', 'magsafe',
      'power ?banks?', 'usb-?c (?:cable|hub|adapter|charger)s?', 'lightning cables?', 'hdmi cables?', 'cables?',
      'phone cases?', 'tablet cases?', 'ipad cases?', 'screen protectors?', 'lens protectors?', 'camera protectors?', 'tempered glass',
      'phone (?:holder|mount|stand|grip|pouch|bag)s?', 'laptop (?:bag|sleeve|stand)s?', 'usb hubs?', 'docking stations?',
      '(?:watch|sport|silicone|nylon|leather|milanese|loop|solo) (?:bands?|straps?)', 'watch straps?', 'replacement bands?',
      'phone cool(?:er|ing)', 'cooling fan for (?:phone|mobile|live streaming)', 'live streaming cooler',
      'phone lanyards?', 'lanyards?', 'apple pencil', 'stylus(?:es)?', 'i?watch (?:bands?|straps?)', 'airtags?', 'anti-lost', 'find my',
      // PCHUB.UK (24 Oct 2026): "Apple MQEH3ZM/A Smart Wearable Accessories Band" in "smartwatch accessories" is a band, not a
      // watch; "DELL EURO Simple E-Port II Docking" in "Docks & Port Replicators" is a dock (a games console dock stays gaming).
      'smartwatch accessories', 'smart wearable accessories', 'docking', 'port replicators?',
      // TGW dry run with PCHUB.UK (24 Oct 2026): "Belkin F7U017bt Passive holder Mobile phone/Smartphone", "Kensington Car Mount
      // for Smartphones", "Belkin Boost Charge Smartphone Black Cigar lighter Auto", "InvisibleShield Glass Elite Apple iPhone 17e"
      // are phone accessories, not phones.
      'passive holders?', '(?:car|phone|smartphone|mobile) (?:mounts?|holders?)', 'mounts? for (?:smart)?phones?', 'cigar lighter', 'car chargers?',
      'invisibleshield', 'glass elite', 'screen ?guards?'
    ]),
    // Watch listings say "Aluminium Case with Sport Band" and "GPS": those are watches, not accessories.
    exclude: words(['ev charger', 'car battery charger', 'trickle charger', 'pencil case', 'suitcase', 'briefcase', 'smart tv', 'televisions?', 'gps', '(?:aluminium|aluminum|titanium|stainless steel) case', 'bicycle parts', '(?:brake|gear) cables?',
      'pwm'])
  },
  {
    slug: 'gaming',
    // "switch 2" is the Nintendo Switch 2, not a "Smart Light Switch 2-Gang".
    include: words([
      'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch 2(?!-)', 'switch oled', 'steam deck', 'video games?',
      'gaming (?:headset|keyboard|mouse|mice|chair|desk|monitor|controller|pc|laptop|console)s?', 'game ?pads?', 'game controllers?',
      'controllers?', 'joysticks?', 'racing wheel', 'vr headset', 'meta quest'
    ]),
    exclude: words(['board game', 'card game', 'jigsaw puzzle', 'smart tv', 'televisions?', 'google tv', 'oled tv', 'qled', '\\d{2}["”] (?:bravia|4k)'])
  },
  {
    slug: 'smart-home-wifi',
    include: words(['smart [\\w\\s-]{0,20}?(?:lights?|strips?|bulbs?|plugs?|keyfobs?|locks?)'])
  },
  {
    slug: 'phones-smartwatches',
    include: words([
      'smartphones?', 'mobile phones?', 'iphone', 'galaxy [asz]\\d+', 'galaxy z (?:fold|flip)', 'pixel \\d+', 'oneplus', 'redmi note', 'xiaomi \\d+',
      'honor (?:magic|\\d+)', 'motorola (?:edge|g\\d+|razr)', 'oppo (?:a\\d+\\w*|find|reno)', 'nokia \\d+', 'nubia', 'sim[- ]free', 'dual sim',
      'smartwatch(?:es)?', 'smart watch(?:es)?', 'fitness trackers?', 'activity trackers?', 'apple watch', 'galaxy watch', 'pixel watch',
      'huawei watch', 'watch gt', 'watch fit', 'fitbit', 'garmin (?:forerunner|venu|fenix|vivoactive|instinct)', 'amazfit', 'smart rings?',
      // Joybuy files smartwatches under "Smart Glasses"; real smart glasses (AR/XR, display) are wearables too
      'smart glasses', 'ai glasses', 'ar glasses', 'xr glasses', 'ar/xr glasses'
    ]),
    // "DJI OM 5 Smartphone camera stabilizer" is a gimbal (cameras), not a phone.
    exclude: words(['kids toy watch', 'tablets?', 'stabili[sz]ers?', 'gimbals?'])
  },
  {
    slug: 'laptops-computing',
    include: words([
      'laptops?', 'notebook (?:pc|computer)', '\\d+(?:\\.\\d)?["”]? (?:full hd |fhd |hd )?(?:\\(\\d+ x \\d+\\) )?notebook', 'ryzen', 'intel core', 'core i[3579]', 'macbook', 'chromebook', 'ultrabook', 'desktop pc', 'gaming pc', 'mini pc', 'all-in-one pc', 'imac', 'mac mini',
      'tablets?', 'ipad', 'galaxy tab', 'e-?readers?', 'kindle', 'monitors?', 'keyboards?', 'computer mouse', 'wireless mouse', 'mouse',
      'webcams?', 'graphics cards?', 'motherboards?', 'processors?', 'ddr[45] ram', 'pc cases?', 'mice',
      'psu', 'power supply unit', 'cpu[- ](?:water |air |liquid )?coolers?', 'liquid coolers?', 'aio', '(?:case|pc) fans?', 'cooler master', 'serial ata', 'sata',
      // PC parts named without those words (Back to the Office, 23 Oct 2026): "ARCTIC P12 - Pressure-optimised 120 mm Fan",
      // "ARCTIC MX-4 ... Thermal Paste", "ASUS DRW-24D5MT optical disc drive", "Kingston ... ValueRAM memory module ... DDR4".
      '\\d{2,3} ?mm (?:[\\w-]+ ){0,3}fans?', 'thermal paste', 'thermal compound', 'optical (?:disc )?drives?', 'memory modules?', 'ddr[345]',
      // Second dry run: "NVIDIA GeForce GT 730", "ASUS TUF Gaming B550-PLUS AMD B550 Socket AM4 ATX", "Logitech Wireless Combo MK270".
      'geforce', 'radeon', 'socket am[345]', 'lga ?1[1-9]\\d\\d', 'wireless combo', 'keyboard and mouse',
      // PC cases named by their size (PCHUB.UK): "Fractal Design Core 1100 Mini Tower Black", "Corsair 4000D Airflow Midi Tower".
      '(?:mini|midi|mid|full|micro|super)[- ]?tower', 'computer cases?',
      'printers?', 'ink cartridges?', 'toner', 'scanners?', 'label (?:printer|maker)s?', 'laminators?', 'shredders?', '3d printers?', 'calculators?'
    ]),
    exclude: words(['baby monitor', 'heart rate monitor', 'blood pressure monitor', 'piano keyboard', 'musical keyboard', 'mouse trap', 'mouse mat', 'vitamins?', 'multivitamins?', 'tablets? \\d+ ?mg', 'dishwasher tablets?', 'notebook paper', 'spiral notebook', 'fountain pens?'])
  },
  {
    slug: 'audio',
    include: words([
      'headphones?', 'headsets?', 'earbuds?', 'earphones?', 'airpods', 'buds', 'in-ear', 'over-ear', 'open-ear', 'bone conduction',
      'bluetooth speakers?', 'wireless speakers?', 'portable speakers?', 'speakers?', 'soundbars?', 'subwoofers?', 'hi-?fi', 'turntables?',
      'record players?', 'amplifiers?', 'dab radios?', 'microphones?', 'lavalier', 'voice recorders?', 'dictaphones?', 'audio receivers?',
      'home theat(?:er|re)', '\\d+(?:\\.\\d+){1,2} channels?'
    ]),
    exclude: words(['ear defenders?', 'hearing protection', 'speaker cable', 'smart speaker', 'televisions?', 'smart tvs?'])
  },
  {
    slug: 'tv-home-cinema',
    include: words([
      'televisions?', 'smart tvs?', 'tv', 'oled', 'qled', 'qned', 'mini led', 'projectors?', 'projector screens?', 'streaming (?:stick|device|box)s?',
      'fire tv', 'roku', 'chromecast', 'apple tv', 'tv wall (?:mount|bracket)s?'
    ]),
    exclude: words(['tv stand furniture', 'tv cabinet', 'tv unit', 'tv bed', 'telescopes?', 'microscopes?', 'binoculars?'])
  },
  {
    slug: 'cameras-drones',
    include: words([
      'digital cameras?', 'cameras?', 'stabili[sz]ers?', 'dslr', 'mirrorless', 'polaroid', 'instax', 'gopro', 'osmo', 'insta360', 'action cam(?:era)?s?',
      'dash ?cams?', 'drones?', 'camera lens(?:es)?', 'gimbals?', 'camcorders?', 'vlog'
    ]),
    // "TP-Link Tapo Pan/Tilt Home Security WiFi Camera" and "Tapo Smart Wire-Free Security Battery Camera" (Back to the Office,
    // 23 Oct 2026) are smart-home cameras.
    exclude: words(['security cameras?', 'surveillance', 'cctv', 'doorbell', 'webcam', 'baby monitor', 'ip cameras?', 'ptz', 'telescopes?', 'binoculars?', 'rangefinders?', 'scopes?',
      'home security', 'wi-?fi cameras?', 'pan/tilt', 'indoor cameras?', 'outdoor cameras?', 'security (?:[\\w-]+ ){1,3}cameras?', 'tapo'])
  },
  {
    slug: 'smart-home-wifi',
    include: words([
      'smart (?:plug|bulb|light|lock|thermostat|switch|home|display|hub|sensor|speaker)s?', 'smart light bulbs?', 'alexa', 'echo (?:dot|show|pop)',
      'google nest', 'nest (?:hub|cam|doorbell)', 'video doorbells?', 'doorbells?', 'security cameras?', 'surveillance cameras?', 'outdoor cameras?',
      'ptz cameras?', 'cctv', 'ip cameras?', 'smart smoke alarms?', 'wi-?fi ?\\d?', 'routers?', 'mesh wi-?fi', 'mesh (?:system|router|network)s?', 'range extenders?', 'access points?',
      'network switch(?:es)?', 'desktop switch', 'unmanaged switch', '\\d+-port', 'gigabit', 'poe\\+?', 'ethernet', 'powerline', 'modems?', 'orbi', 'tp-link deco', 'deco [xmse]\\d+',
      // Back to the Office, 23 Oct 2026: "Tapo Smart Wire-Free Security Battery Camera", "TP-Link RE200 network extender Network repeater",
      // "TP-Link Archer T4E Internal WLAN".
      'security (?:[\\w-]+ ){1,3}cameras?', 'tapo', 'repeaters?', 'network extenders?', 'wi-?fi extenders?', 'wlan'
    ]),
    exclude: words(['fake camera', 'dummy camera', 'router bits?', 'wood router'])
  },
  {
    slug: 'accessories-storage',
    // "Kingston ... Canvas Select 512GB micSDXC" (Back to the Office) writes microSD without "ro".
    include: words(['ssds?', 'nvme', 'external hard drives?', 'portable hard drives?', 'hard drives?', 'hdd', 'nas', 'memory cards?', 'micro ?sd(?:xc|hc)?', 'micsd(?:xc|hc)?', 'sd(?:xc|hc)', 'sd cards?', 'usb-bt\\d+', 'bluetooth (?:adapter|dongle)s?', 'usb (?:stick|flash drive)s?', 'flash drives?', 'datatraveler', 'portable ssd', '\\d+ ?tb usb', 'adapters?', 'plugs?']),
    exclude: words(['laptops?', 'desktop pc', 'mini pc', 'console', 'bicycle parts'])
  }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['laptops-computing', 'phones-smartwatches', 'audio', 'gaming', 'cameras-drones', 'tv-home-cinema', 'smart-home-wifi', 'accessories-storage'];

// Minimum quality for any product to be imported (L14). The import tool reports each failure reason.
export const QUALITY = {
  currency: 'GBP',
  minPrice: 1,
  maxPrice: 10000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

const TECH_TOPS = ['Electronics', 'Cameras & Optics', 'Software'];

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
export function classify(name, feedCategory = '') {
  const n = String(name || '').toLowerCase();
  const top = topCategory(feedCategory);
  if (DENY_TOP.includes(top)) return { ok: false, reason: `feed category: ${top}` };
  for (const d of DENY) if (d.re.test(n) && !(d.except && d.except.test(n))) return { ok: false, reason: d.label };
  const text = `${n} ${String(feedCategory || '').toLowerCase()}`;
  const only = ONLY_TOP[top];
  for (const r of RULES) {
    if (only && !only.includes(r.slug)) continue;
    if (r.include.test(text) && !(r.exclude && r.exclude.test(text))) return { ok: true, slug: r.slug };
  }
  return { ok: false, reason: TECH_TOPS.includes(top) ? 'not matched (feed says tech)' : 'not tech' };
}

// Feed names often start with promotions such as "【Black Friday Early Deals】" or "[Back-to-School]".
export function cleanProductName(name) {
  return String(name || '')
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
