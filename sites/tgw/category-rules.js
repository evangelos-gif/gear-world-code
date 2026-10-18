// Technology Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by the import tool):
//   1. The text checked is: product name + merchant category + Awin category (lower case).
//   2. If any DENY rule matches, the product is rejected (reason: the rule's label).
//   3. Otherwise the FIRST category whose `include` matches and whose `exclude` does not match wins.
//      Order matters: accessories come before phones, gaming before audio, and so on.
//   4. No match: rejected as "not tech".
// The dry-run report shows 20 samples per category and per reject reason, so these lists can be tuned
// with real feed data before anything is imported.

const words = list => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

export const DENY = [
  { label: 'woodworking or power tool', re: words(['wood router', 'plunge router', 'trim router', 'palm router', 'router bits?', 'router table', 'drill bits?', 'jigsaw', 'circular saw', 'angle grinder', 'sander', 'planer', 'chisel', 'hydraulic', 'welding', 'welder', 'impact driver', 'combi drill', 'sds']) },
  { label: 'vehicle part', re: words(['brake pads?', 'brake discs?', 'wiper blades?', 'exhaust', 'spark plugs?', 'tyres?', 'tires?', 'alloy wheels?', 'oil filter', 'air filter', 'headlight bulbs?', 'car seat covers?', 'engine', 'suspension', 'tow bar', 'roof rack', 'car parts?', 'vehicle parts?', 'motorcycle parts?']) },
  { label: 'clothing or beauty', re: words(['t-shirt', 'hoodie', 'dress', 'jacket', 'trousers', 'leggings', 'socks', 'shoes', 'trainers', 'boots', 'lingerie', 'perfume', 'fragrance', 'lipstick', 'mascara', 'nail polish', 'wig', 'hair extensions?']) },
  { label: 'not allowed', re: words(['vape', 'e-?cig(?:arette)?s?', 'tobacco', 'airsoft', 'knife', 'knives', 'crossbow', 'adult', 'sex', 'erotic', 'spy camera', 'hidden camera']) },
  { label: 'novelty smart glasses', re: words(['smart glasses', 'bluetooth glasses', 'audio glasses']) },
  { label: 'spare part or service', re: words(['replacement part', 'spare part', 'repair kit', 'warranty extension', 'service plan', 'gift card', 'voucher']) }
];

