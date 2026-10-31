// General category rules for Home Gear World (HGW) and Garden Gear World (GGW): the same kind of rules the newer sites have
// (the product NAME decides, the shop's section helps; lessons L14, L65), shared by both sites because their shops overlap
// (Joybuy, Plusshop, Bazta, Gardenista, Cronjager). Owner, 31 Oct 2026: every product through the Hub, the same logic on all
// 11 sites. Tuned against the products both sites showed that day (14,080 on HGW, 3,382 on GGW) with
// tools/legacy-rules-compare.mjs.
//
// How a product is placed:
//   1. One list of categories for both sites. The category whose words come LAST in the head of the name wins ("Garden
//      Furniture Cover" is a cover, "Coffee Table Lamp" a lamp); the head is the name before " for ", " with ", " - " etc.
//   2. "Garden", "outdoor", "patio", "solar" and the like move furniture, lights, cushions and brooms to the garden site.
//   3. A word of another kind of product AFTER the type leaves it out ("Phone Case for Kettle" is not a kettle).
//   4. No word in the name: the shop's section ("Home & Garden > Lighting > ..."), if the shop's sections are reliable.
//   5. The subcategory is the type word that comes last, with the name each site already uses ("Coffee Table", "Rakes").

import { fixMojibake } from '../../src/db.js';
import { words, lastAt, headOf, OFFICE_PARTS } from './fashion-rules.js';

const GARDEN = words(['garden', 'gardens', 'outdoor', 'outdoors', 'patio', 'lawn', 'solar', 'rattan', 'balcony', 'decking', 'bistro', 'parasol', 'festoon', 'garden ?furniture', 'alfresco', 'allotment', 'greenhouse']);
const INDOOR = words(['indoor', 'living room', 'bedroom', 'kitchen', 'bathroom', 'office']);

// Not for these two sites (other Gear Worlds or nobody's).
const HARD_DENY = words(['gift cards?', 'gift vouchers?', 'vouchers?']);
const DENY = [
  { re: words(["men'?s", "women'?s", 'ladies', 't-?shirts?', 'jumpers?', 'jackets?', 'trousers', 'jeans', 'dress(?:es)?', 'shoes?', 'trainers?', 'boots', 'socks', 'hoodies?', 'sweatshirts?', 'crew(?: ?necks?)?', 'tees', 'leggings', 'bras?']),
    label: 'clothing (Men\'s / Women\'s Gear World)' },
  { re: /$^/, anywhere: OFFICE_PARTS, label: 'office or computer part (Technology Gear World)' },
  { re: words(['brooch(?:es)?', 'earrings?', 'necklaces?', 'bracelets?', 'cufflinks?', 'lapel pins?', 'pin badges?']), label: 'jewellery (Women\'s / Men\'s Gear World)' },
  { re: words(['crisps', 'snacks?', 'chocolates?', 'sweets', 'biscuits', 'cakes?(?! (?:stand|tins?|plates?|knife|slice))', 'sauce', 'coffee beans', 'ground coffee', 'tea bags', 'wine(?! (?:glass|glasses|rack|cooler|chiller|bottle opener|stopper|aerator))', 'beer', 'gin(?! glass)', 'whisky']),
    label: 'food or drink (not shown)' },
  { re: words(['toys?', 'kids?', "children'?s", 'baby', 'nursery', 'toddlers?', 'lego', 'dolls?', 'teddy']), label: 'children\'s product (Kids\' Gear World)' },
  { re: words(['dogs?', 'cats?', 'puppy', 'kitten', 'aquariums?']), anywhere: words(['for (?:dogs?|cats?|pets?)(?! hair)', 'pet (?:beds?|bowls?|toys?|food|treats?|carriers?|cages?|collars?|leads?)']), label: 'pet item (not shown yet)' },
  { re: words(['iphone', 'samsung galaxy', 'phone cases?', 'screen protectors?', 'laptops?(?! (?:stands?|desks?|tables?|risers?|trays?))', 'tablets?(?! (?:stands?|holders?))', 'headphones', 'earbuds', 'graphics cards?', 'ssd', 'hard drives?', 'memory cards?', 'toner', 'ink cartridges?', 'cartridges?']),
    label: 'tech product (Technology Gear World)' },
  { re: words(['car', 'cars', 'vehicle', 'motorbike', 'motorcycle', 'tyres?', 'van']), anywhere: words(['for cars?', 'car (?:wash|shampoo|wax|polish|seat|mats?|charger|vacuum)']), label: 'car product (Car Gear World)' },
  { re: words(['tents?', 'sleeping bags?', 'camping', 'hiking', 'suitcases?', 'luggage']), label: 'camping or travel (Travel Gear World)' },
  { re: words(['protein', 'supplements?', 'vitamins?', 'medicines?', 'condoms?', 'make-?up', 'lipsticks?', 'perfumes?', 'eau de (?:parfum|toilette)', 'shampoo(?! (?:carpet|upholstery))', 'conditioner(?! (?:fabric))', 'moisturi[sz]er', 'serum']),
    label: 'health or beauty (Women\'s / Men\'s Gear World)' },
  { re: words(['drills?', 'drill bits?', 'impact drivers?', 'angle grinders?', 'circular saws?', 'jigsaws?', 'mitre saws?', 'sanders?', 'routers?(?! (?:wifi|wi-fi))', 'planers?', 'nail guns?', 'multi-?tools? (?:oscillating)', 'socket sets?', 'spanners?', 'wrench(?:es)?', 'screwdrivers?', 'workbench(?:es)?', 'ladders?', 'scaffold', 'welding', 'welders?', 'compressors?', 'generators?', 'jack stands?', 'trolley jacks?']),
    label: 'tool (Construction Gear World)' },
  { re: words(['party (?:supplies|decorations?|balloons?)', 'balloons?', 'confetti', 'banners?', 'bunting(?! lights?)']), label: 'party supplies (not shown)' }
];

