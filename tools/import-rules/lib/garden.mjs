// Garden Gear World: which product goes to which of the garden categories that were empty on 21 Oct 2026
// (Garden Furniture & Outdoor Living, BBQ & Outdoor Cooking, Garden Buildings Fencing & Storage,
// Outdoor Lighting & Garden Electrical) and Plants, Growing & Garden Care (14 products).
// Shared by the Joybuy and My Tool Shed rules. Yes list + no list (lessons L14); tuned on the gw-feed-gaps report.
const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

export const GARDEN_CATEGORIES = {
  furniture: 'Garden Furniture & Outdoor Living',
  bbq: 'BBQ & Outdoor Cooking',
  buildings: 'Garden Buildings, Fencing & Storage',
  lighting: 'Outdoor Lighting & Garden Electrical',
  plants: 'Plants, Growing & Garden Care'
};

// Things that only share a word with garden products: toys, food, clothing, tools, car and bike parts.
export const NOT_GARDEN = words(['toy', 'toys', 'doll', 'dolls', 'lego', 'playmobil', 'sylvanian', 'miniature', 'fairy garden', 'model kit', 'cake topper',
  'sticker', 'stickers', 'jigsaw', 'sauce', 'sauces', 'rub', 'rubs', 'marinade', 'seasoning', 'crisps', 'flavour', 'flavor', 'snack', 'snacks', 'wings', 'ramen',
  'ramyun', 'noodles', 'chips', 'hoodie', 't-shirt', 'tee', 'sweatshirt', 'shirt', 'jacket', 'socks', 'apron', 'mug', 'mugs', 'cushion cover for sofa', 'pet', 'dog', 'cat',
  'hamster', 'rabbit hutch', 'bird cage', 'car', 'bike', 'bicycle', 'cycling', 'screen protector', 'phone', 'iphone', 'fencing pins', 'fencing maul', 'fencing mall',
  'grafter', 'staples', 'stapler', 'spade', 'attachment for', 'screwdriver', 'drill', 'chainsaw', 'aquarium', 'baby', 'kids', 'children', 'ornament', 'ornaments',
  'ramadan', 'christmas tree', 'wall art', 'poster', 'tapestry', 'fridge magnet',
  // From the first all-sites plan (21 Oct 2026): kitchen, table and craft products, indoor shelving, bird food, indoor lights.
  'air fryer', 'air fryers', 'airfryer', 'toaster', 'cocktail', 'paper plates', 'soup bowls', 'sugarcane', 'table runner', 'table cloth', 'tablecloth',
  'tape', 'butyl', 'holesaw', 'hole saw', 'shelving unit', 'shelving units', 'diamond painting', 'painting', 'feeder', 'feeders', 'niblets', 'bird food',
  'vase', 'vases', 'fragrance', 'wind chime', 'light catcher', 'suncatcher', 'downlight', 'downlights', 'ceiling', 'recessed', 'candle holder', 'caddy', 'liners']);
// Indoor furniture that shares words with garden furniture ("lounge chair", "storage bench"): left out unless the name says outside.
const INDOOR = words(['indoor', 'entryway', 'hallway', 'bedroom', 'living room', 'bathroom', 'sofa bed', 'accent chair', 'couch', 'ottoman']);
const OUTSIDE_ANY = words(['outdoor', 'outdoors', 'outside', 'garden', 'patio', 'yard', 'balcony', 'poolside', 'lawn', 'deck', 'decking']);
// A kitchen oven or grill with a power rating ("Pizza Oven 18L, 2000W") is not an outdoor one unless the name says so.
const POWER = /\b\d{3,4}\s?w\b/i;
// Joybuy top categories that never hold garden products for GGW.
export const NOT_GARDEN_CATEGORY = /^(Food, Beverages|Toys & Games|Baby & Toddler|Apparel|Clothing & Accessories|Health & Beauty|Electronics > Communications|Vehicles)/i;

