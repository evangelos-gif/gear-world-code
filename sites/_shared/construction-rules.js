// General category rules for Construction Gear World (CGW): the same kind of rules the newer sites have (the product NAME
// decides, the shop's section helps; lessons L14, L65). Owner, 31 Oct 2026: every product through the Hub, the same logic
// on all 11 sites. Tuned against the products CGW showed that day (85,596; the UK shops among them) with
// tools/legacy-rules-compare.mjs.
//
// How a product is placed:
//   1. The category whose words come LAST in the head of the name wins ("Spirit Level and Screwdriver Bit Set" is a bit
//      set); the head is the name before " for ", " with ", " - " etc. When two rules end at the same place, the longer,
//      more specific phrase wins ("Circular Saw" is a power tool, "Saw" a hand tool; "Impact Wrench" power, "Wrench" hand).
//   2. A word of another kind of product AFTER the type leaves it out ("Socket Set for Brake Calipers" is a car tool).
//      Garden machines, car and bike tools, fashion, children's and home products belong to other Gear Worlds.
//   3. No word in the name: the shop's section ("Measuring Tools > Tape Measures"), if the shop's sections are reliable.
//   4. The subcategory is the type word that comes last, with the names the site already uses ("Hi-Vis", "Rigger Boots").

import { fixMojibake } from '../../src/db.js';
import { words, lastAt, headOf, OFFICE_PARTS } from './fashion-rules.js';

// The match of `re` in `text` that ends last; among those, the longest. -1 when none.
function lastMatch(re, text) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let end = -1, len = 0, m;
  while ((m = g.exec(text))) {
    const e = m.index + m[0].length, l = m[0].trim().length;
    if (e > end || (e === end && l > len)) { end = e; len = l; }
    g.lastIndex = m.index + 1;
  }
  return { end, len };
}

