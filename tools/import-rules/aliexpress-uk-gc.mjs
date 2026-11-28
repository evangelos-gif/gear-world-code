// Import rules for AliExpress UK (Awin advertiser 7035) on Garden Gear World and Construction Gear World: owner, 28 Nov
// 2026 00:10 ("AliExpress θέλω για όλες τις κατηγορίες αύριο"), lessons L241. The first wave (aliexpress-uk.mjs, L239)
// covers WGW, MGW, KGW and HGW and the newer sites read lib/aliexpress-uk-sections.mjs; this file is the same shop on
// the other two older sites, from the same three fresh feeds (never the old ones, L238), in the categories and
// subcategories AliExpress PL already has there (aliexpress-pl.mjs).
// - GGW: garden supplies, garden tools, outdoor lighting and outdoor furniture.
// - CGW: hand and power tools, workshop and site equipment, plumbing, painting and hardware.
// - Never: the first wave's NEVER list and the newer sites' one (weapons, knives, key cloning, medical claims...), a
//   well-known brand named as the product (a tool brand only as what a part fits), a plug of another country, safety
//   equipment (PPE, harnesses, fire extinguishers, first aid: a marketplace listing has no proof of testing), mains
//   wiring parts not made for UK wiring, poisons and pesticides, laser engravers and generators.
import { FEEDS, OLD_FEEDS, feedFiles, productKey, displayName, displayBrand, NEVER, folders } from './aliexpress-uk.mjs';
import { NEVER_MORE, brandTrouble } from './lib/aliexpress-uk-sections.mjs';
import { rulesOf, SERVICE, clean } from './lib/wave-a.mjs';

export { FEEDS, OLD_FEEDS, feedFiles, productKey, displayName, displayBrand };

export const RULES = rulesOf({
  key: 'aliexpress-uk-gc', advertiserId: 7035, retailer: 'AliExpress UK', currency: 'GBP',
  shop: /^https:\/\/www\.aliexpress\.com\/item\/\d{6,20}\.html/i,
  sites: ['ggw', 'cgw'],
  minPrice: 3, maxPrice: 1500,
  // A marketplace adds variety, without burying the garden and tool shops of these sites.
  maxPerSubcategory: 200,
  keepQuery: true
});

const R = (site, siteCategory, subcategory) => ({ site, siteCategory, subcategory });
const OUT = reason => ({ reject: reason });
const G = 'ggw', C = 'cgw';
const POWER = /\b(?:cordless|electric|battery|brushless|rechargeable|\d{2}\s*v\b|petrol|gas powered|engine|motor|chainsaws?|strimmers?|trimmers?|blowers?|mowers?|tillers?|cultivators?|hedge cutters?|pruners? electric)\b/i;
const PLUG = /\beu\s*(?:\d{3}\s*v\s*)?(?:sockets?|outlets?)\b|european standard|\beu (?:standard|version|plug)\b|\b(?:eu|us|au|jp|kr|br|cn|eur?)\s*-?\s*plugs?\b|\b110\s*-?\s*1[12]0?\s*v\b|\b110\s*v\b|\bschuko\b/i;
const WIRED = /\b(?:plugs?|mains|ac\s*(?:100|110|220|230|240)|220\s*v|230\s*v|240\s*v|adapters?|chargers?|power supply|heaters?|electric|welders?|welding machines?)\b/i;
const POISON = /\b(?:poisons?|rodenticides?|insecticides?|pesticides?|herbicides?|weed ?killers?|glyphosate|bait stations?|rat bait|mouse bait|slug pellets?|traps? (?:for )?(?:rats?|mice|moles?)|glue traps?|sticky traps? (?:for )?(?:rats?|mice))\b/i;
const TOOL_NOUN = /\b(?:drills?|drivers?|saws?|grinders?|wrench(?:es)?|sanders?|polishers?|blowers?|trimmers?|mowers?|screwdrivers?|hammers?|planers?|routers?|nailers?|staplers?|guns?|vacuums?|lights?|lamps?|torches?|pumps?|inflators?|compressors?|kits?|sets?)\b/i;
const SAFETY = /\b(?:hard ?hats?|safety helmets?|harness(?:es)?|lanyards? (?:fall|safety)|fall (?:arrest|protection)|fire extinguishers?|fire blankets?|first aid|respirators?|gas masks?|safety glasses|safety goggles|ear defenders?|hi-?vis|high visibility|safety boots|safety shoes|steel toe|life jackets?)\b/i;