const RULES = [
  ['bbq', words(['bbq', 'bbqs', 'barbecue', 'barbecues', 'barbeque', 'barbeques', 'pizza oven', 'pizza ovens', 'kamado', 'charcoal grill', 'gas grill', 'pellet grill',
    'kettle grill', 'outdoor grill', 'portable grill', 'camping grill', 'smoker', 'smokers', 'grill cover', 'grill covers', 'grill brush', 'grill mat', 'grill mats',
    'plancha', 'planchas', 'outdoor griddle', 'lumpwood charcoal', 'charcoal briquettes', 'briquettes', 'rotisserie', 'chimenea cover', 'chiminea cover', 'skewers']),
  [['Pizza ovens', words(['pizza oven', 'pizza ovens'])], ['Smokers & grills', words(['smoker', 'smokers', 'kamado', 'pellet', 'plancha', 'griddle'])],
   ['BBQ accessories', words(['cover', 'covers', 'brush', 'mat', 'mats', 'skewers', 'tool set', 'tools', 'tongs', 'basket', 'baskets', 'lumpwood', 'briquettes', 'apron'])]], 'BBQs'],
  ['buildings', words(['shed', 'sheds', 'garden storage', 'garden store', 'garden building', 'garden room', 'log store', 'log stores', 'log storage', 'log cabin',
    'greenhouse', 'greenhouses', 'cold frame', 'summer house', 'summerhouse', 'fence panel', 'fence panels', 'fencing', 'fence post', 'trellis', 'arbour', 'arbor',
    'garden arch', 'garden gate', 'bike store', 'bin store', 'wheelie bin store', 'outdoor storage box', 'garden storage box', 'outdoor storage', 'deck box',
    'storage bench', 'lean-to', 'playhouse', 'wendy house', 'bamboo screening', 'willow screening', 'privacy screen', 'carport', 'garden screen']),
  [['Sheds', words(['shed', 'sheds', 'carport', 'log cabin', 'summer house', 'summerhouse', 'garden room', 'playhouse', 'wendy house'])],
   ['Greenhouses', words(['greenhouse', 'greenhouses', 'cold frame'])], ['Fencing & screening', words(['fence', 'fencing', 'trellis', 'screening', 'screen', 'arch', 'arbour', 'arbor', 'gate'])],
   ['Log stores', words(['log store', 'log stores', 'log storage'])]], 'Garden storage'],
  ['lighting', words(['solar light', 'solar lights', 'solar lantern', 'solar lanterns', 'solar lamp', 'solar string lights', 'solar fairy lights', 'solar spotlight',
    'solar spotlights', 'solar stake', 'solar path', 'solar post', 'solar wall light', 'solar festoon', 'outdoor light', 'outdoor lights', 'outdoor lighting',
    'outdoor lantern', 'outdoor wall light', 'outdoor wall lights', 'outdoor spotlight', 'outdoor string lights', 'outdoor fairy lights', 'garden light', 'garden lights',
    'garden lighting', 'garden lantern', 'garden spotlight', 'festoon', 'path light', 'path lights', 'post light', 'bollard light', 'deck light', 'decking lights',
    'floodlight', 'floodlights', 'flood light', 'flood lights', 'security light', 'security lights', 'pir light', 'lamp post', 'outdoor socket', 'garden socket',
    'outdoor extension', 'weatherproof extension']),
  [['Solar lights', words(['solar'])], ['Floodlights & security lights', words(['floodlight', 'floodlights', 'flood light', 'flood lights', 'security light', 'security lights', 'pir'])],
   ['String & festoon lights', words(['festoon', 'string lights', 'fairy lights'])], ['Garden electrical', words(['socket', 'extension'])]], 'Outdoor lights'],
  ['furniture', words(['garden furniture', 'patio set', 'patio furniture', 'patio chair', 'patio chairs', 'patio table', 'patio heater', 'patio heaters', 'patio umbrella',
    'bistro set', 'rattan sofa', 'rattan set', 'rattan furniture', 'rattan chair', 'rattan corner', 'rattan dining', 'rattan daybed', 'egg chair', 'swing seat', 'swing chair',
    'garden bench', 'garden chair', 'garden chairs', 'garden table', 'garden sofa', 'garden swing', 'garden parasol', 'garden cushion', 'garden cushions',
    'outdoor furniture', 'outdoor sofa', 'outdoor chair', 'outdoor chairs', 'outdoor table', 'outdoor dining', 'outdoor rug', 'outdoor cushion', 'outdoor cushions',
    'outdoor seating', 'outdoor lounger', 'outdoor lounge chair', 'patio lounge chair', 'garden lounge', 'sun lounger', 'sun loungers', 'sunlounger', 'lounger', 'loungers', 'deck chair', 'deckchair', 'picnic bench', 'picnic table',
    'parasol', 'parasols', 'gazebo', 'gazebos', 'hammock', 'hammocks', 'fire pit', 'fire pits', 'firepit', 'chiminea', 'chimenea', 'pergola', 'awning', 'zero gravity chair',
    'furniture cover', 'furniture covers', 'chair stack cover', 'seat cover', 'patio set cover', 'sun shade', 'sunshade', 'sail shade']),
  [['Fire pits & heaters', words(['fire pit', 'fire pits', 'firepit', 'chiminea', 'chimenea', 'heater', 'heaters'])],
   ['Parasols, gazebos & shade', words(['parasol', 'parasols', 'gazebo', 'gazebos', 'umbrella', 'pergola', 'awning', 'sun shade', 'sunshade', 'sail shade'])],
   ['Furniture covers', words(['cover', 'covers'])], ['Furniture care', words(['oil', 'cleaner', 'restorer', 'stain', 'paint', 'treatment', 'preserver'])],
   ['Hammocks & swing seats', words(['hammock', 'hammocks', 'swing'])], ['Loungers', words(['lounger', 'loungers', 'sunlounger', 'deck chair', 'deckchair', 'zero gravity'])],
   ['Cushions & rugs', words(['cushion', 'cushions', 'rug', 'seat pad', 'seat pads'])]], 'Garden furniture'],
  ['plants', words(['seeds', 'seed', 'flower bulbs', 'tulip bulbs', 'daffodil bulbs', 'allium bulbs', 'crocus bulbs', 'spring bulbs', 'plug plants', 'bedding plants',
    'perennials', 'shrubs', 'hedging', 'fruit tree', 'fruit trees', 'climbing roses', 'live plants', 'house plant', 'houseplant', 'potted plant', 'seedlings', 'compost',
    'potting mix', 'potting soil', 'top soil', 'topsoil', 'fertiliser', 'fertilizer', 'plant food', 'plant feed', 'tomato feed', 'grow bag', 'grow bags', 'growbag',
    'propagator', 'seed tray', 'seed trays', 'peat-free', 'wildflower', 'composter', 'compost bin', 'compost tumbler', 'raised bed', 'planter', 'planters', 'plant pot', 'plant pots']),
  [['Seeds & bulbs', words(['seeds', 'seed', 'bulbs', 'wildflower'])], ['Compost & feed', words(['compost', 'composter', 'fertiliser', 'fertilizer', 'plant food', 'plant feed', 'tomato feed', 'soil', 'potting mix'])],
   ['Plants', words(['plants', 'plant', 'shrubs', 'hedging', 'tree', 'trees', 'roses', 'perennials', 'seedlings'])]], 'Growing']
];
const LIGHTS = words(['string lights', 'string light', 'fairy lights', 'lantern', 'lanterns', 'wall light', 'wall lights', 'spotlight', 'spotlights']);
const OUTSIDE = words(['outdoor', 'garden', 'solar', 'waterproof', 'patio', 'ip44', 'ip54', 'ip65', 'ip66', 'yard']);
const FOOD_SEEDS = words(['chia', 'sesame', 'flax', 'linseed', 'sunflower seeds', 'pumpkin seeds', 'lotus seed', 'seed beads', 'beads', 'bird seed', 'roasted', 'salted', 'bread',
  'oil', 'seed oil', 'walnut', 'walnuts', 'nuts', 'artificial', 'fake', 'faux', 'silk', 'plastic plant', 'christmas tree seeds', 'lotus seeds', 'paste', 'bean', 'beans']);