const HARD_DENY = words(['gift cards?', 'gift vouchers?', 'vouchers?']);
// re: words that leave a product out when they come AFTER its type in the name; anywhere: wherever they are.
const DENY = [
  { re: /$^/, anywhere: OFFICE_PARTS, label: 'office or computer part (Technology Gear World)' },
  { re: words(['lawn ?mowers?', 'mowers?', 'hedge ?trimmers?', 'hedgecutters?', 'grass (?:trimmers?|shears)', 'strimmers?', 'line trimmers?', 'leaf blowers?', 'blower vac\\w*',
    'garden (?:vacs?|vacuums?|shredders?|forks?|spades?|rakes?|shears|hoses?|tools?|sprayers?|trowels?)', 'shredders?', 'secateurs', 'loppers?', 'pruners?', 'pruning (?:saws?|shears)',
    'hose ?pipes?', 'hose reels?', 'sprinklers?', 'brush ?cutters?', 'scarifiers?', 'lawn (?:rakers?|aerators?|spreaders?)', 'tillers?', 'cultivators?', 'chain ?saws?',
    'chain ?saw (?:chains?|bars?|oil)', 'pole (?:saws?|pruners?)', 'log splitters?', 'spool (?:&|and) line', 'trimmer (?:line|spools?)', 'compost\\w*', 'seeds?', 'planters?', 'watering cans?', 'weed\\w*']),
    anywhere: words(['for (?:the )?garden', 'garden use']), label: 'garden product (Garden Gear World)' },
  { re: words(['car', 'cars', 'vehicles?', 'automotive', 'motorbikes?', 'motorcycles?', 'tyres?', 'van', 'vans', 'caravans?', 'motorhomes?']),
    anywhere: words(['for (?:cars?|vans?|vehicles?|motorcycles?)', 'automotive', 'timing (?:tools?|kits?|belts?|chains?|locking\\w*)', 'brake (?:pipes?|calipers?|pistons?|bleed\\w*|discs?|pads?|shoes?|drums?|lines?|wind\\w*)',
      'engine (?:timing|hoists?|stands?|cranes?|oil|lift\\w*)', 'flywheels?', 'ball joints?', 'tie rods?', 'track rods?', 'cv (?:joints?|boots?)', 'oil filters?', 'spark plugs?', 'glow plugs?', 'injectors?', 'obd',
      'axle stands?', 'trolley jacks?', 'bottle jacks?', 'wheel (?:bearings?|nuts?|braces?|chocks?|alignment|balancers?|studs?)', 'steering', 'suspension', 'coil springs?', 'spring compressors?',
      'jump (?:starters?|leads)', 'battery (?:testers?|analy[sz]ers?)', 'clutch', 'exhausts?', 'alternators?', 'gearbox', 'camshafts?', 'crankshafts?', 'dent (?:repair|pullers?)', 'windscreens?', 'wipers?']),
    label: 'car tool (Car Gear World)' },
  { re: words(['bicycles?', 'bikes?', 'cycling', 'cycle (?:tools?|stands?|racks?|repair)']), label: 'cycling (Sporty Gear World)' },
  { re: words(['kids?', "kid'?s", "children'?s", 'childrens', 'child', 'toddlers?', 'baby', 'babies', 'toys?']), label: 'children\'s product (Kids\' Gear World)' },
  { re: words(['dress(?:es)?', 'skirts?', 'blouses?', 'bras?', 'lingerie', 'bikinis?', 'swim\\w*', 'handbags?', 'purses?', 'jewell?ery', 'necklaces?', 'earrings?', 'bracelets?', 'perfumes?',
    'eau de (?:parfum|toilette)', 'aftershaves?', 'make-?up', 'cufflinks?', 'watch(?:es)?']), label: 'fashion or beauty (Men\'s / Women\'s Gear World)' },
  { re: words(['mugs?', 'flasks?', 'lunch ?(?:box|bag)(?:es|s)?', 'kettles?', 'toasters?', 'cool ?box(?:es)?', 'tents?', 'sleeping bags?', 'camping', 'duvets?', 'cushions?', 'curtains?', 'candles?']),
    label: 'home or travel item (Home / Travel Gear World)' },
  { re: words(['laptops?', 'tablets?(?! (?:holders?|stands?))', 'iphone', 'ipad', 'phone cases?', 'headphones', 'earbuds', 'smart ?watch(?:es)?', 'monitor (?:mounts?|arms?|stands?)', 'desk mounts?',
    'keyboards?', 'mouse', 'mice', 'printers?', 'webcams?', '(?:wifi|wi-fi) routers?', 'usb hubs?', 'hdmi', 'cable clips', 'binders?', 'staples(?! (?:for|gun))']), label: 'tech or office product (Technology Gear World)' },
  { re: /$^/, anywhere: words(['dog (?:beds?|bowls?|leads?|collars?|toys?)', 'pet (?:beds?|bowls?|food|carriers?|hair)', 'cat (?:litter|toys?|trees?)']), label: 'pet item (not shown yet)' }
];

