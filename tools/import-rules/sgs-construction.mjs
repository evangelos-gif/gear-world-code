// Import rules for SGS Engineering (Awin advertiser 28807) on Construction Gear World (29 Oct 2026, lessons L82).
// SGS is already on Car Gear World (AGW, 1,831 products: NitroLift gas struts, jacks, garage equipment). On 29 Oct 2026
// SGS wrote (Awin, "Power Tools Creatives") that the 5% CPA on all power tools stays and asked for an extra push: their
// power tools (the Rikä RK20/RK40 cordless ranges, air tools and compressors) belong on CGW, which had none of them.
// Two feeds: 94852 (5,222 products) and 95330 (3,445). Feed categories end with the brand ("Power Tools > Rikä RK40 40V
// Cordless Power Tools > Rikä", "Hardware > Tools > SGS", "Vehicles & Parts > ... > NitroLift"); the same product in both
// feeds is one product (same page).
//  - In: power tools, their batteries, chargers, blades, bits and discs; air compressors and air tools; hand tools for
//    any trade; site equipment (work lights, heaters, generators, workbenches, tool storage, ladders, trucks).
//  - Out: everything for cars and vans (gas struts, jacks, axle stands, lifts, car care, tyres, diagnostics: AGW's), garden
//    machinery (mowers, strimmers, chainsaws, log splitters, pressure washers: GGW's), and fitness or home products.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'sgs-construction',
  advertiserId: 28807,
  retailer: 'SGS Engineering',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?sgs-engineering\.(com|co\.uk)\//i,
  sites: ['cgw'],
  // Workshop storage systems and metal bandsaws really cost £3,000-£9,000 (first dry run, 29 Oct 2026: 296 left out).
  maxPrice: 10000,
  keepQuery: true
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

// Car and van work: AGW's. A power tool word wins over these (an impact wrench for wheel nuts is still an impact wrench).
const CAR_FEED = /(^|> ?)(vehicles? & parts|gas struts?|car accessories|car care|jump starters?|vehicle battery|jacks? & lift trucks|lifts & hoists|car jack|wheel & tyre|automotive)\b|vehicle (repair|maintenance|safety|storage)|nitrolift|tetrosyl/i;
const CAR = words(['gas strut', 'gas struts', 'strut', 'struts', 'trolley jack', 'bottle jack', 'axle stand', 'axle stands', 'car lift', 'vehicle lift',
  'two post lift', '2 post lift', 'scissor lift', 'car ramp', 'car ramps', 'wheel dolly', 'wheel dollies', 'vehicle positioning', 'tyre', 'tyres', 'tire',
  'jump starter', 'jump pack', 'battery charger', 'battery tester', 'obd', 'brake', 'brakes', 'clutch', 'timing', 'exhaust', 'suspension', 'engine crane',
  'engine stand', 'transmission jack', 'oil drain', 'motorcycle', 'motorbike', 'caravan', 'motorhome', 'car', 'vehicle', 'van', 'bonnet', 'boot',
  'tailgate', 'wiper', 'screenwash', 'valeting', 'car wash', 'creeper', 'nitrolift', 'automotive', 'mechanic', "mechanic's", 'mechanics']);
const GARDEN = words(['lawn mower', 'lawnmower', 'mower', 'strimmer', 'grass trimmer', 'hedge trimmer', 'hedgetrimmer', 'line trimmer',
  'string trimmer', 'brush cutter', 'brushcutter', 'leaf blower', 'leaf vacuum',
  'chainsaw', 'chain saw', 'log splitter', 'wood chipper', 'chipper', 'shredder', 'tiller', 'cultivator', 'rotavator', 'pressure washer', 'scarifier',
  'garden']);
const NOT_TRADE = words(['treadmill', 'exercise bike', 'rowing machine', 'dumbbell', 'dumbbells', 'kettlebell', 'barbell', 'weight plate', 'gym',
  'fitness', 'yoga', 'boxing', 'punch bag', 'massage', 'trampoline', 'gift card', 'voucher']);
