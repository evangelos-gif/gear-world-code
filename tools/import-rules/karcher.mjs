// Import rules for Kärcher UK (CJ Affiliate advertiser 5030015) on Home and Garden Gear World (3 Nov 2026, lessons L89).
// Accepted us on CJ on 3 Nov 2026 (up to 5%, 30-day cookie). The CJ catalogue (cj-feed-download -> CJ_5030015.csv.gz,
// 1,039 products, GBP, every one with a CJ link) has the shop's own path in merchant_category:
// "Products > Home & Garden > Watering systems > Hoses", "Accessories > Professional > Scrubber-dryers > ...",
// "Cleaning Agents > Professional > Carpet". The places already exist on HGW and GGW (lessons L56).
//  - Professional range (scrubber-dryers, industrial parts): out, it is for businesses.
//  - HGW: vacuum cleaners (wet & dry, cordless, robot), carpet cleaners -> Home Appliances > Vacuum Cleaner;
//    steam cleaners -> Cleaning & Laundry > Steam Cleaner; hard floor cleaners and window vacs -> Cleaning & Laundry > Mop /
//    Cleaning Products; air purifiers -> Home Appliances > Air Purifier; vacuum bags and filters -> Vacuum Accessories;
//    home cleaning agents -> Cleaning Products.
//  - GGW: pressure washers, patio and outdoor cleaners, sweepers -> Power Garden Tools > Outdoor Power Tools; hoses, reels,
//    spray guns, connectors, sprinklers, timers, pumps -> Watering & Irrigation; trimmers, mowers, blowers, chainsaws.
// The shop name on the sites is "Karcher UK" (no umlaut): the import tools send database commands through an ASCII
// command file (Invoke-Wrangler), where "ä" would not match.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'karcher',
  network: 'cj',
  advertiserId: 5030015,
  retailer: 'Karcher UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?(karcher\.com\/gb|kaercher\.com\/uk|karcher\.co\.uk)\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 3000
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const PROFESSIONAL = /(^|>\s*)professional(\s*>|$)|\/professional\//i;
const NOT_A_PRODUCT = words(['gift card', 'voucher', 'warranty', 'service kit', 'repair', 'spare part', 'o-ring', 'seal kit', 'gasket']);

const H = (siteCategory, subcategory, doubt = false) => ({ site: 'hgw', siteCategory, subcategory, ...(doubt ? { doubt } : {}) });
const G = (siteCategory, subcategory, doubt = false) => ({ site: 'ggw', siteCategory, subcategory, ...(doubt ? { doubt } : {}) });

const STEAM = words(['steam cleaner', 'steam cleaners', 'steam mop', 'steam mops', 'steam iron', 'sc 1', 'sc 2', 'sc 3', 'sc 4', 'sc 5']);
const AIR = words(['air purifier', 'air purifiers', 'af 20', 'af 30', 'af 50']);
const VAC_ACCESSORY = words(['filter bag', 'filter bags', 'dust bag', 'dust bags', 'fleece filter', 'flat pleated filter', 'cartridge filter', 'hepa filter',
  'floor nozzle', 'crevice nozzle', 'suction hose', 'suction tube', 'vacuum attachment']);
const VACUUM = words(['vacuum cleaner', 'vacuum cleaners', 'wet and dry vacuum', 'wet & dry vacuum', 'cordless vacuum', 'robot vacuum', 'robotic vacuum',
  'carpet cleaner', 'spot cleaner', 'puzzi', 'wd 1', 'wd 2', 'wd 3', 'wd 4', 'wd 5', 'wd 6', 'vc 4', 'vc 6', 'vc 7', 'rcv', 'se 3', 'se 4', 'se 5']);
const FLOOR = words(['hard floor cleaner', 'floor cleaner', 'fc 2', 'fc 3', 'fc 4', 'fc 5', 'fc 7', 'fc 8', 'evc', 'mop', 'roller']);
const WINDOW = words(['window vac', 'window vacuum', 'wv 2', 'wv 5', 'wv 6', 'window cleaning robot', 'window cleaner']);
const DETERGENT = words(['cleaner', 'cleaning agent', 'detergent', 'rm ', 'shampoo', 'conditioner', 'descaler', 'concentrate']);

const PRESSURE = words(['pressure washer', 'pressure washers', 'high pressure', 'k 2', 'k 3', 'k 4', 'k 5', 'k 7', 'k2', 'k3', 'k4', 'k5', 'k7',
  'patio cleaner', 't-racer', 't racer', 'surface cleaner', 'outdoor cleaner', 'mobile outdoor cleaner', 'oc 3', 'oc 6', 'sweeper', 'push sweeper', 's 4', 's 6',
  'power nozzle', 'vario power', 'dirt blaster', 'trigger gun', 'spray lance', 'wash brush', 'pressure washer hose', 'pipe cleaning']);
