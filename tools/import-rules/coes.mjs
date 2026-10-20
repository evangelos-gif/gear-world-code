// Import rules for Coes (Awin advertiser 30645), a UK menswear and womenswear shop (coes.co.uk).
// Written from the real feed (feed sample, 20 Oct 2026): 33,347 rows, one row per SIZE, so one product
// has several rows. Columns have no currency (prices are GBP), no EAN and no stock flag (stock_quantity).
// Feed categories are only Menswear, Womenswear, Sports, Gifts, so the site category comes from the name.
// Lessons L14: a "yes" list and a "no" list, a dry-run report first, an import only with approval.
export const RULES = {
  key: 'coes',
  advertiserId: 30645,
  retailer: 'Coes',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?coes\.co\.uk\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 5000
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

const KIDS = words(['junior', 'juniors', 'kids', "kid's", 'kid', 'boys', "boy's", 'girls', "girl's", 'child', 'children', "children's", 'youth', 'infant', 'baby', 'toddler', 'jnr']);
// Things that are not clothing, shoes, jewellery, watches, bags/accessories or fragrance.
const NOT_FOR_SITES = words(['gift card', 'gift voucher', 'voucher', 'candle', 'candles', 'diffuser', 'reed diffuser', 'mug', 'mugs',
  'reading glasses', 'laces', 'shoe polish', 'polish', 'shoe care', 'shoe cream', 'insole', 'insoles', 'shoe tree', 'shoe trees', 'water bottle',
  'ball', 'balls', 'racket', 'racquet', 'shin pad', 'shin pads', 'shin guard', 'shin guards', 'mouthguard', 'gum shield', 'hockey stick', 'stick',
  'grip', 'grips', 'tape', 'book', 'game', 'puzzle', 'playing cards', 'greeting card', 'jigsaw', 'notebook', 'pen', 'chocolate', 'coaster', 'coasters',
  'cushion', 'blanket', 'rug', 'cleaning', 'cleaning gel', 'tea towel', 'apron', 'dog', 'dog lead', 'protector', 'spray', 'cleaner', 'waterproofer', 'reproofer', 'shoe brush', 'repair kit']);
// (Not 'wax', 'collar' or 'bottle': wax jackets, button-down collar shirts and bottle green jumpers are clothing.)
const ACCESSORY_PHRASES = words(['key ring', 'keyring', 'watch cap', 'watch strap', 'card holder', 'cardholder', 'bow tie', 'pocket square', 'hip flask', 'tie clip', 'tie bar', 'bag charm', 'wedding set', 'paisley set', 'tie set', 'tie and pocket square', 'party bow', 'garter', 'garters',
  'keychain', 'key chain', 'key organiser', 'wrist warmers', 'glasses sleeve', 'glasses case', 'jewellery box', 'valet box', 'trinket box', 'trinket dish']);
const TIE_AT_END = /(?<![a-z])(tie|ties)(\s+(in|with)\b.*)?$/i;
const JEWELLERY_TIE = words(['tie clip', 'tie bar', 'tie pin']);
// Words that are a fragrance or grooming product for sure ("Cologne Trousers" are trousers).
const STRONG_FRAGRANCE = words(['atomiser', 'eau de toilette', 'eau de parfum', 'edt', 'edp', 'aftershave', 'after shave', 'perfume', 'parfum', 'shaving', 'shaving cream', 'body wash', 'lip balm', 'hand cream', 'make up', 'makeup']);
const JEWELLERY = words(['cufflink', 'cufflinks', 'bracelet', 'bracelets', 'necklace', 'necklaces', 'earring', 'earrings', 'ring', 'rings', 'pendant', 'bangle', 'bangles', 'brooch', 'anklet', 'charm', 'charms', 'jewellery', 'tie pin']);
const WATCHES = words(['watch', 'watches', 'smartwatch', 'chronograph']);
const FRAGRANCE = words(['atomiser', 'fragrance', 'eau de toilette', 'eau de parfum', 'edt', 'edp', 'aftershave', 'after shave', 'cologne', 'perfume', 'parfum',
  'shaving', 'beard', 'moisturiser', 'face wash', 'body wash', 'shampoo', 'lip balm', 'hand cream', 'grooming', 'body lotion', 'make up', 'makeup', 'make-up', 'brush set']);
const BAGS = words(['bag', 'bags', 'handbag', 'handbags', 'pouch', 'duffel', 'duffle', 'gymsack', 'gym sack', 'coin holder', 'coin purse', 'holdall', 'backpack', 'rucksack', 'tote', 'washbag', 'wash bag', 'purse', 'wallet', 'wallets', 'clutch', 'satchel', 'briefcase', 'duffle bag', 'weekender']);
const ACCESSORIES = words(['belt', 'belts', 'braces', 'gloves', 'glove', 'mittens', 'scarf', 'scarves', 'snood', 'hat', 'hats', 'beanie', 'cap', 'caps', 'flat cap',
  'sunglasses', 'umbrella', 'handkerchief', 'handkerchiefs', 'headband', 'hairband', 'hair band', 'scrunchie', 'scrunchies', 'hair clip', 'hair clips', 'claw clip',
  'ear warmers', 'earmuffs', 'shawl', 'pashmina', 'stole', 'wrap scarf', 'tie', 'ties']);
const SOCKS_UNDERWEAR = words(['sock', 'socks', 'boxer', 'boxers', 'brief', 'briefs', 'trunk', 'trunks', 'underwear', 'bra', 'knickers', 'tights']);
const SHOES = words(['shoe', 'shoes', 'boot', 'boots', 'trainer', 'trainers', 'sneaker', 'sneakers', 'sandal', 'sandals', 'loafer', 'loafers', 'moccasin', 'moccasins',
  'brogue', 'brogues', 'slipper', 'slippers', 'espadrille', 'espadrilles', 'mule', 'mules', 'flip flops', 'flip flop', 'sliders', 'slides', 'astros', 'derby', 'plimsoll', 'plimsolls', 'clogs', 'wellies', 'welly', 'wellington']);
// Words that make a "cap"/"tie"/"belt" a garment detail, not an accessory.
const GARMENT_DETAIL = words(['cap sleeve', 'tie front', 'tie waist', 'tie neck', 'tie dye', 'tie-dye', 'belted']);
const CLOTHING = words(['shirt', 'shirts', 't-shirt', 't-shirts', 't shirt', 'tee', 'tees', 'polo', 'jumper', 'sweater', 'cardigan', 'hoodie', 'hoody', 'sweatshirt',
  'sweat', 'jacket', 'coat', 'gilet', 'blazer', 'suit', 'waistcoat', 'trousers', 'trouser', 'chino', 'chinos', 'jeans', 'jean', 'shorts', 'short', 'joggers', 'jogger',
  'pyjama', 'pyjamas', 'pj', 'dressing gown', 'robe', 'vest', 'top', 'dress', 'skirt', 'blouse', 'leggings', 'jumpsuit', 'playsuit', 'kaftan', 'tunic', 'knit',
  'fleece', 'parka', 'overshirt', 'henley', 'base layer', 'baselayer', 'thermal', 'swim', 'swimsuit', 'swimshort', 'swimshorts', 'boardshorts', 'boardshort', 'swimwear', 'swim shorts', 'bikini', 'cami', 'gown', 'trench',
  'poncho', 'kimono', 'mac', 'anorak', 'cagoule', 'overcoat', 'bomber', 'smock', 'zip', 'crew', 'crew neck', 'v neck', 'half zip', 'quarter zip', 'sweatpants',
  'track pant', 'tracksuit', 'tights', 'singlet', 'tank', 'bodywarmer', 'body warmer', 'cords', 'corduroy', 'culottes', 'dungarees', 'shacket', 'tabard', 'jersey', 'rugby',
  'pullover', 'cardi', 'rollneck', 'roll neck', 'turtle neck', 'turtleneck', 'midlayer', 'mid layer', 'rugger', 'co-ord', 'co ord', 'nehru', 'waistcaot',
  'sleep top', 'sleepwear', 'loungewear', 'lounge pants', 'pants', 'pant', 'raincoat', 'rain jacket', 'jeggings', 'bodysuit', 'bralette', 'camisole', 'corset', 'kilt', 'sarong', 'overalls', 'cover up', 'capri', 'trackpants', 'sweatpant']);

const WOMEN = words(['women', "women's", 'womens', 'ladies', "ladies'", 'lady', 'female', 'for her', 'wmns']);
const MEN = words(['men', "men's", 'mens', 'male', 'for him', 'gents']);
const TAIL_W = /\s(w|wmns|womens)$/i;
const TAIL_M = /\s(m|mens)$/i;

function genderOf(name, feedCategory, url) {
  const w = WOMEN.test(name) || TAIL_W.test(name);
  const m = MEN.test(name) || TAIL_M.test(name);
  if (w && !m) return 'W';
  if (m && !w) return 'M';
  // The shop's own page address often says it ("/products/fusion-walk-socks-for-men-in-charcoal").
  const handle = String(url || '').replace(/^https?:\/\/[^/]+\/products\//i, '').replace(/[?#].*$/, '').replace(/[-_]+/g, ' ');
  if (handle && !/^https?:/i.test(handle)) {
    const hw = WOMEN.test(handle), hm = MEN.test(handle);
    if (hw && !hm) return 'W';
    if (hm && !hw) return 'M';
  }
  if (/^menswear$/i.test(feedCategory)) return 'M';
  if (/^womenswear$/i.test(feedCategory)) return 'W';
  return '';
}

const CLOTHING_SUB = [
  [words(['t-shirt', 't-shirts', 't shirt', 'tee', 'tees']), 'T-Shirts', 'T-Shirts'],
  [words(['sweatshirt', 'sweat']), 'Sweatshirts', 'Knitwear'],
  [words(['hoodie', 'hoody']), 'Hoodies', 'Knitwear'],
  [words(['dressing gown', 'robe', 'pyjama', 'pyjamas', 'pj', 'sleep top', 'sleepwear', 'loungewear', 'lounge pants']), 'Nightwear', 'Nightwear'],
  [words(['jacket', 'coat', 'gilet', 'blazer', 'parka', 'overcoat', 'trench', 'bomber', 'mac', 'anorak', 'cagoule', 'bodywarmer', 'body warmer', 'shacket', 'raincoat', 'rain jacket']), 'Jackets', 'Jackets & Coats'],
  [words(['jeans', 'jean']), 'Jeans', 'Jeans'],
  [words(['shorts', 'short', 'swimshorts', 'swimshort', 'boardshorts', 'boardshort', 'swim shorts']), 'Shorts', 'Shorts'],
  [words(['trousers', 'trouser', 'chino', 'chinos', 'joggers', 'jogger', 'cords', 'sweatpants', 'sweatpant', 'track pant', 'trackpants', 'leggings', 'jeggings', 'culottes', 'pants', 'pant', 'capri']), 'Trousers', 'Trousers'],
  [words(['jumper', 'sweater', 'cardigan', 'cardi', 'pullover', 'rollneck', 'roll neck', 'turtle neck', 'turtleneck', 'midlayer', 'mid layer', 'knit', 'crew neck', 'v neck', 'half zip', 'quarter zip']), 'Knitwear', 'Knitwear'],
  [words(['shirt', 'shirts', 'overshirt', 'rugger', 'polo', 'henley', 'blouse', 'top', 'cami', 'tunic', 'vest', 'tank', 'singlet']), 'Shirts', 'Tops & Blouses'],
  [words(['dress', 'jumpsuit', 'playsuit', 'kaftan']), 'Dresses', 'Dresses'],
  [words(['skirt']), 'Skirts', 'Skirts'],
  [words(['suit', 'waistcoat', 'waistcaot', 'nehru']), 'Suits', 'Suits']
];

const firstWord = (name, pairs, fallback) => { for (const [re, sub] of pairs) if (re.test(name)) return sub; return fallback; };

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory, url = '', brand = '' }) {
  let raw = String(name || '');
  // The brand is not a product word: "Polo Ralph Lauren Pullover" is not a polo shirt.
  const b = String(brand || '').trim();
  if (b.length >= 3 && raw.toLowerCase().startsWith(b.toLowerCase() + ' ')) raw = raw.slice(b.length + 1);
  raw = raw.replace(/^polo ralph lauren\s+/i, '');
  if (/^on cloud/i.test(raw) || /^cloud\w*\s/i.test(raw) && /^on$/i.test(b)) raw += ' trainers';
  // "Short Sleeve Shirt" is a shirt, not shorts; "Horse Shoe Tie" is a tie; "Nobody's Child" is a women's brand.
  const n = raw.replace(/\b(short|long|3\/4|half|cap)[\s-]+sleeve(s|d)?\b/gi, ' ').replace(/\bhorse\s?shoe\b/gi, 'horse').replace(/\s+/g, ' ').trim();
  const kidsText = raw.replace(/nobody'?s child/gi, '');
  if (KIDS.test(kidsText)) return { reject: "children's item (for Kids' Gear World later)" };
  if (NOT_FOR_SITES.test(n) && !ACCESSORY_PHRASES.test(n)) return { reject: 'not clothing, shoes, jewellery, bags or fragrance (candles, laces, sports kit, gifts)' };
  const g = genderOf(n, feedCategory, url);
  if (!g) return { reject: 'no men/women in the name (sports and gift items fit both)' };
  const site = g === 'M' ? 'mgw' : 'wgw';
  const M = site === 'mgw';
  const detail = GARMENT_DETAIL.test(n);
  let cat = '', sub = '';
  const strongFragrance = STRONG_FRAGRANCE.test(n);
  if (TIE_AT_END.test(n) && !JEWELLERY_TIE.test(n)) { cat = 'Bags & Accessories'; sub = 'Ties'; }
  else if (ACCESSORY_PHRASES.test(n)) {
    if (words(['tie clip', 'tie bar']).test(n)) { cat = M ? "Men's Jewellery" : "Women's Jewellery"; sub = 'Jewellery'; }
    else { cat = 'Bags & Accessories'; sub = 'Accessories'; }
  } else if (JEWELLERY.test(n)) {
    cat = M ? "Men's Jewellery" : "Women's Jewellery";
    sub = firstWord(n, [[words(['cufflink', 'cufflinks']), 'Cufflinks'], [words(['bracelet', 'bracelets', 'bangle', 'bangles']), 'Bracelets'], [words(['necklace', 'necklaces', 'pendant']), 'Necklaces'], [words(['earring', 'earrings']), 'Earrings'], [words(['ring', 'rings']), 'Rings']], 'Jewellery');
  } else if (WATCHES.test(n)) { cat = 'Watches'; sub = 'Watches'; }
  else if (FRAGRANCE.test(n) && (strongFragrance || !CLOTHING.test(n))) { cat = M ? 'Grooming & Fragrances' : 'Beauty & Fragrances'; sub = M ? 'Grooming & Fragrances' : 'Beauty & Fragrances'; }
  else if (BAGS.test(n)) { cat = 'Bags & Accessories'; sub = firstWord(n, [[words(['wallet', 'wallets', 'purse', 'coin holder', 'coin purse']), 'Wallets & Purses']], 'Bags'); }
  else if (SOCKS_UNDERWEAR.test(n)) { cat = 'Clothing'; sub = words(['sock', 'socks']).test(n) ? 'Socks' : 'Underwear'; }
  else if (SHOES.test(n)) { cat = 'Shoes'; sub = firstWord(n, [[words(['trainer', 'trainers', 'sneaker', 'sneakers', 'plimsoll', 'plimsolls', 'running shoe', 'running shoes', 'trail running', 'tennis shoe', 'tennis shoes', 'astros']), 'Trainers'], [words(['boot', 'boots', 'wellies', 'welly', 'wellington']), 'Boots'], [words(['slipper', 'slippers']), 'Slippers'], [words(['sandal', 'sandals', 'sliders', 'slides', 'flip flop', 'flip flops', 'espadrille', 'espadrilles']), 'Sandals']], 'Shoes'); }
  else if (ACCESSORIES.test(n) && !detail) {
    cat = 'Bags & Accessories';
    sub = firstWord(n, [[words(['belt', 'belts', 'braces']), 'Belts'], [words(['gloves', 'glove', 'mittens']), 'Gloves'], [words(['scarf', 'scarves', 'snood']), 'Scarves'], [words(['hat', 'hats', 'beanie', 'cap', 'caps', 'flat cap', 'headband', 'ear warmers']), 'Hats'], [words(['tie', 'ties']), 'Ties']], 'Accessories');
  } else if (CLOTHING.test(n) || detail) {
    cat = 'Clothing';
    const pairs = CLOTHING_SUB.map(([re, m, w]) => [re, M ? m : w]);
    sub = firstWord(n, pairs, 'Clothing');
  } else return { reject: 'not sure what it is (no clothing, shoe, jewellery or bag word in the name)' };
  return { site, siteCategory: cat, subcategory: sub };
}

// Display name: the feed name without a trailing gender letter ("Canopy Jacket M" -> "Canopy Jacket").
export function displayName(name) {
  return String(name || '').replace(/\s(M|W)$/, '').replace(/\s+/g, ' ').trim();
}
