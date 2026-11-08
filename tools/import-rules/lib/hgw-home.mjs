// Home Gear World: where a furniture shop's product goes (furniture, lighting, decor, storage, home office, bedding and
// bath). Shared by the Cheap Furniture Warehouse, Dream Interiors and Cottsbury rules (owner, 8 Nov 2026: "check email and
// download new feeds and import with one go"). The subcategories are the ones HGW already has (live HGW database 8 Nov
// 2026: Coffee Table, Sofa, Armchair, Dining Table, Sideboard, Wardrobe, Bookcase, Recliner, Chest Of Drawers, Bed Frame,
// Mirror, Cushion, Wall Art, Clock, Home Fragrance, Vase, Ornament, Rug, Curtain, Shelving Unit, Storage Unit ...), plus
// the furniture pieces HGW did not have yet (Dining Chair, Side Table, Console Table, Bedside Table, TV Unit, Headboard,
// Dressing Table, Footstool, Bar Stool, Bench, Mattress, Display Cabinet, Coat Stand, Throw, Bed Linen, Drinks Trolley, Blinds,
// Christmas).
// Yes list + no list (lessons L14): the HEAD of the name (before "with", "for", "|", "(") says what the product is, so a
// "Dressing Table with Mirror" is a dressing table and a "Bed Frame with Storage" a bed.
const words = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');

// Not home products: pets, sport and play, tools, car and bike, kitchen fitting parts, appliances.
// Read on the whole name (dry run 8 Nov 2026: "Sportspower Swing with Rebound Net and Basketball Hoop").
export const NOT_HOME = words(["dog", "dogs", "cat", "cats", "pet", "pets", "puppy", "kennel", "hutch", "crate", "basketball", "football", "goal",
  "trampoline", "table tennis", "pool table", "snooker", "dartboard", "swing set", "climbing frame", "playhouse", "toy", "toys", "doll'?s house",
  "toddler", "play equipment", "rebound net", "punch bags?", "boxing", "weights", "pianos?", "keyboard",
  "treadmill", "exercise", "dumbbells?", "weights? bench", "bike", "bicycle", "car seat", "drill", "screwdriver", "tool ?box", "workbench",
  "cabinet doors?", "door fronts?", "fronts", "worktops?", "carcass", "kitchen (?:wall|base|tall) units?", "end panels?",
  "shower screens?", "bath screens?", "bath panels?", "shower enclosures?", "shower trays?", "internal doors?", "folding doors?",
  "fridge", "freezer", "washing machine", "dishwasher", "oven", "microwave", "television", "gift card", "gift voucher", "swatch"]);
// Read on the head only: "Sideboard with Gold Door Handles" is a sideboard, "Replacement Sofa Cushions" are not a product to list.
export const NOT_HOME_HEAD = words(["replacement", "spare", "spares", "door handles?", "knobs?", "hinges?", "samples?"]);

// Outside furniture goes to Garden Gear World (the rules call gardenPlace for these).
export const OUTDOOR = words(['garden', 'outdoor', 'outdoors', 'patio', 'balcony', 'parasol', 'gazebo', 'sun lounger', 'bistro set', 'decking',
  'all weather', 'all-weather', 'rattan garden', 'greenhouses?', 'hanging chairs?', 'cocoon']);

// Marketing tails of some feeds ("Nel Wood 4 Seater Dining Table Black Stylish and Durable Dining Room Decor",
// "Self Assembly Fabric Armchair Green Comfortable Lounge Chair Design"): the card name stops before them, and the type
// of the product is read without them ("Bedroom Storage" in a tail does not make a wardrobe a storage box).
const TAIL = /\s+(?:stylish|elegant|comfortable|spacious|durable|sleek|luxurious|chic|perfect|ideal|practical|versatile|timeless|modern and|modern design|contemporary design|stunning|beautiful)\b.*$/i;
export function trimTail(name) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const cut = n.replace(TAIL, '').trim();
  // Only when a real name is left (at least three words).
  return cut.split(/\s+/).length >= 3 ? cut : n;
}