// sub: [subcategory as the site stores it, words]. The category default is the first subcategory of the site's own list.
const RULES = [
  // ---------- Garden (GGW) ----------
  { key: 'power-garden-tools', site: 'ggw', slug: 'power-garden-tools',
    include: words(['lawn ?mowers?', 'mowers?', 'grass trimmers?', 'strimmers?', 'line trimmers?', 'string trimmers?', 'hedge ?trimmers?', 'hedgecutters?', 'leaf blowers?', 'garden blowers?', 'blowers?(?! (?:heater|fan))', 'garden vacs?', 'garden vacuums?', 'blower ?vacs?',
      'chainsaws?', 'chain saws?', 'pole saws?', 'pole pruners?', 'brush ?cutters?', 'tillers?', 'rotavators?', 'cultivators? (?:petrol|electric|cordless)', '(?:petrol|electric|cordless) cultivators?', 'scarifiers?', 'lawn rakers?', 'garden shredders?', 'shredders? (?:garden|petrol|electric)', 'cordless secateurs', 'grass shears (?:cordless|set)', 'cordless (?:grass|shrub) shears', 'shrub shears', 'spool(?: and| &)? line', 'trimmer (?:line|spool)', 'chainsaw (?:chains?|bars?|oil)', 'saw chains?', 'outdoor power tools?', 'garden multi[- ]?tools?', 'split ?shaft', 'log splitters?']),
    exclude: words(['toy', 'kids', 'cake']),
    subs: [['Hedge Trimmers', words(['hedge ?trimmers?', 'hedgecutters?'])], ['Grass Trimmers', words(['grass trimmers?', 'strimmers?', 'line trimmers?', 'string trimmers?', 'trimmer (?:line|spool)', 'spool'])],
      ['Garden Blowers', words(['leaf blowers?', 'garden blowers?', 'blowers?', 'blower ?vacs?'])], ['Garden Vacuums', words(['garden vacs?', 'garden vacuums?'])], ['Chainsaws & Accessories', words(['chainsaws?', 'chain saws?', 'chainsaw (?:chains?|bars?|oil)', 'saw chains?'])],
      ['Power Garden Saws', words(['pole saws?', 'pole pruners?'])], ['Brush Cutters & Blades', words(['brush ?cutters?'])], ['Tillers', words(['tillers?', 'rotavators?', 'cultivators?'])], ['Lawn Rakers & Scarifiers', words(['scarifiers?', 'lawn rakers?'])],
      ['Garden Shredders', words(['shredders?'])], ['Cordless Secateurs', words(['cordless secateurs'])], ['Shrub Shears', words(['shrub shears', 'grass shears'])], ['Lawnmowers & Accessories', words(['lawn ?mowers?', 'mowers?'])], ['Outdoor Power Tools', /./]] },
  { key: 'garden-tools', site: 'ggw', slug: 'garden-tools',
    include: words(['spades?', 'shovels?', 'garden forks?', 'digging forks?', 'border forks?', 'rakes?', 'hoes?', 'trowels?', 'hand forks?', 'secateurs', 'pruners?', 'loppers?', 'shears', 'pruning saws?', 'bow ?saws?', 'axes?', 'hatchets?', 'splitting (?:mauls?|wedges?)', 'wedges?', 'wheelbarrows?', 'garden (?:trolleys?|carts?)',
      'yard brooms?', 'garden brooms?', 'patio (?:brushes?|brooms?)', 'decking brushes?', 'stiff brooms?', 'leaf (?:grabbers?|collectors?|scoops?)', 'edging (?:irons?|shears)', 'lawn edgers?', 'dibbers?', 'bulb planters?', 'post hole (?:diggers?|augers?)', 'augers?', 'post rammers?', 'litter pickers?', 'cultivators?', 'grubbers?', 'lawn sweepers?', 'fruit pickers?', 'salt spreaders?', 'garden tool (?:kits?|sets?)', 'garden tools?', 'pop ?up bags?', 'garden (?:bags?|sacks?)', 'composters?', 'weeders?', 'scythes?', 'sickles?', 'billhooks?', 'mattocks?', 'pickaxes?']),
    exclude: words(['bbq rake', 'make-?up', 'nail', 'hair', 'kitchen', 'pastry', 'cake', 'pizza', 'carpet', 'toy']),
    subs: [['Rakes', words(['rakes?'])], ['Spades', words(['spades?', 'shovels?'])], ['Garden Forks', words(['garden forks?', 'digging forks?', 'border forks?'])], ['Hoes', words(['hoes?'])], ['Hand Forks & Trowels', words(['trowels?', 'hand forks?'])],
      ['Secateurs', words(['secateurs', 'pruners?(?! saw)'])], ['Loppers', words(['loppers?'])], ['Garden Shears', words(['shears'])], ['Pruning Saws', words(['pruning saws?'])], ['Bow Saws & Blades', words(['bow ?saws?'])], ['Axes & Wedges', words(['axes?', 'hatchets?', 'wedges?', 'splitting'])],
      ['Wheelbarrows', words(['wheelbarrows?'])], ['Garden Trolleys', words(['garden (?:trolleys?|carts?)'])], ['Garden Brooms and Brushes', words(['brooms?', 'brushes?'])], ['Leaf Collectors', words(['leaf (?:grabbers?|collectors?|scoops?)'])],
      ['Edging Irons', words(['edging', 'lawn edgers?'])], ['Bulb Planters & Dibbers', words(['dibbers?', 'bulb planters?'])], ['Post Hole Augers', words(['augers?'])], ['Post Hole Diggers', words(['post hole diggers?'])], ['Post Rammers', words(['post rammers?'])],
      ['Litter Pickers', words(['litter pickers?'])], ['Cultivators & Grubbers', words(['cultivators?', 'grubbers?', 'weeders?'])], ['Lawn Sweepers', words(['lawn sweepers?'])], ['Fruit Pickers', words(['fruit pickers?'])], ['Salt Spreaders', words(['salt spreaders?'])],
      ['Composters', words(['composters?'])], ['Pop Up Bags', words(['pop ?up bags?', 'garden (?:bags?|sacks?)'])], ['Garden Tool Kits', words(['tool (?:kits?|sets?)'])], ['Other Garden Accessories', /./]] },
  { key: 'bbq', site: 'ggw', slug: 'bbq-outdoor-cooking',
    include: words(['bbqs?', 'barbecues?', 'barbeques?', 'charcoal grills?', 'gas grills?', 'kamado', 'smokers?(?! (?:pipe|tobacco))', 'pizza ovens?', 'outdoor (?:kitchen|cooking|grill)', 'grill (?:brush|tongs|mat|cover)', 'kebab skewers?', 'skewers?', 'charcoal (?:bags?|briquettes?|starters?|chimneys?|baskets?|\\d+ ?kg)', '\\d+ ?kg (?:of )?charcoal', 'lumpwood', 'briquettes?', 'firelighters?', 'plancha', 'grill (?:lighters?|knives|tools?|sets?)']),
    exclude: words(['bbq sauce', 'grill pan', 'health grill', 'contact grill', 'toastie']),
    subs: [['Pizza ovens', words(['pizza ovens?'])], ['BBQ accessories', words(['brush', 'tongs', 'mat', 'covers?', 'skewers?', 'charcoal', 'briquettes?', 'firelighters?', 'accessor(?:y|ies)', 'tools?', 'thermometers?', 'gloves?'])], ['BBQs', /./]] },
  { key: 'garden-buildings', site: 'ggw', slug: 'garden-buildings-fencing-storage',
    include: words(['sheds?', 'summer ?houses?', 'log stores?', 'log cabins?', 'greenhouses?', 'polytunnels?', 'cold frames?', 'fence', 'fences', 'fencing', 'fence panels?', 'trellis(?:es)?', 'garden gates?', 'gates?', 'arbours?', 'arbors?', 'pergolas?', 'garden storage', 'storage (?:bench|benches|box|boxes|chests?|shed)s? (?:garden|outdoor|patio)', '(?:garden|outdoor|patio) storage', 'bike stores?', 'bin stores?']),
    exclude: words(['shed insulation tape', 'toy', 'kids', 'baby gates?', 'stair gates?', 'pet gates?', 'dog gates?']),
    subs: [['Greenhouses', words(['greenhouses?', 'polytunnels?', 'cold frames?'])], ['Log stores', words(['log stores?'])], ['Garden storage', words(['storage', 'bike stores?', 'bin stores?'])], ['Sheds', words(['sheds?', 'summer ?houses?', 'log cabins?'])], ['Sheds', /./]] },
  { key: 'watering', site: 'ggw', slug: 'watering-irrigation',
    include: words(['hoses?', 'hose ?pipes?', 'hose ?reels?', 'hose (?:connectors?|adaptors?|fittings?|carts?|guides?)', 'sprinklers?', 'spray (?:guns?|lances?|nozzles?)', 'water(?:ing)? (?:guns?|lances?|wands?)', 'watering cans?', 'water timers?', 'irrigation', 'micro ?drip', 'drip (?:kits?|systems?)', 'soaker hoses?', 'pressure sprayers?', 'knapsack sprayers?', 'garden sprayers?', 'water butts?', 'rain barrels?', 'tap connectors?', 'water pumps? (?:garden|rain)']),
    exclude: words(['shower hose', 'vacuum hose', 'hoover hose', 'washing machine', 'dishwasher', 'hair', 'perfume', 'mist(?:ing)? spray bottle', 'pressure washers?']),
    subs: [['Hose Reels & Storage', words(['hose ?reels?', 'hose carts?', 'hose (?:storage|hangers?)'])], ['Hose Adaptors & Connectors', words(['connectors?', 'adaptors?', 'fittings?', 'tap'])], ['Hose Pipes', words(['hoses?', 'hose ?pipes?'])],
      ['Garden Sprinklers', words(['sprinklers?'])], ['Spray Nozzles & Guns', words(['spray', 'guns?', 'lances?', 'nozzles?', 'wands?'])], ['Water Timers', words(['timers?'])], ['Irrigation Systems', words(['irrigation', 'micro ?drip', 'drip', 'soaker'])],
      ['Pressure Sprayers & Accessories', words(['sprayers?'])], ['Watering Accessories', /./]] },
  { key: 'plants', site: 'ggw', slug: 'plants-growing-garden-care',
    include: words(['seeds?', 'bulbs? (?:for planting|mix|collection)', 'flower bulbs?', 'plants?(?! (?:stand|based|power))', 'compost', 'fertili[sz]ers?', 'plant food', 'lawn (?:feed|seed|spreaders?)', 'grass seed', 'grow ?bags?', 'plant pots?', 'flower ?pots?', 'pots? (?:planter)', 'planters?', 'bonsai pots?', 'raised beds?', 'propagators?', 'cloches?', 'plant supports?', 'canes?', 'plant ties?', 'garden wire', 'weed ?killer', 'weed control', 'slug', 'pest control', 'bird (?:feeders?|baths?|tables?|boxes?|houses?|seed|food)', 'kneelers?', 'kneeling pads?', 'gardening gloves?', 'garden gloves?', 'potting', 'hanging baskets?', 'window boxes?', 'trugs?', 'houseplants?']),
    exclude: words(['seed (?:beads?|pearls?)', 'pot (?:noodles?|stand for kitchen)', 'cooking pots?', 'stock ?pots?', 'pots? and pans?', 'coffee', 'tea ?pots?', 'plant-based', 'plant milk']),
    subs: [['Seeds & bulbs', words(['seeds?', 'bulbs?'])], ['Lawn Spreaders', words(['spreaders?'])], ['Garden Kneelers', words(['kneelers?', 'kneeling'])], ['Ties & Wire', words(['ties', 'wire'])], ['Plants', words(['plants?', 'houseplants?'])], ['Growing', /./]] },
  { key: 'garden-storage', site: 'ggw', slug: 'garden-buildings-fencing-storage', needsGarden: true,
    include: words(['storage (?:boxes?|box|benches?|bench|chests?|cabinets?|units?|sheds?|bins?)', 'deck box(?:es)?', 'cushion (?:boxes?|storage)', 'log (?:racks?|holders?|baskets?|stores?)', 'firewood racks?']),
    subs: [['Log stores', words(['log', 'firewood'])], ['Garden storage', /./]] },
  { key: 'garden-furniture', site: 'ggw', slug: 'garden-furniture-outdoor-living', needsGarden: true,
    include: words(['furniture', 'sofas?', 'corner sets?', 'lounge sets?', 'dining sets?', 'bistro sets?', 'chairs?', 'benches', 'bench', 'tables?', 'loungers?', 'sun ?loungers?', 'day ?beds?', 'hammocks?', 'swing seats?', 'swing chairs?', 'egg chairs?', 'parasols?', 'gazebos?', 'awnings?', 'sail shades?', 'shade sails?', 'fire ?pits?', 'patio heaters?', 'chimineas?', 'cushions?', 'pillows?', 'seat pads?', 'rugs?', 'covers?', 'furniture (?:oil|care|cleaner)', 'windbreaks?', 'canopy', 'canopies']),
    exclude: words(['toy', 'kids', 'office', 'desk', 'gaming', 'bedside', 'dressing', 'coffee table books?']),
    subs: [['Furniture covers', words(['covers?'])], ['Cushions & rugs', words(['cushions?', 'pillows?', 'seat pads?', 'rugs?'])], ['Parasols, gazebos & shade', words(['parasols?', 'gazebos?', 'awnings?', 'sail shades?', 'shade sails?', 'canopy', 'canopies', 'windbreaks?'])],
      ['Fire pits & heaters', words(['fire ?pits?', 'patio heaters?', 'chimineas?'])], ['Hammocks & swing seats', words(['hammocks?', 'swing (?:seats?|chairs?)', 'egg chairs?'])], ['Loungers', words(['loungers?', 'day ?beds?'])],
      ['Lounge & corner sets', words(['corner sets?', 'lounge sets?', 'sofas?'])], ['Dining sets', words(['dining sets?'])], ['Bistro sets', words(['bistro sets?'])], ['Chairs & benches', words(['chairs?', 'benches', 'bench'])], ['Tables', words(['tables?'])],
      ['Furniture care', words(['oil', 'care', 'cleaner'])], ['Garden furniture', /./]] },
  { key: 'outdoor-lighting', site: 'ggw', slug: 'outdoor-lighting-garden-electrical',
    include: words(['string lights?', 'festoon(?: lights?)?', 'fairy lights?', 'light chains?', 'connectable lights?', 'pro connect', 'ultimate connect', 'solar lights?', 'solar (?:[\\w-]+ ){0,3}(?:lights?|lamps?|lanterns?|spotlights?)', 'path lights?', 'spike lights?', 'stake lights?', 'post lights?', 'bollard lights?', 'deck lights?', 'flood ?lights?', 'security lights?', 'pir lights?', 'outdoor (?:lights?|lighting|lanterns?|wall lights?|lamps?|sockets?|extension)', 'garden (?:lights?|lighting|lanterns?|sockets?)', 'lanterns?', 'icicle lights?', 'net lights?', 'christmas lights?', 'tree lights?', 'light-?up (?:reindeer|figures?|trees?)', 'cable (?:white|black)', 'extension (?:cables?|leads?) for (?:connectable|string|festoon)', 'fairy light (?:cables?|extensions?)', 'transformers? for']),
    exclude: words(['ceiling', 'chandelier', 'pendant', 'lampshade', 'table lamp', 'floor lamp', 'bedside', 'desk lamp']),
    subs: [['String & festoon lights', words(['string lights?', 'festoon', 'fairy lights?', 'light chains?', 'connectable', 'pro connect', 'ultimate connect', 'icicle', 'net lights?', 'christmas lights?', 'tree lights?'])], ['Solar lights', words(['solar'])],
      ['Floodlights & security lights', words(['flood ?lights?', 'security lights?', 'pir'])], ['Path & spike lights', words(['path', 'spike', 'stake', 'post lights?', 'bollard', 'deck lights?'])], ['Lanterns', words(['lanterns?'])], ['Wall lights', words(['wall lights?'])],
      ['Lighting accessories', words(['cables?', 'extensions?', 'transformers?', 'sockets?', 'connectors?', 'timers?', 'plugs?'])], ['Outdoor lights', /./]] },

  // ---------- Home (HGW) ----------
  { key: 'smart-home', site: 'hgw', slug: 'smart-home',
    include: words(['smart (?:plugs?|bulbs?|lights?|locks?|thermostats?|radiator thermostats?|sockets?|sensors?|speakers?|displays?|switch(?:es)?|home|doorbells?|blinds?|smoke alarms?|buttons?)', 'video doorbells?', 'doorbells?', 'security cameras?', 'ip cameras?', 'cctv', 'wi-?fi cameras?', 'home cameras?', 'indoor cameras?', 'outdoor cameras?', 'bullet cameras?', 'dome cameras?', 'pan/tilt',
      'motion sensors?', 'door sensors?', 'window sensors?', 'temperature sensors?', 'smoke alarms?', 'carbon monoxide alarms?', 'co alarms?', 'alarm (?:system|kit)s?', 'echo dot', 'echo show', 'nest (?:hub|mini|cam|doorbell|thermostat)', 'alexa', 'hive', 'tado', 'ring (?:doorbell|cam|stick)', 'philips hue', 'hue (?:bridge|bulb|light)', 'smart hub', 'zigbee', 'thermostats?', 'radiator thermostats?']),
    exclude: words(['dummy camera', 'fake camera', 'camera bags?', 'camera lens', 'toy']),
    subs: [['Video Doorbell', words(['video doorbells?', 'ring doorbell', 'nest doorbell'])], ['Wireless Doorbell', words(['doorbells?'])], ['Security Camera', words(['security cameras?', 'ip cameras?', 'cctv', 'bullet', 'dome', 'cameras?'])],
      ['Smart Thermostat', words(['thermostats?', 'tado'])], ['Smart Bulb', words(['bulbs?', 'hue'])], ['Smart Plug', words(['plugs?'])], ['Smart Socket', words(['sockets?'])], ['Smart Lock', words(['locks?'])], ['Motion Sensor', words(['motion sensors?'])],
      ['Smart Sensor', words(['sensors?'])], ['Smoke Alarm', words(['smoke alarms?', 'carbon monoxide', 'co alarms?'])], ['Smart Speaker', words(['speakers?', 'echo dot', 'nest mini', 'alexa'])], ['Smart Display', words(['displays?', 'echo show', 'nest hub'])], ['Smart Home Accessories', /./]] },
  { key: 'home-office', site: 'hgw', slug: 'home-office',
    include: words(['office chairs?', 'desk chairs?', 'gaming chairs?', 'ergonomic chairs?', 'computer desks?', 'office desks?', 'standing desks?', 'sit-?stand desks?', 'writing desks?', 'desks?', 'filing cabinets?', 'pedestals?', 'laptop (?:stands?|risers?|tables?)', 'monitor (?:stands?|arms?|risers?|mounts?)', 'printers?', 'scanners?', 'webcams?', 'shredders?', 'laminators?', 'label (?:printers?|makers?)', 'footrests?', 'desk organi[sz]ers?', 'desk (?:lamps?|mats?|pads?)', 'file storage boxes?', 'box files?', 'lever arch files?', 'ring binders?', 'whiteboards?', 'notice boards?']),
    exclude: words(['3d printers?', 'printer (?:ink|toner|paper|cartridges?)', 'toy', 'kids', 'school']),
    subs: [['Office Chair', words(['office chairs?', 'ergonomic chairs?', 'gaming chairs?'])], ['Desk Chair', words(['desk chairs?'])], ['Computer Desk', words(['computer desks?', 'gaming desks?'])], ['Office Desk', words(['desks?'])], ['Filing Cabinet', words(['filing cabinets?', 'pedestals?'])],
      ['Laptop Stand', words(['laptop'])], ['Monitor Stand', words(['monitor'])], ['Printer', words(['printers?', 'laminators?', 'label'])], ['Scanner', words(['scanners?'])], ['Webcam', words(['webcams?'])], ['Office Desk', /./]] },
  { key: 'appliances', site: 'hgw', slug: 'home-appliances',
    include: words(['air ?fryers?', 'microwaves?', 'kettles?', 'toasters?', 'coffee (?:machines?|makers?)', 'espresso (?:machines?|makers?)', 'bean to cup', 'nespresso', 'dolce gusto', 'blenders?', 'smoothie makers?', 'food processors?', 'stand mixers?', 'hand mixers?', 'juicers?', 'slow cookers?', 'rice cookers?', 'pressure cookers?', 'multi-?cookers?', 'soup makers?', 'sandwich (?:makers?|toasters?)', 'waffle makers?', 'bread makers?', 'ice cream makers?', 'electric (?:grills?|hobs?)', 'health grills?', 'mini ovens?', 'toaster ovens?', 'vacuum sealers?',
      'vacuum cleaners?', 'vacuums?', 'hoovers?', 'robot (?:vacuums?|hoovers?|mops?)', 'stick vacuums?', 'handheld vacuums?', 'wet and dry vac', 'carpet (?:cleaners?|washers?)', 'washing machines?', 'washer dryers?', 'tumble dryers?', 'dryers?(?! (?:hair|rack|sheets?|balls?))', 'dishwashers?(?! (?:tablets?|salt|cleaner|rinse))', 'fridges?', 'freezers?', 'fridge freezers?', 'wine coolers?', 'dehumidifiers?', 'humidifiers?', 'air purifiers?', 'air coolers?', 'air conditioners?', 'fans?(?! (?:heater))', 'heaters?', 'fan heaters?', 'oil filled radiators?', 'electric radiators?', 'cooker hoods?', 'range cookers?', 'ovens?']),
    exclude: words(['stovetop', 'hair ?dryers?', 'hand dryers?', 'dryer sheets?', 'dryer balls?', 'vacuum (?:bags?|filters?|storage|seal(?:ed|er) bags?)', 'storage bags?', 'kettle (?:descaler|crisps?|chips)', 'kettlebells?', 'toy', 'kids', 'oven (?:gloves?|mitts?|cleaner|liners?|trays?|dish(?:es)?)', 'ovenproof', 'oven-?safe', 'fan (?:club|art)', 'ceiling fan light']),
    subs: [['Air Fryer', words(['air ?fryers?'])], ['Microwave', words(['microwaves?'])], ['Kettle', words(['kettles?'])], ['Toaster', words(['toasters?', 'toaster ovens?'])], ['Coffee Machine', words(['coffee', 'espresso', 'bean to cup', 'nespresso', 'dolce gusto'])],
      ['Blender', words(['blenders?', 'smoothie'])], ['Food Processor', words(['food processors?', 'mixers?', 'juicers?'])], ['Vacuum Cleaner', words(['vacuums?', 'vacuum cleaners?', 'hoovers?', 'carpet'])], ['Washing Machine', words(['washing machines?', 'washer'])],
      ['Tumble Dryer', words(['dryers?'])], ['Dehumidifier', words(['dehumidifiers?'])], ['Air Purifier', words(['air purifiers?', 'humidifiers?'])], ['Kettle', /./]] },
  { key: 'cleaning', site: 'hgw', slug: 'cleaning-laundry',
    include: words(['laundry (?:detergents?|liquids?|powders?|capsules?|pods?|baskets?|bags?|hampers?|bins?)', 'detergents?', 'washing (?:powder|liquid|capsules|pods|gel)', 'fabric (?:softeners?|conditioners?)', 'scent boosters?', 'stain removers?', 'washing up liquid', 'dishwasher (?:tablets?|salt|cleaner|rinse aid|pods?)', 'rinse aid', 'cleaners?', 'cleaning', 'bleach', 'disinfectants?', 'antibacterial', 'wipes', 'sprays? (?:cleaner|polish)', 'polish(?! (?:nail))', 'descalers?', 'limescale',
      'mops?', 'mop buckets?', 'buckets?', 'brooms?', 'dustpans?', 'dust ?pans?', 'dusters?', 'sponges?', 'scourers?', 'cloths', 'microfib(?:re|er) cloths?', 'rubber gloves', 'cleaning gloves', 'bins?(?! (?:store))', 'pedal bins?', 'bin bags?', 'bin liners?', 'refuse sacks?', 'clothes (?:airers?|horses?|dryers?|pegs?)', 'airers?', 'drying racks?', 'dish racks?', 'dish drainers?', 'ironing boards?', 'irons?(?! (?:hair|curling|straightening|edging|waffle))', 'steam (?:irons?|generators?|cleaners?|mops?)', 'steam cleaners?', 'garment steamers?', 'lint (?:rollers?|removers?)', 'pegs', 'vacuum (?:bags?|filters?|accessories)', 'toilet (?:cleaner|brush|rim|blocks?)', '(?:bathroom|kitchen|toilet|glass|mirror|multi-?surface|oven|hob|floor|carpet|upholstery) (?:sprays?|cleaners?|wipes?|shampoo)', 'degreasers?', 'unblockers?', 'drain (?:cleaners?|unblockers?)', 'kitchen roll', 'toilet roll']),
    exclude: words(['hair', 'face', 'facial', 'make-?up', 'brush cleaner', 'nail', 'jewell?ery cleaner', 'car', 'bbq cleaner', 'grill cleaner', 'patio cleaner', 'decking cleaner', 'pressure washers?', 'contact lens', 'denture', 'pet', 'garden']),
    subs: [['Laundry Detergent', words(['laundry (?:detergents?|liquids?|powders?|capsules?|pods?)', 'detergents?', 'washing (?:powder|liquid|capsules|pods|gel)', 'stain removers?'])], ['Fabric Softener', words(['fabric (?:softeners?|conditioners?)', 'scent boosters?'])],
      ['Dishwashing', words(['washing up', 'dishwasher', 'rinse aid', 'dish racks?', 'dish drainers?'])], ['Mop', words(['mops?', 'mop buckets?', 'buckets?'])], ['Cleaning Brush', words(['brooms?', 'brush(?:es)?', 'dustpans?'])], ['Duster', words(['dusters?'])],
      ['Cloths & Sponges', words(['sponges?', 'scourers?', 'cloths?'])], ['Cleaning Gloves', words(['gloves'])], ['Bins & Bin Bags', words(['bins?', 'bin bags?', 'bin liners?', 'refuse sacks?'])], ['Laundry Basket', words(['laundry baskets?'])], ['Laundry Hamper', words(['hampers?', 'laundry bags?', 'laundry bins?'])],
      ['Clothes Airer', words(['airers?', 'clothes horses?', 'pegs?'])], ['Drying Rack', words(['drying racks?'])], ['Ironing Board', words(['ironing boards?'])], ['Ironing & Clothes Care', words(['irons?', 'steamers?', 'lint'])], ['Steam Cleaner', words(['steam (?:cleaners?|mops?)'])],
      ['Vacuum Accessories', words(['vacuum'])], ['Cleaning Products', /./]] },
  { key: 'bedding-bath', site: 'hgw', slug: 'bedding-bath',
    include: words(['duvets?', 'quilts?', 'duvet covers?', 'bedding(?: sets?)?', 'bed ?linen', 'bed sheets?', 'sheet sets?', 'fitted sheets?', 'flat sheets?', 'pillows?(?! (?:talk))', 'pillowcases?', 'pillow cases?', 'mattress (?:toppers?|protectors?|covers?)', 'mattresses?', 'electric blankets?', 'heated (?:blankets?|throws?|underblankets?)', 'bedspreads?',
      'towels?', 'bath (?:towels?|sheets?|mats?|robes?|rugs?)', 'bath ?mats?', 'shower (?:curtains?|caddies?|mats?|heads?)', 'toilet (?:brush(?:es)?|roll holders?|seats?)', 'soap (?:dispensers?|dishes?)', 'toothbrush holders?', 'bathroom (?:accessories|sets?|shelves|cabinets?|mirrors?|bins?|scales?)', 'flannels?', 'face cloths?']),
    exclude: words(['hair (?:drying )?towels?', 'tea towels?', 'beach towels?', 'gym towels?', 'paper towels?', 'baby', 'cot', 'kids', 'pet', 'dog', 'travel pillow', 'neck pillow', 'cleaning']),
    subs: [['Duvet', words(['duvets?', 'quilts?', 'duvet covers?', 'bedding sets?', 'bedspreads?'])], ['Bed Linen', words(['bed ?linen', 'bedding'])], ['Bed Sheet', words(['sheets?'])], ['Pillow', words(['pillows?', 'pillowcases?', 'pillow cases?'])], ['Mattress Topper', words(['mattress', 'mattresses?', 'blankets?', 'underblankets?'])],
      ['Towel', words(['towels?', 'flannels?', 'face cloths?'])], ['Bath Mat', words(['bath ?mats?', 'bath rugs?', 'shower mats?'])], ['Bathroom Accessories', /./]] },
  { key: 'lighting', site: 'hgw', slug: 'lighting',
    include: words(['ceiling lights?', 'pendant(?: lights?| lamps?| shades?)?', 'chandeliers?', 'floor lamps?', 'standard lamps?', 'table lamps?', 'bedside lamps?', 'lamps?', 'lampshades?', 'lamp shades?', 'light shades?', 'shades?(?! (?:sails?|of))', 'wall lights?', 'wall lamps?', 'sconces?', 'light ?bulbs?', 'led bulbs?', 'bulbs?(?! (?:for planting|mix|collection|planters?))', 'spotlights?', 'downlights?', 'track lights?', 'strip lights?', 'led strips?', 'night lights?', 'flush lights?', 'light fittings?', 'lighting']),
    exclude: words(['lamp oil', 'heat lamps?', 'uv lamps?', 'nail lamps?', 'lava lamps? toy', 'lamp (?:post|posts)', 'head ?lamps?', 'torch(?:es)?', 'flash ?lights?', 'bike lights?', 'car', 'camping', 'sunglasses', 'eye shadow', 'shades of']),
    subs: [['Chandelier', words(['chandeliers?'])], ['Pendant Light', words(['pendant'])], ['Ceiling Light', words(['ceiling', 'flush', 'downlights?', 'spotlights?', 'track'])], ['Floor Lamp', words(['floor lamps?', 'standard lamps?'])], ['Table Lamp', words(['table lamps?', 'bedside lamps?', 'desk lamps?', 'lamps?', 'night lights?'])],
      ['Lampshade', words(['lampshades?', 'lamp shades?', 'light shades?', 'shades?'])], ['Wall Light', words(['wall lights?', 'wall lamps?', 'sconces?'])], ['Light Bulb', words(['bulbs?', 'strip', 'strips'])], ['Table Lamp', /./]] },
  { key: 'storage', site: 'hgw', slug: 'storage-organisation',
    include: words(['storage (?:boxes?|box|baskets?|bins?|units?|racks?|bags?|crates?|cubes?|trunks?|chests?|containers?|solutions?|shelves|shelf|ottomans?)', 'shelving(?: units?)?', 'shelves', 'shelf', 'shoe (?:racks?|cabinets?|storage|organi[sz]ers?)', 'clothes rails?', 'garment rails?', 'coat (?:racks?|stands?|hooks?)', 'hooks?', 'hangers?', 'drawer (?:organi[sz]ers?|dividers?|inserts?)', 'organi[sz]ers?', 'vacuum (?:storage )?bags?', 'under ?bed storage', 'baskets?', 'crates?', 'trunks?', 'spice racks?', 'wine racks?', 'magazine racks?', 'key (?:holders?|hooks?|racks?)']),
    exclude: words(['garden storage', 'outdoor storage', 'patio storage', 'shed', 'bike', 'food storage', 'storage (?:jars?|tins?|canisters?)', 'lunch', 'phone', 'usb', 'hard drive', 'data', 'memory', 'cloud', 'card', 'fish', 'boat', 'tow ?bars?', 'car', 'bbq', 'laundry baskets?', 'gift baskets?', 'hanging baskets?', 'basketball', 'jewell?ery', 'make-?up', 'cosmetics?']),
    subs: [['Shoe Rack', words(['shoe'])], ['Clothes Rail', words(['clothes rails?', 'garment rails?', 'coat'])], ['Drawer Organiser', words(['drawer'])], ['Shelving Unit', words(['shelving', 'shelves', 'shelf'])], ['Storage Basket', words(['baskets?'])], ['Storage Bin', words(['bins?', 'crates?'])],
      ['Storage Rack', words(['racks?', 'hooks?', 'hangers?'])], ['Storage Unit', words(['units?', 'trunks?', 'chests?', 'ottomans?', 'cubes?'])], ['Storage Box', /./]] },
  { key: 'kitchen', site: 'hgw', slug: 'kitchen-dining',
    include: words(['cookware(?: sets?)?', 'saucepans?', 'sauce ?pans?', 'frying pans?', 'fry pans?', 'skillets?', 'woks?', 'casserole(?: dish(?:es)?)?', 'stock ?pots?', 'pans?', 'roasting (?:tins?|trays?)', 'baking (?:trays?|tins?|dish(?:es)?|sheets?|mats?)', 'cake tins?', 'oven (?:dish(?:es)?|trays?|gloves?|mitts?)',
      'cutlery(?: sets?)?', 'knife (?:sets?|blocks?)', 'kitchen knives', 'chef(?:\'s)? knives?', 'knives', 'forks', 'spoons?', 'teaspoons?', 'utensils?', 'spatulas?', 'ladles?', 'whisks?', 'tongs', 'graters?', 'peelers?', 'colanders?', 'sieves?', 'mixing bowls?', 'measuring (?:jugs?|cups?|spoons?)', 'rolling pins?', 'chopping boards?', 'cutting boards?', 'cheese boards?', 'serving boards?', 'kitchen (?:scales?|utensils?|tools?|gadgets?|roll holders?)',
      'dinner (?:sets?|services?|plates?)', 'plates?', 'bowls?', 'side plates?', 'platters?', 'serving (?:dish(?:es)?|bowls?|trays?)', 'tableware', 'placemats?', 'place mats?', 'table ?cloths?', 'napkins?', 'coasters?',
      'mugs?', 'cups?(?! (?:holders? for cars?|measuring))', 'espresso cups?', 'teacups?', 'saucers?', 'glasses', 'glassware', 'tumblers?', 'wine glass(?:es)?', 'champagne flutes?', 'flutes?', 'highballs?', 'decanters?', 'carafes?', 'jugs?', 'pitchers?', 'teapots?', 'tea ?pots?', 'cafetieres?', 'french press(?:es)?', 'moka pots?', 'stovetop (?:espresso|coffee)(?: (?:makers?|pots?))?', 'milk frothers?', 'coffee grinders?',
      'drinkware', 'water bottles?', 'flasks?', 'travel mugs?', 'tumblers?', 'shakers?', 'protein shakers?', 'cocktail (?:shakers?|sets?)', 'bar (?:tools?|sets?|accessories)', 'ice buckets?', 'bottle openers?', 'corkscrews?', 'wine (?:racks?|stoppers?|aerators?|coolers?)', 'food (?:storage|containers?|jars?)', 'storage (?:jars?|tins?|canisters?)', 'lunch ?boxes?', 'bento', 'kilner', 'canisters?', 'bread (?:bins?|boards?)', 'dish(?:es)?', 'kitchen']),
    exclude: words(['car', 'dog bowls?', 'pet bowls?', 'cat bowls?', 'bird bath', 'toilet bowl', 'bowl cleaner', 'nail', 'hair', 'make-?up', 'paint', 'pans? (?:tilt|head)', 'dust ?pans?', 'gold pans?', 'cups? (?:bra|size)', 'world cup', 'suction cups?', 'reading glasses', 'sunglasses', 'safety glasses', 'shakers? (?:salt water|bed)', 'satellite dish', 'dish(?:washer)? (?:tablets?|salt|cleaner)', 'kitchen (?:roll|cleaner|sprays?|towels?)', 'kitchen (?:sink|taps?|units?|cabinets?|doors?)']),
    subs: [['Saucepan', words(['saucepans?', 'sauce ?pans?', 'stock ?pots?'])], ['Frying Pan', words(['frying pans?', 'fry pans?', 'skillets?', 'woks?'])], ['Cookware', words(['cookware', 'casserole', 'pans?', 'roasting', 'baking', 'cake tins?', 'oven'])],
      ['Kitchen Knives', words(['knife (?:sets?|blocks?)', 'kitchen knives', 'chef(?:\'s)? knives?'])], ['Cutlery', words(['cutlery', 'knives', 'forks', 'spoons?', 'teaspoons?'])], ['Chopping Board', words(['chopping', 'cutting boards?', 'cheese boards?', 'serving boards?', 'bread boards?'])],
      ['Dinner Set', words(['dinner (?:sets?|services?)'])], ['Glassware', words(['glasses', 'glassware', 'wine glass(?:es)?', 'champagne', 'flutes?', 'highballs?', 'decanters?', 'carafes?'])], ['Drinkware', words(['mugs?', 'cups?', 'teacups?', 'water bottles?', 'flasks?', 'travel mugs?', 'tumblers?', 'shakers?', 'drinkware'])],
      ['Bar Accessories', words(['cocktail', 'bar', 'ice buckets?', 'bottle openers?', 'corkscrews?', 'wine'])], ['Food Storage', words(['food (?:storage|containers?)', 'storage (?:jars?|tins?|canisters?)', 'lunch', 'bento', 'kilner', 'canisters?', 'bread bins?'])],
      ['Tableware', words(['plates?', 'bowls?', 'platters?', 'serving', 'tableware', 'placemats?', 'place mats?', 'table ?cloths?', 'napkins?', 'coasters?', 'saucers?', 'dish(?:es)?'])], ['Kitchen Utensil', /./]] },
  { key: 'decor', site: 'hgw', slug: 'home-decor',
    include: words(['cushions?', 'cushion covers?', 'throws?', 'rugs?', 'runners?', 'door ?mats?', 'curtains?', 'blinds?', 'voiles?', 'mirrors?', 'clocks?', 'wall clocks?', 'vases?', 'ornaments?', 'figurines?', 'sculptures?', 'statues?', 'busts?', 'candles?', 'candle holders?', 'candlesticks?', 'tea ?light holders?', 'lanterns? (?:indoor|candle)', 'diffusers?', 'reed diffusers?', 'wax melts?', 'home fragrances?', 'room sprays?', 'air fresheners?', 'plug-?in (?:refills?|diffusers?|air fresheners?)', 'incense', 'oil burners?',
      'wall art', 'canvas(?:es)?', 'prints?', 'posters?', 'paintings?', 'artworks?', 'giclee', 'giclée', 'screen prints?', 'photo frames?', 'picture frames?', 'frames?', 'wall (?:decor|hangings?|stickers?|decals?|plates?)', 'artificial (?:flowers?|plants?|trees?)', 'faux (?:flowers?|plants?)', 'dried flowers?', 'wreaths?', 'garlands?', 'christmas (?:decorations?|ornaments?|baubles?)', 'baubles?', 'trinket (?:boxes?|dishes?)', 'bookends?', 'decor', 'decorations?', 'decorative']),
    exclude: words(['car', 'phone', 'camera', 'bike', 'make-?up mirror', 'compact mirror', 'mirror (?:camera|dash|car|wing)', 'wing mirror', 'clocks? (?:radio|alarm projector)', 'mats? (?:yoga|exercise|gym|mouse|car|baking|bath|shower|changing)', 'bath mats?', 'yoga', 'mouse', 'frames? (?:bike|bed|glasses|eyeglasses|camping)', 'bed frames?', 'garden', 'outdoor', 'patio', 'outdoor rugs?']),
    subs: [['Cushion', words(['cushions?', 'cushion covers?', 'throws?'])], ['Rug', words(['rugs?', 'runners?', 'door ?mats?'])], ['Curtain', words(['curtains?', 'blinds?', 'voiles?'])], ['Mirror', words(['mirrors?'])], ['Clock', words(['clocks?'])], ['Vase', words(['vases?', 'artificial', 'faux', 'dried flowers?'])],
      ['Home Fragrance', words(['candles?', 'candle holders?', 'candlesticks?', 'tea ?light', 'diffusers?', 'wax melts?', 'home fragrances?', 'room sprays?', 'air fresheners?', 'plug-?in (?:refills?|diffusers?|air fresheners?)', 'incense', 'oil burners?'])], ['Wall Art', words(['wall art', 'canvas(?:es)?', 'prints?', 'posters?', 'paintings?', 'artworks?', 'giclee', 'giclée', 'frames?', 'wall'])],
      ['Ornament', /./]] },
  { key: 'furniture', site: 'hgw', slug: 'furniture',
    include: words(['sofas?', 'sofa beds?', 'settees?', 'couch(?:es)?', 'corner sofas?', 'armchairs?', 'accent chairs?', 'tub chairs?', 'wingback chairs?', 'recliners?', 'recliner chairs?', 'chaise(?: longue)?', 'footstools?', 'pouff?e?s?', 'ottomans?', 'coffee tables?', 'side tables?', 'end tables?', 'console tables?', 'nest of tables', 'lamp tables?', 'dining tables?', 'dining chairs?', 'dining sets?', 'bar stools?', 'stools?', 'kitchen tables?', 'tables?', 'chairs?',
      'sideboards?', 'buffets?', 'display cabinets?', 'cabinets?', 'bookcases?', 'bookshel(?:f|ves)', 'tv (?:stands?|units?|cabinets?)', 'media units?', 'wardrobes?', 'chests? of drawers', 'drawers', 'dressers?', 'dressing tables?', 'bedside (?:tables?|cabinets?)', 'nightstands?', 'bed ?frames?', 'beds?', 'divan', 'headboards?', 'bunk beds?', 'benches', 'bench', 'hallway (?:units?|benches?)', 'furniture']),
    exclude: words(['bed (?:linen|sheets?|covers?|spreads?)', 'bedding', 'flower beds?', 'raised beds?', 'pet beds?', 'dog beds?', 'cat beds?', 'car', 'camping', 'garden', 'outdoor', 'patio', 'rattan', 'bistro', 'deck chairs?', 'high chairs?', 'kids', 'toy', 'doll', 'office chairs?', 'desk chairs?', 'gaming chairs?', 'massage chairs?', 'wheelchairs?', 'chair (?:covers?|pads?|cushions?)', 'table ?cloths?', 'table (?:mats?|runners?|lamps?|tennis|saws?)', 'work ?bench(?:es)?', 'weight bench(?:es)?', 'tool cabinets?', 'filing cabinets?', 'bathroom cabinets?', 'drawer (?:organi[sz]ers?|liners?)', 'tool chests?']),
    subs: [['Sofa', words(['sofas?', 'sofa beds?', 'settees?', 'couch(?:es)?'])], ['Armchair', words(['armchairs?', 'accent chairs?', 'tub chairs?', 'wingback', 'chaise', 'footstools?', 'pouff?e?s?', 'ottomans?', 'chairs?'])], ['Recliner', words(['recliners?'])],
      ['Coffee Table', words(['coffee tables?', 'side tables?', 'end tables?', 'console tables?', 'nest of tables', 'lamp tables?'])], ['Dining Table', words(['dining', 'kitchen tables?', 'bar stools?', 'stools?', 'tables?'])], ['Sideboard', words(['sideboards?', 'buffets?', 'display cabinets?', 'cabinets?', 'tv', 'media units?'])],
      ['Bookcase', words(['bookcases?', 'bookshel(?:f|ves)'])], ['Wardrobe', words(['wardrobes?'])], ['Chest Of Drawers', words(['chests? of drawers', 'drawers', 'dressers?', 'dressing tables?', 'bedside', 'nightstands?'])], ['Bed Frame', words(['beds?', 'bed ?frames?', 'divan', 'headboards?'])], ['Coffee Table', /./]] }
];