// A seller's folder is often wrong ("Outdoor Furniture" with a rice steamer, "Garden Carts" with an e-bike, "Tool Sets"
// with a folding bike): products that are clearly something else stay out.
const NOT_GARDEN = /\b(?:toys?|launchers?|blasters?|bikes?|bicycles?|scooters?|e-?bikes?|tricycles?|motorcycles?|sidecars?|steamers?|kettles?|stoves?|cookers?|hot ?pots?|power banks?|radios?|speakers?|monitors?|quail|film processors?|sleeping bags?|cube kits?|fitness equipment|pull-?ups?|bike trailers?|hats?|caps?|gloves? for (?:men|women)|souvenirs?|collections?|models?)\b/i;
const NOT_TOOL = /\b(?:bikes?|bicycles?|scooters?|motorcycles?|tricycles?|e-?bikes?|wallets?|purses?|underarm|handbags?|water dispensers?|water generators?|purifiers?|soda ?makers?|sodastream|radio receivers?|sdr|phones?|ambient lights?|car interior|tractors?|toys?|brake\w*|for (?:vw|volkswagen|bmw|audi|mercedes|toyota|honda|ford|tesla|nissan|kia|hyundai|peugeot|renault|skoda)\b)\b/i;
const LADDER = /\b(?:ladders?|step ?stools? (?:for|with) (?:loft|roof)|scaffold\w*|work platforms?)\b/i;
const NEED_FURNITURE = /\b(?:garden|outdoor|patio|camping|picnic|beach|balcony|terrace|rattan|wicker|hammocks?|swings?|loungers?|benches?|chairs?|tables?|sofas?|parasols?|umbrellas?|gazebos?|pergolas?|canopy|canopies|awnings?|bean ?bags?|stools?|daybeds?|furniture|plant (?:shelf|shelves|stands?)|inflatable (?:sofa|chair|lounger|bench|seat)s?)\b/i;
const NEED_BUILDING = /\b(?:sheds?|greenhouses?|polytunnels?|storage|fence|fencing|gates?|pergolas?|gazebos?|carports?|canopy|canopies|decking|pavers?|paving|log stores?|compost\w*|planters?|trellis|arbou?rs?|arch(?:es)?|cabins?|garden rooms?|summer ?houses?|sunrooms?|conservator(?:y|ies))\b/i;
const NEED_CART = /\b(?:carts?|wagons?|trolleys?|wheelbarrows?|barrows?|hand trucks?)\b/i;

function lights(n) {
  if (/\bsolar\b/i.test(n)) return R(G, 'Outdoor Lighting & Garden Electrical', 'Solar lights');
  if (/\b(?:flood ?lights?|security lights?|pir|motion sensor)\b/i.test(n)) return R(G, 'Outdoor Lighting & Garden Electrical', 'Floodlights & security lights');
  if (/\b(?:path|spike|lawn|stake|bollard|ground)\b/i.test(n)) return R(G, 'Outdoor Lighting & Garden Electrical', 'Path & spike lights');
  if (/\b(?:string|festoon|fairy|globe|rope lights?|curtain lights?)\b/i.test(n)) return R(G, 'Outdoor Lighting & Garden Electrical', 'String & festoon lights');
  return R(G, 'Outdoor Lighting & Garden Electrical', 'Outdoor lights');
}
function furniture(sec3, n) {
  if (/table/i.test(sec3) || /\btables?\b/i.test(n)) return R(G, 'Garden Furniture & Outdoor Living', 'Tables');
  if (/hammock|swing/i.test(sec3) || /\b(?:hammocks?|swing seats?|hanging chairs?|egg chairs?)\b/i.test(n)) return R(G, 'Garden Furniture & Outdoor Living', 'Hammocks & swing seats');
  if (/sofa/i.test(sec3) || /\b(?:sofas?|corner sets?|lounge sets?)\b/i.test(n)) return R(G, 'Garden Furniture & Outdoor Living', 'Lounge & corner sets');
  if (/chair|bench/i.test(sec3) || /\b(?:chairs?|benches?|stools?|loungers?|recliners?)\b/i.test(n)) return R(G, 'Garden Furniture & Outdoor Living', 'Chairs & benches');
  if (/canopy|umbrella|parasol|gazebo|awning/i.test(sec3) || /\b(?:parasols?|gazebos?|canopy|canopies|awnings?|umbrellas?)\b/i.test(n)) return R(G, 'Garden Furniture & Outdoor Living', 'Parasols, gazebos & shade');
  return R(G, 'Garden Furniture & Outdoor Living', 'Garden furniture');
}