export function headOf(name) {
  const n = String(name || '');
  // " - " too: what follows is the colour or finish ("Lantine Coffee Table - Walnut & Brass", "Hudson Sofa - Lander Shade").
  return (n.split(/\s+(?:with|w\/|for|incl\.?|including|plus)\s+|\s*[|–—(]\s*|\s+-\s+/i)[0] || n).trim();
}

// [siteCategory, subcategory, words of the head]. Order matters: the first match wins.
const PLACES = [
  // Christmas (dry run 8 Nov 2026: artificial trees were left out or called ornaments)
  ['Home Decor', 'Christmas', words(['christmas', 'xmas', 'advent', 'nativity'])],
  // Lighting
  ['Lighting', 'Chandelier', words(['chandeliers?'])],
  ['Lighting', 'Floor Lamp', words(['floor lamps?', 'standard lamps?', 'uplighters?', 'arc lamps?'])],
  ['Lighting', 'Table Lamp', words(['table lamps?', 'desk lamps?', 'bedside lamps?', 'touch lamps?'])],
  ['Lighting', 'Wall Light', words(['wall lights?', 'wall lamps?', 'sconces?', 'picture lights?', 'wall washers?'])],
  ['Lighting', 'Pendant Light', words(['pendants?', 'pendant lights?', 'pendant lamps?', 'cluster lights?'])],
  ['Lighting', 'Light Bulb', words(['bulbs?', 'gu10', 'e27', 'e14', 'b22'])],
  ['Lighting', 'Ceiling Light', words(['ceiling lights?', 'ceiling lamps?', 'flush', 'semi[- ]flush', 'spotlight bars?', 'ceiling fittings?'])],
  ['Lighting', 'Lampshade', words(['lamp ?shades?', '(?:drum|pendant|ceiling|easy fit|empire|tapered|fabric|rattan|linen|glass) shades?'])],
  // Bed linen before beds: a "Double Bed Sheet" is linen, not a bed.
  ['Bedding & Bath', 'Mattress Topper', words(['mattress toppers?', 'mattress protectors?', 'toppers?'])],
  ['Bedding & Bath', 'Duvet', words(['duvet covers?', 'duvet sets?', 'duvets?', 'quilts?'])],
  ['Bedding & Bath', 'Pillow', words(['pillowcases?', 'pillow cases?', 'pillow ?slips?', 'pillows?', 'shams?'])],
  ['Bedding & Bath', 'Bed Linen', words(['bedding sets?', 'bed linen', 'fitted sheets?', 'flat sheets?', 'sheet sets?', 'sheets?', 'bedspreads?', 'valances?'])],
  // Beds and bedroom
  ['Furniture', 'Sofa', words(['sofa ?beds?'])],
  ['Furniture', 'Headboard', words(['headboards?'])],
  ['Furniture', 'Bedside Table', words(['bedsides?', 'bed side tables?', 'bedside tables?', 'bedside cabinets?', 'bedside chests?', 'bedside drawers?', 'nightstands?', 'night stands?'])],
  ['Furniture', 'Mattress', words(['mattress', 'mattresses'])],
  ['Furniture', 'Bed Frame', words(['bed ?frames?', 'divans?', 'ottoman beds?', 'bunk beds?', 'cabin beds?', 'day ?beds?', 'four poster', 'sleigh beds?',
    '(?:single|double|small double|king|king size|super king|kingsize|superking) beds?', 'beds?'])],
  ['Furniture', 'Dressing Table', words(['dressing tables?', 'vanity tables?', 'dressing table sets?'])],
  ['Furniture', 'Wardrobe', words(['wardrobes?', 'armoires?'])],
  ['Furniture', 'Chest Of Drawers', words(['chests? of drawers', 'tallboys?', 'drawer chests?', '\\d+ drawer chests?', 'merchant chests?'])],
  // Shoe storage before benches and cabinets ("Winchester Shoe Storage Bench")
  ['Storage & Organisation', 'Shoe Rack', words(['shoe racks?', 'shoe cabinets?', 'shoe storage', 'shoe benches?'])],
  // Sitting
  ['Furniture', 'Recliner', words(['recliners?', 'reclining chairs?', 'riser recliners?'])],
  ['Furniture', 'Sofa', words(['sofas?', 'settees?', 'couch(?:es)?', 'loveseats?', 'chaise(?: longue)?', 'corner groups?', 'chesterfield'])],
  ['Home Office', 'Office Chair', words(['office chairs?', 'gaming chairs?', 'executive chairs?', 'ergonomic chairs?'])],
  ['Home Office', 'Desk Chair', words(['desk chairs?', 'swivel desk chairs?'])],
  // A table sold with its chairs, stools or benches ("Helena Glass Dining Table & 4 Grey Chairs", "Bolitzo Oak White Bar Table 2 Oak
  // White Stools", "Carina Dining Table & Bench Set") is a dining set (dry run 8 Nov 2026).
  ['Furniture', 'Dining Set', words(['dining sets?', 'dining table sets?', 'bar sets?', 'table\\s*(?:&|and|\\+)?\\s*\\d+\\s+[a-z ]{0,30}?(?:chairs?|stools?|benches?)',
    'table (?:&|and) (?:chairs|stools|benches|bench)', 'table and chairs', 'table & chairs'])],
  ['Furniture', 'Dining Chair', words(['dining chairs?', 'kitchen chairs?', 'pair of [a-z ]{0,40}chairs', 'set of \\d+ [a-z ]{0,40}chairs'])],
  ['Furniture', 'Armchair', words(['armchairs?', 'accent chairs?', 'occasional chairs?', 'wing ?back(?: chairs?)?', 'tub chairs?', 'cuddle chairs?',
    'snuggle chairs?', 'lounge chairs?', 'swivel chairs?', 'egg chairs?', 'bucket chairs?', 'nursing chairs?'])],
  ['Furniture', 'Footstool', words(['footstools?', 'foot stools?', 'ottomans?', 'pouffes?', 'poufs?'])],
  ['Furniture', 'Bar Stool', words(['bar stools?', 'barstools?', 'counter stools?', 'kitchen stools?', 'stools?'])],
  ['Furniture', 'Bench', words(['dining benches', 'dining bench', 'benches', 'bench'])],
  // Tables and cabinets
  ['Furniture', 'Coffee Table', words(['coffee tables?', 'cocktail tables?'])],
  ['Furniture', 'Console Table', words(['console tables?', 'consoles?', 'hall tables?'])],
  ['Furniture', 'Side Table', words(['side tables?', 'end tables?', 'lamp tables?', 'nest of tables', 'nesting tables', 'occasional tables?'])],
  ['Furniture', 'Dining Table', words(['dining tables?', 'kitchen tables?', 'extending tables?', '\\d+ seater tables?'])],
  ['Home Office', 'Computer Desk', words(['computer desks?', 'gaming desks?', 'laptop desks?', 'pc desks?'])],
  ['Home Office', 'Office Desk', words(['desks?', 'workstations?', 'writing tables?', 'bureaus?'])],
  ['Home Office', 'Filing Cabinet', words(['filing cabinets?', 'desk pedestals?', 'drawer pedestals?'])],
  ['Furniture', 'Side Table', words(['pedestal columns?', 'plinths?', 'pedestal tables?'])],
  ['Furniture', 'Drinks Trolley', words(['drinks trolleys?', 'bar carts?', 'serving trolleys?', 'kitchen trolleys?', 'trolleys?'])],
  ['Furniture', 'TV Unit', words(['tv units?', 'tv stands?', 'tv cabinets?', 'media units?', 'entertainment units?', 'tv benches?'])],
  ['Furniture', 'Bookcase', words(['bookcases?', 'book ?shel(?:f|ves)', 'ladder shel(?:f|ves)'])],
  ['Furniture', 'Display Cabinet', words(['display cabinets?', 'glass cabinets?', 'curio(?: cabinets?)?', 'vitrines?', 'display units?'])],
  ['Furniture', 'Sideboard', words(['sideboards?', 'buffets?', 'credenzas?', 'highboards?', 'drinks cabinets?', 'cocktail cabinets?', 'bar cabinets?'])],
  // "Sideboard 3 Drawers" was a sideboard above; plain drawers are a chest.
  ['Furniture', 'Chest Of Drawers', words(['drawers', '\\d+ drawer'])],
  // Storage
  ['Storage & Organisation', 'Clothes Rail', words(['clothes rails?', 'garment rails?', 'clothes rack'])],
  ['Storage & Organisation', 'Coat Stand', words(['coat stands?', 'coat racks?', 'hat stands?', 'hall trees?', 'coat hooks?'])],
  ['Storage & Organisation', 'Storage Rack', words(['garage shelving', 'racking', 'storage racks?', 'heavy duty shelving'])],
  ['Storage & Organisation', 'Shelving Unit', words(['shelving units?', 'shelving', 'shelves', 'shelf', 'wall shelf', 'floating shel(?:f|ves)'])],
  ['Storage & Organisation', 'Storage Basket', words(['baskets?', 'hampers?'])],
  ['Storage & Organisation', 'Storage Box', words(['storage boxe?s?', 'blanket boxe?s?', 'storage trunks?', 'trunks?', 'ottoman boxe?s?', 'storage chests?', 'toy boxe?s?'])],
  ['Storage & Organisation', 'Storage Unit', words(['storage units?', 'cube storage', 'cube units?', 'storage cabinets?', 'cupboards?', 'cabinets?', 'dressers?', 'larders?', 'hallway units?'])],
  // Decor
  ['Home Decor', 'Mirror', words(['mirrors?'])],
  ['Home Decor', 'Rug', words(['rugs?', 'runners?'])],
  ['Home Decor', 'Cushion', words(['cushions?', 'scatter cushions?'])],
  ['Home Decor', 'Throw', words(['throws?', 'blankets?'])],
  ['Home Decor', 'Clock', words(['clocks?'])],
  ['Home Decor', 'Vase', words(['vases?'])],
  ['Home Decor', 'Wall Art', words(['wall art', 'artworks?', 'canvas(?:es)?', 'prints?', 'framed', 'paintings?', 'wall decor', 'wall panels?'])],
  ['Home Decor', 'Home Fragrance', words(['candles?', 'diffusers?', 'room sprays?', 'wax melts?'])],
  ['Home Decor', 'Blinds', words(['blinds?'])],
  ['Home Decor', 'Curtain', words(['curtains?', 'voiles?'])],
  ['Home Decor', 'Ornament', words(['ornaments?', 'sculptures?', 'figurines?', 'statues?', 'busts?', 'decorative bowls?', 'bowls?', 'trays?', 'bookends?',
    'candle ?holders?', 'candlesticks?', 'lanterns?', 'planters?', 'plant pots?', 'pots?', 'artificial (?:flowers?|plants?|trees?)', 'faux (?:flowers?|plants?)',
    'decorations?', 'objets?', 'boxes', 'jars?', 'urns?', 'globes?', 'photo frames?', 'picture frames?'])],
  // Bath
  ['Bedding & Bath', 'Bathroom Accessories', words(['towel (?:ladders?|rails?|racks?|holders?|stands?)', 'toilet roll holders?', 'soap dispensers?'])],
  ['Bedding & Bath', 'Bath Mat', words(['bath mats?', 'shower mats?'])],
  ['Bedding & Bath', 'Towel', words(['towels?', 'bath sheets?', 'towel bales?', 'bath sets?', 'face cloths?', 'washcloths?'])]
];

// Generic words last: a table, a chair, a cabinet.
const GENERIC = [
  ['Lighting', 'Table Lamp', words(['lamps?'])],
  ['Furniture', 'Side Table', words(['tables?'])],
  ['Furniture', 'Dining Chair', words(['chairs?'])]
];

// Returns { siteCategory, subcategory } for a home product of HGW, or null (the shop's rules decide what to do then).
export function homePlace(name) {
  const n = trimTail(name);
  const head = headOf(n);
  for (const [cat, sub, re] of PLACES) if (re.test(head)) return { siteCategory: cat, subcategory: sub };
  for (const [cat, sub, re] of GENERIC) if (re.test(head)) return { siteCategory: cat, subcategory: sub };
  // The words after "with" can still say it ("Malibu Set with 2 Bedside Tables" was caught above by its head).
  for (const [cat, sub, re] of PLACES) if (re.test(n)) return { siteCategory: cat, subcategory: sub };
  return null;
}

export function notHome(name) {
  const n = trimTail(name);
  return NOT_HOME.test(n) || NOT_HOME_HEAD.test(headOf(n));
}