const REPAIR = /\b(spare part|spare pack|spares?\b|replacement (switch|motor|brush|brushes|housing|armature|trigger)|carbon brush(es)?|armature|o-ring kit|service kit|seal kit)\b/i;
// Parts for SGS machines and Power Team hydraulics (first dry run: "M6x16 Bolt", "GPS520 Handle Bracket Assembly",
// "SC24H Wheel", "Power Team HDT10273 O Ring", "Female QRC to 1/4 BSPF"): not tools in their own right.
const PART = words(['bolt', 'bolts', 'nut', 'nuts', 'lock nut', 'washer', 'washers', 'o ring', 'o-ring', 'gasket', 'cowling', 'tank cap', 'choke lever',
  'gear case', 'assembly', 'bracket', 'manifold', 'manifold block', 'connector', 'coupler', 'coupling', 'fitting', 'retaining ring', 'valve', 'filter',
  'nozzle', 'wand', 'dust bag', 'shaft', 'gauge', 'bspf', 'bspm', 'qrc', 'pcl', 'nptf', 'reservoir']);
const MODEL_FIRST = /^\s*(?:[A-Z]{1,5}\d{1,4}[A-Z]{0,2}(?:\s*\/\s*|\s+))+/; // "GPS520 / GPBS520 ...", "SC24H Wheel", "SWV40 2.5m Hose"
const HYDRAULICS = /power team|hydraulic technologies|(^|> ?)hydraulics\b/i;
// Rikä is SGS's own brand for everything (hammers, screws, nails, bags): the brand alone says nothing.
const FIXINGS = words(['screw', 'screws', 'nail', 'nails', 'wall plug', 'wall plugs', 'anchor', 'anchors', 'rivet', 'rivets', 'staples', 'fixings']);

const POWER = words(['drill', 'drills', 'drill driver', 'combi drill', 'hammer drill', 'sds', 'impact driver', 'impact wrench', 'angle grinder', 'grinder',
  'bench grinder', 'die grinder', 'circular saw', 'jigsaw', 'jig saw', 'reciprocating saw', 'mitre saw', 'miter saw', 'chop saw', 'table saw', 'band saw',
  'bandsaw', 'plunge saw', 'track saw', 'multi tool', 'multi-tool', 'oscillating', 'sander', 'orbital', 'planer', 'router', 'nailer', 'nail gun',
  'brad nailer', 'stapler', 'heat gun', 'glue gun', 'rotary tool', 'rotary hammer', 'demolition hammer', 'breaker', 'polisher', 'paddle mixer',
  'magnetic drill', 'core drill', 'air compressor', 'compressor', 'air tool', 'air tools', 'air ratchet', 'air hammer', 'air nailer', 'air sander',
  'spray gun', 'paint sprayer', 'welder', 'welding', 'plasma cutter', 'cordless', 'brushless', 'rk20', 'rk40', '18v', '20v', '40v', 'linisher',
  'saw blade', 'saw blades', 'drill bit', 'drill bits', 'cutting disc', 'cutting discs', 'grinding disc', 'grinding discs', 'flap disc', 'sanding sheets',
  'sanding discs', 'hole saw', 'tile cutter', 'tile saw', 'wet saw', 'air impact', 'auger bit', 'auger bits', 'flat bit', 'spade bit', 'router bit',
  'jigsaw blade', 'jigsaw blades']);