export const CATEGORY_NAMES = {
  hgw: { furniture: 'Furniture', 'kitchen-dining': 'Kitchen & Dining', 'home-appliances': 'Home Appliances', 'bedding-bath': 'Bedding & Bath', 'home-decor': 'Home Decor', lighting: 'Lighting',
    'storage-organisation': 'Storage & Organisation', 'cleaning-laundry': 'Cleaning & Laundry', 'smart-home': 'Smart Home', 'home-office': 'Home Office' },
  ggw: { 'garden-tools': 'Garden Tools', 'power-garden-tools': 'Power Garden Tools', 'garden-furniture-outdoor-living': 'Garden Furniture & Outdoor Living', 'bbq-outdoor-cooking': 'BBQ & Outdoor Cooking',
    'garden-buildings-fencing-storage': 'Garden Buildings, Fencing & Storage', 'watering-irrigation': 'Watering & Irrigation', 'plants-growing-garden-care': 'Plants, Growing & Garden Care', 'outdoor-lighting-garden-electrical': 'Outdoor Lighting & Garden Electrical' }
};

// A garden word moves an indoor rule to its garden twin (a "Garden Rattan Sofa" is garden furniture, "Solar Lantern" an
// outdoor light, a "Patio Broom" a garden tool).
const GARDEN_TWIN = { furniture: 'garden-furniture', decor: 'garden-furniture', 'bedding-bath': 'garden-furniture', lighting: 'outdoor-lighting', storage: 'garden-storage', cleaning: 'garden-tools', appliances: 'power-garden-tools', kitchen: 'bbq' };

