// Import rules for TEMU (Daisycon programme 18371 "TEMU (INT)", its United States feed in dollars) on the six older
// sites (owner, 15 Nov 2026: "only TEMU, the products that interest our groups", then "to strengthen the USA").
// Feed facts (15 Nov 2026, lessons L163): TEMU INT has two feeds on Daisycon, US (USD, 169,875 products) and DE (EUR,
// 291,161); none for the UK or Poland. Pages are temu.com/goods.html?...goods_id=<id>&sku_id=..., one row per product,
// Amazon-style category paths ("Clothing, Shoes & Jewelry|Women|Clothing|Tops, Tees & Blouses > ..."), brand "Temu"
// for 94%, pictures on https://img.kwcdn.com.
// A marketplace like DHgate (lessons L161): no famous brand or character names, no seller words for copies, no artist
// or band merchandise, the cheapest of the same name. Its prices are dollars for US delivery: the site settings show it
// only where it delivers (deliversTo TEMU: ['US']), never in the UK view.
// Only clearly placed paths, and at most RULES.maxPerSubcategory cards in each subcategory of a site (lessons L164), so
// TEMU adds variety without burying the other shops:
//  - WGW: women's clothing, shoes, bags, accessories, jewellery and watches, hair accessories, nail art, make-up, skin care;
//  - MGW: men's clothing, shoes, accessories, jewellery and watches;
//  - KGW: girls' and boys' clothing only (toys and baby products stay out: product safety);
//  - HGW: home décor, kitchen and dining, bath, throws, storage, party decorations, crafts and sewing;
//  - GGW: pots and planters, plant supports, garden ornaments and outdoor lights.
// Left out: appliances and anything with a plug, furniture, toys, baby products, fragrances (copies), costumes,
// lingerie, flags, keyrings, car, phone, computer, office, pet, sports and tools (the newer sites do not read Daisycon
// files yet; CGW Hand Tools is close to the 20,000 limit).
import { BRANDS, COPY, unescape } from './dhgate-kids-boots.mjs';

export const FEED_FILE = 'DAISYCON_18371_US.csv.gz';

export const RULES = {
  key: 'temu-us',
  network: 'daisycon',
  advertiserId: 18371,
  retailer: 'TEMU',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?temu\.com\/goods\.html\?/i,
  sites: ['wgw', 'mgw', 'kgw', 'hgw', 'ggw'],
  maxPrice: 300,
  minPrice: 3,
  sameNameCheapest: true,
  maxPerSubcategory: 120
};

// Only the US file (the DE one is in German and euros).
import { join } from 'node:path';
export function feedFiles(archive) { return [join(archive, FEED_FILE)]; }

// One card per TEMU product: goods_id in the page address.
export function productKey(get) {
  const m = /[?&]goods_id=(\d{6,20})/.exec(String(get('merchant_deep_link') || ''));
  return m ? `temu-${m[1]}` : '';
}

