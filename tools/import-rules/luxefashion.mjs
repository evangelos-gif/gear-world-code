// Import rules for Luxefashion Clothing (Awin advertiser 126787, feed 115438) on Women's Gear World, and its men's items
// on Men's Gear World (owner, 8 Nov 2026: "tsekare an mporoun na mpoun allou" - the shop had been left out). Feed facts
// (feed-profile 8 Nov 2026): 89,452 rows, one per size, GBP 17.99 to 59.99, shop luxefashionclothing.com, no category,
// brand "Luxefashionclothing". The shop's own page shows the same prices as a sale ("was £138.41, now £59.99"), so the
// £59.99 top price is real. The shop sells women's clothing (plus size, maternity), dresses, lingerie, footwear (high
// heels, which WGW was missing), handbags and accessories, and men's clothing and underwear.
// Names are wholesale style: "<type> model <number> <brand> - <size> - <colour>" ("Block heel pumps model 226555 Solea -
// 39 - Black"). The card is one model in one colour (sizes joined, lowest price) and is named "<Brand> <type> - <colour>"
// ("Solea Block Heel Pumps - Black"). The feed's gender, product type and keywords columns, when filled, are read with the
// category (rules.field), so a men's item can go to MGW.
export const RULES = {
  key: 'luxefashion',
  advertiserId: 126787,
  retailer: 'Luxefashion Clothing',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?luxefashionclothing\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 300,
  minPrice: 5,
  keepQuery: true
};

export function field(c, column) {
  if (c === 'merchant_category') {
    return [column('merchant_category'), column('fashion_suitable_for'), column('product_type'), column('keywords')].filter(Boolean).join(' | ');
  }
  return column(c);
}

const PATTERN = /^(.*?)\s+model\s+(\d{3,9})\s+(.+?)(?:\s+-\s+(.+?))?(?:\s+-\s+([^-]+))?$/i;
export function parseName(name) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const m = PATTERN.exec(n);
  if (!m) return { type: n, model: '', brand: '', size: '', colour: '' };
  // "<type> model <n> <brand> - <size> - <colour>"; with one part after the brand it is the colour.
  const [, type, model, brand, a, b] = m;
  return { type: type.trim(), model, brand: brand.trim(), size: b ? (a || '').trim() : '', colour: (b || a || '').trim() };
}

const cap = s => String(s || '').toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (x, p, c) => p + c.toUpperCase());
export function cardName(name) {
  const p = parseName(name);
  if (!p.model) return String(name || '').trim();
  const brand = cap(p.brand);
  const colour = p.colour && !/^one[- ]size/i.test(p.colour) ? ` - ${cap(p.colour)}` : '';
  // "Soft model 198086 Teyli - 100C - White": the type is a bra style, so the card says "Teyli Soft Bra - White".
  const type = /^(semi-?soft|soft|push-?up|balconette|plunge)$/i.test(p.type) ? `${p.type} bra` : p.type;
  return `${brand} ${cap(type)}${colour}`.trim();
}