function bestRule(text, gardenCtx, full = text, gardenShop = false) {
  let best = null, at = -1;
  for (const r of RULES) {
    if (r.needsGarden && !gardenCtx) continue;
    const i = lastAt(r.include, text);
    if (i < 0 || (r.exclude && r.exclude.test(text))) continue;
    // Ties: the earlier rule (garden rules come first, so with a garden word "Garden Bench" is garden furniture).
    if (i > at) { best = r; at = i; }
  }
  if (best && gardenCtx && GARDEN_TWIN[best.key]) {
    const twin = RULES.find(r => r.key === GARDEN_TWIN[best.key]);
    // In a garden shop every indoor rule moves to its garden twin (Lights4fun "Outdoor Dining Lighting Bundle").
    if (twin && (gardenShop || lastAt(twin.include, full) >= 0)) best = twin;
  }
  return best ? { rule: best, at } : null;
}

export function makeRules(site) {
  if (site !== 'hgw' && site !== 'ggw') throw new Error(`home and garden rules: unknown site ${site}`);
  const other = site === 'hgw' ? 'Garden Gear World' : 'Home Gear World';
  const slugs = Object.keys(CATEGORY_NAMES[site]);
  function classify(name, feedCategory = '', paths = '', source = null) {
    const n = String(name || '');
    if (HARD_DENY.test(n)) return { ok: false, reason: 'gift card or voucher' };
    const head = headOf(n);
    // A garden shop (sources.json "gardenShop": Mint Outdoor, Lights4fun, the garden sections of Tooled Up) gives every
    // product the garden context, as "motoShop" does on Biker Gear World.
    const garden = Boolean(source && source.gardenShop) || (GARDEN.test(n) && !INDOOR.test(n));
    const shop = Boolean(source && source.gardenShop);
    let hit = bestRule(head, garden, n, shop), where = head, from = 'name';
    if (!hit) { hit = bestRule(n, garden, n, shop); where = n; }
    if (!hit) {
      const hints = source ? source.sectionHints : true;
      const top = String(feedCategory || '').split('>')[0].trim().toLowerCase();
      const trusted = hints !== false && (!Array.isArray(hints) || hints.some(h => String(h).toLowerCase() === top));
      const sectionGarden = garden || /lawn & garden|garden|outdoor/i.test(String(feedCategory || ''));
      if (trusted) hit = bestRule(String(feedCategory || ''), sectionGarden);
      from = 'section';
      if (!hit && source && source.defaultCategory) { const r = RULES.find(x => x.key === source.defaultCategory); if (r) { hit = { rule: r, at: n.length }; from = 'shop'; } }
    }
    for (const d of DENY) {
      if (d.anywhere && d.anywhere.test(n)) return { ok: false, reason: d.label };
      if (from === 'shop') continue;
      if (from === 'section' || !hit ? d.re.test(n) : lastAt(d.re, where) > hit.at) return { ok: false, reason: d.label };
    }
    if (!hit) return { ok: false, reason: 'not a home or garden product' };
    const rule = hit.rule;
    if (rule.site !== site) return { ok: false, reason: `${CATEGORY_NAMES[rule.site][rule.slug]} (${other})` };
    const pickSub = text => {
      let best = null, at = -1;
      for (const [label, re] of rule.subs) { if (re.source === '.') continue; const i = lastAt(re, text); if (i > at) { best = label; at = i; } }
      return best;
    };
    const sub = pickSub(head) || pickSub(n) || (rule.subs.find(([, re]) => re.source === '.') || [])[0] || CATEGORY_NAMES[site][rule.slug];
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

// Minimum quality for any product to be imported (L14). Prices in pounds; a garden building or a sofa can cost a few thousand.
export const QUALITY = {
  currencies: ['GBP'],
  minPrice: 1,
  maxPrice: 15000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};