const HOSE = words(['hose', 'hoses', 'primoflex', 'performance plus hose']);
const REEL = words(['hose reel', 'hose trolley', 'hose box', 'reel']);
const SPRAY = words(['spray gun', 'spray nozzle', 'spray lance', 'shower']);
const CONNECTOR = words(['connector', 'connectors', 'coupling', 'adapter', 'adaptor', 'tap connector']);
const SPRINKLER = words(['sprinkler', 'sprinklers', 'oscillating']);
const TIMER = words(['water timer', 'watering timer', 'irrigation computer', 'watering computer', 'sensotimer', 'timer']);
const IRRIGATION = words(['drip', 'irrigation', 'rain system', 'watering system', 'micro drip', 'soaker']);
const PUMP = words(['pump', 'pumps', 'submersible', 'drainage pump', 'dirty water pump', 'clear water pump', 'garden pump', 'rain barrel pump']);
const TRIMMER = words(['grass trimmer', 'line trimmer', 'lawn trimmer', 'ltr']);
const HEDGE = words(['hedge trimmer', 'hge']);
const MOWER = words(['lawn mower', 'lawnmower', 'lmo']);
const BLOWER = words(['leaf blower', 'blower', 'lbl']);
const CHAINSAW = words(['chainsaw', 'chain saw', 'cns', 'tree lopper', 'pruner', 'pole pruner']);
const BATTERY = words(['battery', 'batteries', 'charger', 'battery power']);

export function classify({ name, feedCategory = '', url = '' }) {
  const n = String(name || '').replace(/k[äa]rcher/ig, 'Karcher');
  const cat = String(feedCategory || '');
  if (PROFESSIONAL.test(cat) || PROFESSIONAL.test(String(url || ''))) return { reject: 'professional range (for businesses)' };
  if (NOT_A_PRODUCT.test(n)) return { reject: 'spare part, service or gift card' };
  // The shop's garden and outdoor sections (first dry run, 3 Nov 2026: pressure washer guns, lances, brushes and the
  // 18 V batteries sat in "Consumer Outdoor", "Retail Battery Platform", "Portable Cleaner", "Mobile Cleaning").
  const garden = /home & garden > (watering|garden|pumps|high-pressure|pressure washers|outdoor|sweepers|consumer outdoor|retail battery|portable clean|mobile clean)|watering|garden power tools|pumps|consumer outdoor|pipe cleaning/i.test(cat);
  // Every path says "Home & Garden": only the rest of it tells home from garden.
  const place = cat.replace(/home\s*&\s*garden/ig, ' ');
  // Garden first: pressure washers and watering are the GGW products; "hose" also appears on vacuum cleaners.
  if (PRESSURE.test(n) || /high-pressure|pressure washer|outdoor (mobile )?clean|sweeper/i.test(cat)) return G('Power Garden Tools', 'Outdoor Power Tools');
  if (REEL.test(n) && !/suction/i.test(n)) return G('Watering & Irrigation', 'Hose Reels & Storage');
  if (SPRINKLER.test(n)) return G('Watering & Irrigation', 'Garden Sprinklers');
  if (TIMER.test(n)) return G('Watering & Irrigation', 'Water Timers');
  if (IRRIGATION.test(n)) return G('Watering & Irrigation', 'Irrigation Systems');
  if (SPRAY.test(n) && !STEAM.test(n)) return G('Watering & Irrigation', 'Spray Nozzles & Guns');
  if (HOSE.test(n) && !/suction|vacuum|steam/i.test(n) && (garden || /watering/i.test(cat))) return G('Watering & Irrigation', 'Hose Pipes');
  if (CONNECTOR.test(n) && garden) return G('Watering & Irrigation', 'Hose Adaptors & Connectors');
  if (PUMP.test(n)) return G('Watering & Irrigation', 'Watering Accessories');
  if (TRIMMER.test(n)) return G('Power Garden Tools', 'Grass Trimmers');
  if (HEDGE.test(n)) return G('Power Garden Tools', 'Hedge Trimmers');
  if (MOWER.test(n)) return G('Power Garden Tools', 'Lawnmowers & Accessories');
  if (BLOWER.test(n)) return G('Power Garden Tools', 'Garden Blowers');
  if (CHAINSAW.test(n)) return G('Power Garden Tools', 'Chainsaws & Accessories');
  if (BATTERY.test(n) && garden) return G('Power Garden Tools', 'Outdoor Power Tools');
  if (garden && /consumer outdoor|retail battery|portable clean|mobile clean|pipe cleaning/i.test(cat)) return G('Power Garden Tools', 'Outdoor Power Tools');
  // Home.
  if (AIR.test(n) || /air purif/i.test(cat)) return H('Home Appliances', 'Air Purifier');
  if (STEAM.test(n) || /steam clean/i.test(cat)) return H('Cleaning & Laundry', 'Steam Cleaner');
  if (VAC_ACCESSORY.test(n)) return H('Cleaning & Laundry', 'Vacuum Accessories');
  if (WINDOW.test(n) || /window/i.test(cat)) return H('Cleaning & Laundry', 'Cleaning Products');
  if (VACUUM.test(n) || /vacuum|carpet|spot clean/i.test(cat)) return H('Home Appliances', 'Vacuum Cleaner');
  if (FLOOR.test(n) || /hard floor|floor clean/i.test(cat)) return H('Cleaning & Laundry', 'Mop');
  if (/cleaning agents/i.test(cat) || DETERGENT.test(n)) return /garden|outdoor|patio|vehicle|car |high pressure|pressure washer/i.test(n + ' ' + place) && !/floor|parquet|textile|carpet|upholster|window|glass/i.test(n + ' ' + place)
    ? G('Power Garden Tools', 'Outdoor Power Tools', true) : H('Cleaning & Laundry', 'Cleaning Products');
  if (garden) return G('Power Garden Tools', 'Outdoor Power Tools', true);
  return { reject: 'not sure what it is (no cleaning, garden or watering word)' };
}