// Returns { siteCategory, subcategory } for a garden product, or null. `extra(name, feedCategory)` may add a shop's own no-words.
export function gardenPlace(name, feedCategory = '') {
  const n = String(name || '');
  const c = String(feedCategory || '');
  if (NOT_GARDEN_CATEGORY.test(c) || NOT_GARDEN.test(n)) return null;
  if (INDOOR.test(n) && !OUTSIDE_ANY.test(n)) return null;
  // "Patio set with soft cushions" is furniture; "chair cushion" is a cushion.
  const subText = n.replace(/\b(with|and|includes?|including) (\w+ ){0,2}cushions?\b/gi, ' ');
  for (const [group, yes, subs, fallback] of RULES) {
    // "Decorative String Lights 20M Outdoor": string/fairy lights and lanterns count when the name says they are for outside.
    const outsideLights = group === 'lighting' && LIGHTS.test(n) && OUTSIDE.test(n);
    if (!yes.test(n) && !outsideLights) continue;
    if (group === 'plants' && FOOD_SEEDS.test(n)) return null;
    if (group === 'bbq' && POWER.test(n) && !OUTSIDE_ANY.test(n)) return null;
    let sub = fallback;
    for (const [label, re] of subs) if (re.test(subText)) { sub = label; break; }
    return { siteCategory: GARDEN_CATEGORIES[group], subcategory: sub };
  }
  return null;
}

// ---------- Garden furniture shops (Mint Outdoor, Gardenista) ----------
// Words that say a product is used outside. Cushions, rugs and pads count for the garden site only with one of these.
export const OUTDOOR_HINT = words(['outdoor', 'outdoors', 'outside', 'garden', 'patio', 'balcony', 'yard', 'lawn', 'deck', 'decking', 'poolside', 'rattan',
  'water resistant', 'water-resistant', 'waterproof', 'weatherproof', 'weather resistant', 'weather-resistant', 'all weather', 'all-weather', 'swing seat', 'swing chair',
  'parasol', 'gazebo', 'sun lounger', 'bistro', 'picnic']);