// sub: [subcategory as the site stores it, words]. /./ is the category's own default.
const RULES = [
  { key: 'safety-footwear', slug: 'safety-footwear',
    include: words(['safety (?:boots?|shoes?|trainers?|footwear|wellingtons?|wellies|dealers?|chukkas?|hikers?)', 'boots?', 'shoes?', 'trainers?', 'wellingtons?', 'wellies', 'rigger boots?', 'riggers',
      'dealer boots?', 'chelsea boots?', 'chukkas?', 'hikers?', 'footwear', 'insoles?', 'boot (?:laces|polish|care|dryers?)', 'laces', 'over ?shoes?', 'clogs?', 'safety sandals?', 'waders?', 'chest waders?']),
    subs: [['Rigger Boots', words(['rigger boots?', 'riggers'])], ['Wellingtons', words(['wellingtons?', 'wellies', 'wellington boots?', 'waders?'])], ['Safety Trainers', words(['trainers?'])],
      ['Safety Shoes', words(['shoes?', 'clogs?', 'sandals?'])], ['Insoles & Footwear Care', words(['insoles?', 'laces', 'polish', 'boot care', 'dryers?', 'over ?shoes?'])], ['Safety Boots', /./]] },
  { key: 'ppe', slug: 'ppe',
    include: words(['ppe', 'safety (?:glasses|specs|spectacles|goggles|eye ?wear|helmets?|harness(?:es)?|signs?)', 'goggles', 'over ?specs', 'visors?', 'face (?:shields?|masks?|visors?)', 'masks?', 'respirators?',
      'dust masks?', 'ffp[123]', 'respirator filters?', '(?:p[123]|a[12]p[123]|abek\\w*) filters?', 'hard ?hats?', 'helmets?', 'bump caps?', 'ear ?defenders?', 'ear ?plugs?', 'ear ?muffs?', 'ear protectors?', 'hearing protect\\w*', 'spectacles?', 'gas filters?', 'particulate filters?', 'chin straps?', 'knee-pads?',
      'harness(?:es)?', 'lanyards?', 'fall (?:arrest|protection)', 'fall arrest\\w*', 'anchor (?:straps?|slings?)', 'first aid', 'eye ?wash', 'burns? (?:kits?|dressings?)', 'plasters',
      'knee ?pads?', 'knee (?:protectors?|guards?)', 'kneeling (?:pads?|mats?)', 'kneelers?', 'hand (?:cleaners?|wipes?|sanitis\\w*|creams?|soaps?)', 'barrier creams?', 'swarfega',
      'disposable (?:coveralls?|overalls?|gloves)', 'type 5/6', 'nitrile gloves', 'latex gloves', 'vinyl gloves', 'disposable (?:nitrile |latex |vinyl )?gloves',
      'safety signs?', 'warning signs?', 'signs?', 'barriers?', 'barrier tape', 'cones?', 'traffic cones?', 'gas detectors?', 'smoke (?:alarms?|detectors?)', 'carbon monoxide', 'co (?:alarms?|detectors?)',
      'fire (?:extinguishers?|blankets?)', 'welding (?:helmets?|masks?|gloves?|aprons?|screens?|curtains?)', 'safety & detectors', 'personal protective']),
    subs: [['Eye & Face Protection', words(['glasses', 'specs', 'spectacles?', 'goggles', 'eye ?wear', 'visors?', 'face shields?', 'welding (?:helmets?|masks?)'])],
      ['Respiratory Protection', words(['masks?', 'respirators?', 'ffp[123]', 'filters?'])], ['Head Protection', words(['hard ?hats?', 'helmets?', 'bump caps?', 'chin straps?'])],
      ['Hearing Protection', words(['ear ?defenders?', 'ear ?plugs?', 'ear ?muffs?', 'ear protectors?', 'hearing'])], ['Fall Protection', words(['harness(?:es)?', 'lanyards?', 'fall', 'anchor'])],
      ['First Aid', words(['first aid', 'eye ?wash', 'burns?', 'plasters'])], ['Knee Protection', words(['knee', 'knee-pads?', 'kneeling', 'kneelers?'])],
      ['Hand Care & Hygiene', words(['hand (?:cleaners?|wipes?|sanitis\\w*|creams?|soaps?)', 'barrier creams?', 'swarfega', 'nitrile gloves', 'latex gloves', 'vinyl gloves', 'disposable (?:nitrile |latex |vinyl )?gloves'])],
      ['Disposable Coveralls', words(['coveralls?', 'overalls?'])], ['Safety Signs & Barriers', words(['signs?', 'barriers?', 'barrier tape', 'cones?'])], ['PPE', /./]] },
  { key: 'workwear', slug: 'workwear',
    include: words(['workwear', 'work ?wear', 'trousers?', 'pants', 'jeans', 'chinos', 'joggers', 'shorts', 'hipsters', 'jerkins?', 'hoods?', 'zip pullers?', 'tool belts?', 'tool braces', 'jackets?', 'coats?', 'parkas?', 'fleeces?', 'soft ?shells?', 'hoodies?', 'hoody', 'sweat ?shirts?',
      'sweats?', 'jumpers?', 'sweaters?', 'polos?', 'polo shirts?', 't-?shirts?', 'tees?', 'shirts?', 'tops?', 'gilets?', 'body ?warmers?', 'vests?', 'waistcoats?', 'coveralls?', 'overalls?', 'boiler ?suits?',
      'bib (?:and|&|n) brace', 'bib ?(?:pants|trousers)', 'salopettes', 'waterproofs?', 'rain ?(?:jackets?|suits?|trousers|wear)', 'leggings', 'base ?layers?', 'thermals?', 'aprons?', 'tabards?', 'smocks?',
      'socks?', 'beanies?', 'hats?', 'caps?', 'snoods?', 'neck (?:warmers?|gaiters?|tubes?)', 'balaclavas?', 'headwear', 'gloves?', 'gauntlets?', 'mitts', 'belts?', 'braces', 'holsters?', 'hi[- ]?vis\\w*',
      'high visibility', 'uniforms?', 'tunics?', 'scrubs?', 'clothing']),
    subs: [['Hi-Vis', /(?:^|[^a-z0-9])(?:hi[- ]?vis\w*|high visibility)(?![a-z0-9]).*$/i], ['Work Gloves', words(['gloves?', 'gauntlets?', 'mitts'])],
      ['Work Trousers', words(['trousers?', 'pants', 'jeans', 'chinos', 'joggers', 'leggings'])], ['Work Shorts', words(['shorts'])],
      ['Shirts, Polos & T-Shirts', words(['polos?', 'polo shirts?', 't-?shirts?', 'tees?', 'shirts?', 'tops?'])], ['Hoodies & Sweatshirts', words(['hoodies?', 'hoody', 'sweat ?shirts?', 'sweats?', 'jumpers?', 'sweaters?'])],
      ['Fleeces & Softshells', words(['fleeces?', 'soft ?shells?'])], ['Jackets & Coats', words(['jackets?', 'coats?', 'parkas?'])], ['Bodywarmers & Gilets', words(['gilets?', 'body ?warmers?', 'vests?', 'waistcoats?'])],
      ['Coveralls & Overalls', words(['coveralls?', 'overalls?', 'boiler ?suits?', 'bib (?:and|&|n) brace', 'bib ?(?:pants|trousers)', 'salopettes'])],
      ['Waterproofs', words(['waterproofs?', 'rain ?(?:jackets?|suits?|trousers|wear)'])], ['Base Layers', words(['base ?layers?', 'thermals?'])], ['Tabards & Aprons', words(['aprons?', 'tabards?', 'smocks?'])],
      ['Socks', words(['socks?'])], ['Headwear', words(['beanies?', 'hoods?', 'hats?', 'caps?', 'snoods?', 'neck (?:warmers?|gaiters?|tubes?)', 'balaclavas?', 'headwear'])],
      ['Workwear Accessories', words(['belts?', 'braces', 'holsters?', 'zip pullers?'])], ['Workwear', /./]] },
  { key: 'power-tools', slug: 'power-tools',
    include: words(['power tools?', 'power tool (?:kits?|accessor(?:y|ies)|sets?)', 'combo kits?', '(?:twin|triple|quad) (?:packs?|kits?)', 'tool accessories', 'drills?', 'combi drills?', 'hammer drills?',
      'sds(?:[- ]?(?:plus|max))? (?:[\\w-]+ ){0,3}(?:drills?|hammers?|chisels?|bits?|drill bits?)', 'hex shank (?:[\\w-]+ ){0,2}chisels?', 'router cutters?', '(?:[\\w-]+ )?router cutters?',
      'air (?:[\\w-]+ ){0,3}(?:ratchets?|wrench(?:es)?|screwdrivers?|hammers?|drills?|sanders?|grinders?|nailers?|staplers?|tools?|chisels?|saws?|polishers?)',
      'cordless (?:[\\w-]+ ){0,3}(?:screwdrivers?|staplers?|nibblers?|shears|ratchets?|ratchet wrench(?:es)?|wrench(?:es)?|nut ?(?:drivers?|setters?)|riveters?|grease guns?|caulking guns?|tackers?)',
      'electric (?:[\\w-]+ ){0,2}(?:screwdrivers?|staplers?|tackers?|nail guns?)', 'nutsetters?', 'impact (?:[\\w-]+ ){0,2}nut drivers?', 'nibblers?', 'metal shears', 'shear heads?',
      '(?:flip ?over|metal|cut ?off|dry cut\\w*|mitre|chop) (?:[\\w-]+ )?saws?', 'radios?', 'job ?site (?:radios?|speakers?)', '(?:bluetooth )?speakers?', 'ventilators?', 'ducting', 'welding rods?', 'rotary hammers?', 'breakers?', 'demolition hammers?', 'impact drivers?', 'drill drivers?', 'drivers?', 'impact wrench(?:es)?',
      'air (?:ratchets?|impact wrench(?:es)?|hammers?|drills?|sanders?|grinders?|nailers?|staplers?|tools?|chisels?|hoses?|lines?|fittings?|couplers?|couplings?|blow guns?)', 'spray guns?', 'paint sprayers?',
      'grinders?', 'angle grinders?', 'sanders?', 'polishers?', 'planers?', 'routers?', 'laminate trimmers?', 'circular saws?', 'mitre saws?', 'miter saws?', 'chop saws?', 'jig ?saws?', 'reciprocating saws?', 'sabre saws?',
      'table saws?', 'plunge saws?', 'track saws?', 'band ?saws?', 'scroll saws?', 'cut-?off saws?', 'disc cutters?', 'wall chasers?', 'tile saws?', 'multi[- ]?cutters?', 'oscillating (?:multi[- ]?)?tools?',
      'multi[- ]?tool (?:blades?|accessor(?:y|ies))', 'rotary (?:multi[- ]?)?tools?', 'engravers?', 'generators?', 'countersinks?', 'rotary burrs?', 'burrs?',
      'polishing (?:pads?|bonnets?|sponges?|mops?|heads?|wheels?)', 'buffing (?:wheels?|pads?|bonnets?)', 'compounding heads?', 'guide rails?', 'guide rail \\w+', 'templates?', 'jigs?',
      'hoses?', 'extraction hoses?', 'dust (?:bags?|blowers?)', 'filter bags?', 'nozzles?', 'morticers?', 'mortisers?', 'mortice (?:bits?|chisels?)', 'glue sticks?', 'dust bag holders?', 'dremel', 'nail guns?', 'nailers?', 'framing nailers?', 'heat guns?', 'glue guns?', 'hot air guns?', 'soldering (?:irons?|guns?|stations?)', 'soldering',
      'mixers?', 'paddle mixers?', 'mixing (?:drills?|paddles?|whisks?)', 'core (?:drills?|bits?)', 'diamond (?:core\\w*|blades?|discs?)', 'drill bits?', 'bits?', 'bit sets?', 'hole ?saws?', 'holesaws?',
      'saw blades?', 'blades?', 'discs?', 'sanding (?:sheets?|discs?|belts?|pads?|rolls?|mesh)', 'abrasives?', 'flap (?:discs?|wheels?)', 'wire (?:wheels?|cups?|cup brush(?:es)?)', 'chucks?', 'arbors?',
      'batter(?:y|ies)', 'chargers?', 'li-?ion', 'router bits?', 'biscuit jointers?', 'thicknessers?', 'lathes?', 'pillar drills?', 'drill press(?:es)?', 'mag(?:netic)? drills?', 'dust shrouds?']),
    subs: [['Power Tools', /./]] },
  { key: 'site-equipment', slug: 'site-equipment',
    include: words(['site equipment', 'tape measures?', 'measuring (?:tapes?|wheels?|tools?)', 'measures?', 'spirit levels?', 'levels?', 'laser (?:levels?|measures?|distance\\w*|receivers?|detectors?)', 'line lasers?',
      'lasers?', 'distance meters?', '(?:try|roofing|combination|set|framing|speed|carpenters?|engineers?) squares?', 'bevels?', 'calipers?', 'callipers?', 'micrometers?', 'verniers?', 'feeler gauges?',
      'multimeters?', 'testers?', 'detectors?', 'thermal (?:imagers?|cameras?)', 'inspection cameras?', 'moisture meters?', 'meters?', 'clamp meters?', 'magnets?', 'trolleys?', 'sack trucks?', 'pallet trucks?',
      'carts?', 'hand trucks?', 'dollies', 'platform trucks?', 'wheelbarrows?', 'ladders?', 'step ?ladders?', 'steps', 'step stools?', 'trestles?', 'platforms?', 'scaffold(?:ing| towers?)?', 'towers?',
      'heaters?', 'fans?', 'dehumidifiers?', 'air movers?', '\\d+ (?:way|gang) (?:extension )?(?:leads?|sockets?)', '\\d+ sockets? extension leads?', 'usb sockets?',
      'tripods?', 'clamp mounts?', 'mounts?', 'rules?', 'steel rules?', 'folding rules?', 'bins?', 'mixing bins?', 'tub ?tops?', 'holdalls?', 'duffle bags?', 'kit bags?', 'bags?', 'tidee\\w*', 'extension (?:leads?|reels?|cables?|sockets?)', 'cable reels?', 'transformers?', 'rcds?', 'power banks?', 'work ?lights?', 'site lights?',
      'flood ?lights?', 'torch(?:es)?', 'head ?torch(?:es)?', 'headlamps?', 'lanterns?', 'lamps?', 'lights?', 'task lights?', 'inspection lamps?', 'lighting',
      'tool ?(?:box(?:es)?|bags?|chests?|cabinets?|cases?|belts?|pouch(?:es)?|holders?|rolls?|storage|organi[sz]ers?|trolleys?|walls?)', 'roller cabinets?', 'top box(?:es)?', 'tstak', 'makpac', 'l-?boxx',
      'sortimo', 'tough ?system', 'packout', 'organi[sz]ers?', 'storage(?: boxes?| units?| racks?| cases?)?', 'racking', 'shelving', 'cabinets?', 'lockers?', 'site box(?:es)?', 'van vaults?', 'vaults?', 'chests?',
      'work ?stations?', 'workshop systems?', 'garage (?:storage|flooring)', 'pegboards?', 'vacuums?', 'vacs?', 'dust extractors?', 'extractors?', 'hoovers?', 'wet (?:and|&) dry', 'pressure washers?', 'jet washers?',
      'steam cleaners?', 'floor (?:cleaners?|scrubbers?)', 'carpet cleaners?', 'compressors?', 'air compressors?', 'welders?', 'welding', 'plasma cutters?', 'tubs?', 'buckets?', 'trugs?', 'gripsters?',
      'suction (?:lifters?|cups?|pads?)', 'lifting (?:magnets?|clamps?|straps?|slings?)', 'winch(?:es)?', 'hoists?', 'pumps?', 'blow ?torch(?:es)?', 'gas torch(?:es)?', 'torches? kits?',
      'measuring tools', 'tool boxes & storage', 'ladders & sack trucks', 'detectors & testing', 'lighting & torches', 'cleaning & drainage', 'electrical']),
    subs: [['Lighting', words(['work ?lights?', 'site lights?', 'flood ?lights?', 'torch(?:es)?', 'head ?torch(?:es)?', 'headlamps?', 'lanterns?', 'lamps?', 'lights?', 'lighting'])],
      ['Vacuum Cleaners', words(['vacuums?', 'vacs?', 'dust extractors?', 'hoovers?', 'wet (?:and|&) dry'])], ['Laundry & Cleaning', words(['pressure washers?', 'jet washers?', 'steam cleaners?', 'floor (?:cleaners?|scrubbers?)', 'carpet cleaners?'])],
      ['Mixing Tubs & Buckets', words(['tubs?', 'buckets?', 'trugs?'])], ['Site Equipment', /./]] },
  { key: 'hand-tools', slug: 'hand-tools',
    include: words(['hand tools?', 'tools?', 'tool (?:kits?|sets?)', 'hardware', 'sockets?', 'socket (?:sets?|rails?|adaptors?|adapters?|converters?)', 'spanners?', 'wrench(?:es)?', 'ratchets?', 'extension bars?',
      'breaker bars?', 'torque (?:wrench(?:es)?|multipliers?)', 'screwdrivers?', 'nut drivers?', 'bit drivers?', 'hex keys?', 'allen keys?', 'torx keys?', 'key sets?', 'pliers?', 'plier sets?', 'grips', 'bars?', 'claw bars?', 'nut spinners?', 'spinner handles?', 't[- ]?bars?', 't[- ]?handles?', 'universal joints?',
      'padlocks?', 'locks?', 'hasps?', 'impact sockets?', 'impact socket sets?', '(?:[\\w-]+ )?socket bits?', 'socket bit sets?', '(?:[\\w-]+ ){0,2}bit holders?', 'screwdriver blades?', 'sanding blocks?', 'hand sanders?', '(?:replacement|spare) (?:[\\w-]+ ){0,2}blades?', 'skimmer blades?',
      'surform\\w*', 'coping saw blades?', 'shaver tools?', 'mole grips', 'cutters?', 'snips',
      'shears', 'strippers?', 'crimp(?:ers?|ing tools?)', 'knives', 'knife', 'knife blades?', 'utility blades?', 'snap-?off blades?', 'hack ?saw blades?', 'scraper blades?', 'trimming knives?', 'hammers?',
      'mallets?', 'sledge ?hammers?', 'chisels?', 'bolsters?', 'punch(?:es)?', 'files?', 'rasps?', 'saws?', 'hand ?saws?', 'hack ?saws?', 'coping saws?', 'pad saws?', 'tenon saws?', 'pruning', 'planes?',
      'spokeshaves?', 'scrapers?', 'trowels?', 'floats?', 'hawks?', 'plastering', 'pointing', 'jointers?', 'marking (?:gauges?|pens?|knives?)', 'pencils?', 'chalk (?:lines?|reels?)', 'scribers?', 'markers?',
      'crowbars?', 'pry ?bars?', 'wrecking bars?', 'nail pullers?', "cat'?s paws?", 'staplers?', 'staple guns?', 'riveters?', 'rivet (?:guns?|tools?)', 'rivets?', 'tackers?', 'sealant guns?', 'caulking guns?',
      'silicone guns?', 'grease guns?', 'pipe (?:cutters?|wrench(?:es)?|benders?|slices?|grips?|freez\\w*)', 'tube cutters?', 'basin wrench(?:es)?', 'plumbing(?: tools?)?', 'plungers?', 'drain (?:rods?|augers?|snakes?|unblockers?)',
      'taps? (?:and|&) dies?', 'tap wrench(?:es)?', 'die (?:holders?|nuts?)', 'thread (?:gauges?|files?|repair)', '(?:screw|stud|bolt) extractors?', 'magnetic (?:trays?|pick-?ups?)', 'pick-?up tools?', 'inspection mirrors?',
      'vices?', 'clamps?', 'workbench(?:es)?', 'work ?benches?', 'saw ?horses?', 'tile (?:cutters?|nippers?|spacers?|trowels?)', 'grout (?:floats?|rakes?|removers?)', 'paint (?:brushes?|rollers?|trays?|kettles?)',
      'brush(?:es)?', 'rollers?', 'roller (?:frames?|sleeves?)', 'decorating', 'dust sheets?', 'tapes?', 'masking tape', 'filling knives?', 'putty knives?', 'wallpaper\\w*', 'screws', 'bolts', 'nuts', 'washers',
      'nails', 'wall plugs?', 'anchors?', 'fixings?', 'fasteners?', 'cable ties?', 'sharpening stones?', 'oil ?stones?', 'whetstones?', 'tweezers', 'brooms?', 'shovels?', 'spades?', 'picks?', 'pick ?axes?',
      'mattocks?', 'forks?', 'rakes?', 'squeegees?', 'axes?', 'hatchets?', 'multi-?tools?', 'gauges?', 'flaring tools?', 'engineering tools', 'fixings & fasteners', 'tool kits']),
    subs: [['Brooms', words(['brooms?', 'broom heads?', 'yard brushes?'])], ['Shovels', words(['shovels?'])], ['Hand Tools', /./]] }
];