export const RULES = [
  {
    slug: 'charging-accessories',
    include: words(['(?:iphone|phone|galaxy|pixel|ipad|tablet|kindle|airpods|earbuds|watch|camera|laptop|macbook|switch)\\b[\\w\\s-]{0,30}?\\b(?:case|cover|folio|sleeve|skin)s?', 'chargers?', 'charging (?:cable|station|dock|pad|stand)s?', 'power ?banks?', 'usb-?c (?:cable|hub|adapter|charger)s?', 'lightning cables?', 'hdmi cables?', 'phone cases?', 'tablet cases?', 'ipad cases?', 'screen protectors?', 'tempered glass', 'phone (?:holder|mount|stand|grip)s?', 'laptop (?:bag|sleeve|stand)s?', 'usb hubs?', 'docking stations?', 'watch straps?', 'replacement bands?']),
    exclude: words(['ev charger', 'car battery charger', 'battery charger for tools', 'trickle charger', 'pencil case', 'suitcase', 'briefcase'])
  },
  {
    slug: 'gaming',
    include: words(['playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch oled', 'steam deck', 'gaming (?:headset|keyboard|mouse|mice|chair|desk|monitor|controller|pc|laptop)s?', 'game ?pads?', 'game controllers?', 'joysticks?', 'racing wheel', 'vr headset', 'meta quest']),
    exclude: words(['board game', 'card game', 'jigsaw puzzle'])
  },
  {
    slug: 'wearables',
    include: words(['smartwatch(?:es)?', 'smart watch(?:es)?', 'fitness trackers?', 'activity trackers?', 'apple watch', 'galaxy watch', 'pixel watch', 'fitbit', 'garmin (?:forerunner|venu|fenix|vivoactive|instinct)', 'huawei watch', 'amazfit', 'smart rings?']),
    exclude: words(['watch straps?', 'watch bands?', 'kids toy watch'])
  },
  {
    slug: 'phones-tablets',
    include: words(['smartphones?', 'mobile phones?', 'iphone', 'galaxy [asz]\\d+', 'galaxy z (?:fold|flip)', 'pixel \\d+', 'oneplus', 'xiaomi redmi', 'sim[- ]free', 'tablets?', 'ipad', 'galaxy tab', 'e-?readers?', 'kindle']),
    exclude: words(['tablet stand', 'dishwasher tablets?', 'vitamin', 'tablets? \\d+ ?mg'])
  },
  {
    slug: 'computers-laptops',
    include: words(['laptops?', 'notebook pc', 'macbook', 'chromebook', 'ultrabook', 'desktop pc', 'mini pc', 'all-in-one pc', 'imac', 'mac mini', 'monitors?', 'computer monitors?', 'keyboards?', 'computer mouse', 'wireless mouse', 'webcams?', 'graphics cards?', 'motherboards?', 'processors?', '\\d+ ?gb ram', 'ram memory', 'pc cases?']),
    exclude: words(['baby monitor', 'heart rate monitor', 'blood pressure monitor', 'piano keyboard', 'musical keyboard', 'mouse trap', 'mouse mat'])
  },
  {
    slug: 'audio',
    include: words(['headphones?', 'earbuds?', 'earphones?', 'airpods', 'in-ear', 'over-ear', 'bluetooth speakers?', 'wireless speakers?', 'smart speakers?', 'soundbars?', 'subwoofers?', 'hi-?fi', 'turntables?', 'record players?', 'amplifiers?', 'dab radios?', 'microphones?']),
    exclude: words(['ear defenders?', 'hearing protection', 'speaker cable'])
  },
  {
    slug: 'tv-projectors',
    include: words(['televisions?', 'smart tvs?', '\\d{2}["”]? ?(?:inch )?(?:4k|8k|uhd|oled|qled|led) tvs?', 'oled tvs?', 'qled tvs?', 'projectors?', 'projector screens?', 'streaming (?:stick|device|box)s?', 'fire tv', 'roku', 'chromecast', 'apple tv', 'tv wall (?:mount|bracket)s?']),
    exclude: words(['tv stand furniture', 'tv cabinet', 'tv unit'])
  },
  {
    slug: 'cameras-drones',
    include: words(['digital cameras?', 'dslr', 'mirrorless', 'compact cameras?', 'instant cameras?', 'polaroid', 'instax', 'gopro', 'action cam(?:era)?s?', 'dash ?cams?', 'drones?', 'camera lens(?:es)?', 'gimbals?', 'camcorders?', 'trail cameras?']),
    exclude: words(['security cameras?', 'cctv', 'doorbell', 'toy drone', 'drone parts?'])
  },
  {
    slug: 'smart-home',
    include: words(['smart (?:plug|bulb|light|lock|thermostat|switch|home|display|hub|sensor)s?', 'alexa', 'echo (?:dot|show|pop)', 'google nest', 'nest (?:hub|cam|doorbell)', 'video doorbells?', 'ring (?:doorbell|camera)', 'security cameras?', 'cctv', 'ip cameras?', 'robot vacuums?', 'robot hoovers?', 'baby monitors?', 'smart smoke alarms?']),
    exclude: words(['fake camera', 'dummy camera'])
  },
  {
    slug: 'networking-storage',
    include: words(['wi-?fi routers?', 'wireless routers?', 'mesh wi-?fi', 'mesh systems?', 'wi-?fi extenders?', 'range extenders?', 'access points?', 'network switch(?:es)?', 'powerline', 'modems?', 'ssds?', 'nvme', 'external hard drives?', 'hard drives?', 'hdd', 'nas', 'memory cards?', 'micro ?sd(?:xc|hc)? cards?', 'sd cards?', 'usb (?:stick|flash drive)s?', 'flash drives?', 'routers?']),
    exclude: words(['router bits?', 'wood router'])
  },
  {
    slug: 'printers-office',
    include: words(['printers?', 'ink cartridges?', 'toner', 'scanners?', 'label (?:printer|maker)s?', 'laminators?', 'shredders?', '3d printers?', 'calculators?', 'photo printers?']),
    exclude: words(['3d printer filament spool holder'])
  }
];

// Minimum quality for any product to be imported (L14). The import tool reports each failure reason.
export const QUALITY = {
  currency: 'GBP',
  minPrice: 1,
  maxPrice: 10000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 200
};

export function classify(text) {
  const t = String(text || '').toLowerCase();
  for (const d of DENY) if (d.re.test(t)) return { ok: false, reason: d.label };
  for (const r of RULES) {
    if (r.include.test(t) && !(r.exclude && r.exclude.test(t))) return { ok: true, slug: r.slug };
  }
  return { ok: false, reason: 'not tech' };
}