const SITE = words(['work light', 'worklight', 'site light', 'flood light', 'floodlight', 'inspection lamp', 'inspection light', 'head torch', 'generator',
  'space heater', 'diesel heater', 'paraffin heater', 'workshop heater', 'heater', 'industrial fan', 'dehumidifier', 'extension reel', 'extension lead',
  'cable reel', 'ladder', 'step ladder', 'scaffold', 'sack truck', 'platform truck', 'hand truck', 'workbench', 'work bench', 'tool chest', 'tool cabinet',
  'roller cabinet', 'tool box', 'toolbox', 'tool storage', 'tool trolley', 'vice', 'bench vice', 'hydraulic press', 'workshop press', 'parts washer',
  'storage cabinet', 'shelving', 'racking', 'cabinet', 'tool bag', 'tool backpack', 'backpack', 'blasting cabinet', 'sand blaster', 'shot blaster',
  'workshop storage', 'garage storage', 'dumper', 'power barrow', 'ground protection', 'ground guard']);
const LIGHT = words(['work light', 'worklight', 'site light', 'flood light', 'floodlight', 'inspection lamp', 'inspection light', 'head torch',
  'headlamp', 'head lamp', 'torch']);
const HAND = words(['spanner', 'spanners', 'wrench', 'wrenches', 'torque wrench', 'socket', 'sockets', 'socket set', 'ratchet', 'screwdriver',
  'screwdrivers', 'pliers', 'hammer', 'mallet', 'chisel', 'file', 'hacksaw', 'hand saw', 'panel saw', 'hex key', 'allen key', 'tape measure',
  'spirit level', 'level', 'clamp', 'clamps', 'crowbar', 'pry bar', 'wrecking bar', 'utility knife', 'snips', 'punch', 'tool kit', 'tool set',
  'bit set', 'riveter', 'rivet gun', 'grease gun', 'stud extractor', 'tap and die', 'tap & die', 'multimeter', 'bolt cutter', 'bolt cutters']);

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = String(name || '');
  const cat = `${feedCategory || ''} | ${awinCategory || ''}`;
  if (NOT_TRADE.test(n) || /fitness|gym equipment|sports/i.test(cat)) return { reject: 'fitness, sports or gifts (not construction gear)' };
  if (REPAIR.test(n) || MODEL_FIRST.test(n)) return { reject: 'spare part or repair kit' };
  if (HYDRAULICS.test(`${n} ${cat}`)) return { reject: 'hydraulic components (Power Team)' };
  // Cordless garden machines share the battery range ("Rikä 40V Cordless Lawn Mower"): still garden machinery.
  if (GARDEN.test(n)) return { reject: 'garden machinery (Garden Gear World)' };
  const power = POWER.test(n);
  if ((CAR.test(n) || CAR_FEED.test(cat)) && !(power && !CAR.test(n))) return { reject: 'for cars and vans (Car Gear World has SGS)' };
  if (PART.test(n) && !power && !HAND.test(n)) return { reject: 'spare part or repair kit' };
  if ((FIXINGS.test(n) || /screws?\b/i.test(n)) && !/\b(gun|driver|nailer|drill)\b/i.test(n)) return { site: 'cgw', siteCategory: 'Hand Tools', subcategory: 'DIY' };
  if (power) return { site: 'cgw', siteCategory: 'Power Tools', subcategory: 'Power Tools' };
  if (LIGHT.test(n)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Lighting' };
  if (SITE.test(n)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Site Equipment' };
  if (HAND.test(n)) return { site: 'cgw', siteCategory: 'Hand Tools', subcategory: 'Hand Tools' };
  // Only the feed category says so: placed, and listed in the report for checking (doubt).
  // ("Hardware > Tools" alone is not enough: in the first dry run it held mostly machine parts.)
  if (/tool storage|tool chests|tool cabinets|workshop storage|garage storage/i.test(cat)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Site Equipment' };
  if (/^power tools\b|> ?power tools >|workshop tools|^air compressors\b/i.test(cat)) return { site: 'cgw', siteCategory: 'Power Tools', subcategory: 'Power Tools', doubt: true };
  if (/^hand tools\b|> ?hand tools >/i.test(cat)) return { site: 'cgw', siteCategory: 'Hand Tools', subcategory: 'Hand Tools', doubt: true };
  return { reject: 'not a power tool, hand tool or site equipment' };
}
