// Import rules for Cotton On (UK) (Rakuten Advertising MID 41440 "Cotton On (UK)", cottonon.com/UK, pounds) on Women's,
// Men's and Kids' Gear World. Wave 1 UK of the massive import (chat 7 sheet «Εγκρίσεις» row 105, 22-24 Nov 2026, lessons
// L224). Catalogue of 22 Nov 2026: 20,449 rows (one per size), 4,946 styles in a colour, every row "Apparel & Accessories >
// Clothing": the brand says who it is for: Cotton On Kids 6,849, Cotton On Women 4,761, Body (women's underwear, lounge
// and swimwear) 4,669, Cotton On Men 2,564, Typo (stationery, mugs, cards, phone cases) 1,515, Rubi (women's
// accessories) 86 and Cotton On Foundation (charity totes) 5. Names are "<brand> - <style> - <colour>".
//  - One card per style and colour (the sizes are options of it), named "<style> - <colour>" without the brand.
//  - Cotton On Women, Body and Rubi to WGW, Cotton On Men to MGW, Cotton On Kids to KGW; the subcategory from the LAST
//    garment word of the style ("Box Fit Graphic Hoodie" is a hoodie, "Long Sleeve Polo" a polo), in the subcategories each
//    site already has (L56). Swimwear goes to the site's general Clothing (no swimwear subcategory).
//  - Typo, Cotton On Foundation and pet bandanas stay out.
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'cottonon-uk',
  network: 'rakuten',
  advertiserId: 41440,
  retailer: 'Cotton On',
  currency: 'GBP',
  shop: /^https?:\/\/(www\.)?cottonon\.com\/uk\//i,
  sites: ['wgw', 'mgw', 'kgw'],
  maxPrice: 150,
  minPrice: 3
};

export function displayBrand(brand) {
  const b = String(brand || '').trim();
  return /^body$/i.test(b) ? 'Cotton On Body' : b;
}

// "Cotton On Kids - Sammy Oversize Hoodie - Rocky road/stunt" -> brand, style, colour.
export function parts(name) {
  const p = clean(name).split(/\s+-\s+/);
  const brand = p.length > 2 ? p.shift() : '';
  const colour = p.length > 1 ? p.pop() : '';
  return { brand, style: p.join(' - '), colour };
}

export function displayName(name) {
  const { style, colour } = parts(name);
  // "Lcn bra washed black / rolling stones": the shop's licence code ("Lcn bra", "Lcn wb") is not part of the colour.
  const col = colour.replace(/^(lcn|pers)\s+[a-z0-9]{2,4}\s+/i, '').trim();
  const c = col ? col.charAt(0).toUpperCase() + col.slice(1) : '';
  return c ? `${style} - ${c}` : style;
}