// Words of a garden furniture piece or set, for shops whose whole feed is garden furniture.
export const FURNITURE_PIECE = words(['set', 'sets', 'sofa', 'sofas', 'chair', 'chairs', 'table', 'tables', 'bench', 'benches', 'stool', 'stools', 'daybed', 'day bed',
  'lounger', 'loungers', 'seater', 'corner', 'dining', 'lounge', 'bistro', 'cube', 'footstool', 'ottoman', 'egg chair', 'swing', 'hammock', 'parasol', 'gazebo',
  'fire pit', 'firepit', 'heater', 'heaters', 'chaise', 'armchair', 'cushion', 'cushions', 'cover', 'covers', 'rug', 'rugs', 'seat pad', 'seat pads', 'bench pad', 'pad', 'pads']);
// Subcategory of Garden Furniture & Outdoor Living from the name. Furniture shops write names like
// "Marbella 5-Seater Garden Lounge Set with Ottoman Chaise | Grey Cushions" (a lounge set), "Marbella Garden Lounge Set
// Replacement Cushions/Covers" (cushions), "Linden Custom-Fitted Furniture Cover – Tailored Protection for Sofas" (a cover)
// and "Lima 5 Seater ... Sofa Set Bundle with Armchair, Coffee Table & Protective Cover" (a sofa set). So:
//   1. the head of the name (before "with", "for", "|", "–", "(" or a comma) says what the product is;
//   2. a head that says "replacement cushions", "seat pad", "scatter cushions" or "cushion cover" is a cushion; one that
//      ENDS with cover(s) is a cover, and one that ends with cushion(s)/pad(s)/rug(s) a cushion;
//   3. otherwise the furniture words decide (dining, lounge/corner, bistro, loungers, chairs, tables...), then covers and cushions.
const SOFT_END = /^(cushions?|pads?|pillows?|rugs?|toppers?)$/i;
const COVER_END = /^covers?$/i;
const SOFT_PHRASE = words(['replacement cushion', 'replacement cushions', 'seat pad', 'seat pads', 'bench pad', 'bench pads', 'scatter cushion', 'scatter cushions',
  'cushion cover', 'cushion covers', 'chair cushion', 'chair cushions', 'bench cushion', 'bench cushions', 'cushion set', 'cushion pads', 'pallet cushion', 'pallet cushions',
  'back cushion', 'back cushions', 'seat cushion', 'seat cushions', 'outdoor rug', 'outdoor rugs', 'garden rug', 'garden rugs']);
const PIECE_SUBS = [
  ['Fire pits & heaters', words(['fire pit', 'fire pits', 'firepit', 'chiminea', 'chimenea', 'heater', 'heaters'])],
  ['Parasols, gazebos & shade', words(['parasol', 'parasols', 'gazebo', 'gazebos', 'umbrella', 'pergola', 'awning', 'sun shade', 'sunshade', 'sail shade'])],
  ['Hammocks & swing seats', words(['hammock', 'hammocks', 'swing', 'egg chair', 'hanging chair'])],
  ['Loungers', words(['lounger', 'loungers', 'sunlounger', 'daybed', 'day bed', 'deck chair', 'deckchair', 'zero gravity', 'recliner', 'reclining'])],
  ['Dining sets', words(['dining'])],
  ['Lounge & corner sets', words(['corner', 'sofa', 'sofas', 'lounge', 'modular', 'chaise', 'l-shape', 'l shape', 'u-shape', 'u shape', 'coffee set', 'cube set'])],
  ['Bistro sets', words(['bistro'])],
  ['Chairs & benches', words(['chair', 'chairs', 'armchair', 'armchairs', 'bench', 'benches', 'stool', 'stools', 'footstool', 'ottoman'])],
  ['Tables', words(['table', 'tables'])]
];
const COVER_ANY = words(['cover', 'covers']);
const SOFT_ANY = words(['cushion', 'cushions', 'pad', 'pads', 'pillow', 'pillows', 'rug', 'rugs', 'throw']);
export function furnitureSub(name) {
  const full = String(name || '');
  const head = full.split(/\s+(?:with|w\/|for|incl\.?|including|plus)\s+|\s*[|–—(]\s*|,/i)[0].trim() || full;
  const last = (head.split(/\s+/).pop() || '').split('/')[0];
  // "Scatter Cushion Covers" are cushions; "Garden Bench Cover" is a cover.
  if (SOFT_PHRASE.test(head)) return 'Cushions & rugs';
  if (COVER_END.test(last)) return 'Furniture covers';
  if (SOFT_END.test(last)) return 'Cushions & rugs';
  for (const [sub, re] of PIECE_SUBS) if (re.test(head)) return sub;
  if (COVER_ANY.test(head)) return 'Furniture covers';
  if (SOFT_ANY.test(head)) return 'Cushions & rugs';
  return 'Garden furniture';
}