export const CATEGORY_NAMES = {
  cgw: { 'safety-footwear': 'Safety Boots', workwear: 'Workwear', ppe: 'PPE', 'power-tools': 'Power Tools', 'hand-tools': 'Hand Tools', 'site-equipment': 'Site Equipment' }
};

// The rule whose words come last in the text; same end: the longer phrase; still equal: the earlier rule.
function bestRule(text) {
  let best = null, at = -1, len = 0;
  for (const r of RULES) {
    const m = lastMatch(r.include, text);
    if (m.end < 0) continue;
    if (m.end > at || (m.end === at && m.len > len)) { best = r; at = m.end; len = m.len; }
  }
  return best ? { rule: best, at } : null;
}

// The part of the name that says what the product is: the head (headOf), without what comes with it or not ("Cordless
// LED Torch No Batteries No Battery Charger No Case", "Spanner Set in Tool Roll", "Socket Set on Belt").
const NOT_INCLUDED = /\b(?:no|without|excl\.?|excluding|less)\s+(?:li-?ion\s+)?(?:battery chargers?|batter(?:y|ies)|chargers?|case|bag|box)\b/gi;
const PACKED_IN = /\s+(?:in|on)\s+(?:an?\s+)?(?:[\w-]+\s+){0,2}(?:case|box|roll|bag|wallet|pouch|belt|rack|rail|tray|clip rail|holder|stand|module tray|cassette)\b.*$/i;
function typeOf(n) {
  const head = headOf(String(n).replace(NOT_INCLUDED, ' ').replace(/\s+\d+\s*x\s*\d+(?:\.\d+)?\s*ah\b.*$/i, '').replace(/\s{2,}/g, ' '));
  const cut = head.replace(PACKED_IN, '');
  return cut.length > 3 ? cut : head;
}