// [regex on "<first> > <second> > <third>", function (sec3, name) or place]. First match wins; no match: not for these two sites.
const SECTIONS = [
  // ---- Garden Gear World ----
  [/^Home & Garden > Garden Supplies > Garden Buildings/i, (t, n) => (/\b(?:greenhouses?|polytunnels?)\b/i.test(n) ? R(G, 'Garden Buildings, Fencing & Storage', 'Greenhouses') : NEED_BUILDING.test(n) ? R(G, 'Garden Buildings, Fencing & Storage', 'Garden storage') : OUT('not a garden building (marketplace folder)'))],
  [/^Home & Garden > Garden Supplies > (?:Gardening Pots|Pots)/i, R(G, 'Plants, Growing & Garden Care', 'Pots & planters')],
  [/^Home & Garden > Garden Supplies > Outdoor Hot Tubs/i, (t, n) => (/\b(?:hot tubs?|spa|pools?|jacuzzi)\b/i.test(n) ? R(G, 'Garden Furniture & Outdoor Living', 'Hot tubs & accessories') : OUT('not a hot tub or pool product'))],
  [/^Home & Garden > Garden Supplies > Pest Control/i, R(G, 'Plants, Growing & Garden Care', 'Pest control')],
  [/^Home & Garden > Garden Supplies > (?:Plant Support|Fertilizer|Seed Disseminators|Landscape)/i, R(G, 'Plants, Growing & Garden Care', 'Growing')],
  [/^Home & Garden > Garden Supplies > Indoor Gardening/i, R(G, 'Plants, Growing & Garden Care', 'Hydroponics')],
  [/^Home & Garden > Garden Supplies > Shade/i, R(G, 'Garden Furniture & Outdoor Living', 'Parasols, gazebos & shade')],
  [/^Home & Garden > Garden Supplies > Watering/i, (t, n) => (/\b(?:irrigation|drip|micro sprinklers?|sprinkler systems?|timers?|controllers?)\b/i.test(n) ? R(G, 'Watering & Irrigation', 'Irrigation Systems') : R(G, 'Watering & Irrigation', 'Watering Accessories'))],
  [/^Home & Garden > Garden Supplies > Yard & Garden Decor/i, (t, n) => (/\b(?:ponds?|fountains?|water pumps?|water features?|bird ?baths?)\b/i.test(n) ? R(G, 'Watering & Irrigation', 'Ponds & water features') : R(G, 'Garden Furniture & Outdoor Living', 'Garden ornaments'))],
  [/^Home & Garden > Garden Supplies > Mailboxes/i, (t, n) => (/\b(?:letter ?box(?:es)?|mail ?box(?:es)?|post ?box(?:es)?|parcel box(?:es)?)\b/i.test(n) ? R(G, 'Garden Buildings, Fencing & Storage', 'Letter boxes') : OUT('not a letter box'))],
  [/^Home & Garden > Garden Supplies > Garden Carts/i, (t, n) => (NEED_CART.test(n) ? R(G, 'Garden Tools', 'Wheelbarrows') : OUT('not a garden cart (marketplace folder)'))],
  [/^Home & Garden > Garden Supplies > Beekeeping/i, R(G, 'Garden Tools', 'Other Garden Accessories')],
  [/^Home & Garden > Garden Supplies/i, R(G, 'Garden Tools', 'Other Garden Accessories')],
  [/^Tools > Garden Tools/i, (t, n) => (POWER.test(n) ? R(G, 'Power Garden Tools', 'Outdoor Power Tools') : R(G, 'Garden Tools', 'Other Garden Accessories'))],
  [/^Lights & Lighting > Outdoor Lighting > Mosquito/i, OUT('insect killer lamps (electric shock grids)')],
  [/^Lights & Lighting > (?:Outdoor Lighting|Holiday Lighting)/i, (t, n) => lights(n)],
  [/^Furniture > Outdoor Furniture/i, (t, n) => (NEED_FURNITURE.test(n) ? furniture(t, n) : OUT('not outdoor furniture (marketplace folder)'))],

  // ---- Construction Gear World ----
  [/^Tools > Laser Engraving/i, OUT('laser engravers (eye safety)')],
  [/^Tools > Tools Packaging/i, R(C, 'Site Equipment', 'Storage & Site Containers')],
  [/^Tools > (?:Power Tools|Power Tool Parts|Drill Bits|Abrasive|Welding)/i, R(C, 'Power Tools', 'Power Tools')],
  [/^Tools > (?:Hand Tools|Tool Sets|Construction Tools|Riveter|Measurement|Tool Parts)/i, R(C, 'Hand Tools', 'Hand Tools')],
  [/^Tools/i, R(C, 'Hand Tools', 'Hand Tools')],
  [/^Home Improvement > (?:Plumbing|Kitchen Fixture|Bathroom Fixture)/i, R(C, 'Hand Tools', 'Plumbing Tools')],
  [/^Home Improvement > Painting/i, (t, n) => (/\bwallpapers?\b/i.test(n) || /wallpaper/i.test(t) ? OUT('wallpaper (on Home Gear World)') : R(C, 'Hand Tools', 'Painting & Decorating'))],
  [/^Home Improvement > Electrical Equipment & Supplies > Generators/i, OUT('generators and power stations from a marketplace listing (fire and fume risk)')],
  [/^Home Improvement > Electrical Equipment/i, OUT('mains wiring parts from a marketplace listing (UK wiring rules)')],
  [/^Home Improvement > Heating/i, OUT('heaters, fires and boiler parts from a marketplace listing (safety)')],
  [/^Home Improvement > Family Intelligence/i, OUT('smart home products are on Technology Gear World')],
  [/^Home Improvement > (?:Hardware|Doors|Building Supplies|Functional Material)/i, R(C, 'Hand Tools', 'DIY')],
  [/^Lights & Lighting > Portable Lighting/i, R(C, 'Site Equipment', 'Lighting')],
  [/^Industrial & Business > (?:Food Machine|Commercial Equipment|Rubbers)/i, OUT('not a construction product')],
  [/^Industrial & Business/i, R(C, 'Site Equipment', 'Industrial Equipment')],
  [/^Security & Protection/i, OUT('safety equipment from a marketplace listing (needs proof of testing)')]
];