// One card per style and colour: the page's style word plus the colour (each size has its own page and number).
export function productKey(get) {
  const m = /\/uk\/([^/]+)\/\d+\.html/i.exec(get('merchant_deep_link') || '');
  const { colour } = parts(get('product_name'));
  if (!m) return '';
  return `${m[1].toLowerCase()}|${colour.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const K = (words, sub) => [new RegExp(`(?<![a-z0-9])(${words.join('|')})(?![a-z0-9])`, 'gi'), sub];
// The LAST garment word decides; a longer word at the same end wins ("T-Shirt Bra" is a bra, "Long Sleeve Tee" a tee).
function lastWord(n, list) {
  let best = '', end = -1, start = 0;
  for (const [re, sub] of list) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(n));) {
      const e = m.index + m[0].length;
      if (e > end || (e === end && m.index < start)) { end = e; start = m.index; best = sub; }
    }
  }
  return best;
}

const WOMEN = [
  K(['bras?', 'bralettes?', 'briefs?', 'boyshorts?', 'g-strings?', 'g strings?', 'thongs?', 'cheeky', 'brazilian', 'shorties?', 'bodysuits?', 'slips?'], 'Underwear'),
  K(['pjs', 'pyjamas?', 'pajamas?', 'sleep (shirts?|sets?|tees?)', 'robes?', 'nightie', 'nightdress'], 'Nightwear'),
  K(['bikinis?', 'bikini (tops?|bottoms?)', 'one piece', 'swimsuits?', 'swim', 'bottoms?'], 'Clothing'),
  K(['dress', 'dresses', 'sundress'], 'Dresses'), K(['playsuits?', 'jumpsuits?', 'rompers?'], 'Clothing'),
  K(['jeans?', 'jorts?'], 'Jeans'), K(['skirts?', 'skorts?'], 'Skirts'), K(['shorts?', 'sweatshorts?'], 'Shorts'),
  K(['leggings?', 'flares?'], 'Leggings'), K(['tights?'], 'Tights & Stockings'), K(['socks?'], 'Socks'),
  K(['pants?', 'trousers?', 'joggers?', 'sweatpants?', 'trackpants?'], 'Trousers'),
  K(['hoodies?', 'hoodys?', 'hoody'], 'Hoodies'), K(['sweatshirts?', 'crew'], 'Sweatshirts'),
  K(['knits?', 'sweaters?', 'cardigans?', 'cardis?', 'pullovers?', 'jumpers?', 'ponchos?'], 'Knitwear'),
  K(['jackets?', 'coats?', 'bombers?', 'trench', 'parkas?', 'puffers?', 'blazers?', 'gilets?', 'zip through'], 'Jackets & Coats'),
  K(['tees?', 't-shirts?', 'tshirts?', 'tanks?', 'henleys?', 'long ?sleeves?', 'longsleeves?', 'short sleeves?', 'sleeves?'], 'T-Shirts'),
  K(['tops?', 'racer ?backs?', 'cami', 'camis', 'halters?', 'bandeaus?', 'tubes?', 'blouses?', 'shirts?', 'polos?', 'crops?', 'corsets?', 'neck'], 'Tops & Blouses')
];
const MEN = [
  K(['briefs?', 'trunks', 'boxers?'], 'Underwear'), K(['pjs', 'pyjamas?', 'pajamas?', 'robes?'], 'Nightwear'),
  K(['jeans?', 'jorts?'], 'Jeans'), K(['shorts?', 'board ?shorts?', 'swim'], 'Shorts'), K(['socks?'], 'Socks'),
  K(['pants?', 'trousers?', 'joggers?', 'trackpants?', 'chinos?', 'cargos?'], 'Trousers'),
  K(['hoodies?', 'hoodys?'], 'Hoodies'), K(['sweatshirts?', 'crew'], 'Sweatshirts'), K(['fleece'], 'Fleece'),
  K(['knits?', 'sweaters?', 'cardigans?', 'jumpers?', 'pullovers?'], 'Knitwear'),
  K(['jackets?', 'coats?', 'bombers?', 'harrington', 'parkas?', 'puffers?', 'gilets?', 'vests?', 'spray jacket'], 'Jackets'),
  K(['shirts?', 'overshirts?', 'polos?'], 'Shirts'),
  K(['tees?', 't-shirts?', 'tshirts?', 'tanks?', 'muscle', 'jerseys?', 'long ?sleeves?', 'henleys?'], 'T-Shirts')
];

const ACC_W = [[/sunglasses/i, 'Sunglasses'], [/\bscarf\b|\bscarves\b/i, 'Scarves'], [/\bbags?\b|\btotes?\b|crossbody|\bpurses?\b/i, 'Bags'],
  [/\bcaps?\b|\bbeanies?\b|\bbonnets?\b|\bhats?\b|bucket hat/i, 'Hats'], [/claw clips?|\bclips?\b|scrunchies?|headbands?|\bhair\b/i, 'Hair Accessories'],
  [/\bwallets?\b/i, 'Wallets & Purses'], [/\bbelts?\b/i, 'Belts'], [/\bgloves?\b|\bmittens?\b/i, 'Gloves'], [/\bcharms?\b|arm warmers?|keyrings?/i, 'Accessories']];

function women(style) {
  if (/\bsocks?\b|\d ?pk .*sock|ankle 2pk|quarter crew/i.test(style)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (/necklace|earrings?|bracelet|\brings?\b/i.test(style)) {
    const sub = /earring/i.test(style) ? 'Earrings' : /bracelet/i.test(style) ? 'Bracelets' : /\brings?\b/i.test(style) ? 'Rings' : 'Necklaces';
    return { siteCategory: "Women's Jewellery", subcategory: sub };
  }
  for (const [re, sub] of ACC_W) if (re.test(style) && !/\b(dress|top|tee|pant|short|bra|brief)\b/i.test(style)) return { siteCategory: 'Bags & Accessories', subcategory: sub };
  if (/\b(slides?|sandals?|thongs? sandal|slippers?|sneakers?|boots?)\b/i.test(style)) {
    return { siteCategory: 'Shoes', subcategory: /slipper/i.test(style) ? 'Slippers' : /boot/i.test(style) ? 'Boots' : /sneaker/i.test(style) ? 'Trainers' : 'Sandals' };
  }
  const sub = lastWord(style, WOMEN);
  return sub ? { siteCategory: 'Clothing', subcategory: sub } : null;
}

function men(style) {
  if (/\b(slides?|sandals?|thongs?)\b/i.test(style)) return { siteCategory: 'Shoes', subcategory: 'Sandals' };
  if (/\b(caps?|beanie|hats?|bucket)\b/i.test(style)) return { siteCategory: 'Bags & Accessories', subcategory: 'Hats' };
  if (/scarf|scarves/i.test(style)) return { siteCategory: 'Bags & Accessories', subcategory: 'Scarves' };
  if (/\bbags?\b|backpack|tote/i.test(style)) return { siteCategory: 'Bags & Accessories', subcategory: 'Bags' };
  const sub = lastWord(style, MEN);
  return sub ? { siteCategory: 'Clothing', subcategory: sub } : null;
}

function kids(style) {
  if (/pet bandana|towel|blanket|mug|bottle/i.test(style)) return null;
  if (/\bsocks?\b/i.test(style)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  if (/pyjama|pajama|\bpjs\b|sleep|robe|nightie/i.test(style)) return { siteCategory: 'Clothing', subcategory: 'Nightwear & Loungewear' };
  if (/\b(slides?|sandals?|sneakers?|boots?|shoes?|slippers?|crocs?)\b/i.test(style)) return { siteCategory: 'Shoes', subcategory: 'Shoes' };
  if (/beanie|\bcaps?\b|\bhats?\b|bucket|bag\b|backpack|sunglasses|hair|clip|scrunchie|headband|gloves?|mittens?|scarf/i.test(style)) return { siteCategory: 'Accessories', subcategory: 'Accessories' };
  return { siteCategory: 'Clothing', subcategory: 'Clothing' };
}

export function classify({ name, brand = '' }) {
  const { brand: b0, style } = parts(name);
  const b = String(brand || b0 || '').trim();
  const n = displayName(name);
  if (!style) return { reject: 'no name' };
  if (/^typo$|foundation/i.test(b) || /^typo\b/i.test(b0)) return { reject: 'Typo stationery and gifts, or a charity item (not clothing)' };
  if (/gift ?card|personalised|pet bandana|phone case/i.test(style)) return { reject: 'gift card, personalised item or pet accessory' };
  let site = '', place = null;
  if (/kids/i.test(b)) { site = 'kgw'; place = kids(style); }
  else if (/\bmen\b/i.test(b)) { site = 'mgw'; place = men(style); }
  else if (/women|^body$|rubi/i.test(b)) { site = 'wgw'; place = women(style); }
  else return { reject: `brand "${b || 'none'}": not Cotton On Women, Men, Kids, Body or Rubi` };
  if (!place) return { reject: 'not clothing, shoes or an accessory the site has a place for' };
  return { site, ...place, name: n };
}