// The shop page without TEMU's tracking placeholders ("_x_ns_ts={timestamp}").
export function field(c, column) {
  const v = column(c);
  if (c === 'merchant_deep_link') {
    const m = /[?&]goods_id=(\d{6,20})/.exec(String(v || ''));
    return m ? `https://www.temu.com/goods.html?goods_id=${m[1]}` : v;
  }
  return v;
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
// Artist, band, film and game merchandise, and character words not in the DHgate list.
const MERCH = W(['merch', 'merchandise', 'tour', 'concert', 'band tee', 'rapper', 'anime', 'manga', 'cartoon character', 'fan art', 'fandom', 'k-?pop',
  'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'football club', 'team logo', 'licensed', 'stitch', 'snoopy', 'garfield', 'grinch', 'smurfs?', 'sesame street', 'tom and jerry', 'looney tunes',
  'one piece', 'naruto', 'dragon ball', 'demon slayer', 'jujutsu', 'squid game', 'wednesday addams', 'addams family', 'beetlejuice', 'taylor swift', 'swiftie', 'beatles', 'nirvana', 'metallica', 'acdc', 'ac/dc', 'queen band', 'elvis', 'tupac', '2pac', 'michael jackson']);
const ADULT = W(['sexy', 'sex', 'erotic', 'lingerie', 'thong', 'g-string', 'nipple', 'adult toy', 'bdsm', 'fetish', 'see-through', 'see through', 'transparent underwear', 'stripper', 'pole dance']);
const NOT_THESE = W(['gun', 'pistol', 'rifle', 'ammo', 'knuckle', 'brass knuckles', 'switchblade', 'butterfly knife', 'taser', 'stun', 'pepper spray', 'vape', 'e-?cig', 'cigarette', 'hookah', 'bong', 'grinder', 'weed', 'cannabis', 'cbd',
  'religious', 'confederate', 'trump', 'biden', 'harris', 'maga', 'election', 'political']);
const PLUG = W(['plug', 'usb', 'rechargeable', 'battery', 'batteries', 'electric', 'electronic', 'charger', 'adapter', '110v', '120v', '220v', 'led strip', 'heater', 'heated', 'motor']);

// TEMU names are long sentences ("A Women's Round Neck T-shirt Made Of 100%, Perfect For Spring And Summer. A Fashionable
// And Relaxed ..."): the card takes the first part, up to the first comma, full stop or dash, at most about 90 letters.
export function displayName(name) {
  let n = unescape(name).replace(/[  ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  n = n.replace(/^(?:a|an|the)\s+/i, '');
  const first = n.split(/\s*(?:,|\.\s|\s-\s|\s\|\s|;)\s*/)[0];
  if (first.length >= 18) n = first;
  if (n.length > 90) { n = n.slice(0, 90); n = n.slice(0, Math.max(n.lastIndexOf(' '), 50)); }
  n = n.replace(/[\s,.;:-]+$/, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}
export function displayBrand() { return 'TEMU'; }

const K = (re, sub) => [W(re), sub];
// The first keyword list that matches the name gives the subcategory; otherwise the path's own one.
const pick = (n, list, fallback) => { for (const [re, sub] of list) if (re.test(n)) return sub; return fallback; };
const WOMEN_CLOTHES = [K(['dress', 'dresses', 'sundress'], 'Dresses'), K(['jumpsuits?', 'rompers?', 'overalls?'], 'Clothing'), K(['jeans'], 'Jeans'), K(['skirts?', 'skorts?'], 'Skirts'),
  K(['shorts'], 'Shorts'), K(['leggings'], 'Leggings'), K(['pants', 'trousers', 'joggers', 'sweatpants'], 'Trousers'), K(['hoodies?'], 'Hoodies'), K(['sweatshirts?'], 'Sweatshirts'),
  K(['cardigans?', 'sweaters?', 'jumpers?', 'knit', 'knitted', 'pullover'], 'Knitwear'), K(['coats?', 'jackets?', 'blazers?', 'vests?', 'gilets?', 'parkas?'], 'Jackets & Coats'),
  K(['pajamas?', 'pyjamas?', 'nightgown', 'nightdress', 'sleepwear', 'loungewear', 'robe'], 'Nightwear'), K(['t-?shirts?', 'tees?', 'tank tops?', 'camis?'], 'T-Shirts'),
  K(['blouses?', 'shirts?', 'tops?', 'tunic'], 'Tops & Blouses'), K(['sports bra', 'yoga', 'workout', 'gym', 'activewear'], 'Activewear')];
const MEN_CLOTHES = [K(['t-?shirts?', 'tees?', 'tank tops?', 'vest tops?'], 'T-Shirts'), K(['shirts?', 'polos?'], 'Shirts'), K(['hoodies?'], 'Hoodies'), K(['sweatshirts?'], 'Sweatshirts'),
  K(['sweaters?', 'cardigans?', 'jumpers?', 'knit', 'pullover'], 'Knitwear'), K(['jackets?', 'coats?', 'blazers?', 'parkas?', 'gilets?'], 'Jackets'), K(['jeans'], 'Jeans'),
  K(['shorts', 'swim trunks', 'board shorts'], 'Shorts'), K(['pants', 'trousers', 'joggers', 'sweatpants', 'chinos'], 'Trousers'), K(['socks'], 'Socks'),
  K(['boxers?', 'briefs', 'underwear', 'trunks'], 'Underwear'), K(['pajamas?', 'pyjamas?', 'sleepwear', 'loungewear', 'robe'], 'Nightwear'), K(['suits?'], 'Suits')];
const SHOES = [K(['boots?', 'booties'], 'Boots'), K(['sandals?', 'slides?', 'flip-?flops?'], 'Sandals'), K(['slippers?'], 'Slippers'), K(['sneakers?', 'trainers?', 'running shoes?'], 'Trainers'),
  K(['heels?', 'pumps', 'stilettos?'], 'Heels')];
const ACCESSORIES = [K(['hats?', 'caps?', 'beanies?', 'berets?', 'bucket hat'], 'Hats'), K(['scarf', 'scarves', 'shawl', 'wraps?'], 'Scarves'), K(['gloves?', 'mittens'], 'Gloves'),
  K(['sunglasses', 'eyewear', 'glasses'], 'Sunglasses'), K(['belts?'], 'Belts'), K(['wallets?', 'card holders?', 'card cases?', 'purses?', 'money clip'], 'Wallets & Purses'),
  K(['ties?', 'bow ties?', 'pocket squares?'], 'Ties')];
const JEWELLERY = [K(['earrings?', 'studs', 'hoops'], 'Earrings'), K(['necklaces?', 'pendants?', 'chokers?'], 'Necklaces'), K(['bracelets?', 'bangles?', 'anklets?'], 'Bracelets'), K(['rings?'], 'Rings')];
const HOME_DECOR = [K(['wall stickers?', 'wall decals?', 'murals?', 'plaques?', 'signs?', 'posters?', 'prints?', 'canvas', 'wall art', 'wall hanging'], 'Wall Art'),
  K(['christmas', 'xmas', 'halloween', 'easter', 'thanksgiving'], 'Christmas'), K(['vases?'], 'Vase'), K(['clocks?'], 'Clock'), K(['mirrors?'], 'Mirror'),
  K(['cushion covers?', 'pillow covers?', 'pillowcases?', 'throw pillows?', 'cushions?'], 'Cushion'), K(['candles?', 'candle holders?', 'diffusers?', 'wax melts?', 'incense'], 'Home Fragrance'),
  K(['artificial flowers?', 'artificial plants?', 'faux plants?', 'fake flowers?'], 'Artificial Plants'), K(['shelf', 'shelves'], 'Ornament')];

// The site place of a path, by the longest matching start. [site, category, subcategory or keyword list, fallback]
const MAP = [
  ['Clothing, Shoes & Jewelry|Women|Clothing', 'wgw', 'Clothing', WOMEN_CLOTHES, 'Clothing'],
  ['Clothing, Shoes & Jewelry|Women|Plus', 'wgw', 'Clothing', WOMEN_CLOTHES, 'Clothing'],
  ['Clothing, Shoes & Jewelry|Women|Shoes', 'wgw', 'Shoes', SHOES, 'Shoes'],
  ['Clothing, Shoes & Jewelry|Women|Handbags & Wallets', 'wgw', 'Bags & Accessories', [K(['wallets?', 'purses?', 'card holders?'], 'Wallets & Purses')], 'Bags'],
  ['Clothing, Shoes & Jewelry|Women|Accessories', 'wgw', 'Bags & Accessories', ACCESSORIES, null],
  ['Clothing, Shoes & Jewelry|Women|Jewelry', 'wgw', "Women's Jewellery", JEWELLERY, "Women's Jewellery"],
  ['Clothing, Shoes & Jewelry|Men|Clothing', 'mgw', 'Clothing', MEN_CLOTHES, 'Clothing'],
  ["Clothing, Shoes & Jewelry|Men|Men 's Plus Clothing", 'mgw', 'Clothing', MEN_CLOTHES, 'Clothing'],
  ['Clothing, Shoes & Jewelry|Men|Shoes', 'mgw', 'Shoes', SHOES, 'Shoes'],
  ['Clothing, Shoes & Jewelry|Men|Accessories', 'mgw', 'Bags & Accessories', ACCESSORIES, null],
  ['Clothing, Shoes & Jewelry|Men|Jewelry', 'mgw', "Men's Jewellery", JEWELLERY, 'Jewellery'],
  ['Clothing, Shoes & Jewelry|Girls|Clothing', 'kgw', 'Clothing', [], 'Clothing'],
  ['Clothing, Shoes & Jewelry|Boys|Clothing', 'kgw', 'Clothing', [], 'Clothing'],
  ['Apparel & Accessories|Jewelry|Watches', 'jewellery-watch', null, null, null],
  ['Apparel & Accessories|Jewelry', 'jewellery', null, null, null],
  ['Apparel & Accessories|Clothing Accessories|Hair Accessories', 'wgw', 'Bags & Accessories', [], 'Hair Accessories'],
  ['Beauty & Personal Care|Foot, Hand & Nail Care|Nail Art & Polish', 'wgw', 'Beauty & Fragrances', [], 'Nails'],
  ['Beauty & Personal Care|Makeup', 'wgw', 'Beauty & Fragrances', [], 'Make-up'],
  ['Home & Kitchen|Home Décor Products|Home Décor Accents', 'hgw', 'Home Decor', HOME_DECOR, 'Ornament'],
  ['Home & Kitchen|Home Décor Products|Artificial Plants & Flowers', 'hgw', 'Home Decor', [], 'Artificial Plants'],
  ['Home & Kitchen|Home Décor Products|Rugs, Pads & Protectors', 'hgw', 'Home Decor', [], 'Rug'],
  ['Home & Kitchen|Home Décor Products|Decorative Pillows', 'hgw', 'Home Decor', [], 'Cushion'],
  ['Home & Kitchen|Home Décor Products', 'hgw', 'Home Decor', HOME_DECOR, 'Ornament'],
  ['Home & Kitchen|Wall Art', 'hgw', 'Home Decor', [], 'Wall Art'],
  ['Home & Kitchen|Seasonal Décor|Ornaments', 'hgw', 'Home Decor', [], 'Christmas'],
  ['Home & Kitchen|Seasonal Décor|Decorative Sign & Plague', 'hgw', 'Home Decor', [], 'Wall Art'],
  ['Home & Kitchen|Seasonal Décor', 'hgw', 'Home Decor', HOME_DECOR, 'Ornament'],
  ['Home & Kitchen|Kitchen & Dining|Kitchen Utensils & Gadgets', 'hgw', 'Kitchen & Dining', [], 'Kitchen Utensil'],
  ['Home & Kitchen|Kitchen & Dining|Bakeware', 'hgw', 'Kitchen & Dining', [], 'Cookware'],
  ['Home & Kitchen|Kitchen & Dining|Cookware', 'hgw', 'Kitchen & Dining', [], 'Cookware'],
  ['Home & Kitchen|Kitchen & Dining|Dining & Entertaining', 'hgw', 'Kitchen & Dining', [K(['glass', 'glasses', 'mugs?', 'cups?', 'tumblers?'], 'Drinkware')], 'Tableware'],
  ['Home & Kitchen|Kitchen & Dining|Kitchen & Table Linens', 'hgw', 'Kitchen & Dining', [], 'Table Linen'],
  ['Home & Kitchen|Kitchen & Dining|Storage & Organization', 'hgw', 'Storage & Organisation', [], 'Storage Box'],
  ['Home & Kitchen|Bath|Bathroom Accessories', 'hgw', 'Bedding & Bath', [], 'Bathroom Accessories'],
  ['Home & Kitchen|Bedding|Blankets & Throws', 'hgw', 'Home Decor', [], 'Throw'],
  ['Home & Kitchen|Storage & Organization', 'hgw', 'Storage & Organisation', [K(['baskets?'], 'Storage Basket'), K(['shoe rack', 'shoe organi[sz]er'], 'Shoe Rack')], 'Storage Box'],
  ['Home & Kitchen|Event & Party Supplies|Decorations', 'hgw', 'Home Decor', [], 'Party Decorations'],
  ['Home & Garden|Kitchen & Dining|Tableware', 'hgw', 'Kitchen & Dining', [], 'Tableware'],
  ['Home & Garden|Kitchen & Dining|Cookware & Bakeware', 'hgw', 'Kitchen & Dining', [], 'Cookware'],
  ['Home & Garden|Decor|Clocks', 'hgw', 'Home Decor', [], 'Clock'],
  ['Home & Garden|Decor|Window Treatments', 'hgw', 'Home Decor', [K(['blinds?'], 'Blinds')], 'Curtain'],
  ['Home & Garden|Decor|Home Fragrances', 'hgw', 'Home Decor', [], 'Home Fragrance'],
  ['Home & Garden|Linens & Bedding|Towels', 'hgw', 'Bedding & Bath', [], 'Towel'],
  ['Home & Garden|Household Supplies|Storage & Organization', 'hgw', 'Storage & Organisation', [], 'Storage Box'],
  ['Arts, Crafts & Sewing|Beading & Jewelry Making', 'wgw', "Women's Jewellery", [], 'Jewellery Making & Beads'],
  ['Arts, Crafts & Sewing', 'hgw', 'Home Decor', [], 'Craft & Sewing'],
  ['Patio, Lawn & Garden|Gardening & Lawn Care|Pots, Planters & Container Accessories', 'ggw', 'Plants, Growing & Garden Care', [], 'Pots & planters'],
  ['Patio, Lawn & Garden|Gardening & Lawn Care|Plant Support Structures', 'ggw', 'Plants, Growing & Garden Care', [], 'Growing'],
  ['Patio, Lawn & Garden|Outdoor Décor|Garden Sculptures & Statues', 'ggw', 'Garden Furniture & Outdoor Living', [], 'Garden Ornaments'],
  ['Patio, Lawn & Garden|Outdoor Décor|Decorative Garden Stakes', 'ggw', 'Garden Furniture & Outdoor Living', [], 'Garden Ornaments'],
  ['Patio, Lawn & Garden|Outdoor Décor|Chimes', 'ggw', 'Garden Furniture & Outdoor Living', [], 'Garden Ornaments'],
  ['Patio, Lawn & Garden|Outdoor Décor|Outdoor Rugs', 'ggw', 'Garden Furniture & Outdoor Living', [], 'Cushions & rugs'],
  ['Patio, Lawn & Garden|Outdoor Lighting', 'ggw', 'Outdoor Lighting & Garden Electrical', [K(['solar'], 'Solar lights'), K(['string lights?', 'fairy lights?', 'festoon'], 'String & festoon lights'), K(['lanterns?'], 'Lanterns'), K(['path', 'stake', 'spike'], 'Path & spike lights')], 'Outdoor lights'],
  ['Patio, Lawn & Garden|Outdoor Décor|Lighting', 'ggw', 'Outdoor Lighting & Garden Electrical', [K(['solar'], 'Solar lights'), K(['string lights?', 'fairy lights?'], 'String & festoon lights'), K(['lanterns?'], 'Lanterns')], 'Outdoor lights'],
  ['Tools & Home Improvement|Lighting & Ceiling Fans|Outdoor Lighting', 'ggw', 'Outdoor Lighting & Garden Electrical', [K(['solar'], 'Solar lights'), K(['string lights?'], 'String & festoon lights'), K(['flood'], 'Floodlights & security lights'), K(['wall'], 'Wall lights')], 'Outdoor lights']
];
MAP.sort((a, b) => b[0].length - a[0].length);
// Lights are allowed their solar panel and battery: only the outdoor lighting paths skip the plug check.
const LIGHTS = /Outdoor Lighting|Outdoor Décor\|Lighting/;

const isMen = n => /\b(men'?s|mens|male|man's|for men|boyfriend gift|husband)\b/i.test(n) && !/\b(women|woman|ladies|girls?)\b/i.test(n);
const isWomen = n => /\b(women'?s|womens|woman|ladies|female|girls?'?)\b/i.test(n);

export function classify({ name, brand = '', feedCategory = '' }) {
  const n = unescape(name).replace(/[  ]/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  const path = String(feedCategory || '').split(' > ')[0];
  if (BRANDS.test(`${n} | ${brand}`)) return { reject: 'a famous brand or character name on a marketplace (likely a copy)' };
  if (COPY.test(n) || MERCH.test(n)) return { reject: 'seller words for a copy, or artist, team or film merchandise' };
  if (ADULT.test(n)) return { reject: 'adult or lingerie' };
  if (NOT_THESE.test(n)) return { reject: 'weapon, smoking, or political item' };
  const m = MAP.find(x => path === x[0] || path.startsWith(x[0] + '|'));
  if (!m) return { reject: 'not a TEMU group our sites show (see the rules)' };
  if (!LIGHTS.test(path) && PLUG.test(n)) return { reject: 'has a plug, a battery or a motor (US electrical)' };
  let [, site, category, list, fallback] = m;
  if (site === 'jewellery-watch') return isMen(n) ? { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" } : (isWomen(n) ? { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' } : { reject: 'a watch for men or women? (not said)' });
  if (site === 'jewellery') {
    if (isMen(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: pick(n, JEWELLERY, 'Jewellery') };
    return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: pick(n, JEWELLERY, "Women's Jewellery") };
  }
  if (site === 'kgw' && !/\b(girls?|boys?|kids?|child|children|toddlers?|baby|teen)\b/i.test(n)) return { reject: 'not said to be for children' };
  const sub = pick(n, list || [], fallback);
  if (!sub) return { reject: 'an accessory our sites do not list (keyrings, fans, headbands ...)' };
  return { site, siteCategory: category, subcategory: sub };
}