export function classify(input) {
  const raw = clean(input.name);
  const n = displayName(input.name);
  if (!n || n.length < 12) return OUT('name says nothing about the product');
  if (SERVICE.test(n)) return OUT('gift card or service');
  const plain = raw.replace(/cigarette lighters?/gi, '12V socket');
  if (NEVER.test(plain) || NEVER_MORE.test(plain)) return OUT('never on the sites (adult, smoking, weapons, medical, unlawful, costumes or replicas)');
  const f = folders(input.feedCategory);
  const path = f.slice(0, 3).join(' > ');
  if (!path) return OUT('no section in the feed');
  for (const [re, what] of SECTIONS) {
    if (!re.test(path)) continue;
    const c = typeof what === 'function' ? what(f[2] || '', raw) : what;
    if (c.reject) return c;
    const trouble = brandTrouble(raw, path);
    if (trouble) return OUT(trouble);
    if (c.site === G && NOT_GARDEN.test(raw)) return OUT('not a garden product (marketplace folder)');
    if (c.site === C && NOT_TOOL.test(raw)) return OUT('not a tool or construction product (marketplace folder)');
    if (LADDER.test(raw)) return OUT('ladders and work platforms from a marketplace listing (safety standard)');
    if (/\b(?:gas (?:stoves?|cookers?|heaters?|burners?|bottles?|regulators?)|propane|butane|lpg)\b/i.test(raw)) return OUT('gas appliances and parts from a marketplace listing (safety)');
    if (SAFETY.test(raw)) return OUT('safety equipment from a marketplace listing (needs proof of testing)');
    if (POISON.test(raw)) return OUT('poisons, pesticides and traps for animals');
    if (PLUG.test(raw) && WIRED.test(raw)) return OUT('a plug or voltage of another country: not for a UK home');
    // A battery or charger on its own (the first words say what the product is): fire risk. A tool sold with them is fine.
    const head = raw.split(/\s+/).slice(0, 6).join(' ');
    if (c.site === C && /\b(?:batter(?:y|ies)|chargers?)\b/i.test(head) && !TOOL_NOUN.test(head)) return OUT('power tool batteries and chargers on their own (fire risk)');
    return { ...c, name: n };
  }
  return OUT('not for Garden or Construction Gear World (the other AliExpress UK sites have it)');
}