export function productKey(get) {
  const p = parseName(get('product_name'));
  if (p.model) return `model-${p.model}-${p.colour.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand() {
  return 'Luxefashion Clothing';
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const MEN = W(["men'?s", 'mens', 'for men', 'male', 'boxers?', 'boxer shorts', 'trunks', 'briefs men']);
const SHOES = [
  ['Heels', W(['high heels?', 'heels?', 'heeled', 'pumps?', 'stilettos?', 'courts?', 'platforms?', 'wedges?'])],
  ['Boots', W(['boots?', 'booties', 'ankle boots?', 'knee boots?', 'wellingtons?'])],
  ['Sandals', W(['sandals?', 'flip[- ]flops?', 'mules?', 'slides?', 'espadrilles?'])],
  ['Trainers', W(['sneakers?', 'trainers?', 'sports shoes?'])],
  ['Shoes', W(['shoes?', 'ballerinas?', 'ballet flats?', 'loafers?', 'moccasins?', 'slip-?ons?', 'flats'])],
  ['Slippers', W(['slippers?'])]
];
const LINGERIE = W(['bras?', 'padded bra', 'push-?up', 'soft', 'semi-?soft', 'balconette', 'bralette', 'panties', 'knickers', 'thongs?', 'briefs', 'g-?strings?',
  'corsets?', 'basques?', 'garter', 'suspender belts?', 'stockings?', 'tights', 'hold-?ups?', 'lingerie', 'bodies', 'shapewear', 'bustiers?']);
const NIGHT = W(['nightdress(?:es)?', 'nightgowns?', 'nightshirts?', 'pyjamas?', 'pajamas?', 'negligees?', 'chemises?', 'babydolls?', 'dressing gowns?', 'robes?', 'nightwear']);
const BAGS = [
  ['Bags', W(['handbags?', 'bags?', 'shoppers?', 'clutch(?:es)?', 'backpacks?', 'purses?', 'wallets?'])],
  ['Scarves', W(['scarf', 'scarves', 'shawls?', 'snoods?'])], ['Hats', W(['hats?', 'caps?', 'berets?', 'beanies?'])],
  ['Gloves', W(['gloves?', 'mittens?'])], ['Belts', W(['belts?'])], ['Accessories', W(['earrings?', 'necklaces?', 'bracelets?', 'jewellery', 'sunglasses'])]
];
const CLOTHES = [
  ['Swimwear', W(['swimsuits?', 'bikinis?', 'swimming costumes?', 'tankinis?', 'swimwear'])],
  ['Dresses', W(['dress(?:es)?', 'cocktail dress', 'long dress', 'evening dress', 'gowns?'])],
  ['Jackets & Coats', W(['jackets?', 'coats?', 'blazers?', 'parkas?', 'gilets?', 'vests? jacket'])],
  ['Knitwear', W(['sweaters?', 'jumpers?', 'cardigans?', 'pullovers?', 'knit\\w*'])],
  ['Jeans', W(['jeans'])], ['Leggings', W(['leggings'])], ['Shorts', W(['shorts'])], ['Skirts', W(['skirts?'])],
  ['Trousers', W(['trousers', 'pants', 'joggers?', 'sweatpants', 'jumpsuits?', 'overalls?'])],
  ['T-Shirts', W(['t-?shirts?', 'tees?'])], ['Tops & Blouses', W(['blouses?', 'tops?', 'shirts?', 'tunics?', 'bodysuits?', 'camisoles?', 'tank tops?'])],
  ['Hoodies', W(['hoodies?', 'hooded'])], ['Sweatshirts', W(['sweatshirts?'])], ['Activewear', W(['sports? bras?', 'sports? leggings', 'tracksuits?', 'activewear'])]
];

export function classify({ name, feedCategory = '' }) {
  const p = parseName(name);
  const t = `${p.type} ${feedCategory}`;
  const card = cardName(name);
  if (!p.type) return { reject: 'no name' };
  if (/gift ?card|voucher/i.test(name)) return { reject: 'gift card, not a product' };
  const men = MEN.test(t) && !W(["women'?s", 'ladies', 'female']).test(t);
  if (men) {
    if (/\b(boxers?|trunks|briefs|underwear|vests?)\b/i.test(p.type)) return { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Underwear', name: card };
    for (const [sub, re] of SHOES) if (re.test(p.type)) return { site: 'mgw', siteCategory: 'Shoes', subcategory: sub === 'Heels' ? 'Shoes' : sub, name: card };
    for (const [sub, re] of CLOTHES) if (re.test(p.type)) return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub === 'Jackets & Coats' ? 'Jackets' : sub, name: card };
    return { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Clothing', name: card };
  }
  for (const [sub, re] of SHOES) if (re.test(p.type)) return { site: 'wgw', siteCategory: 'Shoes', subcategory: sub, name: card };
  // A bra size ("75D", "100C") is lingerie whatever the type word says ("Soft", "Semi-soft").
  if (LINGERIE.test(p.type) || /^\d{2,3}[A-K]{1,2}$/i.test(p.size)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Underwear', name: card };
  if (NIGHT.test(p.type)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Nightwear', name: card };
  for (const [sub, re] of BAGS) if (re.test(p.type)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: sub, name: card };
  for (const [sub, re] of CLOTHES) if (re.test(p.type)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: sub, name: card };
  return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Clothing', name: card };
}