export function makeRules(site) {
  if (site !== 'cgw') throw new Error(`construction rules: unknown site ${site}`);
  const slugs = Object.keys(CATEGORY_NAMES[site]);
  function classify(name, feedCategory = '', paths = '', source = null) {
    const n = String(name || '');
    if (HARD_DENY.test(n)) return { ok: false, reason: 'gift card or voucher' };
    const head = typeOf(n);
    // "Spirit Level and Screwdriver Bit Set", "Heated Bodywarmer and Power Bank": the first thing named is the product.
    const parts = head.split(/\s+(?:and|&|\+)\s+/i);
    const first = parts.length > 1 ? parts[0] : '';
    let hit = first && bestRule(first), where = first, from = 'name';
    if (!hit) { hit = bestRule(head); where = head; }
    if (!hit) { hit = bestRule(n); where = n; }
    if (!hit) {
      const hints = source ? source.sectionHints : true;
      const top = String(feedCategory || '').split('>')[0].trim().toLowerCase();
      const trusted = hints !== false && (!Array.isArray(hints) || hints.some(h => String(h).toLowerCase() === top));
      if (trusted) hit = bestRule(String(feedCategory || ''));
      from = 'section';
      if (!hit && source && source.defaultCategory) { const r = RULES.find(x => x.key === source.defaultCategory); if (r) { hit = { rule: r, at: n.length }; from = 'shop'; } }
    }
    for (const d of DENY) {
      if (d.anywhere && d.anywhere.test(n)) return { ok: false, reason: d.label };
      if (from === 'shop') continue;
      if (from === 'section' || !hit ? d.re.test(n) : lastAt(d.re, where) > hit.at) return { ok: false, reason: d.label };
    }
    if (!hit) return { ok: false, reason: 'not a construction product' };
    const rule = hit.rule;
    const pickSub = text => {
      let best = null, at = -1, len = 0;
      for (const [label, re] of rule.subs) {
        if (re.source === '.') continue;
        const m = lastMatch(re, text);
        if (m.end > at || (m.end === at && m.len > len)) { best = m.end >= 0 ? label : best; at = m.end; len = m.len; }
      }
      return best;
    };
    const sub = (from === "name" && pickSub(where)) || pickSub(head) || pickSub(n) || (rule.subs.find(([, re]) => re.source === '.') || [])[0] || CATEGORY_NAMES[site][rule.slug];
    return { ok: true, slug: rule.slug, subcategory: sub, category: CATEGORY_NAMES[site][rule.slug] };
  }
  return { classify, CATEGORY_SLUGS: slugs };
}

export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\])\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Minimum quality for any product to be imported (L14). Prices in pounds; a generator or a workshop system can cost a few thousand.
export const QUALITY = {
  currencies: ['GBP'],
  minPrice: 1,
  maxPrice: 20000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};
